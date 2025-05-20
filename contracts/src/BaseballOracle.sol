// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBaseballOracle.sol";

contract BaseballOracle is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    IBaseballOracle
{
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State variables
    mapping(string => Team) private teams;
    mapping(uint256 => GameResult) private games;
    bool private seasonActive;
    
    // Season management
    uint256 public seasonStartTimestamp;
    uint256 public seasonEndTimestamp;
    
    // Registry
    string[] private teamIds;
    uint256[] private gameIds;

    // Storage gap for future upgrades
    uint256[42] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address defaultAdmin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
        
        seasonActive = false;
    }

    // Team Management
    function registerTeam(
        string calldata teamId,
        string calldata name,
        string calldata abbreviation
    ) external override onlyRole(ADMIN_ROLE) {
        require(bytes(teamId).length > 0, "Invalid team ID");
        require(!teams[teamId].exists, "Team already exists");
        
        teams[teamId] = Team({
            name: name,
            abbreviation: abbreviation,
            wins: 0,
            losses: 0,
            winPct: 500,
            lastGameTimestamp: 0,
            lastUpdateTimestamp: block.timestamp,
            exists: true
        });
        
        teamIds.push(teamId);
        
        emit TeamRegistered(teamId, name, abbreviation);
    }

    // Game Recording
    function recordGameResult(
        GameResult calldata result
    ) external override onlyRole(ORACLE_ROLE) whenNotPaused {
        _recordGameResult(result);
    }

    function recordBatchGameResults(
        GameResult[] calldata results
    ) external override onlyRole(ORACLE_ROLE) whenNotPaused {
        uint256 gamesProcessed = 0;
        
        for (uint256 i = 0; i < results.length; i++) {
            // Skip if game already recorded
            if (games[results[i].gameId].recorded) {
                emit ErrorLogged("Game already recorded");
                continue;
            }
            
            // Skip if teams don't exist
            if (!teams[results[i].homeTeam].exists) {
                emit ErrorLogged("Home team not registered");
                continue;
            }
            if (!teams[results[i].awayTeam].exists) {
                emit ErrorLogged("Away team not registered");
                continue;
            }
            
            // Record the game
            _recordGameResult(results[i]);
            gamesProcessed++;
        }
        
        emit BatchGameResultsProcessed(gamesProcessed);
    }

    function _recordGameResult(GameResult memory result) private {
        require(!games[result.gameId].recorded, "Game already recorded");
        require(teams[result.homeTeam].exists, "Home team not registered");
        require(teams[result.awayTeam].exists, "Away team not registered");
        
        // Store game result
        result.recordedTimestamp = block.timestamp;
        result.recorded = true;
        games[result.gameId] = result;
        gameIds.push(result.gameId);
        
        // Update team records if game is final
        if (_isGameFinal(result.gameStatus)) {
            _updateTeamRecords(result);
        }
        
        emit GameRecorded(
            result.gameId,
            result.homeTeam,
            result.awayTeam,
            result.homeScore,
            result.awayScore,
            result.gameStatus
        );
    }

    function _isGameFinal(string memory status) private pure returns (bool) {
        return keccak256(bytes(status)) == keccak256(bytes("Final"));
    }

    function _updateTeamRecords(GameResult memory result) private {
        Team storage homeTeam = teams[result.homeTeam];
        Team storage awayTeam = teams[result.awayTeam];
        
        // Update wins/losses
        if (result.homeScore > result.awayScore) {
            homeTeam.wins++;
            awayTeam.losses++;
        } else {
            awayTeam.wins++;
            homeTeam.losses++;
        }
        
        // Update win percentages
        homeTeam.winPct = _calculateWinPct(homeTeam.wins, homeTeam.losses);
        awayTeam.winPct = _calculateWinPct(awayTeam.wins, awayTeam.losses);
        
        // Update timestamps
        homeTeam.lastGameTimestamp = result.gameEndTimestamp;
        awayTeam.lastGameTimestamp = result.gameEndTimestamp;
        homeTeam.lastUpdateTimestamp = block.timestamp;
        awayTeam.lastUpdateTimestamp = block.timestamp;
        
        emit TeamUpdated(result.homeTeam, homeTeam.wins, homeTeam.losses, homeTeam.winPct);
        emit TeamUpdated(result.awayTeam, awayTeam.wins, awayTeam.losses, awayTeam.winPct);
    }

    function _calculateWinPct(uint256 wins, uint256 losses) private pure returns (uint256) {
        if (wins + losses == 0) return 500; // 50% for teams with no games played
        // Add 0.5 for rounding: (wins * 1000 + 0.5 * (wins + losses)) / (wins + losses)
        return ((wins * 1000) + ((wins + losses) / 2)) / (wins + losses);
    }

    // View Functions
    function getTeam(string calldata teamId) external view override returns (Team memory) {
        require(teams[teamId].exists, "Team does not exist");
        return teams[teamId];
    }

    function getTeamWinPct(string calldata teamId) external view override returns (uint256) {
        require(teams[teamId].exists, "Team does not exist");
        return teams[teamId].winPct;
    }

    function getGameResult(uint256 gameId) external view override returns (GameResult memory) {
        require(games[gameId].recorded, "Game not recorded");
        return games[gameId];
    }

    // Season Management
    function setSeasonActive(bool active) external override onlyRole(ADMIN_ROLE) {
        seasonActive = active;
        
        if (active) {
            seasonStartTimestamp = block.timestamp;
            
            // Reset all team records
            for (uint256 i = 0; i < teamIds.length; i++) {
                Team storage team = teams[teamIds[i]];
                team.wins = 0;
                team.losses = 0;
                team.winPct = 500;
                team.lastGameTimestamp = 0;
                team.lastUpdateTimestamp = block.timestamp;
            }
        } else {
            seasonEndTimestamp = block.timestamp;
        }
        
        emit SeasonStateChanged(active, block.timestamp);
    }

    function isSeasonActive() external view override returns (bool) {
        return seasonActive;
    }

    // Administrative Functions
    function correctGameResult(
        uint256 gameId,
        GameResult calldata result
    ) external override onlyRole(ADMIN_ROLE) {
        require(games[gameId].recorded, "Game not recorded");
        
        // Revert the old result if it was final
        GameResult memory oldResult = games[gameId];
        if (_isGameFinal(oldResult.gameStatus)) {
            _revertTeamRecords(oldResult);
        }
        
        // Apply the new result
        games[gameId] = result;
        games[gameId].recorded = true;
        games[gameId].recordedTimestamp = block.timestamp;
        
        if (_isGameFinal(result.gameStatus)) {
            _updateTeamRecords(result);
        }
        
        emit GameRecorded(
            result.gameId,
            result.homeTeam,
            result.awayTeam,
            result.homeScore,
            result.awayScore,
            result.gameStatus
        );
    }

    function _revertTeamRecords(GameResult memory result) private {
        Team storage homeTeam = teams[result.homeTeam];
        Team storage awayTeam = teams[result.awayTeam];
        
        // Revert wins/losses
        if (result.homeScore > result.awayScore) {
            homeTeam.wins--;
            awayTeam.losses--;
        } else {
            awayTeam.wins--;
            homeTeam.losses--;
        }
        
        // Recalculate win percentages
        homeTeam.winPct = _calculateWinPct(homeTeam.wins, homeTeam.losses);
        awayTeam.winPct = _calculateWinPct(awayTeam.wins, awayTeam.losses);
    }

    function adjustTeamRecord(
        string calldata teamId,
        uint256 wins,
        uint256 losses
    ) external override onlyRole(ADMIN_ROLE) {
        require(teams[teamId].exists, "Team does not exist");
        
        Team storage team = teams[teamId];
        team.wins = wins;
        team.losses = losses;
        team.winPct = _calculateWinPct(wins, losses);
        team.lastUpdateTimestamp = block.timestamp;
        
        emit TeamUpdated(teamId, wins, losses, team.winPct);
    }

    // Pausable
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // UUPS upgrade authorization
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    // Helper functions for enumeration
    function getTeamCount() external view returns (uint256) {
        return teamIds.length;
    }

    function getTeamIdAtIndex(uint256 index) external view returns (string memory) {
        require(index < teamIds.length, "Index out of bounds");
        return teamIds[index];
    }

    function getGameCount() external view returns (uint256) {
        return gameIds.length;
    }

    function getGameIdAtIndex(uint256 index) external view returns (uint256) {
        require(index < gameIds.length, "Index out of bounds");
        return gameIds[index];
    }
}