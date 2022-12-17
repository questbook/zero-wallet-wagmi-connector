import { toUtf8Bytes } from '@ethersproject/strings';
import { Contract, providers, Wallet } from 'ethers';
import { arrayify, entropyToMnemonic, keccak256 } from 'ethers/lib/utils';
import { ZeroWalletSigner } from '../../signer';
import { RecoveryMechanism } from '../types';
import { MetamaskRecoveryMechanismOption } from './types';

const MESSAGE = 'recover-questbook';

export default class MetamaskRecovery implements RecoveryMechanism {
    options: MetamaskRecoveryMechanismOption;

    constructor(options: MetamaskRecoveryMechanismOption) {
        this.options = options;
    }

    recoveryReadyPromise(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    isRecoveryReady(): boolean {
        return true;
    }

    _generateWalletFromString(seed: string): Wallet {
        const mnemonic = entropyToMnemonic(seed);
        return Wallet.fromMnemonic(mnemonic);
    }

    _hashMessage(message: string): string {
        const hashedString = keccak256(toUtf8Bytes(message));
        return hashedString;
    }

    async _signWithMetamask(message: string): Promise<string> {
        // @ts-ignore
        if (!window.ethereum) throw new Error("Couldn't connect to Metamask");

        // @ts-ignore
        const provider = new providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const signedMessage = await signer.signMessage(arrayify(message));
        return signedMessage;
    }

    async _getNewZeroWalletMetamask() {
        const hashedMessage = this._hashMessage(MESSAGE);
        const signedMessage = await this._signWithMetamask(hashedMessage);
        const hashedSignedMessage = this._hashMessage(signedMessage);
        const newZeroWallet =
            this._generateWalletFromString(hashedSignedMessage);
        return newZeroWallet;
    }

    async _changeScwOwner(
        signer: ZeroWalletSigner,
        newWallet: Wallet
    ): Promise<void> {
        await signer.deployScw();
        if (!signer.scwAddress)
            throw new Error('Signer does not have an SCW address');

        const scwContract = new Contract(
            signer.scwAddress,
            ['function setOwner(address _newOwner)'],
            signer
        );
        const tx = await scwContract.setOwner(newWallet.address);
        await tx.wait();
    }

    async setupRecovery(wallet: ZeroWalletSigner): Promise<Wallet> {
        const newZeroWallet = await this._getNewZeroWalletMetamask();
        await this._changeScwOwner(wallet, newZeroWallet);
        return newZeroWallet;
    }

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async initiateRecovery(keyId?: number): Promise<Wallet> {
        const newZeroWallet = await this._getNewZeroWalletMetamask();
        return newZeroWallet;
    }
}
