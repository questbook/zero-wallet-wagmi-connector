import { ethers } from "ethers"
import { RecoveryMechanism } from "recovery"
import { IStoreable } from "store/IStoreable"

export type ZeroWalletConnectorOptions = {
	/** hex encoded ETH private key or raw binary */
    jsonRpcProviderUrl: string,
    store: string,
    recoveryMechanism: RecoveryMechanism,
}

export type NameToClassValue<T extends IStoreable> = { [key: string]: T }

