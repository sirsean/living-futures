#!/usr/bin/env node
import { Command } from 'commander';
import { OracleSyncService } from './services/OracleSyncService.js';

const program = new Command();

program
  .name('oracle')
  .description('Living Futures Baseball Oracle CLI')
  .version('1.0.0');

/**
 * Gets today's date in Eastern Time, properly handling DST
 * @returns Date object for today in ET
 */
function getTodayInET(): Date {
  // Create a date object for the current UTC time
  const now = new Date();
  
  // Format a date string in ET using Intl.DateTimeFormat
  // This properly handles DST transitions automatically
  const etDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', // Eastern Time zone
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Get the date parts
  const dateParts = etDateFormatter.formatToParts(now);
  
  // Extract the individual components
  const year = parseInt(dateParts.find(part => part.type === 'year')?.value || '0');
  const month = parseInt(dateParts.find(part => part.type === 'month')?.value || '0') - 1; // Months are 0-indexed in Date
  const day = parseInt(dateParts.find(part => part.type === 'day')?.value || '0');
  
  // Create a new date using ET date (but with local time)
  // We only care about the date part (YYYY-MM-DD), not the time
  return new Date(year, month, day);
}

program
  .command('sync')
  .description('Sync baseball game results to the Oracle contract')
  .option('-d, --date <date>', 'Date to sync in YYYY-MM-DD format (default: today in Eastern Time)')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      const syncService = new OracleSyncService();
      
      // Get the date to use (today in ET by default)
      let targetDate: Date;
      let isDefaultDate = false;
      
      if (options.date) {
        // User provided a date - parse it
        targetDate = new Date(options.date);
        if (isNaN(targetDate.getTime())) {
          throw new Error(`Invalid date format: ${options.date}. Please use YYYY-MM-DD format.`);
        }
      } else {
        // Use today in Eastern Time
        targetDate = getTodayInET();
        isDefaultDate = true;
      }
      
      // Format the date for display
      const formattedDate = targetDate.toISOString().split('T')[0];
      
      // Display the date that's being used
      const defaultDateMsg = isDefaultDate ? ' (today in Eastern Time/MLB home timezone)' : '';
      console.log(`Syncing baseball games for date: ${formattedDate}${defaultDateMsg}`);
      
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