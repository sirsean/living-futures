import { MLBApiClient, MLBGame, MLBTeam } from './MLBApiClient.js';

/**
 * Interface for game result data formatted for the Oracle contract
 */
export interface GameResult {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  gameDate: number; // Unix timestamp
  gameEndTimestamp: number; // Unix timestamp
  gameStatus: string;
}

/**
 * Interface for team data formatted for the Oracle contract
 */
export interface Team {
  teamId: string; // The abbreviation we use as ID
  name: string;
  abbreviation: string;
  mlbId: number; // The original MLB API ID
}

/**
 * BaseballDataService class handles fetching and formatting baseball data
 * from the MLB API for consumption by the BaseballOracle smart contract
 */
export class BaseballDataService {
  private readonly mlbApiClient: MLBApiClient;
  private teamCache: Map<number, Team> = new Map(); // Cache MLB team ID -> Team

  /**
   * Creates a new BaseballDataService
   * @param apiClient Optional MLBApiClient instance
   */
  constructor(apiClient?: MLBApiClient) {
    this.mlbApiClient = apiClient || new MLBApiClient();
  }

  /**
   * Fetches games for a specified date and formats them for the Oracle
   * @param date Date in YYYY-MM-DD format or Date object
   * @returns Promise<GameResult[]> Array of game results
   */
  async getGamesForDate(date: string | Date): Promise<GameResult[]> {
    // Convert Date object to string if needed
    const dateStr = date instanceof Date ? MLBApiClient.formatDate(date) : date;
    
    // Fetch games from MLB API
    const mlbGames = await this.mlbApiClient.getGames(dateStr);
    
    // Transform MLB game data to our format
    const gamePromises = mlbGames
      .filter(game => this.isValidGame(game))
      .map(game => this.transformGameData(game));
    
    return Promise.all(gamePromises);
  }

  /**
   * Fetches all active MLB teams and formats them for the Oracle
   * @returns Promise<Team[]> Array of teams
   */
  async getAllTeams(): Promise<Team[]> {
    const mlbTeams = await this.mlbApiClient.getAllTeams();
    return mlbTeams
      .filter(team => team.active)
      .map(team => this.transformTeamData(team));
  }

  /**
   * Fetches a specific team by MLB team ID
   * @param teamId MLB team ID
   * @returns Promise<Team> Team data
   */
  async getTeam(teamId: number): Promise<Team> {
    // Check cache first
    if (this.teamCache.has(teamId)) {
      // We already checked with has() so we know it exists
      return this.teamCache.get(teamId)!;
    }
    
    const mlbTeam = await this.mlbApiClient.getTeam(teamId);
    const team = this.transformTeamData(mlbTeam);
    
    // Cache the result
    this.teamCache.set(teamId, team);
    
    return team;
  }

  /**
   * Validates if a game is eligible for processing
   * @param game MLBGame object
   * @returns boolean True if game is valid for processing
   */
  private isValidGame(game: MLBGame): boolean {
    // Skip games that are not regular season
    if (game.gameType !== 'R') {
      return false;
    }
    
    // Skip games with no scores (usually means the game hasn't started or completed)
    if (game.status.abstractGameState === 'Preview') {
      return false;
    }
    
    // Skip postponed games even if they show as "Final" - they don't affect standings
    if (game.status.detailedState?.includes('Postponed')) {
      return false;
    }
    
    // Include games that are Final or Live
    return ['Final', 'Live'].includes(game.status.abstractGameState);
  }

  /**
   * Transforms MLB game data to GameResult format
   * @param game MLBGame object
   * @returns Promise<GameResult> Formatted game result
   */
  private async transformGameData(game: MLBGame): Promise<GameResult> {
    // Fetch team data if not already cached
    const homeTeamData = await this.getTeam(game.teams.home.team.id);
    const awayTeamData = await this.getTeam(game.teams.away.team.id);
    
    // Parse game date to timestamp
    const gameDate = new Date(game.gameDate);
    
    // Default scores to 0 if not available
    const homeScore = game.teams.home.score ?? 0;
    const awayScore = game.teams.away.score ?? 0;
    
    // For in-progress games, the end timestamp is the current time
    // For completed games, assume it ended at the game date plus ~3 hours
    const isCompleted = game.status.abstractGameState === 'Final';
    const gameEndTimestamp = isCompleted 
      ? Math.floor(gameDate.getTime() / 1000) + 10800 // 3 hours in seconds
      : Math.floor(Date.now() / 1000);
    
    return {
      gameId: game.gamePk,
      homeTeam: homeTeamData.teamId,
      awayTeam: awayTeamData.teamId,
      homeScore,
      awayScore,
      gameDate: Math.floor(gameDate.getTime() / 1000),
      gameEndTimestamp,
      gameStatus: this.mapGameStatus(game.status.abstractGameState, game.status.detailedState)
    };
  }

  /**
   * Transforms MLB team data to Team format
   * @param team MLBTeam object
   * @returns Team Formatted team data
   */
  private transformTeamData(team: MLBTeam): Team {
    return {
      teamId: team.abbreviation,
      name: team.name,
      abbreviation: team.abbreviation,
      mlbId: team.id
    };
  }

  /**
   * Maps MLB game status to Oracle status format
   * @param abstractState MLB abstract game state
   * @param detailedState MLB detailed game state
   * @returns string Status string for the Oracle
   */
  private mapGameStatus(abstractState: string, detailedState: string): string {
    if (abstractState === 'Final') {
      return 'Final';
    }
    
    if (abstractState === 'Live') {
      return 'InProgress';
    }
    
    if (detailedState.includes('Postponed')) {
      return 'Postponed';
    }
    
    if (detailedState.includes('Suspended')) {
      return 'Suspended';
    }
    
    if (detailedState.includes('Cancelled')) {
      return 'Cancelled';
    }
    
    return 'Scheduled';
  }
}