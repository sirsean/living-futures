const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VirtualAMM Funding", function () {
    // Test fixture to deploy contracts
    async function deployVirtualAMMFixture() {
        const [owner, trader1, trader2, liquidator, fundingManager] = await ethers.getSigners();

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
            owner.address,
            sensitivityParameter,
            fundingFactor,
            minMarginRatio,
            tradingFeeRate
        );

        // Grant FUNDING_ROLE to fundingManager
        const FUNDING_ROLE = await virtualAMM.FUNDING_ROLE();
        await virtualAMM.grantRole(FUNDING_ROLE, fundingManager.address);

        // Mint tokens and approve
        const initialBalance = ethers.parseEther("10000");
        await collateralToken.mint(trader1.address, initialBalance);
        await collateralToken.mint(trader2.address, initialBalance);
        await collateralToken.mint(owner.address, initialBalance);

        await collateralToken.connect(trader1).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(trader2).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(owner).approve(await virtualAMM.getAddress(), ethers.MaxUint256);

        // Set oracle price
        await oracle.updateTeamWinPct("NYY", 500);

        return {
            owner,
            trader1,
            trader2,
            liquidator,
            fundingManager,
            virtualAMM,
            collateralToken,
            oracle,
            FUNDING_ROLE
        };
    }

    async function setupWithLiquidityAndPositions() {
        const contracts = await loadFixture(deployVirtualAMMFixture);
        const { virtualAMM, trader1, trader2, owner } = contracts;

        // Add liquidity
        const liquidityAmount = ethers.parseEther("1000");
        await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

        // Open positions
        const margin = ethers.parseEther("100");
        const size = ethers.parseEther("50");
        const leverage = ethers.parseEther("2");

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

    describe("applyPositionFunding", function () {
        it("Should increase position margin when receiving funding", async function () {
            const { virtualAMM, fundingManager, positionId1 } = await loadFixture(setupWithLiquidityAndPositions);

            const fundingAmount = ethers.parseEther("10");
            const positionBefore = await virtualAMM.getPosition(positionId1);

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, fundingAmount)
            ).to.emit(virtualAMM, "PositionFundingApplied")
                .withArgs(positionId1, positionBefore.trader, fundingAmount, positionBefore.margin + fundingAmount);

            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.margin).to.equal(positionBefore.margin + fundingAmount);
        });

        it("Should decrease position margin when paying funding", async function () {
            const { virtualAMM, fundingManager, positionId1 } = await loadFixture(setupWithLiquidityAndPositions);

            const fundingAmount = -ethers.parseEther("5");
            const positionBefore = await virtualAMM.getPosition(positionId1);
            const expectedNewMargin = positionBefore.margin - BigInt(5) * BigInt(10 ** 18);

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, fundingAmount)
            ).to.emit(virtualAMM, "PositionFundingApplied")
                .withArgs(positionId1, positionBefore.trader, fundingAmount, expectedNewMargin);

            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.margin).to.equal(expectedNewMargin);
        });

        it("Should force close position when funding exceeds margin", async function () {
            const { virtualAMM, fundingManager, positionId1, trader1 } = await loadFixture(setupWithLiquidityAndPositions);

            const positionBefore = await virtualAMM.getPosition(positionId1);
            const excessiveFunding = -(positionBefore.margin + ethers.parseEther("10"));

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, excessiveFunding)
            ).to.emit(virtualAMM, "PositionClosed");

            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.isOpen).to.be.false;
        });

        it("Should revert for non-existent position", async function () {
            const { virtualAMM, fundingManager } = await loadFixture(setupWithLiquidityAndPositions);

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(999, ethers.parseEther("10"))
            ).to.be.revertedWith("PositionNotFound");
        });

        it("Should revert for closed position", async function () {
            const { virtualAMM, fundingManager, positionId1, trader1 } = await loadFixture(setupWithLiquidityAndPositions);

            // Close the position first
            await virtualAMM.connect(trader1).closePosition(positionId1);

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, ethers.parseEther("10"))
            ).to.be.revertedWith("PositionNotFound");
        });

        it("Should revert when called by non-funding role", async function () {
            const { virtualAMM, trader1, positionId1 } = await loadFixture(setupWithLiquidityAndPositions);

            await expect(
                virtualAMM.connect(trader1).applyPositionFunding(positionId1, ethers.parseEther("10"))
            ).to.be.reverted;
        });

        it("Should handle zero funding amount correctly", async function () {
            const { virtualAMM, fundingManager, positionId1 } = await loadFixture(setupWithLiquidityAndPositions);

            const positionBefore = await virtualAMM.getPosition(positionId1);

            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, 0)
            ).to.emit(virtualAMM, "PositionFundingApplied")
                .withArgs(positionId1, positionBefore.trader, 0, positionBefore.margin);

            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.margin).to.equal(positionBefore.margin);
        });
    });

    describe("getLPPoolValue", function () {
        it("Should return correct LP pool value", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);

            expect(await virtualAMM.getLPPoolValue()).to.equal(0);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount);
        });

        it("Should update when liquidity is added/removed", async function () {
            const { virtualAMM, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);
            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount);

            const additionalLiquidity = ethers.parseEther("500");
            await virtualAMM.connect(owner).addLiquidity(additionalLiquidity);
            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount + additionalLiquidity);
        });
    });

    describe("transferLPFunding", function () {
        it("Should increase LP pool when receiving funding", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            const fundingAmount = ethers.parseEther("50");
            const result = await virtualAMM.connect(fundingManager).transferLPFunding.staticCall(fundingAmount);
            await virtualAMM.connect(fundingManager).transferLPFunding(fundingAmount);

            expect(result).to.equal(fundingAmount);
            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount + fundingAmount);
        });

        it("Should decrease LP pool when paying funding", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            const fundingAmount = -ethers.parseEther("50");
            const result = await virtualAMM.connect(fundingManager).transferLPFunding.staticCall(fundingAmount);
            await virtualAMM.connect(fundingManager).transferLPFunding(fundingAmount);

            expect(result).to.equal(fundingAmount);
            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount - BigInt(50) * BigInt(10 ** 18));
        });

        it("Should revert when LP funding exceeds pool value", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("100");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            const excessiveFunding = -ethers.parseEther("200");

            await expect(
                virtualAMM.connect(fundingManager).transferLPFunding(excessiveFunding)
            ).to.be.revertedWithCustomError(virtualAMM, "InsufficientLPFunds");
        });

        it("Should handle zero funding amount", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            const result = await virtualAMM.connect(fundingManager).transferLPFunding.staticCall(0);
            await virtualAMM.connect(fundingManager).transferLPFunding(0);

            expect(result).to.equal(0);
            expect(await virtualAMM.getLPPoolValue()).to.equal(liquidityAmount);
        });

        it("Should revert when called by non-funding role", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);

            await expect(
                virtualAMM.connect(trader1).transferLPFunding(ethers.parseEther("50"))
            ).to.be.reverted;
        });

        it("Should handle edge case where funding equals exactly pool value", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("100");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            const fundingAmount = -liquidityAmount;
            await virtualAMM.connect(fundingManager).transferLPFunding(fundingAmount);

            expect(await virtualAMM.getLPPoolValue()).to.equal(0);
        });
    });

    describe("Integration: Complex funding scenarios", function () {
        it("Should handle multiple funding rounds correctly", async function () {
            const { virtualAMM, fundingManager, positionId1, positionId2 } = await loadFixture(setupWithLiquidityAndPositions);

            // Round 1: Position 1 pays, Position 2 receives
            await virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, -ethers.parseEther("5"));
            await virtualAMM.connect(fundingManager).applyPositionFunding(positionId2, ethers.parseEther("5"));

            // Round 2: Reverse
            await virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, ethers.parseEther("3"));
            await virtualAMM.connect(fundingManager).applyPositionFunding(positionId2, -ethers.parseEther("3"));

            const position1 = await virtualAMM.getPosition(positionId1);
            const position2 = await virtualAMM.getPosition(positionId2);

            // Net funding should be -2 ETH for position1, +2 ETH for position2
            expect(position1.margin).to.equal(ethers.parseEther("98")); // 100 - 5 + 3
            expect(position2.margin).to.equal(ethers.parseEther("102")); // 100 + 5 - 3
        });

        it("Should correctly handle LP funding with position funding", async function () {
            const { virtualAMM, fundingManager, owner } = await loadFixture(deployVirtualAMMFixture);

            const liquidityAmount = ethers.parseEther("1000");
            await virtualAMM.connect(owner).addLiquidity(liquidityAmount);

            // LP receives funding
            await virtualAMM.connect(fundingManager).transferLPFunding(ethers.parseEther("100"));
            expect(await virtualAMM.getLPPoolValue()).to.equal(ethers.parseEther("1100"));

            // LP pays funding
            await virtualAMM.connect(fundingManager).transferLPFunding(-ethers.parseEther("50"));
            expect(await virtualAMM.getLPPoolValue()).to.equal(ethers.parseEther("1050"));
        });

        it("Should handle position closure during funding due to insufficient margin", async function () {
            const { virtualAMM, fundingManager, positionId1, trader1, collateralToken } = await loadFixture(setupWithLiquidityAndPositions);

            const traderBalanceBefore = await collateralToken.balanceOf(trader1.address);
            const positionBefore = await virtualAMM.getPosition(positionId1);

            // Apply funding that exceeds margin
            const excessiveFunding = -(positionBefore.margin + ethers.parseEther("10"));
            
            await expect(
                virtualAMM.connect(fundingManager).applyPositionFunding(positionId1, excessiveFunding)
            ).to.emit(virtualAMM, "PositionClosed");

            // Position should be closed
            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.isOpen).to.be.false;

            // Trader should receive any remaining value (PnL could be positive/negative)
            const traderBalanceAfter = await collateralToken.balanceOf(trader1.address);
            // Balance could be higher or lower depending on PnL
        });
    });
});