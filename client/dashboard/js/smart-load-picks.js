/**
 * Smart Picks Loader
 * Properly formats picks to match the dashboard template structure
 */


// Modular League/Team Registry
const LEAGUE_REGISTRY = {
    nfl: {
        teams: [
            'bills', 'patriots', 'jets', 'dolphins', 'ravens', 'bengals', 'browns', 'steelers',
            'jaguars', 'colts', 'titans', 'texans', 'chiefs', 'chargers', 'raiders', 'broncos',
            'cowboys', 'eagles', 'giants', 'commanders', 'packers', 'vikings', 'lions', 'bears',
            'saints', 'buccaneers', 'falcons', 'panthers', '49ers', 'rams', 'seahawks', 'cardinals'
        ],
        logoPath: 'team-logos/nfl-500-',
        display: 'NFL',
        color: '#1d3557'
    },
    nba: {
        teams: [
            'suns', 'clippers', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'spurs',
            'mavericks', '76ers', 'nets', 'kings', 'grizzlies', 'rockets', 'timberwolves',
            'nuggets', 'pelicans', 'trail blazers', 'jazz', 'bucks', 'cavaliers', 'hawks',
            'raptors', 'pacers', 'pistons', 'bulls', 'hornets'
        ],
        logoPath: 'team-logos/nba-500-',
        display: 'NBA',
        color: '#0a2342'
    },
    ncaab: {
        teams: [
            'georgia southern', 'appalachian st', 'appalachian state', 'uconn', 'connecticut',
            'butler', 'abilene', 'oral roberts', 'marist', 'georgia tech', 'east tenn',
            'north carolina', 'unc', 'duke', 'missouri st'
        ],
        logoPath: 'team-logos/ncaam-500-',
        display: 'NCAAM',
        color: '#264653'
    },
    ncaaf: {
        teams: [
            'utsa', 'south florida', 'cal poly', 'montana st', 'arizona'
        ],
        logoPath: 'team-logos/ncaaf-500-',
        display: 'NCAAF',
        color: '#2a9d8f'
    }
};

function detectLeagueFromTeams(gameStr, awayTeam, homeTeam) {
    const str = (gameStr || '').toLowerCase();
    const away = (awayTeam || '').toLowerCase();
    const home = (homeTeam || '').toLowerCase();
    const combined = `${away} ${home}`.toLowerCase();
    for (const [league, config] of Object.entries(LEAGUE_REGISTRY)) {
        if (config.teams.some(team => combined.includes(team))) {
            return league;
        }
    }
    // Default fallback
    return 'nfl';
}

// Modular team mapping for full name, abbreviation, logo, and league
const TEAM_MAP = {
    // NFL
    'bills': { full: 'Buffalo Bills', abbr: 'BUF', logo: 'bills', league: 'nfl' },
    'jaguars': { full: 'Jacksonville Jaguars', abbr: 'JAX', logo: 'jaguars', league: 'nfl' },
    'patriots': { full: 'New England Patriots', abbr: 'NE', logo: 'patriots', league: 'nfl' },
    'jets': { full: 'New York Jets', abbr: 'NYJ', logo: 'jets', league: 'nfl' },
    'dolphins': { full: 'Miami Dolphins', abbr: 'MIA', logo: 'dolphins', league: 'nfl' },
    // ... add all NFL teams here
    // NBA
    'suns': { full: 'Phoenix Suns', abbr: 'PHX', logo: 'suns', league: 'nba' },
    'clippers': { full: 'Los Angeles Clippers', abbr: 'LAC', logo: 'clippers', league: 'nba' },
    // ... add all NBA teams here
    // NCAAM
    'georgia southern': { full: 'Georgia Southern', abbr: 'GASO', logo: 'georgia_southern', league: 'ncaab' },
    // ... add all NCAAM teams here
    // NCAAF
    'utsa': { full: 'UTSA', abbr: 'UTSA', logo: 'utsa', league: 'ncaaf' },
    // ... add all NCAAF teams here
};

function getTeamInfo(teamKey) {
    return TEAM_MAP[teamKey?.toLowerCase()] || { full: teamKey, abbr: teamKey, logo: teamKey, league: null };
}

function detectLeagueFromTeams(gameStr, awayTeam, homeTeam) {
    const str = (gameStr || '').toLowerCase();
    const away = (awayTeam || '').toLowerCase();
    const home = (homeTeam || '').toLowerCase();
    const combined = `${away} ${home}`.toLowerCase();
    
    // Check NBA teams first
    if (NBA_TEAMS.some(team => combined.includes(team))) {
        return 'nba';
    }
    
    // Check NFL teams
    if (NFL_TEAMS.some(team => combined.includes(team))) {
        return 'nfl';
    }
    
    // Check College Basketball
    if (COLLEGE_BASKETBALL_TEAMS.some(team => combined.includes(team))) {
        return 'ncaab';
    }
    
    // Check College Football
    if (COLLEGE_FOOTBALL_TEAMS.some(team => combined.includes(team))) {
        return 'ncaaf';
    }
    
    // Default to NFL
    return 'nfl';
}


// Use getTeamInfo(teamKey) for all team display logic

let teamRecordsCache = null;
let teamRecordsPromise = null;
const globalScope = typeof window !== 'undefined' ? window : globalThis;

if (globalScope && typeof globalScope.__TEAM_RECORDS_PROMISE__ === 'undefined') {
    globalScope.__TEAM_RECORDS_PROMISE__ = null;
}

function normalizeTeamRecordValue(value) {
    if (value === undefined || value === null) return '';
    const cleaned = String(value).trim().replace(/[()]/g, '');
    return cleaned ? `(${cleaned})` : '';
}

function getTeamRecordFromCache(teamKey) {
    if (!teamRecordsCache || !teamKey) return '';
    const upperKey = teamKey.toUpperCase();
    return teamRecordsCache[upperKey] ||
        teamRecordsCache[teamKey] ||
        teamRecordsCache[upperKey.toLowerCase()] ||
        '';
}

function populateTeamRecords(root = document, options = {}) {
    if (!teamRecordsCache) return;
    const { force = false } = options;
    const scope = (root && typeof root.querySelectorAll === 'function') ? root : document;

    scope.querySelectorAll('.team-record[data-team], .boxscore-team-record[data-team]').forEach(el => {
        if (!force && el.textContent && el.textContent.trim()) {
            return;
        }
        const teamKey = el.getAttribute('data-team');
        const recordValue = getTeamRecordFromCache(teamKey);
        if (recordValue) {
            el.textContent = normalizeTeamRecordValue(recordValue);
        }
    });
}

function populateTeamRecordsWhenReady(root = document, options = {}) {
    if (!root || typeof populateTeamRecords !== 'function') {
        return;
    }

    const runPopulate = () => populateTeamRecords(root, options);

    if (teamRecordsCache) {
        runPopulate();
        return;
    }

    const pending = teamRecordsPromise || (typeof loadTeamRecords === 'function' ? loadTeamRecords() : null);
    if (pending && typeof pending.then === 'function') {
        pending
            .then(() => runPopulate())
            .catch(err => console.warn('[RECORDS] Deferred populate failed:', err));
    }
}

if (globalScope) {
    globalScope.populateTeamRecords = populateTeamRecords;
    globalScope.populateTeamRecordsWhenReady = populateTeamRecordsWhenReady;
}

function parsePickDescription(description) {
    /**
     * Parse pick description to extract pick type, team, line, odds
     * Examples:
     * "Raiders @ Broncos Under 43 (-110)" - Game Total
     * "Raiders O 15 (-125)" - Team Total
     * "Phoenix Suns Moneyline (-145)" - Moneyline
     * "Phoenix Suns -2 (-120)" - Spread
     */

    const result = {
        matchup: '',
        pickType: '',
        pickTeam: '',
        line: '',
        odds: '',
        segment: 'Full Game',
        isTeamTotal: false
    };

    // Extract odds
    const oddsMatch = description.match(/\(([+-]\d+)\)/);
    if (oddsMatch) {
        result.odds = oddsMatch[1];
    }

    // Check for segments (1st Half, 2nd Half, etc.)
    if (description.includes('1st Half')) {
        result.segment = '1st Half';
    } else if (description.includes('2nd Half')) {
        result.segment = '2nd Half';
    } else if (description.includes('1st Quarter')) {
        result.segment = '1st Quarter';
    }

    // Check for Team Total (e.g., "Raiders O 15" or "Raiders U 20.5")
    const teamTotalMatch = description.match(/^(.+?)\s+([OU])\s+(\d+\.?\d*)/i);
    if (teamTotalMatch && !description.includes('@')) {
        result.pickTeam = teamTotalMatch[1].trim();
        result.pickType = teamTotalMatch[2].toUpperCase() === 'O' ? 'Over' : 'Under';
        result.line = teamTotalMatch[3];
        result.isTeamTotal = true;
        return result;
    }

    // Check for Game Total (has @ in description and Over/Under)
    if (description.match(/under|over/i)) {
        const totalMatch = description.match(/(under|over)\s+(\d+\.?\d*)/i);
        if (totalMatch) {
            result.pickType = totalMatch[1].charAt(0).toUpperCase() + totalMatch[1].slice(1);
            result.line = totalMatch[2];
            result.isTeamTotal = false; // Game total, not team total
        }
    } else if (description.match(/moneyline|ml/i)) {
        result.pickType = 'Moneyline';
        // Extract team name before "Moneyline"
        const mlMatch = description.match(/^(.+?)\s+(?:Moneyline|ML)/i);
        if (mlMatch) {
            result.pickTeam = mlMatch[1].replace(/@.*$/, '').trim();
        }
    } else {
        // Spread - extract team name and line
        const spreadMatch = description.match(/^(.+?)\s+([+-]\d+\.?\d*)/);
        if (spreadMatch) {
            result.pickTeam = spreadMatch[1].replace(/@.*$/, '').trim();
            result.pickType = 'Spread';
            result.line = spreadMatch[2];
        }
    }

    return result;
}

function buildDescriptionFromFields(pick = {}) {
    const parts = [];
    if (pick.awayTeam && pick.homeTeam) {
        parts.push(`${pick.awayTeam} @ ${pick.homeTeam}`);
    } else if (pick.game) {
        parts.push(pick.game);
    } else if (pick.pickTeam) {
        parts.push(pick.pickTeam);
    }

    const type = (pick.pickType || '').toLowerCase();
    if (type === 'moneyline' || type === 'ml') {
        parts.push('ML');
    } else if (type === 'spread' && pick.line) {
        parts.push(pick.line);
    } else if ((type === 'total' || type === 'team-total') && pick.pickDirection) {
        parts.push(`${pick.pickDirection} ${pick.line || ''}`.trim());
    } else if (pick.line) {
        parts.push(pick.line);
    }

    if (pick.odds) {
        parts.push(`(${pick.odds})`);
    }

    return parts.filter(Boolean).join(' ').trim();
}

