import { BaseballDataService, GameResult } from '../api/BaseballDataService.js';

export interface OracleGameData {
  gameId: number;         // Unique game identifier
  homeTeam: string;       // Home team abbreviation
  awayTeam: string;       // Away team abbreviation
  homeScore: number;      // Final home team score
  awayScore: number;      // Final away team score
  timestamp: number;      // Unix timestamp of game end
}

/**
 * Service responsible for syncing baseball game data to the Oracle contract
 */
export class OracleSyncService {
  private baseballDataService: BaseballDataService;

  /**
   * Creates a new OracleSyncService
   * @param baseballDataService Optional BaseballDataService instance
   */
  constructor(baseballDataService?: BaseballDataService) {
    this.baseballDataService = baseballDataService || new BaseballDataService();
  }

  /**
   * Gets games for a specific date and prepares them for blockchain submission
   * @param date Date to fetch games for (required)
   * @returns Promise<OracleGameData[]> Games prepared for blockchain
   */
  async prepareGamesForDate(date: Date): Promise<OracleGameData[]> {
    // Format the date for the API
    const formattedDate = date.toISOString().split('T')[0];
    
    // Fetch all games for the date
    const games = await this.baseballDataService.getGamesForDate(formattedDate);
    
    // Filter for completed games only (postponed games already filtered by BaseballDataService)
    const finalGames = games.filter(game => game.gameStatus === 'Final');
    
    // Transform to oracle format
    return finalGames.map(game => this.transformToOracleData(game));
  }

  /**
   * Transforms a GameResult to OracleGameData format
   * @param game GameResult object from BaseballDataService
   * @returns OracleGameData Game data ready for blockchain
   */
  private transformToOracleData(game: GameResult): OracleGameData {
    return {
      gameId: game.gameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      timestamp: game.gameEndTimestamp
    };
  }
}