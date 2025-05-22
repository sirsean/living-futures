// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFundingManager
 * @dev Interface for managing funding payments in the Virtual AMM system
 * 
 * The FundingManager coordinates funding rate calculations and payment executions
 * between position holders and liquidity providers. It implements the funding
 * mechanism described in the funding-payments.md documentation.
 */
interface IFundingManager {
    // ============ STRUCTS ============
    
    /**
     * @dev Funding rate data for a specific period
     * @param rate Current funding rate (scaled by 1e18, positive means longs pay shorts)
     * @param timestamp When this rate was set
     * @param oraclePrice Oracle price used for rate calculation
     * @param markPrice Market price used for rate calculation
     * @param premium Premium component of funding rate
     */
    struct FundingRate {
        int256 rate;
        uint256 timestamp;
        uint256 oraclePrice;
        uint256 markPrice;
        int256 premium;
    }

    /**
     * @dev Funding payment execution result
     * @param totalPayments Total amount of funding payments processed
     * @param lpFunding Amount paid to/from LP pool
     * @param positionCount Number of positions processed
     * @param capReached Whether LP funding cap was reached
     * @param executionTime Timestamp of execution
     */
    struct FundingExecution {
        uint256 totalPayments;
        int256 lpFunding;
        uint256 positionCount;
        bool capReached;
        uint256 executionTime;
    }

    /**
     * @dev LP funding cap configuration
     * @param dailyCapPercent Daily funding cap as percentage of LP pool (scaled by 1e18)
     * @param cumulativeCapPercent 30-day cumulative cap as percentage (scaled by 1e18)
     * @param emergencyThreshold Threshold for emergency protocols (scaled by 1e18)
     * @param maxDebtAge Reserved field (debt tracking removed - positions force-closed instead)
     */
    struct FundingCap {
        uint256 dailyCapPercent;
        uint256 cumulativeCapPercent;
        uint256 emergencyThreshold;
        uint256 maxDebtAge; // Reserved field - unused in current implementation
    }


    // ============ EVENTS ============

    /**
     * @dev Emitted when funding rate is updated
     * @param ammAddress Address of the AMM contract
     * @param rate New funding rate
     * @param oraclePrice Oracle price used
     * @param markPrice Market price used
     * @param premium Premium component
     */
    event FundingRateUpdated(
        address indexed ammAddress,
        int256 rate,
        uint256 oraclePrice,
        uint256 markPrice,
        int256 premium
    );

    /**
     * @dev Emitted when funding payments are executed
     * @param ammAddress Address of the AMM contract
     * @param totalPayments Total funding amount processed
     * @param lpFunding LP funding amount (positive = LP received, negative = LP paid)
     * @param positionCount Number of positions processed
     * @param capReached Whether funding cap was reached
     */
    event FundingExecuted(
        address indexed ammAddress,
        uint256 totalPayments,
        int256 lpFunding,
        uint256 positionCount,
        bool capReached
    );

    /**
     * @dev Emitted when funding payment is applied to a position
     * @param positionId Position identifier
     * @param trader Position holder address
     * @param fundingAmount Funding amount (positive = received, negative = paid)
     * @param newMargin Position margin after funding
     */
    event PositionFundingApplied(
        uint256 indexed positionId,
        address indexed trader,
        int256 fundingAmount,
        uint256 newMargin
    );


    /**
     * @dev Emitted when funding cap is reached
     * @param ammAddress Address of the AMM contract
     * @param capType Type of cap reached ("daily" or "cumulative")
     * @param requestedAmount Amount that would have been paid
     * @param actualAmount Amount actually paid
     */
    event FundingCapReached(
        address indexed ammAddress,
        string capType,
        uint256 requestedAmount,
        uint256 actualAmount
    );

    /**
     * @dev Emitted when emergency protocols are triggered
     * @param ammAddress Address of the AMM contract
     * @param protocol Emergency protocol triggered
     * @param severity Severity level
     */
    event EmergencyProtocolTriggered(
        address indexed ammAddress,
        string protocol,
        uint256 severity
    );

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get current funding rate for an AMM
     * @param ammAddress Address of the AMM contract
     * @return Current funding rate data
     */
    function getCurrentFundingRate(address ammAddress) external view returns (FundingRate memory);

