import { ethers } from "hardhat";
import { upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentData {
    ContractRegistry?: {
        address: string;
    };
    ProxyAdmin?: {
        address: string;
    };
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Load existing deployment data
    const networkName = (await ethers.provider.getNetwork()).name;
    const deploymentPath = path.join(__dirname, "../deployments");
    const latestFile = path.join(deploymentPath, `${networkName}-latest.json`);
    
    let existingData: DeploymentData = {};
    if (fs.existsSync(latestFile)) {
        existingData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    }

    // Check if registry exists
    if (!existingData.ContractRegistry) {
        throw new Error("ContractRegistry not found. Please deploy registry first.");
    }

    // Deploy BaseballOracle with proxy
    console.log("Deploying BaseballOracle...");
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
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(oracleAddress);
    
    console.log("BaseballOracle deployed to:", oracleAddress);
    console.log("Implementation address:", implementationAddress);

    // Register in ContractRegistry
    console.log("\nRegistering in ContractRegistry...");
    const registry = await ethers.getContractAt("ContractRegistry", existingData.ContractRegistry.address);
    
    await registry.registerProxy("BaseballOracle", oracleAddress);
    await registry.registerImplementation("BaseballOracle", implementationAddress, "1.0.0");
    console.log("Registered in ContractRegistry");

    // Save deployment addresses
    const updatedData = {
        ...existingData,
        BaseballOracle: {
            proxy: oracleAddress,
            implementation: implementationAddress,
            version: "1.0.0",
            deployedAt: new Date().toISOString(),
            network: networkName,
            deployer: deployer.address
        }
    };

    const filename = `${networkName}-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentPath, filename),
        JSON.stringify(updatedData, null, 2)
    );

    // Also update latest deployment
    fs.writeFileSync(
        latestFile,
        JSON.stringify(updatedData, null, 2)
    );

    console.log(`Deployment data saved to ${filename}`);

    // Export ABI
    const artifact = await ethers.getContractFactory("BaseballOracle");
    const abi = artifact.interface.formatJson();
    
    const abiPath = path.join(__dirname, "../abis");
    if (!fs.existsSync(abiPath)) {
        fs.mkdirSync(abiPath, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(abiPath, "BaseballOracle.json"),
        abi
    );
    
    console.log("ABI exported to abis/BaseballOracle.json");

    // Grant initial roles (for production, use multi-sig wallets)
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    
    // In production, these should be different addresses
    console.log("\nGranting initial roles...");
    await oracle.grantRole(ORACLE_ROLE, deployer.address);
    await oracle.grantRole(ADMIN_ROLE, deployer.address);
    
    console.log("Roles granted successfully");
    
    // Register initial teams (example for testnet)
    if (networkName !== "mainnet" && networkName !== "base") {
        console.log("\nRegistering sample teams for testnet...");
        const teams = [
            { id: "NYY", name: "New York Yankees", abbr: "NYY" },
            { id: "BOS", name: "Boston Red Sox", abbr: "BOS" },
            { id: "LAD", name: "Los Angeles Dodgers", abbr: "LAD" },
            { id: "SF", name: "San Francisco Giants", abbr: "SF" }
        ];
        
        for (const team of teams) {
            await oracle.registerTeam(team.id, team.name, team.abbr);
            console.log(`Registered team: ${team.name}`);
        }
    }
    
    console.log("\nDeployment complete!");
    console.log("=================================");
    console.log("Oracle Proxy:", oracleAddress);
    console.log("Implementation:", implementationAddress);
    console.log("=================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });