import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Interface for MLB Game data as returned by the API
 */
export interface MLBGame {
  gamePk: number;
  gameDate: string;
  teams: {
    away: {
      team: {
        id: number;
        name: string;
      };
      score?: number;
    };
    home: {
      team: {
        id: number;
        name: string;
      };
      score?: number;
    };
  };
  status: {
    abstractGameState: string; // 'Preview', 'Live', 'Final'
    codedGameState: string;
    detailedState: string;
    startTimeTBD: boolean;
  };
  gameType: string; // 'R' for regular season
  season: string;
  // Additional fields may be available but not required for our use case
}

/**
 * Interface for MLB Team data as returned by the API
 */
export interface MLBTeam {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  teamCode: string;
  locationName: string;
  shortName: string;
  active: boolean;
  // Additional fields may be available but not required for our use case
}

/**
 * MLBApiClient class to interact with the MLB Stats API
 */
export class MLBApiClient {
  private readonly baseUrl: string;
  private readonly client: AxiosInstance;

  /**
   * Creates a new MLBApiClient
   * @param baseUrl Optional base URL, defaults to MLB Stats API endpoint
   */
  constructor(baseUrl: string = 'https://statsapi.mlb.com/api/v1') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 seconds timeout
    });
  }

  /**
   * Get games for a specific date
   * @param date Date in YYYY-MM-DD format
   * @param sportId Sport ID (default: 1 for MLB)
   * @returns Array of MLB games
   */
  async getGames(date: string, sportId: number = 1): Promise<MLBGame[]> {
    try {
      const response: AxiosResponse = await this.client.get('/schedule/games', {
        params: {
          sportId,
          date,
        },
      });

      // The MLB API returns data in a nested format
      if (response.data && 
          response.data.dates && 
          response.data.dates.length > 0 && 
          response.data.dates[0].games) {
        return response.data.dates[0].games;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch MLB games for date ${date}: ${errorMessage}`);
    }
  }

  /**
   * Get team information by team ID
   * @param teamId MLB team ID
   * @returns MLB team information
   */
  async getTeam(teamId: number): Promise<MLBTeam> {
    try {
      const response: AxiosResponse = await this.client.get(`/teams/${teamId}`);
      
      if (response.data && response.data.teams && response.data.teams.length > 0) {
        return response.data.teams[0];
      }
      
      throw new Error(`Team with ID ${teamId} not found`);
    } catch (error) {
      console.error(`Error fetching MLB team with ID ${teamId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch MLB team with ID ${teamId}: ${errorMessage}`);
    }
  }

  /**
   * Get all active MLB teams
   * @returns Array of MLB teams
   */
  async getAllTeams(): Promise<MLBTeam[]> {
    try {
      const response: AxiosResponse = await this.client.get('/teams', {
        params: {
          sportId: 1, // MLB
          activeStatus: 'Y' // Only active teams
        }
      });
      
      if (response.data && response.data.teams) {
        return response.data.teams;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching all MLB teams:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch all MLB teams: ${errorMessage}`);
    }
  }

  /**
   * Utility method to convert a date object to YYYY-MM-DD string format
   * @param date Date object
   * @returns Date string in YYYY-MM-DD format
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}