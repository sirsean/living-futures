# Baseball Oracle Testing Guide

## Overview

This guide explains how to run tests for the BaseballOracle smart contract. The tests are comprehensive and cover all aspects of the contract's functionality.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Properly configured environment

## Installation

1. Navigate to the contracts directory:
   ```bash
   cd contracts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running Tests

To run all tests:
```bash
npm test
```

To run a specific test file:
```bash
npx hardhat test test/BaseballOracle.test.js
```

To run tests with gas reporting:
```bash
REPORT_GAS=true npm test
```

To run tests with coverage:
```bash
npm run coverage
```

## Test Structure

The BaseballOracle test suite includes:

1. **Initialization Tests**
   - Verifies correct role setup
   - Checks initial season state

2. **Team Registration Tests**
   - Admin can register teams
   - Prevents duplicate registrations
   - Enforces access control

3. **Game Recording Tests**
   - Single game recording
   - Batch game recording
   - Updates team statistics correctly
   - Handles non-final games

4. **Win Percentage Calculation Tests**
   - Accurate percentage calculations
   - Handles edge cases (0-0 records)

5. **Season Management Tests**
   - Season activation/deactivation
   - Record resets on new season

6. **Administrative Function Tests**
   - Game result corrections
   - Team record adjustments
   - Access control enforcement

7. **Security Tests**
   - Role-based access control
   - Pausable functionality
   - Upgrade authorization

8. **Edge Case Tests**
   - Double-header handling
   - Postponed game management
   - Batch processing with failures

## Common Issues

### Issue: Private Key Error
If you see an error about invalid private keys:
- You don't need private keys for local testing
- The config already handles this with conditional network setup

### Issue: Module Not Found
If modules aren't found:
```bash
rm -rf node_modules
npm install
```

### Issue: Compilation Errors
Ensure Solidity version matches:
- Check `hardhat.config.js` for version 0.8.20
- Verify contract pragma matches config

## Test Output

Successful test run will show:
```
BaseballOracle
  ✓ Initialization
    ✓ Should initialize with correct roles
    ✓ Should start with season inactive
  ✓ Team Registration
    ✓ Should allow admin to register a team
    ✓ Should not allow duplicate team registration
    ...
```

## Continuous Integration

For CI/CD pipelines:
```yaml
- name: Run Tests
  run: |
    cd contracts
    npm ci
    npm test
```

## Further Documentation

- See `docs/oracle-operations.md` for operational procedures
- See `docs/baseball-oracle-design.md` for system design
- See contract comments for implementation details