// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IBaseballOracle {
    // Data structures
    struct Team {
        string name;
        string abbreviation;
        uint256 wins;
        uint256 losses;
        uint256 winPct; // Scaled 0-1000 (500 = .500)
        uint256 lastGameTimestamp;
        uint256 lastUpdateTimestamp;
        bool exists;
    }

    struct GameResult {
        uint256 gameId;
        string homeTeam;
        string awayTeam;
        uint256 homeScore;
        uint256 awayScore;
        uint256 gameDate;
        uint256 gameEndTimestamp;
        uint256 recordedTimestamp;
        string gameStatus;
        bool recorded;
    }

    // Events
    event TeamRegistered(string indexed teamId, string name, string abbreviation);
    event GameRecorded(
        uint256 indexed gameId,
        string indexed homeTeam,
        string indexed awayTeam,
        uint256 homeScore,
        uint256 awayScore,
        string gameStatus
    );
    event TeamUpdated(
        string indexed teamId,
        uint256 wins,
        uint256 losses,
        uint256 winPct
    );
    event SeasonStateChanged(bool isActive, uint256 timestamp);
    event BatchGameResultsProcessed(uint256 gamesProcessed);
    event ErrorLogged(string reason);

    // Core functions
    function registerTeam(
        string calldata teamId,
        string calldata name,
        string calldata abbreviation
    ) external;

    function recordGameResult(GameResult calldata result) external;
    function recordBatchGameResults(GameResult[] calldata results) external;
    
    function getTeam(string calldata teamId) external view returns (Team memory);
    function getTeamWinPct(string calldata teamId) external view returns (uint256);
    function getGameResult(uint256 gameId) external view returns (GameResult memory);
    
    function setSeasonActive(bool active) external;
    function isSeasonActive() external view returns (bool);
    
    // Administrative functions
    function correctGameResult(uint256 gameId, GameResult calldata result) external;
    function adjustTeamRecord(
        string calldata teamId,
        uint256 wins,
        uint256 losses
    ) external;
}