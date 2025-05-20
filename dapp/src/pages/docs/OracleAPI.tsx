import { useEffect } from 'react'

export default function OracleAPI() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <article className="prose prose-lg max-w-none">
      <h1>Baseball Oracle API Reference</h1>
      
      <p>
        This document provides detailed technical information for interacting with the Baseball Oracle smart contract. 
        It covers all data structures, functions, events, and integration patterns that developers need to build 
        applications using Oracle data.
      </p>

      <nav className="not-prose bg-gray-50 p-4 rounded-lg mb-8">
        <h2 className="text-lg font-semibold mb-2">Table of Contents</h2>
        <ul className="space-y-1 text-sm">
          <li><a href="#overview" className="text-blue-600 hover:underline">1. Overview</a></li>
          <li><a href="#data-structures" className="text-blue-600 hover:underline">2. Data Structures</a></li>
          <li><a href="#read-functions" className="text-blue-600 hover:underline">3. Read Functions</a></li>
          <li><a href="#write-functions" className="text-blue-600 hover:underline">4. Write Functions</a></li>
          <li><a href="#events" className="text-blue-600 hover:underline">5. Events</a></li>
          <li><a href="#integration-patterns" className="text-blue-600 hover:underline">6. Integration Patterns</a></li>
          <li><a href="#code-examples" className="text-blue-600 hover:underline">7. Code Examples</a></li>
          <li><a href="#error-handling" className="text-blue-600 hover:underline">8. Error Handling</a></li>
        </ul>
      </nav>
      
      <h2 id="overview">1. Overview</h2>
      
      <p>
        The Baseball Oracle contract (<code>BaseballOracle.sol</code>) provides authoritative baseball game results 
        and team statistics on-chain. It follows an upgradeable proxy pattern and uses role-based access control 
        for different operations.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
        <p className="font-semibold">Contract Address</p>
        <p>The contract is deployed as an upgradeable proxy. Always use the proxy address, not the implementation address, for interactions.</p>
      </div>

      <h3>Key Features</h3>
      <ul>
        <li><strong>Team Management</strong>: Register teams and track their performance</li>
        <li><strong>Game Recording</strong>: Store official game results with timestamps</li>
        <li><strong>Win Percentage Calculation</strong>: Automatically calculate team win percentages</li>
        <li><strong>Season Management</strong>: Handle season transitions and record resets</li>
        <li><strong>Administrative Controls</strong>: Error correction and emergency functions</li>
      </ul>

      <h2 id="data-structures">2. Data Structures</h2>

      <h3>Team Struct</h3>
      <p>Represents a baseball team and its current season performance:</p>
      
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`struct Team {
    string name;                    // Full team name (e.g., "Los Angeles Dodgers")
    string abbreviation;            // 3-letter team code (e.g., "LAD")
    uint256 wins;                   // Number of wins this season
    uint256 losses;                 // Number of losses this season
    uint256 winPct;                 // Win percentage (0-1000, where 500 = .500)
    uint256 lastGameTimestamp;      // Timestamp of team's most recent game
    uint256 lastUpdateTimestamp;    // When this team record was last updated
    bool exists;                    // Whether this team is registered
}`}</code></pre>

      <h4>Win Percentage Calculation</h4>
      <p>
        The <code>winPct</code> field uses a scaled representation where:
      </p>
      <ul>
        <li><code>0</code> = 0% win rate (0.000)</li>
        <li><code>500</code> = 50% win rate (0.500) - default for teams with no games</li>
        <li><code>1000</code> = 100% win rate (1.000)</li>
      </ul>
      <p>
        This avoids floating-point arithmetic while maintaining precision. To convert to a decimal:
        <code className="block bg-gray-800 text-gray-100 p-2 mt-2 rounded">decimal_percentage = winPct / 1000</code>
      </p>

      <h3>GameResult Struct</h3>
      <p>Represents the result of a completed baseball game:</p>
      
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`struct GameResult {
    uint256 gameId;                 // Unique identifier for this game
    string homeTeam;                // Home team identifier (team ID)
    string awayTeam;                // Away team identifier (team ID) 
    uint256 homeScore;              // Final score for home team
    uint256 awayScore;              // Final score for away team
    uint256 gameDate;               // Date when game was played (timestamp)
    uint256 gameEndTimestamp;       // When the game actually ended
    uint256 recordedTimestamp;      // When result was recorded on-chain
    string gameStatus;              // Status string (e.g., "Final", "Postponed")
    bool recorded;                  // Whether this result has been recorded
}`}</code></pre>

      <h4>Game Status Values</h4>
      <p>The <code>gameStatus</code> field can contain various values:</p>
      <ul>
        <li><code>"Final"</code> - Game completed normally (triggers team record updates)</li>
        <li><code>"Postponed"</code> - Game postponed (no team record changes)</li>
        <li><code>"Suspended"</code> - Game suspended (no team record changes)</li>
        <li><code>"Cancelled"</code> - Game cancelled (no team record changes)</li>
      </ul>
      <p>Only games with status <code>"Final"</code> will automatically update team win/loss records.</p>

      <h2 id="read-functions">3. Read Functions</h2>
      
      <p>These functions allow you to query Oracle data without making transactions:</p>

      <h3>getTeam(string teamId)</h3>
      <p><strong>Purpose</strong>: Retrieve complete information about a specific team.</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function getTeam(string calldata teamId) external view returns (Team memory)`}</code></pre>
      
      <h4>Parameters</h4>
      <ul>
        <li><code>teamId</code> - String identifier for the team (e.g., "LAD", "NYY")</li>
      </ul>
      
      <h4>Returns</h4>
      <p>Complete <code>Team</code> struct with all team information.</p>
      
      <h4>Reverts</h4>
      <ul>
        <li>If team with given <code>teamId</code> does not exist</li>
      </ul>

      <h3>getTeamWinPct(string teamId)</h3>
      <p><strong>Purpose</strong>: Get just the win percentage for a team (gas-efficient for frequent queries).</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function getTeamWinPct(string calldata teamId) external view returns (uint256)`}</code></pre>
      
      <h4>Parameters</h4>
      <ul>
        <li><code>teamId</code> - String identifier for the team</li>
      </ul>
      
      <h4>Returns</h4>
      <p>Win percentage as uint256 (0-1000 scale)</p>
      
      <h4>Use Case</h4>
      <p>Ideal for DeFi contracts that need frequent win percentage updates for pricing or settlement.</p>

      <h3>getGameResult(uint256 gameId)</h3>
      <p><strong>Purpose</strong>: Retrieve details about a specific game result.</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function getGameResult(uint256 gameId) external view returns (GameResult memory)`}</code></pre>
      
      <h4>Parameters</h4>
      <ul>
        <li><code>gameId</code> - Unique identifier for the game</li>
      </ul>
      
      <h4>Returns</h4>
      <p>Complete <code>GameResult</code> struct with game information.</p>

      <h3>isSeasonActive()</h3>
      <p><strong>Purpose</strong>: Check if the current season is active (affects certain behaviors).</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function isSeasonActive() external view returns (bool)`}</code></pre>
      
      <h4>Returns</h4>
      <p><code>true</code> if season is active, <code>false</code> otherwise</p>
      
      <h4>Use Case</h4>
      <p>Applications may want to show different UI or disable certain features during off-season.</p>

      <h3>Helper Functions for Enumeration</h3>
      
      <h4>getTeamCount()</h4>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function getTeamCount() external view returns (uint256)`}</code></pre>
      <p>Returns the total number of registered teams.</p>

      <h4>getTeamIdAtIndex(uint256 index)</h4>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function getTeamIdAtIndex(uint256 index) external view returns (string memory)`}</code></pre>
      <p>Returns the team ID at the specified index. Use with <code>getTeamCount()</code> to iterate through all teams.</p>

      <h4>getGameCount() and getGameIdAtIndex(uint256 index)</h4>
      <p>Similar functions for enumerating all recorded games.</p>

      <h2 id="write-functions">4. Write Functions</h2>
      
      <p>These functions modify contract state and require appropriate permissions:</p>

      <h3>Oracle Functions (ORACLE_ROLE required)</h3>
      
      <h4>recordGameResult(GameResult result)</h4>
      <p><strong>Purpose</strong>: Record a single game result.</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function recordGameResult(GameResult calldata result) external`}</code></pre>
      
      <p><strong>Access</strong>: Requires <code>ORACLE_ROLE</code></p>
      <p><strong>Pausable</strong>: Cannot be called when contract is paused</p>
      
      <h4>Use Case</h4>
      <p>Primary function for the automated sync service to submit game results.</p>

      <h4>recordBatchGameResults(GameResult[] results)</h4>
      <p><strong>Purpose</strong>: Record multiple game results in a single transaction (gas-efficient).</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function recordBatchGameResults(GameResult[] calldata results) external`}</code></pre>
      
      <p><strong>Behavior</strong>: Processes all valid results, skips invalid ones, emits error events for skipped games.</p>

      <h3>Administrative Functions (ADMIN_ROLE required)</h3>

      <h4>registerTeam(string teamId, string name, string abbreviation)</h4>
      <p><strong>Purpose</strong>: Register a new team in the Oracle.</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`function registerTeam(
    string calldata teamId,
    string calldata name, 
    string calldata abbreviation
) external`}</code></pre>

      <h4>setSeasonActive(bool active)</h4>
      <p><strong>Purpose</strong>: Start or end a season.</p>
      <p><strong>Behavior</strong>: When starting a season (<code>active = true</code>), resets all team records to 0-0.</p>

      <h4>correctGameResult(uint256 gameId, GameResult result)</h4>
      <p><strong>Purpose</strong>: Correct a previously recorded game result.</p>
      <p><strong>Behavior</strong>: Automatically reverts the old result's impact on team records and applies the new result.</p>

      <h4>adjustTeamRecord(string teamId, uint256 wins, uint256 losses)</h4>
      <p><strong>Purpose</strong>: Manually adjust a team's win/loss record.</p>
      <p><strong>Use Case</strong>: Handle edge cases or corrections that can't be resolved through game result corrections.</p>

      <h2 id="events">5. Events</h2>
      
      <p>The Oracle emits events for all significant state changes:</p>

      <h3>TeamRegistered</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`event TeamRegistered(string indexed teamId, string name, string abbreviation)`}</code></pre>
      <p>Emitted when a new team is registered.</p>

      <h3>GameRecorded</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`event GameRecorded(
    uint256 indexed gameId,
    string indexed homeTeam,
    string indexed awayTeam,
    uint256 homeScore,
    uint256 awayScore,
    string gameStatus
)`}</code></pre>
      <p>Emitted when a game result is recorded (including corrections).</p>

      <h3>TeamUpdated</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`event TeamUpdated(
    string indexed teamId,
    uint256 wins,
    uint256 losses,
    uint256 winPct
)`}</code></pre>
      <p>Emitted when a team's record is updated (due to game results or manual adjustments).</p>

      <h3>SeasonStateChanged</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`event SeasonStateChanged(bool isActive, uint256 timestamp)`}</code></pre>
      <p>Emitted when season state transitions.</p>

      <h2 id="integration-patterns">6. Integration Patterns</h2>

      <h3>DeFi Protocol Integration</h3>
      
      <p>For protocols using Oracle data for pricing or settlement:</p>
      
      <ol>
        <li><strong>Frequent Queries</strong>: Use <code>getTeamWinPct()</code> for gas efficiency</li>
        <li><strong>Event Monitoring</strong>: Listen to <code>TeamUpdated</code> events for real-time updates</li>
        <li><strong>Data Freshness</strong>: Check <code>lastUpdateTimestamp</code> to ensure data recency</li>
        <li><strong>Error Handling</strong>: Always handle cases where teams don't exist</li>
      </ol>

      <h3>Frontend Application Integration</h3>
      
      <p>For user-facing applications:</p>
      
      <ol>
        <li><strong>Team Listing</strong>: Use enumeration functions to list all teams</li>
        <li><strong>Live Updates</strong>: Subscribe to events for real-time UI updates</li>
        <li><strong>Game History</strong>: Query <code>GameRecorded</code> events for historical data</li>
        <li><strong>Status Indicators</strong>: Show season status and last update times</li>
      </ol>

      <h2 id="code-examples">7. Code Examples</h2>

      <h3>Reading Team Data (Solidity)</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`// Get team win percentage for pricing
contract MyDeFiContract {
    IBaseballOracle public oracle;
    
    function getTeamPrice(string memory teamId) public view returns (uint256) {
        uint256 winPct = oracle.getTeamWinPct(teamId);
        // Convert to price (example: base price + win bonus)
        return 1000 + (winPct * 2); // Simple pricing model
    }
    
    function getFullTeamData(string memory teamId) public view returns (
        string memory name,
        uint256 wins,
        uint256 losses,
        uint256 winPct
    ) {
        IBaseballOracle.Team memory team = oracle.getTeam(teamId);
        return (team.name, team.wins, team.losses, team.winPct);
    }
}`}</code></pre>

      <h3>Event Monitoring (JavaScript/ethers.js)</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`// Monitor team updates for UI refresh
const oracle = new ethers.Contract(oracleAddress, oracleABI, provider);

// Listen for team updates
oracle.on("TeamUpdated", (teamId, wins, losses, winPct, event) => {
    console.log(\`Team \${teamId} updated: \${wins}-\${losses} (.{winPct/10})\`);
    // Update UI with new team data
    updateTeamDisplay(teamId, { wins, losses, winPct });
});

// Listen for new games
oracle.on("GameRecorded", (gameId, homeTeam, awayTeam, homeScore, awayScore, status) => {
    console.log(\`Game \${gameId}: \${awayTeam} @ \${homeTeam} - \${awayScore}-\${homeScore} (\${status})\`);
    // Update game history display
    addGameToHistory({ gameId, homeTeam, awayTeam, homeScore, awayScore });
});`}</code></pre>

      <h3>Batch Team Query (JavaScript)</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`// Efficiently load all team data
async function getAllTeams() {
    const teamCount = await oracle.getTeamCount();
    const teams = [];
    
    // Get all team IDs first (batch if possible)
    const teamIds = await Promise.all(
        Array.from({ length: teamCount }, (_, i) => oracle.getTeamIdAtIndex(i))
    );
    
    // Get full team data
    const teamData = await Promise.all(
        teamIds.map(teamId => oracle.getTeam(teamId))
    );
    
    return teamIds.map((teamId, index) => ({
        id: teamId,
        ...teamData[index]
    }));
}`}</code></pre>

      <h2 id="error-handling">8. Error Handling</h2>

      <h3>Common Errors and Solutions</h3>
      
      <h4>"Team does not exist"</h4>
      <p><strong>Cause</strong>: Querying data for an unregistered team</p>
      <p><strong>Solution</strong>: Always check if team exists before querying, or wrap calls in try/catch</p>

      <h4>"Game not recorded"</h4>
      <p><strong>Cause</strong>: Querying a game that hasn't been submitted to the Oracle</p>
      <p><strong>Solution</strong>: Check if game exists before querying detailed results</p>

      <h4>"Game already recorded"</h4>
      <p><strong>Cause</strong>: Attempting to record a game that's already in the Oracle</p>
      <p><strong>Solution</strong>: Check game existence before recording, or use batch function which skips duplicates</p>

      <h3>Defensive Programming Pattern</h3>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`// Safe team data access
function safeGetTeamWinPct(string memory teamId) public view returns (uint256, bool) {
    try oracle.getTeamWinPct(teamId) returns (uint256 winPct) {
        return (winPct, true);
    } catch {
        return (500, false); // Return default 50% if team not found
    }
}`}</code></pre>

      <h3>Event Error Monitoring</h3>
      <p>Monitor <code>ErrorLogged</code> events to detect Oracle issues:</p>
      <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto"><code>{`oracle.on("ErrorLogged", (reason, event) => {
    console.warn("Oracle error:", reason);
    // Implement alerting or fallback logic
});`}</code></pre>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
        <h4 className="font-semibold">Important Notes</h4>
        <ul className="mt-2 space-y-1">
          <li>Always use the proxy contract address, not the implementation address</li>
          <li>The Oracle can be paused by administrators during emergencies</li>
          <li>Win percentages start at 500 (50%) for teams with no games played</li>
          <li>Only "Final" games automatically update team records</li>
          <li>Game corrections automatically revert and reapply team record changes</li>
        </ul>
      </div>

      <h2>Related Documentation</h2>
      <ul>
        <li><a href="/docs/oracle-design" className="text-blue-600 hover:underline">Oracle System Design</a> - High-level architecture and design principles</li>
        <li><a href="/docs/technical-guide" className="text-blue-600 hover:underline">Technical Guide</a> - Complete protocol technical overview</li>
      </ul>
    </article>
  )
}