    /**
     * @dev Calculate funding payment for a specific position
     * @param positionId Position identifier
     * @param ammAddress Address of the AMM contract
     * @return Funding payment amount (positive = position receives, negative = position pays)
     */
    function calculatePositionFunding(uint256 positionId, address ammAddress) external view returns (int256);

    /**
     * @dev Get LP funding obligations for an AMM
     * @param ammAddress Address of the AMM contract
     * @return LP funding amount required (positive = LP pays, negative = LP receives)
     */
    function getLPFundingObligation(address ammAddress) external view returns (int256);

    /**
     * @dev Check if funding cap would be reached for a given amount
     * @param ammAddress Address of the AMM contract
     * @param amount Funding amount to check
     * @return capReached Whether cap would be reached
     * @return availableAmount Amount available within cap limits
     */
    function checkFundingCap(address ammAddress, uint256 amount) external view returns (bool capReached, uint256 availableAmount);


    /**
     * @dev Get funding cap configuration for an AMM
     * @param ammAddress Address of the AMM contract
     * @return Funding cap configuration
     */
    function getFundingCap(address ammAddress) external view returns (FundingCap memory);

    /**
     * @dev Get daily funding usage for an AMM
     * @param ammAddress Address of the AMM contract
     * @return Amount of daily cap used
     * @return Total daily cap available
     * @return Reset timestamp for daily cap
     */
    function getDailyFundingUsage(address ammAddress) external view returns (uint256, uint256, uint256);

    /**
     * @dev Get cumulative funding usage for an AMM (30-day rolling)
     * @param ammAddress Address of the AMM contract
     * @return Amount of cumulative cap used
     * @return Total cumulative cap available
     */
    function getCumulativeFundingUsage(address ammAddress) external view returns (uint256, uint256);

    /**
     * @dev Check if emergency protocols should be triggered
     * @param ammAddress Address of the AMM contract
     * @return shouldTrigger Whether emergency protocols should activate
     * @return severity Emergency severity level (1-3)
     */
    function shouldTriggerEmergency(address ammAddress) external view returns (bool shouldTrigger, uint256 severity);

    // ============ MUTATIVE FUNCTIONS ============

    /**
     * @dev Execute daily funding for an AMM
     * @param ammAddress Address of the AMM contract
     * @return execution Funding execution results
     */
    function executeFunding(address ammAddress) external returns (FundingExecution memory execution);

    /**
     * @dev Update funding rate for an AMM
     * @param ammAddress Address of the AMM contract
     * @return New funding rate
     */
    function updateFundingRate(address ammAddress) external returns (int256);


    /**
     * @dev Trigger emergency protocols for an AMM
     * @param ammAddress Address of the AMM contract
     * @param protocol Emergency protocol to trigger
     */
    function triggerEmergencyProtocol(address ammAddress, string calldata protocol) external;

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Add or update an AMM in the funding system
     * @param ammAddress Address of the AMM contract
     * @param fundingCap Funding cap configuration
     */
    function registerAMM(address ammAddress, FundingCap calldata fundingCap) external;

    /**
     * @dev Update funding cap for an AMM
     * @param ammAddress Address of the AMM contract
     * @param newCap New funding cap configuration
     */
    function updateFundingCap(address ammAddress, FundingCap calldata newCap) external;

    /**
     * @dev Emergency pause funding for an AMM
     * @param ammAddress Address of the AMM contract
     * @param paused Whether to pause funding
     */
    function pauseFunding(address ammAddress, bool paused) external;


    // ============ ERRORS ============

    error AMMNotRegistered();
    error FundingPaused();
    error FundingCapExceeded();
    error InvalidFundingAmount();
    error EmergencyProtocolActive();
    error InsufficientLPFunds();
    error DebtTooOld();
    error InvalidCapConfiguration();
    error UnauthorizedFundingCaller();
}