function parseTeamsFromGame(gameString) {
    /**
     * Extract away and home teams from game string
     * E.g., "Las Vegas Raiders @ Denver Broncos" or "Los Angeles Clippers / Phoenix Suns"
     */
    if (!gameString) return { away: '', home: '' };

    const separators = ['@', ' / ', ' vs ', ' vs. '];
    for (let sep of separators) {
        if (gameString.includes(sep)) {
            const parts = gameString.split(sep);
            return {
                away: parts[0].trim(),
                home: parts[1].trim()
            };
        }
    }

    return { away: gameString, home: '' };
}

function getTeamAbbr(teamName) {
    /**
     * Get team abbreviation from full name
     */
    const teamLookup = {
        'las vegas raiders': 'LV',
        'raiders': 'LV',
        'denver broncos': 'DEN',
        'broncos': 'DEN',
        'dallas cowboys': 'DAL',
        'cowboys': 'DAL',
        'philadelphia eagles': 'PHI',
        'eagles': 'PHI',
        'phoenix suns': 'PHX',
        'suns': 'PHX',
        'los angeles clippers': 'LAC',
        'clippers': 'LAC',
        'georgia southern': 'GASO',
        'appalachian st': 'APP',
        'appalachian state': 'APP',
        'utsa': 'UTSA',
        'south florida': 'USF',
        'butler': 'BUT',
        'connecticut': 'CONN',
        'u conn': 'CONN',
        'uconn': 'CONN',
        'abilene christian': 'ACU',
        'arizona': 'ARIZ',
        'montana st': 'MTST',
        'montana state': 'MTST',
        'cal poly slo': 'CPSU',
        'cal poly': 'CPSU',
        'oral roberts': 'ORU',
        'missouri st': 'MOST',
        'missouri state': 'MOST',
        'marist': 'MAR',
        'georgia tech': 'GT',
        'east tenn st': 'ETSU',
        'east tennessee st': 'ETSU',
        'east tennessee state': 'ETSU',
        'north carolina': 'UNC',
        'unc': 'UNC',
        'duke': 'DUKE',
        'duke blue devils': 'DUKE',
        'san antonio spurs': 'SAS',
        'spurs': 'SAS',
        'new york knicks': 'NYK',
        'knicks': 'NYK'
    };

    const key = (teamName || '').toLowerCase();
    if (teamLookup[key]) {
        return teamLookup[key];
    }

    const parts = (teamName || '')
        .match(/[A-Za-z0-9]+/g);
    if (parts && parts.length > 1) {
        const acronym = parts.map(part => part[0]).join('').toUpperCase();
        if (acronym.length >= 2 && acronym.length <= 4) {
            return acronym;
        }
    }

    return (teamName || '').substring(0, 3).toUpperCase();
}

function getTeamLogoId(teamName) {
    /**
     * Get ESPN team ID for logo URLs
     * NCAA uses numeric IDs, not abbreviations
     */
    const ncaaIds = {
        'georgia southern': '290',
        'appalachian st': '2026',
        'appalachian state': '2026',
        'utsa': '2636',
        'south florida': '58',
        'butler': '2086',
        'connecticut': '41',
        'u conn': '41',
        'uconn': '41',
        'abilene christian': '2000',
        'arizona': '12',
        'montana st': '149',
        'montana state': '149',
        'cal poly slo': '13',
        'cal poly': '13',
        'oral roberts': '198',
        'missouri st': '2623',
        'missouri state': '2623',
        'marist': '2368',
        'georgia tech': '59',
        'east tenn st': '2193',
        'east tennessee st': '2193',
        'east tennessee state': '2193',
        'north carolina': '153',
        'unc': '153',
        'duke': '150',
        'duke blue devils': '150'
    };

    const key = teamName.toLowerCase();
    if (ncaaIds[key]) {
        return ncaaIds[key];
    }

    // For NFL/NBA, return lowercase abbr
    return getTeamAbbr(teamName).toLowerCase();
}

function getTeamLogo(teamName, league = 'nfl') {
    /**
     * Get ESPN logo URL for team
     * Now uses LogoCache for better performance
     */

    // Use LogoCache if available
    if (window.LogoCache && window.LogoCache.getTeamLogo) {
        // LogoCache returns a promise, but we need synchronous for now
        // So we'll return the direct URL and let cache update async
        window.LogoCache.getTeamLogo(teamName, league).catch(err => {
            console.warn('Logo cache error:', err);
        });
    }

    // Return direct URL for immediate display
    const logoId = getTeamLogoId(teamName);

    if (league === 'nba') {
        return `https://a.espncdn.com/i/teamlogos/nba/500/${logoId}.png`;
    } else if (league === 'college' || league.includes('ncaa') || league === 'ncaab' || league === 'ncaaf') {
        // NCAA uses numeric IDs
        return `https://a.espncdn.com/i/teamlogos/ncaa/500/${logoId}.png`;
    } else {
        return `https://a.espncdn.com/i/teamlogos/nfl/500/${logoId}.png`;
    }
}

function generatePickDisplay(parsedPick, teamLogo, teamAbbr, teamName, coverage = null, statusClass = 'pending') {
    /**
     * Generate pick display based on pick type
     * - Game Total: "Total O/U 51 (-110)"
     * - Team Total: Logo + "Raiders O 15 (-125)"
     * - Moneyline: Logo + "Raiders (-125)"
     * - Spread: Logo + "Raiders +2.7 (-110)"
     * 
     * Adds live status arrows (↑/↓) based on coverage for live picks
     */
    
    // Determine live status arrow
    let liveArrow = '';
    const isLive = statusClass === 'on-track' || statusClass === 'at-risk' || statusClass === 'live';
    
    if (isLive && coverage) {
        if (typeof coverage.diff === 'number') {
            if (coverage.diff > 0) {
                liveArrow = '<span class="live-status-arrow up">↑</span>';
            } else if (coverage.diff < 0) {
                liveArrow = '<span class="live-status-arrow down">↓</span>';
            }
        } else if (coverage.coverageState === 'covering') {
            liveArrow = '<span class="live-status-arrow up">↑</span>';
        } else if (coverage.coverageState === 'trailing') {
            liveArrow = '<span class="live-status-arrow down">↓</span>';
        }
    }

    // Game Total (O/U) - NO logo, clean line: "Over 51.5 (−110)" (no redundant "Total" prefix)
    if ((parsedPick.pickType === 'Over' || parsedPick.pickType === 'Under') && !parsedPick.isTeamTotal) {
        return `
            <div class="pick-details">
                ${liveArrow}
                <span class="pick-line">${parsedPick.pickType} ${parsedPick.line}</span>
                ${parsedPick.odds ? `<span class="pick-odds">(${parsedPick.odds})</span>` : ''}
            </div>
        `;
    }

    // Team Total - Logo + "LV Over 15.5 (−125)" (no redundant "TT" prefix)
    if (parsedPick.isTeamTotal) {
        return `
            <div class="pick-team-info">
                <img src="${teamLogo}" class="pick-team-logo" loading="lazy" alt="${teamAbbr}">
                <span class="pick-team-abbr">${teamAbbr}</span>
            </div>
            <div class="pick-details">
                ${liveArrow}
                <span class="pick-line">${parsedPick.pickType} ${parsedPick.line}</span>
                ${parsedPick.odds ? `<span class="pick-odds">(${parsedPick.odds})</span>` : ''}
            </div>
        `;
    }

    // Moneyline - Logo + "LV (−125)" (no redundant "ML" text)
    if (parsedPick.pickType === 'Moneyline') {
        return `
            <div class="pick-team-info">
                <img src="${teamLogo}" class="pick-team-logo" loading="lazy" alt="${teamAbbr}">
                <span class="pick-team-abbr">${teamAbbr}</span>
            </div>
            <div class="pick-details">
                ${liveArrow}
                ${parsedPick.odds ? `<span class="pick-odds">(${parsedPick.odds})</span>` : ''}
            </div>
        `;
    }

    // Spread - Logo + "LV +2.5 (−110)"
    if (parsedPick.pickType === 'Spread') {
        return `
            <div class="pick-team-info">
                <img src="${teamLogo}" class="pick-team-logo" loading="lazy" alt="${teamAbbr}">
                <span class="pick-team-abbr">${teamAbbr}</span>
            </div>
            <div class="pick-details">
                ${liveArrow}
                <span class="pick-line">${parsedPick.line}</span>
                ${parsedPick.odds ? `<span class="pick-odds">(${parsedPick.odds})</span>` : ''}
            </div>
        `;
    }

    // Fallback - show all info
    return `
        <div class="pick-team-info">
            <img src="${teamLogo}" class="pick-team-logo" loading="lazy" alt="${teamAbbr}">
            <span class="pick-team-abbr">${teamAbbr}</span>
        </div>
        <div class="pick-details">
            ${liveArrow}
            ${parsedPick.pickType ? `<span class="pick-type">${parsedPick.pickType}</span>` : ''}
            ${parsedPick.line ? `<span class="pick-line">${parsedPick.line}</span>` : ''}
            ${parsedPick.odds ? `<span class="pick-odds">(${parsedPick.odds})</span>` : ''}
        </div>
    `;
}

function createBoxScoreRows(pick, awayLogo, awayAbbr, homeLogo, homeAbbr, statusClass) {
    /**
     * Create box score rows with actual scores if available
     */

    let awayScore = '—';
    let homeScore = '—';
    let awayRowClass = '';
    let homeRowClass = '';

    // Quarter scores
    let q1_away = '—', q2_away = '—', q3_away = '—', q4_away = '—';
    let q1_home = '—', q2_home = '—', q3_home = '—', q4_home = '—';

    // Parse quarter-by-quarter scores if available
    if (pick.quarters) {
        q1_away = pick.quarters.q1_away !== undefined ? pick.quarters.q1_away : '—';
        q2_away = pick.quarters.q2_away !== undefined ? pick.quarters.q2_away : '—';
        q3_away = pick.quarters.q3_away !== undefined ? pick.quarters.q3_away : '—';
        q4_away = pick.quarters.q4_away !== undefined ? pick.quarters.q4_away : '—';

        q1_home = pick.quarters.q1_home !== undefined ? pick.quarters.q1_home : '—';
        q2_home = pick.quarters.q2_home !== undefined ? pick.quarters.q2_home : '—';
        q3_home = pick.quarters.q3_home !== undefined ? pick.quarters.q3_home : '—';
        q4_home = pick.quarters.q4_home !== undefined ? pick.quarters.q4_home : '—';
    }

    // Parse final scores from result string
    if (pick.result) {
        const numbers = pick.result.match(/\d+/g);

        if (numbers && numbers.length >= 2) {
            awayScore = numbers[0];
            homeScore = numbers[1];

            const awayNum = parseInt(awayScore);
            const homeNum = parseInt(homeScore);

            // Determine winner
            if (awayNum > homeNum) {
                awayRowClass = 'winning';
                homeRowClass = 'losing';
            } else if (homeNum > awayNum) {
                homeRowClass = 'winning';
                awayRowClass = 'losing';
            }
        }
    }

    return `
        <div class="boxscore-row ${awayRowClass}">
            <div class="boxscore-cell team-cell">
                <div class="boxscore-team">
                    <img src="${awayLogo}" class="boxscore-team-logo" loading="lazy" alt="${awayAbbr}">
                    <span class="boxscore-team-abbr">${awayAbbr}</span>
                    <span class="boxscore-team-record" data-team="${awayAbbr}"></span>
                </div>
            </div>
            <div class="boxscore-cell">${q1_away}</div>
            <div class="boxscore-cell">${q2_away}</div>
            <div class="boxscore-cell">${q3_away}</div>
            <div class="boxscore-cell">${q4_away}</div>
            <div class="boxscore-cell total">${awayScore}</div>
        </div>
        <div class="boxscore-row ${homeRowClass}">
            <div class="boxscore-cell team-cell">
                <div class="boxscore-team">
                    <img src="${homeLogo}" class="boxscore-team-logo" loading="lazy" alt="${homeAbbr}">
                    <span class="boxscore-team-abbr">${homeAbbr}</span>
                    <span class="boxscore-team-record" data-team="${homeAbbr}"></span>
                </div>
            </div>
            <div class="boxscore-cell">${q1_home}</div>
            <div class="boxscore-cell">${q2_home}</div>
            <div class="boxscore-cell">${q3_home}</div>
            <div class="boxscore-cell">${q4_home}</div>
            <div class="boxscore-cell total">${homeScore}</div>
        </div>
    `;
}

