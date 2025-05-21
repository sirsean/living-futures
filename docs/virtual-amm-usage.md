# VirtualAMM Contract Usage Guide

## Overview

The VirtualAMM contract provides a sigmoid-based price discovery mechanism for baseball team performance derivatives. This guide covers how to interact with the contract, particularly focusing on position management and tracking.

## Position Management

### Opening a Position

To open a position, call the `openPosition` function:

```solidity
function openPosition(
    address trader,
    int256 size,
    uint256 margin,
    uint256 leverage
) external returns (uint256 positionId)
```

**Parameters:**
- `trader`: Address that will own the position
- `size`: Position size (positive for long, negative for short)
- `margin`: Margin amount to post
- `leverage`: Leverage multiplier (scaled by 1e18, e.g., 5e18 = 5x leverage)

**Returns:**
- `positionId`: Unique identifier for the new position

**Example:**
```javascript
// Open a long position with 2x leverage
const positionId = await virtualAMM.openPosition(
    traderAddress,
    ethers.utils.parseEther("100"), // 100 units long
    ethers.utils.parseEther("1000"), // 1000 USDC margin
    ethers.utils.parseEther("2")     // 2x leverage
);
```

### Closing a Position

To close a position, call the `closePosition` function:

```solidity
function closePosition(uint256 positionId) external returns (int256 pnl)
```

**Parameters:**
- `positionId`: Position ID to close

**Returns:**
- `pnl`: Realized profit or loss

**Example:**
```javascript
const pnl = await virtualAMM.closePosition(positionId);
console.log(`Position closed with PnL: ${pnl}`);
```

## Position Tracking

### New Feature: Trader Position Lookup

The contract now includes efficient position tracking that allows traders to easily find all their open positions.

### Getting All Trader Positions

```solidity
function getTraderPositions(address trader) external view returns (uint256[] memory positionIds)
```

**Example:**
```javascript
// Get all position IDs for a trader
const positionIds = await virtualAMM.getTraderPositions(traderAddress);
console.log(`Trader has ${positionIds.length} positions:`, positionIds);

// Get details for each position
for (const positionId of positionIds) {
    const position = await virtualAMM.getPosition(positionId);
    const value = await virtualAMM.getPositionValue(positionId);
    console.log(`Position ${positionId}:`, {
        size: position.size,
        entryPrice: position.entryPrice,
        margin: position.margin,
        leverage: position.leverage,
        currentValue: value
    });
}
```

### Getting Position Count

```solidity
function getTraderPositionCount(address trader) external view returns (uint256 count)
```

**Example:**
```javascript
const count = await virtualAMM.getTraderPositionCount(traderAddress);
console.log(`Trader has ${count} open positions`);
```

### Position Details

Get detailed information about a specific position:

```solidity
function getPosition(uint256 positionId) external view returns (Position memory)
```

**Position Struct:**
```solidity
struct Position {
    address trader;      // Position owner
    int256 size;        // Position size (+ long, - short)
    uint256 entryPrice; // Entry price (scaled by 1000)
    uint256 margin;     // Initial margin posted
    uint256 leverage;   // Leverage multiplier (scaled by 1e18)
    uint256 timestamp;  // Opening timestamp
    bool isOpen;        // Whether position is active
}
```

### Real-time Position Value

Get the current value of a position:

```solidity
function getPositionValue(uint256 positionId) external view returns (int256)
```

**Example:**
```javascript
const currentValue = await virtualAMM.getPositionValue(positionId);
const position = await virtualAMM.getPosition(positionId);
const unrealizedPnL = currentValue;
const totalEquity = position.margin.add(currentValue);
console.log(`Unrealized PnL: ${unrealizedPnL}, Total Equity: ${totalEquity}`);
```

## Frontend Integration Example

Here's a complete example of how to integrate position tracking in a frontend application:

```javascript
class PositionTracker {
    constructor(virtualAMM, provider) {
        this.virtualAMM = virtualAMM;
        this.provider = provider;
    }

    async getTraderPositions(traderAddress) {
        const positionIds = await this.virtualAMM.getTraderPositions(traderAddress);
        const positions = [];

        for (const positionId of positionIds) {
            const position = await this.virtualAMM.getPosition(positionId);
            if (position.isOpen) {
                const currentValue = await this.virtualAMM.getPositionValue(positionId);
                const liquidationPrice = await this.virtualAMM.getLiquidationPrice(positionId);
                
                positions.push({
                    id: positionId,
                    trader: position.trader,
                    size: position.size,
                    entryPrice: position.entryPrice,
                    margin: position.margin,
                    leverage: position.leverage,
                    timestamp: position.timestamp,
                    currentValue: currentValue,
                    liquidationPrice: liquidationPrice,
                    unrealizedPnL: currentValue,
                    totalEquity: position.margin.add(currentValue)
                });
            }
        }

        return positions;
    }

    async watchPositionEvents(traderAddress, callback) {
        // Listen for position opened events
        const openedFilter = this.virtualAMM.filters.PositionOpened(null, traderAddress);
        this.virtualAMM.on(openedFilter, (positionId, trader, size, entryPrice, margin, leverage) => {
            callback({
                type: 'opened',
                positionId,
                trader,
                size,
                entryPrice,
                margin,
                leverage
            });
        });

        // Listen for position closed events
        const closedFilter = this.virtualAMM.filters.PositionClosed(null, traderAddress);
        this.virtualAMM.on(closedFilter, (positionId, trader, exitPrice, pnl, fees) => {
            callback({
                type: 'closed',
                positionId,
                trader,
                exitPrice,
                pnl,
                fees
            });
        });
    }
}

// Usage
const positionTracker = new PositionTracker(virtualAMM, provider);

// Get current positions
const positions = await positionTracker.getTraderPositions(userAddress);
console.log('Current positions:', positions);

// Watch for real-time updates
positionTracker.watchPositionEvents(userAddress, (event) => {
    console.log('Position event:', event);
    // Update UI accordingly
});
```

## Best Practices

1. **Position Monitoring**: Regularly check position values and margin requirements to avoid liquidation.

2. **Event Listening**: Use contract events to track position changes in real-time.

3. **Error Handling**: Always handle cases where positions might not exist or be closed.

4. **Gas Optimization**: Batch multiple position queries when possible.

5. **UI Updates**: Use the position tracking functions to provide users with comprehensive portfolio views.

## Events Reference

Monitor these events for position tracking:

```solidity
event PositionOpened(
    uint256 indexed positionId,
    address indexed trader,
    int256 size,
    uint256 entryPrice,
    uint256 margin,
    uint256 leverage
);

event PositionClosed(
    uint256 indexed positionId,
    address indexed trader,
    uint256 exitPrice,
    int256 pnl,
    uint256 fees
);
```

These events provide real-time updates when positions are opened or closed, allowing frontends to maintain accurate position lists without constant polling.