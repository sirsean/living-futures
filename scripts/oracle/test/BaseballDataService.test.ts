import { jest } from '@jest/globals';
import { MLBApiClient, MLBGame, MLBTeam } from '../api/MLBApiClient.js';
import { BaseballDataService, GameResult, Team } from '../api/BaseballDataService.js';

// Mock MLBApiClient
jest.mock('../api/MLBApiClient.js');
const MockedMLBApiClient = MLBApiClient as jest.MockedClass<typeof MLBApiClient>;

describe('BaseballDataService', () => {
  let service: BaseballDataService;
  let mockApiClient: jest.Mocked<MLBApiClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock MLBApiClient
    mockApiClient = {
      getGames: jest.fn(),
      getTeam: jest.fn(),
      getAllTeams: jest.fn()
    } as any;
    
    MockedMLBApiClient.prototype.getGames = mockApiClient.getGames;
    MockedMLBApiClient.prototype.getTeam = mockApiClient.getTeam;
    MockedMLBApiClient.prototype.getAllTeams = mockApiClient.getAllTeams;
    MockedMLBApiClient.formatDate = jest.fn(date => date.toISOString().split('T')[0]);
    
    service = new BaseballDataService(mockApiClient);
  });

  describe('getGamesForDate', () => {
    // Mock MLB games data
    const mockGames: MLBGame[] = [
      // Completed game (Final)
      {
        gamePk: 123456,
        gameDate: '2025-05-19T18:10:00Z',
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
        status: {
          abstractGameState: 'Final',
          codedGameState: 'F',
          detailedState: 'Final',
          startTimeTBD: false
        },
        gameType: 'R',
        season: '2025'
      },
      // Game in progress
      {
        gamePk: 123457,
        gameDate: '2025-05-19T20:10:00Z',
        teams: {
          away: {
            team: { id: 147, name: 'New York Yankees' },
            score: 2
          },
          home: {
            team: { id: 111, name: 'Boston Red Sox' },
            score: 1
          }
        },
        status: {
          abstractGameState: 'Live',
          codedGameState: 'I',
          detailedState: 'In Progress',
          startTimeTBD: false
        },
        gameType: 'R',
        season: '2025'
      },
      // Scheduled game (not started)
      {
        gamePk: 123458,
        gameDate: '2025-05-19T23:10:00Z',
        teams: {
          away: {
            team: { id: 136, name: 'Seattle Mariners' },
            score: undefined
          },
          home: {
            team: { id: 133, name: 'Oakland Athletics' },
            score: undefined
          }
        },
        status: {
          abstractGameState: 'Preview',
          codedGameState: 'S',
          detailedState: 'Scheduled',
          startTimeTBD: false
        },
        gameType: 'R',
        season: '2025'
      },
      // Non-regular season game (should be filtered out)
      {
        gamePk: 123459,
        gameDate: '2025-05-19T19:10:00Z',
        teams: {
          away: {
            team: { id: 158, name: 'Milwaukee Brewers' },
            score: 4
          },
          home: {
            team: { id: 112, name: 'Chicago Cubs' },
            score: 2
          }
        },
        status: {
          abstractGameState: 'Final',
          codedGameState: 'F',
          detailedState: 'Final',
          startTimeTBD: false
        },
        gameType: 'E', // Exhibition, not regular season
        season: '2025'
      }
    ];
    
    // Mock team data
    const mockTeams: { [key: number]: MLBTeam } = {
      145: {
        id: 145,
        name: 'Chicago White Sox',
        teamName: 'White Sox',
        abbreviation: 'CWS',
        teamCode: 'cha',
        locationName: 'Chicago',
        shortName: 'Chi White Sox',
        active: true
      },
      116: {
        id: 116,
        name: 'Detroit Tigers',
        teamName: 'Tigers',
        abbreviation: 'DET',
        teamCode: 'det',
        locationName: 'Detroit',
        shortName: 'Detroit',
        active: true
      },
      147: {
        id: 147,
        name: 'New York Yankees',
        teamName: 'Yankees',
        abbreviation: 'NYY',
        teamCode: 'nya',
        locationName: 'New York',
        shortName: 'NY Yankees',
        active: true
      },
      111: {
        id: 111,
        name: 'Boston Red Sox',
        teamName: 'Red Sox',
        abbreviation: 'BOS',
        teamCode: 'bos',
        locationName: 'Boston',
        shortName: 'Boston',
        active: true
      },
      136: {
        id: 136,
        name: 'Seattle Mariners',
        teamName: 'Mariners',
        abbreviation: 'SEA',
        teamCode: 'sea',
        locationName: 'Seattle',
        shortName: 'Seattle',
        active: true
      },
      133: {
        id: 133,
        name: 'Oakland Athletics',
        teamName: 'Athletics',
        abbreviation: 'OAK',
        teamCode: 'oak',
        locationName: 'Oakland',
        shortName: 'Oakland',
        active: true
      },
      158: {
        id: 158,
        name: 'Milwaukee Brewers',
        teamName: 'Brewers',
        abbreviation: 'MIL',
        teamCode: 'mil',
        locationName: 'Milwaukee',
        shortName: 'Milwaukee',
        active: true
      },
      112: {
        id: 112,
        name: 'Chicago Cubs',
        teamName: 'Cubs',
        abbreviation: 'CHC',
        teamCode: 'chn',
        locationName: 'Chicago',
        shortName: 'Chi Cubs',
        active: true
      }
    };

    beforeEach(() => {
      // Mock API responses
      mockApiClient.getGames.mockResolvedValue(mockGames);
      
      // Setup team mock responses
      Object.keys(mockTeams).forEach(teamId => {
        mockApiClient.getTeam.mockImplementation(async (id) => {
          const team = mockTeams[id];
          if (!team) {
            throw new Error(`Team with ID ${id} not found`);
          }
          return team;
        });
      });
      
      // Mock Date.now() to return a fixed timestamp
      jest.spyOn(Date, 'now').mockImplementation(() => 1726723200000); // 2025-05-19T20:00:00Z
    });

    it('should convert date object to string format when needed', async () => {
      const dateObj = new Date('2025-05-19T12:00:00Z');
      await service.getGamesForDate(dateObj);
      
      expect(MockedMLBApiClient.formatDate).toHaveBeenCalledWith(dateObj);
      expect(mockApiClient.getGames).toHaveBeenCalled();
    });

    it('should fetch and transform games correctly', async () => {
      const results = await service.getGamesForDate('2025-05-19');
      
      // Verify API was called correctly
      expect(mockApiClient.getGames).toHaveBeenCalledWith('2025-05-19');
      
      // Should return 2 games (Final and Live, filtered out Preview and non-regular season)
      expect(results).toHaveLength(2);
      
      // Verify the first game (Final)
      const game1 = results[0];
      expect(game1.gameId).toBe(123456);
      expect(game1.homeTeam).toBe('DET');
      expect(game1.awayTeam).toBe('CWS');
      expect(game1.homeScore).toBe(5);
      expect(game1.awayScore).toBe(3);
      expect(game1.gameStatus).toBe('Final');
      
      // Unix timestamp should be correct
      const expectedGameDate = Math.floor(new Date('2025-05-19T18:10:00Z').getTime() / 1000);
      expect(game1.gameDate).toBe(expectedGameDate);
      
      // Final game should have gameEndTimestamp about 3 hours after start
      expect(game1.gameEndTimestamp).toBe(expectedGameDate + 10800);
      
      // Verify the second game (Live)
      const game2 = results[1];
      expect(game2.gameId).toBe(123457);
      expect(game2.homeTeam).toBe('BOS');
      expect(game2.awayTeam).toBe('NYY');
      expect(game2.gameStatus).toBe('InProgress');
      
      // Live game should have gameEndTimestamp as current time
      expect(game2.gameEndTimestamp).toBe(Math.floor(Date.now() / 1000));
    });

    it('should handle games with no scores', async () => {
      // Override the mock to include a game with no scores but final status
      const gamesWithoutScores = [
        {
          ...mockGames[0],
          teams: {
            away: {
              team: { id: 145, name: 'Chicago White Sox' },
              score: undefined
            },
            home: {
              team: { id: 116, name: 'Detroit Tigers' },
              score: undefined
            }
          }
        }
      ];
      mockApiClient.getGames.mockResolvedValueOnce(gamesWithoutScores);
      
      const results = await service.getGamesForDate('2025-05-19');
      
      // Should still return the game
      expect(results).toHaveLength(1);
      
      // Scores should default to 0
      expect(results[0].homeScore).toBe(0);
      expect(results[0].awayScore).toBe(0);
    });

    it('should cache team data to minimize API calls', async () => {
      // Call twice with same teams
      await service.getGamesForDate('2025-05-19');
      mockApiClient.getTeam.mockClear(); // Clear call history
      
      await service.getGamesForDate('2025-05-19');
      
      // Should not call getTeam again for already cached teams
      expect(mockApiClient.getTeam).not.toHaveBeenCalled();
    });
  });

  describe('getAllTeams', () => {
    const mockAllTeamsResponse: MLBTeam[] = [
      {
        id: 145,
        name: 'Chicago White Sox',
        teamName: 'White Sox',
        abbreviation: 'CWS',
        teamCode: 'cha',
        locationName: 'Chicago',
        shortName: 'Chi White Sox',
        active: true
      },
      {
        id: 116,
        name: 'Detroit Tigers',
        teamName: 'Tigers',
        abbreviation: 'DET',
        teamCode: 'det',
        locationName: 'Detroit',
        shortName: 'Detroit',
        active: true
      },
      {
        id: 119,
        name: 'Los Angeles Dodgers',
        teamName: 'Dodgers',
        abbreviation: 'LAD',
        teamCode: 'lan',
        locationName: 'Los Angeles',
        shortName: 'LA Dodgers',
        active: false // Inactive team should be filtered out
      }
    ];

    it('should fetch and transform all active teams', async () => {
      mockApiClient.getAllTeams.mockResolvedValueOnce(mockAllTeamsResponse);
      
      const results = await service.getAllTeams();
      
      // Should filter out inactive teams
      expect(results).toHaveLength(2);
      
      // Verify transformed data
      expect(results[0].teamId).toBe('CWS');
      expect(results[0].name).toBe('Chicago White Sox');
      expect(results[0].abbreviation).toBe('CWS');
      expect(results[0].mlbId).toBe(145);
      
      expect(results[1].teamId).toBe('DET');
    });
  });

  describe('getTeam', () => {
    const mockTeam: MLBTeam = {
      id: 145,
      name: 'Chicago White Sox',
      teamName: 'White Sox',
      abbreviation: 'CWS',
      teamCode: 'cha',
      locationName: 'Chicago',
      shortName: 'Chi White Sox',
      active: true
    };

    it('should fetch and transform team data', async () => {
      mockApiClient.getTeam.mockResolvedValueOnce(mockTeam);
      
      const result = await service.getTeam(145);
      
      expect(mockApiClient.getTeam).toHaveBeenCalledWith(145);
      expect(result.teamId).toBe('CWS');
      expect(result.name).toBe('Chicago White Sox');
      expect(result.abbreviation).toBe('CWS');
      expect(result.mlbId).toBe(145);
    });

    it('should cache team data after first fetch', async () => {
      mockApiClient.getTeam.mockResolvedValueOnce(mockTeam);
      
      // First call should hit the API
      await service.getTeam(145);
      
      // Clear the mock
      mockApiClient.getTeam.mockClear();
      
      // Second call should use cached data
      const cachedResult = await service.getTeam(145);
      
      expect(mockApiClient.getTeam).not.toHaveBeenCalled();
      expect(cachedResult.teamId).toBe('CWS');
    });
  });
});