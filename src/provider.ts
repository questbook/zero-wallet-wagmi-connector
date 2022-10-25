import { ethers } from "ethers";
import { ZeroWalletSigner } from "signer";

const _constructorGuard = {};

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
    constructor(jsonRpcProviderUrl: string) {
        super(jsonRpcProviderUrl);
    }

    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        return new ZeroWalletSigner(_constructorGuard, this, addressOrIndex);
    }
}

