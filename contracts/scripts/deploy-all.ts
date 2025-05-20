import { ethers } from "hardhat";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying all contracts with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
    
    console.log("\n========================================");
    console.log("Starting deployment sequence...");
    console.log("========================================\n");

    try {
        // Step 1: Deploy ContractRegistry
        console.log("Step 1: Deploying ContractRegistry...");
        await execAsync("npx hardhat run scripts/deploy-registry.ts --network localhost");
        console.log("✓ ContractRegistry deployed\n");

        // Step 2: Deploy BaseballOracle
        console.log("Step 2: Deploying BaseballOracle...");
        await execAsync("npx hardhat run scripts/deploy-oracle.ts --network localhost");
        console.log("✓ BaseballOracle deployed\n");

        console.log("========================================");
        console.log("All contracts deployed successfully!");
        console.log("========================================");
        
        // Display deployment summary
        const fs = require("fs");
        const path = require("path");
        const networkName = (await ethers.provider.getNetwork()).name;
        const latestFile = path.join(__dirname, "../deployments", `${networkName}-latest.json`);
        
        if (fs.existsSync(latestFile)) {
            const deploymentData = JSON.parse(fs.readFileSync(latestFile, "utf8"));
            console.log("\nDeployment Summary:");
            console.log("------------------");
            
            if (deploymentData.ContractRegistry) {
                console.log(`ContractRegistry: ${deploymentData.ContractRegistry.address}`);
            }
            
            if (deploymentData.BaseballOracle) {
                console.log(`BaseballOracle Proxy: ${deploymentData.BaseballOracle.proxy}`);
                console.log(`BaseballOracle Implementation: ${deploymentData.BaseballOracle.implementation}`);
                console.log(`BaseballOracle Version: ${deploymentData.BaseballOracle.version}`);
            }
        }
        
    } catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });