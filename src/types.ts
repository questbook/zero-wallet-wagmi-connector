import { ethers } from "ethers"

export type ZeroWalletConnectorOptions = {
	/** hex encoded ETH private key or raw binary */
    jsonRpcProviderUrl: string,
    store: string
}

