#!/usr/bin/env node
import { Command } from 'commander';
import { OracleSyncService } from './services/OracleSyncService.js';
import { getDefaultSyncDate, DEFAULT_DATE_CUTOFF_HOUR_ET } from './utils/dateUtils.js';

const program = new Command();

program
  .name('oracle')
  .description('Living Futures Baseball Oracle CLI')
  .version('1.0.0');


program
  .command('sync')
  .description('Sync baseball game results to the Oracle contract')
  .option('-d, --date <date>', `Date to sync in YYYY-MM-DD format (default: intelligent - today after ${DEFAULT_DATE_CUTOFF_HOUR_ET}AM ET, yesterday before ${DEFAULT_DATE_CUTOFF_HOUR_ET}AM ET)`)
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      const syncService = new OracleSyncService();
      
      // Get the date to use (time-aware default)
      let targetDate: Date;
      let isDefaultDate = false;
      let dateExplanation = '';
      
      if (options.date) {
        // User provided a date - parse it
        targetDate = new Date(options.date);
        if (isNaN(targetDate.getTime())) {
          throw new Error(`Invalid date format: ${options.date}. Please use YYYY-MM-DD format.`);
        }
      } else {
        // Use time-aware default date selection
        const defaultResult = getDefaultSyncDate();
        targetDate = defaultResult.date;
        isDefaultDate = true;
        dateExplanation = ` (${defaultResult.explanation})`;
      }
      
      // Format the date for display
      const formattedDate = targetDate.toISOString().split('T')[0];
      
      // Display the date that's being used
      console.log(`Syncing baseball games for date: ${formattedDate}${dateExplanation}`);
      
      // Get games for the target date
      const games = await syncService.prepareGamesForDate(targetDate);
      
      // Log verbose information if requested
      if (options.verbose) {
        console.log('\nFetched games (raw data):');
        console.log(JSON.stringify(games, null, 2));
      }
      
      // Log summary
      console.log(`\nFound ${games.length} completed games:`);
      
      if (games.length > 0) {
        // Create table headers
        const headers = ['Game ID', 'Away Team', 'Home Team', 'Away Score', 'Home Score', 'Timestamp'];
        const colWidths = [10, 10, 10, 11, 11, 12];
        
        // Print table header
        console.log('\nBlockchain Data Table:');
        console.log('┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐');
        console.log('│' + headers.map((h, i) => h.padEnd(colWidths[i])).join('│') + '│');
        console.log('├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤');
        
        // Print each game row
        games.forEach(game => {
          const row = [
            game.gameId.toString(),
            game.awayTeam,
            game.homeTeam,
            game.awayScore.toString(),
            game.homeScore.toString(),
            game.timestamp.toString()
          ];
          
          console.log('│' + row.map((cell, i) => cell.padEnd(colWidths[i])).join('│') + '│');
        });
        
        // Close table
        console.log('└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘');
        
        console.log('\nThese games would be synced to the blockchain.');
        console.log('Currently in simulation mode - no blockchain transactions were sent.');
      } else {
        console.log('\nNo completed games found for the specified date.');
      }
    } catch (error) {
      console.error('\nError syncing games:');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

// If no arguments are provided, show help
if (process.argv.length === 2) {
  program.help();
}