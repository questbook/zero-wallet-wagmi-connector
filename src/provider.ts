/* eslint-disable @typescript-eslint/no-unused-vars */
import { ethers } from 'ethers';
import { deepCopy, fetchJson } from 'ethers/lib/utils';
import { Chain } from 'wagmi';
import { chainsNames, SupportedChainId } from './constants/chains';
import { IStoreable } from './store/IStoreable';
import { ZeroWalletSigner } from './signer';
import { RecoveryConfig } from './types';

export const _constructorGuard = {};

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
    zeroWalletServerDomain: string;
    gasTankName: string;
    recovery: RecoveryConfig | undefined;

    constructor(
        jsonRpcProviderUrl: string,
        network: ethers.providers.Network,
        store: IStoreable,
        zeroWalletServerDomain: string,
        gasTankName: string,
        recoveryConfig?: RecoveryConfig
    ) {
        super(jsonRpcProviderUrl, network);
        this.zeroWalletServerDomain = zeroWalletServerDomain;
        this.store = store;
        this.zeroWalletNetwork = network;
        this.gasTankName = gasTankName;
        this.recovery = recoveryConfig;
    }

    getSigner(
        // @ts-ignore
        addressOrIndex?: string | number,
        isInitRecovery?: boolean
    ): ZeroWalletSigner {
        return new ZeroWalletSigner(
            _constructorGuard,
            this,
            this.store,
            this.zeroWalletServerDomain,
            this.gasTankName,
            undefined,
            isInitRecovery !== false ? this.recovery : undefined
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
