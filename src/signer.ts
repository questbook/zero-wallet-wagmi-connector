/* eslint-disable camelcase */
import {
    BlockTag,
    FeeData,
    TransactionRequest,
    TransactionResponse
} from '@ethersproject/abstract-provider';
import { Logger } from '@ethersproject/logger';
import axios from 'axios';
import { BigNumber, ethers, TypedDataDomain, TypedDataField } from 'ethers';
import {
    Bytes,
    Deferrable,
    defineReadOnly,
    hexlify,
    isHexString,
    resolveProperties,
    shallowCopy,
    toUtf8Bytes
} from 'ethers/lib/utils';
import { IStoreable } from './store/IStoreable';
import { ZeroWalletProvider } from './provider';
import { _constructorGuard } from './provider';
import { RecoveryMechanism } from './recovery';
import {
    BigNumberAPI,
    BuildExecTransactionType,
    DeployWebHookAttributesType,
    WebHookAttributesType,
    ZeroWalletServerEndpoints
} from './types';

const version = 'providers/5.7.2';
const logger = new Logger(version);
const EIP712_WALLET_TX_TYPE = {
    WalletTx: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'value' },
        { type: 'bytes', name: 'data' },
        { type: 'uint8', name: 'operation' },
        { type: 'uint256', name: 'targetTxGas' },
        { type: 'uint256', name: 'baseGas' },
        { type: 'uint256', name: 'gasPrice' },
        { type: 'address', name: 'gasToken' },
        { type: 'address', name: 'refundReceiver' },
        { type: 'uint256', name: 'nonce' }
    ]
};

const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS,
    Logger.errors.NONCE_EXPIRED,
    Logger.errors.REPLACEMENT_UNDERPRICED
];
const errorGas = ['call', 'estimateGas'];
const allowedTransactionKeys: Array<string> = [
    'accessList',
    'ccipReadEnabled',
    'chainId',
    'customData',
    'data',
    'from',
    'gasLimit',
    'gasPrice',
    'maxFeePerGas',
    'maxPriorityFeePerGas',
    'nonce',
    'to',
    'type',
    'value'
];

function spelunk(
    value: any,
    requireData: boolean
): null | { message: string; data: null | string } {
    if (value === null) {
        return null;
    }

    // These *are* the droids we're looking for.
    if (typeof value.message === 'string' && value.message.match('reverted')) {
        const data = isHexString(value.data) ? value.data : null;
        if (!requireData || data) {
            return { message: value.message, data };
        }
    }

    // Spelunk further...
    if (typeof value === 'object') {
        for (const key in value) {
            const result = spelunk(value[key], requireData);
            if (result) {
                return result;
            }
        }

        return null;
    }

    // Might be a JSON string we can further descend...
    if (typeof value === 'string') {
        try {
            return spelunk(JSON.parse(value), requireData);
        } catch (error) {}
    }

    return null;
}

