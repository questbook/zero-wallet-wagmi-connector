import { TransactionRequest, TransactionResponse } from "@ethersproject/abstract-provider";
import { ethers } from "ethers";
import { ZeroWalletProvider } from "./provider";
import { Logger } from "@ethersproject/logger";
import { IStoreable } from "store/IStoreable";
import { RecoveryMechanism } from 'recovery'
import { Deferrable, isHexString, resolveProperties, shallowCopy } from "ethers/lib/utils";
import { poll } from "@ethersproject/web";

const version = "providers/5.7.2";
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
        { type: 'uint256', name: 'nonce' },
    ],
}

const errorGas = ["call", "estimateGas"];

function spelunk(value: any, requireData: boolean): null | { message: string, data: null | string } {
    if (value == null) { return null; }

    // These *are* the droids we're looking for.
    if (typeof (value.message) === "string" && value.message.match("reverted")) {
        const data = isHexString(value.data) ? value.data : null;
        if (!requireData || data) {
            return { message: value.message, data };
        }
    }

    // Spelunk further...
    if (typeof (value) === "object") {
        for (const key in value) {
            const result = spelunk(value[key], requireData);
            if (result) { return result; }
        }
        return null;
    }

    // Might be a JSON string we can further descend...
    if (typeof (value) === "string") {
        try {
            return spelunk(JSON.parse(value), requireData);
        } catch (error) { }
    }

    return null;
}

function checkError(method: string, error: any, params: any): any {

    const transaction = params.transaction || params.signedTransaction;

    // Undo the "convenience" some nodes are attempting to prevent backwards
    // incompatibility; maybe for v6 consider forwarding reverts as errors
    if (method === "call") {
        const result = spelunk(error, true);
        if (result) { return result.data; }

        // Nothing descriptive..
        logger.throwError("missing revert data in call exception; Transaction reverted without a reason string", Logger.errors.CALL_EXCEPTION, {
            data: "0x", transaction, error
        });
    }

    if (method === "estimateGas") {
        // Try to find something, with a preference on SERVER_ERROR body
        let result = spelunk(error.body, false);
        if (result == null) { result = spelunk(error, false); }

        // Found "reverted", this is a CALL_EXCEPTION
        if (result) {
            logger.throwError("cannot estimate gas; transaction may fail or may require manual gas limit", Logger.errors.UNPREDICTABLE_GAS_LIMIT, {
                reason: result.message, method, transaction, error
            });
        }
    }

    // @TODO: Should we spelunk for message too?

    let message = error.message;
    if (error.code === Logger.errors.SERVER_ERROR && error.error && typeof (error.error.message) === "string") {
        message = error.error.message;
    } else if (typeof (error.body) === "string") {
        message = error.body;
    } else if (typeof (error.responseText) === "string") {
        message = error.responseText;
    }
    message = (message || "").toLowerCase();

    // "insufficient funds for gas * price + value + cost(data)"
    if (message.match(/insufficient funds|base fee exceeds gas limit|InsufficientFunds/i)) {
        logger.throwError("insufficient funds for intrinsic transaction cost", Logger.errors.INSUFFICIENT_FUNDS, {
            error, method, transaction
        });
    }

    // "nonce too low"
    if (message.match(/nonce (is )?too low/i)) {
        logger.throwError("nonce has already been used", Logger.errors.NONCE_EXPIRED, {
            error, method, transaction
        });
    }

    // "replacement transaction underpriced"
    if (message.match(/replacement transaction underpriced|transaction gas price.*too low/i)) {
        logger.throwError("replacement fee too low", Logger.errors.REPLACEMENT_UNDERPRICED, {
            error, method, transaction
        });
    }

    // "replacement transaction underpriced"
    if (message.match(/only replay-protected/i)) {
        logger.throwError("legacy pre-eip-155 transactions not supported", Logger.errors.UNSUPPORTED_OPERATION, {
            error, method, transaction
        });
    }

    if (errorGas.indexOf(method) >= 0 && message.match(/gas required exceeds allowance|always failing transaction|execution reverted|revert/)) {
        logger.throwError("cannot estimate gas; transaction may fail or may require manual gas limit", Logger.errors.UNPREDICTABLE_GAS_LIMIT, {
            error, method, transaction
        });
    }

    throw error;
}

export class ZeroWalletSigner extends ethers.providers.JsonRpcSigner {

