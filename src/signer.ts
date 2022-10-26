import { defineReadOnly } from "@ethersproject/properties";
import { ethers } from "ethers";
import { ZeroWalletProvider } from "./provider";
import { Logger } from "@ethersproject/logger";
import { StorageFactory } from "store/storageFactory";

const version = "providers/5.7.2";
const logger = new Logger(version);
const _constructorGuard = {};

export class ZeroWalletSigner extends ethers.providers.JsonRpcSigner {

    store: StorageFactory;
    zeroWallet?: ethers.Wallet;

    constructor(constructorGuard: any, provider: ZeroWalletProvider, addressOrIndex?: string | number) {
        
        super(constructorGuard, provider, addressOrIndex);
        
        this.store = provider.store;

        const zeroWalletPrivateKey = this.store.get('zeroWalletPrivateKey');

        if(!zeroWalletPrivateKey) {
            logger.makeError("ZeroWalletPrivateKey not found in storage", Logger.errors.UNSUPPORTED_OPERATION)
        }
        else {
            this.zeroWallet = new ethers.Wallet(zeroWalletPrivateKey);
        }

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
}