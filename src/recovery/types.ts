import { ethers } from 'ethers'

interface RecoveryMechanism {
	recoveryReadyPromise: () => Promise<void>;
	isRecoveryReady: () => boolean;
    setupRecovery: (wallet: ethers.Wallet) => Promise<void>; 
    initiateRecovery: (keyId?: number) => Promise<ethers.Wallet>; 
}

export type { RecoveryMechanism }