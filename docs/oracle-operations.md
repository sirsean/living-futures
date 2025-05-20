# Baseball Oracle Operations Guide

## Overview

The Baseball Oracle system provides authoritative team performance data to the Living Futures protocol. This document outlines operational procedures for managing and maintaining the Oracle system.

## System Components

### 1. Smart Contract (On-Chain)
- **BaseballOracle Contract**: Upgradeable contract storing game results and team statistics
- **Contract Registry**: Tracks all deployed contracts and versions
- **Access Control**: Role-based permissions for oracle updates and administration

### 2. Sync Service (Off-Chain)
- **MLB API Integration**: Primary and sole data source for game results
- **Blockchain Service**: Submits verified data to the oracle contract
- **Scheduler**: Manages periodic updates

### 3. Monitoring Service
- **Health Checks**: Verifies oracle data freshness
- **Alert System**: Notifications via Slack/Discord
- **Performance Tracking**: Monitors sync success rates

## Initial Setup

### 1. Environment Configuration

Create a `.env` file with the following variables:

```env
# Blockchain Configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ORACLE_PRIVATE_KEY=your-oracle-wallet-private-key
ADMIN_PRIVATE_KEY=your-admin-wallet-private-key
NETWORK=base

# API Keys (optional but recommended)
BASESCAN_API_KEY=your-basescan-api-key

# Monitoring (optional)
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
```

### 2. Contract Deployment

Deploy the Oracle system in the correct order:

```bash
# 1. Deploy Contract Registry
npm run deploy:registry

# 2. Deploy BaseballOracle with proxy
npm run deploy:oracle

# 3. Register teams (if not done automatically)
npm run oracle:register-teams
```

### 3. Role Assignment

Assign appropriate roles to operational addresses:

```bash
# Grant ORACLE_ROLE to sync service address
npm run oracle:grant-role ORACLE_ROLE 0xYourOracleAddress

# Grant ADMIN_ROLE to admin addresses (use multi-sig in production)
npm run oracle:grant-role ADMIN_ROLE 0xYourAdminAddress
```

## Daily Operations

### Starting the Sync Service

```bash
# Start in foreground (for testing)
npm run oracle:sync

# Start with PM2 (for production)
pm2 start ecosystem.config.js --only oracle-sync

# View logs
pm2 logs oracle-sync
```

### Starting the Monitor

```bash
# Start in foreground
npm run oracle:monitor

# Start with PM2
pm2 start ecosystem.config.js --only oracle-monitor

# Check health status
npm run oracle:health
```

### Manual Operations

#### Sync Specific Date Range

```bash
# Sync games from specific dates
npm run oracle:sync:manual -- --start 2024-04-01 --end 2024-04-07
```

#### Check Team Status

```bash
# View all teams
npm run oracle:teams

# Check specific team
npm run oracle:team NYY
```

#### Correct Game Result

```bash
# Fix incorrect game data (admin only)
npm run oracle:correct-game --gameId 12345 --homeScore 5 --awayScore 3
```

## Monitoring and Alerts

### Health Check Metrics

The monitoring service tracks:
- Team data freshness (last update timestamp)
- Recent game recordings (last 24 hours)
- Season state (active/inactive)
- Contract connectivity
- Error rates

### Alert Thresholds

Default alert conditions:
- Team not updated for >24 hours during active season
- No games recorded in >48 hours during season
- Contract connection failures
- Excessive API errors

### Alert Configuration

Configure alerts in the monitoring service:

```typescript
const monitor = new OracleMonitor({
    alertThreshold: 24, // hours
    checkInterval: 15,  // minutes
    slackWebhook: process.env.SLACK_WEBHOOK,
    discordWebhook: process.env.DISCORD_WEBHOOK
});
```

## Troubleshooting

### Common Issues

#### 1. Games Not Recording

**Symptoms**: Games showing as final but not appearing in oracle

**Possible Causes**:
- Insufficient gas for transactions
- Rate limiting on API
- Network congestion
- Role permissions issue

**Solutions**:
1. Check wallet balance for gas
2. Verify ORACLE_ROLE is assigned
3. Check API rate limits
4. Review transaction logs
5. Try manual sync for specific games

#### 2. Stale Team Data

**Symptoms**: Team win percentage not updating

**Possible Causes**:
- Games not being marked as final
- API returning incomplete data
- Transaction failures

**Solutions**:
1. Check game status in API response
2. Verify games are properly recorded
3. Manually update team record if needed
4. Check sync service logs

#### 3. Contract Connection Errors

**Symptoms**: "Failed to connect to oracle contract"

**Possible Causes**:
- Incorrect RPC URL
- Contract not deployed
- Network issues

**Solutions**:
1. Verify RPC URL in .env
2. Check deployment files exist
3. Test network connectivity
4. Verify contract address

### Error Recovery

#### Batch Recording Failures

