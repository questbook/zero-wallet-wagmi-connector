import { ethers } from "ethers";
import { ZeroWalletSigner } from "signer";
import { StorageFactory } from "store/storageFactory";

const _constructorGuard = {};

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
    store: StorageFactory;
    constructor(jsonRpcProviderUrl: string, store: StorageFactory) {
        super(jsonRpcProviderUrl);
        this.store = store;
    }


    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        return new ZeroWalletSigner(_constructorGuard, this, addressOrIndex);
    }
}

