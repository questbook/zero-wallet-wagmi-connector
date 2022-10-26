import { ethers } from "ethers";
import { ZeroWalletSigner } from "signer";
import { IStoreable } from "store/IStoreable";
import { StorageFactory } from "store/storageFactory";

const _constructorGuard = {};

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
    private store: IStoreable;
    constructor(jsonRpcProviderUrl: string, store: IStoreable) {
        super(jsonRpcProviderUrl);
        this.store = store;
    }

    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        return new ZeroWalletSigner(_constructorGuard, this, this.store, addressOrIndex);
    }
}

