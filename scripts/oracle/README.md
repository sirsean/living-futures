# Baseball Oracle Integration

This directory contains the code for the Baseball Oracle system, which provides authoritative team performance data to the Living Futures protocol.

## Project Structure

```
scripts/oracle/
├── api/                  # API integration layer
│   ├── MLBApiClient.ts   # Primary MLB API client
│   └── BaseballDataService.ts # Data processing service
├── test/                 # Test suite
│   ├── MLBApiClient.test.ts
│   └── BaseballDataService.test.ts
└── README.md             # This file
```

## Getting Started

1. Make sure you have Node.js 22+ installed
2. Install dependencies: `npm install` from the scripts directory
3. Run tests: `npm test`

## MLB API Integration

The system uses two main MLB API endpoints:

1. **Games API**: `https://statsapi.mlb.com/api/v1/schedule/games?sportId=1&date=YYYY-MM-DD`
   - Provides game data for a specific date
   - Includes scores, status, and team information

2. **Teams API**: `https://statsapi.mlb.com/api/v1/teams/[team_id]`
   - Provides detailed team information
   - Used to get team abbreviations for Oracle contract

## Development Roadmap

1. **Phase 1**: MLB API Integration ✅
   - MLB API Client
   - Data transformation service
   - Comprehensive test suite

2. **Phase 2**: Oracle Sync Service (Next steps)
   - Data validation
   - Blockchain interaction
   - Transaction management

3. **Phase 3**: Scheduling & Monitoring
   - Regular sync jobs
   - Error handling
   - Alerts

## Testing

Run tests with:

```bash
npm test
```

For watching mode:

```bash
npm run test:watch
```

For test coverage:

```bash
npm run test:coverage
```