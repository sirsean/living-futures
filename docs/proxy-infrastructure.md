# Proxy Infrastructure for Upgradable Contracts

## Overview

Baseball Living Futures requires a robust proxy infrastructure to enable contract upgradability while maintaining state and preserving user funds. This document outlines the proxy architecture, deployment workflow, and management system to ensure safe, transparent upgrades throughout the protocol lifecycle.

## Proxy Architecture

### Core Components

1. **Proxy Contracts**
   - Implementation of the Transparent Proxy Pattern
   - AdminUpgradeabilityProxy for each upgradable contract
   - Clear separation between admin functions and user functions

2. **Implementation Contracts**
   - Logic-only contracts that contain the actual code
   - No state variables stored directly
   - Initialized (not constructed) to avoid state conflicts

3. **ProxyAdmin**
   - Central controller for all proxy upgrades
   - Restricted access to authorized governance actors
   - Multi-sig controlled for critical upgrades

4. **Storage Architecture**
   - Unstructured storage pattern for all proxied contracts
   - Diamond storage pattern for complex storage structures
   - Explicit storage gaps for future expansion

### Contract Hierarchy

```
ProxyAdmin (Multi-sig controlled)
├── TeamVirtualAMMProxy → TeamVirtualAMM_Implementation_v1
├── PositionManagerProxy → PositionManager_Implementation_v1
├── LiquidityManagerProxy → LiquidityManager_Implementation_v1
├── InsuranceFundProxy → InsuranceFund_Implementation_v1
├── SharedLiquidityPoolProxy → SharedLiquidityPool_Implementation_v1
└── OracleCoordinatorProxy → OracleCoordinator_Implementation_v1
```

## Implementation Strategy

### Storage Layout

All contracts will follow strict storage layout conventions:

1. **Versioned Storage**
   - Storage variables grouped by version
   - Each version explicitly labeled with comments
   - Storage gaps after each version block

```solidity
// STORAGE V1
uint256 public variable1;
address public variable2;
mapping(address => uint256) public variable3;

// Reserved storage gap for future versions
uint256[50] private __gap;

// STORAGE V2
uint256 public newVariable1;
// ...
```

2. **Storage Libraries**
   - Core storage structures defined in libraries
   - Diamond storage pattern for complex structures
   - Explicit namespace separation

```solidity
library PositionStorage {
    bytes32 constant POSITION_STORAGE_SLOT = keccak256("baseball.futures.position.storage");
    
    struct Layout {
        mapping(address => mapping(string => Position)) positions;
        uint256 totalPositions;
        // ...
    }
    
    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = POSITION_STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
```

### Initialization Pattern

All implementation contracts will use the initializer pattern instead of constructors:

```solidity
function initialize(address _admin, address _collateralToken) external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    
    collateralToken = IERC20(_collateralToken);
    admin = _admin;
    // ...
}
```

## Upgrade Management System

### Contract Registry

1. **On-chain Registry**
   - Smart contract recording all deployed addresses
   - Historical record of all implementations
   - Active version tracking

```solidity
contract ContractRegistry {
    struct Version {
        address implementation;
        uint256 deployedAt;
        string versionTag;
    }
    
    mapping(string => address) public proxies;
    mapping(string => Version[]) public implementations;
    mapping(string => uint256) public currentVersion;
    
    function registerProxy(string memory contractName, address proxy) external onlyOwner {
        proxies[contractName] = proxy;
    }
    
    function registerImplementation(
        string memory contractName, 
        address implementation, 
        string memory versionTag
    ) external onlyOwner {
        implementations[contractName].push(Version({
            implementation: implementation,
            deployedAt: block.timestamp,
            versionTag: versionTag
        }));
        currentVersion[contractName] = implementations[contractName].length - 1;
    }
    
    // Additional functionality...
}
```

2. **Repository Address Registry**
   - JSON file in project repository
   - Source of truth for frontend and tooling
   - Network-specific addresses

