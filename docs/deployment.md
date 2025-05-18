# Deployment Guide

This project uses Cloudflare Pages with direct GitHub integration for automatic deployments.

## How It Works

1. **Automatic Deployments**: Every push to GitHub triggers a build and deployment on Cloudflare
2. **No CI/CD Configuration**: No GitHub Actions or other CI/CD tools needed
3. **Built-in Preview URLs**: Every branch and PR gets its own preview URL

## Deployment URLs

- **Production**: https://living-futures.pages.dev (from `main` branch)
- **Staging**: https://staging.living-futures.pages.dev (from `staging` branch)
- **Previews**: https://[branch-name].living-futures.pages.dev (all other branches)
- **Pull Requests**: Automatic preview URLs posted as PR comments

## Build Settings

Cloudflare is configured with:
- **Build command**: `cd dapp && npm install && npm run build`
- **Output directory**: `dapp/dist`
- **Node version**: 18

## Making Changes

1. Create a feature branch
2. Make your changes
3. Push to GitHub
4. Cloudflare automatically builds and deploys to preview URL
5. Create a PR to see preview URL in comments
6. Merge to `main` for production deployment

## Monitoring

- View build logs in Cloudflare dashboard
- Check deployment status in GitHub PR comments
- Monitor performance in Cloudflare Analytics

## Rollbacks

To rollback a deployment:
1. Go to Cloudflare Pages dashboard
2. Select the project
3. Navigate to "Deployments" tab
4. Find the previous successful deployment
5. Click "Rollback to this deployment"

## Environment Variables

Environment variables are managed in Cloudflare Pages settings:
1. Go to project settings
2. Navigate to "Environment variables"
3. Add variables for production and preview environments

## Troubleshooting

See the [Cloudflare Setup Guide](/docs/cloudflare-setup.md) for detailed troubleshooting steps.