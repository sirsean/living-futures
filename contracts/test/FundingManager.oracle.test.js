const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundingManager Oracle Integration", function () {
    // Test fixture to deploy contracts
    async function deployFundingManagerFixture() {
        const [owner, admin, executor] = await ethers.getSigners();

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

        // Deploy real FundingManager (not mock) to test oracle integration
        const FundingManager = await ethers.getContractFactory("FundingManager");
        const fundingManager = await FundingManager.deploy(
            await oracle.getAddress(),
            admin.address
        );

        // Set up roles
        const ADMIN_ROLE = await fundingManager.ADMIN_ROLE();
        const FUNDING_EXECUTOR_ROLE = await fundingManager.FUNDING_EXECUTOR_ROLE();
        const AMM_FUNDING_ROLE = await virtualAMM.FUNDING_ROLE();

        await fundingManager.connect(admin).grantRole(FUNDING_EXECUTOR_ROLE, executor.address);
        await virtualAMM.connect(admin).grantRole(AMM_FUNDING_ROLE, await fundingManager.getAddress());

        // Mint tokens and approve
        const initialBalance = ethers.parseEther("10000");
        await collateralToken.mint(admin.address, initialBalance);
        await collateralToken.connect(admin).approve(await virtualAMM.getAddress(), ethers.MaxUint256);

        // Set initial oracle price
        await oracle.updateTeamWinPct("NYY", 500);

        return {
            owner,
            admin,
            executor,
            virtualAMM,
            collateralToken,
            oracle,
            fundingManager,
            ADMIN_ROLE,
            FUNDING_EXECUTOR_ROLE
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

        // Add liquidity
        const liquidityAmount = ethers.parseEther("10000");
        await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

        return { ...contracts, fundingCap };
    }

    describe("Oracle Price Integration", function () {
        it("Should use real oracle price instead of hardcoded 500", async function () {
            const { fundingManager, virtualAMM, executor, oracle } = await loadFixture(setupWithRegisteredAMM);
            
            // Set oracle price to something different from the default 500
            const testOraclePrice = 600;
            await oracle.updateTeamWinPct("NYY", testOraclePrice);
            
            // Update funding rate - this should now use real oracle price
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            // Get the funding rate data
            const fundingRateData = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            
            // The oracle price stored in funding rate data should match what we set
            expect(fundingRateData.oraclePrice).to.equal(testOraclePrice);
            
            // The oracle price should NOT be the old hardcoded 500
            expect(fundingRateData.oraclePrice).to.not.equal(500);
        });

        it("Should calculate funding rate based on dynamic oracle price", async function () {
            const { fundingManager, virtualAMM, executor, oracle, admin, collateralToken } = await loadFixture(setupWithRegisteredAMM);
            
            // Mint additional tokens for the position
            await collateralToken.mint(admin.address, ethers.parseEther("5000"));
            
            // Create position imbalance to move market price
            const margin = ethers.parseEther("1000");
            const size = ethers.parseEther("5000");
            const leverage = ethers.parseEther("2");
            
            await virtualAMM.connect(admin).openPosition(admin.address, size, margin, leverage);
            
            // Get current market price (should be above 500 due to long position)
            const markPrice = await virtualAMM.getCurrentPrice();
            expect(markPrice).to.be.gt(500);
            
            // Test with oracle price below market price
            const lowOraclePrice = 480;
            await oracle.updateTeamWinPct("NYY", lowOraclePrice);
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            let fundingRateData = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            expect(fundingRateData.oraclePrice).to.equal(lowOraclePrice);
            expect(fundingRateData.rate).to.be.gt(0); // Positive funding rate (longs pay shorts)
            
            // Test with oracle price above market price  
            const highOraclePrice = 600;
            await oracle.updateTeamWinPct("NYY", highOraclePrice);
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress());
            
            fundingRateData = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            expect(fundingRateData.oraclePrice).to.equal(highOraclePrice);
            
            // Verify the funding rate calculation is correct based on mark vs oracle price
            const currentMarkPrice = await virtualAMM.getCurrentPrice();
            if (currentMarkPrice > highOraclePrice) {
                expect(fundingRateData.rate).to.be.gt(0); // Positive funding rate (longs pay shorts)
            } else {
                expect(fundingRateData.rate).to.be.lt(0); // Negative funding rate (shorts pay longs) 
            }
        });

        it("Should use team-specific oracle prices for different AMMs", async function () {
            const { oracle, admin, collateralToken, fundingManager, executor } = await loadFixture(deployFundingManagerFixture);
            
            // Deploy second AMM for different team
            const VirtualAMM = await ethers.getContractFactory("VirtualAMM");
            const sensitivityParameter = ethers.parseEther("1");
            const fundingFactor = "500000000000000";
            const minMarginRatio = ethers.parseEther("0.1");
            const tradingFeeRate = "3000000000000000";
            
            const virtualAMM_BOS = await VirtualAMM.deploy(
                await collateralToken.getAddress(),
                await oracle.getAddress(),
                "BOS", // Different team
                admin.address,
                sensitivityParameter,
                fundingFactor,
                minMarginRatio,
                tradingFeeRate
            );

            // Register both AMMs
            const fundingCap = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.2"),
                emergencyThreshold: ethers.parseEther("0.15"),
                maxDebtAge: 7 * 24 * 3600
            };

            await fundingManager.connect(admin).registerAMM(await virtualAMM_BOS.getAddress(), fundingCap);

            // Set different oracle prices for each team
            await oracle.updateTeamWinPct("NYY", 450);
            await oracle.updateTeamWinPct("BOS", 650);

            // Add liquidity to BOS AMM
            await collateralToken.mint(admin.address, ethers.parseEther("10000"));
            await collateralToken.connect(admin).approve(await virtualAMM_BOS.getAddress(), ethers.MaxUint256);
            await virtualAMM_BOS.connect(admin).addLiquidity(ethers.parseEther("10000"));

            // Update funding rates for BOS AMM
            await fundingManager.connect(executor).updateFundingRate(await virtualAMM_BOS.getAddress());
            
            // Verify each AMM uses its own team's oracle price
            const bosRateData = await fundingManager.getCurrentFundingRate(await virtualAMM_BOS.getAddress());
            expect(bosRateData.oraclePrice).to.equal(650); // BOS price
        });
    });
});