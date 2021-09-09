const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

const infuraKey = process.env.INFURA_KEY;
const pk = process.env.PK;

module.exports = {
  networks: {
    development: {
      host: "localhost", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1,
    },
    testnet: {
      provider: () =>
        new HDWalletProvider(
          `${process.env.PK}`,
          `wss://data-seed-prebsc-2-s1.binance.org:8545/`
        ),
      network_id: 97,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(pk, `https://rinkeby.infura.io/v3/${infuraKey}`),
      network_id: 4, // Ropsten's id
      timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(pk, `https://ropsten.infura.io/v3/${infuraKey}`),
      network_id: 3, // Ropsten's id
      timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    main: {
      provider: () =>
        new HDWalletProvider(pk, `https://mainnet.infura.io/v3/${infuraKey}`),
      network_id: 1, // Ropsten's id
      gasPrice: 33000000000,
      timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
  },
  plugins: ["solidity-coverage", "truffle-plugin-verify"],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    bscscan: process.env.BSCSCAN_API_KEY,
  },
  // Set default mocha options here, use special reporters etc.
  mocha: {slow: 10000},

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.0", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {enabled: true, runs: 50},
        evmVersion: "istanbul",
      },
    },
  },
};
