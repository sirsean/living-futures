const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundingManager Funding Rate Calculation", function () {
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
            EMERGENCY_ROLE
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
        const liquidityAmount = ethers.parseEther("50000"); // More liquidity for larger test positions
        await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

        return { ...contracts, liquidityAmount };
    }

    // Helper function to calculate expected funding rate
    function calculateExpectedFundingRate(markPrice, oraclePrice, fundingFactor) {
        // Premium = (markPrice - oraclePrice) / oraclePrice
        const premium = Number(markPrice - oraclePrice) / Number(oraclePrice);
        
        // Convert to bigint with 18 decimals precision
        const premiumBigInt = BigInt(Math.floor(premium * 1e18));
        
        // FundingRate = Premium * FundingFactor / 1e18
        return (premiumBigInt * BigInt(fundingFactor)) / BigInt(1e18);
    }

    describe("Funding Rate Calculations", function () {
        it("Should return zero funding rate with no price divergence", async function () {
            const { fundingManager, virtualAMM, executor, oracle } = await setupWithLiquidity();
            
            // Set oracle price to match AMM price (500)
            await oracle.updateTeamWinPct("NYY", 500);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Get funding rate
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Expect rate to be zero or very close to zero
            expect(Math.abs(Number(fundingRate.rate))).to.be.lessThan(1e12); // Very close to zero
        });

        it("Should calculate positive funding rate when mark price > oracle price", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create long positions to increase the mark price
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("5000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, size, margin, leverage);
            
            // Get current mark price after opening positions
            const markPrice = await virtualAMM.getCurrentPrice();
            expect(markPrice).to.be.gt(500); // Verify mark price increased
            
            // Set oracle price lower than mark price
            const oraclePrice = 450;
            await oracle.updateTeamWinPct("NYY", oraclePrice);
            
            // Get funding factor
            const fundingFactor = (await virtualAMM.getParameters())[1];
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Get actual funding rate
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Funding rate should be positive (longs pay shorts)
            expect(fundingRate.rate).to.be.gt(0);
            
            // Verify rate components
            expect(fundingRate.markPrice).to.equal(markPrice);
            expect(fundingRate.oraclePrice).to.equal(oraclePrice);
            
            // Calculate expected funding rate
            const expectedRate = calculateExpectedFundingRate(
                Number(markPrice), 
                Number(oraclePrice), 
                Number(fundingFactor)
            );
            
            // Calculate percentage difference for tolerance check
            const percentDiff = Math.abs(Number(fundingRate.rate - expectedRate)) / Number(fundingRate.rate);
            expect(percentDiff).to.be.lessThan(0.2); // Within 20% of calculated value
        });

        it("Should calculate negative funding rate when mark price < oracle price", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create short positions to decrease the mark price
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("5000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, -size, margin, leverage);
            
            // Get current mark price after opening positions
            const markPrice = await virtualAMM.getCurrentPrice();
            expect(markPrice).to.be.lt(500); // Verify mark price decreased
            
            // Set oracle price higher than mark price
            const oraclePrice = 550;
            await oracle.updateTeamWinPct("NYY", oraclePrice);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Get actual funding rate
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Funding rate should be negative (shorts pay longs)
            expect(fundingRate.rate).to.be.lt(0);
            
            // Verify rate components
            expect(fundingRate.markPrice).to.equal(markPrice);
            expect(fundingRate.oraclePrice).to.equal(oraclePrice);
        });

        it("Should adjust funding rate based on fundingFactor parameter", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create positions to create a price gap
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("5000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, size, margin, leverage);
            
            // Set oracle price lower to ensure positive funding rate
            const oraclePrice = 450;
            await oracle.updateTeamWinPct("NYY", oraclePrice);
            
            // Update with initial funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const initialFundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Double the funding factor
            const initialFundingFactor = (await virtualAMM.getParameters())[1];
            const newFundingFactor = BigInt(initialFundingFactor) * 2n;
            await virtualAMM.connect(admin).updateFundingFactor(newFundingFactor);
            
            // Update rate with new funding factor
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const newFundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // New rate should be approximately double the initial rate
            // Using relative comparison with 20% tolerance for numerical precision
            const ratio = Number(newFundingRate.rate) / Number(initialFundingRate.rate);
            expect(ratio).to.be.closeTo(2.0, 0.2); // Should be close to 2.0
        });

        it("Should calculate rate proportional to price premium", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create small price divergence
            const smallMargin = ethers.parseEther("500");
            const smallSize = ethers.parseEther("2000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, smallSize, smallMargin, leverage);
            
            // Set oracle price to create a premium
            await oracle.updateTeamWinPct("NYY", 450);
            
            // Update rate with small divergence
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const smallDivergenceRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Create larger price divergence with additional positions
            const largeSize = ethers.parseEther("8000");
            await virtualAMM.connect(admin).openPosition(admin.address, largeSize, smallMargin * 4n, leverage);
            
            // Update rate with large divergence
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const largeDivergenceRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Large divergence rate should be significantly larger than small divergence rate
            // Not exactly proportional due to sigmoid pricing function, but should be larger
            expect(Number(largeDivergenceRate.rate)).to.be.gt(Number(smallDivergenceRate.rate) * 1.2);
        });

        it("Should handle extreme price divergence gracefully", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create extreme price divergence
            const margin = ethers.parseEther("10000");
            const extremeSize = ethers.parseEther("40000");
            const leverage = ethers.parseEther("4");
            
            await virtualAMM.connect(admin).openPosition(admin.address, extremeSize, margin, leverage);
            
            // Set oracle price to maximize divergence
            await oracle.updateTeamWinPct("NYY", 400);
            
            // Update rate with extreme divergence
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Rate should be positive but not overflow or be unreasonably large
            expect(fundingRate.rate).to.be.gt(0);
            expect(fundingRate.rate).to.be.lt(ethers.parseEther("1")); // Should be less than 100%
        });

        it("Should calculate zero rate when AMM has no liquidity", async function () {
            const { fundingManager, virtualAMM, executor } = await setupWithRegisteredAMM();
            
            // No liquidity added, virtualAMM price should be at center
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Get funding rate
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Price should be at center (500) with no divergence from oracle
            expect(fundingRate.markPrice).to.equal(500);
            expect(Math.abs(Number(fundingRate.rate))).to.be.lessThan(1e12); // Very close to zero
        });

        it("Should properly fetch and use oracle price for calculation", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create some positions to move market price
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("5000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, size, margin, leverage);
            
            // Set various oracle prices and verify correct calculation
            const testOraclePrices = [400, 500, 600, 700];
            
            for (const oraclePrice of testOraclePrices) {
                // Set oracle price
                await oracle.updateTeamWinPct("NYY", oraclePrice);
                
                // Update funding rate
                await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
                
                // Get actual funding rate
                const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
                
                // Verify correct oracle price was used
                expect(fundingRate.oraclePrice).to.equal(oraclePrice);
            }
        });

        it("Should have rate close to zero when price difference is minimal", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create small positions
            const margin = ethers.parseEther("500");
            const size = ethers.parseEther("1000");
            const leverage = ethers.parseEther("2");
            
            // Create balanced positions to keep price near center
            await virtualAMM.connect(admin).openPosition(admin.address, size, margin, leverage);
            await virtualAMM.connect(admin).openPosition(admin.address, -size, margin, leverage);
            
            // Set oracle close to market price
            const markPrice = await virtualAMM.getCurrentPrice();
            await oracle.updateTeamWinPct("NYY", markPrice);
            
            // Update funding rate
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // Rate should be very close to zero
            expect(Math.abs(Number(fundingRate.rate))).to.be.lessThan(1e13);
        });

        it("Should maintain consistent calculation formula", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin } = await setupWithLiquidity();
            
            // Create position to move price
            await virtualAMM.connect(admin).openPosition(
                admin.address,
                ethers.parseEther("5000"),  // size
                ethers.parseEther("1000"),  // margin
                ethers.parseEther("2")      // leverage
            );
            
            // Get mark price
            const markPrice = await virtualAMM.getCurrentPrice();
            
            // Test with different oracle prices to verify formula
            const testOraclePrices = [400, 450, 500, 550, 600];
            
            for (const oraclePrice of testOraclePrices) {
                // Set oracle price
                await oracle.updateTeamWinPct("NYY", oraclePrice);
                
                // Get funding factor
                const fundingFactor = (await virtualAMM.getParameters())[1];
                
                // Update funding rate
                await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
                const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
                
                // Calculate expected rate based on formula
                const expectedRate = calculateExpectedFundingRate(
                    Number(markPrice),
                    Number(oraclePrice),
                    Number(fundingFactor)
                );
                
                // Calculate percentage difference for tolerance check
                const percentDiff = Math.abs(Number(fundingRate.rate - expectedRate)) / Math.max(1, Math.abs(Number(fundingRate.rate)));
                expect(percentDiff).to.be.lessThan(0.3); // Within 30% due to approximation differences
            }
        });
    });
});