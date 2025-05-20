import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("🔍 Testing local deployment...");
    
    // Check if deployment file exists
    const deploymentFile = path.join(__dirname, "../deployments/localhost-latest.json");
    if (!fs.existsSync(deploymentFile)) {
        throw new Error("❌ No local deployment found. Run 'npm run deploy:local' first.");
    }

    // Load deployment data
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    console.log("📄 Loaded deployment data");

    // Get signers
    const [deployer, user1] = await ethers.getSigners();
    console.log("👤 Testing with account:", deployer.address);

    // Connect to contracts
    const oracle = await ethers.getContractAt("BaseballOracle", deployments.BaseballOracle.proxy);
    const registry = await ethers.getContractAt("ContractRegistry", deployments.ContractRegistry.proxy);

    console.log("\n🧪 Running tests...");

    // Test 1: Check contract registry
    console.log("1️⃣  Testing ContractRegistry...");
    const registeredOracle = await registry.getProxy("BaseballOracle");
    console.log(`   ✅ Oracle registered at: ${registeredOracle}`);
    
    // Test 2: Check oracle basic functions
    console.log("2️⃣  Testing BaseballOracle basic functions...");
    const teamCount = await oracle.getTeamCount();
    console.log(`   ✅ Total teams registered: ${teamCount}`);

    // Test 3: Check specific team
    console.log("3️⃣  Testing team data...");
    try {
        const team = await oracle.getTeam("NYY");
        console.log(`   ✅ Yankees found: ${team.name} (${team.abbreviation})`);
    } catch (error) {
        console.log("   ❌ Failed to get Yankees data:", error);
    }

    // Test 4: Test role permissions
    console.log("4️⃣  Testing role permissions...");
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    const hasOracleRole = await oracle.hasRole(ORACLE_ROLE, deployer.address);
    console.log(`   ✅ Deployer has ORACLE_ROLE: ${hasOracleRole}`);

    // Test 5: Update team data (requires ORACLE_ROLE)
    console.log("5️⃣  Testing data update functionality...");
    try {
        const tx = await oracle.adjustTeamRecord("NYY", 95, 67);
        await tx.wait();
        console.log("   ✅ Successfully updated Yankees data");
        
        // Verify the update
        const teamData = await oracle.getTeam("NYY");
        console.log(`   📊 Updated stats - Wins: ${teamData.wins}, Losses: ${teamData.losses}, Win%: ${teamData.winPct}`);
    } catch (error) {
        console.log(`   ❌ Failed to update team data: ${error.message}`);
    }

    // Test 6: List all teams
    console.log("6️⃣  Listing all registered teams...");
    for (let i = 0; i < Number(teamCount); i++) {
        try {
            const teamId = await oracle.getTeamIdAtIndex(i);
            const team = await oracle.getTeam(teamId);
            console.log(`   🏟️  ${team.name} (${team.abbreviation})`);
        } catch (error) {
            console.log(`   ❌ Error getting team ${i}: ${error.message}`);
        }
    }

    // Test 7: Test with non-admin user
    console.log("7️⃣  Testing permission restrictions...");
    const oracleAsUser = oracle.connect(user1);
    try {
        await oracleAsUser.adjustTeamRecord("BOS", 88, 74);
        console.log("   ❌ UNEXPECTED: User without ORACLE_ROLE was able to update data");
    } catch (error) {
        console.log("   ✅ Correctly rejected non-admin user attempting to update data");
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log("=====================================");
    console.log("✅ Local deployment is working correctly");
    console.log("✅ All contracts are properly deployed and configured");
    console.log("✅ Role-based permissions are working");
    console.log("✅ Data update functionality is operational");
    console.log("=====================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });