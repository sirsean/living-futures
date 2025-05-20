import { ethers } from "hardhat";
import { upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying contracts to local network...");
    console.log("Deploying with the account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    const networkName = "localhost";
    const deploymentPath = path.join(__dirname, "../deployments");
    
    // Ensure deployment directory exists
    if (!fs.existsSync(deploymentPath)) {
        fs.mkdirSync(deploymentPath, { recursive: true });
    }

    // Step 1: Note about ProxyAdmin (handled by OpenZeppelin upgrades plugin)
    console.log("\n📋 1. ProxyAdmin will be deployed automatically by OpenZeppelin upgrades plugin...");

    // Step 2: Deploy ContractRegistry
    console.log("\n📋 2. Deploying ContractRegistry...");
    const ContractRegistry = await ethers.getContractFactory("ContractRegistry");
    const registry = await upgrades.deployProxy(
        ContractRegistry,
        [deployer.address],
        { 
            initializer: "initialize",
            kind: "uups"
        }
    );
    await registry.waitForDeployment();
    
    const registryAddress = await registry.getAddress();
    const registryImplAddress = await upgrades.erc1967.getImplementationAddress(registryAddress);
    console.log("   ✅ ContractRegistry proxy deployed to:", registryAddress);
    console.log("   📄 Implementation address:", registryImplAddress);

    // Step 3: Deploy BaseballOracle
    console.log("\n⚾ 3. Deploying BaseballOracle...");
    const BaseballOracle = await ethers.getContractFactory("BaseballOracle");
    const oracle = await upgrades.deployProxy(
        BaseballOracle,
        [deployer.address],
        { 
            initializer: "initialize",
            kind: "uups"
        }
    );
    await oracle.waitForDeployment();
    
    const oracleAddress = await oracle.getAddress();
    const oracleImplAddress = await upgrades.erc1967.getImplementationAddress(oracleAddress);
    console.log("   ✅ BaseballOracle proxy deployed to:", oracleAddress);
    console.log("   📄 Implementation address:", oracleImplAddress);

    // Get ProxyAdmin address (for UUPS, the admin is the proxy itself)
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(registryAddress);
    console.log("   👨‍💼 ProxyAdmin address:", proxyAdminAddress || "Built-in (UUPS)");

    // Step 4: Register in ContractRegistry
    console.log("\n📝 4. Registering contracts in registry...");
    await registry.registerProxy("BaseballOracle", oracleAddress);
    await registry.registerImplementation("BaseballOracle", oracleImplAddress, "1.0.0");
    console.log("   ✅ BaseballOracle registered in ContractRegistry");

    // Step 5: Setup roles
    console.log("\n🔐 5. Setting up roles...");
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    
    await oracle.grantRole(ORACLE_ROLE, deployer.address);
    await oracle.grantRole(ADMIN_ROLE, deployer.address);
    console.log("   ✅ Roles granted to deployer");

    // Step 6: Register sample teams for testing
    console.log("\n🏟️  6. Registering sample teams...");
    const teams = [
        { id: "NYY", name: "New York Yankees", abbr: "NYY" },
        { id: "BOS", name: "Boston Red Sox", abbr: "BOS" },
        { id: "LAD", name: "Los Angeles Dodgers", abbr: "LAD" },
        { id: "SF", name: "San Francisco Giants", abbr: "SF" },
        { id: "HOU", name: "Houston Astros", abbr: "HOU" },
        { id: "ATL", name: "Atlanta Braves", abbr: "ATL" }
    ];
    
    for (const team of teams) {
        await oracle.registerTeam(team.id, team.name, team.abbr);
        console.log(`   ✅ Registered team: ${team.name} (${team.abbr})`);
    }

    // Step 7: Save deployment data
    console.log("\n💾 7. Saving deployment data...");
    const deploymentData = {
        network: networkName,
        chainId: 31337,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        ProxyAdmin: {
            address: proxyAdminAddress
        },
        ContractRegistry: {
            proxy: registryAddress,
            implementation: registryImplAddress,
            version: "1.0.0"
        },
        BaseballOracle: {
            proxy: oracleAddress,
            implementation: oracleImplAddress,
            version: "1.0.0"
        }
    };

    const filename = `${networkName}-${Date.now()}.json`;
    const latestFile = `${networkName}-latest.json`;
    
    fs.writeFileSync(
        path.join(deploymentPath, filename),
        JSON.stringify(deploymentData, null, 2)
    );
    
    fs.writeFileSync(
        path.join(deploymentPath, latestFile),
        JSON.stringify(deploymentData, null, 2)
    );

    console.log(`   ✅ Deployment data saved to ${filename}`);

    // Step 8: Export ABIs
    console.log("\n📄 8. Exporting ABIs...");
    const abiPath = path.join(__dirname, "../abis");
    if (!fs.existsSync(abiPath)) {
        fs.mkdirSync(abiPath, { recursive: true });
    }

    // Export BaseballOracle ABI
    const oracleArtifact = await ethers.getContractFactory("BaseballOracle");
    const oracleAbi = oracleArtifact.interface.formatJson();
    fs.writeFileSync(
        path.join(abiPath, "BaseballOracle.json"),
        oracleAbi
    );

    // Export ContractRegistry ABI
    const registryArtifact = await ethers.getContractFactory("ContractRegistry");
    const registryAbi = registryArtifact.interface.formatJson();
    fs.writeFileSync(
        path.join(abiPath, "ContractRegistry.json"),
        registryAbi
    );

    console.log("   ✅ ABIs exported to abis/ directory");

    // Final summary
    console.log("\n🎉 LOCAL DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log(`📋 ProxyAdmin:        ${proxyAdminAddress}`);
    console.log(`📝 ContractRegistry:  ${registryAddress}`);
    console.log(`⚾ BaseballOracle:    ${oracleAddress}`);
    console.log("=====================================");
    console.log(`🔗 Network:           ${networkName} (Chain ID: 31337)`);
    console.log(`👤 Deployer:          ${deployer.address}`);
    console.log(`📊 Teams registered:  ${teams.length}`);
    console.log("=====================================");
    
    console.log("\n🛠️  Next steps:");
    console.log("1. Keep the Hardhat node running");
    console.log("2. Use these addresses to interact with contracts");
    console.log("3. Check deployments/ folder for saved addresses");
    console.log("4. ABIs are available in abis/ folder");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });