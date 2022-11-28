import { getDefaultProvider } from 'ethers';
import type { AppProps } from 'next/app';
import { createClient, WagmiConfig, chain } from 'wagmi';
import { ZeroWalletConnector } from 'zero-wallet-wagmi-connector';
import { ChakraProvider } from '@chakra-ui/react'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'

const zeroWalletConnectorOptions = {
    jsonRpcProviderUrls:{
        5: `https://eth-goerli.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
        10: undefined,
        137: undefined,
        42220: undefined,
    },
    store: 'browser',
    recoveryMechanism: 'google',
    zeroWalletServerDomain: process.env.NEXT_PUBLIC_BACKEND_DOMAIN!,
    gasTankName: 'testGasTankName'
}

const connector = new ZeroWalletConnector({
    chains: [chain.goerli],
    options: zeroWalletConnectorOptions
});


const provider = getDefaultProvider(chain.goerli.id)

const client = createClient({
    autoConnect: false,
    provider,
    connectors: [
        // new MetaMaskConnector({
        //     chains: [chain.goerli],
        //     options: {
        //         shimDisconnect: true,
        //     },
        // }),
        connector
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
