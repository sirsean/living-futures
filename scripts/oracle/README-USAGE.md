# Baseball Oracle Usage Guide

The Baseball Oracle provides a CLI tool for syncing game results to the blockchain.

## Setup

Before using the Oracle CLI, make sure you have:

1. Node.js 22+ installed
2. All dependencies installed (`npm install` from the project root)

## Oracle Sync Command

The `oracle:sync` command fetches completed baseball games for a specific date and prepares them for blockchain submission.

### Basic Usage

```bash
# From the project root:
npm run oracle:sync

# From the scripts directory:
npm run oracle:sync
```

This will fetch all completed games for today in Eastern Time (ET), which is the MLB's home timezone. The system automatically handles Daylight Saving Time adjustments and will clearly display the exact date being used.

### Command Options

The sync command supports the following options:

- `-d, --date <date>`: Specify a date in YYYY-MM-DD format (default: today in Eastern Time)
- `-v, --verbose`: Enable verbose output with full game details

### Examples

```bash
# Sync with today's games (default)
npm run oracle:sync

# Sync with games from a specific date
npm run oracle:sync -- -d 2023-05-24

# Show verbose output
npm run oracle:sync -- -v

# Combine options
npm run oracle:sync -- -d 2023-06-01 -v
```

## Development

To run the Oracle CLI in development mode with automatic reloading:

```bash
# From the project root:
npm run dev

# From the scripts directory:
npm run dev
```

## Testing

To run tests for the Oracle components:

```bash
# From the project root:
npm run test:scripts

# Just the Oracle tests:
npm run test:oracle
```