function checkError(method: string, error: any, params: any): any {
    const transaction = params.transaction || params.signedTransaction;

    // Undo the "convenience" some nodes are attempting to prevent backwards
    // incompatibility; maybe for v6 consider forwarding reverts as errors
    if (method === 'call') {
        const result = spelunk(error, true);
        if (result) {
            return result.data;
        }

        // Nothing descriptive..
        logger.throwError(
            'missing revert data in call exception; Transaction reverted without a reason string',
            Logger.errors.CALL_EXCEPTION,
            {
                data: '0x',
                transaction,
                error
            }
        );
    }

    if (method === 'estimateGas') {
        // Try to find something, with a preference on SERVER_ERROR body
        let result = spelunk(error.body, false);
        if (result === null) {
            result = spelunk(error, false);
        }

        // Found "reverted", this is a CALL_EXCEPTION
        if (result) {
            logger.throwError(
                'cannot estimate gas; transaction may fail or may require manual gas limit',
                Logger.errors.UNPREDICTABLE_GAS_LIMIT,
                {
                    reason: result.message,
                    method,
                    transaction,
                    error
                }
            );
        }
    }

    let message = error.message;
    if (
        error.code === Logger.errors.SERVER_ERROR &&
        error.error &&
        typeof error.error.message === 'string'
    ) {
        message = error.error.message;
    } else if (typeof error.body === 'string') {
        message = error.body;
    } else if (typeof error.responseText === 'string') {
        message = error.responseText;
    }

    message = (message || '').toLowerCase();

    // "insufficient funds for gas * price + value + cost(data)"
    if (
        message.match(
            /insufficient funds|base fee exceeds gas limit|InsufficientFunds/i
        )
    ) {
        logger.throwError(
            'insufficient funds for intrinsic transaction cost',
            Logger.errors.INSUFFICIENT_FUNDS,
            {
                error,
                method,
                transaction
            }
        );
    }

    // "nonce too low"
    if (message.match(/nonce (is )?too low/i)) {
        logger.throwError(
            'nonce has already been used',
            Logger.errors.NONCE_EXPIRED,
            {
                error,
                method,
                transaction
            }
        );
    }

    // "replacement transaction underpriced"
    if (
        message.match(
            /replacement transaction underpriced|transaction gas price.*too low/i
        )
    ) {
        logger.throwError(
            'replacement fee too low',
            Logger.errors.REPLACEMENT_UNDERPRICED,
            {
                error,
                method,
                transaction
            }
        );
    }

    // "replacement transaction underpriced"
    if (message.match(/only replay-protected/i)) {
        logger.throwError(
            'legacy pre-eip-155 transactions not supported',
            Logger.errors.UNSUPPORTED_OPERATION,
            {
                error,
                method,
                transaction
            }
        );
    }

    if (
        errorGas.indexOf(method) >= 0 &&
        message.match(
            /gas required exceeds allowance|always failing transaction|execution reverted|revert/
        )
    ) {
        logger.throwError(
            'cannot estimate gas; transaction may fail or may require manual gas limit',
            Logger.errors.UNPREDICTABLE_GAS_LIMIT,
            {
                error,
                method,
                transaction
            }
        );
    }

    throw error;
}

export class ZeroWalletSigner {
    private store: IStoreable;

    readonly provider: ZeroWalletProvider;
    readonly _isSigner: boolean;

    zeroWallet: ethers.Wallet;
    recoveryMechansim: RecoveryMechanism | undefined;

    // @ts-ignore
    _index: number;

    // @ts-ignore
    _address: string;
    scwAddress?: string;
    gasTankName: string;

    zeroWalletServerEndpoints: ZeroWalletServerEndpoints;

    constructor(
        constructorGuard: any,
        provider: ZeroWalletProvider,
        store: IStoreable,
        zeroWalletServerEndpoints: ZeroWalletServerEndpoints,
        gasTankName: string,
        addressOrIndex?: string | number,
        recoveryMechansim?: RecoveryMechanism
    ) {
        if (constructorGuard !== _constructorGuard) {
            throw new Error(
                'do not call the JsonRpcSigner constructor directly; use provider.getSigner'
            );
        }

        this.gasTankName = gasTankName;
        this.zeroWalletServerEndpoints = zeroWalletServerEndpoints;
        this.store = store;
        this.provider = provider;
        // defineReadOnly(this, "provider", provider);

        if (addressOrIndex === undefined) {
            addressOrIndex = 0;
        }

        const zeroWalletPrivateKey = this.store.get('zeroWalletPrivateKey');

        if (!zeroWalletPrivateKey) {
            logger.makeError(
                'ZeroWalletPrivateKey not found in storage',
                Logger.errors.UNSUPPORTED_OPERATION
            );
            this.zeroWallet = ethers.Wallet.createRandom();
        } else {
            this.zeroWallet = new ethers.Wallet(zeroWalletPrivateKey);
        }

        this.zeroWallet = this.zeroWallet.connect(this.provider);

        if (typeof addressOrIndex === 'string') {
            this._address = this.provider.formatter.address(addressOrIndex);
            // @ts-ignore
            defineReadOnly(this, '_index', null);
        } else if (typeof addressOrIndex === 'number') {
            this._index = addressOrIndex;
            // @ts-ignore
            defineReadOnly(this, '_address', null);
        } else {
            logger.throwArgumentError(
                'invalid address or index',
                'addressOrIndex',
                addressOrIndex
            );
        }

        this.recoveryMechansim = recoveryMechansim;
        this._isSigner = true;
    }

