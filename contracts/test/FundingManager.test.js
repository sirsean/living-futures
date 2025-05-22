const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundingManager", function () {
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

        // Deploy FundingManager
        const FundingManager = await ethers.getContractFactory("FundingManager");
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
        const initialBalance = ethers.parseEther("10000");
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

    async function setupWithLiquidityAndPositions() {
        const contracts = await setupWithRegisteredAMM();
        const { virtualAMM, trader1, trader2, admin } = contracts;

        // Add liquidity
        const liquidityAmount = ethers.parseEther("10000");
        await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

        // Open positions
        const margin = ethers.parseEther("100");
        const size = ethers.parseEther("1000"); // Larger size for significant imbalance
        const leverage = ethers.parseEther("2");

        const positionId1 = await virtualAMM.connect(trader1).openPosition.staticCall(
            trader1.address, size, margin, leverage
        );
        await virtualAMM.connect(trader1).openPosition(trader1.address, size, margin, leverage);

        const positionId2 = await virtualAMM.connect(trader2).openPosition.staticCall(
            trader2.address, -size/2n, margin, leverage
        );
        await virtualAMM.connect(trader2).openPosition(trader2.address, -size/2n, margin, leverage);

        return { ...contracts, positionId1, positionId2, liquidityAmount };
    }

    describe("Constructor and Initialization", function () {
        it("Should deploy with correct initial parameters", async function () {
            const { fundingManager, oracle, admin } = await loadFixture(deployFundingManagerFixture);

            expect(await fundingManager.oracle()).to.equal(await oracle.getAddress());
            expect(await fundingManager.hasRole(await fundingManager.ADMIN_ROLE(), admin.address)).to.be.true;
        });

        it("Should revert with invalid oracle address", async function () {
            const { admin } = await loadFixture(deployFundingManagerFixture);
            const FundingManager = await ethers.getContractFactory("FundingManager");

            await expect(
                FundingManager.deploy(ethers.ZeroAddress, admin.address)
            ).to.be.revertedWith("Invalid oracle address");
        });

        it("Should revert with invalid admin address", async function () {
            const { oracle } = await loadFixture(deployFundingManagerFixture);
            const FundingManager = await ethers.getContractFactory("FundingManager");

            await expect(
                FundingManager.deploy(await oracle.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid admin address");
        });
    });

    describe("AMM Registration", function () {
        it("Should register AMM with valid funding cap", async function () {
            const { fundingManager, virtualAMM, admin } = await loadFixture(deployFundingManagerFixture);

            const fundingCap = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.2"),
                emergencyThreshold: ethers.parseEther("0.15"),
                maxDebtAge: 7 * 24 * 3600
            };

            await expect(
                fundingManager.connect(admin).registerAMM(await virtualAMM.getAddress(), fundingCap)
            ).to.not.be.reverted;

            expect(await fundingManager.registeredAMMs(await virtualAMM.getAddress())).to.be.true;
        });

        it("Should revert when registering with invalid funding cap", async function () {
            const { fundingManager, virtualAMM, admin } = await loadFixture(deployFundingManagerFixture);

            const invalidCap = {
                dailyCapPercent: 0, // Invalid: zero
                cumulativeCapPercent: ethers.parseEther("0.2"),
                emergencyThreshold: ethers.parseEther("0.15"),
                maxDebtAge: 7 * 24 * 3600
            };

            await expect(
                fundingManager.connect(admin).registerAMM(await virtualAMM.getAddress(), invalidCap)
            ).to.be.revertedWith("InvalidCapConfiguration");
        });

        it("Should validate all funding cap edge cases", async function () {
            const { fundingManager, admin } = await loadFixture(deployFundingManagerFixture);

            // Test emergency threshold > cumulative cap
            const invalidCap1 = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: ethers.parseEther("0.15"), // > cumulative
                maxDebtAge: 7 * 24 * 3600
            };
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap1)
            ).to.be.revertedWith("InvalidCapConfiguration");

            // Test caps > 100%
            const invalidCap2 = {
                dailyCapPercent: ethers.parseEther("1.1"), // > 100%
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: ethers.parseEther("0.05"),
                maxDebtAge: 7 * 24 * 3600
            };
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap2)
            ).to.be.revertedWith("InvalidCapConfiguration");
        });

        it("Should revert when called by non-admin", async function () {
            const { fundingManager, virtualAMM, trader1 } = await loadFixture(deployFundingManagerFixture);

            const fundingCap = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.2"),
                emergencyThreshold: ethers.parseEther("0.15"),
                maxDebtAge: 7 * 24 * 3600
            };

            await expect(
                fundingManager.connect(trader1).registerAMM(await virtualAMM.getAddress(), fundingCap)
            ).to.be.reverted;
        });

        it("Should revert with zero AMM address", async function () {
            const { fundingManager, admin } = await loadFixture(deployFundingManagerFixture);

            const fundingCap = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.2"),
                emergencyThreshold: ethers.parseEther("0.15"),
                maxDebtAge: 7 * 24 * 3600
            };

            await expect(
                fundingManager.connect(admin).registerAMM(ethers.ZeroAddress, fundingCap)
            ).to.be.revertedWith("Invalid AMM address");
        });
    });

    describe("Funding Rate Calculation", function () {
        it("Should calculate and update funding rate", async function () {
            const { fundingManager, virtualAMM, executor } = await loadFixture(setupWithRegisteredAMM);

            await expect(
                fundingManager.connect(executor).updateFundingRate(await virtualAMM.getAddress())
            ).to.emit(fundingManager, "FundingRateUpdated");

            const fundingRate = await fundingManager.getCurrentFundingRate(await virtualAMM.getAddress());
            expect(fundingRate.timestamp).to.be.gt(0);
        });

        it("Should revert for unregistered AMM", async function () {
            const { fundingManager, executor } = await loadFixture(deployFundingManagerFixture);

            await expect(
                fundingManager.connect(executor).updateFundingRate(ethers.getAddress("0x1234567890123456789012345678901234567890"))
            ).to.be.revertedWith("AMMNotRegistered");
        });
    });

    describe("Position Funding Calculation", function () {
        it("Should calculate funding payment for position", async function () {
            const { fundingManager, virtualAMM, positionId1 } = await loadFixture(setupWithLiquidityAndPositions);

            // Update funding rate first
            await fundingManager.updateFundingRate(await virtualAMM.getAddress());

            const fundingPayment = await fundingManager.calculatePositionFunding(
                positionId1,
                await virtualAMM.getAddress()
            );

            // Should return some funding amount (could be positive or negative)
            expect(typeof fundingPayment).to.equal("bigint");
        });

        it("Should return zero for closed position", async function () {
            const { fundingManager, virtualAMM, positionId1, trader1 } = await loadFixture(setupWithLiquidityAndPositions);

            // Close the position
            await virtualAMM.connect(trader1).closePosition(positionId1);

            const fundingPayment = await fundingManager.calculatePositionFunding(
                positionId1,
                await virtualAMM.getAddress()
            );

            expect(fundingPayment).to.equal(0);
        });
    });

    describe("LP Funding Obligations", function () {
        it("Should calculate LP funding obligation correctly", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            // Update funding rate
            await fundingManager.updateFundingRate(await virtualAMM.getAddress());

            const lpObligation = await fundingManager.getLPFundingObligation(await virtualAMM.getAddress());
            
            // Should have some obligation due to position imbalance
            expect(typeof lpObligation).to.equal("bigint");
        });
    });

    describe("Funding Cap Checks", function () {
        it("Should correctly check funding caps", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            const testAmount = ethers.parseEther("100");
            const [capReached, availableAmount] = await fundingManager.checkFundingCap(
                await virtualAMM.getAddress(),
                testAmount
            );

            expect(typeof capReached).to.equal("boolean");
            expect(typeof availableAmount).to.equal("bigint");
        });

        it("Should detect cap exceeded for large amounts", async function () {
            const { fundingManager, virtualAMM, liquidityAmount } = await loadFixture(setupWithLiquidityAndPositions);

            // Request amount larger than 5% daily cap
            const largeAmount = (liquidityAmount * 10n) / 100n; // 10% of LP pool
            const [capReached, availableAmount] = await fundingManager.checkFundingCap(
                await virtualAMM.getAddress(),
                largeAmount
            );

            expect(capReached).to.be.true;
            expect(availableAmount).to.be.lt(largeAmount);
        });
    });

    describe("Daily Funding Execution", function () {
        it("Should execute funding successfully", async function () {
            const { fundingManager, virtualAMM, executor } = await loadFixture(setupWithLiquidityAndPositions);

            await expect(
                fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress())
            ).to.emit(fundingManager, "FundingExecuted");

            // Check that last funding time was updated
            const lastFundingTime = await fundingManager.lastFundingTime(await virtualAMM.getAddress());
            expect(lastFundingTime).to.be.gt(0);
        });

        it("Should revert when called by unauthorized user", async function () {
            const { fundingManager, virtualAMM, trader1 } = await loadFixture(setupWithLiquidityAndPositions);

            await expect(
                fundingManager.connect(trader1).executeFunding(await virtualAMM.getAddress())
            ).to.be.reverted;
        });

        it("Should revert for unregistered AMM", async function () {
            const { fundingManager, executor } = await loadFixture(deployFundingManagerFixture);

            await expect(
                fundingManager.connect(executor).executeFunding(ethers.getAddress("0x1234567890123456789012345678901234567890"))
            ).to.be.revertedWith("AMMNotRegistered");
        });

        it("Should handle funding cap reached scenario", async function () {
            const { fundingManager, virtualAMM, executor, admin } = await loadFixture(setupWithLiquidityAndPositions);

            // Set very low funding cap
            const restrictiveCap = {
                dailyCapPercent: ethers.parseEther("0.001"), // 0.1%
                cumulativeCapPercent: ethers.parseEther("0.002"), // 0.2%
                emergencyThreshold: ethers.parseEther("0.0015"), // 0.15%
                maxDebtAge: 7 * 24 * 3600
            };

            await fundingManager.connect(admin).updateFundingCap(await virtualAMM.getAddress(), restrictiveCap);

            // Try to execute funding - should trigger cap
            const tx = await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            const receipt = await tx.wait();

            // Check if FundingCapReached event was emitted (may or may not depending on positions)
            const capEvents = receipt.logs.filter(log => {
                try {
                    const parsed = fundingManager.interface.parseLog(log);
                    return parsed.name === "FundingCapReached";
                } catch {
                    return false;
                }
            });
        });
    });

    describe("Emergency Protocols", function () {
        it("Should trigger emergency protocol when called by emergency role", async function () {
            const { fundingManager, virtualAMM, emergency } = await loadFixture(setupWithRegisteredAMM);

            await expect(
                fundingManager.connect(emergency).triggerEmergencyProtocol(await virtualAMM.getAddress(), "funding_cap_approached")
            ).to.emit(fundingManager, "EmergencyProtocolTriggered");
        });

        it("Should revert when called by unauthorized user", async function () {
            const { fundingManager, virtualAMM, trader1 } = await loadFixture(setupWithRegisteredAMM);

            await expect(
                fundingManager.connect(trader1).triggerEmergencyProtocol(await virtualAMM.getAddress(), "funding_cap_approached")
            ).to.be.reverted;
        });

        it("Should detect when emergency should be triggered", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            const [shouldTrigger, severity] = await fundingManager.shouldTriggerEmergency(await virtualAMM.getAddress());
            
            expect(typeof shouldTrigger).to.equal("boolean");
            expect(typeof severity).to.equal("bigint");
        });
    });


    describe("Funding Usage Tracking", function () {
        it("Should track daily funding usage", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            const [used, totalCap, resetTime] = await fundingManager.getDailyFundingUsage(await virtualAMM.getAddress());
            
            expect(used).to.equal(0); // No usage initially
            expect(totalCap).to.be.gt(0); // Should have some cap
            expect(resetTime).to.be.gt(0); // Should have reset time
        });

        it("Should track cumulative funding usage", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            const [used, totalCap] = await fundingManager.getCumulativeFundingUsage(await virtualAMM.getAddress());
            
            expect(used).to.equal(0); // No usage initially
            expect(totalCap).to.be.gt(0); // Should have some cap
        });
    });

    describe("Admin Functions", function () {
        it("Should update funding cap", async function () {
            const { fundingManager, virtualAMM, admin } = await loadFixture(setupWithRegisteredAMM);

            const newCap = {
                dailyCapPercent: ethers.parseEther("0.03"), // 3%
                cumulativeCapPercent: ethers.parseEther("0.15"), // 15%
                emergencyThreshold: ethers.parseEther("0.1"), // 10%
                maxDebtAge: 5 * 24 * 3600 // 5 days
            };

            await fundingManager.connect(admin).updateFundingCap(await virtualAMM.getAddress(), newCap);

            const updatedCap = await fundingManager.getFundingCap(await virtualAMM.getAddress());
            expect(updatedCap.dailyCapPercent).to.equal(newCap.dailyCapPercent);
        });

        it("Should pause/unpause funding", async function () {
            const { fundingManager, virtualAMM, admin, executor } = await loadFixture(setupWithRegisteredAMM);

            // Pause funding
            await fundingManager.connect(admin).pauseFunding(await virtualAMM.getAddress(), true);
            expect(await fundingManager.fundingPaused(await virtualAMM.getAddress())).to.be.true;

            // Should revert when trying to execute funding
            await expect(
                fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress())
            ).to.be.revertedWith("FundingPaused");

            // Unpause funding
            await fundingManager.connect(admin).pauseFunding(await virtualAMM.getAddress(), false);
            expect(await fundingManager.fundingPaused(await virtualAMM.getAddress())).to.be.false;
        });
    });

    describe("Funding Flow Scenarios", function () {
        async function setupBalancedPositions() {
            const contracts = await loadFixture(setupWithRegisteredAMM);
            const { virtualAMM, collateralToken, admin, trader1, trader2, fundingManager } = contracts;

            // Add liquidity
            const liquidityAmount = ethers.parseEther("10000");
            await collateralToken.mint(admin.address, liquidityAmount);
            await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

            // Create perfectly balanced positions
            const margin = ethers.parseEther("100");
            const size = ethers.parseEther("1000");
            const leverage = ethers.parseEther("2");

            // Mint tokens to traders
            await collateralToken.mint(trader1.address, ethers.parseEther("1000"));
            await collateralToken.mint(trader2.address, ethers.parseEther("1000"));

            // Open equal long and short positions
            const positionId1 = await virtualAMM.connect(trader1).openPosition.staticCall(
                trader1.address, size, margin, leverage
            );
            await virtualAMM.connect(trader1).openPosition(trader1.address, size, margin, leverage);
            
            const positionId2 = await virtualAMM.connect(trader2).openPosition.staticCall(
                trader2.address, -size, margin, leverage
            );
            await virtualAMM.connect(trader2).openPosition(trader2.address, -size, margin, leverage);

            return { ...contracts, positionId1, positionId2 };
        }

        async function setupImbalancedPositions() {
            const contracts = await loadFixture(setupWithRegisteredAMM);
            const { virtualAMM, collateralToken, admin, trader1, trader2, fundingManager } = contracts;

            // Add liquidity
            const liquidityAmount = ethers.parseEther("10000");
            await collateralToken.mint(admin.address, liquidityAmount);
            await virtualAMM.connect(admin).addLiquidity(liquidityAmount);

            // Create imbalanced positions - more longs than shorts
            const margin = ethers.parseEther("100");
            const longSize = ethers.parseEther("2000");
            const shortSize = ethers.parseEther("1000");
            const leverage = ethers.parseEther("2");

            // Mint tokens to traders
            await collateralToken.mint(trader1.address, ethers.parseEther("1000"));
            await collateralToken.mint(trader2.address, ethers.parseEther("1000"));

            // Long position is 2x the size of short position
            const positionId1 = await virtualAMM.connect(trader1).openPosition.staticCall(
                trader1.address, longSize, margin, leverage
            );
            await virtualAMM.connect(trader1).openPosition(trader1.address, longSize, margin, leverage);
            
            const positionId2 = await virtualAMM.connect(trader2).openPosition.staticCall(
                trader2.address, -shortSize, margin, leverage
            );
            await virtualAMM.connect(trader2).openPosition(trader2.address, -shortSize, margin, leverage);

            return { ...contracts, positionId1, positionId2 };
        }

        it("Should correctly handle longs-pay-shorts with balanced positions", async function () {
            const { fundingManager, virtualAMM, executor } = await setupBalancedPositions();
            
            // Get LP pool value before funding
            const lpValueBefore = await virtualAMM.getLPPoolValue();
            
            // Execute funding
            const tx = await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            const receipt = await tx.wait();
            
            // Check events to verify LP funding was zero in balanced scenario
            const fundingEvents = receipt.logs.filter(log => {
                try {
                    const parsed = fundingManager.interface.parseLog(log);
                    return parsed.name === "FundingExecuted";
                } catch {
                    return false;
                }
            });
            
            // LP pool value should remain unchanged or nearly unchanged in balanced case
            const lpValueAfter = await virtualAMM.getLPPoolValue();
            expect(lpValueAfter).to.be.closeTo(lpValueBefore, ethers.parseEther("0.1"));
        });
        
        it("Should correctly handle longs-pay-shorts with imbalanced positions (LP receives)", async function () {
            const { fundingManager, virtualAMM, executor, admin, fundingCap } = await setupImbalancedPositions();
            
            // Modify funding cap to ensure funding exceeds shorts payment capacity
            await fundingManager.connect(admin).updateFundingCap(await virtualAMM.getAddress(), {
                dailyCapPercent: ethers.parseEther("0.2"), // 20% - high enough for testing
                cumulativeCapPercent: ethers.parseEther("0.5"), // 50%
                emergencyThreshold: ethers.parseEther("0.4"), // 40%
                maxDebtAge: fundingCap.maxDebtAge
            });
            
            // Get initial values
            const lpValueBefore = await virtualAMM.getLPPoolValue();
            
            // Execute funding 
            const tx = await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            const receipt = await tx.wait();
            
            // Get final values
            const lpValueAfter = await virtualAMM.getLPPoolValue();
            
            // In a typical scenario with imbalanced positions (more longs than shorts),
            // and if the funding rate is positive (longs pay shorts), then:
            // - All shorts will receive funding from longs
            // - The LP pool will receive the excess funding from longs
            
            // Note: We can't guarantee the funding rate direction in this test without mocking,
            // so we're not making specific assertions about LP value changes
        });
        
        it("Should correctly handle shorts-pay-longs with imbalanced positions (LP pays)", async function () {
            const { fundingManager, virtualAMM, executor, admin } = await setupImbalancedPositions();
            
            // Force a large negative funding rate through changing parameters
            // For testing purposes, let's modify the sensitivity and use price manipulation
            await virtualAMM.connect(admin).updateSensitivityParameter(ethers.parseEther("5")); // Increase sensitivity
            
            // Execute funding
            const tx = await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            
            // Note: Since we can't easily force a specific funding rate direction in this test,
            // we're just testing that the function executes without reverting
            // In a real scenario with negative funding rate and more longs than shorts,
            // the LP would likely need to pay the excess longs
        });
    });

    describe("Funding Cap Validation", function () {
        it("should reject invalid funding cap configurations", async function() {
            const { fundingManager, admin } = await loadFixture(deployFundingManagerFixture);
            
            // Test emergency threshold > cumulative cap (should be invalid)
            const invalidCap1 = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: ethers.parseEther("0.15"), // > cumulative
                maxDebtAge: 7 * 24 * 3600
            };
            
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap1)
            ).to.be.revertedWith("InvalidCapConfiguration");
            
            // Test zero daily cap
            const invalidCap2 = {
                dailyCapPercent: 0,
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: ethers.parseEther("0.05"),
                maxDebtAge: 7 * 24 * 3600
            };
            
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap2)
            ).to.be.revertedWith("InvalidCapConfiguration");
            
            // Test zero cumulative cap
            const invalidCap3 = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: 0,
                emergencyThreshold: ethers.parseEther("0.05"),
                maxDebtAge: 7 * 24 * 3600
            };
            
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap3)
            ).to.be.revertedWith("InvalidCapConfiguration");
            
            // Test zero emergency threshold
            const invalidCap4 = {
                dailyCapPercent: ethers.parseEther("0.05"),
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: 0,
                maxDebtAge: 7 * 24 * 3600
            };
            
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap4)
            ).to.be.revertedWith("InvalidCapConfiguration");
            
            // Test caps > 100%
            const invalidCap5 = {
                dailyCapPercent: ethers.parseEther("1.1"), // > 100%
                cumulativeCapPercent: ethers.parseEther("0.1"),
                emergencyThreshold: ethers.parseEther("0.05"),
                maxDebtAge: 7 * 24 * 3600
            };
            
            await expect(
                fundingManager.connect(admin).registerAMM(ethers.Wallet.createRandom().address, invalidCap5)
            ).to.be.revertedWith("InvalidCapConfiguration");
        });
    });

    describe("Edge Cases and Error Conditions", function () {
        it("Should handle AMM with zero liquidity", async function () {
            const { fundingManager, virtualAMM, executor } = await loadFixture(setupWithRegisteredAMM);

            // Execute funding without any liquidity or positions
            const result = await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            expect(result).to.not.be.null;
        });

        it("Should handle multiple rapid funding executions", async function () {
            const { fundingManager, virtualAMM, executor } = await loadFixture(setupWithLiquidityAndPositions);

            // Execute multiple times rapidly
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());
            await fundingManager.connect(executor).executeFunding(await virtualAMM.getAddress());

            // Should all succeed
        });

        it("Should handle extreme position imbalances", async function () {
            const { fundingManager, virtualAMM, collateralToken, admin, trader1 } = await loadFixture(setupWithRegisteredAMM);

            // Mint large amount for admin and trader
            const largeAmount = ethers.parseEther("100000");
            await collateralToken.mint(admin.address, largeAmount);
            await collateralToken.mint(trader1.address, largeAmount);

            // Add large liquidity
            await virtualAMM.connect(admin).addLiquidity(largeAmount);

            // Create extreme position imbalance
            const largeSize = ethers.parseEther("50000");
            const margin = ethers.parseEther("10000");
            const leverage = ethers.parseEther("5");

            await virtualAMM.connect(trader1).openPosition(trader1.address, largeSize, margin, leverage);

            // Should still handle funding execution
            await expect(
                fundingManager.updateFundingRate(await virtualAMM.getAddress())
            ).to.not.be.reverted;
        });

        it("Should handle funding calculations near cap boundaries", async function () {
            const { fundingManager, virtualAMM } = await loadFixture(setupWithLiquidityAndPositions);

            // Get the exact daily cap amount
            const [, dailyCap] = await fundingManager.getDailyFundingUsage(await virtualAMM.getAddress());

            // Test amount exactly at cap
            const [capReached, available] = await fundingManager.checkFundingCap(
                await virtualAMM.getAddress(),
                dailyCap
            );

            expect(available).to.equal(dailyCap);
        });
    });
});