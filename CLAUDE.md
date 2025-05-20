Living Futures is a sports derivatives platform built on Base blockchain.

## Project Structure

The project has three main components:

1. **Smart Contracts** (`/contracts`) - Solidity contracts using Hardhat
2. **Web App** (`/dapp`) - React application with Cloudflare Pages deployment
3. **Management Scripts** (`/scripts`) - TypeScript utilities for contract management

## Tech Stack

### Smart Contracts
- Solidity v0.8.x
- Hardhat for development and testing
- Foundry for advanced testing
- OpenZeppelin for standard contracts

### Web Application
- React 18+ with TypeScript
- Cloudflare Pages for hosting
- Cloudflare Workers for API endpoints
- wagmi and ethers.js for blockchain integration
- Tailwind CSS for styling
- React Query for state management

### Backend Services
- Cloudflare Workers for scheduled tasks
- KV Store and D1 for data persistence
- Oracle infrastructure for sports data

## Development Practices

- TypeScript throughout the codebase
- ES6 module syntax with type="module"
- ABIs stored as JSON in `/contracts/abis`
- Secrets in `.env` (never committed)
- `.env.template` for configuration reference
- Comprehensive testing for all contracts
- Clean, modular architecture

## Development Environment Setup

### npm Configuration Fix
The project originally used npm workspaces but this caused conflicts in the Claude environment. 
**Fixed:** Removed workspaces configuration from root package.json. Each package now manages its own dependencies.

### Running Tests & Commands
All npm commands now work normally:
- **Contracts**: `cd contracts && npm test`
- **Scripts**: `cd scripts && npm test`  
- **Dapp**: `cd dapp && npm run dev`
- **Root commands**: Use the provided scripts that cd into each directory

## Key Features

- Virtual AMM for price discovery
- Living Futures contracts with daily funding
- LP system with team-specific and shared pools
- Insurance fund with staking
- Upgradeability through proxy pattern
