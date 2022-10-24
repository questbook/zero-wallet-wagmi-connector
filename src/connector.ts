import { Signer } from 'ethers'
import { ZeroWalletConnectorOptions, ZeroWalletSigner } from './types'
import { ZeroWalletProvider } from './provider'
import { Chain, Connector, ConnectorData } from 'wagmi'

export class ZeroWalletConnector extends Connector<ZeroWalletProvider, ZeroWalletConnectorOptions, ZeroWalletSigner> {
	readonly id = 'zero-wallet'
	readonly name = 'Zero Wallet'

	private provider: ZeroWalletProvider

	constructor(config: { chains?: Chain[]; options: ZeroWalletConnectorOptions }) {
		super(config)
		this.provider = new ZeroWalletProvider(config.options.jsonRpcProviderUrl)
	}

	get ready() {
		return true
	}

	async connect(): Promise<Required<ConnectorData>> {
		throw new Error('not implemented')
	}

	async disconnect(): Promise<void> {
		throw new Error('not implemented')
	}

	async getAccount(): Promise<string> {
		throw new Error('not implemented')
	}

	async getChainId(): Promise<number> {
		throw new Error('not implemented')
	}

	async getProvider(): Promise<ZeroWalletProvider> {
		return this.provider
	}

	async getSigner(): Promise<ZeroWalletSigner> {
		throw new Error('not implemented')
	}

	async isAuthorized(): Promise<boolean> {
		throw new Error('not implemented')
	}

	async switchChain(chainId: number): Promise<Chain> {
		throw new Error('not implemented')
	}

	protected onAccountsChanged(accounts: string[]) {
		throw new Error('not implemented')
	}

	protected onChainChanged(chain: number | string) {
		throw new Error('not implemented')
	}

	protected onDisconnect(error: Error) {
		throw new Error('not implemented')
	}
}