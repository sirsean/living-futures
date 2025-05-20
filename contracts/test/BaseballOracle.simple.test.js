const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BaseballOracle", function () {
    let oracle;
    let owner;
    let oracleRole;
    let adminRole;

    beforeEach(async () => {
        [owner, oracleRole, adminRole] = await ethers.getSigners();

        const BaseballOracle = await ethers.getContractFactory("BaseballOracle");
        oracle = await upgrades.deployProxy(
            BaseballOracle,
            [owner.address],
            { initializer: "initialize" }
        );
        await oracle.waitForDeployment();

        // Grant roles
        const ORACLE_ROLE = await oracle.ORACLE_ROLE();
        const ADMIN_ROLE = await oracle.ADMIN_ROLE();
        
        await oracle.connect(owner).grantRole(ORACLE_ROLE, oracleRole.address);
        await oracle.connect(owner).grantRole(ADMIN_ROLE, adminRole.address);
    });

    describe("Initialization", () => {
        it("Should initialize with correct roles", async () => {
            const ADMIN_ROLE = await oracle.ADMIN_ROLE();
            expect(await oracle.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
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
        });

        it("Should not allow duplicate team registration", async () => {
            await oracle.connect(adminRole).registerTeam("NYY", "New York Yankees", "NYY");
            await expect(oracle.connect(adminRole).registerTeam("NYY", "Yankees", "NY"))
                .to.be.revertedWith("Team already exists");
        });
    });
});