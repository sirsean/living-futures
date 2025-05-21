// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVirtualAMM.sol";
import "./interfaces/IBaseballOracle.sol";

/**
 * @title VirtualAMM
 * @dev Virtual Automated Market Maker for Baseball Living Futures
 * 
 * Implements a sigmoid-based price discovery mechanism for team performance derivatives.
 * Uses hyperbolic tangent function to create bounded price movements with resistance at extremes.
 * 
 * Key Mathematical Properties:
 * - Price function: 500 + 500 * tanh(β * netImbalance / totalLiquidity)
 * - Price range: [0, 1000] representing [0%, 100%] win probability
 * - Funding rate: (marketPrice - oraclePrice) * dailyFundingFactor
 * 
 * Security Features:
 * - Role-based access control for admin functions
 * - Reentrancy protection for all state-changing functions
 * - Pausable in emergency situations
 * - Comprehensive input validation
 */
contract VirtualAMM is IVirtualAMM, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant FUNDING_ROLE = keccak256("FUNDING_ROLE");

    uint256 public constant PRICE_SCALE = 1000;  // Represents 100%
    uint256 public constant PRICE_CENTER = 500;  // Represents 50%
    uint256 public constant PRECISION = 1e18;    // Fixed point precision
    
    // Parameter bounds for validation
    uint256 public constant MIN_SENSITIVITY = 1e16;     // 0.01 minimum beta
    uint256 public constant MAX_SENSITIVITY = 10e18;    // 10.0 maximum beta
    uint256 public constant MIN_FUNDING_FACTOR = 1e12;  // 0.0001% min daily funding
    uint256 public constant MAX_FUNDING_FACTOR = 1e15;  // 0.1% max daily funding
    uint256 public constant MIN_MARGIN_RATIO = 5e16;    // 5% minimum margin
    uint256 public constant MAX_MARGIN_RATIO = 5e17;    // 50% maximum margin
    uint256 public constant MIN_TRADING_FEE = 1e14;     // 0.01% minimum trading fee
    uint256 public constant MAX_TRADING_FEE = 1e16;     // 1% maximum trading fee

    // ============ STATE VARIABLES ============

    // Core AMM parameters (configurable)
    uint256 public sensitivityParameter;  // β parameter controlling curve steepness
    uint256 public fundingFactor;         // Daily funding rate factor
    uint256 public minMarginRatio;        // Minimum margin requirement ratio
    uint256 public tradingFeeRate;        // Trading fee rate (e.g., 3e15 = 0.3%)
    
    // Position tracking
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId = 1;
    int256 public netPositionImbalance;  // longPositions - shortPositions
    uint256 public totalLiquidity;
    
    // Liquidity tracking
    mapping(address => uint256) public lpBalances;
    uint256 public totalLPTokens;
    
    // External dependencies
    IERC20 public immutable collateralToken;
    IBaseballOracle public oracle;
    string public teamId;  // MLB team identifier (e.g., "NYY", "BOS")
    
    // Fee tracking
    uint256 public accumulatedFees;

    // ============ CONSTRUCTOR ============

    /**
     * @dev Initialize the Virtual AMM
     * @param _collateralToken Token used for positions and liquidity
     * @param _oracle Baseball oracle contract
     * @param _teamId MLB team identifier
     * @param _admin Admin address for role management
     * @param _sensitivityParameter Initial beta parameter (curve steepness)
     * @param _fundingFactor Initial daily funding factor
     * @param _minMarginRatio Initial minimum margin ratio
     * @param _tradingFeeRate Initial trading fee rate
     */
    constructor(
        address _collateralToken,
        address _oracle,
        string memory _teamId,
        address _admin,
        uint256 _sensitivityParameter,
        uint256 _fundingFactor,
        uint256 _minMarginRatio,
        uint256 _tradingFeeRate
    ) {
        if (_collateralToken == address(0) || _oracle == address(0) || _admin == address(0)) {
            revert InvalidParameters();
        }
        
        // Validate initial parameters
        _validateSensitivityParameter(_sensitivityParameter);
        _validateFundingFactor(_fundingFactor);
        _validateMinMarginRatio(_minMarginRatio);
        _validateTradingFeeRate(_tradingFeeRate);
        
        collateralToken = IERC20(_collateralToken);
        oracle = IBaseballOracle(_oracle);
        teamId = _teamId;
        
        // Set initial parameters
        sensitivityParameter = _sensitivityParameter;
        fundingFactor = _fundingFactor;
        minMarginRatio = _minMarginRatio;
        tradingFeeRate = _tradingFeeRate;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        
        // Emit initial parameter events
        emit ParameterUpdated("sensitivityParameter", 0, _sensitivityParameter);
        emit ParameterUpdated("fundingFactor", 0, _fundingFactor);
        emit ParameterUpdated("minMarginRatio", 0, _minMarginRatio);
        emit ParameterUpdated("tradingFeeRate", 0, _tradingFeeRate);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Calculate current price using sigmoid function
     * Uses approximation for tanh in smart contract environment
     */
    function getCurrentPrice() public view returns (uint256) {
        if (totalLiquidity == 0) {
            return PRICE_CENTER;
        }
        
        int256 normalizedImbalance = (netPositionImbalance * int256(PRECISION)) / int256(totalLiquidity);
        int256 scaledImbalance = (normalizedImbalance * int256(sensitivityParameter)) / int256(PRECISION);
        
        // Approximate tanh using rational function for gas efficiency
        int256 tanhValue = _approximateTanh(scaledImbalance);
        
        // price = 500 + 500 * tanh(β * imbalance)
        int256 price = int256(PRICE_CENTER) + (int256(PRICE_CENTER) * tanhValue) / int256(PRECISION);
        
        // Ensure price stays within bounds
        if (price < 0) return 0;
        if (price > int256(PRICE_SCALE)) return PRICE_SCALE;
        
        return uint256(price);
    }

    /**
     * @dev Get quote for opening a position
     */
    function getQuote(int256 positionSize) external view returns (Quote memory quote) {
        if (positionSize == 0) {
            revert ZeroAmount();
        }
        
        uint256 currentPrice = getCurrentPrice();
        
        // Calculate price after position
        int256 newImbalance = netPositionImbalance + positionSize;
        uint256 newPrice = _calculatePriceForImbalance(newImbalance);
        
        // Calculate average execution price and impact
        uint256 avgPrice = (currentPrice + newPrice) / 2;
        uint256 priceImpact = newPrice > currentPrice ? newPrice - currentPrice : currentPrice - newPrice;
        
        // Calculate required margin and fees
        uint256 positionValue = uint256(_abs(positionSize)) * avgPrice / PRICE_SCALE;
        uint256 requiredMargin = (positionValue * minMarginRatio) / PRECISION;
        uint256 fees = (positionValue * tradingFeeRate) / PRECISION;
        
        quote = Quote({
            price: avgPrice,
            priceImpact: priceImpact,
            requiredMargin: requiredMargin,
            fees: fees
        });
    }

    function getNetImbalance() external view returns (int256) {
        return netPositionImbalance;
    }

    function getTotalLiquidity() external view returns (uint256) {
        return totalLiquidity;
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    /**
     * @dev Calculate current value of a position
     */
    function getPositionValue(uint256 positionId) external view returns (int256) {
        Position memory position = positions[positionId];
        if (!position.isOpen) {
            return 0;
        }
        
        uint256 currentPrice = getCurrentPrice();
        int256 priceDelta = int256(currentPrice) - int256(position.entryPrice);
        
        // PnL = positionSize * priceDelta / priceScale
        return (position.size * priceDelta) / int256(PRICE_SCALE);
    }

    /**
     * @dev Calculate funding rate based on price divergence from oracle
     */
    function getFundingRate() external view returns (int256) {
        uint256 marketPrice = getCurrentPrice();
        uint256 oraclePrice = oracle.getTeamWinPct(teamId);
        
        int256 priceDivergence = int256(marketPrice) - int256(oraclePrice);
        return (priceDivergence * int256(fundingFactor)) / int256(PRECISION);
    }

    function getParameters() external view returns (uint256, uint256, uint256, uint256) {
        return (sensitivityParameter, fundingFactor, minMarginRatio, tradingFeeRate);
    }

    /**
     * @dev Check if position has adequate margin
     */
    function hasAdequateMargin(uint256 positionId) external view returns (bool) {
        Position memory position = positions[positionId];
        if (!position.isOpen) {
            return false;
        }
        
        int256 positionValue = this.getPositionValue(positionId);
        int256 equity = int256(position.margin) + positionValue;
        
        uint256 positionSize = uint256(_abs(position.size));
        uint256 currentPrice = getCurrentPrice();
        uint256 positionNotional = (positionSize * currentPrice) / PRICE_SCALE;
        uint256 requiredMargin = (positionNotional * minMarginRatio) / PRECISION;
        
        return equity >= int256(requiredMargin);
    }

    // ============ POSITION MANAGEMENT ============

    /**
     * @dev Open a new position
     */
    function openPosition(
        address trader,
        int256 size,
        uint256 margin
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        if (trader == address(0) || size == 0 || margin == 0) {
            revert InvalidParameters();
        }
        
        // Get quote and validate
        Quote memory quote = this.getQuote(size);
        if (margin < quote.requiredMargin) {
            revert InsufficientMargin();
        }
        
        // Transfer collateral and fees
        uint256 totalRequired = margin + quote.fees;
        collateralToken.safeTransferFrom(msg.sender, address(this), totalRequired);
        
        // Create position
        positionId = nextPositionId++;
        positions[positionId] = Position({
            trader: trader,
            size: size,
            entryPrice: quote.price,
            margin: margin,
            timestamp: block.timestamp,
            isOpen: true
        });
        
        // Update state
        netPositionImbalance += size;
        accumulatedFees += quote.fees;
        
        emit PositionOpened(positionId, trader, size, quote.price, margin);
    }

    /**
     * @dev Close an existing position
     */
    function closePosition(uint256 positionId) external nonReentrant whenNotPaused returns (int256 pnl) {
        Position storage position = positions[positionId];
        if (!position.isOpen) {
            revert PositionAlreadyClosed();
        }
        if (position.trader != msg.sender) {
            revert UnauthorizedCaller();
        }
        
        // Calculate PnL and fees
        pnl = this.getPositionValue(positionId);
        uint256 positionSize = uint256(_abs(position.size));
        uint256 currentPrice = getCurrentPrice();
        uint256 positionNotional = (positionSize * currentPrice) / PRICE_SCALE;
        uint256 closingFees = (positionNotional * tradingFeeRate) / PRECISION;
        
        // Update state
        netPositionImbalance -= position.size;
        position.isOpen = false;
        accumulatedFees += closingFees;
        
        // Calculate final payout
        int256 finalPayout = int256(position.margin) + pnl - int256(closingFees);
        
        if (finalPayout > 0) {
            collateralToken.safeTransfer(position.trader, uint256(finalPayout));
        }
        
        emit PositionClosed(positionId, position.trader, currentPrice, pnl, closingFees);
    }

    // ============ LIQUIDITY MANAGEMENT ============

    /**
     * @dev Add liquidity to the AMM
     */
    function addLiquidity(uint256 amount) external nonReentrant whenNotPaused returns (uint256 lpTokens) {
        if (amount == 0) {
            revert ZeroAmount();
        }
        
        // Calculate LP tokens to mint
        if (totalLPTokens == 0) {
            lpTokens = amount;
        } else {
            lpTokens = (amount * totalLPTokens) / totalLiquidity;
        }
        
        // Transfer collateral
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update state
        totalLiquidity += amount;
        totalLPTokens += lpTokens;
        lpBalances[msg.sender] += lpTokens;
        
        emit LiquidityAdded(msg.sender, amount, lpTokens);
    }

    /**
     * @dev Remove liquidity from the AMM
     */
    function removeLiquidity(uint256 lpTokens) external nonReentrant returns (uint256 amount) {
        if (lpTokens == 0 || lpBalances[msg.sender] < lpTokens) {
            revert InvalidParameters();
        }
        
        // Calculate amount to return
        amount = (lpTokens * totalLiquidity) / totalLPTokens;
        
        // Update state
        totalLiquidity -= amount;
        totalLPTokens -= lpTokens;
        lpBalances[msg.sender] -= lpTokens;
        
        // Transfer back collateral
        collateralToken.safeTransfer(msg.sender, amount);
        
        emit LiquidityRemoved(msg.sender, lpTokens, amount);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Approximate tanh function using rational approximation
     * More gas efficient than full exponential calculation
     */
    function _approximateTanh(int256 x) internal pure returns (int256) {
        // Use bounds for extreme values
        if (x > 5e18) return int256(PRECISION);
        if (x < -5e18) return -int256(PRECISION);
        
        // Rational approximation: tanh(x) ≈ x * (27 + x²) / (27 + 9x²)
        int256 x2 = (x * x) / int256(PRECISION);
        int256 numerator = x * (27e18 + x2);
        int256 denominator = (27e18 + 9 * x2);
        
        return numerator / denominator;
    }

    /**
     * @dev Calculate price for a given imbalance
     */
    function _calculatePriceForImbalance(int256 imbalance) internal view returns (uint256) {
        if (totalLiquidity == 0) {
            return PRICE_CENTER;
        }
        
        int256 normalizedImbalance = (imbalance * int256(PRECISION)) / int256(totalLiquidity);
        int256 scaledImbalance = (normalizedImbalance * int256(sensitivityParameter)) / int256(PRECISION);
        int256 tanhValue = _approximateTanh(scaledImbalance);
        
        int256 price = int256(PRICE_CENTER) + (int256(PRICE_CENTER) * tanhValue) / int256(PRECISION);
        
        if (price < 0) return 0;
        if (price > int256(PRICE_SCALE)) return PRICE_SCALE;
        
        return uint256(price);
    }

    /**
     * @dev Get absolute value of signed integer
     */
    function _abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    // ============ PARAMETER VALIDATION ============

    /**
     * @dev Validate sensitivity parameter bounds
     * @param _sensitivityParameter Parameter to validate
     */
    function _validateSensitivityParameter(uint256 _sensitivityParameter) internal pure {
        if (_sensitivityParameter < MIN_SENSITIVITY || _sensitivityParameter > MAX_SENSITIVITY) {
            revert InvalidParameters();
        }
    }

    /**
     * @dev Validate funding factor bounds
     * @param _fundingFactor Parameter to validate
     */
    function _validateFundingFactor(uint256 _fundingFactor) internal pure {
        if (_fundingFactor < MIN_FUNDING_FACTOR || _fundingFactor > MAX_FUNDING_FACTOR) {
            revert InvalidParameters();
        }
    }

    /**
     * @dev Validate minimum margin ratio bounds
     * @param _minMarginRatio Parameter to validate
     */
    function _validateMinMarginRatio(uint256 _minMarginRatio) internal pure {
        if (_minMarginRatio < MIN_MARGIN_RATIO || _minMarginRatio > MAX_MARGIN_RATIO) {
            revert InvalidParameters();
        }
    }

    /**
     * @dev Validate trading fee rate bounds
     * @param _tradingFeeRate Parameter to validate
     */
    function _validateTradingFeeRate(uint256 _tradingFeeRate) internal pure {
        if (_tradingFeeRate < MIN_TRADING_FEE || _tradingFeeRate > MAX_TRADING_FEE) {
            revert InvalidParameters();
        }
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Update sensitivity parameter with validation
     * @param newSensitivity New beta parameter value
     */
    function updateSensitivityParameter(uint256 newSensitivity) external onlyRole(ADMIN_ROLE) {
        _validateSensitivityParameter(newSensitivity);
        
        uint256 oldValue = sensitivityParameter;
        sensitivityParameter = newSensitivity;
        
        emit ParameterUpdated("sensitivityParameter", oldValue, newSensitivity);
    }

    /**
     * @dev Update funding factor with validation
     * @param newFundingFactor New daily funding factor value
     */
    function updateFundingFactor(uint256 newFundingFactor) external onlyRole(ADMIN_ROLE) {
        _validateFundingFactor(newFundingFactor);
        
        uint256 oldValue = fundingFactor;
        fundingFactor = newFundingFactor;
        
        emit ParameterUpdated("fundingFactor", oldValue, newFundingFactor);
    }

    /**
     * @dev Update minimum margin ratio with validation
     * @param newMinMarginRatio New minimum margin ratio value
     */
    function updateMinMarginRatio(uint256 newMinMarginRatio) external onlyRole(ADMIN_ROLE) {
        _validateMinMarginRatio(newMinMarginRatio);
        
        uint256 oldValue = minMarginRatio;
        minMarginRatio = newMinMarginRatio;
        
        emit ParameterUpdated("minMarginRatio", oldValue, newMinMarginRatio);
    }

    /**
     * @dev Update trading fee rate with validation
     * @param newTradingFeeRate New trading fee rate value
     */
    function updateTradingFeeRate(uint256 newTradingFeeRate) external onlyRole(ADMIN_ROLE) {
        _validateTradingFeeRate(newTradingFeeRate);
        
        uint256 oldValue = tradingFeeRate;
        tradingFeeRate = newTradingFeeRate;
        
        emit ParameterUpdated("tradingFeeRate", oldValue, newTradingFeeRate);
    }

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
    ) external onlyRole(ADMIN_ROLE) {
        if (newSensitivity > 0) {
            _validateSensitivityParameter(newSensitivity);
            uint256 oldValue = sensitivityParameter;
            sensitivityParameter = newSensitivity;
            emit ParameterUpdated("sensitivityParameter", oldValue, newSensitivity);
        }
        
        if (newFundingFactor > 0) {
            _validateFundingFactor(newFundingFactor);
            uint256 oldValue = fundingFactor;
            fundingFactor = newFundingFactor;
            emit ParameterUpdated("fundingFactor", oldValue, newFundingFactor);
        }
        
        if (newMinMarginRatio > 0) {
            _validateMinMarginRatio(newMinMarginRatio);
            uint256 oldValue = minMarginRatio;
            minMarginRatio = newMinMarginRatio;
            emit ParameterUpdated("minMarginRatio", oldValue, newMinMarginRatio);
        }
        
        if (newTradingFeeRate > 0) {
            _validateTradingFeeRate(newTradingFeeRate);
            uint256 oldValue = tradingFeeRate;
            tradingFeeRate = newTradingFeeRate;
            emit ParameterUpdated("tradingFeeRate", oldValue, newTradingFeeRate);
        }
    }

    /**
     * @dev Get parameter bounds for external reference
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
    ) {
        return (
            MIN_SENSITIVITY,
            MAX_SENSITIVITY,
            MIN_FUNDING_FACTOR,
            MAX_FUNDING_FACTOR,
            MIN_MARGIN_RATIO,
            MAX_MARGIN_RATIO,
            MIN_TRADING_FEE,
            MAX_TRADING_FEE
        );
    }

    function setPaused(bool paused) external onlyRole(ADMIN_ROLE) {
        if (paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    // ============ FUNDING AND LIQUIDATION ============

    function applyFunding() external onlyRole(FUNDING_ROLE) returns (int256 totalFunding) {
        // Implementation for funding mechanism
        // This will be called by the funding service
        revert("Not implemented yet");
    }

    function liquidatePosition(uint256 positionId) external onlyRole(LIQUIDATOR_ROLE) returns (uint256 liquidationValue) {
        // Implementation for liquidation
        // This will be called by the liquidation engine
        revert("Not implemented yet");
    }

    // Additional functions for modifyPosition and other features would be implemented here
    function modifyPosition(uint256, int256, int256) external pure returns (int256) {
        revert("Not implemented yet");
    }
}