```json
{
  "base": {
    "ProxyAdmin": "0x...",
    "ContractRegistry": "0x...",
    "TeamVirtualAMM": {
      "proxy": "0x...",
      "implementation": "0x...",
      "version": "1.0.0"
    },
    "PositionManager": {
      "proxy": "0x...",
      "implementation": "0x...",
      "version": "1.0.0"
    },
    // Additional contracts...
  },
  "optimism": {
    // Future network deployments
  }
}
```

### Deployment Workflow

1. **Deployment Script Framework**
   - Hardhat tasks for deployment
   - TypeScript for type safety
   - Environment-specific configuration

2. **Standard Deployment Process**

```typescript
// deploy-position-manager.ts
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { saveAddresses, loadAddresses } from "./utils/address-management";

task("deploy:position-manager", "Deploy or upgrade PositionManager")
  .addParam("version", "Version tag for this deployment")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    
    // Deploy new implementation
    const PositionManager = await deploy("PositionManager_Implementation", {
      from: deployer,
      args: [],
      log: true,
    });
    
    // Load existing addresses
    const addresses = loadAddresses(network.name);
    const registry = await ethers.getContractAt("ContractRegistry", addresses.ContractRegistry);
    
    if (!addresses.PositionManager?.proxy) {
      // First deployment - deploy proxy and initialize
      const ProxyAdmin = await ethers.getContractAt("ProxyAdmin", addresses.ProxyAdmin);
      
      const TransparentProxy = await deploy("PositionManagerProxy", {
        from: deployer,
        args: [
          PositionManager.address,
          addresses.ProxyAdmin,
          "0x" // No initialization data yet
        ],
        log: true,
      });
      
      // Initialize implementation through proxy
      const positionManager = await ethers.getContractAt("PositionManager", TransparentProxy.address);
      await positionManager.initialize(
        addresses.governance,
        addresses.CollateralToken
      );
      
      // Register in on-chain registry
      await registry.registerProxy("PositionManager", TransparentProxy.address);
      
      // Update address file
      addresses.PositionManager = {
        proxy: TransparentProxy.address,
        implementation: PositionManager.address,
        version: taskArgs.version
      };
    } else {
      // Upgrade existing proxy
      const ProxyAdmin = await ethers.getContractAt("ProxyAdmin", addresses.ProxyAdmin);
      await ProxyAdmin.upgrade(addresses.PositionManager.proxy, PositionManager.address);
      
      // Update address file
      addresses.PositionManager.implementation = PositionManager.address;
      addresses.PositionManager.version = taskArgs.version;
    }
    
    // Register implementation in on-chain registry
    await registry.registerImplementation(
      "PositionManager", 
      PositionManager.address, 
      taskArgs.version
    );
    
    // Save updated addresses
    saveAddresses(network.name, addresses);
    
    console.log(`PositionManager deployed/upgraded at proxy: ${addresses.PositionManager.proxy}`);
    console.log(`New implementation: ${PositionManager.address}`);
    console.log(`Version: ${taskArgs.version}`);
  });
```

3. **Verification Process**
   - Automated contract verification on block explorers
   - Storage compatibility checks before upgrades
   - Integration testing with proxied contracts

### Governance Controls

1. **Multi-sig Governance**
   - 4-of-7 multi-signature wallet for ProxyAdmin ownership
   - Timelocks for critical upgrades
   - Emergency upgrade capability for critical vulnerabilities

2. **Upgrade Process**
   - Proposal submission with implementation address
   - Community review period (minimum 72 hours)
   - Multi-sig execution
   - Post-upgrade verification

## Testing Infrastructure

### Proxy-Aware Testing

1. **Test Fixtures**
   - Helper to deploy proxied contracts
   - Easy version switching for tests