    private store: IStoreable;
    zeroWallet?: ethers.Wallet;
    provider: ZeroWalletProvider;
    recoveryMechansim: RecoveryMechanism | undefined

    constructor(constructorGuard: any, provider: ZeroWalletProvider, store: IStoreable, addressOrIndex?: string | number, recoveryMechansim?: RecoveryMechanism) {

        super(constructorGuard, provider, addressOrIndex);

        this.store = store;
        this.provider = provider;

        const zeroWalletPrivateKey = this.store.get('zeroWalletPrivateKey');

        if (!zeroWalletPrivateKey) {
            logger.makeError("ZeroWalletPrivateKey not found in storage", Logger.errors.UNSUPPORTED_OPERATION)
        }
        else {
            this.zeroWallet = new ethers.Wallet(zeroWalletPrivateKey);
        }

        this.recoveryMechansim = recoveryMechansim
    }

    getProvider() {
        return this.provider;
    }

    getAddress(): Promise<string> {
        if (!this.zeroWallet) {
            logger.throwError("Zero Wallet is not initialized yet", Logger.errors.UNSUPPORTED_OPERATION)
            return Promise.resolve("");
        }
        else {
            return Promise.resolve(this.zeroWallet.address);
        }
    }

    getNetwork() {
        return this.provider.getNetwork();
    }

    async signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
        if (!this.zeroWallet) {
            logger.throwError("Zero Wallet is not initialized yet", Logger.errors.UNSUPPORTED_OPERATION)
            throw new Error("Zero Wallet is not initialized yet");
        }

        //@TODO - fetch SCW Address from the zero-wallet-server-sdk
        const scwAddress = "0x0000000000000000000000000000000000000000";
        //@TODO - call build transaction from the zero-wallet-server-sdk
        const safeTxBody = {};

        const chainId = (await this.provider.getNetwork()).chainId;

        const signature = await this.zeroWallet._signTypedData({
            verifyingContract: scwAddress,
            chainId: ethers.BigNumber.from(chainId),
        }, EIP712_WALLET_TX_TYPE, safeTxBody);

        let newSignature = '0x'
        newSignature += signature.slice(2);

        return newSignature;
    }

    async sendUncheckedTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
        transaction = shallowCopy(transaction);

        const fromAddress = this.getAddress().then((address) => {
            if (address) { address = address.toLowerCase(); }
            return address;
        });

        // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
        // wishes to use this, it is easy to specify explicitly, otherwise
        // we look it up for them.
        if (transaction.gasLimit == null) {
            const estimate = shallowCopy(transaction);
            estimate.from = fromAddress;
            transaction.gasLimit = this.provider.estimateGas(estimate);
        }

        if (transaction.to != null) {
            transaction.to = Promise.resolve(transaction.to).then(async (to) => {
                if (to == null) { return undefined; }
                const address = await this.provider.resolveName(to);
                if (address == null) {
                    logger.throwArgumentError("provided ENS name resolves to null", "tx.to", to);
                }
                return address ?? undefined;
            });
        }

        return resolveProperties({
            tx: resolveProperties(transaction),
            sender: fromAddress
        }).then(({ tx, sender }) => {

            if (tx.from != null) {
                if (tx.from.toLowerCase() !== sender) {
                    logger.throwArgumentError("from address mismatch", "transaction", transaction);
                }
            } else {
                tx.from = sender;
            }

            const hexTx = (<any>this.provider.constructor).hexlifyTransaction(tx, { from: true });

            return this.provider.send("eth_sendTransaction", [hexTx]).then((hash) => {
                return hash;
            }, (error) => {
                if (typeof (error.message) === "string" && error.message.match(/user denied/i)) {
                    logger.throwError("user rejected transaction", Logger.errors.ACTION_REJECTED, {
                        action: "sendTransaction",
                        transaction: tx
                    });
                }

                return checkError("sendTransaction", error, hexTx);
            });
        });
    }

    async sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
        // This cannot be mined any earlier than any recent block
        const blockNumber = await this.provider._getInternalBlockNumber(100 + 2 * this.provider.pollingInterval);

        // Send the transaction
        const hash = await this.sendUncheckedTransaction(transaction);

        try {
            
                const tx = await this.provider.getTransaction(hash);
                // @TODO: check if there's an issue in the next line
                // if (tx === null) { return undefined; }
                return this.provider._wrapTransaction(tx, hash, blockNumber);
        } catch (error) {
            (<any>error).transactionHash = hash;
            throw error;
        }
    }

}