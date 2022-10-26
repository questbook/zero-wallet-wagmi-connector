import { ethers, Signer } from 'ethers'
import { ZeroWalletConnectorOptions } from './types'
import { ZeroWalletProvider } from './provider'
import { ZeroWalletSigner } from './signer'
import { Chain, Connector, ConnectorData } from 'wagmi'
import { StorageFactory } from 'store/storageFactory'

export class ZeroWalletConnector extends Connector<ZeroWalletProvider, ZeroWalletConnectorOptions, ZeroWalletSigner> {
    readonly id = 'zero-wallet'
    readonly name = 'Zero Wallet'

    private provider: ZeroWalletProvider
    private store: StorageFactory

    constructor(config: { chains?: Chain[]; options: ZeroWalletConnectorOptions }) {
        super(config)
        this.provider = new ZeroWalletProvider(config.options.jsonRpcProviderUrl)
        this.store = new StorageFactory(config.options.store);
    }

    get ready() {
        return true
    }

    async connect(): Promise<Required<ConnectorData>> {

        if((await this.store.get('ZeroWalletConnected')) === 'true') {
            throw new Error("Already connected!");
        }

        const provider = await this.getProvider()
        if (!provider) throw new Error("Provider not found");

        if (provider.on) {
            provider.on('accountsChanged', this.onAccountsChanged)
            provider.on('chainChanged', this.onChainChanged)
            provider.on('disconnect', this.onDisconnect)
        }

        const privateKey = await this.store.get('zeroWalletPrivateKey');

        let newZeroWallet = ethers.Wallet.createRandom();

        if (!privateKey) {
            await this.store.set('zeroWalletPrivateKey', newZeroWallet.privateKey);
        }
        else {
            try {
                newZeroWallet = new ethers.Wallet(privateKey);
            }
            catch {
                await this.store.set('zeroWalletPrivateKey', newZeroWallet.privateKey);
            }
        }

        await this.store.set('ZeroWalletConnected', 'true');

        const chainId = await this.getChainId();

        return {
            account: newZeroWallet.address,
            chain: {
                id: chainId,
                unsupported: false
            },
            provider: this.provider,
        }
    }

    async disconnect(): Promise<void> {

        if((await this.store.get('ZeroWalletConnected')) === 'false') {
            throw new Error("Already disconnected!");
        }

        const provider = await this.getProvider()
        if (!provider?.removeListener) return

        provider.removeListener('accountsChanged', this.onAccountsChanged)
        provider.removeListener('chainChanged', this.onChainChanged)
        provider.removeListener('disconnect', this.onDisconnect)

        await this.store.set('ZeroWalletConnected', 'false');
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
        return this.provider.getSigner();
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