import { TransactionRequest } from "@ethersproject/abstract-provider";
import { ethers } from "ethers";
import { ZeroWalletProvider } from "./provider";
import { Logger } from "@ethersproject/logger";
import { IStoreable } from "store/IStoreable";
import { RecoveryMechanism } from 'recovery'
import { Deferrable } from "ethers/lib/utils";

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

        if(!zeroWalletPrivateKey) {
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
        if(!this.zeroWallet){
            logger.throwError("Zero Wallet is not initialized yet", Logger.errors.UNSUPPORTED_OPERATION)
            return Promise.resolve("");
        }
        else{
            return Promise.resolve(this.zeroWallet.address);
        }
    }

    getNetwork() {
        return this.provider.getNetwork();
    }

   async signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
        if(!this.zeroWallet){
            logger.throwError("Zero Wallet is not initialized yet", Logger.errors.UNSUPPORTED_OPERATION)
            throw new Error("Zero Wallet is not initialized yet");
        }

        //@TODO - fetch SCW Address
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

}