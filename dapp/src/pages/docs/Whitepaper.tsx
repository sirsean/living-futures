import { useEffect } from 'react'

export default function Whitepaper() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <article className="prose prose-lg max-w-none">
      <h1>Baseball Living Futures: A Dynamic Derivatives Market for Team Performance</h1>
      
      <h2 id="executive-summary">Executive Summary</h2>
      
      <p>
        Baseball Living Futures introduces a novel financial product that combines the best aspects of futures and perpetual contracts to create a dynamic, season-long derivatives market for baseball team performance. The system enables traders to take positions on team win percentages with daily funding payments anchoring prices to reality, while providing forced settlement at season end. This whitepaper outlines the complete ecosystem design, from contract mechanics to liquidity provision and risk management systems.
      </p>
      
      <p><strong>Key Innovations:</strong></p>
      
      <ul>
        <li><strong>Living Futures:</strong> Season-long contracts with daily funding that reflect team performance</li>
        <li><strong>Virtual AMM:</strong> Sigmoid-based price discovery mechanism with bounded outcomes</li>
        <li><strong>Multi-Level Liquidity:</strong> Team-specific and shared liquidity pools with dynamic incentives</li>
        <li><strong>Risk Management:</strong> Comprehensive insurance system with zero-base rate staking</li>
        <li><strong>System Sustainability:</strong> Revenue-driven architecture with excess profit redistribution</li>
      </ul>
      
      <p>
        This project bridges traditional sports betting and decentralized finance, creating an entirely new market for sports derivatives that benefits traders, LPs, insurance providers, and the broader ecosystem.
      </p>
      
      <h2>Table of Contents</h2>
      
      <ol>
        <li><a href="#market-overview">Market Overview</a></li>
        <li><a href="#living-futures-mechanics">Living Futures Mechanics</a></li>
        <li><a href="#virtual-amm-design">Virtual AMM Design</a></li>
        <li><a href="#liquidity-provision-system">Liquidity Provision System</a></li>
        <li><a href="#risk-management-insurance">Risk Management & Insurance</a></li>
        <li><a href="#oracle-infrastructure">Oracle Infrastructure</a></li>
        <li><a href="#tokenomics-governance">Tokenomics & Governance</a></li>
        <li><a href="#implementation-roadmap">Implementation Roadmap</a></li>
        <li><a href="#technical-architecture">Technical Architecture</a></li>
        <li><a href="#legal-compliance">Legal & Compliance Considerations</a></li>
      </ol>
      
      <h2 id="market-overview">Market Overview</h2>
      
      <h3 id="problem-statement">Problem Statement</h3>
      
      <p>Traditional sports betting markets suffer from:</p>
      <ul>
        <li>Limited position management (no ability to exit early)</li>
        <li>Poor price discovery (bookmaker-controlled)</li>
        <li>High fees (often 5-10% implied vig)</li>
        <li>Limited composability with broader financial ecosystem</li>
      </ul>
      
      <p>Meanwhile, cryptocurrency perpetual futures have demonstrated the power of:</p>
      <ul>
        <li>Continuous trading with 24/7 markets</li>
        <li>Price anchoring through funding mechanisms</li>
        <li>Capital efficiency through leverage</li>
        <li>Deep liquidity through AMM models</li>
      </ul>
      
      <p>Baseball Living Futures bridges these worlds, applying DeFi innovation to sports markets.</p>
      
      <h3 id="target-users">Target Users</h3>
      
      <ol>
        <li><strong>Traders:</strong>
          <ul>
            <li>Sports enthusiasts seeking more sophisticated trading tools</li>
            <li>DeFi traders looking for new non-correlated markets</li>
            <li>Arbitrageurs exploiting inefficiencies between traditional and crypto markets</li>
          </ul>
        </li>
        
        <li><strong>Liquidity Providers:</strong>
          <ul>
            <li>Yield-seeking investors looking for non-correlated returns</li>
            <li>Market makers experienced in sports markets</li>
            <li>Diversified LPs who want balanced exposure across teams</li>
          </ul>
        </li>
        
        <li><strong>Insurance Stakers:</strong>
          <ul>
            <li>Risk-tolerant capital providers seeking higher yields</li>
            <li>Protocol supporters who want to strengthen the ecosystem</li>
            <li>Institutions looking for uncorrelated insurance premium income</li>
          </ul>
        </li>
      </ol>
      
      <h2 id="living-futures-mechanics">Living Futures Mechanics</h2>
      
      <h3 id="core-concept">Core Concept</h3>
      
      <p>Living Futures are season-long derivative contracts tracking team win percentages with:</p>
      
      <ol>
        <li><strong>Underlying Asset:</strong> Team Win Percentage × 1000 (range: 0-1000)</li>
        <li><strong>Contract Size:</strong> $100 per point</li>
        <li><strong>Daily Funding:</strong> (Contract Price - Current Win %) × 0.05%</li>
        <li><strong>Settlement:</strong> Cash-settled to final regular season win %</li>
        <li><strong>Expiration:</strong> Day after regular season ends</li>
      </ol>
      
      <h3 id="example-contract-lifecycle">Example Contract Lifecycle</h3>
      
      <pre><code>{`Yankees Opening Day:
- Initial price: 500 (implied .500 win %)
- Initial contract value: $50,000

Mid-Season (Team at .620):
- Current price: 615
- Daily funding: (615 - 620) × 0.05% = -0.25%
  Longs receive, shorts pay
- Contract value: $61,500

End of Season (Final .595):
- Settlement price: 595
- Final settlement value: $59,500`}</code></pre>
      
      <h3 id="position-management">Position Management</h3>
      
      <p>Traders can:</p>
      <ul>
        <li>Open long/short positions with leverage</li>
        <li>Close positions at any time</li>
        <li>Receive/pay daily funding</li>
        <li>Hold until settlement</li>
        <li>Get automatically liquidated if margin falls below maintenance level</li>
      </ul>
      
      <h3 id="key-benefits">Key Benefits</h3>
      
      <ul>
        <li><strong>Natural Convergence:</strong> Funding mechanism drives price toward actual win percentage</li>
        <li><strong>Position Flexibility:</strong> Enter, exit, or adjust position size throughout season</li>
        <li><strong>Price Discovery:</strong> Market-driven prices reflecting collective intelligence</li>
        <li><strong>Capital Efficiency:</strong> Leverage allows efficient capital deployment</li>
      </ul>
      
      <h2 id="virtual-amm-design">Virtual AMM Design</h2>
      
      <h3 id="price-discovery-mechanism">Price Discovery Mechanism</h3>
      
      <p>The system uses a sigmoid-based virtual AMM:</p>
      
      <pre><code>{`price = 500 + 500 * tanh(B * netPositionImbalance)

where:
- price is bounded between 0 and 1000
- B is a sensitivity parameter (controls curve steepness)
- netPositionImbalance = (longPositions - shortPositions) / totalLiquidity`}</code></pre>
      
      <p>This creates:</p>
      <ul>
        <li><strong>Natural Bounds:</strong> Prices constrained to win percentage range (0-1000)</li>
        <li><strong>Resistance at Extremes:</strong> Increasingly difficult to push price near boundaries</li>
        <li><strong>Increasing Impact:</strong> Deeper price impact with larger imbalances</li>
      </ul>
      
      <h3 id="virtual-liquidity">Virtual Liquidity</h3>
      
      <p>Unlike traditional AMMs with actual token swapping:</p>
      <ul>
        <li><strong>Virtual Balances:</strong> Track position imbalances without physical tokens</li>
        <li><strong>LP Counter-Position:</strong> LPs effectively take opposite side of net trader position</li>
        <li><strong>No Impermanent Loss:</strong> Bounded range with known settlement eliminates IL risk</li>
      </ul>
      
      <h3 id="oracle-integration">Oracle Integration</h3>
      
      <ul>
        <li>Live game results update win percentages via a robust oracle system</li>
        <li>Oracle publishes daily win % for each team</li>
        <li>Funding calculations use oracle-verified data</li>
        <li>End-of-season settlement uses final oracle-verified win %</li>
      </ul>

      <h2 id="liquidity-provision-system">Liquidity Provision System</h2>
      
      <h3 id="team-specific-liquidity">Team-Specific Liquidity</h3>
      
      <p>LPs can provide liquidity to specific teams:</p>
      
      <ul>
        <li><strong>Deposit:</strong> Collateral allocated to specific team's virtual AMM</li>
        <li><strong>Returns:</strong> Trading fees + funding payments + liquidation income</li>
        <li><strong>APY Source:</strong> Purely from market activity, no emissions</li>
        <li><strong>Team-Specific Fee Multipliers:</strong> Dynamic based on liquidity needs</li>
      </ul>
      
      <h3 id="shared-liquidity-distribution">Shared Liquidity Distribution</h3>
      
      <p>Meta-liquidity pool for ecosystem-wide exposure:</p>
      
      <ul>
        <li><strong>Equal Distribution:</strong> Deposits spread evenly across all teams initially</li>
        <li><strong>Dynamic Rebalancing:</strong> Periodically reallocates to underserved teams</li>
        <li><strong>Exposure:</strong> Single position provides diversified market exposure</li>
        <li><strong>Simplified UX:</strong> One deposit instead of 30 separate positions</li>
      </ul>
      
      <h3 id="excess-profit-utilization">Excess Profit Utilization</h3>
      
      <ul>
        <li>50% of excess profit adds to shared LP (owned by protocol)</li>
        <li>50% distributed to existing shared LP providers</li>
        <li>Creates perfect alignment between protocol success and LP returns</li>
      </ul>
      
      <h3 id="liquidity-incentives">Liquidity Incentives</h3>
      
      <ul>
        <li><strong>Volume-Based:</strong> Higher APY for teams with more trading activity</li>
        <li><strong>Need-Based:</strong> Increased multipliers for teams with liquidity shortages</li>
        <li><strong>Balanced Portfolio Bonus:</strong> Rewards for supporting multiple teams</li>
        <li><strong>Seasonal Dynamics:</strong> APY during season, 0% during off-season</li>
      </ul>

      <h2 id="risk-management-insurance">Risk Management & Insurance</h2>
      
      <h3 id="insurance-fund">Insurance Fund</h3>
      
      <ul>
        <li><strong>Purpose:</strong> Protect system from bad debt from liquidations</li>
        <li><strong>Structure:</strong> Per-team allocations within global fund</li>
        <li><strong>Funding Sources:</strong> Trading fees, liquidation penalties</li>
        <li><strong>Utilization:</strong> Covers liquidation shortfalls if trader margin insufficient</li>
      </ul>
      
      <h3 id="insurance-staking">Insurance Staking</h3>
      
      <ul>
        <li><strong>Mechanism:</strong> Users stake collateral to grow insurance fund</li>
        <li><strong>Returns:</strong> Share of trading fees + liquidation penalties</li>
        <li><strong>APY Source:</strong> Pure protocol revenue, 0% base rate</li>
        <li><strong>Seasonal Dynamics:</strong> 0% APY during off-season</li>
      </ul>
      
      <h3 id="liquidation-process">Liquidation Process</h3>
      
      <ul>
        <li><strong>Threshold:</strong> Maintenance margin requirement based on position size</li>
        <li><strong>Process:</strong> Positions liquidated when equity below maintenance</li>
        <li><strong>Incentives:</strong> Liquidators receive fee for successful liquidations</li>
        <li><strong>Shortfall Handling:</strong> Insurance fund covers underwater positions</li>
      </ul>
      
      <h3 id="circuit-breakers">Circuit Breakers</h3>
      
      <ul>
        <li><strong>Price Limits:</strong> Maximum move per day on each contract</li>
        <li><strong>Emergency Mode:</strong> Ability to pause new positions in extreme conditions</li>
        <li><strong>Deleveraging:</strong> Automatic position reduction if system risks exceed thresholds</li>
      </ul>

      <h2 id="oracle-infrastructure">Oracle Infrastructure</h2>
      
      <h3 id="data-sources">Data Sources</h3>
      
      <ul>
        <li><strong>Primary:</strong> Official MLB game results</li>
        <li><strong>Backup:</strong> Multiple data providers for redundancy</li>
        <li><strong>Validation:</strong> Consensus mechanism across data sources</li>
      </ul>
      
      <h3 id="update-mechanism">Update Mechanism</h3>
      
      <ul>
        <li><strong>Game Results:</strong> Real-time updates after each game</li>
        <li><strong>Win Percentage:</strong> Calculated after each game conclusion</li>
        <li><strong>Settlement Data:</strong> Final regular season records</li>
      </ul>
      
      <h3 id="node-operations">Node Operations</h3>
      
      <ul>
        <li><strong>Decentralized Network:</strong> Multiple oracle nodes</li>
        <li><strong>Consensus Requirement:</strong> 2/3 majority for updates</li>
        <li><strong>Dispute Resolution:</strong> Governance mechanism for edge cases</li>
      </ul>
      
      <h2 id="tokenomics-governance">Tokenomics & Governance</h2>
      
      <h3 id="fee-structure">Fee Structure</h3>
      
      <ul>
        <li><strong>Trading Fee:</strong> 0.3% of position value</li>
        <li><strong>Distribution:</strong>
          <ul>
            <li>60% to LPs</li>
            <li>20% to Insurance Fund</li>
            <li>10% to Protocol Treasury</li>
            <li>10% to Insurance Stakers</li>
          </ul>
        </li>
      </ul>
      
      <h3 id="governance-framework">Governance Framework</h3>
      
      <ul>
        <li><strong>Key Decisions:</strong>
          <ul>
            <li>Fee parameter adjustments</li>
            <li>Oracle network management</li>
            <li>Insurance fund parameters</li>
            <li>Excess profit allocation</li>
          </ul>
        </li>
      </ul>
      
      <h3 id="treasury-allocation">Treasury Allocation</h3>
      
      <ul>
        <li><strong>Development:</strong> Protocol improvements and new features</li>
        <li><strong>Security:</strong> Audits and bug bounties</li>
        <li><strong>Legal:</strong> Compliance and regulatory engagement</li>
        <li><strong>Growth:</strong> Marketing and ecosystem development</li>
      </ul>
      
      <h2 id="implementation-roadmap">Implementation Roadmap</h2>
      
      <h3>Phase 1: Foundation (Q3 2025)</h3>
      
      <ul>
        <li>Smart contract development for core protocol</li>
        <li>Virtual AMM implementation</li>
        <li>Basic trading interface</li>
        <li>Testnet deployment with simulated data</li>
      </ul>
      
      <h3>Phase 2: Mainnet Launch (Q1 2026)</h3>
      
      <ul>
        <li>Audit completion and security review</li>
        <li>Base network deployment</li>
        <li>Oracle infrastructure establishment</li>
        <li>Initial liquidity bootstrapping</li>
      </ul>
      
      <h3>Phase 3: Expansion (Q2-Q3 2026)</h3>
      
      <ul>
        <li>Additional sports integration (basketball, football)</li>
        <li>Enhanced analytics and trading tools</li>
        <li>Liquidity mining program</li>
        <li>Mobile application</li>
      </ul>
      
      <h3>Phase 4: Ecosystem Growth (Q4 2026 onward)</h3>
      
      <ul>
        <li>Institutional API access</li>
        <li>Cross-chain deployment</li>
        <li>Governance implementation</li>
        <li>Derivatives and structured products</li>
      </ul>
      
      <h2 id="technical-architecture">Technical Architecture</h2>
      
      <h3 id="smart-contract-structure">Smart Contract Structure</h3>
      
      <p><strong>Core Contracts:</strong></p>
      <ul>
        <li>LivingFuturesFactory</li>
        <li>TeamVirtualAMM</li>
        <li>LiquidityManager</li>
        <li>InsuranceFund</li>
        <li>OracleCoordinator</li>
      </ul>
      
      <p><strong>Supporting Contracts:</strong></p>
      <ul>
        <li>SharedLiquidityPool</li>
        <li>ProfitDistributor</li>
        <li>LiquidationEngine</li>
        <li>FeeCollector</li>
      </ul>
      
      <h3 id="off-chain-infrastructure">Off-Chain Infrastructure</h3>
      
      <ul>
        <li><strong>Frontend:</strong> React application deployed on Cloudflare Pages</li>
        <li><strong>Backend Services:</strong> Cloudflare Workers for API endpoints and data aggregation</li>
        <li><strong>Scheduled Tasks:</strong> Cloudflare Workers with scheduled triggers for:
          <ul>
            <li>Oracle updates (after games)</li>
            <li>Funding payments (daily at fixed time)</li>
            <li>Liquidation monitoring (continuous)</li>
            <li>LP reward distribution (daily)</li>
          </ul>
        </li>
        <li><strong>Monitoring System:</strong> Grafana/Prometheus stack for system health</li>
        <li><strong>Analytics Platform:</strong> Data warehouse for user analytics and metrics</li>
      </ul>
      
      <h2 id="legal-compliance">Legal & Compliance Considerations</h2>
      
      <h3 id="regulatory-framework">Regulatory Framework</h3>
      
      <ul>
        <li><strong>Classification:</strong> Derivatives with defined settlement</li>
        <li><strong>Jurisdiction Considerations:</strong> Geofencing for restricted territories</li>
        <li><strong>KYC/AML:</strong> Integration with identity verification providers</li>
        <li><strong>Tax Reporting:</strong> Transaction reporting capabilities</li>
      </ul>
      
      <h3 id="risk-disclosures">Risk Disclosures</h3>
      
      <ul>
        <li><strong>User Warnings:</strong> Clear communication of position risks</li>
        <li><strong>Insurance Staking Disclosures:</strong> Explicit zero base rate disclosure</li>
        <li><strong>Leverage Warnings:</strong> Prominent liquidation risk notifications</li>
        <li><strong>Seasonal Dynamics:</strong> Clear indication of off-season implications</li>
      </ul>
      
      <h2 id="conclusion">Conclusion</h2>
      
      <p>
        Baseball Living Futures represents a significant innovation in sports-related financial products, combining the best elements of DeFi and traditional sports markets. By creating a system with proper incentive alignment, robust risk management, and sustainable economics, we establish the foundation for a new category of derivatives that can expand to all major sports and provide unique uncorrelated opportunities for traders and liquidity providers.
      </p>
      
      <p>
        The technical implementation on Base with supporting Cloudflare infrastructure creates a scalable, reliable platform that can grow to support millions of users while maintaining responsiveness and reliability.
      </p>
      
      <p>
        This project stands to revolutionize how people interact with sports financially, creating deeper markets, better price discovery, and more sophisticated risk management tools for sports enthusiasts and financial traders alike.
      </p>
    </article>
  )
}