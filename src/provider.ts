import { ethers } from "ethers";
import { GoogleRecoveryMechanismOptions, GoogleRecoveryWeb } from "recovery";
import { ZeroWalletSigner } from "signer";
import { IStoreable } from "store/IStoreable";
import { StorageFactory } from "store/storageFactory";

const _constructorGuard = {};
const GOOGLE_CLEINT_ID = process.env.GOOGLE_CLIENT_ID!;
const ZERO_WALLET_FOLDER_NAME = ".zero-wallet";
const ZERO_WALLET_FILE_NAME = "key";

export class ZeroWalletProvider extends ethers.providers.JsonRpcProvider {
  private store: IStoreable;
  constructor(jsonRpcProviderUrl: string, store: IStoreable) {
    super(jsonRpcProviderUrl);
    this.store = store;
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
}
