import { ethers } from 'ethers';
import { deepCopy, fetchJson } from 'ethers/lib/utils';
import { Chain } from 'wagmi';
import { chainsNames, SupportedChainId } from './constants/chains';
import { IStoreable } from './store/IStoreable';
import { GoogleRecoveryMechanismOptions, GoogleRecoveryWeb } from './recovery';
import { ZeroWalletSigner } from './signer';
import { ZeroWalletServerEndpoints } from './types';

export const _constructorGuard = {};
const GOOGLE_CLEINT_ID = process.env.GOOGLE_CLIENT_ID!;
const ZERO_WALLET_FOLDER_NAME = '.zero-wallet';
const ZERO_WALLET_FILE_NAME = 'key';

function getResult(payload: {
    error?: { code?: number; data?: any; message?: string };
    result?: any;
}): any {
    if (payload.error) {
        const error: any = new Error(payload.error.message);
        error.code = payload.error.code;
        error.data = payload.error.data;
        throw error;
    }

    return payload.result;
}

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
    private store: IStoreable;
    zeroWalletNetwork: ethers.providers.Network;
    zeroWalletServerEndpoints: ZeroWalletServerEndpoints;
    gasTankName: string;

    constructor(
        jsonRpcProviderUrl: string,
        network: ethers.providers.Network,
        store: IStoreable,
        zeroWalletServerEndpoints: ZeroWalletServerEndpoints,
        gasTankName: string
    ) {
        super(jsonRpcProviderUrl);
        this.zeroWalletServerEndpoints = zeroWalletServerEndpoints;
        this.store = store;
        this.zeroWalletNetwork = network;
        this.gasTankName = gasTankName;
    }

    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        const googleRecoveryMechanismOptions: GoogleRecoveryMechanismOptions = {
            googleClientId: GOOGLE_CLEINT_ID,
            folderNameGD: ZERO_WALLET_FOLDER_NAME,
            fileNameGD: ZERO_WALLET_FILE_NAME,
            allowMultiKeys: true,
            handleExistingKey: 'Overwrite'
        };

        const googleRecoveryWeb = new GoogleRecoveryWeb(
            googleRecoveryMechanismOptions
        );
        return new ZeroWalletSigner(
            _constructorGuard,
            this,
            this.store,
            this.zeroWalletServerEndpoints,
            this.gasTankName,
            addressOrIndex,
            googleRecoveryWeb
        );
    }

    async getNetwork(): Promise<ethers.providers.Network> {
        return this.zeroWalletNetwork;
    }

    async send(method: string, params: Array<any>): Promise<any> {
        const request = {
            method: method,
            params: params,
            id: this._nextId++,
            jsonrpc: '2.0'
        };

        this.emit('debug', {
            action: 'request',
            request: deepCopy(request),
            provider: this
        });

        // We can expand this in the future to any call, but for now these
        // are the biggest wins and do not require any serializing parameters.
        const cache = ['eth_chainId', 'eth_blockNumber'].indexOf(method) >= 0;
        if (cache && (await this._cache[method])) {
            return this._cache[method];
        }

        const result = fetchJson(
            this.connection,
            JSON.stringify(request),
            getResult
        ).then(
            (result) => {
                this.emit('debug', {
                    action: 'response',
                    request: request,
                    response: result,
                    provider: this
                });

                return result;
            },
            (error) => {
                this.emit('debug', {
                    action: 'response',
                    error: error,
                    request: request,
                    provider: this
                });

                throw error;
            }
        );

        // Cache the fetch, but clear it on the next event loop
        if (cache) {
            this._cache[method] = result;
            setTimeout(() => {
                this._cache[method] = Promise.resolve(null);
            }, 0);
        }

        return result;
    }

    async switchNetwork(chainId: SupportedChainId): Promise<Chain> {
        this.zeroWalletNetwork.chainId = chainId;

        this.zeroWalletNetwork.name = chainsNames[chainId];

        return {
            id: this.zeroWalletNetwork.chainId,
            name: this.zeroWalletNetwork.name,
            network: this.zeroWalletNetwork.name
        } as Chain;
    }

    detectNetwork(): Promise<ethers.providers.Network> {
        return this.getNetwork();
    }

    _uncachedDetectNetwork(): Promise<ethers.providers.Network> {
        return this.getNetwork();
    }
}
