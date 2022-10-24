import { ethers } from "ethers";

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
    constructor(jsonRpcProviderUrl: string) {
        super(jsonRpcProviderUrl);
    }
}
