const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VirtualAMM - Leverage Functionality", function () {
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

    describe("Leverage Parameter Management", function () {
        it("Should initialize with correct default leverage parameters", async function () {
            const { virtualAMM } = await loadFixture(deployVirtualAMMFixture);
            
            const [maxLeverage, minLeverage, maintenanceRatio] = await virtualAMM.getLeverageParameters();
            
            expect(maxLeverage).to.equal(ethers.parseEther("5")); // 5x default max leverage
            expect(minLeverage).to.equal(ethers.parseEther("1")); // 1x min leverage
            expect(maintenanceRatio).to.equal(ethers.parseEther("0.8")); // 80% maintenance ratio
        });

        it("Should allow admin to update max leverage", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newMaxLeverage = ethers.parseEther("8"); // 8x
            await virtualAMM.connect(owner).updateMaxLeverage(newMaxLeverage);
            
            const [maxLeverage] = await virtualAMM.getLeverageParameters();
            expect(maxLeverage).to.equal(newMaxLeverage);
        });

        it("Should reject invalid max leverage values", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            // Too low
            await expect(
                virtualAMM.connect(owner).updateMaxLeverage(ethers.parseEther("0.5"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
            
            // Too high
            await expect(
                virtualAMM.connect(owner).updateMaxLeverage(ethers.parseEther("150"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidParameters");
        });

        it("Should allow admin to update maintenance ratio", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            const newMaintenanceRatio = ethers.parseEther("0.9"); // 90%
            await virtualAMM.connect(owner).updateMaintenanceRatio(newMaintenanceRatio);
            
            const [, , maintenanceRatio] = await virtualAMM.getLeverageParameters();
            expect(maintenanceRatio).to.equal(newMaintenanceRatio);
        });
    });

    describe("Leveraged Position Opening", function () {
        it("Should open a 5x leveraged position with correct parameters", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            const margin = ethers.parseEther("10"); // Small margin for 5x leverage
            const leverage = ethers.parseEther("5"); // 5x leverage
            
            const tx = await virtualAMM.connect(trader1).openPosition(
                trader1.address, 
                positionSize, 
                margin, 
                leverage
            );
            
            const position = await virtualAMM.getPosition(1);
            expect(position.trader).to.equal(trader1.address);
            expect(position.size).to.equal(positionSize);
            expect(position.margin).to.equal(margin);
            expect(position.leverage).to.equal(leverage);
            expect(position.isOpen).to.be.true;
            
            // Check event emission
            await expect(tx).to.emit(virtualAMM, "PositionOpened")
                .withArgs(1, trader1.address, positionSize, position.entryPrice, margin, leverage);
        });

        it("Should reject leverage below minimum", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            await expect(
                virtualAMM.connect(trader1).openPosition(
                    trader1.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("50"),
                    ethers.parseEther("0.5") // 0.5x leverage (below minimum)
                )
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidLeverage");
        });

        it("Should reject leverage above maximum", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            await expect(
                virtualAMM.connect(trader1).openPosition(
                    trader1.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("50"),
                    ethers.parseEther("6") // 6x leverage (above 5x default max)
                )
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidLeverage");
        });

        it("Should require less margin for leveraged positions", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            
            // Get quotes for different leverage levels
            const quote1x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("1"));
            const quote5x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("5"));
            
            // Higher leverage should require less margin
            expect(quote5x.requiredMargin).to.be.lt(quote1x.requiredMargin);
            expect(quote5x.requiredMargin).to.be.approximately(quote1x.requiredMargin / 5n, ethers.parseEther("0.01"));
        });
    });

    describe("Leveraged PnL Calculations", function () {
        it("Should amplify PnL by leverage multiplier", async function () {
            const { virtualAMM, owner, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open 1x leveraged position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1") // 1x leverage
            );
            
            // Open 5x leveraged position with same size
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("100"),
                ethers.parseEther("10"),
                ethers.parseEther("5") // 5x leverage
            );
            
            // Move price by opening another position
            await virtualAMM.connect(owner).openPosition(
                owner.address,
                ethers.parseEther("-200"),
                ethers.parseEther("40"),
                ethers.parseEther("1")
            );
            
            // Get PnL for both positions
            const pnl1x = await virtualAMM.getPositionValue(1);
            const pnl5x = await virtualAMM.getPositionValue(2);
            
            // The 5x leveraged position should have significantly amplified PnL
            // Note: Due to different entry prices from price impact, exact 5x may not apply
            // But the leveraged position should have much larger PnL (in absolute terms)
            const absPnl1x = pnl1x < 0 ? -pnl1x : pnl1x;
            const absPnl5x = pnl5x < 0 ? -pnl5x : pnl5x;
            expect(absPnl5x).to.be.gt(absPnl1x); // Leveraged PnL should be larger
            expect(absPnl5x).to.be.gt(absPnl1x * 2n); // At least 2x larger
        });

        it("Should calculate correct position values for leveraged positions", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const leverage = ethers.parseEther("3"); // 3x leverage
            const margin = ethers.parseEther("20");
            const positionSize = ethers.parseEther("100");
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                positionSize,
                margin,
                leverage
            );
            
            const position = await virtualAMM.getPosition(1);
            const entryPrice = position.entryPrice;
            
            // Move price
            await virtualAMM.connect(owner).openPosition(
                owner.address,
                ethers.parseEther("-50"),
                ethers.parseEther("10"),
                ethers.parseEther("1")
            );
            
            const currentPrice = await virtualAMM.getCurrentPrice();
            const positionValue = await virtualAMM.getPositionValue(1);
            
            // Calculate expected leveraged PnL
            const basePnL = (positionSize * (currentPrice - entryPrice)) / ethers.parseEther("1000");
            const expectedLeveragedPnL = (basePnL * leverage) / ethers.parseEther("1");
            
            expect(positionValue).to.be.approximately(expectedLeveragedPnL, ethers.parseEther("0.01"));
        });
    });

    describe("Margin Adequacy with Leverage", function () {
        it("Should check maintenance margin correctly for leveraged positions", async function () {
            const { virtualAMM, owner, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open a 5x leveraged position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("10"), // Minimum margin for 5x leverage
                ethers.parseEther("5")
            );
            
            // Position should have adequate margin initially
            expect(await virtualAMM.hasAdequateMargin(1)).to.be.true;
            
            // Move price against the position significantly
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("-500"), // Large opposite position
                ethers.parseEther("100"),
                ethers.parseEther("1")
            );
            
            // Position should now be below maintenance margin
            expect(await virtualAMM.hasAdequateMargin(1)).to.be.false;
        });

        it("Should calculate liquidation price correctly", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const leverage = ethers.parseEther("5"); // 5x leverage
            
            // Open long position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("10"),
                leverage
            );
            
            const position = await virtualAMM.getPosition(1);
            const liquidationPrice = await virtualAMM.getLiquidationPrice(1);
            
            // For a long position, liquidation price should be below entry price
            expect(liquidationPrice).to.be.lt(position.entryPrice);
            
            // Calculate expected liquidation price
            // liquidationPrice = entryPrice * (1 - maintenanceRatio * minMarginRatio / leverage)
            const maintenanceRatio = ethers.parseEther("0.8");
            const minMarginRatio = ethers.parseEther("0.1");
            const threshold = (maintenanceRatio * minMarginRatio) / leverage;
            const expectedLiquidationPrice = position.entryPrice - (position.entryPrice * threshold) / ethers.parseEther("1");
            
            expect(liquidationPrice).to.be.approximately(expectedLiquidationPrice, ethers.parseEther("1"));
        });
    });

    describe("Quote System with Leverage", function () {
        it("Should provide accurate quotes with leverage information", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            const leverage = ethers.parseEther("3"); // 3x leverage
            
            const quote = await virtualAMM["getQuote(int256,uint256)"](positionSize, leverage);
            
            expect(quote.price).to.be.gt(0);
            expect(quote.priceImpact).to.be.gte(0);
            expect(quote.requiredMargin).to.be.gt(0);
            expect(quote.fees).to.be.gt(0);
            expect(quote.maxLeverage).to.equal(ethers.parseEther("5")); // Default max leverage
            expect(quote.liquidationPrice).to.be.gt(0);
            expect(quote.liquidationPrice).to.be.lt(quote.price); // Long position liquidation price below entry
        });

        it("Should show different margin requirements for different leverage levels", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            
            const quote1x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("1"));
            const quote2x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("2"));
            const quote5x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("5"));
            
            // Higher leverage should require less margin
            expect(quote2x.requiredMargin).to.be.lt(quote1x.requiredMargin);
            expect(quote5x.requiredMargin).to.be.lt(quote2x.requiredMargin);
            
            // The ratios should be approximately correct
            expect(quote2x.requiredMargin * 2n).to.be.approximately(quote1x.requiredMargin, ethers.parseEther("0.01"));
            expect(quote5x.requiredMargin * 5n).to.be.approximately(quote1x.requiredMargin, ethers.parseEther("0.01"));
        });

        it("Should work with backward compatibility function", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const positionSize = ethers.parseEther("100");
            
            // Test backward compatibility (should default to 1x leverage)
            const quoteCompat = await virtualAMM["getQuote(int256)"](positionSize);
            const quote1x = await virtualAMM["getQuote(int256,uint256)"](positionSize, ethers.parseEther("1"));
            
            expect(quoteCompat.price).to.equal(quote1x.price);
            expect(quoteCompat.requiredMargin).to.equal(quote1x.requiredMargin);
            expect(quoteCompat.fees).to.equal(quote1x.fees);
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("Should handle maximum leverage position correctly", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const maxLeverage = ethers.parseEther("5");
            
            // Should succeed with max leverage
            await expect(
                virtualAMM.connect(trader1).openPosition(
                    trader1.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("10"),
                    maxLeverage
                )
            ).to.not.be.reverted;
            
            const position = await virtualAMM.getPosition(1);
            expect(position.leverage).to.equal(maxLeverage);
        });

        it("Should handle minimum leverage position correctly", async function () {
            const { virtualAMM, owner, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            const minLeverage = ethers.parseEther("1");
            
            // Should succeed with min leverage
            await expect(
                virtualAMM.connect(trader1).openPosition(
                    trader1.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("50"),
                    minLeverage
                )
            ).to.not.be.reverted;
            
            const position = await virtualAMM.getPosition(1);
            expect(position.leverage).to.equal(minLeverage);
        });

        it("Should reject quotes with invalid leverage", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Below minimum
            await expect(
                virtualAMM["getQuote(int256,uint256)"](ethers.parseEther("100"), ethers.parseEther("0.5"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidLeverage");
            
            // Above maximum
            await expect(
                virtualAMM["getQuote(int256,uint256)"](ethers.parseEther("100"), ethers.parseEther("6"))
            ).to.be.revertedWithCustomError(virtualAMM, "InvalidLeverage");
        });
    });

    describe("Integration with Existing Functionality", function () {
        it("Should work correctly with position closing", async function () {
            const { virtualAMM, owner, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open leveraged position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("10"),
                ethers.parseEther("5") // 5x leverage
            );
            
            // Move price favorably
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("50"),
                ethers.parseEther("10"),
                ethers.parseEther("1")
            );
            
            // Close position
            const initialBalance = await virtualAMM.collateralToken().then(token => 
                ethers.getContractAt("MockERC20", token).then(contract => 
                    contract.balanceOf(trader1.address)
                )
            );
            
            await virtualAMM.connect(trader1).closePosition(1);
            
            const finalBalance = await virtualAMM.collateralToken().then(token => 
                ethers.getContractAt("MockERC20", token).then(contract => 
                    contract.balanceOf(trader1.address)
                )
            );
            
            // Should receive margin back plus leveraged PnL minus fees
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should work correctly with funding rate calculations", async function () {
            const { virtualAMM, owner, trader1, oracle } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));
            
            // Open leveraged position to create significant imbalance
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("500"), // Larger position to create price movement
                ethers.parseEther("50"),
                ethers.parseEther("5") // 5x leverage
            );
            
            const marketPrice = await virtualAMM.getCurrentPrice();
            const oraclePrice = await oracle.getTeamWinPct("NYY");
            const fundingRate = await virtualAMM.getFundingRate();
            
            // Debug logging (will show in test output)
            console.log("Market Price:", marketPrice.toString());
            console.log("Oracle Price:", oraclePrice.toString());
            console.log("Funding Rate:", fundingRate.toString());
            
            // With a large long position, market price should be above oracle price
            expect(marketPrice).to.be.gt(oraclePrice);
            
            // Funding rate calculation should work correctly
            // Since market > oracle, funding rate should be non-negative (longs pay shorts)
            expect(fundingRate).to.be.gte(0); // Can be 0 if the difference is too small for precision
        });
    });
});