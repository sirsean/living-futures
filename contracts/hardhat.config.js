require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades");
const dotenv = require("dotenv");

dotenv.config({ path: "../.env" });

const config = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        enabled: false
      },
      accounts: {
        count: 10,
        accountsBalance: "10000000000000000000000"
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    ...(process.env.PRIVATE_KEY ? {
      base: {
        url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        accounts: [process.env.PRIVATE_KEY],
      },
      baseSepolia: {
        url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
        accounts: [process.env.PRIVATE_KEY],
      }
    } : {})
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || ""
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

module.exports = config;