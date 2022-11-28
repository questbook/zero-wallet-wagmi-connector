import { ethers } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { Chain, Connector, ConnectorData } from 'wagmi';
import { SupportedChainId } from './constants/chains';
import { IStoreable } from './store/IStoreable';
import { StorageFactory } from './store/storageFactory';
import { normalizeChainId } from './utils/normalizeChainId';
import { ZeroWalletProvider } from './provider';
import { ZeroWalletSigner } from './signer';
import { ZeroWalletConnectorOptions } from './types';

export class ZeroWalletConnector extends Connector<
    ZeroWalletProvider,
    ZeroWalletConnectorOptions,
    ZeroWalletSigner
> {
    readonly id = 'zero-wallet';
    readonly name = 'Zero Wallet';

    private provider: ZeroWalletProvider;
    private providers: { [key in SupportedChainId]?: ZeroWalletProvider } = {};
    private store: IStoreable;

    constructor(config: {
        chains?: Chain[];
        options: ZeroWalletConnectorOptions;
    }) {
        super(config);

        this.store = StorageFactory.create(config.options.store);

        config.chains?.forEach((chain) => {

            if(chain){
                const provider = this.provider = new ZeroWalletProvider(
                    this.options.jsonRpcProviderUrls[chain.id],
                    { chainId: chain.id, name: chain.name },
                    this.store,
                    this.options.zeroWalletServerDomain,
                    this.options.gasTankName,
                    config.options.recovery
                );

                this.providers[chain.id] = provider;
                
                if(!this.provider)
                    this.provider = this.providers[chain.id];
            }
        })
        
    }

    /**
     * @returns boolean - true if localStorge is available, false otherwise
     */
    get ready() {
        try {
            if (localStorage) {
                return true;
            }
        } catch {
            return false;
        } finally {
            return false;
        }
    }

    async connect(): Promise<Required<ConnectorData>> {
        // if (this.store.get('ZeroWalletConnected') === 'true') {
        //     throw new Error('Already connected!');
        // }

        const provider = await this.getProvider();
        if (!provider) throw new Error('Provider not found');

        if (provider.on) {
            provider.on('accountsChanged', this.onAccountsChanged);
            provider.on('chainChanged', this.onChainChanged);
            provider.on('disconnect', this.onDisconnect);
        }

        this.emit('message', { type: 'connecting' });

        const privateKey = this.store.get('zeroWalletPrivateKey');

        let newZeroWallet = ethers.Wallet.createRandom();

        if (!privateKey) {
            this.store.set('zeroWalletPrivateKey', newZeroWallet.privateKey);
        } else {
            try {
                newZeroWallet = new ethers.Wallet(privateKey);
            } catch {
                this.store.set(
                    'zeroWalletPrivateKey',
                    newZeroWallet.privateKey
                );
            }
        }

        this.store.set('ZeroWalletConnected', 'true');

        const chainId = await this.getChainId();

        return {
            account: newZeroWallet.address,
            chain: {
                id: chainId,
                unsupported: false
            },
            provider: this.provider
        };
    }

    async disconnect(): Promise<void> {
        // if (this.store.get('ZeroWalletConnected') === 'false') {
        //     throw new Error('Already disconnected!');
        // }

        const provider = await this.getProvider();
        if (!provider?.removeListener) return;

        provider.removeListener('accountsChanged', this.onAccountsChanged);
        provider.removeListener('chainChanged', this.onChainChanged);
        provider.removeListener('disconnect', this.onDisconnect);

        this.store.set('ZeroWalletConnected', 'false');
    }

    async getAccount(): Promise<string> {
        const signer = await this.getSigner();
        return await signer.getAddress();
    }

    async getChainId(): Promise<number> {
        return (await this.getProvider())
            .getNetwork()
            .then((network) => network.chainId);
    }

    async getProvider(): Promise<ZeroWalletProvider> {
        return this.provider;
    }

    async getSigner(): Promise<ZeroWalletSigner> {
        return this.provider.getSigner('browser');
    }

    async isAuthorized(): Promise<boolean> {
        return (
            this.store.get('ZeroWalletConnected') === 'true' &&
            this.store.get('zeroWalletPrivateKey') !== undefined
        );
    }

    async switchChain(chainId: SupportedChainId): Promise<Chain> {
        if(!(chainId in this.providers) || this.providers[chainId] === undefined){
            throw new Error("No provider found for chainId: " + chainId);
        }

        this.provider = this.providers[chainId]!;
        return this.provider.switchNetwork(chainId) ;
    }

    protected onAccountsChanged(accounts: string[]) {
        if (accounts.length === 0) this.emit('disconnect');
        else
            this.emit('change', {
                account: getAddress(accounts[0] as string)
            });
    }

    protected onChainChanged(chainId: number | string) {
        const id = normalizeChainId(chainId);
        const unsupported = this.isChainUnsupported(id);
        this.emit('change', { chain: { id, unsupported } });
    }

    protected onDisconnect() {
        this.emit('disconnect');
    }
}
