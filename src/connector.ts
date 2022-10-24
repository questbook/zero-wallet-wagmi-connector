import { ethers, Signer } from 'ethers'
import { ZeroWalletConnectorOptions } from './types'
import { ZeroWalletProvider, ZeroWalletSigner } from './provider'
import { Chain, Connector, ConnectorData } from 'wagmi'

export class ZeroWalletConnector extends Connector<ZeroWalletProvider, ZeroWalletConnectorOptions, ZeroWalletSigner> {
    readonly id = 'zero-wallet'
    readonly name = 'Zero Wallet'

    private signer: ZeroWalletSigner

    constructor(config: { chains?: Chain[]; options: ZeroWalletConnectorOptions }) {
        super(config)
        this.signer = new ZeroWalletSigner(config.options.jsonRpcProviderUrl)
    }

    get ready() {
        return true
    }

    async connect(): Promise<Required<ConnectorData>> {

        if(localStorage.getItem('ZeroWalletConnected') === 'true') {
            throw new Error("Already connected!");
        }

        const provider = await this.getProvider()
        if (!provider) throw new Error("Provider not found");

        if (provider.on) {
            provider.on('accountsChanged', this.onAccountsChanged)
            provider.on('chainChanged', this.onChainChanged)
            provider.on('disconnect', this.onDisconnect)
        }

        const privateKey = localStorage.getItem('zeroWalletPrivateKey');

        let newZeroWallet = ethers.Wallet.createRandom();

        if (!privateKey) {
            localStorage.setItem('zeroWalletPrivateKey', newZeroWallet.privateKey);
        }
        else {
            try {
                newZeroWallet = new ethers.Wallet(privateKey);
            }
            catch {
                localStorage.setItem('zeroWalletPrivateKey', newZeroWallet.privateKey);
            }
        }

        localStorage.setItem('ZeroWalletConnected', 'true');

        const chainId = await this.getChainId();

        return {
            account: newZeroWallet.address,
            chain: {
                id: chainId,
                unsupported: false
            },
            provider: this.signer.getProvider(),
        }
    }

    async disconnect(): Promise<void> {

        if(localStorage.getItem('ZeroWalletConnected') === 'false') {
            throw new Error("Already disconnected!");
        }

        const provider = await this.getProvider()
        if (!provider?.removeListener) return

        provider.removeListener('accountsChanged', this.onAccountsChanged)
        provider.removeListener('chainChanged', this.onChainChanged)
        provider.removeListener('disconnect', this.onDisconnect)

        localStorage.setItem('ZeroWalletConnected', 'false');
    }

    async getAccount(): Promise<string> {
        throw new Error('not implemented')
    }

    async getChainId(): Promise<number> {
        throw new Error('not implemented')
    }

    async getProvider(): Promise<ZeroWalletProvider> {
        return this.signer.getProvider()
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