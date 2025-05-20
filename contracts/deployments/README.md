# Deployment Records

This directory contains contract deployment records for different networks.

## File Naming Convention

- `{network}-latest.json` - Latest deployment addresses for a network
- `{network}-{timestamp}.json` - Historical deployment record
- `deployment-template.json` - Structure template (committed)

## Git Tracking

### Committed Files ✅
- Production deployments (`base-*.json`)
- Testnet deployments (`baseSepolia-*.json`, etc.)
- Template and documentation files

### Excluded Files ❌
- Local deployments (`localhost-*.json`)
- Any network that resets contract addresses

## Usage

### Loading Deployment Data
```typescript
import deployments from './deployments/base-latest.json';
const oracleAddress = deployments.BaseballOracle.proxy;
```

### Environment-Specific Loading
```typescript
const network = process.env.NETWORK || 'localhost';
const deployments = require(`./deployments/${network}-latest.json`);
```

## Network Configurations

- **localhost** (Chain ID: 31337) - Local Hardhat network
- **baseSepolia** (Chain ID: 84532) - Base Sepolia testnet  
- **base** (Chain ID: 8453) - Base mainnet

## Security Notes

- Never commit private keys or sensitive data
- Deployment files contain only public contract addresses
- Always verify contract addresses before using in production