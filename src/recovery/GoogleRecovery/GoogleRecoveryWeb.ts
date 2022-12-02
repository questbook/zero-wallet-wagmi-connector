import { Wallet } from 'ethers';
import { RecoveryMechanism } from '../types';
import { GoogleRecoveryMechanismOptions, Metadata } from './types';
import {
    _isNumber,
    getRandomString,
    loadGoogleScript,
    uploadTextFileToDrive
} from './utils';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const RANDOM_STRING_LENGTH = 50;
const ZERO_WALLET_FOLDER_NAME = '.zero-wallet';
const ZERO_WALLET_FILE_NAME = 'key';

export default class GoogleRecoveryWeb implements RecoveryMechanism {
    options: GoogleRecoveryMechanismOptions;
    _recoveryReadyPromise: Promise<void>;
    _tokenClient: any;
    _isGapiReady: boolean;
    _isGsiReady: boolean;
    folderNameGD: string;
    fileNameGD: string;

    constructor(options: GoogleRecoveryMechanismOptions) {
        this.options = options;
        this._tokenClient = null;
        this._recoveryReadyPromise = this._init();
        this._isGapiReady = false;
        this._isGsiReady = false;
        this.folderNameGD = this.folderNameGD || ZERO_WALLET_FOLDER_NAME;
        this.fileNameGD = this.fileNameGD || ZERO_WALLET_FILE_NAME;
    }

    async _getGapiPromise(srcGapi: string): Promise<void> {
        await loadGoogleScript(srcGapi);
        await new Promise((resolve, reject) => {
            gapi.load('client', { callback: resolve, onerror: reject });
        });

        await gapi.client.init({}).then(() => {
            gapi.client.load(
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
            );
        });

        this._isGapiReady = true;
    }

    async _init(): Promise<void> {
        // Loading GAPI and GSI
        const srcGapi = 'https://apis.google.com/js/api.js';
        const srcGsi = 'https://accounts.google.com/gsi/client';

        const srcGapiPromise = this._getGapiPromise(srcGapi);

        const srcGsiPromise = loadGoogleScript(srcGsi).then(() => {
            const newToken = google.accounts.oauth2.initTokenClient({
                // eslint-disable-next-line camelcase
                client_id: this.options.googleClientId,
                scope: SCOPES.join(' '),
                callback: () => {}
            });
            this._tokenClient = newToken;
            this._isGsiReady = true;
        });
        await Promise.all([srcGapiPromise, srcGsiPromise]);
    }

    async _getToken(err: any) {
        if (
            err.result.error.code.toString() === '401' ||
            err.result.error.code.toString() === '403'
        ) {
            // The access token is missing, invalid, or expired, prompt for user consent to obtain one.
            await new Promise((resolve, reject) => {
                try {
                    // Settle this promise in the response callback for requestAccessToken()
                    this._tokenClient.callback = (resp: any) => {
                        if (resp.error !== undefined) {
                            reject(resp);
                        }

                        // GIS has automatically updated gapi.client with the newly issued access token.
                        // console.log(
                        //   "gapi.client access token: " +
                        //     JSON.stringify(gapi.client.getToken())
                        // );
                        resolve(resp);
                    };

                    this._tokenClient.requestAccessToken();
                } catch (err) {
                    // console.log(err);
                }
            });
        } else {
            // Errors unrelated to authorization: server errors, exceeding quota, bad requests, and so on.
            throw new Error(err);
        }
    }

    async _removeFilesOrFolders(
        filesList: gapi.client.drive.File[]
    ): Promise<void> {
        await Promise.all(
            filesList.map((file) => {
                return gapi.client.drive.files.delete({ fileId: file.id! });
            })
        );
    }

    /**
     * A method to get the folder stored on google drive according to the options provided.
     * @returns a promise of a google drive file or undefined in case no folder exists.
     */
    async _getFilteredFolders(): Promise<gapi.client.drive.File[]> {
        // Retrieving folders from gapi.
        const folderQuerySelector: string = `mimeType=\'application/vnd.google-apps.folder\' and name contains \'${this.folderNameGD}\' and \'root\' in parents and trashed = false`;
        const folderQueryResponse = await gapi.client.drive.files.list({
            q: folderQuerySelector,
            spaces: 'drive'
        });

        // Filtering the results with the add random string.
        const folders = folderQueryResponse.result.files?.filter((folder) => {
            return (
                folder.name?.length ===
                this.folderNameGD.length + RANDOM_STRING_LENGTH
            );
        });
        if (!folders?.length) return [];

        return folders;
    }

    async _getFolderWithRemoval(): Promise<gapi.client.drive.File | undefined> {
        const folders = await this._getFilteredFolders();
        if (!folders.length) return undefined;
        if (folders.length > 1)
            await this._removeFilesOrFolders(folders.slice(1));

        return folders[0];
    }

    async _getKeyFilesFromFolder(
        folderId: string,
        keyId?: number
    ): Promise<gapi.client.drive.File[]> {
        let keyFileQuerySelector: string;
        if (!this.options.allowMultiKeys)
            keyFileQuerySelector = `mimeType!=\'application/vnd.google-apps.folder\' and \'${folderId}\' in parents and name=\'${this.fileNameGD}\' and trashed = false`;
        else {
            if (typeof keyId === 'undefined')
                keyFileQuerySelector = `mimeType!=\'application/vnd.google-apps.folder\' and \'${folderId}\' in parents and name contains \'${this.fileNameGD}\' and trashed = false`;
            else
                keyFileQuerySelector = `mimeType!=\'application/vnd.google-apps.folder\' and \'${folderId}\' in parents and name =\'${
                    this.fileNameGD + keyId.toString()
                }\' and trashed = false`;
        }

        const keyFileQueryResponse = await gapi.client.drive.files.list({
            q: keyFileQuerySelector,
            spaces: 'drive'
        });
        let result = keyFileQueryResponse.result.files;

        if (this.options.allowMultiKeys && typeof keyId === 'undefined') {
            // The key file name length should be larger than fileNameGD's fileNameGD.length.
            const baseKeyFileLength = this.fileNameGD.length;
            result = result?.filter((file) => {
                return _isNumber(file.name!.slice(baseKeyFileLength));
            });
        }

        return result || [];
    }

