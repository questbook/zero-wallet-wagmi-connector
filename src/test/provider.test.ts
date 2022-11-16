/**
 * @jest-environment jsdom
 */

import { describe, test } from '@jest/globals';
import axios from 'axios';
import { ethers } from 'ethers';
import { ZeroWalletServerEndpoints } from 'types';
import { BuildExecTransactionType } from 'types';
import { SupportedChainId } from '../constants/chains';
import { ZeroWalletProvider } from '../provider';
import { StorageFactory } from '../store/storageFactory';
import { configEnv } from '../utils/env';



configEnv();

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const zeroWalletServerEndpoints: ZeroWalletServerEndpoints = {
    nonceProvider: 'https://nonce-provider.zero-wallet.io', // data: { nonce: string }
    gasStation: 'https://gas-station.zero-wallet.io', // data: { txHash: string }
    transactionBuilder: 'https://transaction-builder.zero-wallet.io', // data: { safeTxBody: BuildExecTransactionType; scwAddress: string; }
    authorizer: 'https://authorizer.zero-wallet.io' // data: { authorizer: any }
};

afterAll(() => jest.resetAllMocks());

describe('Creation', () => {
    const mockAbi = [
        {
            inputs: [
                {
                    internalType: 'uint256',
                    name: 'x',
                    type: 'uint256'
                }
            ],
            name: 'set',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function'
        },
        {
            inputs: [],
            name: 'value',
            outputs: [
                {
                    internalType: 'uint256',
                    name: '',
                    type: 'uint256'
                }
            ],
            stateMutability: 'view',
            type: 'function'
        }
    ];
    const mockContractAddress = '0xA119f2120E82380DC89832B8F3740fDC47b0444f';
});

describe('Provider methods', () => {
    const network: ethers.providers.Network = {
        chainId: 5,
        name: 'Goerli'
    };
    const storage = StorageFactory.create('browser');
    const jsonRpcProviderUrl = process.env.ALCHEMY_API_KEY!;
    const provider = new ZeroWalletProvider(
        jsonRpcProviderUrl,
        network,
        storage,
        zeroWalletServerEndpoints
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
        const network = await provider.getNetwork()
        expect(network.chainId).toBe(5);
        expect(network.name).toBe('Goerli');
    });

    test('switch network to Polygon', async () => {
        const chain: SupportedChainId = SupportedChainId.POLYGON_MAINNET;
        const newChain = await provider.switchNetwork(chain)
        const newNetwork = await provider.getNetwork()

        expect(newChain.id).toBe(SupportedChainId.POLYGON_MAINNET);
        expect(newChain.name).toBe('Polygon');
        expect(newChain.network).toBe('Polygon');
        expect(newNetwork.chainId).toBe(SupportedChainId.POLYGON_MAINNET);
        expect(newNetwork.name).toBe('Polygon');
    });

    test('Get new Signer', () => {
        const signer = provider.getSigner();
        expect(signer).toBeTruthy();
    });

});
