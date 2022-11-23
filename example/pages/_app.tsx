import { getDefaultProvider } from 'ethers';
import type { AppProps } from 'next/app';
import { createClient, defaultChains, WagmiConfig, Chain, chain } from 'wagmi';
// import '../styles/globals.css';
import { ZeroWalletConnector } from 'zero-wallet-wagmi-connector';
import { ChakraProvider } from '@chakra-ui/react'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'

const zeroWalletConnectorOptions = {
    jsonRpcProviderUrl:
        `https://eth-goerli.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    store: 'browser',
    recoveryMechanism: 'google',
    zeroWalletServerEndpoints: {
        nonceProvider: process.env.NEXT_PUBLIC_NONCE_PROVIDER_ENDPOINT!,
        nonceRefresher: process.env.NEXT_PUBLIC_NONCE_REFRESHER_ENDPOINT!,
        authorizer: process.env.NEXT_PUBLIC_AUTHORIZER_ENDPOINT!,
        gasStation: process.env.NEXT_PUBLIC_GAS_STATION_ENDPOINT!,
        transactionBuilder: process.env.NEXT_PUBLIC_TRANSACTION_BUILDER_ENDPOINT!,
        scwDeployer: process.env.NEXT_PUBLIC_SCW_DEPLOYER_ENDPOINT!
    },
    gasTankName: 'testGasTankName'
}

const connector = new ZeroWalletConnector({
    chains: [chain.goerli],
    options: zeroWalletConnectorOptions
});

// const provider = new ZeroWalletProvider(zeroWalletConnectorOptions.jsonRpcProviderUrl,
//     { name: 'goerli', chainId: 5 },
//     StorageFactory.create(zeroWalletConnectorOptions.store),
//     zeroWalletConnectorOptions.zeroWalletServerEndpoints,
//     zeroWalletConnectorOptions.gasTankName)

const connectorMM = new MetaMaskConnector()


const client = createClient({
    autoConnect: false,
    provider: getDefaultProvider(chain.goerli.id),
    connectors: [
        new MetaMaskConnector({
            chains: [chain.goerli],
            options: {
                shimDisconnect: true,
            },
        }),
    ],
});

export default function App({ Component, pageProps }: AppProps) {
    return (
        <WagmiConfig client={client}>
            <ChakraProvider>
                <Component {...pageProps} />
            </ChakraProvider>
        </WagmiConfig>
    );
}
