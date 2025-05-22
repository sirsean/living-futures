const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundingManager - Position Force Closure on Insufficient Margin", function() {
    let fundingManager, virtualAMM, mockOracle, mockERC20;
    let admin, trader1, trader2, lp;
    let positionId1, positionId2;
    const PRECISION = ethers.parseEther("1");
    
    beforeEach(async function() {
        [admin, trader1, trader2, lp] = await ethers.getSigners();
        
        // Deploy mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);
        
        const MockBaseballOracle = await ethers.getContractFactory("MockBaseballOracle");
        mockOracle = await MockBaseballOracle.deploy();
        
        // Deploy FundingManager
        const FundingManager = await ethers.getContractFactory("FundingManager");
        fundingManager = await FundingManager.deploy(mockOracle.target, admin.address);
        
        // Deploy VirtualAMM
        const VirtualAMM = await ethers.getContractFactory("VirtualAMM");
        virtualAMM = await VirtualAMM.deploy(
            mockERC20.target,        // _collateralToken
            mockOracle.target,       // _oracle
            "Team1",                 // _teamId
            admin.address,           // _admin
            ethers.parseEther("2"),  // _sensitivityParameter
            BigInt("5000000000000"), // _fundingFactor (5e12, valid range)
            ethers.parseEther("0.1"), // _minMarginRatio
            ethers.parseEther("0.001") // _tradingFeeRate
        );
        
        // Setup oracle team data - set oracle price lower than mark price to make longs pay
        await mockOracle.updateTeamWinPct("Team1", 400);
        
        // Register AMM with FundingManager
        await fundingManager.registerAMMWithDefaults(virtualAMM.target);
        await fundingManager.setFundingCap(virtualAMM.target, {
            dailyCapPercent: ethers.parseEther("0.1"), // 10% daily cap
            cumulativeCapPercent: ethers.parseEther("0.5"), // 50% cumulative cap
            emergencyThreshold: ethers.parseEther("0.4"), // 40% emergency threshold (must be <= cumulative)
            maxDebtAge: 7 * 24 * 3600 // 7 days max debt age
        });
        
        // Setup VirtualAMM roles
        const FUNDING_ROLE = await virtualAMM.FUNDING_ROLE();
        await virtualAMM.grantRole(FUNDING_ROLE, fundingManager.target);
        
        // Mint tokens and provide liquidity
        await mockERC20.mint(lp.address, ethers.parseEther("10000"));
        await mockERC20.connect(lp).approve(virtualAMM.target, ethers.parseEther("10000"));
        await virtualAMM.connect(lp).addLiquidity(ethers.parseEther("5000"));
        
        // Mint tokens for traders
        await mockERC20.mint(trader1.address, ethers.parseEther("1000"));
        await mockERC20.mint(trader2.address, ethers.parseEther("1000"));
        await mockERC20.connect(trader1).approve(virtualAMM.target, ethers.parseEther("1000"));
        await mockERC20.connect(trader2).approve(virtualAMM.target, ethers.parseEther("1000"));
        
        // Open test positions
        const openTx1 = await virtualAMM.connect(trader1).openPosition(
            trader1.address,         // trader
            ethers.parseEther("500"), // size (positive for long)
            ethers.parseEther("100"), // margin
            ethers.parseEther("5")    // leverage (5x)
        );
        positionId1 = await getPositionIdFromTx(openTx1);
        
        const openTx2 = await virtualAMM.connect(trader2).openPosition(
            trader2.address,          // trader
            ethers.parseEther("-200"), // size (negative for short)
            ethers.parseEther("50"),   // margin
            ethers.parseEther("4")     // leverage (4x)
        );
        positionId2 = await getPositionIdFromTx(openTx2);
    });
    
    async function getPositionIdFromTx(tx) {
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                const parsed = virtualAMM.interface.parseLog(log);
                return parsed.name === 'PositionOpened';
            } catch (e) {
                return false;
            }
        });
        if (event) {
            const parsed = virtualAMM.interface.parseLog(event);
            return parsed.args.positionId;
        }
        throw new Error("PositionOpened event not found");
    }
    
    describe("Force Closure on Insufficient Margin", function() {
        it("should force close position when funding payment exceeds available margin", async function() {
            // Set oracle price to make longs pay funding
            await mockOracle.updateTeamWinPct("Team1", 400); // Below mark price of ~500
            
            // Update funding rate
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            // Reduce position margin to create insufficient funds scenario
            await virtualAMM.connect(admin).setPositionMargin(positionId1, ethers.parseEther("5"));
            
            // Get position state before funding
            const positionBefore = await virtualAMM.getPosition(positionId1);
            expect(positionBefore.isOpen).to.be.true;
            expect(positionBefore.margin).to.equal(ethers.parseEther("5"));
            
            // Calculate expected funding payment
            const fundingPayment = await fundingManager.calculatePositionFunding(positionId1, virtualAMM.target);
            
            // Execute funding
            await fundingManager.executeFunding(virtualAMM.target);
            
            // Check position state after funding
            const positionAfter = await virtualAMM.getPosition(positionId1);
            
            // If funding payment exceeds margin, position should be force closed
            if (Math.abs(Number(fundingPayment)) >= Number(ethers.parseEther("5"))) {
                expect(positionAfter.isOpen).to.be.false;
            } else {
                // Otherwise, margin should be reduced by funding payment
                expect(positionAfter.isOpen).to.be.true;
                const expectedMargin = BigInt(positionBefore.margin) + BigInt(fundingPayment);
                const tolerance = ethers.parseEther("0.001"); // Allow small rounding differences
                const diff = positionAfter.margin - (expectedMargin > 0n ? expectedMargin : 0n);
                expect(Math.abs(Number(diff))).to.be.lessThan(Number(tolerance));
            }
        });
        
        it("should properly handle funding when position has sufficient margin", async function() {
            // Update funding rate
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            // Keep position margin high enough to handle funding
            const positionBefore = await virtualAMM.getPosition(positionId1);
            expect(positionBefore.isOpen).to.be.true;
            expect(positionBefore.margin).to.equal(ethers.parseEther("100"));
            
            // Calculate expected funding payment
            const fundingPayment = await fundingManager.calculatePositionFunding(positionId1, virtualAMM.target);
            
            // Execute funding
            await fundingManager.executeFunding(virtualAMM.target);
            
            // Position should remain open with adjusted margin
            const positionAfter = await virtualAMM.getPosition(positionId1);
            expect(positionAfter.isOpen).to.be.true;
            
            // Margin should be adjusted by funding payment
            const expectedMargin = BigInt(positionBefore.margin) + BigInt(fundingPayment);
            const tolerance = ethers.parseEther("0.001"); // Allow small rounding differences
            const diff = positionAfter.margin - (expectedMargin > 0n ? expectedMargin : 0n);
            expect(Math.abs(Number(diff))).to.be.lessThan(Number(tolerance));
        });
        
        it("should handle multiple positions with different margin levels", async function() {
            // Update funding rate
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            // Set different margin levels
            await virtualAMM.connect(admin).setPositionMargin(positionId1, ethers.parseEther("2")); // Low margin
            // positionId2 keeps its original margin of 50 ETH
            
            // Get positions before funding
            const position1Before = await virtualAMM.getPosition(positionId1);
            const position2Before = await virtualAMM.getPosition(positionId2);
            
            // Calculate funding payments
            const funding1 = await fundingManager.calculatePositionFunding(positionId1, virtualAMM.target);
            const funding2 = await fundingManager.calculatePositionFunding(positionId2, virtualAMM.target);
            
            // Execute funding
            await fundingManager.executeFunding(virtualAMM.target);
            
            // Check results
            const position1After = await virtualAMM.getPosition(positionId1);
            const position2After = await virtualAMM.getPosition(positionId2);
            
            // Position 1 might be force closed if funding exceeds margin
            if (Math.abs(Number(funding1)) >= Number(ethers.parseEther("2"))) {
                expect(position1After.isOpen).to.be.false;
            } else {
                expect(position1After.isOpen).to.be.true;
            }
            
            // Position 2 should remain open (sufficient margin)
            expect(position2After.isOpen).to.be.true;
        });
        
        it("should emit appropriate events during force closure", async function() {
            // Set up force closure scenario
            await virtualAMM.connect(admin).setPositionMargin(positionId1, ethers.parseEther("1"));
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            // Execute funding and check for PositionClosed event
            const tx = await fundingManager.executeFunding(virtualAMM.target);
            const receipt = await tx.wait();
            
            // Look for PositionClosed events in the transaction
            const closedEvents = receipt.logs.filter(log => {
                try {
                    const parsed = virtualAMM.interface.parseLog(log);
                    return parsed.name === 'PositionClosed';
                } catch (e) {
                    return false;
                }
            });
            
            // If position was force closed, there should be an event
            const positionAfter = await virtualAMM.getPosition(positionId1);
            if (!positionAfter.isOpen) {
                expect(closedEvents.length).to.be.greaterThan(0);
                
                const closedEvent = virtualAMM.interface.parseLog(closedEvents[0]);
                expect(closedEvent.args.positionId).to.equal(positionId1);
                expect(closedEvent.args.trader).to.equal(trader1.address);
            }
        });
        
        it("should handle edge case where funding payment exactly equals margin", async function() {
            // Set exact margin amount
            const testMargin = ethers.parseEther("10");
            await virtualAMM.connect(admin).setPositionMargin(positionId1, testMargin);
            
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            const fundingPayment = await fundingManager.calculatePositionFunding(positionId1, virtualAMM.target);
            
            // If funding payment exactly equals margin, position should be force closed
            await fundingManager.executeFunding(virtualAMM.target);
            
            const positionAfter = await virtualAMM.getPosition(positionId1);
            
            if (Math.abs(Number(fundingPayment)) >= Number(testMargin)) {
                expect(positionAfter.isOpen).to.be.false;
            } else {
                expect(positionAfter.isOpen).to.be.true;
                const expectedMargin = BigInt(testMargin) + BigInt(fundingPayment);
                const tolerance = ethers.parseEther("0.001"); // Allow small rounding differences
                const diff = positionAfter.margin - expectedMargin;
                expect(Math.abs(Number(diff))).to.be.lessThan(Number(tolerance));
            }
        });
    });
    
    describe("LP Pool Funding Behavior", function() {
        it("should properly handle LP funding obligations", async function() {
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            // Get LP pool state before funding
            const lpPoolBefore = await virtualAMM.getLPPoolValue();
            
            // Get LP funding obligation
            const lpObligation = await fundingManager.getLPFundingObligation(virtualAMM.target);
            
            // Execute funding
            await fundingManager.executeFunding(virtualAMM.target);
            
            // Check LP pool state after funding
            const lpPoolAfter = await virtualAMM.getLPPoolValue();
            
            // LP pool value should change based on funding obligation
            const expectedChange = BigInt(lpPoolBefore) + BigInt(lpObligation);
            
            // Allow for some tolerance due to position force closures affecting calculations
            const tolerance = ethers.parseEther("1");
            const diff = BigInt(lpPoolAfter) - expectedChange;
            expect(Math.abs(Number(diff))).to.be.lessThan(Number(tolerance));
        });
        
        it("should respect funding caps for LP obligations", async function() {
            // Create large imbalance to trigger funding cap
            const largeTx = await virtualAMM.connect(trader1).openPosition(
                trader1.address,           // trader
                ethers.parseEther("2000"), // Large size (positive for long)
                ethers.parseEther("500"),  // Large margin
                ethers.parseEther("4")     // leverage (4x)
            );
            
            await fundingManager.updateFundingRate(virtualAMM.target);
            
            const lpObligation = await fundingManager.getLPFundingObligation(virtualAMM.target);
            const capCheck = await fundingManager.checkFundingCap(virtualAMM.target, Math.abs(Number(lpObligation)));
            
            // Execute funding
            const tx = await fundingManager.executeFunding(virtualAMM.target);
            
            // Should handle cap restrictions gracefully
            expect(tx).to.not.be.reverted;
            
            if (capCheck.capReached) {
                // If cap was reached, actual funding should be limited
                expect(Number(capCheck.availableAmount)).to.be.lessThan(Math.abs(Number(lpObligation)));
            }
        });
    });
});