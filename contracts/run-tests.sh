#!/bin/bash

# Navigate to contracts directory
cd "$(dirname "$0")"

echo "Running Hardhat tests..."
echo "Note: This requires Node.js and npm to be installed"

# Run the hardhat test command directly
node_modules/.bin/hardhat test

echo "Tests complete!"