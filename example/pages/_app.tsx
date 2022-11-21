import { getDefaultProvider } from 'ethers';
import type { AppProps } from 'next/app';
import { createClient, defaultChains, WagmiConfig } from 'wagmi';
import '../styles/globals.css';
import { ZeroWalletConnector } from 'zero-wallet-wagmi-connector';

const connector = new ZeroWalletConnector({
    chains: defaultChains,
    options: {
        jsonRpcProviderUrl:
            'https://eth-goerli.g.alchemy.com/v2/API_KEY',
        store: 'browser',
        recoveryMechanism: 'google',
        zeroWalletServerEndpoints: {
            nonceProvider: 'https://api.zerowallet.io/nonce',
            nonceRefresher: 'https://api.zerowallet.io/nonce/refresh',
            authorizer: 'https://api.zerowallet.io/authorize',
            gasStation: 'https://api.zerowallet.io/gas',
            transactionBuilder: 'https://api.zerowallet.io/transaction',
            scwDeployer: 'https://api.zerowallet.io/scw/deploy'
        },
        gasTankName: 'gasTank'
    }
});

const client = createClient({
    autoConnect: true,
    provider: getDefaultProvider(),
    connectors: [connector]
});

export default function App({ Component, pageProps }: AppProps) {
    return (
        <WagmiConfig client={client}>
            <Component {...pageProps} />
        </WagmiConfig>
    );
}
