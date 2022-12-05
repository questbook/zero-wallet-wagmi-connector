import { ethers } from 'ethers';
import { ZeroWalletSigner } from '../signer';

interface RecoveryMechanism {
    recoveryReadyPromise: () => Promise<void>;
    isRecoveryReady: () => boolean;
    setupRecovery: (
        wallet: ethers.Wallet | ZeroWalletSigner
    ) => Promise<void | ethers.Wallet>;
    initiateRecovery: (keyId?: number) => Promise<ethers.Wallet>;
}

export type { RecoveryMechanism };
