import { useEffect } from 'react'

export default function TechnicalGuide() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <article className="prose prose-lg max-w-none">
      <h1>Baseball Living Futures - Technical Implementation Guide</h1>
      
      <h2 id="system-architecture-overview">System Architecture Overview</h2>
      
      <p>
        Baseball Living Futures is a decentralized financial platform that allows users to trade season-long derivative contracts on baseball team performance. The system consists of three main components:
      </p>
      
      <ol>
        <li><strong>Smart Contracts</strong> (Base Blockchain)</li>
        <li><strong>Frontend Application</strong> (Cloudflare Pages)</li>
        <li><strong>Backend Services</strong> (Cloudflare Workers)</li>
      </ol>
      
      <p>
        This guide provides a high-level architecture overview and implementation roadmap for a Claude Code agent to build the complete system.
      </p>
      
      <h2 id="core-components-and-design-principles">Core Components and Design Principles</h2>
      
      <h3 id="smart-contract-architecture">Smart Contract Architecture</h3>
      
      <p>The system is built around these core smart contract modules:</p>
      
      <ol>
        <li><strong>Virtual AMM System</strong> ✅ IMPLEMENTED
          <ul>
            <li>Sigmoid-based price discovery: price = 500 + 500 * tanh(β * netImbalance)</li>
            <li>Bounded output range (0-1000) representing win percentages</li>
            <li>Position imbalance tracking without token swapping</li>
            <li>Integrated position management (open/close/modify/liquidate)</li>
            <li>Built-in liquidity management with LP tokens</li>
            <li>Real-time funding rate calculations</li>
            <li>Configurable parameters with governance controls</li>
          </ul>
        </li>
        
        <li><strong>Advanced Position Management</strong> ✅ LEVERAGE COMPLETE
          <ul>
            <li>✅ <strong>Leverage System:</strong> 1x-10x default (up to 100x max) configurable leverage with margin efficiency</li>
            <li>✅ <strong>Liquidation Management:</strong> Maintenance margin and liquidation price calculations</li>
            <li>✅ <strong>Risk Controls:</strong> Leverage validation and position health monitoring</li>
            <li>🚧 <strong>Future:</strong> Multi-position portfolio management and advanced order types</li>
          </ul>
        </li>
        
        <li><strong>Additional Liquidity Features</strong> 🚧 PENDING  
          <ul>
            <li>Cross-team shared liquidity pools</li>
            <li>Dynamic rebalancing mechanisms</li>
            <li>Excess profit distribution</li>
          </ul>
        </li>
        
        <li><strong>Risk Management</strong>
          <ul>
            <li>Insurance fund with staking mechanism</li>
            <li>Liquidation engine for underwater positions</li>
            <li>Circuit breakers and safety mechanisms</li>
          </ul>
        </li>
        
        <li><strong>Oracle System</strong>
          <ul>
            <li>Win percentage data feeds</li>
            <li>Game result recording</li>
            <li>End-of-season settlement</li>
            <li>Upgradeable proxy infrastructure</li>
            <li>Multi-source data validation</li>
          </ul>
        </li>
        
        <li><strong>Shared Liquidity Distribution</strong>
          <ul>
            <li>Cross-team liquidity allocation</li>
            <li>Equal distribution with dynamic rebalancing</li>
            <li>Excess profit handling</li>
          </ul>
        </li>
      </ol>
      
      <h3 id="oracle-system-architecture">Oracle System Architecture</h3>
      
      <p>The Oracle system provides authoritative baseball data to the protocol through a combination of on-chain and off-chain components:</p>
      
      <h4>On-Chain Oracle Contract</h4>
      
      <p>The Oracle smart contract manages:</p>
      
      <ol>
        <li><strong>Team Registry</strong>
          <ul>
            <li>Official team identifiers and metadata</li>
            <li>Win/loss records tracking</li>
            <li>Win percentage calculations (0-1000 scale)</li>
          </ul>
        </li>
        
        <li><strong>Game Repository</strong>
          <ul>
            <li>Game results storage with unique MLB IDs</li>
            <li>Team performance automatic updates</li>
            <li>Comprehensive event emissions for transparency</li>
          </ul>
        </li>
        
        <li><strong>Season Management</strong>
          <ul>
            <li>Season state tracking and transitions</li>
            <li>Start/end timestamp management</li>
            <li>Historical data preservation</li>
          </ul>
        </li>
        
        <li><strong>Administrative Functions</strong>
          <ul>
            <li>Error correction capabilities</li>
            <li>Role-based access control (ORACLE_ROLE, ADMIN_ROLE)</li>
            <li>Emergency pause functionality</li>
          </ul>
        </li>
      </ol>
      
      <h4>Off-Chain Score Sync Service</h4>
      
      <p>The Score Sync Service automates game data synchronization:</p>
      
      <ol>
        <li><strong>API Integration Layer</strong>
          <ul>
            <li>Primary MLB Stats API integration</li>
            <li>Backup data sources (ESPN, Baseball Reference)</li>
            <li>Rate limiting and error handling</li>
          </ul>
        </li>
        
        <li><strong>Data Processing</strong>
          <ul>
            <li>Data validation and format transformation</li>
            <li>Anomaly detection for unusual scores</li>
            <li>Cross-source verification</li>
          </ul>
        </li>
        
        <li><strong>Blockchain Interaction</strong>
          <ul>
            <li>Transaction management and gas optimization</li>
            <li>Batch submission capabilities</li>
            <li>Retry logic with exponential backoff</li>
          </ul>
        </li>
        
        <li><strong>Scheduling System</strong>
          <ul>
            <li>Multiple daily sync times (8 AM, 12 PM, 4 PM, 10 PM, 2 AM ET)</li>
            <li>Manual trigger capabilities</li>
            <li>Comprehensive monitoring and alerting</li>
          </ul>
        </li>
      </ol>
      
      <h4>Implementation Timeline</h4>
      
      <p>Oracle system development follows this schedule:</p>
      
      <ol>
        <li><strong>Week 1-2: Contract Development</strong>
          <ul>
            <li>Base Oracle contract with data structures</li>
            <li>Team registration and game recording</li>
            <li>Win percentage calculation logic</li>
            <li>Proxy implementation for upgradeability</li>
          </ul>
        </li>
        
        <li><strong>Week 3-4: Score Sync Service</strong>
          <ul>
            <li>MLB API client implementation</li>
            <li>Backup source integration</li>
            <li>Data transformation and validation</li>
            <li>Blockchain submission logic</li>
          </ul>
        </li>
        
        <li><strong>Week 5: Integration & Testing</strong>
          <ul>
            <li>End-to-end integration testing</li>
            <li>Security review and gas optimization</li>
            <li>Performance testing with historical data</li>
          </ul>
        </li>
        
        <li><strong>Week 6: Deployment & Operations</strong>
          <ul>
            <li>Mainnet contract deployment</li>
            <li>Service deployment to Cloudflare Workers</li>
            <li>Monitoring setup and documentation</li>
          </ul>
        </li>
      </ol>
      
      <h3 id="frontend-application">Frontend Application</h3>
      
      <p>The frontend will be a React application with these main features:</p>
      
      <ol>
        <li><strong>Trading Interface</strong>
          <ul>
            <li>Team selection and position management</li>
            <li>Price charts and win percentage data</li>
            <li>Funding rate information</li>
            <li>Position monitoring</li>
          </ul>
        </li>
        
        <li><strong>Liquidity Provision</strong>
          <ul>
            <li>Team-specific LP interface</li>
            <li>Shared liquidity pool interface</li>
            <li>APY tracking and fee visualization</li>
            <li>LP position management</li>
          </ul>
        </li>
        
        <li><strong>Insurance Staking</strong>
          <ul>
            <li>Staking interface with APY information</li>
            <li>Reward tracking and claims</li>
            <li>Risk disclosure and educational content</li>
          </ul>
        </li>
        
        <li><strong>Portfolio Dashboard</strong>
          <ul>
            <li>Unified view of all user positions</li>
            <li>PnL tracking and history</li>
            <li>Risk metrics</li>
          </ul>
        </li>
        
        <li><strong>Analytics</strong>
          <ul>
            <li>Market-wide statistics</li>
            <li>Team performance data</li>
            <li>Liquidity distribution visualization</li>
          </ul>
        </li>
      </ol>
      
      <h3 id="backend-services">Backend Services</h3>
      
      <p>Backend services handle data processing, scheduled tasks, and API endpoints:</p>
      
      <ol>
        <li><strong>API Endpoints</strong>
          <ul>
            <li>Historical price and volume data</li>
            <li>Team statistics and correlations</li>
            <li>User analytics and aggregated data</li>
          </ul>
        </li>
        
        <li><strong>Scheduled Tasks</strong>
          <ul>
            <li>Oracle update coordination</li>
            <li>Daily funding payments processing</li>
            <li>Liquidation monitoring</li>
            <li>Season transition handling</li>
          </ul>
        </li>
        
        <li><strong>Data Aggregation</strong>
          <ul>
            <li>Trade history collection</li>
            <li>APY calculations</li>
            <li>Protocol metrics</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="implementation-roadmap">Implementation Roadmap</h2>
      
      <p>The system will be built in phases with clear milestones:</p>
      
      <h3>Phase 1: Core Smart Contract Development (6-8 weeks)</h3>
      
      <ol>
        <li><strong>Framework Setup</strong> (Week 1)
          <ul>
            <li>Repository initialization</li>
            <li>Development environment configuration</li>
            <li>Testing framework setup</li>
          </ul>
        </li>
        
        <li><strong>Virtual AMM Implementation</strong> ✅ COMPLETE (December 2024)
          <ul>
            <li>✅ Implement sigmoid-based pricing algorithm with gas optimization</li>
            <li>✅ Build position imbalance tracking with virtual liquidity</li>
            <li>✅ Create configurable funding rate calculations</li>
            <li>✅ Integrate position lifecycle management</li>
            <li>✅ Add LP token system with fee distribution</li>
            <li>✅ Implement governance controls and parameter validation</li>
            <li>✅ Full leverage system (1x-10x) with PnL amplification</li>
            <li>✅ Liquidation price calculations and margin adequacy checks</li>
            <li>✅ Comprehensive test suite (79 passing tests including 20 leverage tests)</li>
          </ul>
        </li>
        
        {/* Continue with all phases... */}
      </ol>
      
      <h2 id="leverage-system-implementation">Leverage System Implementation</h2>
      
      <p>The leverage system is fully integrated into the VirtualAMM contract with the following architecture:</p>
      
      <h3>Core Components</h3>
      
      <ol>
        <li><strong>Enhanced Position Structure</strong>
          <ul>
            <li>Position struct includes leverage multiplier field</li>
            <li>Backward compatibility with existing position data</li>
            <li>Event emissions include leverage information</li>
          </ul>
        </li>
        
        <li><strong>Leverage Validation System</strong>
          <ul>
            <li>Configurable leverage bounds (1x minimum, 10x default, 100x absolute maximum)</li>
            <li>Admin controls for maximum leverage adjustments</li>
            <li>Input validation on position opening and quote generation</li>
          </ul>
        </li>
        
        <li><strong>Margin Calculation Engine</strong>
          <ul>
            <li>Required margin = (position notional × margin ratio) / leverage</li>
            <li>Maintenance margin = initial margin × 80% (configurable)</li>
            <li>Leveraged PnL calculation with amplification</li>
          </ul>
        </li>
        
        <li><strong>Liquidation Management</strong>
          <ul>
            <li>Dynamic liquidation price calculations</li>
            <li>Long liquidation: entry × (1 - maintenance ratio / leverage)</li>
            <li>Short liquidation: entry × (1 + maintenance ratio / leverage)</li>
            <li>Continuous margin adequacy monitoring</li>
          </ul>
        </li>
      </ol>
      
      <h3>API Changes</h3>
      
      <p>The leverage implementation extends existing functions:</p>
      
      <ol>
        <li><strong>Enhanced Functions</strong>
          <ul>
            <li><code>openPosition(trader, size, margin, leverage)</code> - now accepts leverage parameter</li>
            <li><code>getQuote(positionSize, leverage)</code> - leverage-aware quote generation</li>
            <li><code>getPositionValue(positionId)</code> - returns leverage-amplified PnL</li>
            <li><code>hasAdequateMargin(positionId)</code> - uses leverage-adjusted thresholds</li>
          </ul>
        </li>
        
        <li><strong>New Functions</strong>
          <ul>
            <li><code>getLiquidationPrice(positionId)</code> - calculates liquidation threshold</li>
            <li><code>getMaxLeverage(positionSize)</code> - returns maximum available leverage</li>
            <li><code>getLeverageParameters()</code> - returns current leverage configuration</li>
            <li><code>updateMaxLeverage(newMaxLeverage)</code> - admin function for leverage limits</li>
          </ul>
        </li>
        
        <li><strong>Backward Compatibility</strong>
          <ul>
            <li><code>getQuote(positionSize)</code> - defaults to 1x leverage</li>
            <li>Existing position management functions work unchanged</li>
            <li>Legacy integrations continue to function</li>
          </ul>
        </li>
      </ol>
      
      <h3>Mathematical Implementation</h3>
      
      <pre><code>{`// Core leverage calculations
requiredMargin = (positionValue * minMarginRatio) / leverage
leveragedPnL = basePnL * leverage
maintenanceMargin = requiredMargin * maintenanceRatio

// Liquidation price calculations
longLiquidationPrice = entryPrice * (1 - (maintenanceRatio * minMarginRatio) / leverage)
shortLiquidationPrice = entryPrice * (1 + (maintenanceRatio * minMarginRatio) / leverage)

// Margin adequacy check
equity = margin + leveragedPnL
isAdequate = equity >= maintenanceMargin`}</code></pre>
      
      <h3>Security Features</h3>
      
      <ol>
        <li><strong>Parameter Validation</strong>
          <ul>
            <li>Leverage bounds enforcement (MIN_LEVERAGE to maxLeverage)</li>
            <li>Maintenance ratio bounds (50% to 100%)</li>
            <li>Admin-only governance controls</li>
          </ul>
        </li>
        
        <li><strong>Risk Management</strong>
          <ul>
            <li>Automatic liquidation triggers</li>
            <li>Position health monitoring</li>
            <li>Dynamic leverage limits based on market conditions</li>
          </ul>
        </li>
        
        <li><strong>Testing Coverage</strong>
          <ul>
            <li>20 leverage-specific test cases</li>
            <li>Edge case coverage for maximum/minimum leverage</li>
            <li>Integration testing with existing AMM functionality</li>
            <li>Position lifecycle testing with leverage</li>
          </ul>
        </li>
      </ol>

      <h2 id="technical-specifications">Technical Specifications</h2>
      
      <h3>Blockchain</h3>
      
      <ul>
        <li><strong>Network:</strong> Base (Ethereum L2)</li>
        <li><strong>Language:</strong> Solidity v0.8.x</li>
        <li><strong>Testing:</strong> Hardhat, Foundry</li>
        <li><strong>Deployment:</strong> Hardhat, Ethers.js</li>
      </ul>
      
      <h3>Frontend</h3>
      
      <ul>
        <li><strong>Framework:</strong> React 18+</li>
        <li><strong>State Management:</strong> React Query, Context API</li>
        <li><strong>Styling:</strong> Tailwind CSS</li>
        <li><strong>Web3 Integration:</strong> wagmi, ethers.js</li>
        <li><strong>Hosting:</strong> Cloudflare Pages</li>
      </ul>
      
      <h3>Backend</h3>
      
      <ul>
        <li><strong>Services:</strong> Cloudflare Workers</li>
        <li><strong>Scheduled Tasks:</strong> Cloudflare Workers with Cron Triggers</li>
        <li><strong>Data Storage:</strong> KV Store, D1 (Cloudflare SQLite)</li>
        <li><strong>Monitoring:</strong> Cloudflare Analytics</li>
      </ul>
      
      <h2 id="smart-contract-interaction-flow">Smart Contract Interaction Flow</h2>
      
      <ol>
        <li><strong>Trading Flow</strong>
          <ul>
            <li>User connects wallet</li>
            <li>Selects team and position type (long/short)</li>
            <li>Enters size, margin, and leverage multiplier (1x-10x default, up to 100x max)</li>
            <li>System calculates required margin based on leverage</li>
            <li>Approves token spend</li>
            <li>Submits transaction with leverage parameter</li>
            <li>Position is opened with leverage-adjusted price impact</li>
            <li>Daily funding applies (amplified by leverage, if sufficient margin)</li>
            <li>User can close, be liquidated for maintenance margin, or force-closed for funding failure</li>
          </ul>
        </li>
        
        <li><strong>Liquidity Provision Flow</strong>
          <ul>
            <li>User selects team-specific or shared liquidity</li>
            <li>Deposits collateral</li>
            <li>Receives LP shares</li>
            <li>Collateral is distributed to teams (if shared)</li>
            <li>Fees accrue based on trading activity</li>
            <li>LPs can withdraw with accrued rewards</li>
          </ul>
        </li>
        
        <li><strong>Insurance Staking Flow</strong>
          <ul>
            <li>User deposits collateral to insurance fund</li>
            <li>Receives shares of fund</li>
            <li>Earns from trading fees and liquidations</li>
            <li>Rate varies based on protocol activity (0% in off-season)</li>
            <li>Can unstake and withdraw when needed</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="scheduled-tasks-architecture">Scheduled Tasks Architecture</h2>
      
      <p>These critical operations will run as scheduled Cloudflare Workers:</p>
      
      <ol>
        <li><strong>Oracle Updates</strong> (5 times daily: 8 AM, 12 PM, 4 PM, 10 PM, 2 AM ET)
          <ul>
            <li>Fetch game results from MLB Stats API (primary source)</li>
            <li>Validate data against backup sources (ESPN, Baseball Reference)</li>
            <li>Update on-chain win percentages with batch submissions</li>
            <li>Record game outcomes with MLB game IDs</li>
            <li>Handle special cases (double-headers, postponements)</li>
            <li>Emit events for transparency and monitoring</li>
          </ul>
        </li>
        
        <li><strong>Funding Payments</strong> (Daily at 2:00 AM ET)
          <ul>
            <li>Calculate funding based on price vs. win%</li>
            <li>Process payments between longs and shorts</li>
            <li>Force-close positions unable to pay funding obligations</li>
            <li>Update remaining positions and LP pool balances</li>
          </ul>
        </li>
        
        <li><strong>Liquidation Monitoring</strong> (Every 5 minutes)
          <ul>
            <li>Check all positions against maintenance margin</li>
            <li>Monitor position funding payment capabilities</li>
            <li>Flag positions for liquidation</li>
            <li>Execute liquidations for underwater positions</li>
            <li>Handle funding-related position closures</li>
          </ul>
        </li>
        
        <li><strong>LP Reward Distribution</strong> (Daily)
          <ul>
            <li>Calculate fees earned by LPs</li>
            <li>Update accrued rewards</li>
            <li>Process distribution to shared LP</li>
          </ul>
        </li>
        
        <li><strong>Excess Profit Distribution</strong> (Weekly)
          <ul>
            <li>Calculate system excess profit</li>
            <li>Allocate to shared LP as specified</li>
            <li>Update profit metrics</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="development-best-practices">Development Best Practices</h2>
      
      <ol>
        <li><strong>Smart Contract Security</strong>
          <ul>
            <li>Use established patterns and libraries (OpenZeppelin)</li>
            <li>Comprehensive test coverage (&gt;95%)</li>
            <li>Formal verification for critical functions</li>
            <li>Multiple audit rounds</li>
          </ul>
        </li>
        
        <li><strong>Frontend Performance</strong>
          <ul>
            <li>Optimize bundle size</li>
            <li>Lazy loading for routes</li>
            <li>Memoization for expensive calculations</li>
            <li>Efficient rendering patterns</li>
          </ul>
        </li>
        
        <li><strong>Backend Reliability</strong>
          <ul>
            <li>Error handling and retry logic</li>
            <li>Graceful degradation</li>
            <li>Comprehensive logging</li>
            <li>Fallback mechanisms</li>
          </ul>
        </li>
        
        <li><strong>DevOps</strong>
          <ul>
            <li>CI/CD pipeline with GitHub Actions</li>
            <li>Environment separation (dev/staging/prod)</li>
            <li>Infrastructure as code</li>
            <li>Automated testing on PRs</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="implementation-guidance">Implementation Guidance for Claude Code Agent</h2>
      
      <p>When implementing this system, follow these guidelines:</p>
      
      <ol>
        <li><strong>Start with Core Contracts</strong>
          <ul>
            <li>Begin with the Virtual AMM - this is the foundation</li>
            <li>Build position management next</li>
            <li>Add liquidity management</li>
            <li>Implement risk systems last</li>
          </ul>
        </li>
        
        <li><strong>Modular Development</strong>
          <ul>
            <li>Each contract should have a single responsibility</li>
            <li>Use inheritance and composition carefully</li>
            <li>Create interfaces for cross-contract communication</li>
            <li>Favor libraries for reusable code</li>
          </ul>
        </li>
        
        <li><strong>Testing Strategy</strong>
          <ul>
            <li>Unit tests for each function</li>
            <li>Integration tests for contract interactions</li>
            <li>Scenario tests for complex flows</li>
            <li>Fuzz testing for edge cases</li>
          </ul>
        </li>
        
        <li><strong>Frontend Architecture</strong>
          <ul>
            <li>Component-based design</li>
            <li>Custom hooks for contract interactions</li>
            <li>Centralized state management</li>
            <li>Responsive design patterns</li>
          </ul>
        </li>
        
        <li><strong>Worker Implementation</strong>
          <ul>
            <li>Separate worker for each scheduled task</li>
            <li>Shared utility libraries</li>
            <li>Comprehensive error handling</li>
            <li>Monitoring and logging</li>
          </ul>
        </li>
      </ol>
      
      <p>
        By following this architecture and roadmap, the Baseball Living Futures platform can be built as a robust, secure, and user-friendly system that delivers the innovative features outlined in the whitepaper.
      </p>
    </article>
  )
}