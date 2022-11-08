import { chainsNames } from "constants/chains";
import { ethers } from "ethers";
import { deepCopy, fetchJson } from "ethers/lib/utils";
import { GoogleRecoveryMechanismOptions, GoogleRecoveryWeb, RecoveryMechanism } from "recovery";
import { ZeroWalletSigner } from "signer";
import { IStoreable } from "store/IStoreable";
import { StorageFactory } from "store/storageFactory";
import { Chain } from "wagmi";

const _constructorGuard = {};
const GOOGLE_CLEINT_ID = process.env.GOOGLE_CLIENT_ID!;
const ZERO_WALLET_FOLDER_NAME = ".zero-wallet";
const ZERO_WALLET_FILE_NAME = "key";

function getResult(payload: { error?: { code?: number, data?: any, message?: string }, result?: any }): any {
    if (payload.error) {
        // @TODO: not any
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

    constructor(jsonRpcProviderUrl: string, network: ethers.providers.Network, store: IStoreable, recoveryMechanism: RecoveryMechanism) {
        super(jsonRpcProviderUrl);
        this.store = store;
        this.zeroWalletNetwork = network;
    }

    getSigner(addressOrIndex?: string | number): ZeroWalletSigner {
        const googleRecoveryMechanismOptions: GoogleRecoveryMechanismOptions = {
            googleClientId: GOOGLE_CLEINT_ID,
            folderNameGD: ZERO_WALLET_FOLDER_NAME,
            fileNameGD: ZERO_WALLET_FILE_NAME,
            allowMultiKeys: true,
            handleExistingKey: "Overwrite",
        };

        const googleRecoveryWeb = new GoogleRecoveryWeb(googleRecoveryMechanismOptions)
        return new ZeroWalletSigner(
            _constructorGuard,
            this,
            this.store,
            addressOrIndex,
            googleRecoveryWeb
        );
    }

    async getNetwork(): Promise<ethers.providers.Network> {
        return this.zeroWalletNetwork;
    }

    async send(method: string, params: Array<any>): Promise<any> {
        if(method == 'eth_sendTransaction'){
            // @TODO add code for calling zero-wallet-server-sdk
            // should return the transaction hash
        }
        const request = {
            method: method,
            params: params,
            id: (this._nextId++),
            jsonrpc: "2.0"
        };

        this.emit("debug", {
            action: "request",
            request: deepCopy(request),
            provider: this
        });

        // We can expand this in the future to any call, but for now these
        // are the biggest wins and do not require any serializing parameters.
        const cache = ([ "eth_chainId", "eth_blockNumber" ].indexOf(method) >= 0);
        if (cache && await this._cache[method]) {
            return this._cache[method];
        }

        const result = fetchJson(this.connection, JSON.stringify(request), getResult).then((result) => {
            this.emit("debug", {
                action: "response",
                request: request,
                response: result,
                provider: this
            });

            return result;

        }, (error) => {
            this.emit("debug", {
                action: "response",
                error: error,
                request: request,
                provider: this
            });

            throw error;
        });

        // Cache the fetch, but clear it on the next event loop
        if (cache) {
            this._cache[method] = result;
            setTimeout(() => {
                this._cache[method] = Promise.resolve(null);
            }, 0);
        }

        return result;
    }

    async switchNetwork(chainId: number): Promise<Chain> {
        const network = await this.getNetwork();
        
        this.zeroWalletNetwork.chainId = chainId;

        this.zeroWalletNetwork.name = chainsNames[chainId];

        return {
            id: this.zeroWalletNetwork.chainId,
            name: this.zeroWalletNetwork.name,
            network: this.zeroWalletNetwork.name
        } as Chain
    }

    detectNetwork(): Promise<ethers.providers.Network> {
        return this.getNetwork();
    }

    _uncachedDetectNetwork(): Promise<ethers.providers.Network> {
        return this.getNetwork();
    }
}
