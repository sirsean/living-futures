# Living Futures

A Dynamic Derivatives Market for Baseball Team Performance

## Overview

Living Futures is a decentralized financial platform that enables trading of season-long derivative contracts on baseball team performance. Built on Base blockchain, it combines the best aspects of futures and perpetual contracts to create a sophisticated sports derivatives market.

## Key Features

- **Living Futures**: Season-long contracts with daily funding that reflect team performance
- **Virtual AMM**: Sigmoid-based price discovery mechanism with bounded outcomes
- **Multi-Level Liquidity**: Team-specific and shared liquidity pools with dynamic incentives
- **Risk Management**: Comprehensive insurance system with zero-base rate staking
- **System Sustainability**: Revenue-driven architecture with excess profit redistribution

## Documentation

- [Whitepaper](docs/whitepaper.md)
- [Technical Guide](docs/technical-guide.md)  
- [Proxy Infrastructure](docs/proxy-infrastructure.md) (internal)

## Project Structure

```
living-futures/
├── contracts/          # Smart contracts (Hardhat)
├── dapp/              # Frontend application (React + Vite)
├── scripts/           # Management and deployment scripts
└── docs/             # Documentation
```

## Development

### Prerequisites

- Node.js v18+
- npm or yarn
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/sirsean/living-futures.git
cd living-futures
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment template:
```bash
cp .env.template .env
# Edit .env with your configuration
```

4. Start development:
```bash
# Frontend
npm run dev

# Contracts
cd contracts && npm test
```

## Tech Stack

- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Web3**: ethers.js, wagmi
- **Infrastructure**: Base blockchain, Cloudflare Pages/Workers

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.