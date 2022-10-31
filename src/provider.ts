import { ethers } from "ethers";
import { ZeroWalletSigner } from "signer";
import { IStoreable } from "store/IStoreable";
import { StorageFactory } from "store/storageFactory";

const _constructorGuard = {};

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {

    private store: IStoreable;
    zeroWalletNetwork: ethers.providers.Network;
    constructor(jsonRpcProviderUrl: string, network: ethers.providers.Network, store: IStoreable) {
        super(jsonRpcProviderUrl);
        this.store = store;
        this.zeroWalletNetwork = network;
    }

    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        return new ZeroWalletSigner(_constructorGuard, this, this.store, addressOrIndex);
    }

    async getNetwork(): Promise<ethers.providers.Network> {
        return this.zeroWalletNetwork;
    }
}

