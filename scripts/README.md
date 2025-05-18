# Living Futures Management Scripts

This directory contains management scripts for the Living Futures platform.

## Available Scripts

### Deploy Scripts
- `npm run deploy` - Deploy all contracts to the blockchain
- `npm run verify` - Verify contracts on block explorer

### Management Scripts
- `npm run update-oracle` - Update oracle price feeds
- `npm run process-funding` - Process daily funding calculations
- `npm run sync-github-secrets` - Sync secrets from .env to GitHub

### Development
- `npm run dev` - Run development scripts with hot reload

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.template` to `.env` in the root directory
   - Fill in all required values

3. Sync secrets to GitHub (required for CI/CD):
   ```bash
   npm run sync-github-secrets
   ```

## GitHub Secrets Sync

**Note**: With direct Cloudflare Pages integration, GitHub secrets are not required for deployment. The `sync-github-secrets` script is available for other workflows that may need secrets in GitHub Actions.

The script can sync environment variables from your `.env` file to GitHub secrets if needed for custom workflows.

## Environment Variables

See the root `.env.template` for all available environment variables.