# Baseball Oracle System Design Document

## 1. Introduction

The Baseball Oracle is a critical component of the Baseball Living Futures platform that provides authoritative team performance data to the protocol. This document explains the design philosophy, architectural decisions, and implementation plan for the Oracle system, consisting of both on-chain smart contracts and off-chain data services.

### 1.1 System Purpose

The Oracle serves several essential functions:
- Record official baseball game results with accurate timestamps
- Calculate and maintain up-to-date team win percentages
- Provide authoritative data for protocol settlement and daily funding
- Maintain a transparent, auditable history of game outcomes
- Enable administrative correction in case of errors or disputes

### 1.2 Design Principles

The Oracle system follows these core design principles:

1. **Accuracy**: Data correctness is paramount to maintain protocol integrity
2. **Timeliness**: Data updates must occur promptly to enable proper market function
3. **Transparency**: All game results and calculation methods must be fully auditable
4. **Resilience**: System must continue to function despite data source or network issues
5. **Efficiency**: Gas and operational costs should be minimized where possible
6. **Security**: Only authorized parties should be able to update game results

## 2. Data Requirements

### 2.1 Data Sources Evaluation

After evaluating multiple baseball data sources, we selected the following for our Oracle implementation:

#### Primary and Only Source: MLB Stats API
- **URL**: `https://statsapi.mlb.com/api/v1/`
- **Selection Rationale**: Official MLB data source with highest authoritativeness
- **Key Advantages**:
  - Comprehensive game information (scores, status, times)
  - Detailed team statistics
  - Most authoritative source for MLB data
  - Official data eliminates disputes about game results
- **Considerations**:
  - May require licensing for production use
  - Rate limits could apply

#### Alternative Sources Considered:
While other potential data sources were evaluated during design:
- **ESPN API**: Provides rapid updates but was deemed unnecessary given MLB API reliability
- **Baseball Reference**: Contains historical data but not needed for real-time operations
- **The Sports DB**: Free alternative but less comprehensive than MLB's official API

After evaluation, we determined that using the official MLB Stats API as our sole data source provides the best combination of reliability, authoritativeness, and simplicity while eliminating potential conflicts between different data providers.

### 2.2 Required Data Points

For each baseball game, the Oracle must record:

