# Setting Up Cloudflare Pages for Living Futures

This guide walks you through setting up Cloudflare Pages with direct GitHub integration for automatic deployments.

## Prerequisites

1. Cloudflare account (free tier is sufficient)
2. GitHub repository for Living Futures

## Setup Steps

### 1. Create the Pages Project

1. Go to the Cloudflare dashboard
2. Navigate to Workers & Pages
3. Click "Create application"
4. Select "Pages"
5. Connect to Git (GitHub)
6. Select the "living-futures" repository
7. Configure the project:
   - Project name: `living-futures`
   - Production branch: `main`
   - Framework preset: None
   - Build command: `cd dapp && npm install && npm run build`
   - Build output directory: `dapp/dist`
   - Root directory: `/`
8. Add environment variables:
   - `NODE_VERSION`: `18`
9. Click "Save and Deploy"

### 2. Configure Branch Deployments

Cloudflare automatically creates deployments for:
- **Production**: Pushes to `main` → `living-futures.pages.dev`
- **Preview**: All other branches → `[branch-name].living-futures.pages.dev`
- **Pull Requests**: Automatic preview URLs

### 3. Optional: Configure Staging Branch

To set up a dedicated staging environment:
1. Go to your Cloudflare Pages project settings
2. Navigate to "Builds & deployments"
3. Add `staging` as a production branch alias
4. This creates `staging.living-futures.pages.dev`

## Deployment Workflow

With direct GitHub integration:
1. Push to `main` → Automatic production deployment
2. Push to `staging` → Automatic staging deployment
3. Create a PR → Automatic preview deployment
4. Merge PR → Automatic production deployment

No GitHub Actions required - Cloudflare handles everything!

## Build Configuration

Cloudflare uses these settings for every build:
- Install command: `cd dapp && npm install`
- Build command: `cd dapp && npm run build`
- Output directory: `dapp/dist`
- Node version: 18

## Monitoring Deployments

1. **Cloudflare Dashboard**: View deployment status and logs
2. **GitHub PR Comments**: Cloudflare posts preview URLs automatically
3. **Deployment URLs**:
   - Production: `https://living-futures.pages.dev`
   - Staging: `https://staging.living-futures.pages.dev`
   - Previews: `https://[branch-name].living-futures.pages.dev`

## Troubleshooting

- **Build failures**: Check build logs in Cloudflare dashboard
- **Wrong directory**: Ensure build output is `dapp/dist`
- **Node version issues**: Verify `NODE_VERSION=18` is set
- **Monorepo issues**: Build command must include `cd dapp`