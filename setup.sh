#!/bin/bash

echo "🚀 Setting up Living Futures project..."

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version check passed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install contract dependencies
echo "📦 Installing contract dependencies..."
cd contracts && npm install && cd ..

# Install dapp dependencies
echo "📦 Installing dapp dependencies..."
cd dapp && npm install && cd ..

# Install script dependencies
echo "📦 Installing script dependencies..."
cd scripts && npm install && cd ..

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.template .env
    echo "⚠️  Please edit .env with your configuration values"
fi

# Create GitHub action directories
echo "📁 Creating GitHub action directories..."
mkdir -p .github/workflows

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Run 'npm run dev' to start development server"
echo "3. Initialize git and push to GitHub"
echo ""
echo "Available commands:"
echo "  npm run dev           - Start development server"
echo "  npm run build         - Build all projects"
echo "  npm run test          - Run all tests"
echo "  npm run lint          - Run linters"
echo "  npm run typecheck     - Run TypeScript checks"