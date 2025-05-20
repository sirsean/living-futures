# Local Development Guide

This guide explains how to run a local Hardhat network and deploy the Living Futures oracle contracts for testing and development.

## Prerequisites

- Node.js >= 22.0.0
- npm installed
- All dependencies installed (`npm install`)

## Quick Start

### 1. Start Local Hardhat Network

Open a terminal and run:

```bash
cd contracts
npm run node
```

This will:
- Start a local Hardhat network on `http://127.0.0.1:8545`
- Use Chain ID `31337` (standard for local Hardhat networks)
- Create 10 accounts with 10,000 ETH each
- Display the private keys and addresses for testing

**Keep this terminal running** - it's your local blockchain.

### 2. Deploy Contracts (New Terminal)

In a new terminal window:

```bash
cd contracts
npm run deploy:local
```

This will deploy:
- ProxyAdmin contract
- ContractRegistry (with proxy)
- BaseballOracle (with proxy)
- Register contracts in the registry
- Set up initial roles
- Register 6 sample teams for testing

## What Gets Deployed

The local deployment creates a complete testing environment:

### Contracts
- **ProxyAdmin**: Manages proxy upgrades
- **ContractRegistry**: Central registry for contract addresses
- **BaseballOracle**: Main oracle contract for baseball data

### Sample Teams
The script registers these teams for testing:
- New York Yankees (NYY)
- Boston Red Sox (BOS)
- Los Angeles Dodgers (LAD)
- San Francisco Giants (SF)
- Houston Astros (HOU)
- Atlanta Braves (ATL)

### Roles Setup
The deployer account gets both ORACLE_ROLE and ADMIN_ROLE permissions.

## Useful Commands

### Network Management
```bash
# Start local network
npm run node

# Deploy to local network
npm run deploy:local

# Open Hardhat console (interact with contracts)
npm run console
```

### Development
```bash
# Compile contracts
npm run build

# Run tests against local network
npm test

# Generate test coverage
npm run coverage
```

## Deployment Files

After deployment, you'll find:

### Deployment Data ⚠️ (Not committed to git)
- `deployments/localhost-latest.json` - Latest deployment addresses
- `deployments/localhost-[timestamp].json` - Timestamped deployment record

**Note**: Local deployment files are excluded from git since contract addresses change every time you restart the Hardhat network. Only production/testnet deployment files should be committed.

### ABIs
- `abis/BaseballOracle.json` - Oracle contract ABI
- `abis/ContractRegistry.json` - Registry contract ABI

## Interacting with Contracts

### Using Hardhat Console

```bash
npm run console
```

Then in the console:

```javascript
// Get deployed contract addresses
const deployments = require('./deployments/localhost-latest.json');

// Connect to contracts
const oracle = await ethers.getContractAt("BaseballOracle", deployments.BaseballOracle.proxy);
const registry = await ethers.getContractAt("ContractRegistry", deployments.ContractRegistry.proxy);

// Example: Get team info
const team = await oracle.getTeam("NYY");
console.log(team);

// Example: Update team data (requires ORACLE_ROLE)
await oracle.updateTeamData("NYY", 85, 77, 52.5); // wins, losses, win_pct
```

### Using Scripts

Create a new script in `scripts/` directory:

```typescript
// scripts/interact-example.ts
import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    // Load deployment data
    const deployments = JSON.parse(fs.readFileSync('./deployments/localhost-latest.json', 'utf8'));
    
    // Get contract instance
    const oracle = await ethers.getContractAt("BaseballOracle", deployments.BaseballOracle.proxy);
    
    // Your interaction code here
    const teamCount = await oracle.getTeamCount();
    console.log(`Total teams registered: ${teamCount}`);
}

main().catch(console.error);
```

Run with:
```bash
npx hardhat run scripts/interact-example.ts --network localhost
```

## Network Configuration

The local network is configured with:
- **Chain ID**: 31337
- **RPC URL**: http://127.0.0.1:8545
- **Accounts**: 10 test accounts with 10,000 ETH each
- **Block Time**: Instant (mines when transactions are sent)

## Common Issues

### "ECONNREFUSED" Error
Make sure the Hardhat node is running (`npm run node`).

### "Contract not deployed" Error
Run the deployment script (`npm run deploy:local`).

### Permission Errors
The deployment script grants all necessary roles to the deployer account automatically.

### Reset Network State
Stop the Hardhat node (Ctrl+C) and restart it to reset all state.

## Integration with Frontend

To connect your frontend to the local network:

1. **Add localhost network to MetaMask**:
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

2. **Import test accounts**:
   Use the private keys displayed when you start the Hardhat node.

3. **Use deployment addresses**:
   Read contract addresses from `deployments/localhost-latest.json`.

4. **Use exported ABIs**:
   Import ABIs from the `abis/` directory.

## Advanced Usage

### Custom Network Forking

To test against real Base network data, modify `hardhat.config.js`:

```javascript
networks: {
  hardhat: {
    forking: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      enabled: true  // Enable forking
    }
  }
}
```

### Testing with Different Accounts

```javascript
// In Hardhat console or scripts
const signers = await ethers.getSigners();
const deployer = signers[0];  // Has admin roles
const user1 = signers[1];     // Regular user
const user2 = signers[2];     // Another user

// Connect contract with different signer
const oracleAsUser1 = oracle.connect(user1);
```

## Next Steps

1. Start the local network and deploy contracts
2. Experiment with contract interactions
3. Build frontend integration
4. Write integration tests
5. Test upgrade scenarios

For production deployment, see the main deployment scripts and refer to the deployment documentation.