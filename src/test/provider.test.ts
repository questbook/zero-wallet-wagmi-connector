import { describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';
import { ZeroWalletProvider } from '../provider';
import { StorageFactory } from '../store/storageFactory';
import { configEnv } from '../utils/env';
/**
 * @jest-environment jsdom
 */

configEnv();

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

    test('Correctly instantiate ZeroWalletProvider', () => {
        const store = StorageFactory.create('browser');
        const provider = new ZeroWalletProvider(
            `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            { name: 'goerli', chainId: 5 },
            store
        );

        expect(provider).toBeTruthy();
        expect(provider).toBeInstanceOf(ZeroWalletProvider);
    });

    test('Correctly instantiate a contract instance with ZeroWalletSigner', () => {
        const store = StorageFactory.create('browser');
        const provider = new ZeroWalletProvider(
            `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            { name: 'goerli', chainId: 5 },
            store
        );

        const signer = provider.getSigner();
        const contract = new ethers.Contract(
            mockContractAddress,
            mockAbi,
            signer
        );
    });
});
