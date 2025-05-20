const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BaseballOracle", function () {
    let oracle;
    let owner;
    let oracleRole;
    let adminRole;
    let user;
    let ownerAddress;
    let oracleAddress;
    let adminAddress;
    let userAddress;

    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
    const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

    const sampleGameResult = (gameId, homeTeam = "NYY", awayTeam = "BOS") => ({
        gameId: gameId,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeScore: 5,
        awayScore: 3,
        gameDate: Math.floor(Date.now() / 1000),
        gameEndTimestamp: Math.floor(Date.now() / 1000),
        recordedTimestamp: 0,
        gameStatus: "Final",
        recorded: false
    });

    beforeEach(async () => {
        [owner, oracleRole, adminRole, user] = await ethers.getSigners();
        [ownerAddress, oracleAddress, adminAddress, userAddress] = await Promise.all([
            owner.getAddress(),
            oracleRole.getAddress(),
            adminRole.getAddress(),
            user.getAddress()
        ]);

        const BaseballOracle = await ethers.getContractFactory("BaseballOracle");
        oracle = await upgrades.deployProxy(
            BaseballOracle,
            [ownerAddress],
            { initializer: "initialize" }
        );
        await oracle.waitForDeployment();

        // Grant roles
        await oracle.connect(owner).grantRole(ORACLE_ROLE, oracleAddress);
        await oracle.connect(owner).grantRole(ADMIN_ROLE, adminAddress);
    });

    describe("Initialization", () => {
        it("Should initialize with correct roles", async () => {
            expect(await oracle.hasRole(ADMIN_ROLE, ownerAddress)).to.be.true;
            expect(await oracle.hasRole(ORACLE_ROLE, oracleAddress)).to.be.true;
            expect(await oracle.hasRole(ADMIN_ROLE, adminAddress)).to.be.true;
        });

        it("Should start with season inactive", async () => {
            expect(await oracle.isSeasonActive()).to.be.false;
        });
    });

    describe("Team Registration", () => {
        it("Should allow admin to register a team", async () => {
            await expect(oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY"))
                .to.emit(oracle, "TeamRegistered")
                .withArgs("NYY", "New York Yankees", "NYY");

            const team = await oracle.getTeam("NYY");
            expect(team.name).to.equal("New York Yankees");
            expect(team.abbreviation).to.equal("NYY");
            expect(team.wins).to.equal(0);
            expect(team.losses).to.equal(0);
            expect(team.winPct).to.equal(0);
            expect(team.exists).to.be.true;
        });

        it("Should not allow duplicate team registration", async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await expect(oracle.connect(adminRole).registerTeam("NYY", "Yankees", "NY"))
                .to.be.revertedWith("Team already exists");
        });

        it("Should not allow non-admin to register teams", async () => {
            await expect(oracle.connect(user).registerTeam("NYY", "New York Yankees", "NYY"))
                .to.be.reverted;
        });

        it("Should track team count", async () => {
            expect(await oracle.getTeamCount()).to.equal(0);
            
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            expect(await oracle.getTeamCount()).to.equal(1);
            
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
            expect(await oracle.getTeamCount()).to.equal(2);
        });
    });

    describe("Game Recording", () => {
        beforeEach(async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
        });

        it("Should allow oracle to record a game result", async () => {
            const gameResult = sampleGameResult(1);
            
            await expect(oracle.connect(oracleRole).recordGameResult(gameResult))
                .to.emit(oracle, "GameRecorded")
                .withArgs(1, "NYY", "BOS", 5, 3, "Final");

            const recordedGame = await oracle.getGameResult(1);
            expect(recordedGame.homeScore).to.equal(5);
            expect(recordedGame.awayScore).to.equal(3);
            expect(recordedGame.recorded).to.be.true;
        });

        it("Should update team records for final games", async () => {
            const gameResult = sampleGameResult(1);
            await oracle.connect(oracleRole).recordGameResult(gameResult);

            const homeTeam = await oracle.getTeam("NYY");
            const awayTeam = await oracle.getTeam("BOS");

            expect(homeTeam.wins).to.equal(1);
            expect(homeTeam.losses).to.equal(0);
            expect(homeTeam.winPct).to.equal(1000); // 1.000

            expect(awayTeam.wins).to.equal(0);
            expect(awayTeam.losses).to.equal(1);
            expect(awayTeam.winPct).to.equal(0); // .000
        });

        it("Should not record non-final games in team records", async () => {
            const gameResult = { ...sampleGameResult(1), gameStatus: "Postponed" };
            await oracle.connect(oracleRole).recordGameResult(gameResult);

            const homeTeam = await oracle.getTeam("NYY");
            expect(homeTeam.wins).to.equal(0);
            expect(homeTeam.losses).to.equal(0);
        });

        it("Should not allow duplicate game recording", async () => {
            const gameResult = sampleGameResult(1);
            await oracle.connect(oracleRole).recordGameResult(gameResult);
            
            await expect(oracle.connect(oracleRole).recordGameResult(gameResult))
                .to.be.revertedWith("Game already recorded");
        });

        it("Should handle batch game recording", async () => {
            const games = [
                sampleGameResult(1),
                sampleGameResult(2, "BOS", "NYY"),
                sampleGameResult(3)
            ];

            await expect(oracle.connect(oracleRole).recordBatchGameResults(games))
                .to.emit(oracle, "BatchGameResultsProcessed")
                .withArgs(3);

            expect(await oracle.getGameCount()).to.equal(3);
            
            const team = await oracle.getTeam("NYY");
            expect(team.wins).to.equal(2);
            expect(team.losses).to.equal(1);
            expect(team.winPct).to.equal(667); // .667
        });
    });

    describe("Win Percentage Calculation", () => {
        beforeEach(async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
        });

        it("Should calculate win percentage correctly", async () => {
            // Create games with NYY winning 2, losing 1
            const games = [
                { ...sampleGameResult(1), homeScore: 5, awayScore: 3 }, // NYY wins
                { ...sampleGameResult(2), homeScore: 4, awayScore: 2 }, // NYY wins  
                { ...sampleGameResult(3), homeScore: 2, awayScore: 4 }  // NYY loses
            ];

            await oracle.connect(oracleRole).recordBatchGameResults(games);

            expect(await oracle.getTeamWinPct("NYY")).to.equal(667); // .667
            expect(await oracle.getTeamWinPct("BOS")).to.equal(333); // .333
        });

        it("Should handle 0-0 record", async () => {
            expect(await oracle.getTeamWinPct("NYY")).to.equal(0);
        });
    });

    describe("Season Management", () => {
        beforeEach(async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
            
            // Record some games
            await oracle.connect(oracleRole).recordGameResult(sampleGameResult(1));
        });

        it("Should activate season and reset records", async () => {
            const teamBefore = await oracle.getTeam("NYY");
            expect(teamBefore.wins).to.equal(1);

            await expect(oracle.connect(adminRole).setSeasonActive(true))
                .to.emit(oracle, "SeasonStateChanged")
                .withArgs(true, await time.latest());

            const teamAfter = await oracle.getTeam("NYY");
            expect(teamAfter.wins).to.equal(0);
            expect(teamAfter.losses).to.equal(0);
            expect(teamAfter.winPct).to.equal(0);
        });

        it("Should deactivate season", async () => {
            await oracle.connect(adminRole).setSeasonActive(true);
            expect(await oracle.isSeasonActive()).to.be.true;

            await oracle.connect(adminRole).setSeasonActive(false);
            expect(await oracle.isSeasonActive()).to.be.false;
        });
    });

    describe("Administrative Functions", () => {
        beforeEach(async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
        });

        it("Should allow admin to correct game result", async () => {
            // Record initial game
            const wrongResult = sampleGameResult(1);
            await oracle.connect(oracleRole).recordGameResult(wrongResult);

            // Correct the game
            const correctResult = { ...wrongResult, homeScore: 2, awayScore: 4 };
            await oracle.connect(adminRole).correctGameResult(1, correctResult);

            const game = await oracle.getGameResult(1);
            expect(game.homeScore).to.equal(2);
            expect(game.awayScore).to.equal(4);

            // Check team records were updated
            const homeTeam = await oracle.getTeam("NYY");
            const awayTeam = await oracle.getTeam("BOS");
            expect(homeTeam.wins).to.equal(0);
            expect(homeTeam.losses).to.equal(1);
            expect(awayTeam.wins).to.equal(1);
            expect(awayTeam.losses).to.equal(0);
        });

        it("Should allow admin to adjust team record", async () => {
            await oracle.connect(adminRole).adjustTeamRecord("NYY", 95, 67);
            
            const team = await oracle.getTeam("NYY");
            expect(team.wins).to.equal(95);
            expect(team.losses).to.equal(67);
            expect(team.winPct).to.equal(586); // .586
        });
    });

    describe("Access Control", () => {
        it("Should restrict oracle functions to ORACLE_ROLE", async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
            
            const gameResult = sampleGameResult(1);
            
            await expect(oracle.connect(user).recordGameResult(gameResult))
                .to.be.reverted;
                
            await expect(oracle.connect(adminRole).recordGameResult(gameResult))
                .to.be.reverted;
        });

        it("Should allow pausing", async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
            
            await oracle.connect(owner).pause();
            
            const gameResult = sampleGameResult(1);
            await expect(oracle.connect(oracleRole).recordGameResult(gameResult))
                .to.be.revertedWithCustomError(oracle, "EnforcedPause");
                
            await oracle.connect(owner).unpause();
            await oracle.connect(oracleRole).recordGameResult(gameResult);
        });
    });

    describe("Upgradability", () => {
        it("Should be upgradeable by UPGRADER_ROLE", async () => {
            const BaseballOracleV2 = await ethers.getContractFactory("BaseballOracle");
            
            // First grant UPGRADER_ROLE to the owner
            const UPGRADER_ROLE = await oracle.UPGRADER_ROLE();
            await oracle.connect(owner).grantRole(UPGRADER_ROLE, ownerAddress);
            
            // Then upgrade the proxy
            await upgrades.upgradeProxy(await oracle.getAddress(), BaseballOracleV2);
        });
    });

    describe("Edge Cases", () => {
        beforeEach(async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await oracle.connect(adminRole).registerTeam("BOS", "Boston Red Sox", "BOS");
            await oracle.connect(adminRole).registerTeam("LAD", "Los Angeles Dodgers", "LAD");
        });

        it("Should handle double-headers", async () => {
            const game1 = { ...sampleGameResult(1001), gameDate: 1234567890 };
            const game2 = { ...sampleGameResult(1002), gameDate: 1234567890 };
            
            await oracle.connect(oracleRole).recordBatchGameResults([game1, game2]);
            
            const team = await oracle.getTeam("NYY");
            expect(team.wins).to.equal(2);
        });

        it("Should handle postponed games that are later played", async () => {
            // First record as postponed
            const postponedGame = { ...sampleGameResult(1), gameStatus: "Postponed" };
            await oracle.connect(oracleRole).recordGameResult(postponedGame);
            
            // Later correct to final score
            const finalGame = { ...sampleGameResult(1), gameStatus: "Final" };
            await oracle.connect(adminRole).correctGameResult(1, finalGame);
            
            const team = await oracle.getTeam("NYY");
            expect(team.wins).to.equal(1);
        });

        it("Should handle batch recording with some failures", async () => {
            const games = [
                sampleGameResult(1),
                sampleGameResult(2, "INVALID", "BOS"), // This should fail
                sampleGameResult(3)
            ];

            const tx = await oracle.connect(oracleRole).recordBatchGameResults(games);
            const receipt = await tx.wait();
            
            // Check events
            const batchEvent = receipt.logs.find(log => {
                try {
                    const event = oracle.interface.parseLog(log);
                    return event.name === "BatchGameResultsProcessed";
                } catch { return false; }
            });
            
            const errorEvents = receipt.logs.filter(log => {
                try {
                    const event = oracle.interface.parseLog(log);
                    return event.name === "ErrorLogged";
                } catch { return false; }
            });
            
            expect(batchEvent).to.not.be.undefined;
            expect(oracle.interface.parseLog(batchEvent).args[0]).to.equal(2); // Only 2 games processed
            expect(errorEvents.length).to.be.at.least(1); // At least one error logged
        });
    });
});