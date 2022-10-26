import { ethers } from "ethers"
import { IStoreable } from "store/IStoreable"

export type ZeroWalletConnectorOptions = {
	/** hex encoded ETH private key or raw binary */
    jsonRpcProviderUrl: string,
    store: string
}

export type NameToClassValue<T extends IStoreable> = { [key: string]: T }

