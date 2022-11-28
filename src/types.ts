import { SupportedChainId } from './constants/chains';
import { IStoreable } from './store/IStoreable';
import type { GoogleRecoveryMechanismOptions } from './recovery';

export type GoogleWebRecoveryConnectorOptions =
    GoogleRecoveryMechanismOptions & { type: 'google-web-recovery' };
export type RecoveryConfig = GoogleWebRecoveryConnectorOptions;

export type ZeroWalletConnectorOptions = {
    jsonRpcProviderUrls: JsonRpcProviderUrls;
    store: string;
    zeroWalletServerDomain: string;
    gasTankName: string;
    recovery?: RecoveryConfig;
};

export type JsonRpcProviderUrls = {
    [key in SupportedChainId]?: string;
};

export type NameToClassValue<T extends IStoreable> = { [key: string]: T };

export type ZeroWalletServerEndpoints = {
    nonceProvider: string;
    nonceRefresher: string;
    authorizer: string;
    gasStation: string;
    transactionBuilder: string;
    scwDeployer: string;
};

export type BuildExecTransactionType = {
    to: string;
    value: number;
    data: string;
    operation: number;
    targetTxGas: number;
    baseGas: number;
    gasPrice: number;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
};

export type WebHookAttributesType = {
    nonce: string;
    signedNonce: SignedTransaction;
    to: string;
    chainId: number;
};

export type DeployWebHookAttributesType = {
    nonce: string;
    signedNonce: SignedTransaction;
};

export type SignedTransaction = {
    transactionHash: string;
    r: string;
    s: string;
    v: number;
};

export type BigNumberAPI = {
    hex: string;
    type: 'BigNumber';
};
