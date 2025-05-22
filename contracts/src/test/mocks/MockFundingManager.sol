// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../FundingManager.sol";

/**
 * @title MockFundingManager
 * @dev Modified FundingManager for testing that uses the real oracle price
 */
contract MockFundingManager is FundingManager {
    constructor(address _oracle, address _admin) FundingManager(_oracle, _admin) {}

    /**
     * @dev Overridden to use real oracle data in tests
     */
    function _calculateFundingRate(address ammAddress) internal view override returns (int256) {
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        
        // Get current mark price from AMM
        uint256 markPrice = amm.getCurrentPrice();
        
        // In tests, we'll directly control the oracle price by setting it
        uint256 oraclePrice;
        
        // For test purposes, use the MockBaseballOracle's stored value for NYY
        try oracle.getTeamWinPct("NYY") returns (uint256 winPct) {
            oraclePrice = winPct;
        } catch {
            // Fallback to 500 if team not found
            oraclePrice = 500;
        }
        
        // Calculate premium rate: (mark - index) / index
        int256 premium = (int256(markPrice) - int256(oraclePrice)) * int256(PRECISION) / int256(oraclePrice);
        
        // Get funding factor from AMM parameters
        (, uint256 fundingFactor,,) = amm.getParameters();
        
        // Funding rate = premium × funding factor
        int256 fundingRate = (premium * int256(fundingFactor)) / int256(PRECISION);
        
        return fundingRate;
    }

    /**
     * @dev Overridden to use real oracle data in tests
     */
    function updateFundingRate(address ammAddress) public override returns (int256) {
        require(registeredAMMs[ammAddress], "AMMNotRegistered");
        
        int256 newRate = _calculateFundingRate(ammAddress);
        IVirtualAMM amm = IVirtualAMM(ammAddress);
        
        uint256 markPrice = amm.getCurrentPrice();
        
        // In tests, we'll directly control the oracle price by setting it
        uint256 oraclePrice;
        
        // For test purposes, use the MockBaseballOracle's stored value for NYY
        try oracle.getTeamWinPct("NYY") returns (uint256 winPct) {
            oraclePrice = winPct;
        } catch {
            // Fallback to 500 if team not found
            oraclePrice = 500;
        }
        
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
}