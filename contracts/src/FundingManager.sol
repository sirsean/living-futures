// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IFundingManager.sol";
import "./interfaces/IVirtualAMM.sol";
import "./interfaces/IBaseballOracle.sol";

/**
 * @title FundingManager
 * @dev Manages funding payments for Virtual AMM system
 * 
 * Implements the daily funding payment system as described in funding-payments.md.
 * Coordinates funding rate calculations and payment execution between position
 * holders and liquidity providers, with comprehensive risk management through
 * funding caps and emergency protocols.
 * 
 * Key Features:
 * - Daily funding execution at 10:00 AM ET
 * - LP funding caps (daily and cumulative)
 * - Funding debt management with priority settlement
 * - Emergency protocols for extreme market conditions
 * - Multi-AMM support with independent funding rates
 */
contract FundingManager is IFundingManager, AccessControl, Pausable, ReentrancyGuard {
    // ============ CONSTANTS ============

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FUNDING_EXECUTOR_ROLE = keccak256("FUNDING_EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    uint256 public constant PRECISION = 1e18;
    uint256 public constant FUNDING_PERIOD = 24 hours;
    uint256 public constant FUNDING_TIME_ET = 10 hours; // 10:00 AM ET in hours
    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 public constant DEBT_CLEANUP_WINDOW = 30 days;
    uint256 public constant CUMULATIVE_WINDOW = 30 days;
    
    // Default funding cap values
    uint256 public constant DEFAULT_DAILY_CAP = 5e16; // 5% of LP pool per day
    uint256 public constant DEFAULT_CUMULATIVE_CAP = 20e16; // 20% of LP pool over 30 days
    uint256 public constant DEFAULT_EMERGENCY_THRESHOLD = 15e16; // 15% threshold
    uint256 public constant DEFAULT_MAX_DEBT_AGE = 7 days;

    // ============ STATE VARIABLES ============

    // AMM registration and configuration
    mapping(address => bool) public registeredAMMs;
    mapping(address => FundingCap) public fundingCaps;
    mapping(address => bool) public fundingPaused;
    
    // Funding rate tracking
    mapping(address => FundingRate) public currentFundingRates;
    mapping(address => uint256) public lastFundingTime;
    
    // Funding cap usage tracking
    mapping(address => uint256) public dailyFundingUsed;
    mapping(address => uint256) public dailyCapResetTime;
    mapping(address => mapping(uint256 => uint256)) public dailyFundingHistory; // day => amount
    
    // Note: Debt tracking removed - positions are force-closed when unable to pay funding
    
    // Emergency protocol state
    mapping(address => mapping(string => bool)) public activeEmergencyProtocols;
    mapping(address => uint256) public emergencySeverity;

    // External dependencies
    IBaseballOracle public immutable oracle;

    // ============ CONSTRUCTOR ============

    constructor(address _oracle, address _admin) {
        require(_oracle != address(0), "Invalid oracle address");
        require(_admin != address(0), "Invalid admin address");
        
        oracle = IBaseballOracle(_oracle);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(FUNDING_EXECUTOR_ROLE, _admin);
        _grantRole(EMERGENCY_ROLE, _admin);
    }

    // ============ VIEW FUNCTIONS ============

    function getCurrentFundingRate(address ammAddress) external view override returns (FundingRate memory) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        return currentFundingRates[ammAddress];
    }

    function calculatePositionFunding(uint256 positionId, address ammAddress) external view override returns (int256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        IVirtualAMM.Position memory position = amm.getPosition(positionId);
        
        if (!position.isOpen) {
            return 0;
        }
        
        FundingRate memory fundingRate = currentFundingRates[ammAddress];
        uint256 timeSinceLastFunding = block.timestamp - lastFundingTime[ammAddress];
        
        // Calculate funding payment: position size × funding rate × time factor
        int256 fundingPayment = (position.size * fundingRate.rate * int256(timeSinceLastFunding)) / 
                               (int256(PRECISION) * int256(FUNDING_PERIOD));
        
        // Negative funding payment means position pays (debit)
        return -fundingPayment;
    }

    function getLPFundingObligation(address ammAddress) external view override returns (int256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        FundingRate memory fundingRate = currentFundingRates[ammAddress];
        
        int256 netImbalance = amm.getNetImbalance();
        uint256 timeSinceLastFunding = block.timestamp - lastFundingTime[ammAddress];
        
        // LP obligation = net imbalance × funding rate × time factor
        int256 lpObligation = (netImbalance * fundingRate.rate * int256(timeSinceLastFunding)) / 
                             (int256(PRECISION) * int256(FUNDING_PERIOD));
        
        return lpObligation;
    }

    function checkFundingCap(address ammAddress, uint256 amount) external view override returns (bool capReached, uint256 availableAmount) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        FundingCap memory cap = fundingCaps[ammAddress];
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        uint256 lpPoolValue = amm.getLPPoolValue();
        
        // Handle zero liquidity case
        if (lpPoolValue == 0) {
            return (true, 0); // No funding available with zero liquidity
        }
        
        // Check daily cap
        uint256 dailyCapAmount = (lpPoolValue * cap.dailyCapPercent) / PRECISION;
        uint256 dailyUsed = _getDailyUsage(ammAddress);
        uint256 dailyAvailable = dailyCapAmount > dailyUsed ? dailyCapAmount - dailyUsed : 0;
        
        // Check cumulative cap
        uint256 cumulativeCapAmount = (lpPoolValue * cap.cumulativeCapPercent) / PRECISION;
        uint256 cumulativeUsed = _getCumulativeUsage(ammAddress);
        uint256 cumulativeAvailable = cumulativeCapAmount > cumulativeUsed ? cumulativeCapAmount - cumulativeUsed : 0;
        
        // Available amount is minimum of daily and cumulative
        availableAmount = dailyAvailable < cumulativeAvailable ? dailyAvailable : cumulativeAvailable;
        capReached = amount > availableAmount;
    }


    function getFundingCap(address ammAddress) external view override returns (FundingCap memory) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        return fundingCaps[ammAddress];
    }

    function getDailyFundingUsage(address ammAddress) external view override returns (uint256, uint256, uint256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        uint256 used = _getDailyUsage(ammAddress);
        FundingCap memory cap = fundingCaps[ammAddress];
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        uint256 lpPoolValue = amm.getLPPoolValue();
        uint256 totalCap = lpPoolValue > 0 ? (lpPoolValue * cap.dailyCapPercent) / PRECISION : 0;
        uint256 resetTime = dailyCapResetTime[ammAddress];
        
        return (used, totalCap, resetTime);
    }

    function getCumulativeFundingUsage(address ammAddress) external view override returns (uint256, uint256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        uint256 used = _getCumulativeUsage(ammAddress);
        FundingCap memory cap = fundingCaps[ammAddress];
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        uint256 lpPoolValue = amm.getLPPoolValue();
        uint256 totalCap = lpPoolValue > 0 ? (lpPoolValue * cap.cumulativeCapPercent) / PRECISION : 0;
        
        return (used, totalCap);
    }

    function shouldTriggerEmergency(address ammAddress) external view override returns (bool shouldTrigger, uint256 severity) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        FundingCap memory cap = fundingCaps[ammAddress];
        uint256 cumulativeUsed = _getCumulativeUsage(ammAddress);
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        uint256 lpPoolValue = amm.getLPPoolValue();
        
        // Handle zero liquidity case
        if (lpPoolValue == 0) {
            return (false, 0);
        }
        
        uint256 usagePercent = (cumulativeUsed * PRECISION) / lpPoolValue;
        
        if (usagePercent >= cap.emergencyThreshold) {
            shouldTrigger = true;
            
            // Determine severity based on usage level
            if (usagePercent >= cap.cumulativeCapPercent) {
                severity = 3; // Critical
            } else if (usagePercent >= (cap.emergencyThreshold + cap.cumulativeCapPercent) / 2) {
                severity = 2; // High
            } else {
                severity = 1; // Warning
            }
        }
    }

    // ============ INTERNAL VIEW FUNCTIONS ============

    function _getDailyUsage(address ammAddress) internal view returns (uint256) {
        uint256 resetTime = dailyCapResetTime[ammAddress];
        if (block.timestamp >= resetTime + 1 days) {
            return 0; // Reset occurred
        }
        return dailyFundingUsed[ammAddress];
    }

    function _getCumulativeUsage(address ammAddress) internal view returns (uint256) {
        uint256 totalUsage = 0;
        uint256 currentDay = block.timestamp / 1 days;
        
        // Sum usage over the last 30 days
        for (uint256 i = 0; i < CUMULATIVE_WINDOW / 1 days; i++) {
            uint256 day = currentDay - i;
            totalUsage += dailyFundingHistory[ammAddress][day];
        }
        
        return totalUsage;
    }

    function _calculateFundingRate(address ammAddress) internal view virtual returns (int256) {
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        
        // Get current mark price from AMM
        uint256 markPrice = amm.getCurrentPrice();
        
        // Get oracle price (index price) using the team ID from the AMM
        string memory teamId = amm.getTeamId();
        uint256 oraclePrice = oracle.getTeamWinPct(teamId);
        
        // Calculate premium rate: (mark - index) / index
        int256 premium = (int256(markPrice) - int256(oraclePrice)) * int256(PRECISION) / int256(oraclePrice);
        
        // Get funding factor from AMM parameters
        (, uint256 fundingFactor,,) = amm.getParameters();
        
        // Funding rate = premium × funding factor
        int256 fundingRate = (premium * int256(fundingFactor)) / int256(PRECISION);
        
        return fundingRate;
    }

    // ============ MUTATIVE FUNCTIONS ============

    function executeFunding(address ammAddress) external override nonReentrant whenNotPaused returns (FundingExecution memory execution) {
        require(hasRole(FUNDING_EXECUTOR_ROLE, msg.sender), "UnauthorizedFundingCaller");
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        require(!fundingPaused[ammAddress], "FundingPaused");
        
        // Update funding rate first
        updateFundingRate(ammAddress);
        
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        FundingRate memory fundingRate = currentFundingRates[ammAddress];
        
        execution.executionTime = block.timestamp;
        
        // Calculate LP funding obligation
        int256 lpObligation = this.getLPFundingObligation(ammAddress);
        
        // Check funding cap for LP obligation
        if (lpObligation > 0) {
            (bool capReached, uint256 availableAmount) = this.checkFundingCap(ammAddress, uint256(lpObligation));
            
            if (capReached) {
                execution.capReached = true;
                lpObligation = int256(availableAmount);
                
                emit FundingCapReached(
                    ammAddress,
                    "daily",
                    uint256(this.getLPFundingObligation(ammAddress)),
                    availableAmount
                );
            }
        }
        
        // Execute funding for all positions
        uint256[] memory openPositions = amm.getAllOpenPositions();
        execution.positionCount = openPositions.length;
        uint256 totalPayments = 0;
        
        for (uint256 i = 0; i < openPositions.length; i++) {
            uint256 positionId = openPositions[i];
            int256 positionFunding = this.calculatePositionFunding(positionId, ammAddress);
            
            if (positionFunding != 0) {
                amm.applyPositionFunding(positionId, positionFunding);
                totalPayments += uint256(positionFunding > 0 ? positionFunding : -positionFunding);
            }
        }
        
        execution.totalPayments = totalPayments;
        execution.lpFunding = lpObligation;
        
        // Transfer LP funding if needed
        if (lpObligation != 0) {
            int256 actualTransfer = amm.transferLPFunding(lpObligation);
            execution.lpFunding = actualTransfer;
            
            // Update funding usage tracking
            _updateFundingUsage(ammAddress, uint256(actualTransfer > 0 ? actualTransfer : -actualTransfer));
        }
        
        // Update last funding time
        lastFundingTime[ammAddress] = block.timestamp;
        
        emit FundingExecuted(
            ammAddress,
            execution.totalPayments,
            execution.lpFunding,
            execution.positionCount,
            execution.capReached
        );
        
        // Check if emergency protocols should be triggered
        (bool shouldTrigger, uint256 severity) = this.shouldTriggerEmergency(ammAddress);
        if (shouldTrigger && emergencySeverity[ammAddress] < severity) {
            emergencySeverity[ammAddress] = severity;
            emit EmergencyProtocolTriggered(ammAddress, "funding_cap_approached", severity);
        }
    }

    function updateFundingRate(address ammAddress) public virtual override returns (int256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        int256 newRate = _calculateFundingRate(ammAddress);
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        
        uint256 markPrice = amm.getCurrentPrice();
        string memory teamId = amm.getTeamId();
        uint256 oraclePrice = oracle.getTeamWinPct(teamId);
        int256 premium = (int256(markPrice) - int256(oraclePrice)) * int256(PRECISION) / int256(oraclePrice);
        
        currentFundingRates[ammAddress] = FundingRate({
            rate: newRate,
            timestamp: block.timestamp,
            oraclePrice: oraclePrice,
            markPrice: markPrice,
            premium: premium
        });
        
        emit FundingRateUpdated(ammAddress, newRate, oraclePrice, markPrice, premium);
        
        return newRate;
    }


    function triggerEmergencyProtocol(address ammAddress, string calldata protocol) external override {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "UnauthorizedFundingCaller");
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        activeEmergencyProtocols[ammAddress][protocol] = true;
        emit EmergencyProtocolTriggered(ammAddress, protocol, emergencySeverity[ammAddress]);
    }

    // ============ ADMIN FUNCTIONS ============

    function registerAMMWithDefaults(address ammAddress) external onlyRole(ADMIN_ROLE) {
        require(ammAddress != address(0), "Invalid AMM address");
        
        // Set default funding cap values
        fundingCaps[ammAddress] = FundingCap({
            dailyCapPercent: 5e16, // 5% daily cap (0.05 * 1e18)
            cumulativeCapPercent: 2e17, // 20% cumulative cap (0.2 * 1e18)
            emergencyThreshold: 15e16, // 15% emergency threshold (0.15 * 1e18)
            maxDebtAge: 7 * 24 * 3600 // 7 days max debt age
        });
        
        registeredAMMs[ammAddress] = true;
        dailyCapResetTime[ammAddress] = block.timestamp;
        lastFundingTime[ammAddress] = block.timestamp;
    }

    function registerAMM(address ammAddress, FundingCap calldata fundingCap) external override onlyRole(ADMIN_ROLE) {
        require(ammAddress != address(0), "Invalid AMM address");
        require(_isValidFundingCap(fundingCap), "InvalidCapConfiguration");
        
        registeredAMMs[ammAddress] = true;
        fundingCaps[ammAddress] = fundingCap;
        dailyCapResetTime[ammAddress] = block.timestamp;
        lastFundingTime[ammAddress] = block.timestamp;
    }
    
    function setFundingCap(address ammAddress, FundingCap calldata fundingCap) external onlyRole(ADMIN_ROLE) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        require(_isValidFundingCap(fundingCap), "InvalidCapConfiguration");
        fundingCaps[ammAddress] = fundingCap;
    }

    function updateFundingCap(address ammAddress, FundingCap calldata newCap) external override onlyRole(ADMIN_ROLE) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        require(_isValidFundingCap(newCap), "InvalidCapConfiguration");
        
        fundingCaps[ammAddress] = newCap;
    }

    function pauseFunding(address ammAddress, bool paused) external override onlyRole(ADMIN_ROLE) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        fundingPaused[ammAddress] = paused;
    }

    
    function setEmergencyFundingRate(address ammAddress, int256 rate) external onlyRole(EMERGENCY_ROLE) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        currentFundingRates[ammAddress].rate = rate;
        currentFundingRates[ammAddress].timestamp = block.timestamp;
        
        emit FundingRateUpdated(ammAddress, rate, 0, 0, rate);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _updateFundingUsage(address ammAddress, uint256 amount) internal {
        // Reset daily usage if needed
        if (block.timestamp >= dailyCapResetTime[ammAddress] + 1 days) {
            dailyFundingUsed[ammAddress] = 0;
            dailyCapResetTime[ammAddress] = block.timestamp;
        }
        
        // Update daily usage
        dailyFundingUsed[ammAddress] += amount;
        
        // Update historical tracking
        uint256 currentDay = block.timestamp / 1 days;
        dailyFundingHistory[ammAddress][currentDay] += amount;
    }

    // Debt array management removed - positions are force-closed when unable to pay funding

    function _isValidFundingCap(FundingCap memory cap) internal pure returns (bool) {
        return cap.dailyCapPercent > 0 && 
               cap.dailyCapPercent <= PRECISION &&
               cap.cumulativeCapPercent > 0 && 
               cap.cumulativeCapPercent <= PRECISION &&
               cap.emergencyThreshold > 0 && 
               cap.emergencyThreshold <= cap.cumulativeCapPercent &&
               cap.maxDebtAge > 0;
    }
    
    // Debt management helper functions removed - positions are force-closed when unable to pay funding
}