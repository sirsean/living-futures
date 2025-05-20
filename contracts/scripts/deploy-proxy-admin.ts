import { ethers } from "hardhat";
import { upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying ProxyAdmin with the account:", deployer.address);

    // Deploy ProxyAdmin
    console.log("Deploying ProxyAdmin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("ProxyAdmin deployed to:", proxyAdminAddress);

    // Save deployment data
    const deploymentData = {
        ProxyAdmin: {
            address: proxyAdminAddress,
            owner: deployer.address,
            deployedAt: new Date().toISOString(),
            network: (await ethers.provider.getNetwork()).name
        }
    };

    const deploymentPath = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentPath)) {
        fs.mkdirSync(deploymentPath, { recursive: true });
    }

    const networkName = (await ethers.provider.getNetwork()).name;
    
    // Load existing deployment data if it exists
    const latestFile = path.join(deploymentPath, `${networkName}-latest.json`);
    let existingData = {};
    if (fs.existsSync(latestFile)) {
        existingData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    }

    // Merge with existing data
    const updatedData = { ...existingData, ...deploymentData };

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

    console.log("\nDeployment complete!");
    console.log("=================================");
    console.log("ProxyAdmin:", proxyAdminAddress);
    console.log("=================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });