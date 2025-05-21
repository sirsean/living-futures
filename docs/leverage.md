# Leverage System Design

## Overview

The leverage system for Living Futures enables traders to amplify their market exposure by borrowing against their initial margin. This document outlines the mathematical foundation, risk management mechanisms, and implementation details for leverage support in the VirtualAMM.

## Core Concepts

### Leverage Multiplier
- **Definition**: The ratio between total position exposure and margin provided
- **Range**: 1x to 10x default (up to 100x maximum, configurable by governance)
- **Formula**: `Position Exposure = Margin × Leverage Multiplier`

### Effective Position Size
With leverage, a trader can control a larger position than their posted margin would normally allow:
```
Unleveraged: Position Size = Margin / (Current Price × Min Margin Ratio)
With Leverage: Position Size = (Margin × Leverage) / (Current Price × Min Margin Ratio)
```

## Mathematical Framework

### Margin Requirements

#### Initial Margin
The minimum margin required to open a leveraged position:
```
Required Margin = (Position Notional Value × Min Margin Ratio) / Leverage Multiplier

Where:
- Position Notional Value = |Position Size| × Current Price / PRICE_SCALE
- Min Margin Ratio = Configuration parameter (e.g., 10% = 1e17)
- Leverage Multiplier = 2x to 10x
```

#### Maintenance Margin
The minimum equity required to keep a position open:
```
Maintenance Margin = Position Notional Value × (Min Margin Ratio × 0.8) / Leverage Multiplier

Note: Maintenance margin is 80% of initial margin to prevent immediate liquidations
```

### PnL Calculations

#### Leveraged PnL
Profit and loss is amplified by the leverage multiplier:
```
Leveraged PnL = Base PnL × Leverage Multiplier

Where:
Base PnL = Position Size × (Current Price - Entry Price) / PRICE_SCALE
```

#### Position Equity
Current equity in a leveraged position:
```
Position Equity = Posted Margin + Leveraged PnL
```

#### Liquidation Price
The price at which a position gets liquidated:
```
For Long Positions:
Liquidation Price = Entry Price × (1 - (Min Margin Ratio × 0.8) / Leverage)

For Short Positions:  
Liquidation Price = Entry Price × (1 + (Min Margin Ratio × 0.8) / Leverage)
```

### Examples

#### Example 1: 5x Leveraged Long Position
- Posted Margin: 100 USDC
- Leverage: 5x
- Current Price: 500 (50%)
- Min Margin Ratio: 10%

```
Position Size = (100 × 5) / (500 × 0.1) = 500 / 50 = 10 units
Required Margin = (10 × 500 × 0.1) / 5 = 500 / 5 = 100 USDC ✓
Liquidation Price = 500 × (1 - 0.08/5) = 500 × 0.984 = 492

If price moves to 520:
Base PnL = 10 × (520 - 500) / 1000 = 10 × 0.02 = 0.2 USDC
Leveraged PnL = 0.2 × 5 = 1.0 USDC (1% return on 100 margin)
Position Equity = 100 + 1 = 101 USDC
```

#### Example 2: Maximum Loss Scenario
- Same position as above
- Price drops to liquidation at 492

```
Base PnL = 10 × (492 - 500) / 1000 = 10 × (-0.008) = -0.08 USDC
Leveraged PnL = -0.08 × 5 = -0.4 USDC
Position Equity = 100 - 0.4 = 99.6 USDC (falls below maintenance margin)
```

## Risk Management

### Leverage Limits
- **Minimum Leverage**: 1x (no leverage)
- **Maximum Leverage**: 10x default (up to 100x maximum, configurable)
- **Default Leverage**: 1x for safety

### Dynamic Risk Adjustments
The system monitors several risk metrics:

1. **Position Concentration**: Large positions may have leverage caps
2. **Market Volatility**: During high volatility periods, max leverage may be reduced
3. **Liquidity Conditions**: Low liquidity may trigger leverage restrictions

### Liquidation Engine Integration
- **Maintenance Margin Monitoring**: Continuous position health checks
- **Liquidation Triggers**: Automatic liquidation when equity falls below maintenance margin
- **Partial Liquidations**: Reduce position size instead of full liquidation when possible

## Implementation Architecture

### Contract Structure Updates

