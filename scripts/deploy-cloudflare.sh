#!/bin/bash

# Deploy to Cloudflare Pages

echo "🚀 Deploying Living Futures to Cloudflare Pages..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Environment argument
ENV=${1:-staging}

# Validate environment
if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo "❌ Error: Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

echo "📦 Building for $ENV environment..."

# Change to dapp directory
cd dapp

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run build
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Deploy to Cloudflare
echo "☁️  Deploying to Cloudflare Pages ($ENV)..."

if [ "$ENV" = "production" ]; then
    echo "⚠️  WARNING: Deploying to PRODUCTION"
    echo "Are you sure? (y/N)"
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
    
    npx wrangler pages deploy dist --project-name=living-futures --env=production
else
    npx wrangler pages deploy dist --project-name=living-futures --env=staging
fi

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    if [ "$ENV" = "production" ]; then
        echo "🌐 Production URL: https://living-futures.pages.dev"
    else
        echo "🌐 Staging URL: https://staging.living-futures.pages.dev"
    fi
else
    echo "❌ Deployment failed"
    exit 1
fi

# Return to root
cd ..