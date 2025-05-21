// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IVirtualAMM
 * @dev Interface for Virtual Automated Market Maker for Baseball Living Futures
 * 
 * This interface defines the core functionality for a sigmoid-based virtual AMM
 * that provides price discovery for team performance derivatives without token swapping.
 * 
 * Key Features:
 * - Sigmoid-based price discovery with bounded output (0-1000)
 * - Position imbalance tracking without physical asset movement
 * - Integration with oracle for funding rate calculations
 * - Liquidity provider counter-positioning
 */
interface IVirtualAMM {
    // ============ STRUCTS ============
    
    /**
     * @dev Represents a trader's position in the virtual AMM
     * @param trader Address of the position holder
     * @param size Position size (positive for long, negative for short)
     * @param entryPrice Price at which position was opened (scaled by 1000)
     * @param margin Initial margin posted for the position
     * @param leverage Leverage multiplier (scaled by 1e18, e.g. 5e18 = 5x)
     * @param timestamp When the position was opened
     * @param isOpen Whether the position is currently active
     */
    struct Position {
        address trader;
        int256 size;
        uint256 entryPrice;
        uint256 margin;
        uint256 leverage;
        uint256 timestamp;
        bool isOpen;
    }

    /**
     * @dev Quote information for a potential position
     * @param price Execution price for the position
     * @param priceImpact Amount price would move due to this position
     * @param requiredMargin Minimum margin needed for this position
     * @param fees Fees that would be charged for this position
     * @param maxLeverage Maximum leverage available for this position size
     * @param liquidationPrice Liquidation price at given leverage
     */
    struct Quote {
        uint256 price;
        uint256 priceImpact;
        uint256 requiredMargin;
        uint256 fees;
        uint256 maxLeverage;
        uint256 liquidationPrice;
    }

    // ============ EVENTS ============
    
