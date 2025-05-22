# Daily Funding Payment System (FUND-003)

## Overview

The automated daily funding payment system ensures fair compensation between long and short position holders in Living Futures contracts. This perpetual swap mechanism prevents contract prices from diverging significantly from underlying asset values through periodic funding payments.

## Core Concepts

### Funding Rate Calculation
The funding rate determines the payment direction and amount between position holders:
- **Positive funding rate**: Longs pay shorts
- **Negative funding rate**: Shorts pay longs
- **Rate calculation**: Based on price premium/discount relative to oracle price

### Payment Mechanics
- **Frequency**: Daily at 10:00 AM ET
- **Calculation basis**: Position size × funding rate
- **Settlement**: Automatic via smart contract execution
- **Grace period**: 1-hour window for execution tolerance

### VirtualAMM Funding Flow
In our VirtualAMM system, funding payments flow between three parties:

#### When Longs Pay Shorts (Positive Funding Rate)
- **Payment source**: Long position margins are debited
- **Payment distribution**: 
  - Direct payments to short positions (credited to their margins)
  - Excess payments to LP pool when short positions < long positions
- **LP role**: Acts as funding recipient when there's insufficient short volume

#### When Shorts Pay Longs (Negative Funding Rate)
- **Payment source**: Short position margins are debited
- **Payment distribution**:
  - Direct payments to long positions (credited to their margins)
  - Excess payments to LP pool when long positions < short positions
- **LP role**: Acts as funding recipient when there's insufficient long volume

#### LP Funding Obligations
- **When LP pays**: If position imbalance requires LP to act as counterparty
- **Payment source**: LP pool reserves
- **Payment destination**: Directly into position holders' margins
- **Risk management**: LP funding capped at configurable percentage of pool value

### LP Funding Cap Mechanics

#### Purpose and Risk Mitigation
The LP funding cap serves as a critical protection mechanism:
- **Prevents LP pool depletion**: Protects against catastrophic drawdown from extreme funding imbalances
- **Maintains market liquidity**: Ensures LP pool remains viable for core trading operations
- **Limits systemic risk**: Prevents funding payment obligations from bankrupting the LP pool

#### Cap Types and Implementation
**Daily Funding Cap** (Speed Limit):
- Limits LP funding payments to X% of pool value per day
- Prevents rapid depletion during volatile periods
- Resets every 24 hours at funding time

**Cumulative Funding Cap** (Drawdown Protection):
- Tracks total LP funding payments over rolling 30-day period
- Prevents sustained drain on LP reserves
- Triggers emergency protocols when approached

#### System Behavior When Positions Cannot Pay Funding

**Position Force Closure**:
1. Calculate funding payment required for each position
2. If position margin insufficient to pay funding, position is immediately force-closed
3. Position closure follows standard liquidation process (PnL settlement, fee deduction)
4. No funding debt accumulates - positions are closed to prevent system insolvency
5. System emits `PositionClosed` event with funding failure reason

**LP Funding Cap Behavior**:
- When LP obligations exceed daily/cumulative caps, LP funding is reduced proportionally
- Position funding continues normally (positions still pay/receive as calculated)
- Cap only limits LP pool contributions, not individual position obligations
- Ensures LP pool remains solvent while maintaining funding mechanism integrity

**Emergency Protocols**:
- **High liquidation rate**: Increased position closures due to funding payment failures
- **Trading pause**: Temporarily halt new position creation during extreme volatility
- **Rate adjustment**: Automatically adjust funding rates to reduce future failures
- **LP recruitment**: Signal need for additional liquidity provision

**Risk Management**:
- **Immediate settlement**: No funding debt accumulation prevents bad debt
- **Solvency protection**: Force closure maintains system financial integrity
- **Fair liquidation**: Standard liquidation process ensures proper PnL settlement
- **LP protection**: Funding caps prevent excessive LP drain during volatile periods

## Technical Architecture

### Smart Contract Components

#### 1. Funding Rate Oracle
```solidity
interface IFundingRateOracle {
    function getDailyFundingRate(uint256 contractId) external view returns (int256);
    function updateFundingRate(uint256 contractId, int256 rate) external;
    event FundingRateUpdated(uint256 indexed contractId, int256 rate, uint256 timestamp);
}
```

