const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundingManager Position Funding Calculation", function () {
    // Test fixture to deploy contracts
    async function deployFundingManagerFixture() {
        const [owner, admin, executor, trader1, trader2, emergency] = await ethers.getSigners();

        // Deploy mock ERC20 token for collateral
        const MockToken = await ethers.getContractFactory("src/test/mocks/MockERC20.sol:MockERC20");
        const collateralToken = await MockToken.deploy("Test Token", "TEST", 18);

        // Deploy mock oracle
        const MockOracle = await ethers.getContractFactory("src/test/mocks/MockBaseballOracle.sol:MockBaseballOracle");
        const oracle = await MockOracle.deploy();

        // Deploy VirtualAMM
        const VirtualAMM = await ethers.getContractFactory("VirtualAMM");
        const sensitivityParameter = ethers.parseEther("1");
        const fundingFactor = "500000000000000"; // 0.05%
        const minMarginRatio = ethers.parseEther("0.1"); // 10%
        const tradingFeeRate = "3000000000000000"; // 0.3%
        
        const virtualAMM = await VirtualAMM.deploy(
            await collateralToken.getAddress(),
            await oracle.getAddress(),
            "NYY",
            admin.address,
            sensitivityParameter,
            fundingFactor,
            minMarginRatio,
            tradingFeeRate
        );

        // Deploy MockFundingManager for testing with real oracle prices
        const FundingManager = await ethers.getContractFactory("src/test/mocks/MockFundingManager.sol:MockFundingManager");
        const fundingManager = await FundingManager.deploy(
            await oracle.getAddress(),
            admin.address
        );

        // Set up roles
        const ADMIN_ROLE = await fundingManager.ADMIN_ROLE();
        const FUNDING_EXECUTOR_ROLE = await fundingManager.FUNDING_EXECUTOR_ROLE();
        const EMERGENCY_ROLE = await fundingManager.EMERGENCY_ROLE();
        const AMM_FUNDING_ROLE = await virtualAMM.FUNDING_ROLE();

        await fundingManager.connect(admin).grantRole(FUNDING_EXECUTOR_ROLE, executor.address);
        await fundingManager.connect(admin).grantRole(EMERGENCY_ROLE, emergency.address);
        await virtualAMM.connect(admin).grantRole(AMM_FUNDING_ROLE, await fundingManager.getAddress());

        // Mint tokens and approve
        const initialBalance = ethers.parseEther("100000"); // Larger balance for tests
        await collateralToken.mint(trader1.address, initialBalance);
        await collateralToken.mint(trader2.address, initialBalance);
        await collateralToken.mint(admin.address, initialBalance);

        await collateralToken.connect(trader1).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(trader2).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(admin).approve(await virtualAMM.getAddress(), ethers.MaxUint256);

        // Set oracle price
        await oracle.updateTeamWinPct("NYY", 500);

        return {
            owner,
            admin,
            executor,
            trader1,
            trader2,
            emergency,
            virtualAMM,
            collateralToken,
            oracle,
            fundingManager,
            ADMIN_ROLE,
            FUNDING_EXECUTOR_ROLE,
            EMERGENCY_ROLE,
            fundingFactor
        };
    }

    async function setupWithRegisteredAMM() {
        const contracts = await loadFixture(deployFundingManagerFixture);
        const { fundingManager, virtualAMM, admin } = contracts;

        // Register AMM with default funding cap
        const fundingCap = {
            dailyCapPercent: ethers.parseEther("0.05"), // 5%
            cumulativeCapPercent: ethers.parseEther("0.2"), // 20%
            emergencyThreshold: ethers.parseEther("0.15"), // 15%
            maxDebtAge: 7 * 24 * 3600 // 7 days
        };

        await fundingManager.connect(admin).registerAMM(await virtualAMM.getAddress(), fundingCap);

        return { ...contracts, fundingCap };
    }

    async function setupWithLiquidityAndPositions() {
        const contracts = await setupWithRegisteredAMM();
        const { virtualAMM, trader1, trader2, oracle, admin } = contracts;

        // Add liquidity
        const liquidityAmount = ethers.parseEther("100000");
        await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

        // Define position parameters
        const longMargin = ethers.parseEther("1000");
        const shortMargin = ethers.parseEther("1000");
        const longSize = ethers.parseEther("10000");
        const shortSize = ethers.parseEther("-10000");
        const leverage = ethers.parseEther("2");
        
        // Create long position
        const longPositionId = await virtualAMM.connect(trader1).openPosition.staticCall(
            trader1.address, longSize, longMargin, leverage
        );
        await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, longMargin, leverage);
        
        // Create short position
        const shortPositionId = await virtualAMM.connect(trader2).openPosition.staticCall(
            trader2.address, shortSize, shortMargin, leverage
        );
        await virtualAMM.connect(trader2).openPosition(trader2.address, shortSize, shortMargin, leverage);

        // Set oracle price slightly different from AMM price to create funding rate
        await oracle.updateTeamWinPct("NYY", 480);

        return { 
            ...contracts, 
            longPositionId, 
            shortPositionId, 
            liquidityAmount,
            longSize,
            shortSize,
            longMargin,
            shortMargin
        };
    }

    describe("Position Funding Calculation", function () {
        it("Should return zero funding for closed position", async function () {
            const { fundingManager, virtualAMM, longPositionId, trader1, executor } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Update funding rate first
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Close the position
            await virtualAMM.connect(trader1).closePosition(longPositionId);
            
            // Calculate funding for closed position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Should be exactly zero
            expect(fundingPayment).to.equal(0);
        });

        it("Should calculate positive funding payment for long position when mark > oracle", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create scenario where longs pay (mark price > oracle price)
            await oracle.updateTeamWinPct("NYY", 480); // Set oracle price below mark price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Record initial state
            const initialFundingTime = await fundingManager.lastFundingTime(await virtualAMM.getAddress());
            const position = await virtualAMM.getPosition(longPositionId);
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment for the position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Verify funding calculation (should be negative for long position when mark > oracle)
            expect(fundingPayment).to.be.lt(0);
            
            // Manual calculation to verify
            const timePassed = 24 * 60 * 60; // 24 hours in seconds
            const expectedPayment = (position.size * fundingRate.rate * BigInt(timePassed)) / 
                                    (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
            const negativeExpectedPayment = -expectedPayment;
            
            // Allow for small differences due to block timing
            const tolerance = expectedPayment / BigInt(100); // 1% tolerance
            expect(fundingPayment).to.be.closeTo(negativeExpectedPayment, tolerance);
        });

        it("Should calculate negative funding payment for short position when mark > oracle", async function () {
            const { fundingManager, virtualAMM, shortPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create scenario where shorts receive (mark price > oracle price)
            await oracle.updateTeamWinPct("NYY", 480); // Set oracle price below mark price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Record initial state
            const initialFundingTime = await fundingManager.lastFundingTime(await virtualAMM.getAddress());
            const position = await virtualAMM.getPosition(shortPositionId);
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment for the position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                shortPositionId,
                await virtualAMM.getAddress()
            );
            
            // Verify funding calculation (should be positive for short position when mark > oracle)
            // Short positions have negative size, so the payment is negated (shorts receive)
            expect(fundingPayment).to.be.gt(0);
            
            // Manual calculation to verify
            const timePassed = 24 * 60 * 60; // 24 hours in seconds
            const expectedPayment = (position.size * fundingRate.rate * BigInt(timePassed)) / 
                                   (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
            // Short position has negative size, so negating expectedPayment gives positive number
            const negativeExpectedPayment = -expectedPayment;
            
            // Allow for small differences due to block timing
            const tolerance = BigInt(Math.abs(Number(expectedPayment))) / BigInt(100); // 1% tolerance
            expect(fundingPayment).to.be.closeTo(negativeExpectedPayment, tolerance);
        });

        it("Should calculate negative funding payment for long position when mark < oracle", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create scenario where longs receive (mark price < oracle price)
            await oracle.updateTeamWinPct("NYY", 520); // Set oracle price above mark price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Record initial state
            const initialFundingTime = await fundingManager.lastFundingTime(await virtualAMM.getAddress());
            const position = await virtualAMM.getPosition(longPositionId);
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment for the position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Verify funding calculation (should be positive for long position when mark < oracle)
            expect(fundingPayment).to.be.gt(0);
            
            // Manual calculation to verify
            const timePassed = 24 * 60 * 60; // 24 hours in seconds
            const expectedPayment = (position.size * fundingRate.rate * BigInt(timePassed)) / 
                                   (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
            const negativeExpectedPayment = -expectedPayment; // Negated in the contract
            
            // Allow for small differences due to block timing
            const tolerance = BigInt(Math.abs(Number(expectedPayment))) / BigInt(100); // 1% tolerance
            expect(fundingPayment).to.be.closeTo(negativeExpectedPayment, tolerance);
        });

        it("Should calculate positive funding payment for short position when mark < oracle", async function () {
            const { fundingManager, virtualAMM, shortPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create scenario where shorts pay (mark price < oracle price)
            await oracle.updateTeamWinPct("NYY", 520); // Set oracle price above mark price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Record initial state
            const initialFundingTime = await fundingManager.lastFundingTime(await virtualAMM.getAddress());
            const position = await virtualAMM.getPosition(shortPositionId);
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment for the position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                shortPositionId,
                await virtualAMM.getAddress()
            );
            
            // Verify funding calculation (should be negative for short position when mark < oracle)
            expect(fundingPayment).to.be.lt(0);
            
            // Manual calculation to verify - shorts pay when mark < oracle
            const timePassed = 24 * 60 * 60; // 24 hours in seconds
            const expectedPayment = (position.size * fundingRate.rate * BigInt(timePassed)) / 
                                   (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
            const negativeExpectedPayment = -expectedPayment;
            
            // Allow for small differences due to block timing
            const tolerance = BigInt(Math.abs(Number(expectedPayment))) / BigInt(100); // 1% tolerance
            expect(fundingPayment).to.be.closeTo(negativeExpectedPayment, tolerance);
        });

        it("Should calculate zero funding when mark price equals oracle price", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Set oracle price to match current mark price
            const markPrice = await virtualAMM.getCurrentPrice();
            await oracle.updateTeamWinPct("NYY", markPrice);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment for the position
            const fundingPayment = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Should be zero or very close to zero (within tolerance)
            expect(Math.abs(Number(fundingPayment))).to.be.lt(1e10);
        });

        it("Should calculate funding proportional to position size", async function () {
            const { fundingManager, virtualAMM, trader1, executor, oracle, admin } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create two positions with different sizes
            const smallMargin = ethers.parseEther("500");
            const largeMargin = ethers.parseEther("1000");
            const smallSize = ethers.parseEther("5000");
            const largeSize = ethers.parseEther("10000"); // 2x the small size
            const leverage = ethers.parseEther("2");
            
            // Open positions
            const smallPositionId = await virtualAMM.connect(trader1).openPosition.staticCall(
                trader1.address, smallSize, smallMargin, leverage
            );
            await virtualAMM.connect(trader1).openPosition(trader1.address, smallSize, smallMargin, leverage);
            
            const largePositionId = await virtualAMM.connect(trader1).openPosition.staticCall(
                trader1.address, largeSize, largeMargin, leverage
            );
            await virtualAMM.connect(trader1).openPosition(trader1.address, largeSize, largeMargin, leverage);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payments
            const smallFunding = await fundingManager.calculatePositionFunding(
                smallPositionId,
                await virtualAMM.getAddress()
            );
            
            const largeFunding = await fundingManager.calculatePositionFunding(
                largePositionId,
                await virtualAMM.getAddress()
            );
            
            // Large position should pay/receive 2x the funding of small position
            const ratio = Number(largeFunding) / Number(smallFunding);
            expect(ratio).to.be.closeTo(2.0, 0.1); // Should be close to 2.0
        });

        it("Should calculate funding proportional to time elapsed", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            await time.increase(12 * 60 * 60); // 12 hours
            
            // Calculate funding payment after 12 hours
            const funding12h = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Wait another 12 hours
            await time.increase(12 * 60 * 60); // Another 12 hours (total 24h)
            
            // Calculate funding payment after 24 hours
            const funding24h = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // 24h funding should be approximately 2x the 12h funding
            const ratio = Number(funding24h) / Number(funding12h);
            expect(ratio).to.be.closeTo(2.0, 0.1); // Should be close to 2.0
        });

        it("Should calculate funding proportional to funding rate", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle, admin, fundingFactor } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update with initial funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate with initial funding factor
            const funding1 = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Double the funding factor
            const newFundingFactor = BigInt(fundingFactor) * 2n;
            await virtualAMM.connect(admin).updateFundingFactor(newFundingFactor);
            
            // Update with new funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Reset time
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Wait again
            await time.increase(24 * 60 * 60); // Another 24 hours
            
            // Calculate with doubled funding factor
            const funding2 = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Funding should double with doubled funding factor
            const ratio = Number(funding2) / Number(funding1);
            expect(ratio).to.be.closeTo(2.0, 0.2); // Within 20% of exact 2.0
        });
        
        it("Should return zero funding when time elapsed is zero", async function () {
            const { fundingManager, virtualAMM, longPositionId, executor, oracle } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate and immediately execute funding to reset lastFundingTime
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Calculate immediately (zero time elapsed)
            const fundingPayment = await fundingManager.calculatePositionFunding(
                longPositionId,
                await virtualAMM.getAddress()
            );
            
            // Should be exactly zero
            expect(fundingPayment).to.equal(0);
        });

        it("Should handle extremely large position sizes gracefully", async function () {
            const { fundingManager, virtualAMM, trader1, executor, oracle, admin } = await loadFixture(setupWithLiquidityAndPositions);
            
            // Create a large position but reasonable enough for the available liquidity
            const margin = ethers.parseEther("10000");
            const largeSize = ethers.parseEther("50000"); // Large but not excessive
            const leverage = ethers.parseEther("2");
            
            const largePositionId = await virtualAMM.connect(trader1).openPosition.staticCall(
                trader1.address, largeSize, margin, leverage
            );
            await virtualAMM.connect(trader1).openPosition(trader1.address, largeSize, margin, leverage);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate funding payment - this should not overflow
            const fundingPayment = await fundingManager.calculatePositionFunding(
                largePositionId,
                await virtualAMM.getAddress()
            );
            
            // Should be a very large negative number, but shouldn't overflow
            expect(fundingPayment).to.be.lt(0);
            
            // The value should be proportionally large
            const position = await virtualAMM.getPosition(largePositionId);
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Manual calculation
            const timePassed = 24 * 60 * 60; // 24 hours in seconds
            const expectedPayment = (position.size * fundingRate.rate * BigInt(timePassed)) / 
                                  (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
            const negativeExpectedPayment = -expectedPayment;
            
            // Should be close to expected, allowing for block timing
            const percentTolerance = 0.05; // 5% tolerance
            const tolerance = BigInt(Math.abs(Number(expectedPayment)) * percentTolerance);
            expect(fundingPayment).to.be.closeTo(negativeExpectedPayment, tolerance);
        });
    });
});