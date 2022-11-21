/**
 * @jest-environment jsdom
 */

import { describe, test } from '@jest/globals';
import axios from 'axios';
import { ethers } from 'ethers';
import { SupportedChainId } from '../constants/chains';
import { ZeroWalletProvider } from '../provider';
import { ZeroWalletSigner } from '../signer';
import { StorageFactory } from '../store/storageFactory';
import { BuildExecTransactionType, ZeroWalletServerEndpoints } from '../types';
import { configEnv } from '../utils/env';

configEnv();

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const zeroWalletServerEndpoints: ZeroWalletServerEndpoints = {
    nonceProvider: 'nonceProviderUrl', // data: { nonce: string }
    gasStation: 'gasStationUrl', // data: { txHash: string }
    transactionBuilder: 'transactionBuilderUrl', // data: { safeTxBody: BuildExecTransactionType; scwAddress: string; }
    authorizer: 'authorizerUrl', // data: { authorizer: any }
    scwDeployer: 'scwDeployerUrl', // data: { } - no data returned
    nonceRefresher: 'nonceRefresherUrl' // data: { nonce: string }
};

afterAll(() => jest.resetAllMocks());

describe('Test ZeroWalletProvider methods', () => {
    const network: ethers.providers.Network = {
        chainId: 5,
        name: 'Goerli'
    };
    const storage = StorageFactory.create('browser');
    const jsonRpcProviderUrl = 'https://eth-goerli.g.alchemy.com/v2/0x123';
    const gasTankName = 'gasTankName';
    const provider = new ZeroWalletProvider(
        jsonRpcProviderUrl,
        network,
        storage,
        zeroWalletServerEndpoints,
        gasTankName
    );

    beforeAll(() => {
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.nonceProvider) {
                return Promise.resolve({
                    data: {
                        nonce: '1'
                    }
                });
            }

            if (url === zeroWalletServerEndpoints.gasStation) {
                return Promise.resolve({
                    data: {
                        txHash: '0x123'
                    }
                });
            }

            if (url === zeroWalletServerEndpoints.transactionBuilder) {
                return Promise.resolve({
                    data: {
                        safeTxBody: {
                            to: '0x123',
                            value: 0,
                            data: '0x123',
                            operation: 0,
                            targetTxGas: 0,
                            baseGas: 0,
                            gasPrice: 0,
                            gasToken: '0x123',
                            refundReceiver: '0x123',
                            nonce: 1
                        } as BuildExecTransactionType,
                        scwAddress: '0x123'
                    }
                });
            }

            if (url === zeroWalletServerEndpoints.authorizer) {
                return Promise.resolve({
                    data: {
                        authorizer: '0x123'
                    }
                });
            }

            return Promise.reject(new Error('Not found'));
        });
    });

    test('provider exists', () => {
        expect(provider).toBeTruthy();
    });

    test('network is goerli', async () => {
        const network = await provider.getNetwork();
        expect(network.chainId).toBe(5);
        expect(network.name).toBe('Goerli');
    });

    test('switch network to Polygon', async () => {
        const chain: SupportedChainId = SupportedChainId.POLYGON_MAINNET;
        const newChain = await provider.switchNetwork(chain);
        const newNetwork = await provider.getNetwork();

        expect(newChain.id).toBe(SupportedChainId.POLYGON_MAINNET);
        expect(newChain.name).toBe('Polygon');
        expect(newChain.network).toBe('Polygon');
        expect(newNetwork.chainId).toBe(SupportedChainId.POLYGON_MAINNET);
        expect(newNetwork.name).toBe('Polygon');
    });

    test('Get new Signer', () => {
        const signer = provider.getSigner();
        expect(signer).toBeTruthy();
        expect(signer).toBeInstanceOf(ZeroWalletSigner);
    });
});
