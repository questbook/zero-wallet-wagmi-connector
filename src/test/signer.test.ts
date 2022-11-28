/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from '@jest/globals';
import axios from 'axios';
import { BigNumber, ethers } from 'ethers';
import { ZeroWalletProvider } from '../provider';
import { StorageFactory } from '../store/storageFactory';
import { BigNumberAPI, BuildExecTransactionType, ZeroWalletServerEndpoints } from '../types';
import { configEnv } from '../utils/env';

configEnv();

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const zeroWalletServerDomain = 'zeroWalletServerDomain'

const zeroWalletServerEndpoints: ZeroWalletServerEndpoints = {
    nonceProvider: zeroWalletServerDomain + '/api/auth/getNonce', // data: { nonce: string }
    nonceRefresher: zeroWalletServerDomain + '/api/auth/refreshNonce', // data: { nonce: string }
    authorizer: zeroWalletServerDomain + '/api/auth/authorize', // data: { authorizer: any }
    gasStation: zeroWalletServerDomain + '/api/tx/send', // data: { txHash: string }
    transactionBuilder: zeroWalletServerDomain + '/api/tx/build', // data: { safeTXBody: BuildExecTransactionType; scwAddress: string; }
    scwDeployer: zeroWalletServerDomain + '/api/tx/deploy' // data: { } - no data returned
};

afterAll(() => jest.resetAllMocks());

describe('Test ZeroWalletSigner', () => {
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
        zeroWalletServerDomain,
        gasTankName
    );

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

    const safeTXBodyAPI: Omit<BuildExecTransactionType, 'nonce'> & { nonce: BigNumberAPI } = {
        to: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        value: 0,
        data: '0x12',
        operation: 0,
        targetTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        refundReceiver: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        nonce: { hex: BigNumber.from(1).toHexString(), type: 'BigNumber' }
    };

    const safeTXBody: BuildExecTransactionType = {
        to: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        value: 0,
        data: '0x12',
        operation: 0,
        targetTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        refundReceiver: '0x8A14b1e068773bAeB342299576cE4b94e79d5d18',
        nonce: 1
    };

    const signer = provider.getSigner();

    test('should have a valid nonce', async () => {
        const nonce = '1';
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.nonceProvider) {
                return Promise.resolve({
                    data: {
                        nonce: nonce
                    }
                });
            }

            return Promise.reject(new Error('Not found'));
        });

        const signerNonce = await signer.getNonce();
        expect(signerNonce).toBe(nonce);
    });

    test('should build a transaction', async () => {
        const scwAddress = '0x123';
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.transactionBuilder) {
                return Promise.resolve({
                    data: {
                        safeTXBody: safeTXBodyAPI,
                        scwAddress: scwAddress
                    }
                });
            }

            return Promise.reject(new Error('Not found'));
        });

        const contract = new ethers.Contract(
            mockContractAddress,
            mockAbi,
            signer
        );
        const tx = await contract.populateTransaction.set(13);
        const builtTx = await signer.buildTransaction(tx);
        expect(builtTx).toEqual({
            safeTXBody: safeTXBody,
            scwAddress: scwAddress
        });
    });

    test('should sign a transaction', async () => {
        const scwAddress = mockContractAddress;
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.transactionBuilder) {
                return Promise.resolve({
                    data: {
                        safeTXBody: safeTXBodyAPI,
                        scwAddress: scwAddress
                    }
                });
            }

            return Promise.reject(new Error('Not found'));
        });
        const contract = new ethers.Contract(
            mockContractAddress,
            mockAbi,
            signer
        );
        const tx = await contract.populateTransaction.set(13);
        const signedTx = await signer.signTransaction(tx);
        expect(signedTx).toBeDefined();
    });

    test('should send a transaction', async () => {
        const scwAddress = mockContractAddress;
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.transactionBuilder) {
                return Promise.resolve({
                    data: {
                        safeTXBody: safeTXBodyAPI,
                        scwAddress: scwAddress
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

            return Promise.reject(new Error('Not found'));
        });

        const contract = new ethers.Contract(
            mockContractAddress,
            mockAbi,
            signer
        );
        const tx = await contract.populateTransaction.set(123);
        const signedTx = await signer.sendTransaction(tx);
        expect(signedTx).toBeDefined();
    });

    test('should authorize an account successfully', async () => {
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.authorizer) {
                return Promise.resolve({
                    data: {
                        authorize: '0x123'
                    }
                });
            }

            return Promise.reject(new Error('Not found'));
        });

        const isAuthorized = await signer.authorize();
        expect(isAuthorized).toBe(true);
    });

    test('should try to authorize an account and fail', async () => {
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.authorizer) {
                return Promise.resolve({
                    data: {}
                });
            }

            return Promise.reject(new Error('Not found'));
        });

        const isAuthorized = await signer.authorize();
        expect(isAuthorized).toBe(false);
    });

    test('should deploy an SCW', async () => {
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.scwDeployer) {
                return Promise.resolve();
            }

            return Promise.reject(new Error('Not found'));
        });

        await signer.deployScw();
    });

    test('should try to deploy an SCW and fail', async () => {
        mockedAxios.post.mockImplementation((url: string) => {
            if (url === zeroWalletServerEndpoints.scwDeployer) {
                return Promise.reject("You can't deploy an SCW");
            }

            return Promise.reject(new Error('Not found'));
        });

        await expect(signer.deployScw()).rejects.toBe(
            "You can't deploy an SCW"
        );
    });
});
