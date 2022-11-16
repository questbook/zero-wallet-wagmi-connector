import { describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';
import { ZeroWalletProvider } from '../provider';
import { StorageFactory } from '../store/storageFactory';
import { configEnv } from '../utils/env';
/**
 * @jest-environment jsdom
 */

configEnv();

jest.mock('axios');

describe('Creation', () => {
    test('should create a ZeroWalletProvider', () => {
    })
});