#### 2. Funding Payment Processor
```solidity
interface IFundingPaymentProcessor {
    function executeDailyFunding(uint256 contractId) external;
    function calculateFundingPayment(address trader, uint256 contractId) external view returns (int256);
    event FundingPaymentExecuted(uint256 indexed contractId, uint256 totalPayments, uint256 timestamp);
}
```

#### 3. Position Management Integration
- Track all active positions for funding calculations
- Maintain funding payment history per trader
- Handle position liquidations during funding periods

### Calculation Formula

```
Funding Payment = Position Size × Funding Rate × (Time Since Last Payment / 24 hours)

Where:
- Position Size: Notional value of position in USD
- Funding Rate: Annualized rate as percentage
- Time factor: Proportional to actual time elapsed
```

### Rate Determination Logic

```
Funding Rate = Premium Rate + Interest Rate

Premium Rate = TWAP(Mark Price - Index Price) / Index Price
Interest Rate = (Quote Interest Rate - Base Interest Rate) / Funding Interval

Where:
- TWAP: Time-weighted average price over funding period
- Mark Price: Current contract price from Virtual AMM
- Index Price: Oracle price from BaseballOracle
- Funding Interval: 24 hours (daily)
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Funding Rate Oracle Contract**
   - Deploy funding rate storage and calculation logic
   - Integrate with BaseballOracle for index prices
   - Implement rate update mechanisms

2. **Virtual AMM Integration**
   - Add funding rate calculation to AMM
   - Implement TWAP calculation for mark prices
   - Store historical price data for rate calculations

### Phase 2: Payment Processing
1. **Funding Payment Processor**
   - Build payment calculation engine
   - Implement batch payment execution
   - Add safety checks and circuit breakers

2. **Position Tracking Enhancement**
   - Extend VirtualAMM position tracking
   - Add funding payment history storage
   - Implement position state management during funding

### Phase 3: Management Tools
1. **Scripts Management Command**
   - Create daily funding execution script in scripts sub-project
   - Implement retry logic for failed executions
   - Add monitoring and logging capabilities

2. **Multi-contract Support**
   - Handle funding for multiple simultaneous contracts
   - Implement contract-specific rate calculations
   - Add cross-contract funding analytics

### Phase 4: Advanced Features
1. **Dynamic Rate Adjustments**
   - Implement market condition-based rate modifications
   - Add volatility-adjusted funding calculations
   - Create emergency funding mechanisms

2. **LP Funding Integration**
   - Calculate LP funding exposure
   - Implement LP-specific funding rewards
   - Add funding-based LP incentive structures

## Risk Management

### Safety Mechanisms
- **Maximum funding rate caps** to prevent excessive payments
- **Circuit breakers** for extreme market conditions
- **Fallback execution** if automated system fails
- **Emergency pause** functionality for critical issues

### Monitoring Requirements
- Real-time funding rate tracking
- Payment execution success monitoring
- Position health checks during funding
- Anomaly detection for unusual funding patterns

## Testing Strategy

### Unit Tests
- Funding rate calculation accuracy
- Payment amount validation
- Edge case handling (zero positions, liquidations)
- Rate cap enforcement

### Integration Tests
- End-to-end funding cycle execution
- Multi-trader funding scenarios
- Oracle price feed integration
- Management script execution testing

### Stress Tests
- High-volume position funding
- Extreme market condition scenarios
- System failure recovery testing
- Gas cost optimization validation

## Deployment Considerations

### Gas Optimization
- Batch multiple funding operations
- Optimize contract storage layouts
- Implement efficient iteration patterns
- Use events for off-chain tracking

### Upgrade Strategy
- Implement behind proxy for upgradeability
- Maintain backward compatibility
- Plan migration path for existing positions
- Create upgrade testing protocols

## Future Enhancements

### Advanced Funding Models
- Dynamic funding based on market volatility
- Multi-interval funding (8-hour, hourly)
- Cross-asset funding correlations
- Predictive funding rate models

## Success Metrics

### Performance Indicators
- Funding execution success rate (>99.5%)
- Average execution time (<2 minutes)
- Gas cost per funding operation
- System uptime during funding periods

### Market Efficiency
- Price convergence after funding payments
- Funding rate accuracy vs market conditions
- Position holder satisfaction metrics
- Trading volume impact analysis

---

This documentation serves as the foundation for implementing the automated daily funding payment system. Each phase should be thoroughly tested before proceeding to the next, ensuring robust and reliable funding operations for all platform users.