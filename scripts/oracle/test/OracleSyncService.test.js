import { jest } from '@jest/globals';
import { OracleSyncService } from '../services/OracleSyncService.js';

// Create mock for BaseballDataService
const mockGetGamesForDate = jest.fn();
const mockBaseballDataService = {
  getGamesForDate: mockGetGamesForDate
};

describe('OracleSyncService', () => {
  let oracleSyncService;
  
  beforeEach(() => {
    // Reset mock calls between tests
    mockGetGamesForDate.mockReset();
    
    // Create a new service instance with the mock
    oracleSyncService = new OracleSyncService(mockBaseballDataService);
  });
  
  test('should filter games to only include final games', async () => {
    // Setup mock games data - mix of final and in-progress games
    const mockGames = [
      {
        gameId: 123,
        homeTeam: 'HOU',
        awayTeam: 'NYY',
        homeScore: 5,
        awayScore: 3,
        gameDate: 1684800000, // Example timestamp
        gameEndTimestamp: 1684810800, // Example timestamp
        gameStatus: 'Final'
      },
      {
        gameId: 456,
        homeTeam: 'LAD',
        awayTeam: 'SFG',
        homeScore: 2,
        awayScore: 2,
        gameDate: 1684800000, // Example timestamp
        gameEndTimestamp: 1684810800, // Example timestamp
        gameStatus: 'InProgress'
      },
      {
        gameId: 789,
        homeTeam: 'BOS',
        awayTeam: 'TOR',
        homeScore: 7,
        awayScore: 1,
        gameDate: 1684800000, // Example timestamp
        gameEndTimestamp: 1684810800, // Example timestamp
        gameStatus: 'Final'
      }
    ];
    
    // Configure the mock to return our test data
    mockGetGamesForDate.mockResolvedValue(mockGames);
    
    // Call the method under test
    const result = await oracleSyncService.prepareGamesForDate(new Date('2023-05-23'));
    
    // Verify the mock was called with the correct date
    expect(mockGetGamesForDate).toHaveBeenCalledWith('2023-05-23');
    
    // Should only include Final games
    expect(result.length).toBe(2);
    
    // Verify the structure of the returned data
    expect(result).toEqual([
      {
        gameId: 123,
        homeTeam: 'HOU',
        awayTeam: 'NYY',
        homeScore: 5,
        awayScore: 3,
        timestamp: 1684810800
      },
      {
        gameId: 789,
        homeTeam: 'BOS',
        awayTeam: 'TOR',
        homeScore: 7,
        awayScore: 1,
        timestamp: 1684810800
      }
    ]);
  });
  
  test('should filter out postponed games even if returned from data service', async () => {
    // Setup mock games including a postponed game
    const mockGames = [
      {
        gameId: 123,
        homeTeam: 'HOU',
        awayTeam: 'NYY',
        homeScore: 5,
        awayScore: 3,
        gameDate: 1684800000,
        gameEndTimestamp: 1684810800,
        gameStatus: 'Final'
      },
      {
        gameId: 777839,
        homeTeam: 'MIN',
        awayTeam: 'CLE',
        homeScore: 0,
        awayScore: 0,
        gameDate: 1716249600,
        gameEndTimestamp: 1716249600,
        gameStatus: 'Postponed' // This should be filtered out
      }
    ];
    
    // Configure the mock to return our test data
    mockGetGamesForDate.mockResolvedValue(mockGames);
    
    // Call the method under test
    const result = await oracleSyncService.prepareGamesForDate(new Date('2023-05-23'));
    
    // Should only include Final games, not postponed
    expect(result.length).toBe(1);
    expect(result[0].gameId).toBe(123);
    
    // Verify postponed game was filtered out
    const gameIds = result.map(game => game.gameId);
    expect(gameIds).not.toContain(777839);
  });

  test('should handle empty game list', async () => {
    // Configure the mock to return empty array
    mockGetGamesForDate.mockResolvedValue([]);
    
    // Call the method under test
    const result = await oracleSyncService.prepareGamesForDate(new Date('2023-05-23'));
    
    // Should return empty array
    expect(result.length).toBe(0);
    expect(result).toEqual([]);
  });

  test('should format games correctly for blockchain', async () => {
    // Setup mock with multiple final games to test table output
    const mockGames = [
      {
        gameId: 123456,
        homeTeam: 'NYY',
        awayTeam: 'BOS',
        homeScore: 7,
        awayScore: 5,
        gameDate: 1684800000,
        gameEndTimestamp: 1684810800,
        gameStatus: 'Final'
      },
      {
        gameId: 789012,
        homeTeam: 'LAD',
        awayTeam: 'SFG',
        homeScore: 3,
        awayScore: 8,
        gameDate: 1684800000,
        gameEndTimestamp: 1684815600,
        gameStatus: 'Final'
      }
    ];
    
    // Configure the mock to return our test data
    mockGetGamesForDate.mockResolvedValue(mockGames);
    
    // Call the method under test
    const result = await oracleSyncService.prepareGamesForDate(new Date('2023-05-23'));
    
    // Verify the correct structure for blockchain data
    expect(result).toEqual([
      {
        gameId: 123456,
        homeTeam: 'NYY',
        awayTeam: 'BOS',
        homeScore: 7,
        awayScore: 5,
        timestamp: 1684810800
      },
      {
        gameId: 789012,
        homeTeam: 'LAD',
        awayTeam: 'SFG',
        homeScore: 3,
        awayScore: 8,
        timestamp: 1684815600
      }
    ]);
  });
});