    /**
     * @dev Emitted when a position is opened
     * @param positionId Unique identifier for the position
     * @param trader Address of the trader
     * @param size Position size (positive for long, negative for short)
     * @param entryPrice Price at position entry
     * @param margin Margin posted
     * @param leverage Leverage multiplier used
     */
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        int256 size,
        uint256 entryPrice,
        uint256 margin,
        uint256 leverage
    );

    /**
     * @dev Emitted when a position is closed
     * @param positionId Position identifier
     * @param trader Address of the trader
     * @param exitPrice Price at position closure
     * @param pnl Realized profit or loss
     * @param fees Fees charged for closing
     */
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl,
        uint256 fees
    );

    /**
     * @dev Emitted when liquidity is added to the AMM
     * @param provider Address providing liquidity
     * @param amount Amount of liquidity added
     * @param lpTokens LP tokens minted
     */
    event LiquidityAdded(
        address indexed provider,
        uint256 amount,
        uint256 lpTokens
    );

    /**
     * @dev Emitted when liquidity is removed from the AMM
     * @param provider Address removing liquidity
     * @param lpTokens LP tokens burned
     * @param amount Amount of liquidity removed
     */
    event LiquidityRemoved(
        address indexed provider,
        uint256 lpTokens,
        uint256 amount
    );

    /**
     * @dev Emitted when AMM parameters are updated
     * @param parameter Name of the parameter updated
     * @param oldValue Previous value
     * @param newValue New value
     */
    event ParameterUpdated(
        string indexed parameter,
        uint256 oldValue,
        uint256 newValue
    );

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get current price based on position imbalance
     * @return Current price scaled by 1000 (500 = 50.0%)
     */
    function getCurrentPrice() external view returns (uint256);

    /**
     * @dev Get quote for opening a position of given size
     * @param positionSize Size of position to quote (positive for long, negative for short)
     * @param leverage Desired leverage multiplier (scaled by 1e18)
     * @return quote Quote information including price, impact, and margin requirements
     */
    function getQuote(int256 positionSize, uint256 leverage) external view returns (Quote memory quote);

    /**
     * @dev Get the current net position imbalance
     * @return Net imbalance (longPositions - shortPositions)
     */
    function getNetImbalance() external view returns (int256);

    /**
     * @dev Get total liquidity available in the AMM
     * @return Total liquidity amount
     */
    function getTotalLiquidity() external view returns (uint256);

    /**
     * @dev Get position details by ID
     * @param positionId Position identifier
     * @return position Position struct with all details
     */
    function getPosition(uint256 positionId) external view returns (Position memory position);

    /**
     * @dev Calculate current value of a position
     * @param positionId Position identifier
     * @return Current value of the position (can be negative)
     */
    function getPositionValue(uint256 positionId) external view returns (int256);

    /**
     * @dev Get current funding rate for the AMM
     * @return Funding rate scaled by 1e18 (positive means longs pay shorts)
     */
    function getFundingRate() external view returns (int256);

    /**
     * @dev Get AMM configuration parameters
     * @return sensitivityParameter Beta parameter controlling curve steepness
     * @return fundingFactor Daily funding rate factor
     * @return minMarginRatio Minimum margin requirement as ratio
     * @return tradingFeeRate Trading fee rate
     */
    function getParameters() external view returns (
        uint256 sensitivityParameter,
        uint256 fundingFactor,
        uint256 minMarginRatio,
        uint256 tradingFeeRate
    );

    /**
     * @dev Check if a position meets margin requirements
     * @param positionId Position identifier
     * @return Whether position has sufficient margin
     */
    function hasAdequateMargin(uint256 positionId) external view returns (bool);

    /**
     * @dev Get the liquidation price for a position
     * @param positionId Position identifier
     * @return Liquidation price for the position
     */
    function getLiquidationPrice(uint256 positionId) external view returns (uint256);

    /**
     * @dev Get maximum leverage available for a position size
     * @param positionSize Size of position to check
     * @return Maximum leverage multiplier available
     */
    function getMaxLeverage(int256 positionSize) external view returns (uint256);

    /**
     * @dev Get leverage configuration parameters
     * @return maxLeverage Maximum leverage allowed
     * @return minLeverage Minimum leverage (typically 1x)
     * @return maintenanceRatio Maintenance margin ratio
     */
    function getLeverageParameters() external view returns (
        uint256 maxLeverage,
        uint256 minLeverage,
        uint256 maintenanceRatio
    );

    // ============ MUTATIVE FUNCTIONS ============

    /**
     * @dev Open a new position
     * @param trader Address of the trader
     * @param size Position size (positive for long, negative for short)
     * @param margin Margin amount to post
     * @param leverage Leverage multiplier (scaled by 1e18, e.g. 5e18 = 5x)
     * @return positionId Unique identifier for the new position
     */
    function openPosition(
        address trader,
        int256 size,
        uint256 margin,
        uint256 leverage
    ) external returns (uint256 positionId);

    /**
     * @dev Close an existing position
     * @param positionId Position identifier
     * @return pnl Realized profit or loss from closing the position
     */
    function closePosition(uint256 positionId) external returns (int256 pnl);

    /**
     * @dev Modify an existing position (increase/decrease size or margin)
     * @param positionId Position identifier
     * @param sizeDelta Change in position size
     * @param marginDelta Change in margin (can be negative for withdrawal)
     * @return newSize New position size after modification
     */
    function modifyPosition(
        uint256 positionId,
        int256 sizeDelta,
        int256 marginDelta
    ) external returns (int256 newSize);

    /**
     * @dev Add liquidity to the AMM
     * @param amount Amount of liquidity to add
     * @return lpTokens Number of LP tokens minted
     */
    function addLiquidity(uint256 amount) external returns (uint256 lpTokens);

    /**
     * @dev Remove liquidity from the AMM
     * @param lpTokens Number of LP tokens to burn
     * @return amount Amount of liquidity removed
     */
    function removeLiquidity(uint256 lpTokens) external returns (uint256 amount);

    /**
     * @dev Apply funding payments to all open positions
     * @dev Called by the funding mechanism (typically daily)
     * @return totalFunding Total funding amount transferred
     */
    function applyFunding() external returns (int256 totalFunding);

    /**
     * @dev Liquidate a position that doesn't meet margin requirements
     * @param positionId Position identifier
     * @return liquidationValue Amount recovered from liquidation
     */
    function liquidatePosition(uint256 positionId) external returns (uint256 liquidationValue);

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Update the sensitivity parameter (beta)
     * @param newSensitivity New sensitivity parameter value
     */
    function updateSensitivityParameter(uint256 newSensitivity) external;

    /**
     * @dev Update the funding factor
     * @param newFundingFactor New funding factor value
     */
    function updateFundingFactor(uint256 newFundingFactor) external;

    /**
     * @dev Update minimum margin ratio
     * @param newMinMarginRatio New minimum margin ratio
     */
    function updateMinMarginRatio(uint256 newMinMarginRatio) external;

    /**
     * @dev Update trading fee rate
     * @param newTradingFeeRate New trading fee rate
     */
    function updateTradingFeeRate(uint256 newTradingFeeRate) external;

    /**
     * @dev Batch update multiple parameters atomically
     * @param newSensitivity New sensitivity parameter (0 to skip)
     * @param newFundingFactor New funding factor (0 to skip) 
     * @param newMinMarginRatio New minimum margin ratio (0 to skip)
     * @param newTradingFeeRate New trading fee rate (0 to skip)
     */
    function updateParameters(
        uint256 newSensitivity,
        uint256 newFundingFactor,
        uint256 newMinMarginRatio,
        uint256 newTradingFeeRate
    ) external;

    /**
     * @dev Get parameter bounds for validation
     * @return minSens Minimum sensitivity parameter
     * @return maxSens Maximum sensitivity parameter
     * @return minFunding Minimum funding factor
     * @return maxFunding Maximum funding factor
     * @return minMargin Minimum margin ratio
     * @return maxMargin Maximum margin ratio
     * @return minTradingFee Minimum trading fee rate
     * @return maxTradingFee Maximum trading fee rate
     */
    function getParameterBounds() external pure returns (
        uint256 minSens,
        uint256 maxSens,
        uint256 minFunding,
        uint256 maxFunding,
        uint256 minMargin,
        uint256 maxMargin,
        uint256 minTradingFee,
        uint256 maxTradingFee
    );

    /**
     * @dev Emergency pause/unpause the AMM
     * @param paused Whether to pause the AMM
     */
    function setPaused(bool paused) external;

    /**
     * @dev Update maximum leverage allowed
     * @param newMaxLeverage New maximum leverage multiplier
     */
    function updateMaxLeverage(uint256 newMaxLeverage) external;

    /**
     * @dev Update maintenance margin ratio
     * @param newMaintenanceRatio New maintenance margin ratio
     */
    function updateMaintenanceRatio(uint256 newMaintenanceRatio) external;

    // ============ ERRORS ============

    error InsufficientLiquidity();
    error InsufficientMargin();
    error PositionNotFound();
    error PositionAlreadyClosed();
    error UnauthorizedCaller();
    error InvalidParameters();
    error AMMPaused();
    error ZeroAmount();
    error MarginBelowMinimum();
    error InvalidLeverage();
    error ExceedsMaxLeverage();
    error BelowMaintenanceMargin();
}