If batch recording fails, the service automatically:
1. Retries with exponential backoff
2. Falls back to individual game recording
3. Logs failed games for manual review

#### API Failures

If MLB API fails:
1. Service retries with exponential backoff
2. Alerts operators about API issues
3. Manual intervention may be required for prolonged outages

## Maintenance Procedures

### Season Transitions

#### End of Season
```bash
# 1. Ensure all final games are recorded
npm run oracle:sync:manual -- --start [season-start] --end [season-end]

# 2. Deactivate season (admin only)
npm run oracle:season:deactivate

# 3. Generate season summary report
npm run oracle:report:season
```

#### Start of Season
```bash
# 1. Activate new season (resets team records)
npm run oracle:season:activate

# 2. Verify all teams are registered
npm run oracle:teams

# 3. Start sync and monitoring services
pm2 restart oracle-sync oracle-monitor
```

### Contract Upgrades

When upgrading the Oracle contract:

1. Deploy new implementation
```bash
npm run deploy:oracle:upgrade
```

2. Update proxy to new implementation
```bash
npm run oracle:upgrade --implementation 0xNewImplementationAddress
```

3. Verify upgrade
```bash
npm run oracle:verify-upgrade
```

4. Update service configurations if needed

### Backup and Recovery

#### Regular Backups
- Contract state is preserved on-chain
- Store deployment files in version control
- Backup private keys securely
- Document all manual corrections

#### Disaster Recovery
1. Redeploy contracts if needed
2. Restore from latest deployment files
3. Resync historical data if required
4. Verify team registrations
5. Resume normal operations

## Security Considerations

### Key Management
- Use hardware wallets for production keys
- Implement key rotation schedule
- Never commit private keys to repository
- Use separate keys for different roles

### Access Control
- Limit ORACLE_ROLE to automated service only
- Use multi-sig for ADMIN_ROLE in production
- Regular audit of role assignments
- Monitor for unauthorized access attempts

### Operational Security
- Run services in isolated environments
- Use VPN for API access if required
- Monitor for unusual patterns
- Regular security audits

## Performance Optimization

### Gas Optimization
- Batch games when possible (10-20 per batch)
- Monitor gas prices for optimal timing
- Use appropriate gas limits
- Consider L2 solutions for high volume

### API Rate Management
- Implement request caching
- Monitor rate limit headers
- Schedule syncs during off-peak hours
- Use appropriate retry delays

### Service Optimization
- Tune batch sizes based on network conditions
- Adjust sync intervals based on game schedules
- Use efficient data structures
- Minimize redundant API calls

## Reporting

### Regular Reports
Generate operational reports:

```bash
# Daily summary
npm run oracle:report:daily

# Weekly performance
npm run oracle:report:weekly

# Monthly statistics
npm run oracle:report:monthly
```

### Metrics to Track
- Games recorded per day
- Sync success rate
- Average transaction cost
- API usage statistics
- Error rates by type
- Team update frequency

## Emergency Procedures

### Service Outage
1. Check monitoring alerts
2. Verify service status: `pm2 status`
3. Check logs: `pm2 logs oracle-sync`
4. Restart if needed: `pm2 restart oracle-sync`
5. Perform manual sync if extended outage

### Contract Emergency
1. Pause contract if critical issue (PAUSER_ROLE)
2. Investigate issue thoroughly
3. Deploy fix if needed
4. Unpause after verification

### Data Correction
For incorrect game data:
1. Verify correct data from multiple sources
2. Use admin function to correct
3. Document correction with reason
4. Update affected team records if needed

## Support Contacts

- **Technical Issues**: tech-support@livingfutures.io
- **Smart Contract**: contracts@livingfutures.io
- **Monitoring Alerts**: alerts@livingfutures.io
- **General Inquiries**: info@livingfutures.io

## Appendix

### Useful Commands

```bash
# Check sync service status
pm2 status oracle-sync

# View recent logs
pm2 logs oracle-sync --lines 100

# Restart services
pm2 restart oracle-sync oracle-monitor

# Check contract state
npm run oracle:state

# Manual team update
npm run oracle:update-team --team NYY --wins 95 --losses 67

# Export game data
npm run oracle:export --start 2024-04-01 --end 2024-10-01
```

### Configuration Files

#### ecosystem.config.js (PM2)
```javascript
module.exports = {
  apps: [
    {
      name: 'oracle-sync',
      script: './scripts/oracle/oracle-sync-service.ts',
      interpreter: 'ts-node',
      env: {
        NODE_ENV: 'production'
      },
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'oracle-monitor',
      script: './scripts/oracle/monitoring/oracle-monitor.ts',
      interpreter: 'ts-node',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Monitoring Dashboard

Set up Grafana dashboard with:
- Contract state visualizations
- Sync performance metrics
- Error rate tracking
- Gas usage trends
- API response times

This completes the operational documentation for the Baseball Oracle system.