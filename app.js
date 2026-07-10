const API_BASE = 'https://statsapi.mlb.com/api/v1';
let mlbTeams = {}; 
// Load betting pool from browser storage so data persists across refreshes
let poolData = JSON.parse(localStorage.getItem('mlbPoolData')) || {}; 

// DOM Elements
const teamSelect = document.getElementById('team-select');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const gamesContainer = document.getElementById('games-container');
const leaderboardBody = document.querySelector('#leaderboard-table tbody');

document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates to the current week (Monday - Sunday)
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(today.setDate(diff + 6));
    
    startDateInput.value = monday.toISOString().split('T')[0];
    endDateInput.value = sunday.toISOString().split('T')[0];

    await loadTeams();
    fetchSchedule();
});

// Fetch MLB Teams for the Dropdown
async function loadTeams() {
    try {
        const res = await fetch(`${API_BASE}/teams?sportId=1`);
        const data = await res.json();
        const teams = data.teams.sort((a, b) => a.name.localeCompare(b.name));
        
        teamSelect.innerHTML = '<option value="">Select a Team...</option>';
        teams.forEach(team => {
            mlbTeams[team.id] = team.name;
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            teamSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Error loading teams:', e);
    }
}

// Fetch Games for Selected Dates
document.getElementById('fetch-data-btn').addEventListener('click', fetchSchedule);

async function fetchSchedule() {
    const start = startDateInput.value;
    const end = endDateInput.value;
    
    if(!start || !end) return alert('Please select a date range.');

    try {
        const res = await fetch(`${API_BASE}/schedule?sportId=1&startDate=${start}&endDate=${end}`);
        const data = await res.json();
        
        renderGamesAndCalculate(data.dates || []);
    } catch (e) {
        console.error('Error fetching schedule:', e);
        gamesContainer.innerHTML = '<p>Error loading games. Please try again.</p>';
    }
}

function renderGamesAndCalculate(dates) {
    gamesContainer.innerHTML = '';
    const teamWins = {}; // Tracks wins specifically for the selected date range

    if (dates.length === 0) {
        gamesContainer.innerHTML = '<p>No games found for this date range.</p>';
        updateLeaderboard(teamWins);
        return;
    }

    dates.forEach(dateObj => {
        dateObj.games.forEach(game => {
            const away = game.teams.away;
            const home = game.teams.home;
            const isFinal = game.status.statusCode === 'F' || game.status.statusCode === 'FT';
            
            // Calculate Wins for the Pool (only counts if game is Final)
            if (isFinal) {
                if (away.isWinner) teamWins[away.team.id] = (teamWins[away.team.id] || 0) + 1;
                if (home.isWinner) teamWins[home.team.id] = (teamWins[home.team.id] || 0) + 1;
            }

            // Render the Game Card
            const card = document.createElement('div');
            card.className = `game-card ${isFinal ? 'final' : 'live'}`;
            card.innerHTML = `
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                    ${dateObj.date} - ${game.status.detailedState}
                </div>
                <div><strong>${away.team.name}</strong>: ${away.score ?? '-'}</div>
                <div><strong>${home.team.name}</strong>: ${home.score ?? '-'}</div>
            `;
            gamesContainer.appendChild(card);
        });
    });

    updateLeaderboard(teamWins);
}

// --- POOL MANAGEMENT LOGIC ---

// Add a User & Team
document.getElementById('add-user-btn').addEventListener('click', () => {
    const name = document.getElementById('new-user-name').value.trim();
    const teamId = parseInt(teamSelect.value);

    if (!name || !teamId) return alert('Please enter a player name and select a team.');

    if (!poolData[name]) poolData[name] = [];
    if (!poolData[name].includes(teamId)) {
        poolData[name].push(teamId);
        localStorage.setItem('mlbPoolData', JSON.stringify(poolData));
        fetchSchedule(); // Refresh leaderboard with new assignments
        
        document.getElementById('new-user-name').value = '';
        teamSelect.value = '';
    } else {
        alert('This player already has this team assigned!');
    }
});

// Clear the entire pool
document.getElementById('clear-pool-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all players and assigned teams?')) {
        poolData = {};
        localStorage.removeItem('mlbPoolData');
        updateLeaderboard({});
    }
});

// Render the Leaderboard based on current timeframe
function updateLeaderboard(teamWins) {
    leaderboardBody.innerHTML = '';
    
    // Tally up points (1 win = 1 point)
    const leaderboard = Object.keys(poolData).map(player => {
        let points = 0;
        const teamNames = poolData[player].map(id => {
            const wins = teamWins[id] || 0;
            points += wins;
            return `${mlbTeams[id] || 'Unknown'} (${wins}W)`;
        });
        
        return { player, teams: teamNames.join(', '), points };
    });

    // Sort leaderboard by most points
    leaderboard.sort((a, b) => b.points - a.points);

    if (leaderboard.length === 0) {
        leaderboardBody.innerHTML = '<tr><td colspan="3">No players in the pool yet. Add some above!</td></tr>';
        return;
    }

    leaderboard.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.player}</strong></td>
            <td>${row.teams}</td>
            <td><strong>${row.points}</strong></td>
        `;
        leaderboardBody.appendChild(tr);
    });
}