    async populateTransaction(
        transaction: Deferrable<TransactionRequest>
    ): Promise<TransactionRequest> {
        const tx: Deferrable<TransactionRequest> = await resolveProperties(
            this.checkTransaction(transaction)
        );

        if (tx.to !== null) {
            tx.to = Promise.resolve(tx.to).then(async (to) => {
                if (to === null) {
                    return undefined;
                }

                const address = await this.resolveName(to!);
                if (address === null) {
                    logger.throwArgumentError(
                        'provided ENS name resolves to null',
                        'tx.to',
                        to
                    );
                }

                return address;
            });

            // Prevent this error from causing an UnhandledPromiseException
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            tx.to.catch(() => {});
        }

        // Do not allow mixing pre-eip-1559 and eip-1559 properties
        const hasEip1559 =
            tx.maxFeePerGas !== null || tx.maxPriorityFeePerGas !== null;
        if (tx.gasPrice !== null && (tx.type === 2 || hasEip1559)) {
            logger.throwArgumentError(
                'eip-1559 transaction do not support gasPrice',
                'transaction',
                transaction
            );
        } else if ((tx.type === 0 || tx.type === 1) && hasEip1559) {
            logger.throwArgumentError(
                'pre-eip-1559 transaction do not support maxFeePerGas/maxPriorityFeePerGas',
                'transaction',
                transaction
            );
        }

        if (
            (tx.type === 2 || tx.type === null) &&
            tx.maxFeePerGas !== null &&
            tx.maxPriorityFeePerGas !== null
        ) {
            // Fully-formed EIP-1559 transaction (skip getFeeData)
            tx.type = 2;
        } else if (tx.type === 0 || tx.type === 1) {
            // Explicit Legacy or EIP-2930 transaction

            // Populate missing gasPrice
            if (tx.gasPrice === null) {
                tx.gasPrice = this.getGasPrice();
            }
        } else {
            // We need to get fee data to determine things
            const feeData = await this.getFeeData();

            if (tx.type === null) {
                // We need to auto-detect the intended type of this transaction...

                if (
                    feeData.maxFeePerGas !== null &&
                    feeData.maxPriorityFeePerGas !== null
                ) {
                    // The network supports EIP-1559!

                    // Upgrade transaction from null to eip-1559
                    tx.type = 2;

                    if (tx.gasPrice !== null) {
                        // Using legacy gasPrice property on an eip-1559 network,
                        // so use gasPrice as both fee properties
                        const gasPrice = tx.gasPrice;
                        delete tx.gasPrice;
                        tx.maxFeePerGas = gasPrice;
                        tx.maxPriorityFeePerGas = gasPrice;
                    } else {
                        // Populate missing fee data
                        if (tx.maxFeePerGas === null) {
                            tx.maxFeePerGas = feeData.maxFeePerGas;
                        }

                        if (tx.maxPriorityFeePerGas === null) {
                            tx.maxPriorityFeePerGas =
                                feeData.maxPriorityFeePerGas;
                        }
                    }
                } else if (feeData.gasPrice !== null) {
                    // Network doesn't support EIP-1559...

                    // ...but they are trying to use EIP-1559 properties
                    if (hasEip1559) {
                        logger.throwError(
                            'network does not support EIP-1559',
                            Logger.errors.UNSUPPORTED_OPERATION,
                            {
                                operation: 'populateTransaction'
                            }
                        );
                    }

                    // Populate missing fee data
                    if (tx.gasPrice === null) {
                        tx.gasPrice = feeData.gasPrice;
                    }

                    // Explicitly set untyped transaction to legacy
                    tx.type = 0;
                } else {
                    // getFeeData has failed us.
                    logger.throwError(
                        'failed to get consistent fee data',
                        Logger.errors.UNSUPPORTED_OPERATION,
                        {
                            operation: 'signer.getFeeData'
                        }
                    );
                }
            } else if (tx.type === 2) {
                // Explicitly using EIP-1559

                // Populate missing fee data
                if (tx.maxFeePerGas === null) {
                    tx.maxFeePerGas = feeData.maxFeePerGas ?? undefined;
                }

                if (tx.maxPriorityFeePerGas === null) {
                    tx.maxPriorityFeePerGas =
                        feeData.maxPriorityFeePerGas ?? undefined;
                }
            }
        }

        if (tx.nonce === null) {
            tx.nonce = this.getTransactionCount('pending');
        }

        if (tx.gasLimit === null) {
            tx.gasLimit = this.estimateGas(tx).catch((error) => {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }

                return logger.throwError(
                    'cannot estimate gas; transaction may fail or may require manual gas limit',
                    Logger.errors.UNPREDICTABLE_GAS_LIMIT,
                    {
                        error: error,
                        tx: tx
                    }
                );
            });
        }

