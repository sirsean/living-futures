// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../interfaces/IBaseballOracle.sol";

contract MockBaseballOracle is IBaseballOracle {
    mapping(string => Team) private teams;
    mapping(uint256 => GameResult) private gameResults;
    bool private seasonActive = true;
    
    constructor() {
        // Initialize some test teams
        _initializeTeam("NYY", "New York Yankees", "NYY");
        _initializeTeam("BOS", "Boston Red Sox", "BOS");
        _initializeTeam("LAD", "Los Angeles Dodgers", "LAD");
    }
    
    function _initializeTeam(string memory teamId, string memory name, string memory abbreviation) internal {
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
    }

    // Required interface implementations
    function registerTeam(
        string calldata teamId,
        string calldata name,
        string calldata abbreviation
    ) external override {
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
    }

    function recordGameResult(GameResult calldata result) external override {
        gameResults[result.gameId] = result;
    }

    function recordBatchGameResults(GameResult[] calldata results) external override {
        for (uint i = 0; i < results.length; i++) {
            gameResults[results[i].gameId] = results[i];
        }
    }

    function getTeam(string calldata teamId) external view override returns (Team memory) {
        return teams[teamId];
    }

    function getTeamWinPct(string calldata teamId) external view override returns (uint256) {
        return teams[teamId].exists ? teams[teamId].winPct : 500;
    }

    function getGameResult(uint256 gameId) external view override returns (GameResult memory) {
        return gameResults[gameId];
    }

    function setSeasonActive(bool active) external override {
        seasonActive = active;
    }

    function isSeasonActive() external view override returns (bool) {
        return seasonActive;
    }

    function correctGameResult(uint256 gameId, GameResult calldata result) external override {
        gameResults[gameId] = result;
    }

    function adjustTeamRecord(
        string calldata teamId,
        uint256 wins,
        uint256 losses
    ) external override {
        Team storage team = teams[teamId];
        team.wins = wins;
        team.losses = losses;
        uint256 totalGames = wins + losses;
        if (totalGames > 0) {
            team.winPct = (wins * 1000) / totalGames;
        } else {
            team.winPct = 500;
        }
        team.lastUpdateTimestamp = block.timestamp;
    }

    // Mock helper functions for testing
    function updateTeamWinPct(string calldata teamId, uint256 winPct) external {
        require(winPct <= 1000, "Invalid percentage");
        teams[teamId].winPct = winPct;
        teams[teamId].lastUpdateTimestamp = block.timestamp;
    }
}