/**
 * Local Picks Manager v2.2
 * Stores picks in localStorage, auto-fetches game data from ESPN
 * Full formatting matching dashboard template
 * v2.1: Added team records, improved money display
 * v2.2: Auto re-enrich existing picks on page load to add missing records
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'gbsv_picks';
    const UNIT_MULTIPLIER_KEY = 'gbsv_unit_multiplier';

    // ========== STORAGE FUNCTIONS ==========

    function getAllPicks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading picks from localStorage:', e);
            return [];
        }
    }

    function savePicks(picks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
            console.log(`✅ Saved ${picks.length} picks to localStorage`);
            return true;
        } catch (e) {
            console.error('Error saving picks to localStorage:', e);
            return false;
        }
    }

    function addPicks(newPicks) {
        const existing = getAllPicks();
        const enrichedPicks = newPicks.map((pick, idx) => ({
            ...pick,
            id: pick.id || `pick_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`,
            createdAt: pick.createdAt || new Date().toISOString(),
            status: pick.status || 'pending'
        }));
        const all = [...existing, ...enrichedPicks];
        savePicks(all);
        return enrichedPicks;
    }

    function clearPicks() {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️ Cleared all picks from localStorage');
        refreshPicksTable();
    }

    function deletePick(pickId) {
        const picks = getAllPicks().filter(p => p.id !== pickId);
        savePicks(picks);
        refreshPicksTable();
    }

    function updatePickStatus(pickId, newStatus) {
        const picks = getAllPicks().map(p => {
            if (p.id === pickId) {
                return { ...p, status: newStatus, updatedAt: new Date().toISOString() };
            }
            return p;
        });
        savePicks(picks);
        refreshPicksTable();
    }

    function getUnitMultiplier() {
        return parseInt(localStorage.getItem(UNIT_MULTIPLIER_KEY)) || 1000;
    }

    function setUnitMultiplier(multiplier) {
        localStorage.setItem(UNIT_MULTIPLIER_KEY, multiplier.toString());
        if (window.PickStandardizer) {
            window.PickStandardizer.setUnitMultiplier(multiplier);
        }
    }

    // ========== TEAM DATA ==========

    const TEAM_DATA = {
        // NBA Teams
        'san antonio spurs': { abbr: 'SAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png' },
        'spurs': { abbr: 'SAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png' },
        'new york knicks': { abbr: 'NYK', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png' },
        'knicks': { abbr: 'NYK', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png' },
        'los angeles lakers': { abbr: 'LAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
        'lakers': { abbr: 'LAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
        'golden state warriors': { abbr: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' },
        'warriors': { abbr: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' },
        'boston celtics': { abbr: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
        'celtics': { abbr: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
        'miami heat': { abbr: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' },
        'heat': { abbr: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' },
        'dallas mavericks': { abbr: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
        'mavericks': { abbr: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
        'mavs': { abbr: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
        'denver nuggets': { abbr: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
        'nuggets': { abbr: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
        'phoenix suns': { abbr: 'PHX', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png' },
        'suns': { abbr: 'PHX', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png' },
        'milwaukee bucks': { abbr: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' },
        'bucks': { abbr: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' },
        'philadelphia 76ers': { abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
        '76ers': { abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
        'sixers': { abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
        'brooklyn nets': { abbr: 'BKN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' },
        'nets': { abbr: 'BKN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' },
        'chicago bulls': { abbr: 'CHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png' },
        'bulls': { abbr: 'CHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png' },
        'cleveland cavaliers': { abbr: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
        'cavaliers': { abbr: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
        'cavs': { abbr: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
        'atlanta hawks': { abbr: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png' },
        'hawks': { abbr: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png' },
        'toronto raptors': { abbr: 'TOR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png' },
        'raptors': { abbr: 'TOR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png' },
        'orlando magic': { abbr: 'ORL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png' },
        'magic': { abbr: 'ORL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png' },
        'indiana pacers': { abbr: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png' },
        'pacers': { abbr: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png' },
        'detroit pistons': { abbr: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png' },
        'pistons': { abbr: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png' },
        'charlotte hornets': { abbr: 'CHA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png' },
        'hornets': { abbr: 'CHA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png' },
        'washington wizards': { abbr: 'WAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png' },
        'wizards': { abbr: 'WAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png' },
        'memphis grizzlies': { abbr: 'MEM', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png' },
        'grizzlies': { abbr: 'MEM', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png' },
        'new orleans pelicans': { abbr: 'NOP', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png' },
        'pelicans': { abbr: 'NOP', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png' },
        'houston rockets': { abbr: 'HOU', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png' },
        'rockets': { abbr: 'HOU', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png' },
        'minnesota timberwolves': { abbr: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
        'timberwolves': { abbr: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
        'wolves': { abbr: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
        'oklahoma city thunder': { abbr: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
        'thunder': { abbr: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
        'portland trail blazers': { abbr: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
        'trail blazers': { abbr: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
        'blazers': { abbr: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
        'utah jazz': { abbr: 'UTA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png' },
        'jazz': { abbr: 'UTA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png' },
        'sacramento kings': { abbr: 'SAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png' },
        'kings': { abbr: 'SAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png' },
        'la clippers': { abbr: 'LAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png' },
        'clippers': { abbr: 'LAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png' },
        
        // NCAAB Teams (from today's picks) - Full names and abbreviations
        'butler': { abbr: 'BUT', fullName: 'Butler Bulldogs', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2086.png' },
        'butler bulldogs': { abbr: 'BUT', fullName: 'Butler Bulldogs', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2086.png' },
        'connecticut': { abbr: 'CONN', fullName: 'UConn Huskies', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png' },
        'u conn': { abbr: 'CONN', fullName: 'UConn Huskies', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png' },
        'uconn': { abbr: 'CONN', fullName: 'UConn Huskies', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png' },
        'uconn huskies': { abbr: 'CONN', fullName: 'UConn Huskies', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png' },
        'abilene christian': { abbr: 'ACU', fullName: 'Abilene Christian Wildcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png' },
        'abilene christian wildcats': { abbr: 'ACU', fullName: 'Abilene Christian Wildcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png' },
        'arizona': { abbr: 'ARIZ', fullName: 'Arizona Wildcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png' },
        'arizona wildcats': { abbr: 'ARIZ', fullName: 'Arizona Wildcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png' },
        'montana st': { abbr: 'MTST', fullName: 'Montana State Bobcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png' },
        'montana state': { abbr: 'MTST', fullName: 'Montana State Bobcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png' },
        'montana state bobcats': { abbr: 'MTST', fullName: 'Montana State Bobcats', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png' },
        'cal poly slo': { abbr: 'CPSU', fullName: 'Cal Poly Mustangs', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png' },
        'cal poly': { abbr: 'CPSU', fullName: 'Cal Poly Mustangs', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png' },
        'cal poly mustangs': { abbr: 'CPSU', fullName: 'Cal Poly Mustangs', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png' },
        'oral roberts': { abbr: 'ORU', fullName: 'Oral Roberts Golden Eagles', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/198.png' },
        'oral roberts golden eagles': { abbr: 'ORU', fullName: 'Oral Roberts Golden Eagles', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/198.png' },
        'missouri st': { abbr: 'MOST', fullName: 'Missouri State Bears', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png' },
        'missouri state': { abbr: 'MOST', fullName: 'Missouri State Bears', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png' },
        'missouri state bears': { abbr: 'MOST', fullName: 'Missouri State Bears', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png' },
        'marist': { abbr: 'MAR', fullName: 'Marist Red Foxes', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png' },
        'marist red foxes': { abbr: 'MAR', fullName: 'Marist Red Foxes', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png' },
        'georgia tech': { abbr: 'GT', fullName: 'Georgia Tech Yellow Jackets', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png' },
        'georgia tech yellow jackets': { abbr: 'GT', fullName: 'Georgia Tech Yellow Jackets', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png' },
        'east tenn st': { abbr: 'ETSU', fullName: 'East Tennessee State Buccaneers', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png' },
        'east tennessee st': { abbr: 'ETSU', fullName: 'East Tennessee State Buccaneers', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png' },
        'east tennessee state': { abbr: 'ETSU', fullName: 'East Tennessee State Buccaneers', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png' },
        'east tennessee state buccaneers': { abbr: 'ETSU', fullName: 'East Tennessee State Buccaneers', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png' },
        'etsu buccaneers': { abbr: 'ETSU', fullName: 'East Tennessee State Buccaneers', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png' },
        'north carolina': { abbr: 'UNC', fullName: 'North Carolina Tar Heels', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' },
        'unc': { abbr: 'UNC', fullName: 'North Carolina Tar Heels', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' },
        'north carolina tar heels': { abbr: 'UNC', fullName: 'North Carolina Tar Heels', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' },
        'tar heels': { abbr: 'UNC', fullName: 'North Carolina Tar Heels', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' }
    };

    function getTeamInfo(teamName) {
        if (!teamName) return { abbr: 'N/A', fullName: '', logo: '' };
        const lower = teamName.toLowerCase().trim();
        const data = TEAM_DATA[lower];
        if (data) {
            return { abbr: data.abbr, fullName: data.fullName || teamName, logo: data.logo };
        }
        return { abbr: teamName.substring(0, 3).toUpperCase(), fullName: teamName, logo: '' };
    }

    // ========== PARSE AND ADD PICKS ==========

    async function parseAndAddPicks(content) {
        if (!window.PickStandardizer) {
            console.error('PickStandardizer not loaded');
            return [];
        }

        // Set unit multiplier
        window.PickStandardizer.setUnitMultiplier(getUnitMultiplier());

        // Parse content
        const picks = window.PickStandardizer.standardize(content);
        
        if (picks.length === 0) {
            console.warn('No picks could be parsed from content');
            return [];
        }

        // Try to enrich picks with game data from ESPN
        const enrichedPicks = await enrichPicksWithGameData(picks);

        // Add to storage
        const added = addPicks(enrichedPicks);
        
        // Refresh the table
        refreshPicksTable();
        
        return added;
    }

    async function enrichPicksWithGameData(picks) {
        // Fetch today's games if AutoGameFetcher is available
        let todaysGames = [];
        if (window.AutoGameFetcher) {
            try {
                await window.AutoGameFetcher.fetchTodaysGames();
                todaysGames = window.AutoGameFetcher.getTodaysGames() || [];
                console.log(`🏀 Found ${todaysGames.length} games today:`, todaysGames.map(g => `${g.awayTeam} @ ${g.homeTeam} (${g.time})`));
            } catch (e) {
                console.warn('Could not fetch games:', e);
            }
        } else {
            console.warn('⚠️ AutoGameFetcher not available');
        }

        return picks.map(pick => {
            const enriched = { ...pick };
            const teamToFind = pick.pickTeam;

            console.log(`🔍 Looking for game with team: "${teamToFind}"`);

            // Try to find the game
            if (window.AutoGameFetcher && todaysGames.length > 0) {
                const game = window.AutoGameFetcher.findGame(teamToFind);
                if (game) {
                    console.log(`✅ Found game: ${game.awayTeam} (${game.awayRecord}) @ ${game.homeTeam} (${game.homeRecord}) at ${game.time}`);
                    enriched.awayTeam = game.awayTeam;
                    enriched.homeTeam = game.homeTeam;
                    enriched.awayRecord = game.awayRecord || '';
                    enriched.homeRecord = game.homeRecord || '';
                    enriched.gameTime = game.time;
                    enriched.gameDate = game.date;
                    enriched.sport = game.sport;
                    enriched.gameStatus = game.status;
                    enriched.game = `${game.awayTeam} @ ${game.homeTeam}`;
                } else {
                    console.warn(`❌ No game found for "${teamToFind}" - available teams:`, 
                        todaysGames.flatMap(g => [g.awayTeam, g.homeTeam]));
                }
            }

            // Set default date/time if not found
            if (!enriched.gameDate) {
                enriched.gameDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            if (!enriched.gameTime) {
                enriched.gameTime = 'TBD';
            }

            return enriched;
        });
    }

    // ========== REFRESH TABLE ==========

    /**
     * Format currency with fixed two decimals
     */
    function formatCurrencyValue(val) {
        if (val === undefined || val === null || val === '') return '$0.00';
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
        if (isNaN(num)) return '$0.00';
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Format date string into short month/day display
     */
    function formatDateValue(date) {
        if (!date) return 'Today';
        if (date.includes('/') || date.includes('-')) {
            const d = new Date(date);
            if (!isNaN(d)) {
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
        }
        return date;
    }

    /**
     * Group picks into singles and parlay clusters, preserving order.
     */
    function partitionPicksByParlay(picks) {
        const parlayMap = new Map();
        const sequence = [];
        const parlayAdded = new Set();

        picks.forEach(pick => {
            if (pick.parlayId) {
                if (!parlayMap.has(pick.parlayId)) {
                    parlayMap.set(pick.parlayId, {
                        parlayId: pick.parlayId,
                        parlayType: pick.parlayType,
                        legs: []
                    });
                }
                parlayMap.get(pick.parlayId).legs.push(pick);
                if (!parlayAdded.has(pick.parlayId)) {
                    parlayAdded.add(pick.parlayId);
                    sequence.push({ type: 'parlay', parlayId: pick.parlayId });
                }
            } else {
                sequence.push({ type: 'single', pick });
            }
        });

        const parlayGroups = Array.from(parlayMap.values()).map(group => ({
            ...group,
            summary: buildParlaySummary(group)
        }));

        return { sequence, parlayGroups, parlayMap };
    }

    /**
     * Build summary object for a parlay group (used in the parent row)
     */
    function buildParlaySummary(group) {
        const primary = group.legs[0];
        if (!primary) return {};

        const summary = {
            date: formatDateValue(primary.gameDate),
            time: primary.gameTime || 'TBD',
            sportsbook: primary.sportsbook || '',
            league: primary.sport,
            type: primary.parlayType || 'Parlay',
            risk: primary.parlaySummary?.risk ?? group.legs.reduce((sum, leg) => sum + (leg.parlaySummary?.risk || leg.risk || 0), 0),
            win: primary.parlaySummary?.win ?? group.legs.reduce((sum, leg) => sum + (leg.parlaySummary?.win || leg.win || 0), 0),
            segment: 'Parlay',
            legs: group.legs.length,
            status: primary.status || 'pending'
        };

        return summary;
    }

    const LEAGUE_LOGOS = {
        'NBA': 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
        'NFL': 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png',
        // NCAA Men's Basketball - using local cached logo
        'NCAAB': 'assets/logo_ncaam_bball.png',
        'NCAAM': 'assets/logo_ncaam_bball.png',
        "NCAA MEN'S BASKETBALL": 'assets/logo_ncaam_bball.png',
        'CBB': 'assets/logo_ncaam_bball.png',
        // NCAA Football - using local cached logo
        'NCAAF': 'assets/logo_ncaa_football',
        'COLLEGE FOOTBALL': 'assets/logo_ncaa_football',
        'CFB': 'assets/logo_ncaa_football',
        // Other pro leagues
        'MLB': 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
        'NHL': 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
        'MLS': 'https://a.espncdn.com/i/teamlogos/leagues/500/mls.png'
    };

    function renderLeagueCell(sport) {
        const logo = LEAGUE_LOGOS[sport] || '';
        return `
            <div class="league-cell">
                ${logo ? `<img src="${logo}" class="league-logo" alt="${sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-text">${sport}</span>
            </div>
        `;
    }

    /**
     * Toggle parlay leg visibility
     * DISABLED: Parlay legs expansion removed. Implement later if needed.
     */
    function toggleParlayLegs(parlayId, forceState) {
        // Feature disabled
        return;
    }

    function refreshPicksTable() {
        const picks = getAllPicks();
        const tbody = document.getElementById('picks-tbody');
        
        if (!tbody) {
            // Silent return if table not present (e.g. on pages without the picks table)
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        // Update table container class
        const tableContainer = tbody.closest('.table-container');
        if (tableContainer) {
            tableContainer.classList.toggle('has-picks', picks.length > 0);
        }

        if (picks.length === 0) {
            console.log('No picks to display');
            return;
        }

        const { sequence, parlayGroups, parlayMap } = partitionPicksByParlay(picks);
        const parlayLookup = new Map(parlayGroups.map(group => [group.parlayId, group]));

        sequence.forEach((entry, entryIdx) => {
            if (entry.type === 'single') {
                const row = createPickRow(entry.pick, entryIdx);
                tbody.appendChild(row);
            }
            // Parlay rows disabled - render only single picks
        });

        console.log(`📊 Displayed ${picks.length} picks in table`);

        // Trigger recalculations
        if (typeof window.calculateKPIs === 'function') {
            setTimeout(() => window.calculateKPIs(), 100);
        }
        if (window.ZebraStripes?.applyPicksTableZebraStripes) {
            setTimeout(() => window.ZebraStripes.applyPicksTableZebraStripes(), 50);
        }
    }

    // ========== CREATE ROW (FULL TEMPLATE) ==========

    function createPickRow(pick, idx, options = {}) {
        const row = document.createElement('tr');
        const { isParlayLeg = false } = options;
        if (isParlayLeg) {
            row.classList.add('parlay-leg', 'parlay-leg-hidden');
        }

        const pickTeamInfo = getTeamInfo(pick.pickTeam);
        const awayTeam = pick.awayTeam || pick.pickTeam || 'TBD';
        const homeTeam = pick.homeTeam || 'TBD';
        const awayRecord = pick.awayRecord || '';
        const homeRecord = pick.homeRecord || '';
        const awayInfo = getTeamInfo(awayTeam);
        const homeInfo = getTeamInfo(homeTeam);

        const segment = pick.segment || 'Full Game';
        const segmentKey = segment.toLowerCase().includes('1h') || segment.toLowerCase().includes('1st') ? '1h' :
                          segment.toLowerCase().includes('2h') || segment.toLowerCase().includes('2nd') ? '2h' :
                          'full-game';

        const segmentLabel = {
            '1h': '1st Half',
            '2h': '2nd Half',
            '1q': '1st Quarter',
            '2q': '2nd Quarter',
            '3q': '3rd Quarter',
            '4q': '4th Quarter',
            'full-game': 'Full Game'
        }[segmentKey] || 'Full Game';

        let selection = '';
        if (pick.pickType === 'spread') {
            const line = pick.line || '';
            selection = line.startsWith('+') || line.startsWith('-') ? line : `+${line}`;
        } else if (pick.pickType === 'moneyline') {
            selection = 'ML';
        } else if (pick.pickType === 'total' || pick.pickType === 'team-total') {
            selection = `${pick.pickDirection || 'Over'} ${pick.line || ''}`;
        }

        const status = pick.status || 'pending';
        const sportsbook = pick.sportsbook || '';
        const sport = (pick.sport || 'NBA').toUpperCase();

        const epochTime = pick.gameDate && pick.gameTime ?
            new Date(`${pick.gameDate} ${pick.gameTime}`).getTime() : Date.now();

        row.setAttribute('data-pick-id', pick.id || `pick-${idx}`);
        row.setAttribute('data-league', sport.toLowerCase());
        row.setAttribute('data-epoch', epochTime);
        row.setAttribute('data-book', sportsbook.toLowerCase());
        row.setAttribute('data-away', awayTeam.toLowerCase());
        row.setAttribute('data-home', homeTeam.toLowerCase());
        row.setAttribute('data-pick-type', pick.pickType || 'spread');
        row.setAttribute('data-pick-text', selection);
        row.setAttribute('data-segment', segmentKey);
        row.setAttribute('data-odds', pick.odds || '');
        row.setAttribute('data-risk', pick.risk || '');
        row.setAttribute('data-win', pick.win || '');
        row.setAttribute('data-status', status);
        row.setAttribute('data-is-parlay', pick.isParlay ? 'true' : 'false');
        if (pick.parlayId) row.setAttribute('data-parlay-id', pick.parlayId);
        row.classList.add('group-start');

        const isSingleTeamBet = !pick.homeTeam || homeTeam === 'TBD';

        const awayLogoHtml = awayInfo.logo 
            ? `<img src="${awayInfo.logo}" class="team-logo" loading="lazy" alt="${awayInfo.abbr}" onerror="this.style.display='none'">`
            : '';
        const homeLogoHtml = homeInfo.logo 
            ? `<img src="${homeInfo.logo}" class="team-logo" loading="lazy" alt="${homeInfo.abbr}" onerror="this.style.display='none'">`
            : '';
        const pickLogoHtml = pickTeamInfo.logo
            ? `<img src="${pickTeamInfo.logo}" class="pick-team-logo" loading="lazy" alt="${pickTeamInfo.abbr}" onerror="this.style.display='none'">`
            : '';

        const matchupHtml = isSingleTeamBet 
            ? `<div class="matchup-cell">
                    <div class="team-line">
                        ${awayLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${awayTeam}</span>
                            <span class="team-record">${awayRecord ? `(${awayRecord})` : ''}</span>
                        </div>
                    </div>
                </div>`
            : `<div class="matchup-cell">
                    <div class="team-line">
                        ${awayLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${awayTeam}</span>
                            <span class="team-record">${awayRecord ? `(${awayRecord})` : ''}</span>
                        </div>
                    </div>
                    <div class="vs-divider">vs</div>
                    <div class="team-line">
                        ${homeLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${homeTeam}</span>
                            <span class="team-record">${homeRecord ? `(${homeRecord})` : ''}</span>
                        </div>
                    </div>
                </div>`;

        // Sport-specific box score layout
        // NBA/NFL: Q1, Q2, Q3, Q4, T (quarters)
        // NCAAB/NCAAF: 1H, 2H, T (halves)
        const useQuarters = sport === 'NBA' || sport === 'NFL';
        const boxscoreClass = useQuarters ? 'boxscore-quarters' : 'boxscore-halves';

        let awayBoxRow, homeBoxRow, headerCells;

        if (useQuarters) {
            headerCells = `
                <div class="boxscore-cell header-cell">Q1</div>
                <div class="boxscore-cell header-cell">Q2</div>
                <div class="boxscore-cell header-cell">Q3</div>
                <div class="boxscore-cell header-cell">Q4</div>
                <div class="boxscore-cell header-cell">T</div>`;
            
            awayBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${awayInfo.logo ? `<img src="${awayInfo.logo}" class="boxscore-team-logo" loading="lazy" alt="${awayInfo.abbr}" onerror="this.style.display='none'">` : ''}
                            <span class="boxscore-team-abbr">${awayInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell q1-away"></div>
                    <div class="boxscore-cell period-cell q2-away"></div>
                    <div class="boxscore-cell period-cell q3-away"></div>
                    <div class="boxscore-cell period-cell q4-away"></div>
                    <div class="boxscore-cell total total-away"></div>
                </div>`;

            homeBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${homeInfo.logo ? `<img src="${homeInfo.logo}" class="boxscore-team-logo" loading="lazy" alt="${homeInfo.abbr}" onerror="this.style.display='none'">` : ''}
                            <span class="boxscore-team-abbr">${homeInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell q1-home"></div>
                    <div class="boxscore-cell period-cell q2-home"></div>
                    <div class="boxscore-cell period-cell q3-home"></div>
                    <div class="boxscore-cell period-cell q4-home"></div>
                    <div class="boxscore-cell total total-home"></div>
                </div>`;
        } else {
            // College basketball/football - halves
            headerCells = `
                <div class="boxscore-cell header-cell">1H</div>
                <div class="boxscore-cell header-cell">2H</div>
                <div class="boxscore-cell header-cell">T</div>`;
            
            awayBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${awayInfo.logo ? `<img src="${awayInfo.logo}" class="boxscore-team-logo" loading="lazy" alt="${awayInfo.abbr}" onerror="this.style.display='none'">` : ''}
                            <span class="boxscore-team-abbr">${awayInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell h1-away"></div>
                    <div class="boxscore-cell period-cell h2-away"></div>
                    <div class="boxscore-cell total total-away"></div>
                </div>`;

            homeBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${homeInfo.logo ? `<img src="${homeInfo.logo}" class="boxscore-team-logo" loading="lazy" alt="${homeInfo.abbr}" onerror="this.style.display='none'">` : ''}
                            <span class="boxscore-team-abbr">${homeInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell h1-home"></div>
                    <div class="boxscore-cell period-cell h2-home"></div>
                    <div class="boxscore-cell total total-home"></div>
                </div>`;
        }

        // Determine appropriate status for boxscore header
        const pickStatus = pick.status || 'pending';
        let statusText = pick.gameTime || 'Pending';
        let statusClass = 'countdown';

        if (pickStatus === 'final' || pickStatus === 'win' || pickStatus === 'loss' || pickStatus === 'push') {
            statusText = 'Final';
            statusClass = 'final';
        } else if (pickStatus === 'live' || pickStatus === 'on-track' || pickStatus === 'at-risk') {
            statusText = pick.gameTime || 'Live';
            statusClass = 'live';
        } else if (pickStatus === 'pending') {
            statusText = pick.gameTime || 'Pending';
            statusClass = 'countdown';
        }

        const boxscoreHtml = `
            <div class="boxscore-container" data-live-ready="false">
                <div class="compact-boxscore">
                    <div class="boxscore-grid ${boxscoreClass}">
                        <div class="boxscore-row header">
                            <div class="boxscore-cell header-cell game-time-cell">
                                <span class="game-time-status ${statusClass}">${statusText}</span>
                            </div>
                            ${headerCells}
                        </div>
                        ${awayBoxRow}
                        ${isSingleTeamBet ? '' : homeBoxRow}
                    </div>
                </div>
            </div>`;

        // Calculate hit/miss and won/lost values
        const hitMissValue = status === 'win' ? '✓' : status === 'loss' ? '✗' : status === 'push' ? '—' : '';
        const wonLostValue = status === 'win' ? formatCurrencyValue(pick.win) :
                            status === 'loss' ? `-${formatCurrencyValue(pick.risk)}` :
                            status === 'push' ? '$0.00' : '';

        row.innerHTML = `
            <td data-label="Date & Time">
                <div class="cell-date">${formatDateValue(pick.gameDate)}</div>
                <div class="cell-time">${pick.gameTime || 'TBD'}</div>
                <div class="sportsbook-value">${sportsbook}</div>
            </td>
            <td class="center">
                ${renderLeagueCell(sport)}
            </td>
            <td>
                ${matchupHtml}
            </td>
            <td class="center">
                <span class="game-segment" data-segment="${segmentKey}">${segmentLabel}</span>
            </td>
            <td>
                <div class="pick-cell">
                    <div class="pick-team-info">
                        ${pickLogoHtml}
                        <span class="pick-team-abbr">${pickTeamInfo.abbr}</span>
                    </div>
                    <div class="pick-details">
                        <span class="pick-line">${selection}</span>
                        <span class="pick-odds">(${pick.odds || '-110'})</span>
                    </div>
                </div>
            </td>
            <td class="center">
                <span class="currency-combined currency-stacked">
                    <span class="currency-risk-row"><span class="risk-amount">${formatCurrencyValue(pick.risk)}</span><span class="currency-separator"> /</span></span>
                    <span class="win-amount">${formatCurrencyValue(pick.win)}</span>
                </span>
            </td>
            <td class="center">
                ${boxscoreHtml}
            </td>
            <td class="center">
                <span class="status-badge" data-status="${status}" data-blurb="">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </td>
            <td class="center">
                <span class="hit-miss-value" data-status="${status}">${hitMissValue}</span>
            </td>
            <td class="center">
                <span class="won-lost-value" data-status="${status}">${wonLostValue}</span>
            </td>
        `;

        return row;
    }

    function createParlayParentRow(group, idx) {
        const row = document.createElement('tr');
        row.classList.add('parlay-row');
        row.setAttribute('data-parlay-id', group.parlayId);
        row.setAttribute('aria-expanded', 'false');

        const summary = group.summary || {};
        const status = (summary.status || 'pending').toLowerCase();
        const legCount = summary.legs || group.legs.length;

        // Calculate hit/miss and won/lost values for parlay
        const hitMissValue = status === 'win' ? '✓' : status === 'loss' ? '✗' : status === 'push' ? '—' : '';
        const wonLostValue = status === 'win' ? formatCurrencyValue(summary.win) :
                            status === 'loss' ? `-${formatCurrencyValue(summary.risk)}` :
                            status === 'push' ? '$0.00' : '';

        row.innerHTML = `
            <td data-label="Date & Time">
                <div class="cell-date">${summary.date || 'Today'}</div>
                <div class="cell-time">${summary.time || 'TBD'}</div>
                <div class="sportsbook-value">${summary.sportsbook || ''}</div>
            </td>
            <td class="center">
                ${renderLeagueCell(summary.league || 'MULTI')}
            </td>
            <td>
                <div class="matchup-cell parlay-matchup">
                    <span class="team-name-full">Multi-Leg</span>
                    <span class="parlay-leg-count">(${legCount} legs)</span>
                </div>
            </td>
            <td class="center">
                <span class="game-segment" data-segment="parlay">Parlay</span>
            </td>
            <td>
                <div class="pick-cell">
                    <span class="pick-team-abbr">${summary.type || 'Parlay'}</span>
                </div>
            </td>
            <td class="center">
                <span class="currency-combined currency-stacked">
                    <span class="currency-risk-row"><span class="risk-amount">${formatCurrencyValue(summary.risk)}</span><span class="currency-separator"> /</span></span>
                    <span class="win-amount">${formatCurrencyValue(summary.win)}</span>
                </span>
            </td>
            <td class="center">
                <span class="boxscore-placeholder">—</span>
            </td>
            <td class="center">
                <span class="status-badge" data-status="${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </td>
            <td class="center">
                <span class="hit-miss-value" data-status="${status}">${hitMissValue}</span>
            </td>
            <td class="center">
                <span class="won-lost-value" data-status="${status}">${wonLostValue}</span>
            </td>
        `;

        // Parlay expansion click handler disabled
        // row.addEventListener('click', (e) => {
        //     e.stopPropagation();
        //     toggleParlayLegs(group.parlayId);
        // });
        return row;
    }

    // ========== RE-ENRICH EXISTING PICKS ==========

    // ========== RE-ENRICH EXISTING PICKS ==========

    async function reEnrichExistingPicks() {
        const picks = getAllPicks();
        if (picks.length === 0) return;

        // Check if any picks are missing records
        const needsEnrichment = picks.some(p => !p.awayRecord && !p.homeRecord);
        if (!needsEnrichment) {
            console.log('✅ All picks already have records');
            return;
        }

        console.log('🔄 Re-enriching existing picks with ESPN data...');

        // Wait for AutoGameFetcher to be ready
        let attempts = 0;
        while (!window.AutoGameFetcher && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (!window.AutoGameFetcher) {
            console.warn('⚠️ AutoGameFetcher not available for re-enrichment');
            return;
        }

        // Fetch today's games
        try {
            await window.AutoGameFetcher.fetchTodaysGames();
            const todaysGames = window.AutoGameFetcher.getTodaysGames() || [];
            
            if (todaysGames.length === 0) {
                console.log('📭 No games today to enrich with');
                return;
            }

            console.log(`🏀 Found ${todaysGames.length} games for enrichment`);

            let updated = false;
            const enrichedPicks = picks.map(pick => {
                // Skip if already has records
                if (pick.awayRecord || pick.homeRecord) return pick;

                const teamToFind = pick.pickTeam || pick.awayTeam;
                if (!teamToFind) return pick;

                const game = window.AutoGameFetcher.findGame(teamToFind);
                if (game) {
                    console.log(`📝 Enriching: ${pick.pickTeam} -> ${game.awayTeam} (${game.awayRecord}) vs ${game.homeTeam} (${game.homeRecord})`);
                    updated = true;
                    return {
                        ...pick,
                        awayTeam: game.awayTeam,
                        homeTeam: game.homeTeam,
                        awayRecord: game.awayRecord || '',
                        homeRecord: game.homeRecord || '',
                        gameTime: pick.gameTime || game.time,
                        gameDate: pick.gameDate || game.date,
                        sport: pick.sport || game.sport,
                        gameStatus: game.status
                    };
                }
                return pick;
            });

            if (updated) {
                savePicks(enrichedPicks);
                console.log('✅ Picks re-enriched with team records');
                refreshPicksTable();
            }
        } catch (e) {
            console.error('Error re-enriching picks:', e);
        }
    }

    // ========== DEMO PICKS IMPORT (SAFE - does not override existing data) ==========
    
    /**
     * Import demo picks ONLY if no picks exist in localStorage.
     * This prevents accidentally wiping user data when version keys change.
     */
    function importTodaysPicks() {
        const existingPicks = getAllPicks();
        
        // SAFETY: If user already has picks, DO NOT override them
        if (existingPicks.length > 0) {
            console.log(`✅ Skipping demo import - user has ${existingPicks.length} existing picks`);
            return;
        }
        
        // Only import demo data for empty localStorage
        const IMPORT_KEY = 'gbsv_demo_imported_v1';
        if (localStorage.getItem(IMPORT_KEY)) {
            console.log('✅ Demo picks already imported');
            return;
        }
        
        // Generate today's date for demo picks
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // e.g., '2025-12-21'
        
        const demoPicks = [
            // Demo NBA pick
            { sport: 'NBA', sportsbook: 'Demo Book', pickTeam: 'San Antonio Spurs', awayTeam: 'San Antonio Spurs', homeTeam: 'New York Knicks', awayRecord: '13-13', homeRecord: '18-9', pickType: 'spread', line: '+2.5', odds: '-110', segment: 'Full Game', gameDate: todayStr, gameTime: '7:30 PM', risk: 1100, win: 1000, isParlay: false, status: 'pending' },
            // Demo NCAAB pick
            { sport: 'NCAAB', sportsbook: 'Demo Book', pickTeam: 'Butler Bulldogs', awayTeam: 'Butler Bulldogs', homeTeam: 'UConn Huskies', awayRecord: '6-4', homeRecord: '8-2', pickType: 'total', pickDirection: 'Over', line: '145.5', odds: '-110', segment: 'Full Game', gameDate: todayStr, gameTime: '8:00 PM', risk: 1100, win: 1000, isParlay: false, status: 'pending' }
        ];
        
        addPicks(demoPicks);
        localStorage.setItem(IMPORT_KEY, 'true');
        console.log('🎯 Imported demo picks for new users');
    }

    // ========== INITIALIZE ==========

    function initialize() {
        console.log('🏠 LocalPicksManager v2.2 initialized (auto re-enrich)');
        
        // Import today's picks (one-time)
        importTodaysPicks();

        // Override global functions
        window.processAndSavePicks = parseAndAddPicks;
        window.loadUploadedPicks = refreshPicksTable;

        // Load existing picks first (shows immediately)
        refreshPicksTable();

        // Then re-enrich with ESPN data (async, updates when ready)
        setTimeout(() => reEnrichExistingPicks(), 500);
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Export API
    window.LocalPicksManager = {
        getAll: getAllPicks,
        add: addPicks,
        parseAndAdd: parseAndAddPicks,
        clear: clearPicks,
        delete: deletePick,
        updateStatus: updatePickStatus,
        refresh: refreshPicksTable,
        reEnrich: reEnrichExistingPicks,
        getUnitMultiplier,
        setUnitMultiplier
    };

    console.log('✅ LocalPicksManager v2.2 loaded');
})();
