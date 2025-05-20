#!/usr/bin/env node
import { config } from "dotenv";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Load environment variables from the root .env file
const envPath = join(projectRoot, ".env");
if (!existsSync(envPath)) {
  console.error(
    "Error: .env file not found. Please create one based on .env.template",
  );
  process.exit(1);
}

config({ path: envPath });

// Define the secrets we want to sync to GitHub
const secretsToSync = [
  { env: "CLOUDFLARE_API_TOKEN", github: "CLOUDFLARE_API_TOKEN" },
  { env: "CLOUDFLARE_ACCOUNT_ID", github: "CLOUDFLARE_ACCOUNT_ID" },
];

async function syncSecrets() {
  console.log("Syncing secrets to GitHub...\n");

  // Check if gh CLI is installed
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch (error) {
    console.error(
      "Error: GitHub CLI (gh) is not installed. Please install it first:",
    );
    console.error("https://cli.github.com/manual/installation");
    process.exit(1);
  }

  // Check if we're in a GitHub repository
  try {
    execSync("gh repo view", { stdio: "ignore" });
  } catch (error) {
    console.error("Error: Not in a GitHub repository or not authenticated.");
    console.error("Please run: gh auth login");
    process.exit(1);
  }

  for (const secret of secretsToSync) {
    const value = process.env[secret.env];

    if (!value) {
      console.warn(`Warning: ${secret.env} not found in .env, skipping...`);
      continue;
    }

    console.log(`Setting secret: ${secret.github}`);

    try {
      execSync(`gh secret set ${secret.github}`, {
        input: value,
        stdio: ["pipe", "inherit", "inherit"],
      });
      console.log(`✓ ${secret.github} set successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to set ${secret.github}:`, errorMessage);
    }
  }

  console.log("\nSecrets sync completed!");
  console.log(
    `\nNote: You'll need to create the "living-futures" project in Cloudflare Pages`,
  );
  console.log("before the deployment workflow will succeed.");
}

syncSecrets().catch(console.error);
