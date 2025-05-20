import { jest } from '@jest/globals';
import axios from 'axios';
import { MLBApiClient } from '../api/MLBApiClient.js';

// Mock axios
jest.mock('axios');

// Create a mock axios instance with the correct function mocks
const mockAxiosGet = jest.fn();
const mockAxiosInstance = { get: mockAxiosGet };

// Set up axios.create to return our mock instance
const mockCreate = jest.fn().mockReturnValue(mockAxiosInstance);
axios.create = mockCreate;

describe('MLBApiClient', () => {
  let client;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockReset();
    mockCreate.mockClear();
    
    client = new MLBApiClient();
  });

  describe('constructor', () => {
    it('should create a client with default base URL', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://statsapi.mlb.com/api/v1',
        timeout: 10000
      });
    });

    it('should create a client with custom base URL', () => {
      client = new MLBApiClient('https://custom.mlb.api');
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://custom.mlb.api',
        timeout: 10000
      });
    });
  });

  describe('getGames', () => {
    const mockResponse = {
      data: {
        dates: [
          {
            games: [
              {
                gamePk: 123456,
                gameDate: '2025-05-19T18:10:00Z',
                status: {
                  abstractGameState: 'Final',
                  codedGameState: 'F',
                  detailedState: 'Final',
                  startTimeTBD: false
                },
                teams: {
                  away: {
                    team: { id: 145, name: 'Chicago White Sox' },
                    score: 3
                  },
                  home: {
                    team: { id: 116, name: 'Detroit Tigers' },
                    score: 5
                  }
                },
                gameType: 'R',
                season: '2025'
              }
            ]
          }
        ]
      }
    };

    it('should fetch games for a given date', async () => {
      // Setup the mock response
      mockAxiosGet.mockResolvedValueOnce(mockResponse);

      // Call the method
      const result = await client.getGames('2025-05-19');
      
      // Verify the request
      expect(mockAxiosGet).toHaveBeenCalledWith('/schedule/games', {
        params: {
          sportId: 1,
          date: '2025-05-19'
        }
      });
      
      // Verify the response transformation
      expect(result).toHaveLength(1);
      expect(result[0].gamePk).toBe(123456);
      expect(result[0].teams.home.team.name).toBe('Detroit Tigers');
      expect(result[0].teams.away.score).toBe(3);
    });

    it('should return empty array when no games found', async () => {
      // Setup the mock response with no games
      mockAxiosGet.mockResolvedValueOnce({ data: { dates: [] } });

      // Call the method
      const result = await client.getGames('2025-05-19');
      
      // Verify result
      expect(result).toEqual([]);
    });

    it('should throw error when API request fails', async () => {
      // Setup the mock response to reject
      mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

      // Call the method and expect it to throw
      await expect(client.getGames('2025-05-19')).rejects.toThrow('Failed to fetch MLB games for date 2025-05-19: API Error');
    });
  });

  describe('getTeam', () => {
    const mockTeamResponse = {
      data: {
        teams: [
          {
            id: 145,
            name: 'Chicago White Sox',
            teamName: 'White Sox',
            abbreviation: 'CWS',
            teamCode: 'cha',
            locationName: 'Chicago',
            shortName: 'Chi White Sox',
            active: true
          }
        ]
      }
    };

    it('should fetch team by ID', async () => {
      // Setup the mock response
      mockAxiosGet.mockResolvedValueOnce(mockTeamResponse);

      // Call the method
      const result = await client.getTeam(145);
      
      // Verify the request
      expect(mockAxiosGet).toHaveBeenCalledWith('/teams/145');
      
      // Verify the response
      expect(result.id).toBe(145);
      expect(result.name).toBe('Chicago White Sox');
      expect(result.abbreviation).toBe('CWS');
    });

    it('should throw error when team not found', async () => {
      // Setup the mock response with no teams
      mockAxiosGet.mockResolvedValueOnce({ data: { teams: [] } });

      // Call the method and expect it to throw
      await expect(client.getTeam(999)).rejects.toThrow('Team with ID 999 not found');
    });

    it('should throw error when API request fails', async () => {
      // Setup the mock response to reject
      mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

      // Call the method and expect it to throw
      await expect(client.getTeam(145)).rejects.toThrow('Failed to fetch MLB team with ID 145: API Error');
    });
  });

  describe('getAllTeams', () => {
    const mockAllTeamsResponse = {
      data: {
        teams: [
          {
            id: 145,
            name: 'Chicago White Sox',
            abbreviation: 'CWS',
            active: true
          },
          {
            id: 116,
            name: 'Detroit Tigers',
            abbreviation: 'DET',
            active: true
          }
        ]
      }
    };

    it('should fetch all active teams', async () => {
      // Setup the mock response
      mockAxiosGet.mockResolvedValueOnce(mockAllTeamsResponse);

      // Call the method
      const result = await client.getAllTeams();
      
      // Verify the request
      expect(mockAxiosGet).toHaveBeenCalledWith('/teams', {
        params: {
          sportId: 1,
          activeStatus: 'Y'
        }
      });
      
      // Verify the response
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(145);
      expect(result[1].name).toBe('Detroit Tigers');
    });

    it('should return empty array when no teams found', async () => {
      // Setup the mock response with no teams
      mockAxiosGet.mockResolvedValueOnce({ data: {} });

      // Call the method
      const result = await client.getAllTeams();
      
      // Verify result
      expect(result).toEqual([]);
    });

    it('should throw error when API request fails', async () => {
      // Setup the mock response to reject
      mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

      // Call the method and expect it to throw
      await expect(client.getAllTeams()).rejects.toThrow('Failed to fetch all MLB teams: API Error');
    });
  });

  describe('formatDate', () => {
    it('should format date object to YYYY-MM-DD string', () => {
      const date = new Date('2025-05-19T12:00:00Z');
      const result = MLBApiClient.formatDate(date);
      expect(result).toBe('2025-05-19');
    });
  });
});