1. **Game Identification**:
   - Unique game identifier (using MLB's game ID system)
   - Season identifier
   - Game date and time
   - Home and away team identifiers

2. **Game Results**:
   - Final score (home and away)
   - Game status (final, postponed, suspended, etc.)
   - Time when game ended
   - Time when result was recorded on-chain

3. **Team Performance Metrics**:
   - Win/loss record
   - Win percentage (expressed as 0-1000, where 500 = .500)
   - Last game timestamp

This data structure accommodates special cases like double-headers (via unique game IDs) and postponed games (via status tracking).

## 3. System Architecture

The Baseball Oracle consists of two main components:

1. **On-Chain Oracle Contract**: Smart contract storing official game results and team statistics
2. **Off-Chain Score Sync Service**: Service that fetches game data and submits it to the blockchain

### 3.1 Oracle Contract Architecture

The Oracle contract is designed as an upgradeable contract with the following key components:

```
BaseballOracle
├── Team Registry
│   ├── Team identifiers and metadata
│   ├── Win/loss records
│   └── Win percentage calculations
├── Game Repository
│   ├── Game results storage
│   ├── Team performance updates
│   └── Event emissions
├── Season Management
│   ├── Season state tracking
│   ├── Start/end timestamps
│   └── Season transitions
└── Administrative Functions
    ├── Error correction
    ├── Access control
    └── Emergency controls
```

### 3.2 Score Sync Service Architecture

The Score Sync Service follows a modular design:

```
Score Sync Service
├── API Integration Layer
│   ├── Primary MLB API client
│   └── Backup data source clients
├── Data Processing Layer
│   ├── Data validation
│   ├── Format transformation
│   └── Anomaly detection
├── Blockchain Interaction Layer
│   ├── Transaction management
│   ├── Gas optimization
│   └── Error handling
└── Scheduling Layer
    ├── Periodic sync jobs
    ├── Manual trigger capabilities
    └── Monitoring and alerting
```

## 4. Oracle Contract Detailed Design

### 4.1 Data Structures

The contract uses the following key data structures:

#### Team Structure
```
struct Team {
    string name;            // Team name (e.g., "Yankees")
    string abbreviation;    // Team abbreviation (e.g., "NYY")
    uint256 wins;           // Season wins
    uint256 losses;         // Season losses
    uint256 winPct;         // Win percentage (0-1000 scale)
    uint256 lastGameTimestamp; // When the last recorded game ended
    uint256 lastUpdateTimestamp; // When the oracle last updated this team
    bool exists;            // Whether this team exists
}
```

#### Game Result Structure
```
struct GameResult {
    uint256 gameId;         // Unique MLB game ID
    string homeTeam;        // Home team identifier
    string awayTeam;        // Away team identifier
    uint256 homeScore;      // Home team score
    uint256 awayScore;      // Away team score
    uint256 gameDate;       // Date of game (unix timestamp)
    uint256 gameEndTimestamp; // When the game ended
    uint256 recordedTimestamp; // When the result was recorded
    string gameStatus;      // Status (final, postponed, etc)
    bool recorded;          // Whether this game is recorded
}
```

### 4.2 Key Functions

The Oracle contract provides these core functionalities:

1. **Team Registration**
   - Register official team identifiers
   - Link abbreviations and full names
   - Initialize with zero records (or previous season data if relevant)

2. **Game Recording**
   - Individual game result submission
   - Batch submission for multiple games
   - Status tracking for non-final games

3. **Team Statistics**
   - Automatic win/loss record updates
   - Win percentage calculation (scaled 0-1000)
   - Historical tracking of performance

4. **Season Management**
   - Season activation/deactivation
   - End-of-season state management
   - Season transition handling

5. **Administrative Controls**
   - Game result correction
   - Team record adjustment
   - Emergency pause function

### 4.3 Access Control

The Oracle employs role-based access control:

1. **ORACLE_ROLE**: Permitted to submit game results
2. **ADMIN_ROLE**: Can correct data and manage teams
3. **PAUSER_ROLE**: Can pause the contract in emergencies
4. **UPGRADER_ROLE**: Required for contract upgrades

These roles can be assigned to EOAs or multi-signature wallets, with the recommendation that ADMIN and UPGRADER roles use multi-sig for security.

### 4.4 Events and Logging

The contract emits events for all significant actions:

1. **GameRecorded**: When a new game result is added
2. **TeamUpdated**: When a team's record changes
3. **SeasonStateChanged**: When season state is modified
4. **BatchGameResultsProcessed**: Summary of batch updates
5. **ErrorLogged**: When result processing encounters issues

These events facilitate off-chain monitoring and provide an audit trail.

## 5. Score Sync Service Detailed Design

### 5.1 Service Components

The Score Sync Service consists of these major components:

#### MLB API Service
- Fetches game schedules, live scores, and completed game data
- Transforms API responses into contract-compatible format
- Handles API rate limiting and error cases

#### Data Validation Service
- Validates MLB API responses for completeness and consistency
- Performs sanity checks on game data (scores, timestamps, status)
- Implements retry logic for failed API requests

#### Blockchain Service
- Manages connection to the Base network
- Prepares and submits transactions to Oracle contract
- Handles transaction failures and retries

#### Scheduler Service
- Manages periodic data fetching (multiple times daily)
- Tracks last sync time and ensures all games are covered
- Adapts to baseball season schedule

### 5.2 Sync Process Flow

The service follows this process for each sync operation:

1. **Fetch Schedule**: Get today's and yesterday's games
2. **Filter Games**: Identify games that need updating (new or status changed)
3. **Validate Data**: Ensure data completeness and correctness
4. **Prepare Submission**: Format data for on-chain storage
5. **Submit Transaction**: Send data to Oracle contract
6. **Verify Recording**: Confirm successful on-chain recording
7. **Log Results**: Record sync statistics and any issues

### 5.3 Error Handling Strategy

The service implements a comprehensive error handling approach:

1. **MLB API Failure**: Implement retry with exponential backoff, alert operators for extended outages
2. **Network Issues**: Implement retry with exponential backoff
3. **Transaction Failures**: Adjust gas, retry, or queue for manual review
4. **Data Validation Failures**: Log for manual review and reject invalid data
5. **Service Failures**: Alert administrators and maintain detailed logs

### 5.4 Schedule Optimization

The sync schedule is optimized for baseball's typical game times:

- **8:00 AM**: Morning update for overnight game completions
- **12:00 PM**: Noon update before afternoon games
- **4:00 PM**: Pre-evening games update
- **10:00 PM**: Evening games update
- **2:00 AM**: Late games completed update

This schedule ensures timely updates while managing operational costs.

## 6. Special Case Handling

### 6.1 Double-Headers

Double-headers (two games between the same teams on the same day) are handled through:
- Unique game IDs from MLB for each game
- Precise game start/end timestamps
- Status tracking to differentiate between games

### 6.2 Postponed and Suspended Games

Games that are postponed or suspended require special handling:
- Status tracking in the GameResult structure
- Update capability to modify game dates and times
- Ability to record completion dates different from scheduled dates

### 6.3 Season Transitions

End-of-season and start-of-season processes:
- Season state toggling via administrative function
- Team record resets at season start
- Historical preservation of previous season data

### 6.4 Dispute Resolution

In case of scoring disputes or errors:
- Administrative correction functions
- Detailed event logs for audit trail
- Time-stamped history of all updates

## 7. Implementation Plan

The Oracle system will be implemented in these phases:

### Phase 1: Contract Development (2 weeks)
1. **Week 1**: Develop base Oracle contract with data structures and core functions
   - Implement team registration
   - Develop game recording functionality
   - Build win percentage calculation

2. **Week 2**: Implement administrative and security features
   - Add role-based access control
   - Develop error correction functions
   - Implement upgradeability pattern
   - Comprehensive test suite

### Phase 2: Score Sync Service (2 weeks)
1. **Week 1**: Build API integration and data processing
   - Implement MLB API client
   - Create data validation and transformation logic
   - Build comprehensive error handling

2. **Week 2**: Develop blockchain interaction and scheduling
   - Build transaction submission logic
   - Implement retry mechanisms and monitoring
   - Create scheduling and health monitoring system
   - Dockerize service for deployment

### Phase 3: Testing and Integration (1 week)
1. **Days 1-3**: Conduct integration testing
   - Test contract with live testnet
   - Verify data flow from API to blockchain
   - Validate win percentage calculations

2. **Days 4-5**: Security review and optimizations
   - Audit access controls
   - Optimize gas usage
   - Review error handling

### Phase 4: Deployment and Monitoring (1 week)
1. **Days 1-2**: Mainnet deployment
   - Deploy Oracle contract
   - Set up admin roles and permissions
   - Register teams and initial data

2. **Days 3-5**: Operational setup
   - Deploy Score Sync Service
   - Establish monitoring and alerts
   - Document operational procedures

### Phase 5: Documentation and Knowledge Transfer (1 week)
1. **Days 1-3**: Technical documentation
   - Complete code documentation
   - Develop operational runbooks
   - Create troubleshooting guides

2. **Days 4-5**: User-facing documentation
   - Explain Oracle system to protocol users
   - Document data sources and methodology
   - Create transparency reports

## 8. Security Considerations

### 8.1 Data Integrity

Ensuring data integrity is paramount for the Oracle:
- Multiple source verification where possible
- Anomaly detection for unusual scores or win percentages
- Clear audit trail of all submissions and updates

### 8.2 Access Control

Access to Oracle functions is strictly limited:
- Multi-signature requirements for administrative functions
- Role separation between routine updates and administrative actions
- Time-locks for sensitive operations

### 8.3 Economic Security

The Oracle is designed to resist economic manipulation:
- No direct economic incentives for Oracle operators
- Transparent operation visible to all participants
- Administrative oversight of unusual patterns

### 8.4 Operational Security

Operational security measures include:
- Secure key management for submission wallets
- Regular security reviews of both contract and service
- Comprehensive logging and monitoring

## 9. Integration with Protocol

### 9.1 Win Percentage Consumption

Other protocol contracts consume Oracle data through:
- Direct contract calls to getTeamWinPct() function
- Event monitoring for TeamUpdated events
- Regular polling for up-to-date win percentages

### 9.2 Settlement Process

The Oracle provides authoritative data for:
- Daily funding payments based on current win percentages
- End-of-season settlement to final win percentages
- Dispute resolution in case of contested results

### 9.3 Frontend Integration

The frontend application will:
- Display current win percentages from Oracle
- Show recent game results affecting team performance
- Indicate last update time for transparency

## 10. Operational Procedures

### 10.1 Routine Operations

Day-to-day operations involve:
- Monitoring Score Sync Service execution
- Verifying successful on-chain updates
- Checking for data inconsistencies

### 10.2 Error Correction Process

When errors are identified:
1. Validate correct data against official sources
2. Document discrepancy and required correction
3. Submit correction via administrative function
4. Verify correction and emit notification

### 10.3 Emergency Procedures

In case of critical issues:
1. Pause Oracle (if necessary) to prevent incorrect data usage
2. Identify and document the issue
3. Develop and test correction approach
4. Implement fix and resume operation
5. Post-incident review and documentation

## 11. Future Enhancements

Potential future improvements to the Oracle system:

1. **Decentralized Validation**: Multiple independent data providers with consensus mechanism
2. **Economic Incentive Model**: Rewards for accurate and timely data provision
3. **Additional Sports**: Expand to basketball, football, and other sports
4. **Enhanced Statistics**: Provide additional team and player statistics
5. **Historical Analysis Tools**: Tooling for analyzing past performance patterns

## 12. Conclusion

The Baseball Oracle system provides the essential foundation for the Baseball Living Futures protocol by delivering accurate, timely, and transparent team performance data. By combining on-chain storage and computation with efficient off-chain data collection, the system achieves the reliability required for financial contracts while managing operational costs.

This design balances security, efficiency, and transparency to ensure fair and accurate protocol operation while maintaining resilience against both technical failures and potential manipulation attempts.

---

## Appendix A: MLB Team Identifiers

Standard team identifiers used in the Oracle system:

| Team ID | Name                    | Abbreviation |
|---------|-------------------------|--------------|
| NYY     | New York Yankees        | NYY          |
| BOS     | Boston Red Sox          | BOS          |
| TOR     | Toronto Blue Jays       | TOR          |
| BAL     | Baltimore Orioles       | BAL          |
| TB      | Tampa Bay Rays          | TB           |
| ...     | ...                     | ...          |

## Appendix B: Game Status Codes

Standardized game status values:

| Status Code | Description                             |
|-------------|-----------------------------------------|
| Final       | Game completed normally                 |
| Postponed   | Game postponed to later date           |
| Suspended   | Game suspended, to be resumed later    |
| Cancelled   | Game cancelled, will not be played     |
| Scheduled   | Game scheduled but not yet started     |
| InProgress  | Game currently in progress             |
| ...         | ...                                     |

## Appendix C: Glossary

- **Win Percentage**: Number of wins divided by total games, expressed on 0-1000 scale
- **Oracle**: System providing authoritative external data to smart contracts
- **Score Sync Service**: Off-chain service fetching and submitting game data
- **Double-Header**: Two games played between the same teams on the same day
- **Batch Submission**: Process of recording multiple game results in one transaction