    async _getKeyFileContent(keyId: string): Promise<string> {
        return (
            await gapi.client.drive.files.get({
                fileId: keyId,
                alt: 'media'
            })
        ).body;
    }

    async _importWalletFromGD(keyId?: number): Promise<Wallet> {
        const folder = await this._getFolderWithRemoval();
        if (!folder) throw Error('No zero wallet folder found in GD.');
        const matchedKeyFiles = await this._getKeyFilesFromFolder(
            folder.id!,
            keyId
        );
        if (!matchedKeyFiles.length) throw Error('No key files found.');
        if (matchedKeyFiles.length > 1)
            console.warn('Found multiple key files. Picking a random key.');

        const matchedKeyFile = matchedKeyFiles[0];
        const keyFileContent = await this._getKeyFileContent(
            matchedKeyFile.id!
        );
        try {
            const newWallet = new Wallet(keyFileContent);
            return newWallet;
        } catch {
            throw Error(
                'Content of the selected file is not a valid private key'
            );
        }
    }

    async _createFolder(): Promise<gapi.client.drive.File> {
        const formattedFolderName =
            this.folderNameGD + getRandomString(RANDOM_STRING_LENGTH);
        const folderMetadata: gapi.client.drive.File = {
            name: formattedFolderName,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const newZeroWalletFolder = await gapi.client.drive.files.create({
            resource: folderMetadata
        });

        return newZeroWalletFolder.result;
    }

    async _getNewKeyFileName(
        keyFilesInFolder: gapi.client.drive.File[]
    ): Promise<string> {
        if (!this.options.allowMultiKeys) {
            return this.fileNameGD;
        }

        let maxExistingNumber = 0;
        const baseKeyFileLength = this.fileNameGD.length;
        keyFilesInFolder.forEach((keyFile) => {
            try {
                const keyFileNumber = +keyFile.name!.slice(baseKeyFileLength);
                if (keyFileNumber > maxExistingNumber) {
                    maxExistingNumber = keyFileNumber;
                }
            } catch {}
        });
        maxExistingNumber++;
        const formatedKeyFileName =
            this.fileNameGD + maxExistingNumber.toString();
        return formatedKeyFileName;
    }

    async _createNewKeyFile(wallet: Wallet, folderId: string): Promise<void> {
        const keyFilesInFolder = await this._getKeyFilesFromFolder(folderId);
        const newKeyFileName = await this._getNewKeyFileName(keyFilesInFolder);

        const existingKeyFiles = keyFilesInFolder.filter(
            (file) => file.name === newKeyFileName
        );
        if (
            existingKeyFiles.length &&
            this.options.handleExistingKey === 'Error'
        ) {
            throw new Error(`${newKeyFileName} already exists`);
        }

        if (this.options.handleExistingKey === 'Overwrite')
            await this._removeFilesOrFolders(existingKeyFiles);

        const keyFileMetadata: Metadata = {
            name: newKeyFileName,
            parents: [folderId],
            mimeType: 'application/octet-stream'
        };
        await uploadTextFileToDrive(keyFileMetadata, wallet.privateKey);
    }

    async _exportWalletToGD(wallet: Wallet): Promise<void> {
        let folder = await this._getFolderWithRemoval();
        if (!folder) folder = await this._createFolder();

        await this._createNewKeyFile(wallet, folder.id!);
    }

    recoveryReadyPromise(): Promise<void> {
        return this._recoveryReadyPromise;
    }

    isRecoveryReady(): boolean {
        return this._isGsiReady && this._isGapiReady;
    }

    async setupRecovery(wallet: Wallet): Promise<void> {
        let newFileID;
        let error = 'unkown error';
        try {
            newFileID = await this._exportWalletToGD(wallet);
            error = '';
        } catch (err) {
            if (typeof err === 'string') {
                error = err.toUpperCase();
            } else if (err instanceof Error) {
                error = err.message;
            }

            try {
                await this._getToken(err);
                try {
                    newFileID = await this._exportWalletToGD(wallet);
                    error = '';
                } catch (err2) {
                    if (typeof err2 === 'string') {
                        error = err2.toUpperCase();
                    } else if (err2 instanceof Error) {
                        error = err2.message;
                    }
                }
            } catch {}
        }

        // setExportLoading(false);
        if (error.length > 0) throw new Error(error.toString());
        return newFileID;
    }

    async initiateRecovery(keyId?: number): Promise<Wallet> {
        let newWallet;
        let error: string = 'unknown error';
        try {
            newWallet = await this._importWalletFromGD(keyId);
            error = '';
        } catch (err) {
            if (typeof err === 'string') {
                error = err.toUpperCase();
            } else if (err instanceof Error) {
                error = err.message;
            }

            try {
                await this._getToken(err);
                try {
                    newWallet = await this._importWalletFromGD(keyId);
                    error = '';
                } catch (err2) {
                    if (typeof err2 === 'string') {
                        error = err2.toUpperCase();
                    } else if (err2 instanceof Error) {
                        error = err2.message;
                    }
                }
            } catch {}
        }

        // setImportLoading(false);
        if (!newWallet) throw new Error(error.toString());
        return newWallet;
    }
}
