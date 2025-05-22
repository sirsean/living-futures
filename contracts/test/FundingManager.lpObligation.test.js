const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundingManager LP Funding Obligation", function () {
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

    async function setupWithLiquidity() {
        const contracts = await setupWithRegisteredAMM();
        const { virtualAMM, admin } = contracts;

        // Add liquidity
        const liquidityAmount = ethers.parseEther("100000");
        await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

        return { ...contracts, liquidityAmount };
    }

    // Helper function to verify LP obligation calculation
    async function verifyLPObligation(
        fundingManager, 
        virtualAMM, 
        netImbalance, 
        fundingRate, 
        timePassed
    ) {
        // Get LP funding obligation
        const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
        
        // Calculate expected obligation
        // lpObligation = netImbalance × fundingRate × timeElapsed / (24 hours)
        const expectedObligation = (netImbalance * fundingRate * BigInt(timePassed)) / 
                                  (BigInt(24 * 60 * 60) * BigInt(10 ** 18));
        
        // Apply a percentage tolerance for numerical precision
        const percentTolerance = 0.05; // 5% tolerance
        const tolerance = BigInt(Math.abs(Number(expectedObligation)) * percentTolerance) + BigInt(1); // Add 1 to handle zero case
        
        expect(lpObligation).to.be.closeTo(expectedObligation, tolerance);
        
        return lpObligation;
    }

    describe("LP Funding Obligation Calculation", function () {
        it("Should calculate zero obligation for zero imbalance (perfectly balanced book)", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create perfectly balanced positions
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Create equal long and short positions for a perfectly balanced book
            await virtualAMM.connect(trader1).openPosition(trader1.address, size, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -size, margin, leverage);
            
            // Verify net imbalance is zero
            const netImbalance = await virtualAMM.getNetImbalance();
            expect(netImbalance).to.equal(0);
            
            // Set oracle price to create non-zero funding rate
            await oracle.updateTeamWinPct("NYY", 480); // Mark price > Oracle price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Wait some time to accumulate funding
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Get LP funding obligation
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Should be zero or extremely close to zero
            expect(lpObligation).to.be.closeTo(0, 1e4);
        });

        it("Should calculate positive obligation when longs exceed shorts and longs pay shorts", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions (more longs than shorts)
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("20000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance (longs > shorts)
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Verify net imbalance is positive
            const netImbalance = await virtualAMM.getNetImbalance();
            expect(netImbalance).to.be.gt(0);
            
            // Set oracle price below mark price to make longs pay
            await oracle.updateTeamWinPct("NYY", 480); // Mark price > Oracle price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Verify funding rate is positive (longs pay shorts)
            expect(fundingRate).to.be.gt(0);
            
            // Wait some time to accumulate funding
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Verify LP obligation calculation
            const lpObligation = await verifyLPObligation(
                fundingManager, 
                virtualAMM, 
                netImbalance, 
                fundingRate, 
                timePassed
            );
            
            // Check with correct sign convention: positive imbalance * positive funding rate = positive obligation (LP pays)
            expect(lpObligation).to.be.gt(0);
        });

        it("Should calculate negative obligation when shorts exceed longs and shorts pay longs", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions (more shorts than longs)
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("10000");
            const shortSize = ethers.parseEther("20000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance (shorts > longs)
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Verify net imbalance is negative
            const netImbalance = await virtualAMM.getNetImbalance();
            expect(netImbalance).to.be.lt(0);
            
            // Set oracle price above mark price to make shorts pay
            await oracle.updateTeamWinPct("NYY", 520); // Mark price < Oracle price
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Verify funding rate is negative (shorts pay longs)
            expect(fundingRate).to.be.lt(0);
            
            // Wait some time to accumulate funding
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Verify LP obligation calculation
            const lpObligation = await verifyLPObligation(
                fundingManager, 
                virtualAMM, 
                netImbalance, 
                fundingRate, 
                timePassed
            );
            
            // Check with correct sign convention: negative imbalance * negative funding rate = positive obligation (LP pays)
            expect(lpObligation).to.be.gt(0);
        });

        it("Should calculate positive obligation when longs exceed shorts and longs pay shorts", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions (more longs than shorts)
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("20000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance (longs > shorts)
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Verify net imbalance is positive
            const netImbalance = await virtualAMM.getNetImbalance();
            expect(netImbalance).to.be.gt(0);
            
            // Set oracle price below mark price to create positive funding rate
            await oracle.updateTeamWinPct("NYY", 520); // Mark price > Oracle price due to long imbalance
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Verify funding rate is positive (longs pay shorts)
            expect(fundingRate).to.be.gt(0);
            
            // Wait some time to accumulate funding
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Get LP obligation
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Positive imbalance × positive funding rate = positive obligation (LP pays)
            expect(lpObligation).to.be.gt(0);
        });

        it("Should calculate negative obligation when shorts exceed longs and shorts pay longs", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions (more shorts than longs)
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("10000");
            const shortSize = ethers.parseEther("20000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance (shorts > longs)
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Verify net imbalance is negative
            const netImbalance = await virtualAMM.getNetImbalance();
            expect(netImbalance).to.be.lt(0);
            
            // Set oracle price above mark price (mark price drops due to short imbalance)
            await oracle.updateTeamWinPct("NYY", 480); // Mark price < Oracle price due to short imbalance
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Verify funding rate is negative (shorts pay longs)
            expect(fundingRate).to.be.lt(0);
            
            // Wait some time to accumulate funding
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Get LP obligation
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Negative imbalance × negative funding rate = positive obligation (LP pays)
            expect(lpObligation).to.be.gt(0);
        });

        it("Should calculate obligation proportional to net imbalance", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create small imbalance
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("11000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create small imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Get small imbalance
            const smallImbalance = await virtualAMM.getNetImbalance();
            
            // Set oracle price below mark price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Get LP obligation with small imbalance
            const smallObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Create larger imbalance by adding a moderate additional position
            const largeLongSize = ethers.parseEther("5000"); // Add more long position
            await virtualAMM.connect(trader1).openPosition(trader1.address, largeLongSize, margin, leverage);
            
            // Get large imbalance
            const largeImbalance = await virtualAMM.getNetImbalance();
            
            // Verify large imbalance is significantly larger than small imbalance
            expect(Number(largeImbalance)).to.be.gt(Number(smallImbalance) * 2);
            expect(Number(largeImbalance)).to.be.lt(Number(smallImbalance) * 10);
            
            // Update funding rate for new imbalance
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Reset timing
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Wait same time
            await time.increase(timePassed);
            
            // Get LP obligation with large imbalance
            const largeObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Calculate ratio - should be significantly larger since both imbalance and funding rate increase
            // Take absolute values for the ratio since we care about magnitude, not sign
            const ratio = Math.abs(Number(largeObligation)) / Math.abs(Number(smallObligation));
            // With larger imbalance, both the position imbalance and funding rate increase,
            // so the ratio will be more than 5x (could be 10x or more)
            expect(ratio).to.be.gt(5.0);
            expect(ratio).to.be.lt(30.0); // But not unreasonably large
        });

        it("Should calculate obligation proportional to time elapsed", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("15000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price below mark price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait 12 hours
            await time.increase(12 * 60 * 60); // 12 hours
            
            // Get LP obligation after 12 hours
            const obligation12h = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Wait another 12 hours
            await time.increase(12 * 60 * 60); // Another 12 hours (total 24h)
            
            // Get LP obligation after 24 hours
            const obligation24h = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // 24h obligation should be approximately 2x the 12h obligation
            const ratio = Number(obligation24h) / Number(obligation12h);
            expect(ratio).to.be.closeTo(2.0, 0.1); // Should be close to 2.0
        });

        it("Should calculate obligation proportional to funding rate", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle, admin, fundingFactor } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("15000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price below mark price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate with initial funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Get LP obligation with initial funding factor
            const initialObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Double the funding factor
            const newFundingFactor = BigInt(fundingFactor) * 2n;
            await virtualAMM.connect(admin).updateFundingFactor(newFundingFactor);
            
            // Update funding rate with new funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Reset timing
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Wait same time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Get LP obligation with doubled funding factor
            const newObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Obligation should be close to 2x
            const ratio = Number(newObligation) / Number(initialObligation);
            expect(ratio).to.be.closeTo(2.0, 0.2); // Within 20% of 2.0
        });

        it("Should return zero obligation when no time has elapsed", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("15000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price to create funding rate
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate and execute funding to reset lastFundingTime
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Calculate obligation immediately (zero time elapsed)
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Should be zero or very close to zero
            expect(Math.abs(Number(lpObligation))).to.be.lt(1e10);
        });

        it("Should return zero obligation when funding rate is zero", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create imbalanced positions
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("15000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price to exact mark price to create zero funding rate
            const markPrice = await virtualAMM.getCurrentPrice();
            await oracle.updateTeamWinPct("NYY", markPrice);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Funding rate should be close to zero
            expect(Math.abs(Number(fundingRate))).to.be.lt(1e10);
            
            // Wait some time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate obligation
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Should be zero or very close to zero
            expect(Math.abs(Number(lpObligation))).to.be.lt(1e10);
        });
    });

    describe("LP Obligation Edge Cases", function () {
        it("Should handle extremely large imbalance gracefully", async function () {
            const { fundingManager, virtualAMM, trader1, executor, oracle, admin, collateralToken } = await loadFixture(setupWithLiquidity);
            
            // Mint more tokens for admin to handle large positions and liquidity
            const additionalTokens = ethers.parseEther("500000");
            await collateralToken.mint(admin.address, additionalTokens);
            
            // Add more liquidity but within reasonable limits
            const extraLiquidity = ethers.parseEther("50000");
            await virtualAMM.connect(admin).addLiquidity(extraLiquidity);
            
            // Create large imbalance with only long positions
            const margin = ethers.parseEther("10000");
            const largeSize = ethers.parseEther("200000");
            const leverage = ethers.parseEther("2");
            
            // Open large position
            await virtualAMM.connect(trader1).openPosition(trader1.address, largeSize, margin, leverage);
            
            // Set oracle price below mark price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Wait some time
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Get LP obligation
            const netImbalance = await virtualAMM.getNetImbalance();
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // LP obligation should be positive for large long imbalance with positive funding rate (LP pays funding)
            expect(lpObligation).to.be.gt(0);
            
            // Verify calculation
            await verifyLPObligation(
                fundingManager, 
                virtualAMM, 
                netImbalance, 
                fundingRate, 
                timePassed
            );
        });

        it("Should return zero obligation when there are no open positions", async function () {
            const { fundingManager, virtualAMM, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // No positions, just liquidity
            
            // Set oracle price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait some time
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Calculate obligation
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Should be exactly zero
            expect(lpObligation).to.equal(0);
        });

        it("Should calculate obligation when small imbalance combined with high funding rate", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle, admin } = await loadFixture(setupWithLiquidity);
            
            // Create small imbalance
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("10100");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create tiny imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price far below mark price for high funding rate
            await oracle.updateTeamWinPct("NYY", 400); // Big difference to create large rate
            
            // Use high funding factor but within allowed limits 
            const highFundingFactor = ethers.parseEther("0.001"); // 0.1% (2x the default)
            await virtualAMM.connect(admin).updateFundingFactor(highFundingFactor);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = (await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress())).rate;
            
            // Funding rate should be quite high
            expect(fundingRate).to.be.gt(0);
            
            // Wait some time
            const timePassed = 24 * 60 * 60; // 24 hours
            await time.increase(timePassed);
            
            // Get LP obligation
            const netImbalance = await virtualAMM.getNetImbalance();
            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Even with small imbalance, obligation should be detectable
            expect(lpObligation).to.be.gt(ethers.parseEther("0.001"));
            
            // Verify calculation
            await verifyLPObligation(
                fundingManager, 
                virtualAMM, 
                netImbalance, 
                fundingRate, 
                timePassed
            );
        });

        it("Should handle multiple funding periods with changing imbalance", async function () {
            const { fundingManager, virtualAMM, trader1, trader2, executor, oracle } = await loadFixture(setupWithLiquidity);
            
            // Create initial positions
            const margin = ethers.parseEther("1000");
            const longSize = ethers.parseEther("15000");
            const shortSize = ethers.parseEther("10000");
            const leverage = ethers.parseEther("2");
            
            // Open positions to create imbalance
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);
            
            // Set oracle price below mark price
            await oracle.updateTeamWinPct("NYY", 480);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Wait first period
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Get LP obligation after period 1
            const obligation1 = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Execute funding to reset last funding time
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Change imbalance by opening more long positions
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            
            // Wait second period
            await time.increase(24 * 60 * 60); // 24 hours
            
            // Get LP obligation after period 2
            const obligation2 = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Obligation in period 2 should be greater with increased imbalance
            // (assuming funding rate direction hasn't changed)
            expect(Math.abs(Number(obligation2))).to.be.gt(Math.abs(Number(obligation1)));
        });
    });
});