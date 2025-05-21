const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VirtualAMM - Trader Position Tracking", function () {
    // Helper function to convert BigInt arrays to Numbers for easier testing
    function convertPositionsToNumbers(positions) {
        return positions.map(p => Number(p));
    }

    // Helper function to check if array contains all expected elements (handles BigInt)
    function expectPositionsToInclude(actualPositions, expectedIds) {
        const actualNumbers = convertPositionsToNumbers(actualPositions);
        for (const expectedId of expectedIds) {
            expect(actualNumbers).to.include(expectedId);
        }
    }

    // Test fixture to deploy contracts
    async function deployVirtualAMMFixture() {
        const [owner, trader1, trader2, trader3] = await ethers.getSigners();

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
        await collateralToken.mint(trader3.address, initialBalance);
        await collateralToken.mint(owner.address, initialBalance);

        // Approve AMM to spend tokens
        await collateralToken.connect(trader1).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(trader2).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(trader3).approve(await virtualAMM.getAddress(), ethers.MaxUint256);
        await collateralToken.connect(owner).approve(await virtualAMM.getAddress(), ethers.MaxUint256);

        // Set oracle price to 500 (50%)
        await oracle.updateTeamWinPct("NYY", 500);

        // Add liquidity for testing
        await virtualAMM.connect(owner).addLiquidity(ethers.parseEther("1000"));

        return {
            virtualAMM,
            collateralToken,
            oracle,
            owner,
            trader1,
            trader2,
            trader3
        };
    }

    describe("Empty Position Arrays", function () {
        it("Should return empty array for trader with no positions", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.be.an('array');
            expect(positions).to.have.lengthOf(0);
        });

        it("Should return zero count for trader with no positions", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            expect(count).to.equal(0);
        });

        it("Should handle address zero gracefully", async function () {
            const { virtualAMM } = await loadFixture(deployVirtualAMMFixture);
            
            const positions = await virtualAMM.getTraderPositions(ethers.ZeroAddress);
            const count = await virtualAMM.getTraderPositionCount(ethers.ZeroAddress);
            
            expect(positions).to.have.lengthOf(0);
            expect(count).to.equal(0);
        });
    });

    describe("Single Position Tracking", function () {
        it("Should track single position correctly", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(1);
            expect(Number(positions[0])).to.equal(1); // First position ID
            expect(count).to.equal(1);
        });

        it("Should remove position from tracking when closed", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open and immediately close position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            // Verify tracking before close
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).closePosition(1);
            
            // Verify tracking after close
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(0);
            expect(count).to.equal(0);
        });
    });

    describe("Multiple Position Tracking", function () {
        it("Should track multiple positions in order", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open three positions
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("-75"),
                ethers.parseEther("40"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("200"),
                ethers.parseEther("100"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(3);
            expect(count).to.equal(3);
            expect(Number(positions[0])).to.equal(1);
            expect(Number(positions[1])).to.equal(2);
            expect(Number(positions[2])).to.equal(3);
        });

        it("Should track positions with different leverage levels", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open positions with different leverage
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1") // 1x leverage
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("10"),
                ethers.parseEther("5") // 5x leverage
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(2);
            expect(Number(positions[0])).to.equal(1);
            expect(Number(positions[1])).to.equal(2);
            
            // Verify the actual positions have correct leverage
            const position1 = await virtualAMM.getPosition(1);
            const position2 = await virtualAMM.getPosition(2);
            expect(position1.leverage).to.equal(ethers.parseEther("1"));
            expect(position2.leverage).to.equal(ethers.parseEther("5"));
        });
    });

    describe("Position Closing in Different Orders", function () {
        async function setupThreePositions(virtualAMM, trader) {
            // Open three positions
            await virtualAMM.connect(trader).openPosition(
                trader.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            ); // Position ID 1
            
            await virtualAMM.connect(trader).openPosition(
                trader.address,
                ethers.parseEther("-75"),
                ethers.parseEther("40"),
                ethers.parseEther("1")
            ); // Position ID 2
            
            await virtualAMM.connect(trader).openPosition(
                trader.address,
                ethers.parseEther("200"),
                ethers.parseEther("100"),
                ethers.parseEther("1")
            ); // Position ID 3
            
            return [1, 2, 3]; // Position IDs
        }

        it("Should handle closing first position (index 0)", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close first position (ID 1, index 0)
            await virtualAMM.connect(trader1).closePosition(1);
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(2);
            expect(count).to.equal(2);
            // Should have positions 2 and 3, but order might change due to swap-and-pop
            expectPositionsToInclude(positions, [2, 3]);
        });

        it("Should handle closing middle position (index 1)", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close middle position (ID 2, index 1)
            await virtualAMM.connect(trader1).closePosition(2);
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(2);
            expect(count).to.equal(2);
            // Should have positions 1 and 3
            expectPositionsToInclude(positions, [1, 3]);
        });

        it("Should handle closing last position (index 2)", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close last position (ID 3, index 2)
            await virtualAMM.connect(trader1).closePosition(3);
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const count = await virtualAMM.getTraderPositionCount(trader1.address);
            
            expect(positions).to.have.lengthOf(2);
            expect(count).to.equal(2);
            // Should have positions 1 and 2
            expectPositionsToInclude(positions, [1, 2]);
        });

        it("Should handle closing all positions one by one", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close all positions in order
            await virtualAMM.connect(trader1).closePosition(1);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).closePosition(2);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).closePosition(3);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(0);
            
            const finalPositions = await virtualAMM.getTraderPositions(trader1.address);
            expect(finalPositions).to.have.lengthOf(0);
        });

        it("Should handle closing all positions in reverse order", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close all positions in reverse order
            await virtualAMM.connect(trader1).closePosition(3);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).closePosition(2);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).closePosition(1);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(0);
            
            const finalPositions = await virtualAMM.getTraderPositions(trader1.address);
            expect(finalPositions).to.have.lengthOf(0);
        });

        it("Should handle closing positions in random order", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await setupThreePositions(virtualAMM, trader1);
            
            // Close positions in order: 2, 1, 3
            await virtualAMM.connect(trader1).closePosition(2);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).closePosition(1);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).closePosition(3);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(0);
            
            const finalPositions = await virtualAMM.getTraderPositions(trader1.address);
            expect(finalPositions).to.have.lengthOf(0);
        });
    });

    describe("Multiple Traders", function () {
        it("Should track positions separately for different traders", async function () {
            const { virtualAMM, trader1, trader2, trader3 } = await loadFixture(deployVirtualAMMFixture);
            
            // Trader1 opens 2 positions
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("-50"),
                ethers.parseEther("30"),
                ethers.parseEther("1")
            );
            
            // Trader2 opens 1 position
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("200"),
                ethers.parseEther("100"),
                ethers.parseEther("1")
            );
            
            // Trader3 opens 3 positions
            await virtualAMM.connect(trader3).openPosition(
                trader3.address,
                ethers.parseEther("75"),
                ethers.parseEther("40"),
                ethers.parseEther("1")
            );
            await virtualAMM.connect(trader3).openPosition(
                trader3.address,
                ethers.parseEther("-25"),
                ethers.parseEther("15"),
                ethers.parseEther("1")
            );
            await virtualAMM.connect(trader3).openPosition(
                trader3.address,
                ethers.parseEther("150"),
                ethers.parseEther("75"),
                ethers.parseEther("1")
            );
            
            // Verify separate tracking
            const trader1Positions = await virtualAMM.getTraderPositions(trader1.address);
            const trader2Positions = await virtualAMM.getTraderPositions(trader2.address);
            const trader3Positions = await virtualAMM.getTraderPositions(trader3.address);
            
            expect(trader1Positions).to.have.lengthOf(2);
            expect(trader2Positions).to.have.lengthOf(1);
            expect(trader3Positions).to.have.lengthOf(3);
            
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            expect(await virtualAMM.getTraderPositionCount(trader2.address)).to.equal(1);
            expect(await virtualAMM.getTraderPositionCount(trader3.address)).to.equal(3);
            
            // Verify no cross-contamination
            expectPositionsToInclude(trader1Positions, [1, 2]);
            expectPositionsToInclude(trader2Positions, [3]);
            expectPositionsToInclude(trader3Positions, [4, 5, 6]);
        });

        it("Should not affect other traders when closing positions", async function () {
            const { virtualAMM, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            // Both traders open positions
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            ); // Position 1
            
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("200"),
                ethers.parseEther("100"),
                ethers.parseEther("1")
            ); // Position 2
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("-50"),
                ethers.parseEther("30"),
                ethers.parseEther("1")
            ); // Position 3
            
            // Trader1 closes position
            await virtualAMM.connect(trader1).closePosition(1);
            
            // Verify trader1's positions updated
            const trader1Positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(trader1Positions).to.have.lengthOf(1);
            expectPositionsToInclude(trader1Positions, [3]);
            
            // Verify trader2's positions unchanged
            const trader2Positions = await virtualAMM.getTraderPositions(trader2.address);
            expect(trader2Positions).to.have.lengthOf(1);
            expectPositionsToInclude(trader2Positions, [2]);
        });
    });

    describe("Edge Cases and Consistency", function () {
        it("Should maintain array consistency after complex operations", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open 5 positions
            const positionIds = [];
            for (let i = 0; i < 5; i++) {
                await virtualAMM.connect(trader1).openPosition(
                    trader1.address,
                    ethers.parseEther((100 + i * 50).toString()),
                    ethers.parseEther((50 + i * 25).toString()),
                    ethers.parseEther("1")
                );
                positionIds.push(i + 1);
            }
            
            // Verify all positions tracked
            let positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(5);
            
            // Close positions in complex order: 3, 1, 5, 2, 4
            await virtualAMM.connect(trader1).closePosition(3);
            positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(4);
            expect(convertPositionsToNumbers(positions)).to.not.include(3);
            
            await virtualAMM.connect(trader1).closePosition(1);
            positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(3);
            const positionNums = convertPositionsToNumbers(positions);
            expect(positionNums).to.not.include(1);
            expect(positionNums).to.not.include(3);
            
            await virtualAMM.connect(trader1).closePosition(5);
            positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(2);
            expectPositionsToInclude(positions, [2, 4]);
            
            await virtualAMM.connect(trader1).closePosition(2);
            positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(1);
            expectPositionsToInclude(positions, [4]);
            
            await virtualAMM.connect(trader1).closePosition(4);
            positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(0);
        });

        it("Should handle reopening positions after closing all", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open and close positions
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).closePosition(1);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(0);
            
            // Open new positions
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("200"),
                ethers.parseEther("100"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("-150"),
                ethers.parseEther("75"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(2);
            expectPositionsToInclude(positions, [2, 3]); // nextPositionId continued from 2
        });

        it("Should maintain correct counts during rapid open/close operations", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Rapid sequence of open/close operations
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("100"), ethers.parseEther("50"), ethers.parseEther("1"));
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("200"), ethers.parseEther("100"), ethers.parseEther("1"));
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).closePosition(1);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("300"), ethers.parseEther("150"), ethers.parseEther("1"));
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).openPosition(trader1.address, ethers.parseEther("-100"), ethers.parseEther("50"), ethers.parseEther("1"));
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(3);
            
            await virtualAMM.connect(trader1).closePosition(2);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(2);
            
            await virtualAMM.connect(trader1).closePosition(3);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(1);
            
            await virtualAMM.connect(trader1).closePosition(4);
            expect(await virtualAMM.getTraderPositionCount(trader1.address)).to.equal(0);
        });

        it("Should correctly track positions with same parameters", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open multiple positions with identical parameters
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(3);
            expect(Number(positions[0])).to.equal(1);
            expect(Number(positions[1])).to.equal(2);
            expect(Number(positions[2])).to.equal(3);
            
            // Each should be a distinct position despite identical parameters
            const pos1 = await virtualAMM.getPosition(1);
            const pos2 = await virtualAMM.getPosition(2);
            const pos3 = await virtualAMM.getPosition(3);
            
            expect(pos1.isOpen).to.be.true;
            expect(pos2.isOpen).to.be.true;
            expect(pos3.isOpen).to.be.true;
            
            // Close middle position
            await virtualAMM.connect(trader1).closePosition(2);
            
            const remainingPositions = await virtualAMM.getTraderPositions(trader1.address);
            expect(remainingPositions).to.have.lengthOf(2);
            expectPositionsToInclude(remainingPositions, [1, 3]);
        });
    });

    describe("Integration with Existing Position Functions", function () {
        it("Should work correctly with getPosition function", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("2") // 2x leverage
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            expect(positions).to.have.lengthOf(1);
            
            const positionId = positions[0];
            const position = await virtualAMM.getPosition(positionId);
            
            expect(position.trader).to.equal(trader1.address);
            expect(position.size).to.equal(ethers.parseEther("100"));
            expect(position.margin).to.equal(ethers.parseEther("50"));
            expect(position.leverage).to.equal(ethers.parseEther("2"));
            expect(position.isOpen).to.be.true;
        });

        it("Should work correctly with getPositionValue function", async function () {
            const { virtualAMM, trader1, trader2 } = await loadFixture(deployVirtualAMMFixture);
            
            // Open position
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("3") // 3x leverage
            );
            
            // Move price
            await virtualAMM.connect(trader2).openPosition(
                trader2.address,
                ethers.parseEther("150"),
                ethers.parseEther("75"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const positionId = positions[0];
            const positionValue = await virtualAMM.getPositionValue(positionId);
            
            // Should be amplified by leverage
            expect(positionValue).to.not.equal(0);
        });

        it("Should work correctly with hasAdequateMargin function", async function () {
            const { virtualAMM, trader1 } = await loadFixture(deployVirtualAMMFixture);
            
            await virtualAMM.connect(trader1).openPosition(
                trader1.address,
                ethers.parseEther("100"),
                ethers.parseEther("50"),
                ethers.parseEther("1")
            );
            
            const positions = await virtualAMM.getTraderPositions(trader1.address);
            const positionId = positions[0];
            const hasAdequateMargin = await virtualAMM.hasAdequateMargin(positionId);
            
            expect(hasAdequateMargin).to.be.true;
        });
    });
});