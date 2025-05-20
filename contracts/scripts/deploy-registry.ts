import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying ContractRegistry with the account:", deployer.address);

    // Deploy ContractRegistry
    console.log("Deploying ContractRegistry...");
    const ContractRegistry = await ethers.getContractFactory("ContractRegistry");
    const registry = await ContractRegistry.deploy(deployer.address);
    await registry.waitForDeployment();
    
    const registryAddress = await registry.getAddress();
    console.log("ContractRegistry deployed to:", registryAddress);

    // Save deployment data
    const deploymentPath = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentPath)) {
        fs.mkdirSync(deploymentPath, { recursive: true });
    }

    const networkName = (await ethers.provider.getNetwork()).name;
    const latestFile = path.join(deploymentPath, `${networkName}-latest.json`);
    
    // Load existing deployment data if it exists
    let existingData = {};
    if (fs.existsSync(latestFile)) {
        existingData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    }

    // Add registry to deployment data
    const deploymentData = {
        ...existingData,
        ContractRegistry: {
            address: registryAddress,
            owner: deployer.address,
            deployedAt: new Date().toISOString(),
            network: networkName
        }
    };

    // Save with timestamp
    const filename = `${networkName}-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentPath, filename),
        JSON.stringify(deploymentData, null, 2)
    );

    // Update latest
    fs.writeFileSync(
        latestFile,
        JSON.stringify(deploymentData, null, 2)
    );

    console.log(`Deployment data saved to ${filename}`);

    // Export ABI
    const artifact = await ethers.getContractFactory("ContractRegistry");
    const abi = artifact.interface.formatJson();
    
    const abiPath = path.join(__dirname, "../abis");
    if (!fs.existsSync(abiPath)) {
        fs.mkdirSync(abiPath, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(abiPath, "ContractRegistry.json"),
        abi
    );
    
    console.log("ABI exported to abis/ContractRegistry.json");

    console.log("\nDeployment complete!");
    console.log("=================================");
    console.log("ContractRegistry:", registryAddress);
    console.log("=================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });