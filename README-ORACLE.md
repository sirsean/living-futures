# Baseball Oracle System

## Overview

The Baseball Oracle is a critical component of the Living Futures platform that provides authoritative baseball team performance data to the protocol. It consists of:

- **Smart Contracts**: On-chain storage and calculation of team statistics
- **Sync Service**: Off-chain service that fetches game data from MLB APIs
- **Monitoring**: Health checks and alerting for operational issues

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MLB API       │────>│  Sync Service   │────>│ Oracle Contract │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         ▲
                        ┌─────────────────┐              │
                        │    Monitor      │──────────────┘
                        └─────────────────┘
```

## Quick Start

### 1. Deploy Contracts

```bash
cd contracts

# Deploy registry and oracle
npm run deploy:all

# Or deploy individually
npm run deploy:registry
npm run deploy:oracle
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your configuration
# - RPC URLs
# - Private keys
# - Network settings
```

### 3. Start Services

```bash
cd scripts

# Register teams (first time only)
npm run oracle:register-teams

# Start sync service
npm run oracle:sync

# Start monitoring (separate terminal)
npm run oracle:monitor
```

## Components

### Smart Contracts

The BaseballOracle contract:
- Stores team records and win percentages
- Records game results with timestamps
- Manages season transitions
- Provides data to other protocol contracts

Key features:
- Upgradeable proxy pattern
- Role-based access control
- Pausable for emergencies
- Comprehensive event logging

### Sync Service

The sync service:
- Fetches game data from MLB Stats API
- Validates and transforms data
- Submits to blockchain in batches
- Handles retries and errors gracefully

Configuration:
```javascript
{
    syncInterval: 30,      // minutes
    batchSize: 10,        // games per transaction
}
```

### Monitoring Service

The monitoring service:
- Checks team data freshness
- Monitors recent game recordings
- Sends alerts via Slack/Discord
- Tracks error rates and performance

Alert thresholds:
- Team not updated for >24 hours
- No games recorded in >48 hours
- Contract connection failures

## Operations

### Daily Tasks

1. **Check Service Status**
   ```bash
   pm2 status
   pm2 logs oracle-sync
   ```

2. **Manual Sync** (if needed)
   ```bash
   npm run oracle:sync:manual -- --start 2024-05-01 --end 2024-05-07
   ```

3. **Review Monitoring**
   ```bash
   npm run oracle:health
   ```

### Administrative Tasks

**Grant Roles**
```bash
npm run oracle:grant-role ORACLE_ROLE 0xAddress
npm run oracle:grant-role ADMIN_ROLE 0xAddress
```

**Correct Game Data**
```bash
npm run oracle:correct-game --gameId 12345 --homeScore 5 --awayScore 3
```

**Season Management**
```bash
# End of season
npm run oracle:season:deactivate

# Start of season
npm run oracle:season:activate
```

### Troubleshooting

**Games Not Recording**
1. Check wallet gas balance
2. Verify ORACLE_ROLE assigned
3. Review transaction logs
4. Check API rate limits

**Stale Team Data**
1. Verify games marked as final
2. Check sync service logs
3. Run manual sync for date range

**Connection Errors**
1. Verify RPC URL correct
2. Check network status
3. Confirm contract deployed

## Development

### Testing

```bash
cd contracts
npm test

# Run specific test
npm test -- --grep "BaseballOracle"
```

### Adding New Features

1. Update contract (if needed)
2. Deploy new implementation
3. Update sync service
4. Add monitoring checks
5. Update documentation

### Contract Upgrades

```bash
# Deploy new implementation
npm run deploy:oracle:upgrade

# Update proxy (admin only)
npm run oracle:upgrade --implementation 0xNewAddress
```

## Security

- Use hardware wallets for production
- Multi-sig for admin operations
- Regular security audits
- Monitor for anomalies
- Rotate keys periodically

## API Rate Limits

MLB Stats API:
- No official rate limit published
- Recommended: 10 requests/second
- Use caching when possible

## Costs

Estimated costs (Base mainnet):
- Gas per game: ~50,000 gas
- Batch of 10 games: ~150,000 gas
- Daily cost: ~0.01 ETH (varies)

## Support

- Documentation: `/docs/oracle-operations.md`
- GitHub Issues: `github.com/your-org/living-futures/issues`
- Discord: `discord.gg/living-futures`
- Email: `oracle-support@livingfutures.io`

## License

Copyright (c) 2024 Living Futures Protocol

Licensed under MIT License