        if (tx.chainId === null) {
            tx.chainId = this.getChainId();
        } else {
            tx.chainId = Promise.all([
                Promise.resolve(tx.chainId),
                this.getChainId()
            ]).then((results) => {
                if (results[1] !== 0 && results[0] !== results[1]) {
                    logger.throwArgumentError(
                        'chainId address mismatch',
                        'transaction',
                        transaction
                    );
                }

                return results[0];
            });
        }

        return await resolveProperties(tx);
    }

    async resolveName(name: string): Promise<string> {
        this._checkProvider('resolveName');
        return (await this.provider.resolveName(name))!;
    }

    async getGasPrice(): Promise<BigNumber> {
        this._checkProvider('getGasPrice');
        return await this.provider.getGasPrice();
    }

    async call(
        transaction: Deferrable<TransactionRequest>,
        blockTag?: BlockTag
    ): Promise<string> {
        this._checkProvider('call');
        const tx = await resolveProperties(this.checkTransaction(transaction));
        return await this.provider.call(tx, blockTag);
    }

    async getChainId(): Promise<number> {
        this._checkProvider('getChainId');
        const network = await this.provider.getNetwork();
        return network.chainId;
    }

    async getFeeData(): Promise<FeeData> {
        this._checkProvider('getFeeData');
        return await this.provider.getFeeData();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getBalance(blockTag?: BlockTag): Promise<BigNumber> {
        throw new Error(`Method not implemented. ${blockTag}`);
    }

    async estimateGas(
        transaction: Deferrable<TransactionRequest>
    ): Promise<BigNumber> {
        this._checkProvider('estimateGas');
        const tx = await resolveProperties(this.checkTransaction(transaction));
        return await this.provider.estimateGas(tx);
    }

    checkTransaction(
        transaction: Deferrable<TransactionRequest>
    ): Deferrable<TransactionRequest> {
        for (const key in transaction) {
            if (allowedTransactionKeys.indexOf(key) === -1) {
                logger.throwArgumentError(
                    'invalid transaction key: ' + key,
                    'transaction',
                    transaction
                );
            }
        }

        const tx = shallowCopy(transaction);

        if (tx.from === null) {
            tx.from = this.getAddress();
        } else {
            // Make sure any provided address matches this signer
            tx.from = Promise.all([
                Promise.resolve(tx.from),
                this.getAddress()
            ]).then((result) => {
                if (result[0]?.toLowerCase() !== result[1].toLowerCase()) {
                    logger.throwArgumentError(
                        'from address mismatch',
                        'transaction',
                        transaction
                    );
                }

                return result[0];
            });
        }

        return tx;
    }

    async getTransactionCount(blockTag?: BlockTag): Promise<number> {
        this._checkProvider('getTransactionCount');
        return await this.provider.getTransactionCount(
            this.getAddress(),
            blockTag
        );
    }

    _checkProvider(operation?: string): void {
        if (!this.provider) {
            logger.throwError(
                'missing provider',
                Logger.errors.UNSUPPORTED_OPERATION,
                {
                    operation: operation || '_checkProvider'
                }
            );
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connect(provider: ethers.providers.JsonRpcProvider): ZeroWalletSigner {
        provider
        return logger.throwError(
            'cannot alter JSON-RPC Signer connection',
            Logger.errors.UNSUPPORTED_OPERATION,
            {
                operation: 'connect'
            }
        );
    }

    connectUnchecked(): ZeroWalletSigner {
        return logger.throwError(
            'cannot alter JSON-RPC Signer connection',
            Logger.errors.UNSUPPORTED_OPERATION,
            {
                operation: 'connect'
            }
        );
    }

    getAddress(): Promise<string> {
        if (!this.zeroWallet) {
            logger.throwError(
                'Zero Wallet is not initialized yet',
                Logger.errors.UNSUPPORTED_OPERATION
            );
            return Promise.resolve('');
        } else {
            return Promise.resolve(this.zeroWallet.address);
        }
    }

    async signMessage(message: Bytes | string): Promise<string> {
        const data =
            typeof message === 'string' ? toUtf8Bytes(message) : message;
        try {
            return await this.zeroWallet.signMessage(hexlify(data));
        } catch (error) {
            throw error;
        }
    }

    async _legacySignMessage(message: Bytes | string): Promise<string> {
        return this.signMessage(message);
    }

    getProvider() {
        return this.provider;
    }

    getNetwork() {
        return this.provider.getNetwork();
    }

    async signTransaction(
        transaction: Deferrable<TransactionRequest>
    ): Promise<string> {
        if (!this.zeroWallet) {
            logger.throwError(
                'Zero Wallet is not initialized yet',
                Logger.errors.UNSUPPORTED_OPERATION
            );
            throw new Error('Zero Wallet is not initialized yet');
        }

        const { scwAddress, safeTXBody } = await this.buildTransaction(
            transaction
        );

        this.scwAddress = scwAddress;

        const chainId = (await this.provider.getNetwork()).chainId;

        const signature = await this._signTypedData(
            {
                verifyingContract: scwAddress,
                chainId: ethers.BigNumber.from(chainId)
            },
            EIP712_WALLET_TX_TYPE,
            safeTXBody
        );

        let newSignature = '0x';
        newSignature += signature.slice(2);

        return newSignature;
    }

    async sendUncheckedTransaction(
        transaction: Deferrable<TransactionRequest>
    ): Promise<string> {
        transaction = shallowCopy(transaction);

        const fromAddress = this.getAddress().then((address) => {
            if (address) {
                address = address.toLowerCase();
            }

            return address;
        });

        // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
        // wishes to use this, it is easy to specify explicitly, otherwise
        // we look it up for them.
        if (transaction.gasLimit === null) {
            const estimate = shallowCopy(transaction);
            estimate.from = fromAddress;
            transaction.gasLimit = this.provider.estimateGas(estimate);
        }

        if (transaction.to !== null) {
            transaction.to = Promise.resolve(transaction.to).then(
                async (to) => {
                    if (to === null) {
                        return undefined;
                    }

                    const address = await this.provider.resolveName(to!);
                    if (address === null) {
                        logger.throwArgumentError(
                            'provided ENS name resolves to null',
                            'tx.to',
                            to
                        );
                    }

                    return address ?? undefined;
                }
            );
        }

        return resolveProperties({
            tx: resolveProperties(transaction),
            sender: fromAddress
        }).then(({ tx, sender }) => {
            if (tx.from !== null) {
                if (tx.from!.toLowerCase() !== sender) {
                    logger.throwArgumentError(
                        'from address mismatch',
                        'transaction',
                        transaction
                    );
                }
            } else {
                tx.from = sender;
            }

            const hexTx = (<any>this.provider.constructor).hexlifyTransaction(
                tx,
                {
                    from: true
                }
            );

            return this.provider.send('eth_sendTransaction', [hexTx]).then(
                (hash) => {
                    return hash;
                },
                (error) => {
                    if (
                        typeof error.message === 'string' &&
                        error.message.match(/user denied/i)
                    ) {
                        logger.throwError(
                            'user rejected transaction',
                            Logger.errors.ACTION_REJECTED,
                            {
                                action: 'sendTransaction',
                                transaction: tx
                            }
                        );
                    }

                    return checkError('sendTransaction', error, hexTx);
                }
            );
        });
    }

    async sendTransaction(
        transaction: Deferrable<TransactionRequest>
    ): Promise<TransactionResponse> {
        
        const transactionWithChainId = {
            ...transaction, 
            chainId: this.getProvider().zeroWalletNetwork.chainId
        }

        const { scwAddress, safeTXBody } = await this.buildTransaction(
            transactionWithChainId
        );

        this.scwAddress = scwAddress;

        const signature = await this.signTransaction(transactionWithChainId);
        const nonce = await this.getNonce();
        const signedNonce = await this.signNonce(nonce);

        const webHookAttributes: WebHookAttributesType = {
            signedNonce: signedNonce,
            nonce: nonce,
            to: (await transaction.to)!,
            chainId: transactionWithChainId.chainId
        };

        // Send the transaction

        const response = await axios.post(
            this.zeroWalletServerEndpoints.gasStation,
            {
                execTransactionBody: safeTXBody,
                zeroWalletAddress: this.scwAddress,
                signature,
                webHookAttributes,
                gasTankName: this.gasTankName
            }
        );

        return {
            hash: response.data.txHash,
            confirmations: 1,
            from: scwAddress,
            wait: async () => {
                return {
                    to: 'string',
                    from: 'string',
                    contractAddress: 'string',
                    transactionIndex: 1,
                    gasUsed: ethers.BigNumber.from('1'),
                    logsBloom: 'string',
                    blockHash: 'string',
                    transactionHash: 'string',
                    logs: [],
                    blockNumber: 1,
                    confirmations: 1,
                    cumulativeGasUsed: ethers.BigNumber.from('1'),
                    effectiveGasPrice: ethers.BigNumber.from('1'),
                    byzantium: true,
                    type: 1
                };
            },
            nonce: 1,
            gasLimit: ethers.BigNumber.from('1'),
            data: 'string',
            value: ethers.BigNumber.from('1'),
            chainId: 1
        };
    }

    async _signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        return await this.zeroWallet._signTypedData(domain, types, value);
    }

    async signNonce(
        nonce: string
    ): Promise<{ v: number; r: string; s: string; transactionHash: string }> {
        const nonceHash = ethers.utils.hashMessage(nonce);
        const nonceSigString: string = await this.zeroWallet.signMessage(nonce);
        const nonceSig: ethers.Signature =
            ethers.utils.splitSignature(nonceSigString);

        return {
            v: nonceSig.v,
            r: nonceSig.r,
            s: nonceSig.s,
            transactionHash: nonceHash
        };
    }

    async getNonce(): Promise<string> {
        if (!this.zeroWalletServerEndpoints.nonceProvider) {
            throw new Error('nonce Provider is not attached');
        }

        const nonce: string | null = this.store.get('nonce');

        if (nonce) return nonce;

        const response = await axios.post(
            this.zeroWalletServerEndpoints.nonceProvider,
            {
                zeroWalletAddress: this.zeroWallet.address,
                gasTankName: this.gasTankName
            }
        );

        if (response.data && response.data.nonce !== 'Token expired') {
            this.store.set('nonce', response.data.nonce);
            return response.data.nonce;
        }

        throw new Error('wallet is not authorized');
    }

    async buildTransaction(
        tx: Deferrable<TransactionRequest>
    ): Promise<{ scwAddress: string; safeTXBody: BuildExecTransactionType }> {
        const nonce = await this.getNonce();
        const signedNonce = await this.signNonce(nonce);

        const webHookAttributes = {
            nonce,
            signedNonce,
            to: tx.to,
            // eslint-disable-next-line camelcase
            chainId: tx.chainId
        };

        const { data } = tx;

        const response = await axios.post<{
            safeTXBody: BuildExecTransactionType & { nonce: BigNumberAPI };
            scwAddress: string;
        }>(this.zeroWalletServerEndpoints.transactionBuilder, {
            zeroWalletAddress: this.zeroWallet.address,
            data,
            webHookAttributes,
            gasTankName: this.gasTankName
        });
        const { safeTXBody, scwAddress } = response.data;
        const safeTXBodyWithNonce: BuildExecTransactionType = { ...safeTXBody, nonce: parseInt(safeTXBody.nonce.hex, 16) };

        return { safeTXBody: safeTXBodyWithNonce, scwAddress };
    }

    async authorize(): Promise<boolean> {
        const response = await axios.post(
            this.zeroWalletServerEndpoints.authorizer,
            {
                zeroWalletAddress: this.zeroWallet.address,
                gasTankName: this.gasTankName
            }
        );

        return !!response.data?.authorize;
    }

    setGasTankName(gasTankName: string): void {
        this.gasTankName = gasTankName;
    }

    async deployScw(): Promise<void> {
        const nonce = await this.getNonce();
        const signedNonce = await this.signNonce(nonce);

        const webHookAttributes: DeployWebHookAttributesType = {
            signedNonce: signedNonce,
            nonce: nonce
        };

        await axios.post<string>(this.zeroWalletServerEndpoints.scwDeployer, {
            zeroWalletAddress: this.zeroWallet.address,
            gasTankName: this.gasTankName,
            webHookAttributes
        });
    }

    async refreshNonce(): Promise<void> {
        const response = await axios.post(
            this.zeroWalletServerEndpoints.nonceRefresher,
            {
                zeroWalletAddress: this.zeroWallet.address,
                gasTankName: this.gasTankName
            }
        );

        if (!response.data?.nonce) {
            throw new Error('nonce is not refreshed');
        }

        this.store.set('nonce', response.data.nonce);

        return response.data.nonce;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async unlock(password: string): Promise<boolean> {
        throw new Error(`Not supported yet! ${password}`);
    }
}