function normalizeTeamKey(value) {
    return (value || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sanitizeSelectionName(selection) {
    return (selection || '')
        .replace(/\([^)]+\)/g, '')
        .replace(/[+-]\d+(\.\d+)?/g, '')
        .replace(/\b(ml|moneyline|spread|total|over|under|team total|tt)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchPickSide(pickTeamName, teams) {
    const pickKey = normalizeTeamKey(pickTeamName);
    if (!pickKey) return null;

    const awayKey = normalizeTeamKey(teams.away);
    const homeKey = normalizeTeamKey(teams.home);
    const awayAbbrKey = normalizeTeamKey(getTeamAbbr(teams.away || ''));
    const homeAbbrKey = normalizeTeamKey(getTeamAbbr(teams.home || ''));

    if (awayKey && (awayKey.includes(pickKey) || pickKey.includes(awayKey))) return 'away';
    if (homeKey && (homeKey.includes(pickKey) || pickKey.includes(homeKey))) return 'home';
    if (awayAbbrKey && awayAbbrKey === pickKey) return 'away';
    if (homeAbbrKey && homeAbbrKey === pickKey) return 'home';

    return null;
}

function parsePhaseDetails(phaseRaw = '') {
    const phase = (phaseRaw || '').trim();
    if (!phase) {
        return { isFinal: false, isHalftime: false, isPreGame: false, clock: '', period: '', label: '' };
    }

    const upper = phase.toUpperCase();
    const isFinal = upper.includes('FINAL');
    const isHalftime = !isFinal && upper.includes('HALF');
    const isPreGame = /ET|AM|PM|START|TIP|PREGAME|SCHEDULED|KICK/i.test(upper) && !isFinal;

    const clockMatch = phase.match(/(\d{1,2}:\d{2})/);
    const clock = clockMatch ? clockMatch[1] : '';

    const periodMatch = phase.match(/(Q\d+|OT|1ST|2ND|3RD|4TH|OT|1H|2H)/i);
    let period = periodMatch ? periodMatch[1].toUpperCase() : '';

    if (period === '1ST') period = 'Q1';
    else if (period === '2ND') period = 'Q2';
    else if (period === '3RD') period = 'Q3';
    else if (period === '4TH') period = 'Q4';

    let label = '';
    if (isFinal) {
        label = 'Final';
    } else if (isHalftime) {
        label = 'Halftime';
    } else if (clock && period) {
        label = `${clock} left in ${period}`;
    } else if (clock) {
        label = `${clock} left`;
    } else if (period) {
        label = period;
    } else {
        label = phase;
    }

    return { isFinal, isHalftime, isPreGame, clock, period, label };
}

function extractScoreboardDetails(resultText, matchup) {
    const text = (resultText || '').trim();
    if (!text) return null;

    const phaseMatch = text.match(/\(([^)]+)\)/);
    const phase = phaseMatch ? phaseMatch[1].trim() : '';
    const scorePortion = phaseMatch ? text.replace(phaseMatch[0], '').trim() : text;

    const scorePattern = scorePortion.match(/^([A-Za-z0-9 .&'’-]+)\s+(\d+)\s*[-–]\s*(\d+)/);
    const teams = parseTeamsFromGame(matchup || '');
    const phaseDetails = parsePhaseDetails(phase);

    if (!scorePattern) {
        return {
            raw: text,
            phaseRaw: phase,
            phaseLabel: phaseDetails.label,
            isFinal: phaseDetails.isFinal,
            isHalftime: phaseDetails.isHalftime,
            isPreGame: phaseDetails.isPreGame,
            clock: phaseDetails.clock,
            period: phaseDetails.period,
            teams
        };
    }

    const firstLabel = scorePattern[1].trim();
    const firstScore = parseInt(scorePattern[2], 10);
    const secondScore = parseInt(scorePattern[3], 10);

    const awayAbbrRaw = getTeamAbbr(teams.away || firstLabel);
    const homeAbbrRaw = getTeamAbbr(teams.home || '');

    const firstLabelKey = normalizeTeamKey(firstLabel);
    const awayKey = normalizeTeamKey(awayAbbrRaw || teams.away);
    const homeKey = normalizeTeamKey(homeAbbrRaw || teams.home);

    let awayScore = firstScore;
    let homeScore = secondScore;

    if (homeKey && firstLabelKey && firstLabelKey === homeKey) {
        homeScore = firstScore;
        awayScore = secondScore;
    }

    const fallbackAbbr = name => {
        const parts = (name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        const acronym = parts.map(part => part[0]).join('').toUpperCase();
        if (acronym.length >= 2 && acronym.length <= 4) return acronym;
        return (name || '').substring(0, 3).toUpperCase();
    };

    const awayAbbr = awayAbbrRaw || fallbackAbbr(teams.away || 'Away') || 'AWY';
    const homeAbbr = homeAbbrRaw || fallbackAbbr(teams.home || 'Home') || 'HME';

    const scoreboardText = `${awayAbbr} ${awayScore}-${homeAbbr} ${homeScore}`;

    return {
        raw: text,
        phaseRaw: phase,
        phaseLabel: phaseDetails.label,
        isFinal: phaseDetails.isFinal,
        isHalftime: phaseDetails.isHalftime,
        isPreGame: phaseDetails.isPreGame,
        clock: phaseDetails.clock,
        period: phaseDetails.period,
        awayScore,
        homeScore,
        awayAbbr,
        homeAbbr,
        teams,
        scoreboardText
    };
}

function determinePickMeta(payload) {
    const matchup = payload.matchup || payload.game || '';
    const selection = payload.selection || payload.description || '';
    const parsed = payload.parsedPick || (selection ? parsePickDescription(selection) : null);
    const teams = parseTeamsFromGame(matchup);

    const meta = {
        type: 'unknown',
        side: null,
        lineValue: null,
        isOver: false,
        isUnder: false,
        parsedPick: parsed,
        teams
    };

    if (parsed) {
        const pickType = (parsed.pickType || '').toLowerCase();
        if (parsed.isTeamTotal) {
            meta.type = 'team-total';
            meta.isOver = pickType === 'over';
            meta.isUnder = pickType === 'under';
        } else if (pickType === 'moneyline') {
            meta.type = 'moneyline';
        } else if (pickType === 'spread') {
            meta.type = 'spread';
        } else if (pickType === 'over' || pickType === 'under') {
            meta.type = 'total';
            meta.isOver = pickType === 'over';
            meta.isUnder = pickType === 'under';
        }

        if (parsed.line !== undefined && parsed.line !== null && parsed.line !== '') {
            const numericLine = parseFloat(String(parsed.line).replace(/[^\d.-]/g, ''));
            if (!Number.isNaN(numericLine)) {
                meta.lineValue = numericLine;
            }
        }
    }

    if (meta.type === 'unknown') {
        const marketString = (payload.market || '').toLowerCase();
        const selectionLower = selection.toLowerCase();
        if (marketString.includes('moneyline') || /moneyline|ml/.test(selectionLower)) {
            meta.type = 'moneyline';
        } else if (marketString.includes('spread') || /[+-]\d/.test(selectionLower)) {
            meta.type = 'spread';
        } else if (marketString.includes('total') || /over|under/.test(selectionLower)) {
            meta.type = 'total';
        }
    }

    if ((meta.type === 'moneyline' || meta.type === 'spread' || meta.type === 'team-total') && !meta.side) {
        const pickTeamName = parsed?.pickTeam || sanitizeSelectionName(selection);
        meta.side = matchPickSide(pickTeamName, teams);
    }

    if (meta.type === 'total' && meta.lineValue == null) {
        const lineMatch = selection.match(/(\d+\.?\d*)/);
        if (lineMatch) {
            const numericLine = parseFloat(lineMatch[1]);
            if (!Number.isNaN(numericLine)) {
                meta.lineValue = numericLine;
            }
        }
    }

    if (meta.type === 'team-total' && meta.lineValue == null) {
        const ttMatch = selection.match(/(\d+\.?\d*)/);
        if (ttMatch) {
            const numericLine = parseFloat(ttMatch[1]);
            if (!Number.isNaN(numericLine)) {
                meta.lineValue = numericLine;
            }
        }
        if (!meta.isOver && !meta.isUnder) {
            if (/over/i.test(selection)) meta.isOver = true;
            if (/under/i.test(selection)) meta.isUnder = true;
        }
    }

    return meta;
}

function evaluateCoverage(liveInfo, pickMeta) {
    if (!liveInfo) return { coverageState: 'unknown' };
    if (!pickMeta || typeof pickMeta !== 'object') return { coverageState: 'unknown' };

    const { type, side, lineValue, isOver, isUnder } = pickMeta;

    if (liveInfo.awayScore == null || liveInfo.homeScore == null) {
        return { coverageState: 'unknown' };
    }

    if (type === 'total') {
        if (!Number.isFinite(lineValue)) return { coverageState: 'unknown', type };
        const totalScore = (liveInfo.awayScore || 0) + (liveInfo.homeScore || 0);
        const margin = (isOver ? totalScore - lineValue : lineValue - totalScore);
        let coverageState = 'unknown';
        if (margin > 0) coverageState = 'covering';
        else if (margin < 0) coverageState = 'trailing';
        else coverageState = 'push';
        return { coverageState, totalScore, margin, lineValue, type };
    }

    if (type === 'team-total') {
        if (!side || !Number.isFinite(lineValue)) return { coverageState: 'unknown', type };
        const ourScore = side === 'home' ? liveInfo.homeScore : liveInfo.awayScore;
        const oppScore = side === 'home' ? liveInfo.awayScore : liveInfo.homeScore;
        const margin = (isOver ? ourScore - lineValue : lineValue - ourScore);
        let coverageState = 'unknown';
        if (margin > 0) coverageState = 'covering';
        else if (margin < 0) coverageState = 'trailing';
        else coverageState = 'push';
        return { coverageState, ourScore, oppScore, diff: ourScore - oppScore, margin, lineValue, type };
    }

    if (type === 'moneyline' || type === 'spread') {
        if (!side) return { coverageState: 'unknown', type };
        const ourScore = side === 'home' ? liveInfo.homeScore : liveInfo.awayScore;
        const oppScore = side === 'home' ? liveInfo.awayScore : liveInfo.homeScore;
        const diff = ourScore - oppScore;

        if (type === 'spread' && Number.isFinite(lineValue)) {
            const coverMargin = diff + lineValue;
            let coverageState = 'unknown';
            if (coverMargin > 0) coverageState = 'covering';
            else if (coverMargin < 0) coverageState = 'trailing';
            else coverageState = 'push';
            return { coverageState, ourScore, oppScore, diff, coverMargin, lineValue, type };
        }

        let coverageState = 'unknown';
        if (diff > 0) coverageState = 'covering';
        else if (diff < 0) coverageState = 'trailing';
        else coverageState = 'push';
        return { coverageState, ourScore, oppScore, diff, type };
    }

    return { coverageState: 'unknown', type };
}

function buildStatusDecision(baseStatus, liveInfo, coverage) {
    const normalizedBase = (baseStatus || '').toLowerCase();
    const canonicalBase = normalizedBase === 'loss' ? 'lost' : normalizedBase;
    const titleCase = key => key.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

    if (['win', 'lost', 'push'].includes(canonicalBase)) {
        return { key: canonicalBase, label: titleCase(canonicalBase) };
    }

    if (liveInfo && liveInfo.isFinal) {
        if (coverage.coverageState === 'covering') return { key: 'win', label: 'Win' };
        if (coverage.coverageState === 'trailing') return { key: 'lost', label: 'Lost' };
        if (coverage.coverageState === 'push') return { key: 'push', label: 'Push' };
    }

    if (coverage.coverageState === 'covering') {
        return { key: 'on-track', label: 'On Track' };
    }

    if (coverage.coverageState === 'trailing') {
        return { key: 'at-risk', label: 'At Risk' };
    }

    if (coverage.coverageState === 'push') {
        return { key: canonicalBase || 'pending', label: titleCase(canonicalBase || 'Pending') };
    }

    if (canonicalBase) {
        return { key: canonicalBase, label: titleCase(canonicalBase) };
    }

    return { key: 'pending', label: 'Pending' };
}

function composeStatusTooltip(payload, liveInfo, coverage, decision, pickMeta) {
    const parts = [];

    if (liveInfo) {
        if (coverage) {
            if (typeof coverage.diff === 'number' && (pickMeta.type === 'moneyline' || pickMeta.type === 'spread' || pickMeta.type === 'team-total')) {
                if (coverage.diff > 0) parts.push(`Up ${Math.abs(coverage.diff)}`);
                else if (coverage.diff < 0) parts.push(`Down ${Math.abs(coverage.diff)}`);
                else parts.push('Tied');
            } else if (pickMeta.type === 'total' && typeof coverage.margin === 'number' && Number.isFinite(pickMeta.lineValue)) {
                const margin = Math.abs(coverage.margin).toFixed(1).replace(/\.0$/, '');
                if (coverage.coverageState === 'covering') {
                    parts.push(`+${margin}`);
                } else if (coverage.coverageState === 'trailing') {
                    parts.push(`Need ${margin}`);
                }
            }
        }

        // Only show scoreboard if no margin info (to avoid redundancy)
        if (!coverage && liveInfo.scoreboardText) {
            parts.push(liveInfo.scoreboardText);
        } else if (!coverage && payload.result) {
            parts.push(payload.result);
        }

        // Simplified phase label (remove "left in" verbosity)
        if (liveInfo.phaseLabel) {
            const phaseMatch = liveInfo.phaseLabel.match(/(Q\d+|OT|1ST|2ND|3RD|4TH|1H|2H)/i);
            const clockMatch = liveInfo.phaseLabel.match(/(\d{1,2}:\d{2})/);
            if (phaseMatch && clockMatch) {
                parts.push(`${normalizePeriodLabel(phaseMatch[1])} ${clockMatch[1]}`);
            } else if (phaseMatch) {
                parts.push(normalizePeriodLabel(phaseMatch[1]));
            } else if (clockMatch) {
                parts.push(clockMatch[1]);
            }
        }
    }

    if (!parts.length && payload.start) {
        parts.push(`Starts ${payload.start}`);
    }

    if (!parts.length && payload.countdown) {
        parts.push(payload.countdown);
    }

    if (!parts.length && payload.result) {
        parts.push(payload.result);
    }

    if (!parts.length && decision) {
        parts.push(decision.label);
    }

    if (!parts.length && payload.status) {
        parts.push(payload.status);
    }

    return parts.filter(Boolean).join(' • ');
}

function formatPointValue(value) {
    if (value === undefined || value === null) return '';
    const absValue = Math.abs(value);
    if (!Number.isFinite(absValue)) return '';
    const rounded = Math.round(absValue * 10) / 10;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(1).replace(/\.0$/, '');
}

function formatLineValue(value) {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(1).replace(/\.0$/, '');
}

function normalizePeriodLabel(value) {
    if (!value) return '';
    const upper = value.toString().toUpperCase();
    if (upper === '1ST') return 'Q1';
    if (upper === '2ND') return 'Q2';
    if (upper === '3RD') return 'Q3';
    if (upper === '4TH') return 'Q4';
    return upper;
}

function parsePhaseSnippet(source) {
    if (!source) return '';
    // Remove verbose phrases like "left in" or "remaining"
    const cleaned = source.replace(/\s*(left in|remaining|left)\s*/i, ' ');
    const clockMatch = cleaned.match(/(\d{1,2}:\d{2})/);
    const periodMatch = cleaned.match(/(Q\d+|OT|1ST|2ND|3RD|4TH|1H|2H)/i);
    const periodText = periodMatch ? normalizePeriodLabel(periodMatch[1]) : '';
    if (clockMatch && periodText) return `${periodText} ${clockMatch[1]}`;
    if (periodText) return periodText;
    if (clockMatch) return clockMatch[1];
    return cleaned.trim();
}

function formatPhaseSnippet(liveInfo) {
    if (!liveInfo) return '';
    if (liveInfo.isFinal) return 'Final';
    if (liveInfo.isHalftime) return 'Halftime';
    const fromLabel = parsePhaseSnippet(liveInfo.phaseLabel);
    if (fromLabel) return fromLabel;
    const combined = [liveInfo.period, liveInfo.clock].filter(Boolean).join(' ').trim();
    if (combined) {
        return parsePhaseSnippet(combined);
    }
    return '';
}

function formatLiveMarginSnippet(coverage, pickMeta) {
    if (!coverage || !pickMeta) return '';
    const { type } = pickMeta;

    if (type === 'spread' && typeof coverage.coverMargin === 'number') {
        if (coverage.coverMargin === 0) return 'At number';
        const valueText = formatPointValue(coverage.coverMargin);
        if (!valueText) return '';
        return coverage.coverMargin > 0
            ? `Covering by ${valueText}`
            : `Need ${valueText}`;
    }

    if ((type === 'total' || type === 'team-total') && typeof coverage.margin === 'number') {
        if (coverage.margin === 0) {
            if (Number.isFinite(pickMeta.lineValue)) {
                return `On ${formatLineValue(pickMeta.lineValue)}`;
            }
            return 'Even';
        }
        const valueText = formatPointValue(coverage.margin);
        if (!valueText) return '';
        const label = type === 'team-total'
            ? (pickMeta.isOver ? 'Over TT' : 'Under TT')
            : (pickMeta.isOver ? 'Over' : 'Under');
        // Remove redundant "vs X" - line value is already in badge context
        return coverage.margin > 0
            ? `${label} by ${valueText}`
            : `Need ${valueText}`;
    }

    if (typeof coverage.diff === 'number') {
        if (coverage.diff === 0) return 'Tied';
        const valueText = formatPointValue(coverage.diff);
        if (!valueText) return '';
        return coverage.diff > 0 ? `Up ${valueText}` : `Down ${valueText}`;
    }

    return '';
}

function formatFinalBadgeContext(decisionKey, coverage, pickMeta) {
    if (!pickMeta) return '';
    if (decisionKey === 'push') {
        if (Number.isFinite(pickMeta.lineValue)) {
            return `Push @ ${formatLineValue(pickMeta.lineValue)}`;
        }
        return 'Push';
    }

    if (!coverage) return '';
    const { type } = pickMeta;

    if (type === 'spread' && typeof coverage.coverMargin === 'number') {
        if (coverage.coverMargin === 0) {
            return Number.isFinite(pickMeta.lineValue) ? `Push @ ${formatLineValue(pickMeta.lineValue)}` : 'Push';
        }
        const coverValue = formatPointValue(coverage.coverMargin);
        const diffValue = Number.isFinite(coverage.diff) ? formatPointValue(coverage.diff) : '';
        if (!coverValue && !diffValue) return '';
        if (coverage.coverMargin > 0) {
            if (diffValue) {
                return `Won by ${diffValue}${coverValue ? ` • Cov ${coverValue}` : ''}`;
            }
            return `Covered by ${coverValue}`;
        }
        if (diffValue) {
            const scoreboardPhrase = coverage.diff < 0
                ? `Lost by ${diffValue}`
                : `Won by ${diffValue}`;
            const needText = coverValue ? ` • Need ${coverValue}` : '';
            return `${scoreboardPhrase}${needText}`;
        }
        return coverValue ? `Missed by ${coverValue}` : '';
    }

    if ((type === 'total' || type === 'team-total') && typeof coverage.margin === 'number') {
        if (coverage.margin === 0) {
            return Number.isFinite(pickMeta.lineValue) ? `Push @ ${formatLineValue(pickMeta.lineValue)}` : 'Push';
        }
        const valueText = formatPointValue(coverage.margin);
        if (!valueText) return '';
        const label = type === 'team-total'
            ? (pickMeta.isOver ? 'Over TT' : 'Under TT')
            : (pickMeta.isOver ? 'Over' : 'Under');
        const lineText = Number.isFinite(pickMeta.lineValue) ? ` vs ${formatLineValue(pickMeta.lineValue)}` : '';
        return coverage.margin > 0
            ? `${label} by ${valueText}${lineText}`
            : `Short ${valueText}${lineText}`;
    }

    if (typeof coverage.diff === 'number') {
        if (coverage.diff === 0) return 'Tied';
        const valueText = formatPointValue(coverage.diff);
        if (!valueText) return '';
        return coverage.diff > 0
            ? `Won by ${valueText}`
            : `Lost by ${valueText}`;
    }

    return '';
}

function formatPendingBadgeContext(payload) {
    if (!payload) return '';
    if (payload.countdown) return payload.countdown;
    if (payload.start) return payload.start;
    if (payload.scheduled) return payload.scheduled;
    return '';
}

function formatStatusBadgeContext(decision, liveInfo, coverage, pickMeta, payload) {
    if (!decision) return '';
    const key = decision.key;

    if (key === 'on-track' || key === 'at-risk' || key === 'live') {
        const marginText = formatLiveMarginSnippet(coverage, pickMeta);
        const phaseText = formatPhaseSnippet(liveInfo);
        // Concise format: just phase if we have margin, or both if needed
        if (marginText && phaseText) {
            return `${marginText} • ${phaseText}`;
        }
        return marginText || phaseText;
    }

    if (key === 'win' || key === 'lost' || key === 'push') {
        const finalContext = formatFinalBadgeContext(key, coverage, pickMeta);
        if (finalContext) return finalContext;
        if (liveInfo?.scoreboardText) return liveInfo.scoreboardText;
        if (payload?.result) return payload.result;
        return '';
    }

    if (key === 'pending') {
        return formatPendingBadgeContext(payload);
    }

    return '';
}

function normalizeBlurbPayload(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { status: input };
    }
    return { ...input };
}

function escapeHtmlForStatus(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function calculatePickMargin(parsedPick, result, game) {
    /**
     * Calculate how much a pick won/lost by
     * Returns margin string like "Covered by 5 pts" or "Lost by 3 pts"
     */
    if (!result || !parsedPick) return null;
    
    // Extract scores from result
    const scoreMatch = result.match(/(\d+)-(\d+)|(\d+)\s*-\s*(\d+)/);
    if (!scoreMatch) return null;
    
    const awayScore = parseInt(scoreMatch[1] || scoreMatch[3]);
    const homeScore = parseInt(scoreMatch[2] || scoreMatch[4]);
    
    if (isNaN(awayScore) || isNaN(homeScore)) return null;
    
    const actualDiff = awayScore - homeScore; // positive = away won
    const actualTotal = awayScore + homeScore;
    
    // Determine which team was picked (away or home)
    let isPickedAway = false;
    if (parsedPick.pickTeam && game) {
        const teams = parseTeamsFromGame(game);
        const pickTeamLower = parsedPick.pickTeam.toLowerCase();
        const awayLower = teams.away.toLowerCase();
        isPickedAway = awayLower.includes(pickTeamLower) || pickTeamLower.includes(awayLower);
    }
    
    // Calculate margin based on pick type
    if (parsedPick.pickType === 'Spread' && parsedPick.line) {
        const spread = parseFloat(parsedPick.line);
        // If picked away team with spread, their adjusted score is awayScore + spread
        // If picked home team with spread, their adjusted score is homeScore + spread
        let coverMargin;
        if (isPickedAway) {
            // Away team + spread vs home team
            coverMargin = (awayScore + spread) - homeScore;
        } else {
            // Home team + spread vs away team
            coverMargin = (homeScore + spread) - awayScore;
        }
        
        const absMargin = Math.abs(coverMargin);
        if (coverMargin > 0) {
            return `Covered by ${absMargin.toFixed(1)} pts`;
        } else if (coverMargin < 0) {
            return `Lost by ${absMargin.toFixed(1)} pts`;
        } else {
            return 'Push (exact)';
        }
    } else if (parsedPick.pickType === 'Over' || parsedPick.pickType === 'Under') {
        const line = parseFloat(parsedPick.line);
        if (isNaN(line)) return null;
        
        const margin = Math.abs(actualTotal - line);
        if (parsedPick.pickType === 'Over') {
            if (actualTotal > line) {
                return `Covered by ${margin.toFixed(1)} pts`;
            } else if (actualTotal < line) {
                return `Lost by ${margin.toFixed(1)} pts`;
            } else {
                return 'Push (exact)';
            }
        } else { // Under
            if (actualTotal < line) {
                return `Covered by ${margin.toFixed(1)} pts`;
            } else if (actualTotal > line) {
                return `Lost by ${margin.toFixed(1)} pts`;
            } else {
                return 'Push (exact)';
            }
        }
    } else if (parsedPick.pickType === 'Moneyline') {
        // For moneyline, just show the score differential
        let margin;
        if (isPickedAway) {
            margin = awayScore - homeScore;
        } else {
            margin = homeScore - awayScore;
        }
        
        const absMargin = Math.abs(margin);
        if (margin > 0) {
            return `Won by ${absMargin} pts`;
        } else if (margin < 0) {
            return `Lost by ${absMargin} pts`;
        } else {
            return 'Tied';
        }
    }
    
    return null;
}

function buildStatusBadgeHTML({ statusClass, label, tooltip, info, extraClass = '', margin = null }) {
    const safeStatus = escapeHtmlForStatus(statusClass || 'pending');
    const safeLabel = escapeHtmlForStatus(label || '');
    const safeTooltip = tooltip ? escapeHtmlForStatus(tooltip) : '';
    const safeInfo = info ? escapeHtmlForStatus(info) : '';
    const safeMargin = margin ? escapeHtmlForStatus(margin) : '';
    
    // Only include info if it's meaningful (has wins or losses, not just "0W-0L-XP")
    const hasWinOrLoss = safeInfo && /(^|[^\d])([1-9]\d*)W|(^|[^\d])([1-9]\d*)L/.test(safeInfo);
    const shouldShowInfo = safeInfo && hasWinOrLoss;
    
    const tooltipAttr = safeTooltip ? ` data-blurb="${safeTooltip}"` : '';
    const infoAttr = shouldShowInfo ? ` data-status-info="${safeInfo}"` : '';
    const marginAttr = safeMargin ? ` data-margin="${safeMargin}"` : '';
    // Note: status-badge-info span removed - info is now shown in tooltip via data-status-info
    const extraClassValue = extraClass ? ` ${extraClass}` : '';
    return `<span class="status-badge${extraClassValue}" data-status="${safeStatus}"${tooltipAttr}${infoAttr}${marginAttr}>${safeLabel}</span>`;
}

function formatGameTimeStatus(statusClass, liveInfo, result, status, countdown, start) {
    /**
     * Format the game-time-status for the top-left box score cell
     * Returns HTML string with proper status indicators:
     * - FINAL for completed games
     * - LIVE + period/time for live games
     * - Countdown or "Starts in X" for pending games
     */
    
    // Final games
    if (statusClass === 'win' || statusClass === 'lost' || statusClass === 'final') {
        return '<span class="game-time-status final">FINAL</span>';
    }
    
    // Live games - show LIVE indicator + period/time
    if (statusClass === 'on-track' || statusClass === 'at-risk' || statusClass === 'live') {
        let timeText = '';
        if (liveInfo) {
            if (liveInfo.phaseLabel) {
                // Extract period and time from phaseLabel (e.g., "Q4 8:42" or "8:42 left in Q4")
                const periodMatch = liveInfo.phaseLabel.match(/(Q\d+|OT|1ST|2ND|3RD|4TH|1H|2H)/i);
                const clockMatch = liveInfo.phaseLabel.match(/(\d{1,2}:\d{2})/);
                if (periodMatch && clockMatch) {
                    timeText = `${periodMatch[1].toUpperCase()} ${clockMatch[1]}`;
                } else if (periodMatch) {
                    timeText = periodMatch[1].toUpperCase();
                } else if (clockMatch) {
                    timeText = clockMatch[1];
                } else {
                    timeText = liveInfo.phaseLabel;
                }
            } else if (liveInfo.period && liveInfo.clock) {
                timeText = `${liveInfo.period} ${liveInfo.clock}`;
            } else if (liveInfo.period) {
                timeText = liveInfo.period;
            } else if (liveInfo.clock) {
                timeText = liveInfo.clock;
            }
        }
        
        // Fallback to result if available
        if (!timeText && result) {
            const periodMatch = result.match(/(Q\d+|OT|1ST|2ND|3RD|4TH|1H|2H)/i);
            const clockMatch = result.match(/(\d{1,2}:\d{2})/);
            if (periodMatch && clockMatch) {
                timeText = `${periodMatch[1].toUpperCase()} ${clockMatch[1]}`;
            } else if (periodMatch) {
                timeText = periodMatch[1].toUpperCase();
            } else if (clockMatch) {
                timeText = clockMatch[1];
            }
        }
        
        if (timeText) {
            return `<span class="live-indicator">LIVE</span><span class="game-time-status">${escapeHtmlForStatus(timeText)}</span>`;
        } else {
            return '<span class="live-indicator">LIVE</span><span class="game-time-status">LIVE</span>';
        }
    }
    
    // Pending games - show countdown or start time
    if (countdown) {
        return `<span class="game-time-status countdown">${escapeHtmlForStatus(countdown)}</span>`;
    }
    
    if (start) {
        // Check if it's a countdown format
        if (start.includes('Starts in') || start.includes('starts in')) {
            return `<span class="game-time-status countdown">${escapeHtmlForStatus(start)}</span>`;
        }
        // Otherwise show as start time
        return `<span class="game-time-status countdown">${escapeHtmlForStatus(start)}</span>`;
    }
    
    // Default fallback
    if (result) {
        return `<span class="game-time-status">${escapeHtmlForStatus(result)}</span>`;
    }
    
    if (status) {
        return `<span class="game-time-status">${escapeHtmlForStatus(status)}</span>`;
    }
    
    return '<span class="game-time-status">—</span>';
}

function buildStatusMeta(payloadInput, fallbackResult) {
    const payload = normalizeBlurbPayload(payloadInput);
    if (fallbackResult !== undefined && payload.result === undefined) {
        payload.result = fallbackResult;
    }
    if (!payload.status && payload.baseStatus) {
        payload.status = payload.baseStatus;
    }
    if (payload.score === undefined) {
        payload.score = payload.result;
    }
    if (!payload.matchup && payload.game) {
        payload.matchup = payload.game;
    }

    const pickMeta = determinePickMeta(payload);
    const liveInfo = extractScoreboardDetails(payload.score, payload.matchup);
    const coverage = evaluateCoverage(liveInfo, pickMeta);
    const decision = buildStatusDecision(payload.status, liveInfo, coverage);
    const tooltip = composeStatusTooltip(payload, liveInfo, coverage, decision, pickMeta);
    const badgeContext = formatStatusBadgeContext(decision, liveInfo, coverage, pickMeta, payload);

    return {
        statusKey: decision.key,
        statusLabel: decision.label,
        tooltip,
        liveInfo,
        coverage,
        pickMeta,
        badgeContext
    };
}

function getStatusBlurb(statusOrPayload, resultMaybe) {
    if (typeof statusOrPayload === 'object' && statusOrPayload !== null && !Array.isArray(statusOrPayload)) {
        return buildStatusMeta(statusOrPayload).tooltip;
    }
    return buildStatusMeta({ status: statusOrPayload }, resultMaybe).tooltip;
}

function parseMoneyAmount(raw) {
    if (raw === null || raw === undefined) return 0;
    const n = parseFloat(raw.toString().replace(/[$,]/g, '').trim());
    return Number.isFinite(n) ? n : 0;
}

function formatCurrencyTerse(value) {
    if (value === null || value === undefined || value === '') return '—';
    const num = parseMoneyAmount(value);
    if (!Number.isFinite(num)) return '—';
    return `$${Math.round(num).toLocaleString()}`;
}

function normalizeBookName(name) {
    const trimmed = (name || '').toString().trim();
    const cleaned = trimmed.replace(/_/g, ' ');
    return cleaned || 'Manual Upload';
}

function normalizeBookKey(name) {
    return normalizeBookName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function normalizeDateTimeParts(pick) {
    let date = pick.gameDate || pick.date || '';
    let time = pick.gameTime || pick.time || '';
    const fallback = pick.scheduled || pick.start || pick.accepted || '';

    const maybeParseFallback = (value) => {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return {
                date: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                time: parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            };
        }
        const parts = value.split(' ');
        if (parts.length >= 2) {
            return { date: parts.slice(0, parts.length - 1).join(' '), time: parts.slice(-1)[0] };
        }
        return { date: value, time: '' };
    };

    if ((!date || !time) && fallback) {
        const derived = maybeParseFallback(fallback);
        if (!date) date = derived.date;
        if (!time) time = derived.time;
    }

    const buildEpoch = () => {
        if (date && time) {
            const ts = Date.parse(`${date} ${time}`);
            if (!Number.isNaN(ts)) return ts;
        }
        if (fallback) {
            const ts = Date.parse(fallback);
            if (!Number.isNaN(ts)) return ts;
        }
        return Date.now();
    };

    return {
        displayDate: date || 'TBD',
        displayTime: time || '',
        epoch: buildEpoch()
    };
}

function toMoneyValue(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const cleaned = parseFloat(raw.toString().replace(/[$,]/g, '').trim());
    return Number.isFinite(cleaned) ? cleaned : null;
}

function formatCurrencyDisplay(value, fallback = '-') {
    if (value === null || value === undefined || Number.isNaN(value)) return fallback;
    const num = typeof value === 'number' ? value : parseMoneyAmount(value);
    if (!Number.isFinite(num)) return fallback;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function calculateWinFromOdds(risk, odds) {
    const riskVal = toMoneyValue(risk);
    const oddsText = (odds || '').toString().trim();
    const oddsNum = parseInt(oddsText.replace(/[^\d+-]/g, ''), 10);

    if (riskVal === null || Number.isNaN(oddsNum)) return null;

    if (oddsNum > 0) {
        return riskVal * (oddsNum / 100);
    }
    if (oddsNum < 0) {
        return riskVal / (Math.abs(oddsNum) / 100);
    }
    return null;
}

function normalizeOddsValue(odds) {
    if (!odds && odds !== 0) return '';
    const text = odds.toString().trim();
    if (!text) return '';
    if (!/^[+-]/.test(text) && /^\d/.test(text)) {
        return `+${text}`;
    }
    return text;
}

function normalizeSegmentLabel(segment) {
    const raw = (segment || '').toString().toLowerCase().trim();
    if (raw.includes('1q')) return '1st Quarter';
    if (raw.includes('2q')) return '2nd Quarter';
    if (raw.includes('3q')) return '3rd Quarter';
    if (raw.includes('4q')) return '4th Quarter';
    if (raw.includes('1h') || raw.includes('1st half')) return '1st Half';
    if (raw.includes('2h') || raw.includes('2nd half')) return '2nd Half';
    if (raw.includes('full')) return 'Full Game';
    return 'Full Game';
}

function combinePickDetails(parsedPick, rawPick) {
    const combined = { ...parsedPick };
    const rawType = (rawPick.pickType || '').toString().toLowerCase();
    const rawDirection = (rawPick.pickDirection || rawPick.totalType || '').toString();
    const segmentInput = rawPick.segment || rawPick.period || parsedPick.segment || 'Full Game';

    combined.segment = normalizeSegmentLabel(segmentInput);
    combined.pickTeam = combined.pickTeam || rawPick.pickTeam || rawPick.team || '';
    combined.line = combined.line || rawPick.line || '';
    combined.odds = normalizeOddsValue(combined.odds || rawPick.odds || rawPick.price || '');

    if (!combined.pickDirection && rawDirection) {
        combined.pickDirection = rawDirection.charAt(0).toUpperCase() + rawDirection.slice(1).toLowerCase();
    }

    if (!combined.pickType) {
        if (rawType === 'moneyline' || rawType === 'ml') {
            combined.pickType = 'Moneyline';
        } else if (rawType === 'spread' || rawType === 'ats') {
            combined.pickType = 'Spread';
        } else if (rawType === 'team-total' || rawType === 'tt') {
            combined.pickType = combined.pickDirection ? combined.pickDirection : 'Over';
            combined.isTeamTotal = true;
        } else if (rawType === 'total') {
            combined.pickType = combined.pickDirection ? combined.pickDirection : 'Over';
        }
    }

    if (!combined.pickType && combined.pickDirection) {
        combined.pickType = combined.pickDirection;
    }

    if ((rawType === 'team-total' || rawPick.isTeamTotal) && combined.pickDirection) {
        combined.isTeamTotal = true;
    }

    if (combined.pickType === 'Moneyline' && !combined.odds && combined.line) {
        combined.odds = normalizeOddsValue(combined.line);
        combined.line = '';
    }

    return combined;
}

function formatSignedCurrency(amount) {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    // Keep cents if present, but don't force them
    const formatted = abs.toLocaleString(undefined, {
        minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
    return `${sign}$${formatted}`;
}

function computeHitMissAndProfit(statusClass, riskRaw, winRaw) {
    const normalized = (statusClass || '').toLowerCase();
    const risk = parseMoneyAmount(riskRaw);
    const win = parseMoneyAmount(winRaw);

    if (normalized === 'win' || normalized === 'won') {
        return { key: 'hit', label: 'HIT', amount: win, amountClass: 'profit-positive' };
    }
    if (normalized === 'loss' || normalized === 'lost') {
        return { key: 'miss', label: 'MISS', amount: -risk, amountClass: 'profit-negative' };
    }
    if (normalized === 'push' || normalized === 'tie') {
        return { key: 'push', label: 'PUSH', amount: 0, amountClass: 'profit-neutral' };
    }

    // Pending / live variants
    return { key: 'na', label: '—', amount: null, amountClass: 'profit-neutral' };
}

function buildPickRow(pick, index) {
    /**
     * Create a properly formatted table row matching the EXACT template structure
     */
    const description = pick.description || pick.selection || buildDescriptionFromFields(pick);
    const parsedPick = combinePickDetails(parsePickDescription(description), pick);
    const matchupLabel = pick.game
        || (pick.awayTeam && pick.homeTeam ? `${pick.awayTeam} @ ${pick.homeTeam}`
        : (parsedPick.awayTeam && parsedPick.homeTeam) ? `${parsedPick.awayTeam} @ ${parsedPick.homeTeam}`
        : description);

    const statusMeta = buildStatusMeta({
        status: pick.status,
        result: pick.result,
        score: pick.result,
        matchup: matchupLabel,
        selection: description,
        description,
        parsedPick,
        start: pick.scheduled || pick.start,
        countdown: pick.countdown,
        market: pick.market
    });
    const statusClass = (statusMeta.statusKey || pick.status || 'pending').toLowerCase();
    const isLive = statusClass === 'on-track' || statusClass === 'at-risk' || statusClass === 'live';

    // Determine badge label - show countdown for pending, proper labels for live/final
    let badgeLabel = statusMeta.statusLabel || pick.status || 'Pending';
    if (statusClass === 'pending' && pick.countdown) {
        badgeLabel = pick.countdown;
    } else if (statusClass === 'pending' && pick.scheduled) {
        badgeLabel = `Starts ${pick.scheduled}`;
    }

    // Calculate margin for won/lost picks
    let marginText = null;
    if ((statusClass === 'win' || statusClass === 'lost') && pick.result) {
        marginText = calculatePickMargin(parsedPick, pick.result, pick.game || matchupLabel);
    }

    const statusBadgeMarkup = buildStatusBadgeHTML({
        statusClass,
        label: badgeLabel,
        tooltip: statusMeta.tooltip || getStatusBlurb(pick.status, pick.result) || '',
        info: statusMeta.badgeContext,
        margin: marginText
    });

    // Determine league - intelligently detect from team names
    const leagueFromPick = pick.league || pick.sport || '';
    let league = leagueFromPick ? leagueFromPick.toString().toLowerCase() : '';
    
    if (!league) {
        // Use helper function to detect league from teams
        league = detectLeagueFromTeams(pick.game, awayTeamName, homeTeamName);
    }

    // Normalize league values to match filter dropdown options
    const leagueNormMap = {
        'college': 'ncaaf',
        'cfb': 'ncaaf',
        'college football': 'ncaaf',
        'ncaa football': 'ncaaf',
        'cbb': 'ncaab',
        'college basketball': 'ncaab',
        'ncaa basketball': 'ncaab',
        'ncaam': 'ncaab',
        'ncaab': 'ncaab',
        'ncaa': 'ncaab'
    };
    if (leagueNormMap[league]) {
        league = leagueNormMap[league];
    }

    // Parse teams
    const teamsFromGame = parseTeamsFromGame(pick.game);
    const awayTeamName = pick.awayTeam || teamsFromGame.away || parsedPick.awayTeam || parsedPick.pickTeam || 'TBD';
    const homeTeamName = pick.homeTeam || teamsFromGame.home || '';
    const awayAbbr = getTeamAbbr(awayTeamName);
    const homeAbbr = homeTeamName ? getTeamAbbr(homeTeamName) : '';
    const awayLogo = getTeamLogo(awayTeamName, league);
    const homeLogo = homeTeamName ? getTeamLogo(homeTeamName, league) : '';

    // Determine which team is being picked
    let pickedTeamLogo = awayLogo;
    let pickedTeamAbbr = awayAbbr || (parsedPick.pickType === 'Over' ? 'O' : 'U');
    let pickedTeamName = awayTeamName;

    if (parsedPick.pickTeam) {
        // Match the picked team name to away or home
        const pickTeamLower = parsedPick.pickTeam.toLowerCase();
        const awayLower = awayTeamName.toLowerCase();
        const homeLower = homeTeamName.toLowerCase();

        if (homeLower.includes(pickTeamLower) || pickTeamLower.includes(homeLower)) {
            pickedTeamLogo = homeLogo;
            pickedTeamAbbr = homeAbbr;
            pickedTeamName = homeTeamName;
        }
    } else if (parsedPick.pickType === 'Over' || parsedPick.pickType === 'Under') {
        // For totals, show game icon or both teams - use away for now
        pickedTeamLogo = awayLogo;
        pickedTeamAbbr = parsedPick.pickType.substring(0, 1); // "O" or "U"
    }

    const bookName = normalizeBookName(pick.sportsbook || pick.book || pick.sourceBook || pick.bookKey || pick.source);
    const bookKey = normalizeBookKey(bookName);
    const riskValue = toMoneyValue(pick.risk);
    const winProvided = toMoneyValue(pick.win);
    const derivedWin = winProvided !== null ? winProvided : calculateWinFromOdds(riskValue, parsedPick.odds);
    const riskDisplay = formatCurrencyDisplay(riskValue);
    const winDisplay = formatCurrencyDisplay(derivedWin);
    const dateMeta = normalizeDateTimeParts({
        ...pick,
        gameDate: pick.gameDate || pick.date,
        gameTime: pick.gameTime || pick.time
    });
    const outcome = computeHitMissAndProfit(statusClass, riskValue ?? 0, derivedWin ?? 0);

    const row = document.createElement('tr');
    row.className = `group-start ${isLive ? 'live-game' : ''}`;
    row.dataset.pickIndex = index;

    // Normalize pick type for filters
    let normalizedPickType = 'spread'; // default
    if (parsedPick.pickType) {
        const pt = parsedPick.pickType.toLowerCase();
        if (pt === 'over' || pt === 'under') {
            // Distinguish between team totals and game totals
            normalizedPickType = parsedPick.isTeamTotal ? 'tt' : 'total';
        } else if (pt === 'moneyline') {
            normalizedPickType = 'moneyline';
        } else if (pt === 'spread') {
            normalizedPickType = 'spread';
        }
    }

    // Set all data attributes for filters to work
    row.setAttribute('data-league', league);
    row.setAttribute('data-book', bookKey);
    row.setAttribute('data-status', statusClass);
    row.setAttribute('data-risk', riskValue != null ? String(riskValue).replace(/,/g, '') : '0');
    row.setAttribute('data-win', derivedWin != null ? String(derivedWin).replace(/,/g, '') : '0');
    row.setAttribute('data-away', awayTeamName.toLowerCase());
    row.setAttribute('data-home', homeTeamName ? homeTeamName.toLowerCase() : '');
    row.setAttribute('data-pick-type', normalizedPickType);
    row.setAttribute('data-pick-text', (description || '').toLowerCase());
    row.setAttribute('data-segment', parsedPick.segment.toLowerCase().replace(/\s+/g, '-'));
    row.setAttribute('data-odds', parsedPick.odds || '-110');
    row.setAttribute('data-epoch', dateMeta.epoch);

    // Generate League Logo URL
    let leagueLogoUrl = '';
    if (league === 'nba') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png';
    else if (league === 'nfl') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';
    else if (league === 'mlb') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png';
    else if (league === 'nhl') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png';
    else if (league === 'ncaaf') leagueLogoUrl = 'assets/logo_ncaa_football.png';
    else if (league === 'ncaab') leagueLogoUrl = 'assets/logo_ncaam_bball.png';
    else if (league.includes('college') || league.includes('ncaa')) leagueLogoUrl = 'assets/logo_ncaa_football.png';

    row.innerHTML = `
        <td>
            <div class="datetime-cell">
                <span class="cell-date">${dateMeta.displayDate}</span>
                <span class="cell-time">${dateMeta.displayTime}</span>
                <span class="sportsbook-value">${bookName}</span>
            </div>
        </td>
        <td class="center">
            <div class="league-cell">
                ${leagueLogoUrl ? `<img src="${leagueLogoUrl}" class="league-logo" alt="${league}">` : ''}
                <span class="league-text">${league.replace('college', 'NCAA').toUpperCase()}</span>
            </div>
        </td>
        <td>
            ${homeTeamName
                ? `<div class="matchup-cell">
                        <div class="team-line">
                            <img src="${awayLogo}" class="team-logo" loading="lazy" alt="${awayAbbr}">
                            <div class="team-name-wrapper">
                                <span class="team-name-full">${awayTeamName}</span>
                                <span class="team-record" data-team="${awayAbbr}"></span>
                            </div>
                        </div>
                        <div class="vs-divider">vs</div>
                        <div class="team-line">
                            <img src="${homeLogo}" class="team-logo" loading="lazy" alt="${homeAbbr}">
                            <div class="team-name-wrapper">
                                <span class="team-name-full">${homeTeamName}</span>
                                <span class="team-record" data-team="${homeAbbr}"></span>
                            </div>
                        </div>
                    </div>`
                : `<div class="matchup-cell">
                        <div class="team-line">
                            <img src="${awayLogo}" class="team-logo" loading="lazy" alt="${awayAbbr}">
                            <div class="team-name-wrapper">
                                <span class="team-name-full">${awayTeamName}</span>
                                <span class="team-record" data-team="${awayAbbr}"></span>
                            </div>
                        </div>
                    </div>`}
        </td>
        <td class="center">
            <span class="game-segment">${parsedPick.segment || 'Full Game'}</span>
        </td>
        <td>
            <div class="pick-cell">
                ${generatePickDisplay(parsedPick, pickedTeamLogo, pickedTeamAbbr, pickedTeamName, statusMeta.coverage, statusClass)}
            </div>
        </td>
        <td class="center">
            <span class="currency-combined currency-stacked">
                <span class="currency-risk-row"><span class="risk-amount">${riskDisplay}</span><span class="currency-separator"> /</span></span>
                <span class="win-amount">${winDisplay}</span>
            </span>
        </td>
        <td class="center">
            <div class="compact-boxscore">
                <div class="boxscore-grid">
                    <div class="boxscore-row header">
                        <div class="boxscore-cell header-cell game-time-cell">
                            ${formatGameTimeStatus(statusClass, statusMeta.liveInfo, pick.result, pick.status, pick.countdown, pick.scheduled || pick.start)}
                            ${parsedPick.segment !== 'Full Game' ? `<div style="font-size: 9px; color: rgba(170, 188, 204, 0.9); margin-top: 2px;">${parsedPick.segment}</div>` : ''}
                        </div>
                        <div class="boxscore-cell header-cell">Q1</div>
                        <div class="boxscore-cell header-cell">Q2</div>
                        <div class="boxscore-cell header-cell">Q3</div>
                        <div class="boxscore-cell header-cell">Q4</div>
                        <div class="boxscore-cell header-cell">T</div>
                    </div>
                    ${createBoxScoreRows(
                        pick,
                        awayLogo,
                        awayAbbr,
                        homeLogo || awayLogo,
                        homeAbbr || awayAbbr,
                        statusClass
                    )}
                </div>
            </div>
        </td>
        <td class="center">
            ${statusBadgeMarkup}
        </td>
        <td class="center">
            <span class="hitmiss-badge hitmiss-${outcome.key}">${outcome.label}</span>
        </td>
        <td class="center">
            <div class="won-lost-cell">
                ${outcome.amount === null
                    ? '<span class="profit-amount profit-neutral">—</span>'
                    : `<span class="profit-amount ${outcome.amountClass}">${formatSignedCurrency(outcome.amount)}</span>`
                }
                <button class="delete-pick-btn" data-pick-index="${index}" title="Remove pick">✕</button>
            </div>
        </td>
    `;

    return row;
}

async function loadAndAppendPicks() {
    /**
     * Load picks from API and append them to the table (don't clear existing)
     */
    console.log('[PICKS LOADER] Starting to load picks...');
    try {
        const apiUrl = window.APP_CONFIG?.API_BASE_URL || '/api';
        
        // Check if database sync is enabled (default to false if not specified)
        if (window.APP_CONFIG?.ENABLE_DB_SYNC === false) {
             console.log('[PICKS LOADER] DB sync disabled in config - skipping API fetch');
             return; // Silently exit instead of throwing error
        }

        const response = await fetch(`${apiUrl}/get-picks`);
        console.log('[PICKS LOADER] API response status:', response.status);

        if (!response.ok) {
            console.log('[PICKS LOADER] API not available (expected - using LocalPicksManager). Status:', response.status);
            // 404 is expected when get-picks endpoint doesn't exist
            // Dashboard uses LocalPicksManager for storage instead
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handleParse(e, 'API response');
            }
            return;
        }
        const picks = data.picks || [];
        console.log('[PICKS LOADER] Received picks:', picks.length, picks);

        if (picks.length === 0) {
            console.log('[PICKS LOADER] No picks to load');
            return;
        }

        const tbody = document.getElementById('picks-tbody');
        if (!tbody) {
            console.error('[PICKS LOADER] ERROR: Table body #picks-tbody not found!');
            return;
        }

        console.log('[PICKS LOADER] Found table body, clearing and adding rows...');

        // Clear only if there are picks to show
        // (keeps template examples if no picks loaded)
        tbody.innerHTML = '';

        // Update table container class based on whether we have picks
        const tableContainer = tbody.closest('.table-container');
        if (tableContainer) {
            if (picks && picks.length > 0) {
                tableContainer.classList.add('has-picks');
            } else {
                tableContainer.classList.remove('has-picks');
            }
        }

        // Add each pick as a proper row
        picks.forEach((pick, index) => {
            try {
                const row = buildPickRow(pick, index);
                tbody.appendChild(row);
            } catch (error) {
                console.error(`[PICKS LOADER] ERROR creating row for pick ${index + 1}:`, error);
                console.error('[PICKS LOADER] Pick data:', pick);
            }
        });

        console.log(`[PICKS LOADER] ✓ Successfully loaded ${picks.length} picks from API`);

        // Calculate and update KPIs
        if (typeof calculateKPIs === 'function' && typeof updateKPITiles === 'function') {
            const kpis = calculateKPIs(picks);
            updateKPITiles(kpis);
        }

        // Trigger table update for filters and sorting
        if (typeof updateTable === 'function') {
            updateTable();
        }

        // Trigger filter update if available
        if (typeof updateTableWithFilters === 'function') {
            updateTableWithFilters();
        }

        // Re-apply filter pills if available
        if (window.DashboardFilterPills && typeof window.DashboardFilterPills.applyFilters === 'function') {
            window.DashboardFilterPills.applyFilters();
        }

        // Ensure zebra stripes are applied after DOM is fully updated
        // Use multiple animation frames to ensure all DOM updates and style calculations are complete
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (typeof window.__gbsvApplyZebraStripes === 'function') {
                    window.__gbsvApplyZebraStripes();
                }
            });
        });

        populateTeamRecordsWhenReady(document, { force: false });

        // Refresh filter dropdowns to reflect newly loaded data
        if (typeof populateLeagueDropdown === 'function') {
            populateLeagueDropdown();
        }

    } catch (error) {
        console.log('[PICKS LOADER] API not available, using static HTML picks');
        // Only show error if it's not a network/CORS error (expected in dev)
        if (window.ErrorHandler && !error.message?.includes('Failed to fetch') && !error.message?.includes('CORS')) {
            window.ErrorHandler.handleApi(error, 'Load picks');
        }
    }
}

// Manual loading - call this function when you want to load picks
window.loadLivePicks = loadAndAppendPicks;

async function loadTeamRecords(options = {}) {
    /**
     * Fetch team records from API and populate them
     */
    const { force = false } = options;

    if (teamRecordsPromise && !force) {
        return teamRecordsPromise;
    }

    const loaderPromise = (async () => {
        try {
            // Try to load from API first
            if (window.APP_CONFIG?.API_BASE_URL) {
                // Check if DB sync is enabled
                if (window.APP_CONFIG?.ENABLE_DB_SYNC === false) {
                     // explicit false check to allow undefined to default to true/try
                     // But here we want to default to skip if we know it's missing
                     // Actually, defaulting to skip is safer if we want to avoid 404s
                } else {
                    try {
                        const apiUrl = window.APP_CONFIG.API_BASE_URL;
                        const response = await fetch(`${apiUrl}/team-records`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.records) {
                                const normalized = {};
                                Object.keys(data.records).forEach(key => {
                                    normalized[key.toUpperCase()] = data.records[key];
                                });
                                teamRecordsCache = normalized;
                                if (globalScope) {
                                    globalScope.__TEAM_RECORDS_CACHE__ = normalized;
                                    globalScope.teamRecordsCache = normalized;
                                }
                                populateTeamRecords(document, { force: true });
                                return normalized;
                            }
                        }
                        // 404 is expected when endpoint doesn't exist - just skip
                        console.log('[TEAM RECORDS] API endpoint not available (expected). Team records will use local data. Status:', response.status);
                    } catch (apiError) {
                        console.log('[RECORDS] API not available, trying config file');
                    }
                }
            }

            // Fallback: Load from config file
            try {
                const response = await fetch('assets/data/team-records.json?v=20250101');
                if (response.ok) {
                    const data = await response.json();
                    // Flatten league-specific records
                    const records = {};
                    Object.keys(data).forEach(league => {
                        Object.assign(records, data[league]);
                    });
                    
                    const normalized = {};
                    Object.keys(records).forEach(key => {
                        normalized[key.toUpperCase()] = records[key];
                    });
                    teamRecordsCache = normalized;
                    if (globalScope) {
                        globalScope.__TEAM_RECORDS_CACHE__ = normalized;
                        globalScope.teamRecordsCache = normalized;
                    }
                    populateTeamRecords(document, { force: true });
                    return normalized;
                }
            } catch (fileError) {
                console.warn('[RECORDS] Config file not available:', fileError);
            }

            // Final fallback: Empty records (will be populated by API later)
            console.warn('[RECORDS] No team records available, using empty cache');
            teamRecordsCache = {};
            return {};

        } catch (error) {
            console.warn('[RECORDS] Could not load team records:', error);
            if (window.ErrorHandler) {
                window.ErrorHandler.handleApi(error, 'Load team records');
            }
            throw error;
        }
    })();

    teamRecordsPromise = loaderPromise;
    if (globalScope) {
        globalScope.__TEAM_RECORDS_PROMISE__ = loaderPromise;
    }

    loaderPromise.catch(() => {
        if (teamRecordsPromise === loaderPromise) {
            teamRecordsPromise = null;
            if (globalScope) {
                globalScope.__TEAM_RECORDS_PROMISE__ = null;
            }
        }
    });

    return loaderPromise;
}

/**
 * Load picks from Azure Cosmos DB via PicksService (enterprise-grade storage)
 * Falls back to localStorage if API unavailable
 */
async function loadPicksFromDatabase() {
    try {
        // Check if PicksService is available (enterprise Azure storage)
        if (window.PicksService) {
            console.log('[DB LOADER] Loading picks from Azure Cosmos DB via PicksService...');
            
            // Check if migration from localStorage is needed
            const migrationStatus = window.PicksService.checkMigrationNeeded();
            if (migrationStatus.needed) {
                console.log(`[DB LOADER] Found ${migrationStatus.count} picks in localStorage, migrating to Azure...`);
                const migrationResult = await window.PicksService.migrateFromLocalStorage();
                console.log('[DB LOADER] Migration result:', migrationResult);
            }
            
            // Fetch picks from Azure
            const picks = await window.PicksService.getAll({ limit: 200 });
            
            if (picks && picks.length > 0) {
                console.log(`[DB LOADER] ✅ Loaded ${picks.length} picks from Azure Cosmos DB`);
                
                // Transform picks to match expected format
                return picks.map(pick => ({
                    ...pick,
                    awayLogo: pick.awayLogo || getTeamLogo(pick.awayTeam, pick.sport),
                    homeLogo: pick.homeLogo || getTeamLogo(pick.homeTeam, pick.sport)
                }));
            }
        }
        
        // Fallback: Check legacy API config
        if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
            console.log('[DB LOADER] API not configured, falling back to localStorage');
            return null;
        }

        // Check if database sync is enabled
        if (window.APP_CONFIG?.ENABLE_DB_SYNC === false) {
             console.log('[DB LOADER] DB sync disabled in config - skipping API fetch');
             return null;
        }

        const apiUrl = window.APP_CONFIG.API_BASE_URL;
        const response = await fetch(`${apiUrl}/get-picks?limit=100`);

        if (!response.ok) {
            console.log('[DB LOADER] Legacy API not available, falling back to localStorage. Status:', response.status);
            return null;
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handleParse(e, 'Database response');
            }
            throw e;
        }
        const picks = data.picks || [];

        console.log(`Loaded ${picks.length} picks from legacy database`);

        // Transform picks to match expected format
        return picks.map(pick => ({
            ...pick,
            awayLogo: pick.awayLogo || getTeamLogo(pick.awayTeam, pick.sport),
            homeLogo: pick.homeLogo || getTeamLogo(pick.homeTeam, pick.sport)
        }));
    } catch (error) {
        console.warn('[DB LOADER] Failed to load picks from database:', error);
        if (window.ErrorHandler && !error.message?.includes('Failed to fetch') && !error.message?.includes('CORS')) {
            window.ErrorHandler.handleApi(error, 'Load picks from database');
        }
        return null;
    }
}

function initializePicksAndRecords() {
    // Note: We no longer auto-delete old picks - filtering is done at display time
    // Historical picks are kept for PnL tracking and analytics
    // Use LocalPicksManager.archiveOldPicks() manually to move old settled picks to archive

    // Try to load from database first, then fall back to API/localStorage picks
    // Note: In local development, database/get-picks endpoints may not exist
    // In that case, LocalPicksManager will handle loading from localStorage
    const databasePromise = loadPicksFromDatabase();
    databasePromise.then(dbPicks => {
        if (dbPicks && dbPicks.length > 0) {
            // Use database picks
            console.log('[DASHBOARD] ✅ Using picks from database');
            // Picks are already loaded and displayed by loadPicksFromDatabase
        } else {
            // Fall back to API or localStorage
            console.log('[DASHBOARD] No database picks available, falling back to localStorage (LocalPicksManager)');
            const picksPromise = loadAndAppendPicks();
            if (picksPromise && typeof picksPromise.catch === 'function') {
                picksPromise.catch(error => console.warn('[PICKS LOADER] Initial load encountered an error:', error));
            }
        }
    }).catch(error => {
        // Fall back to API/localStorage on error
        console.warn('[DASHBOARD] Database load failed, trying API/localStorage:', error.message);
        const picksPromise = loadAndAppendPicks();
        if (picksPromise && typeof picksPromise.catch === 'function') {
            picksPromise.catch(error => console.warn('[PICKS LOADER] Initial load encountered an error:', error));
        }
    });
}

/**
 * Auto-load picks AND team records on page load
 * Tries database first, falls back to API/localStorage if available
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Load team records (non-blocking)
        const recordsPromise = loadTeamRecords();
        if (recordsPromise && typeof recordsPromise.catch === 'function') {
            recordsPromise.catch(error => console.warn('[RECORDS] Initial team records load failed:', error));
        }
        
        // Load picks from database/API/localStorage
        initializePicksAndRecords();
        
        // Initialize delete buttons
        initializeDeleteButtons();
    });
} else {
    // Load team records (non-blocking)
    const recordsPromise = loadTeamRecords();
    if (recordsPromise && typeof recordsPromise.catch === 'function') {
        recordsPromise.catch(error => console.warn('[RECORDS] Initial team records load failed:', error));
    }
    
    // Load picks from database/API/localStorage
    initializePicksAndRecords();
    
    // Initialize delete buttons
    initializeDeleteButtons();
}

// Initialize delete button handlers using event delegation
function initializeDeleteButtons() {
    const tbody = document.getElementById('picks-tbody');
    if (!tbody) return;
    
    tbody.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-pick-btn');
        if (!deleteBtn) return;
        
        e.stopPropagation();
        
        const row = deleteBtn.closest('tr');
        if (!row) return;
        
        // Confirm deletion
        if (confirm('Remove this pick from the dashboard?')) {
            const pickIndex = deleteBtn.dataset.pickIndex;
            const pickId = row.dataset.pickId || deleteBtn.dataset.pickId;
            
            // Try PicksService first (Azure Cosmos DB)
            if (window.PicksService && pickId) {
                try {
                    await window.PicksService.remove(pickId);
                    console.log('[PICKS] Deleted pick from Azure:', pickId);
                } catch (error) {
                    console.warn('[PICKS] Failed to delete from Azure, trying localStorage:', error);
                    // Fall back to LocalPicksManager
                    if (window.LocalPicksManager && pickIndex !== undefined) {
                        const picks = window.LocalPicksManager.getAll ? window.LocalPicksManager.getAll() : [];
                        if (picks[pickIndex] && picks[pickIndex].id) {
                            window.LocalPicksManager.delete(picks[pickIndex].id);
                        }
                    }
                }
            } else if (window.LocalPicksManager && pickIndex !== undefined) {
                // Fallback to LocalPicksManager
                const picks = window.LocalPicksManager.getAll ? window.LocalPicksManager.getAll() : [];
                if (picks[pickIndex] && picks[pickIndex].id) {
                    window.LocalPicksManager.delete(picks[pickIndex].id);
                }
            }
            
            // Remove row from DOM
            row.remove();
            console.log('[PICKS] Removed pick from UI:', pickId || pickIndex);
            
            // Update KPI tiles if available
            if (window.KPICalculator && window.KPICalculator.recalculateLiveKPI) {
                window.KPICalculator.recalculateLiveKPI();
            }
        }
    });
    
    console.log('[PICKS] Delete button handlers initialized');
}

if (globalScope) {
    globalScope.loadTeamRecords = loadTeamRecords;
}
