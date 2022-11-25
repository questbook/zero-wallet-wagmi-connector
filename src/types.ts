import { IStoreable } from './store/IStoreable';

export type ZeroWalletConnectorOptions = {
    /** hex encoded ETH private key or raw binary */
    jsonRpcProviderUrl: string;
    store: string;
    recoveryMechanism: string;
    zeroWalletServerEndpoints: ZeroWalletServerEndpoints;
    gasTankName: string;
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
    hex: string,
    type: 'BigNumber',
}
