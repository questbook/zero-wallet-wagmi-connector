const chainsNames = {
    5: 'Goerli',
    10: 'Optimism',
    137: 'Polygon',
    42220: 'Celo'
};

enum SupportedChainId {
    CELO_MAINNET = 42220,
    GOERLI_TESTNET = 5,
    OPTIMISM_MAINNET = 10,
    POLYGON_MAINNET = 137
}

export { chainsNames, SupportedChainId };