```typescript
// test/fixtures/deploy-proxied.ts
export async function deployProxiedPositionManager(hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  // Deploy ProxyAdmin
  const ProxyAdmin = await deploy("ProxyAdmin", {
    from: deployer,
    args: [],
    log: false,
  });
  
  // Deploy implementation
  const Implementation = await deploy("PositionManager_Implementation", {
    from: deployer,
    args: [],
    log: false,
  });
  
  // Deploy proxy
  const Proxy = await deploy("PositionManagerProxy", {
    from: deployer,
    args: [
      Implementation.address,
      ProxyAdmin.address,
      "0x"
    ],
    log: false,
  });
  
  // Get contract at proxy address with implementation ABI
  const positionManager = await ethers.getContractAt("PositionManager", Proxy.address);
  
  // Initialize
  await positionManager.initialize(
    deployer,
    "0x1234567890123456789012345678901234567890" // Mock collateral token for testing
  );
  
  return {
    positionManager,
    proxyAdmin: await ethers.getContractAt("ProxyAdmin", ProxyAdmin.address),
    implementation: Implementation.address,
    proxy: Proxy.address
  };
}
```

2. **Upgrade Testing**
   - Test contract behavior before and after upgrades
   - Simulate real upgrade process in tests

```typescript
it("should maintain state after upgrade", async function() {
  // Deploy v1 and set state
  const { positionManager, proxyAdmin, proxy } = await deployProxiedPositionManager(hre);
  await positionManager.setTradingFeeRate(50); // 0.5%
  
  // Deploy v2 implementation
  const PositionManagerV2 = await deploy("PositionManager_Implementation_V2", {
    from: deployer,
    args: [],
    log: false,
  });
  
  // Upgrade
  await proxyAdmin.upgrade(proxy, PositionManagerV2.address);
  
  // Get upgraded contract
  const upgradedManager = await ethers.getContractAt("PositionManagerV2", proxy);
  
  // Check state is preserved
  expect(await upgradedManager.tradingFeeRate()).to.equal(50);
  
  // Check new functionality works
  await upgradedManager.setMaxLeverage(20);
  expect(await upgradedManager.maxLeverage()).to.equal(20);
});
```

## Frontend Integration

### Contract Abstraction Layer

1. **Contract Services**
   - Wrapper around ethers.js contract interactions
   - Automatically uses correct proxy addresses

```typescript
// src/services/contracts/positionManager.ts
import { ethers } from 'ethers';
import addresses from '../constants/addresses.json';
import PositionManagerABI from '../abis/PositionManager.json';

export function getPositionManagerContract(provider) {
  const networkId = provider.network.chainId;
  const network = networkId === 8453 ? 'base' : 'testnet';
  
  const address = addresses[network].PositionManager.proxy;
  return new ethers.Contract(address, PositionManagerABI, provider);
}

export async function openLongPosition(
  provider,
  signer,
  team,
  size,
  marginAmount
) {
  const contract = getPositionManagerContract(provider).connect(signer);
  
  // Execute transaction
  const tx = await contract.openLong(team, size, marginAmount);
  return tx.wait();
}

// Additional contract functions...
```

2. **Version Monitoring**
   - Frontend detects contract upgrades
   - Prompts users to refresh for new features
   - Version displayed in UI

## Security Considerations

1. **Function Selector Clashing**
   - Monitor function selector collisions during upgrades
   - Automated checking in CI/CD pipeline

2. **Storage Layout Validation**
   - Tool to compare storage layout between versions
   - Prevent accidental storage corruption

3. **Access Control**
   - Strict separation between admin and user functions
   - Time-delayed admin functions for critical operations

4. **Upgrade Safety**
   - Comprehensive test coverage before upgrades
   - Canary deployments on testnet
   - Bug bounty program focused on proxy security

## Best Practices for Development

1. **Always use initializers instead of constructors**
2. **Never change the order of storage variables**
3. **Always add new storage variables at the end of the contract**
4. **Use storage gaps for future-proofing (50+ slots)**
5. **Test both direct implementation and proxied contracts**
6. **Keep accurate documentation of all versions**
7. **Always run storage layout comparison tools before upgrading**
8. **Maintain immutable contracts for critical operations if possible**

By following these guidelines, the Baseball Living Futures protocol can safely evolve while maintaining backward compatibility and security.
