const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VirtualAMM", function () {
    // Test fixture to deploy contracts
    async function deployVirtualAMMFixture() {
        const [owner, trader1, trader2, liquidator] = await ethers.getSigners();

        // Deploy mock ERC20 token for collateral
        const MockToken = await ethers.getContractFactory("src/test/mocks/MockERC20.sol:MockERC20");
        const collateralToken = await MockToken.deploy("Test Token", "TEST", 18);

        // Deploy mock oracle
        const MockOracle = await ethers.getContractFactory("src/test/mocks/MockBaseballOracle.sol:MockBaseballOracle");
        const oracle = await MockOracle.deploy();

        // Deploy VirtualAMM with configurable parameters
        const VirtualAMM = await ethers.getContractFactory("VirtualAMM");
        const sensitivityParameter = ethers.parseEther("1");      // 1.0 beta
        const fundingFactor = "500000000000000";                  // 0.05%
        const minMarginRatio = ethers.parseEther("0.1");          // 10%
        const tradingFeeRate = "3000000000000000";                // 0.3%
        
        const virtualAMM = await VirtualAMM.deploy(
            await collateralToken.getAddress(),
            await oracle.getAddress(),
            "NYY", // teamId
            owner.address,
            sensitivityParameter,
            fundingFactor,
            minMarginRatio,
            tradingFeeRate
        );

        // Mint tokens to traders
        const initialBalance = ethers.parseEther("10000");
        await collateralToken.mint(trader1.address, initialBalance);
        await collateralToken.mint(trader2.address, initialBalance);
        await collateralToken.mint(owner.address, initialBalance);

        // Approve AMM to spend tokens
        await collateralToken.connect(trader1).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(trader2).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(owner).approve(await virtualAMM.getAddress(), ethers.MaxUint256);

        // Set oracle price to 500 (50%)
        await oracle.updateTeamWinPct("NYY", 500);

        return {
            virtualAMM,
            collateralToken,
            oracle,
            owner,
            trader1,
            trader2,
            liquidator
        };
    }

    describe("Deployment", function () {
        it("Should set the correct initial parameters", async function () {
            const { virtualAMM, collateralToken, oracle } = await loadFixture(deployVirtualAMMFixture);

            expect(await virtualAMM.collateralToken()).to.equal(await collateralToken.getAddress());
            expect(await virtualAMM.oracle()).to.equal(await oracle.getAddress());
            expect(await virtualAMM.teamId()).to.equal("NYY");
            expect(await virtualAMM.sensitivityParameter()).to.equal(ethers.parseEther("1"));
            expect(await virtualAMM.fundingFactor()).to.equal("500000000000000"); // 0.05%
            expect(await virtualAMM.tradingFeeRate()).to.equal("3000000000000000"); // 0.3%
        });

        it("Should start with price at center (500)", async function () {
            const { virtualAMM } = await loadFixture(deployVirtualAMMFixture);
            
            expect(await virtualAMM.getCurrentPrice()).to.equal(500);
            expect(await virtualAMM.getNetImbalance()).to.equal(0);
            expect(await virtualAMM.getTotalLiquidity()).to.equal(0);
        });
    });

    describe("Price Calculation", function () {
        it("Should return center price with zero imbalance", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Add some liquidity first
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            expect(await virtualAMM.getCurrentPrice()).to.equal(500);
        });

        it("Should increase price with positive net imbalance (more longs)", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open long position
            const positionSize = ethers.parseEther("100");
            const margin = ethers.parseEther("50");
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, positionSize, margin, ethers.parseEther("1")); // 1x leverage
            
            const price = await virtualAMM.getCurrentPrice();
            expect(price).to.be.gt(500);
        });

        it("Should decrease price with negative net imbalance (more shorts)", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open short position (negative size)
            const positionSize = ethers.parseEther("-100");
            const margin = ethers.parseEther("50");
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, positionSize, margin, ethers.parseEther("1")); // 1x leverage
            
            const price = await virtualAMM.getCurrentPrice();
            expect(price).to.be.lt(500);
        });

        it("Should have bounded prices between 0 and 1000", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add small amount of liquidity to create extreme imbalance
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("10"));
            
            // Create very large long position
            const largePosition = ethers.parseEther("1000");
            const largeMargin = ethers.parseEther("500");
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, largePosition, largeMargin, ethers.parseEther("1")); // 1x leverage
            
            const price = await virtualAMM.getCurrentPrice();
            expect(price).to.be.lte(1000);
            expect(price).to.be.gte(0);
        });
    });

    describe("Position Management", function () {
        it("Should open a position with correct parameters", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            const margin = ethers.parseEther("50");
            
            const tx = await virtualAMM.connect(trader1).openPosition(trader1.address, positionSize, margin, ethers.parseEther("1")); // 1x leverage
            
            const position = await virtualAMM.getPosition(1);
            expect(position.trader).to.equal(trader1.address);
            expect(position.size).to.equal(positionSize);
            expect(position.margin).to.equal(margin);
            expect(position.isOpen).to.be.true;
            
            // Check net imbalance updated
            expect(await virtualAMM.getNetImbalance()).to.equal(positionSize);
            
            // Check event emitted
            await expect(tx).to.emit(virtualAMM, "PositionOpened");
        });

        it("Should reject position with insufficient margin", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            const insufficientMargin = ethers.parseEther("1"); // Too small
            
            await expect(
                virtualAMM.connect(trader1).openPosition(trader1.address, positionSize, insufficientMargin, ethers.parseEther("1")) // 1x leverage
            ).to.be.revertedWithCustomError(virtualAMM, "InsufficientMargin");
        });

        it("Should close a position and calculate correct PnL", async function () {
            const { virtualAMM, owner, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open position
            const positionSize = ethers.parseEther("100");
            const margin = ethers.parseEther("50");
            await virtualAMM.connect(trader1).openPosition(trader1.address, positionSize, margin, ethers.parseEther("1")); // 1x leverage
            
            const entryPrice = (await virtualAMM.getPosition(1)).entryPrice;
            
            // Move price by opening opposite position
            await virtualAMM.connect(trader2).openPosition(trader2.address, ethers.parseEther("-150"), ethers.parseEther("75"), ethers.parseEther("1")); // 1x leverage
            
            const exitPrice = await virtualAMM.getCurrentPrice();
            
            // Close first position
            const tx = await virtualAMM.connect(trader1).closePosition(1);
            
            const position = await virtualAMM.getPosition(1);
            expect(position.isOpen).to.be.false;
            
            // Check net imbalance updated
            const expectedImbalance = ethers.parseEther("-150"); // Only second position remains
            expect(await virtualAMM.getNetImbalance()).to.equal(expectedImbalance);
            
            await expect(tx).to.emit(virtualAMM, "PositionClosed");
        });

        it("Should reject closing non-existent position", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await expect(
                virtualAMM.connect(trader1).closePosition(999)
            ).to.be.revertedWithCustomError(virtualAMM, "PositionAlreadyClosed");
        });

        it("Should reject closing position by non-owner", async function () {
            const { virtualAMM, owner, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity and open position
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("100"), ethers.parseEther("50"), ethers.parseEther("1")); // 1x leverage
            
            await expect(
                virtualAMM.connect(trader2).closePosition(1)
            ).to.be.revertedWithCustomError(virtualAMM, "UnauthorizedCaller");
        });
    });

    describe("Liquidity Management", function () {
        it("Should add liquidity and mint LP tokens", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const liquidityAmount = ethers.parseEther("1000");
            const tx = await virtualAMM.connect(owner).addLiquidity(liquidityAmount);
            
            expect(await virtualAMM.getTotalLiquidity()).to.equal(liquidityAmount);
            expect(await virtualAMM.totalLPTokens()).to.equal(liquidityAmount);
            expect(await virtualAMM.lpBalances(owner.address)).to.equal(liquidityAmount);
            
            await expect(tx).to.emit(virtualAMM, "LiquidityAdded");
        });

        it("Should remove liquidity and burn LP tokens", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity first
            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);
            
            // Remove half
            const removeAmount = ethers.parseEther("500");
            const tx = await virtualAMM.connect(owner).removeLiquidity(removeAmount);
            
            expect(await virtualAMM.getTotalLiquidity()).to.equal(ethers.parseEther("500"));
            expect(await virtualAMM.totalLPTokens()).to.equal(ethers.parseEther("500"));
            expect(await virtualAMM.lpBalances(owner.address)).to.equal(ethers.parseEther("500"));
            
            await expect(tx).to.emit(virtualAMM, "LiquidityRemoved");
        });

        it("Should reject removing more LP tokens than available", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            await expect(
                virtualAMM.connect(owner).removeLiquidity(ethers.parseEther("1500"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });
    });

    describe("Quote System", function () {
        it("Should provide accurate quotes for positions", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            const quote = await virtualAMM.getQuote(positionSize);
            
            expect(quote.price).to.be.gt(0);
            expect(quote.priceImpact).to.be.gte(0);
            expect(quote.requiredMargin).to.be.gt(0);
            expect(quote.fees).to.be.gt(0);
        });

        it("Should show higher price impact for larger positions", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const smallPosition = ethers.parseEther("50");
            const largePosition = ethers.parseEther("200");
            
            const smallQuote = await virtualAMM.getQuote(smallPosition);
            const largeQuote = await virtualAMM.getQuote(largePosition);
            
            expect(largeQuote.priceImpact).to.be.gt(smallQuote.priceImpact);
        });
    });

    describe("Funding Rate", function () {
        it("Should calculate funding rate based on price divergence", async function () {
            const { virtualAMM, owner, trader1, oracle } = await loadFixture(deployVirtualAMMFixture);
            
            // Add liquidity and create imbalance
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("200"), ethers.parseEther("100"), ethers.parseEther("1")); // 1x leverage
            
            const marketPrice = await virtualAMM.getCurrentPrice();
            const oraclePrice = await oracle.getTeamWinPct("NYY");
            const fundingRate = await virtualAMM.getFundingRate();
            
            // Funding rate should be positive if market price > oracle price (longs pay shorts)
            if (marketPrice > oraclePrice) {
                expect(fundingRate).to.be.gte(0);
            } else if (marketPrice < oraclePrice) {
                expect(fundingRate).to.be.lte(0);
            } else {
                expect(fundingRate).to.equal(0);
            }
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to update sensitivity parameter", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newSensitivity = ethers.parseEther("2");
            const tx = await virtualAMM.connect(owner).updateSensitivityParameter(newSensitivity);
            
            expect(await virtualAMM.sensitivityParameter()).to.equal(newSensitivity);
            await expect(tx).to.emit(virtualAMM, "ParameterUpdated");
        });

        it("Should allow admin to update funding factor", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newFundingFactor = "1000000000000000"; // 0.1%
            const tx = await virtualAMM.connect(owner).updateFundingFactor(newFundingFactor);
            
            expect(await virtualAMM.fundingFactor()).to.equal(newFundingFactor);
            await expect(tx).to.emit(virtualAMM, "ParameterUpdated");
        });

        it("Should allow admin to update minimum margin ratio", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newMarginRatio = ethers.parseEther("0.15"); // 15%
            const tx = await virtualAMM.connect(owner).updateMinMarginRatio(newMarginRatio);
            
            expect(await virtualAMM.minMarginRatio()).to.equal(newMarginRatio);
            await expect(tx).to.emit(virtualAMM, "ParameterUpdated");
        });

        it("Should allow admin to update trading fee rate", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newTradingFeeRate = "5000000000000000"; // 0.5%
            const tx = await virtualAMM.connect(owner).updateTradingFeeRate(newTradingFeeRate);
            
            expect(await virtualAMM.tradingFeeRate()).to.equal(newTradingFeeRate);
            await expect(tx).to.emit(virtualAMM, "ParameterUpdated");
        });

        it("Should allow batch parameter updates", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newSensitivity = ethers.parseEther("1.5");
            const newFundingFactor = "750000000000000"; // 0.075%
            const newMarginRatio = ethers.parseEther("0.12"); // 12%
            const newTradingFeeRate = "4000000000000000"; // 0.4%
            
            await virtualAMM.connect(owner).updateParameters(
                newSensitivity,
                newFundingFactor,
                newMarginRatio,
                newTradingFeeRate
            );
            
            expect(await virtualAMM.sensitivityParameter()).to.equal(newSensitivity);
            expect(await virtualAMM.fundingFactor()).to.equal(newFundingFactor);
            expect(await virtualAMM.minMarginRatio()).to.equal(newMarginRatio);
            expect(await virtualAMM.tradingFeeRate()).to.equal(newTradingFeeRate);
        });

        it("Should skip zero values in batch updates", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const originalSensitivity = await virtualAMM.sensitivityParameter();
            const originalTradingFeeRate = await virtualAMM.tradingFeeRate();
            const newFundingFactor = "750000000000000";
            
            await virtualAMM.connect(owner).updateParameters(
                0, // Skip sensitivity
                newFundingFactor,
                0, // Skip margin ratio
                0  // Skip trading fee rate
            );
            
            expect(await virtualAMM.sensitivityParameter()).to.equal(originalSensitivity);
            expect(await virtualAMM.fundingFactor()).to.equal(newFundingFactor);
            expect(await virtualAMM.tradingFeeRate()).to.equal(originalTradingFeeRate);
        });

        it("Should reject invalid sensitivity parameters", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Below minimum
            await expect(
                virtualAMM.connect(owner).updateSensitivityParameter(ethers.parseEther("0.005"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
            
            // Above maximum
            await expect(
                virtualAMM.connect(owner).updateSensitivityParameter(ethers.parseEther("15"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });

        it("Should reject invalid funding factors", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Below minimum
            await expect(
                virtualAMM.connect(owner).updateFundingFactor("500000000000") // Too small
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
            
            // Above maximum
            await expect(
                virtualAMM.connect(owner).updateFundingFactor("2000000000000000") // Too large
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });

        it("Should reject invalid margin ratios", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Below minimum (5%)
            await expect(
                virtualAMM.connect(owner).updateMinMarginRatio(ethers.parseEther("0.03"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
            
            // Above maximum (50%)
            await expect(
                virtualAMM.connect(owner).updateMinMarginRatio(ethers.parseEther("0.6"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });

        it("Should reject invalid trading fee rates", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Below minimum (0.01%)
            await expect(
                virtualAMM.connect(owner).updateTradingFeeRate("50000000000000") // Too small
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
            
            // Above maximum (1%)
            await expect(
                virtualAMM.connect(owner).updateTradingFeeRate("20000000000000000") // Too large
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });

        it("Should return correct parameter bounds", async function () {
            const { virtualAMM } = await loadFixture(deployVirtualAMMFixture);
            
            const bounds = await virtualAMM.getParameterBounds();
            
            expect(bounds[0]).to.equal(ethers.parseEther("0.01"));  // MIN_SENSITIVITY
            expect(bounds[1]).to.equal(ethers.parseEther("10"));    // MAX_SENSITIVITY
            expect(bounds[2]).to.equal("1000000000000");            // MIN_FUNDING_FACTOR
            expect(bounds[3]).to.equal("1000000000000000");         // MAX_FUNDING_FACTOR
            expect(bounds[4]).to.equal(ethers.parseEther("0.05"));  // MIN_MARGIN_RATIO
            expect(bounds[5]).to.equal(ethers.parseEther("0.5"));   // MAX_MARGIN_RATIO
            expect(bounds[6]).to.equal("100000000000000");          // MIN_TRADING_FEE (0.01%)
            expect(bounds[7]).to.equal("10000000000000000");        // MAX_TRADING_FEE (1%)
        });

        it("Should allow pausing and unpausing", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Pause the contract
            await virtualAMM.connect(owner).setPaused(true);
            expect(await virtualAMM.paused()).to.be.true;
            
            // Should reject operations when paused
            await expect(
                virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"))
            ).to.be.reverted;
            
            // Unpause
            await virtualAMM.connect(owner).setPaused(false);
            expect(await virtualAMM.paused()).to.be.false;
            
            // Should work normally after unpause
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
        });
    });

    describe("Error Handling", function () {
        it("Should revert with ZeroAmount for zero position size", async function () {
            const { virtualAMM } = await loadFixture(deployVirtualAMMFixture);
            
            await expect(
                virtualAMM.getQuote(0)
            ).to.be.revertedWithCustomError(virtualAMM, "ZeroAmount");
        });

        it("Should handle edge cases gracefully", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Price calculation with zero liquidity should return center price
            expect(await virtualAMM.getCurrentPrice()).to.equal(500);
            
            // Adding liquidity should not affect price if no positions
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            expect(await virtualAMM.getCurrentPrice()).to.equal(500);
        });
    });
});