#### Position Struct Enhancement
```solidity
struct Position {
    address trader;
    int256 size;
    uint256 entryPrice;
    uint256 margin;
    uint256 leverage;        // NEW: Leverage multiplier (1e18 = 1x)
    uint256 timestamp;
    bool isOpen;
}
```

#### New Configuration Parameters
```solidity
uint256 public maxLeverage;           // Maximum allowed leverage (default: 5e18 = 5x, max: 100e18 = 100x)
uint256 public minLeverage;           // Minimum leverage (1e18 = 1x)
uint256 public maintenanceRatio;      // Maintenance margin ratio (0.8e18 = 80% of initial)
```

#### Enhanced Quote Structure
```solidity
struct Quote {
    uint256 price;
    uint256 priceImpact;
    uint256 requiredMargin;
    uint256 fees;
    uint256 maxLeverage;      // NEW: Max leverage available for this trade
    uint256 liquidationPrice; // NEW: Liquidation price at max leverage
}
```

### Key Functions Updates

#### openPosition Enhancement
```solidity
function openPosition(
    address trader,
    int256 size,
    uint256 margin,
    uint256 leverage    // NEW: Leverage multiplier parameter
) external returns (uint256 positionId)
```

#### getQuote Enhancement
```solidity
function getQuote(
    int256 positionSize,
    uint256 leverage    // NEW: Consider leverage in quote
) external view returns (Quote memory quote)
```

#### New Leverage-Specific Functions
```solidity
function getLiquidationPrice(uint256 positionId) external view returns (uint256);
function getMaxLeverage(int256 positionSize) external view returns (uint256);
function updateMaxLeverage(uint256 newMaxLeverage) external;
```

## Security Considerations

### Input Validation
- Leverage must be within configured bounds (1x to 10x)
- Position size validation with leverage considerations
- Margin adequacy checks before position opening

### Risk Limits
- Maximum position size relative to total liquidity
- Concentration limits per trader
- Global leverage exposure monitoring

### Emergency Controls
- Circuit breakers for extreme market conditions
- Ability to reduce maximum leverage during high volatility
- Emergency liquidation procedures

## Gas Optimization

### Efficient Calculations
- Pre-computed leverage constants for common multipliers
- Optimized liquidation price calculations
- Batched position updates for gas savings

### Storage Layout
- Pack leverage multiplier with other position data
- Minimize storage reads in critical paths
- Use events for detailed leverage tracking

## Testing Strategy

### Unit Tests
- Leverage parameter validation
- Margin calculation accuracy
- PnL amplification correctness
- Liquidation price calculations

### Integration Tests
- Position lifecycle with leverage
- Multi-position portfolio risk
- Funding payments with leverage

### Edge Case Testing
- Maximum leverage scenarios
- Near-liquidation conditions
- Extreme price movements
- Zero/minimal margin edge cases

### Performance Tests
- Gas usage optimization
- High-frequency trading simulation
- Large position size handling

## Deployment Strategy

### Phase 1: Core Implementation
1. Update VirtualAMM contract with leverage support
2. Comprehensive testing on testnet
3. Security audit of leverage mechanics

### Phase 2: Risk Management
1. Implement liquidation engine enhancements
2. Add dynamic leverage controls
3. Deploy monitoring and alerting

### Phase 3: Production Rollout
1. Deploy to mainnet with conservative limits
2. Gradually increase maximum leverage based on market conditions
3. Monitor system performance and user adoption

## Compliance and Risk Disclosure

### Risk Warnings
- Leverage amplifies both profits and losses
- Positions can be liquidated rapidly in volatile markets
- Higher leverage increases liquidation risk
- Funding payments are amplified by leverage

### Position Monitoring
- Real-time margin level displays
- Liquidation price warnings
- PnL tracking with leverage indication
- Risk metrics dashboard

## Future Enhancements

### Advanced Features
- Cross-margining between positions
- Portfolio-level leverage limits
- Dynamic leverage based on market conditions
- Leverage trading incentives and rewards

### Risk Management Evolution
- AI-driven risk assessment
- Predictive liquidation modeling
- Cross-asset correlation monitoring
- Real-time volatility adjustments

---

*Last Updated: January 2025*
*Review Schedule: Monthly during active development*