import { useEffect } from 'react'

export default function OracleDesign() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <article className="prose prose-lg max-w-none">
      <h1>Baseball Oracle System Design Document</h1>
      
      <h2 id="introduction">1. Introduction</h2>
      
      <p>
        The Baseball Oracle is a critical component of the Baseball Living Futures platform that provides authoritative team performance data to the protocol. This document explains the design philosophy, architectural decisions, and implementation plan for the Oracle system, consisting of both on-chain smart contracts and off-chain data services.
      </p>
      
      <h3 id="system-purpose">1.1 System Purpose</h3>
      
      <p>The Oracle serves several essential functions:</p>
      <ul>
        <li>Record official baseball game results with accurate timestamps</li>
        <li>Calculate and maintain up-to-date team win percentages</li>
        <li>Provide authoritative data for protocol settlement and daily funding</li>
        <li>Maintain a transparent, auditable history of game outcomes</li>
        <li>Enable administrative correction in case of errors or disputes</li>
      </ul>
      
      <h3 id="design-principles">1.2 Design Principles</h3>
      
      <p>The Oracle system follows these core design principles:</p>
      
      <ol>
        <li><strong>Accuracy</strong>: Data correctness is paramount to maintain protocol integrity</li>
        <li><strong>Timeliness</strong>: Data updates must occur promptly to enable proper market function</li>
        <li><strong>Transparency</strong>: All game results and calculation methods must be fully auditable</li>
        <li><strong>Resilience</strong>: System must continue to function despite data source or network issues</li>
        <li><strong>Efficiency</strong>: Gas and operational costs should be minimized where possible</li>
        <li><strong>Security</strong>: Only authorized parties should be able to update game results</li>
      </ol>
      
      <h2 id="data-requirements">2. Data Requirements</h2>
      
      <h3 id="data-sources-evaluation">2.1 Data Sources Evaluation</h3>
      
      <p>After evaluating multiple baseball data sources, we selected the following for our Oracle implementation:</p>
      
      <h4>Primary Source: MLB Stats API</h4>
      <ul>
        <li><strong>URL</strong>: <code>https://statsapi.mlb.com/api/v1/</code></li>
        <li><strong>Selection Rationale</strong>: Official MLB data source with highest authoritativeness</li>
        <li><strong>Key Advantages</strong>:
          <ul>
            <li>Comprehensive game information (scores, status, times)</li>
            <li>Detailed team statistics</li>
            <li>Most authoritative source for MLB data</li>
          </ul>
        </li>
        <li><strong>Considerations</strong>:
          <ul>
            <li>May require licensing for production use</li>
            <li>Rate limits could apply</li>
          </ul>
        </li>
      </ul>
      
      <h4>Backup Sources:</h4>
      <ol>
        <li><strong>ESPN API</strong>
          <ul>
            <li>Provides rapid score updates, sometimes faster than MLB API</li>
            <li>Good alternative data source for verification</li>
          </ul>
        </li>
        
        <li><strong>Baseball Reference</strong>
          <ul>
            <li>Contains comprehensive historical data</li>
            <li>Useful for verification and historical record correction</li>
          </ul>
        </li>
        
        <li><strong>The Sports DB</strong>
          <ul>
            <li>Provides a free alternative API</li>
            <li>Less comprehensive but serves as tertiary fallback</li>
          </ul>
        </li>
      </ol>
      
      <p>The use of multiple data sources enhances system reliability by allowing cross-validation and failover options.</p>
      
      <h3 id="required-data-points">2.2 Required Data Points</h3>
      
      <p>For each baseball game, the Oracle must record:</p>
      
      <ol>
        <li><strong>Game Identification</strong>:
          <ul>
            <li>Unique game identifier (using MLB's game ID system)</li>
            <li>Season identifier</li>
            <li>Game date and time</li>
            <li>Home and away team identifiers</li>
          </ul>
        </li>
        
        <li><strong>Game Results</strong>:
          <ul>
            <li>Final score (home and away)</li>
            <li>Game status (final, postponed, suspended, etc.)</li>
            <li>Time when game ended</li>
            <li>Time when result was recorded on-chain</li>
          </ul>
        </li>
        
        <li><strong>Team Performance Metrics</strong>:
          <ul>
            <li>Win/loss record</li>
            <li>Win percentage (expressed as 0-1000, where 500 = .500)</li>
            <li>Last game timestamp</li>
          </ul>
        </li>
      </ol>
      
      <p>This data structure accommodates special cases like double-headers (via unique game IDs) and postponed games (via status tracking).</p>
      
      <h2 id="system-architecture">3. System Architecture</h2>
      
      <p>The Baseball Oracle consists of two main components:</p>
      
      <ol>
        <li><strong>On-Chain Oracle Contract</strong>: Smart contract storing official game results and team statistics</li>
        <li><strong>Off-Chain Score Sync Service</strong>: Service that fetches game data and submits it to the blockchain</li>
      </ol>
      
      <h3 id="oracle-contract-architecture">3.1 Oracle Contract Architecture</h3>
      
      <p>The Oracle contract is designed as an upgradeable contract with the following key components:</p>
      
      <pre><code>{`BaseballOracle
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
    └── Emergency controls`}</code></pre>
      
      <h3 id="score-sync-service-architecture">3.2 Score Sync Service Architecture</h3>
      
      <p>The Score Sync Service follows a modular design:</p>
      
      <pre><code>{`Score Sync Service
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
    └── Monitoring and alerting`}</code></pre>
      
      <h2 id="implementation-plan">7. Implementation Plan</h2>
      
      <p>The Oracle system will be implemented in these phases:</p>
      
      <h3>Phase 1: Contract Development (2 weeks)</h3>
      <ol>
        <li><strong>Week 1</strong>: Develop base Oracle contract with data structures and core functions
          <ul>
            <li>Implement team registration</li>
            <li>Develop game recording functionality</li>
            <li>Build win percentage calculation</li>
          </ul>
        </li>
        
        <li><strong>Week 2</strong>: Implement administrative and security features
          <ul>
            <li>Add role-based access control</li>
            <li>Develop error correction functions</li>
            <li>Implement upgradeability pattern</li>
            <li>Comprehensive test suite</li>
          </ul>
        </li>
      </ol>
      
      <h3>Phase 2: Score Sync Service (2 weeks)</h3>
      <ol>
        <li><strong>Week 1</strong>: Build API integration and data processing
          <ul>
            <li>Implement MLB API client</li>
            <li>Develop backup source clients</li>
            <li>Create data transformation logic</li>
          </ul>
        </li>
        
        <li><strong>Week 2</strong>: Develop blockchain interaction and scheduling
          <ul>
            <li>Build transaction submission logic</li>
            <li>Implement error handling and retries</li>
            <li>Create scheduling and monitoring system</li>
            <li>Dockerize service for deployment</li>
          </ul>
        </li>
      </ol>
      
      <h3>Phase 3: Testing and Integration (1 week)</h3>
      <ol>
        <li><strong>Days 1-3</strong>: Conduct integration testing
          <ul>
            <li>Test contract with live testnet</li>
            <li>Verify data flow from API to blockchain</li>
            <li>Validate win percentage calculations</li>
          </ul>
        </li>
        
        <li><strong>Days 4-5</strong>: Security review and optimizations
          <ul>
            <li>Audit access controls</li>
            <li>Optimize gas usage</li>
            <li>Review error handling</li>
          </ul>
        </li>
      </ol>
      
      <h3>Phase 4: Deployment and Monitoring (1 week)</h3>
      <ol>
        <li><strong>Days 1-2</strong>: Mainnet deployment
          <ul>
            <li>Deploy Oracle contract</li>
            <li>Set up admin roles and permissions</li>
            <li>Register teams and initial data</li>
          </ul>
        </li>
        
        <li><strong>Days 3-5</strong>: Operational setup
          <ul>
            <li>Deploy Score Sync Service</li>
            <li>Establish monitoring and alerts</li>
            <li>Document operational procedures</li>
          </ul>
        </li>
      </ol>
      
      <h3>Phase 5: Documentation and Knowledge Transfer (1 week)</h3>
      <ol>
        <li><strong>Days 1-3</strong>: Technical documentation
          <ul>
            <li>Complete code documentation</li>
            <li>Develop operational runbooks</li>
            <li>Create troubleshooting guides</li>
          </ul>
        </li>
        
        <li><strong>Days 4-5</strong>: User-facing documentation
          <ul>
            <li>Explain Oracle system to protocol users</li>
            <li>Document data sources and methodology</li>
            <li>Create transparency reports</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="security-considerations">8. Security Considerations</h2>
      
      <h3 id="data-integrity">8.1 Data Integrity</h3>
      
      <p>Ensuring data integrity is paramount for the Oracle:</p>
      <ul>
        <li>Multiple source verification where possible</li>
        <li>Anomaly detection for unusual scores or win percentages</li>
        <li>Clear audit trail of all submissions and updates</li>
      </ul>
      
      <h3 id="access-control">8.2 Access Control</h3>
      
      <p>Access to Oracle functions is strictly limited:</p>
      <ul>
        <li>Multi-signature requirements for administrative functions</li>
        <li>Role separation between routine updates and administrative actions</li>
        <li>Time-locks for sensitive operations</li>
      </ul>
      
      <h3 id="economic-security">8.3 Economic Security</h3>
      
      <p>The Oracle is designed to resist economic manipulation:</p>
      <ul>
        <li>No direct economic incentives for Oracle operators</li>
        <li>Transparent operation visible to all participants</li>
        <li>Administrative oversight of unusual patterns</li>
      </ul>
      
      <h3 id="operational-security">8.4 Operational Security</h3>
      
      <p>Operational security measures include:</p>
      <ul>
        <li>Secure key management for submission wallets</li>
        <li>Regular security reviews of both contract and service</li>
        <li>Comprehensive logging and monitoring</li>
      </ul>
      
      <h2 id="integration-with-protocol">9. Integration with Protocol</h2>
      
      <h3 id="win-percentage-consumption">9.1 Win Percentage Consumption</h3>
      
      <p>Other protocol contracts consume Oracle data through:</p>
      <ul>
        <li>Direct contract calls to getTeamWinPct() function</li>
        <li>Event monitoring for TeamUpdated events</li>
        <li>Regular polling for up-to-date win percentages</li>
      </ul>
      
      <h3 id="settlement-process">9.2 Settlement Process</h3>
      
      <p>The Oracle provides authoritative data for:</p>
      <ul>
        <li>Daily funding payments based on current win percentages</li>
        <li>End-of-season settlement to final win percentages</li>
        <li>Dispute resolution in case of contested results</li>
      </ul>
      
      <h3 id="frontend-integration">9.3 Frontend Integration</h3>
      
      <p>The frontend application will:</p>
      <ul>
        <li>Display current win percentages from Oracle</li>
        <li>Show recent game results affecting team performance</li>
        <li>Indicate last update time for transparency</li>
      </ul>
      
      <h2 id="operational-procedures">10. Operational Procedures</h2>
      
      <h3 id="routine-operations">10.1 Routine Operations</h3>
      
      <p>Day-to-day operations involve:</p>
      <ul>
        <li>Monitoring Score Sync Service execution</li>
        <li>Verifying successful on-chain updates</li>
        <li>Checking for data inconsistencies</li>
      </ul>
      
      <h3 id="error-correction-process">10.2 Error Correction Process</h3>
      
      <p>When errors are identified:</p>
      <ol>
        <li>Validate correct data against official sources</li>
        <li>Document discrepancy and required correction</li>
        <li>Submit correction via administrative function</li>
        <li>Verify correction and emit notification</li>
      </ol>
      
      <h3 id="emergency-procedures">10.3 Emergency Procedures</h3>
      
      <p>In case of critical issues:</p>
      <ol>
        <li>Pause Oracle (if necessary) to prevent incorrect data usage</li>
        <li>Identify and document the issue</li>
        <li>Develop and test correction approach</li>
        <li>Implement fix and resume operation</li>
        <li>Post-incident review and documentation</li>
      </ol>
      
      <h2 id="future-enhancements">11. Future Enhancements</h2>
      
      <p>Potential future improvements to the Oracle system:</p>
      
      <ol>
        <li><strong>Decentralized Validation</strong>: Multiple independent data providers with consensus mechanism</li>
        <li><strong>Economic Incentive Model</strong>: Rewards for accurate and timely data provision</li>
        <li><strong>Additional Sports</strong>: Expand to basketball, football, and other sports</li>
        <li><strong>Enhanced Statistics</strong>: Provide additional team and player statistics</li>
        <li><strong>Historical Analysis Tools</strong>: Tooling for analyzing past performance patterns</li>
      </ol>
      
      <h2 id="conclusion">12. Conclusion</h2>
      
      <p>
        The Baseball Oracle system provides the essential foundation for the Baseball Living Futures protocol by delivering accurate, timely, and transparent team performance data. By combining on-chain storage and computation with efficient off-chain data collection, the system achieves the reliability required for financial contracts while managing operational costs.
      </p>
      
      <p>
        This design balances security, efficiency, and transparency to ensure fair and accurate protocol operation while maintaining resilience against both technical failures and potential manipulation attempts.
      </p>
    </article>
  )
}