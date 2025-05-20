# Living Futures Management Scripts

This directory contains management scripts for the Living Futures platform, including deployment tools, oracle services, and administrative utilities.

## Oracle Service

The oracle service is responsible for fetching baseball game data from the official MLB Stats API and recording the results on the blockchain. This is a critical component that powers the derivatives platform by providing reliable game outcomes.

### Running the Oracle Updater

The Oracle Updater can be run in several modes:

```bash
# Automatic sync mode - fetches latest games and records them on the blockchain
npm run oracle:sync

# Manual sync mode - for testing or recovering from failures
npm run oracle:sync:manual

# Manual sync mode for a specific date (format: YYYY-MM-DD)
npm run oracle:sync:manual -- --date 2024-04-15

# TEST MODE: Fetch today's data from MLB API (no blockchain interaction)
npm run oracle:test-api

# TEST MODE: Fetch data for a specific date (format: YYYY-MM-DD)
npm run oracle:test-api:date 2024-04-15

# Monitor mode - checks oracle health without making transactions
npm run oracle:monitor

# Health check - verify connection to the oracle contract
npm run oracle:health
```

> **Note**: All date handling is done in Eastern Time (ET), which is the MLB's primary timezone. This ensures games are recorded on the correct calendar day regardless of your local timezone.

### Configuration

Before running the Oracle Updater, make sure:

1. You have created a `.env` file with the following required variables:
   ```
   # RPC Provider
   RPC_URL=https://mainnet.base.org
   
   # Oracle Admin Private Key (needs ORACLE_ADMIN_ROLE)
   ORACLE_ADMIN_PRIVATE_KEY=0x...
   
   # API Keys (optional but recommended to avoid rate limiting)
   MLB_API_KEY=your_mlb_api_key
   ```

2. The Oracle contract is deployed and the address is correctly set in the deployment file (in `/contracts/deployments/{network}-latest.json`)

3. The wallet specified by the private key has been granted the Oracle Admin role

### Oracle Management Commands

```bash
# List all registered teams
npm run oracle:teams

# Check details for a specific team
npm run oracle:team -- --id 133  # Oakland Athletics

# Register new teams
npm run oracle:register-teams

# Correct a game result (admin only)
npm run oracle:correct-game -- --gameId 12345 --homeScore 5 --awayScore 3

# Activate the season (allows recording of new games)
npm run oracle:season:activate

# Deactivate the season (blocks recording of new games)
npm run oracle:season:deactivate
```

### Oracle Reporting Commands

```bash
# Generate daily report of recorded games
npm run oracle:report:daily -- --date 2024-04-15

# Generate weekly report of recorded games
npm run oracle:report:weekly -- --startDate 2024-04-15 --endDate 2024-04-21

# Generate season report
npm run oracle:report:season
```

## Other Available Scripts

### Deployment Scripts
- `npm run deploy` - Deploy all contracts to the blockchain
- `npm run verify` - Verify contracts on block explorer

### Management Scripts
- `npm run process-funding` - Process daily funding calculations
- `npm run sync-github-secrets` - Sync secrets from .env to GitHub

### Development and Testing
- `npm run dev` - Run development scripts with hot reload
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.template` to `.env` in the root directory
   - Fill in all required values

3. For development and testing, ensure you have:
   - Node.js v22+ installed
   - A Base network RPC URL (Mainnet or Testnet)
   - Test ETH for the network you're using

## Oracle Architecture

The Oracle service consists of:

1. **Data Providers**:
   - MLB API Client - Primary and only data source

2. **Core Services**:
   - Oracle Sync Service - Coordinates fetching and recording of data
   - Oracle Blockchain Service - Handles blockchain interactions

3. **Monitoring**:
   - Oracle Monitor - Keeps track of oracle health and operations

## Troubleshooting

If you encounter issues with the Oracle service, try these steps:

1. **Connection Issues**: Verify your RPC_URL is correct and accessible
   ```bash
   npm run oracle:health
   ```

2. **Transaction Failures**: Check if the admin wallet has enough ETH for gas
   ```bash
   # Check wallet balance
   cast balance $(cast wallet address $ORACLE_ADMIN_PRIVATE_KEY) --rpc-url $RPC_URL
   ```

3. **API Issues**: Test the connection to external APIs
   ```bash
   # With manual mode
   npm run oracle:sync:manual -- --testOnly
   ```

4. **Logs**: Add the DEBUG=1 environment variable for more detailed logs
   ```bash
   DEBUG=1 npm run oracle:sync
   ```

## Environment Variables

See the root `.env.template` for all available environment variables.