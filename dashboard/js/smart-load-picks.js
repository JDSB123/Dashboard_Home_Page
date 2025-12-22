/**
 * Smart Picks Loader
 * Properly formats picks to match the dashboard template structure
 */

// Team abbreviation to full name mapping
const teamMap = {
    'raiders': { full: 'Las Vegas Raiders', abbr: 'LV', logo: 'lv' },
    'broncos': { full: 'Denver Broncos', abbr: 'DEN', logo: 'den' },
    'suns': { full: 'Phoenix Suns', abbr: 'PHX', logo: 'phx', league: 'nba' },
    'clippers': { full: 'Los Angeles Clippers', abbr: 'LAC', logo: 'lac', league: 'nba' },
    'georgia southern': { full: 'Georgia Southern', abbr: 'GASO', logo: 'gaso', league: 'college' },
    'appalachian st': { full: 'Appalachian State', abbr: 'APP', logo: 'app', league: 'college' },
    'utsa': { full: 'UTSA', abbr: 'UTSA', logo: 'utsa', league: 'college' },
    'south florida': { full: 'South Florida', abbr: 'USF', logo: 'usf', league: 'college' }
};

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
        'unc': '153'
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

function generatePickDisplay(parsedPick, teamLogo, teamAbbr, teamName) {
    /**
     * Generate pick display based on pick type
     * - Game Total: "Total O/U 51 (-110)"
     * - Team Total: Logo + "Raiders O 15 (-125)"
     * - Moneyline: Logo + "Raiders (-125)"
     * - Spread: Logo + "Raiders +2.7 (-110)"
     */

    // Game Total (O/U) - NO logo, clean line: "Over 51.5 (−110)" (no redundant "Total" prefix)
    if ((parsedPick.pickType === 'Over' || parsedPick.pickType === 'Under') && !parsedPick.isTeamTotal) {
        return `
            <div class="pick-details">
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

    if (Array.isArray(payload.legs) && payload.legs.length && (!liveInfo || (!liveInfo.scoreboardText && !liveInfo.phaseLabel))) {
        const totals = payload.legs.reduce((acc, leg) => {
            const key = (leg.status || '').toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const totalLegs = payload.legs.length;
        const finished = (totals.win || 0) + (totals.lost || totals.loss || 0) + (totals.push || 0);
        const liveLegs = (totals['on-track'] || 0) + (totals['at-risk'] || 0) + (totals.live || 0);
        // Concise parlay summary: just show completion status
        if (finished) {
            parts.push(`${finished}/${totalLegs} complete`);
        } else if (liveLegs) {
            parts.push(`${liveLegs} live`);
        } else if (totals.pending) {
            parts.push(`${totals.pending} pending`);
        }
    }

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

function buildStatusBadgeHTML({ statusClass, label, tooltip, info, extraClass = '' }) {
    const safeStatus = escapeHtmlForStatus(statusClass || 'pending');
    const safeLabel = escapeHtmlForStatus(label || '');
    const safeTooltip = tooltip ? escapeHtmlForStatus(tooltip) : '';
    const safeInfo = info ? escapeHtmlForStatus(info) : '';
    
    // Only include info if it's meaningful (has wins or losses, not just "0W-0L-XP")
    const hasWinOrLoss = safeInfo && /(^|[^\d])([1-9]\d*)W|(^|[^\d])([1-9]\d*)L/.test(safeInfo);
    const shouldShowInfo = safeInfo && hasWinOrLoss;
    
    const tooltipAttr = safeTooltip ? ` data-blurb="${safeTooltip}"` : '';
    const infoAttr = shouldShowInfo ? ` data-status-info="${safeInfo}"` : '';
    // Note: status-badge-info span removed - info is now shown in tooltip via data-status-info
    const extraClassValue = extraClass ? ` ${extraClass}` : '';
    return `<span class="status-badge${extraClassValue}" data-status="${safeStatus}"${tooltipAttr}${infoAttr}>${safeLabel}</span>`;
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

function createParlayLegsRow(pick, rowId) {
    /**
     * Create the parlay legs expansion row with improved table layout.
     * Cleaner and more intuitive than the original complex structure.
     */
    const legsRow = document.createElement('tr');
    legsRow.className = 'parlay-legs';
    legsRow.setAttribute('data-parent-id', rowId);
    legsRow.setAttribute('data-preserve', 'true');
    legsRow.setAttribute('aria-labelledby', rowId);
    legsRow.setAttribute('role', 'region');
    legsRow.setAttribute('aria-label', 'Parlay legs details');
    legsRow.style.display = 'none'; // Initially hidden

    const legs = pick.legs || [];
    const totalLegs = legs.length;
    const liveLegsCount = legs.filter(leg => {
        const normalized = (leg.status || '').toLowerCase();
        return normalized === 'live' || normalized === 'on-track' || normalized === 'at-risk';
    }).length;
    const legsRowId = `${rowId || `parlay-${Date.now()}`}-legs`;

    const legsHTML = legs.map((leg, legIndex) => {
        const description = leg.description || '';
        const legParsed = parsePickDescription(description);
        const legTeams = parseTeamsFromGame(leg.game || '');
        const legAwayAbbr = getTeamAbbr(legTeams.away);
        const legHomeAbbr = getTeamAbbr(legTeams.home);

        // Default to NFL logos for now; function handles mapping for other leagues
        const legAwayLogo = getTeamLogo(legTeams.away, 'nfl');
        const legHomeLogo = getTeamLogo(legTeams.home, 'nfl');

        const statusMeta = buildStatusMeta({
            status: leg.status || 'pending',
            result: leg.score || leg.result,
            score: leg.score || leg.result,
            matchup: leg.matchup || leg.game,
            selection: leg.selection,
            description: leg.description,
            parsedPick: legParsed,
            market: leg.market,
            start: leg.start || leg.countdown
        });

        const legStatusClass = (leg.status || 'pending').toLowerCase();
        const derivedStatus = (statusMeta.statusKey || legStatusClass || 'pending').toLowerCase();
        const isLiveLeg = derivedStatus === 'on-track' || derivedStatus === 'at-risk';
        const statusTooltipText = statusMeta.tooltip || getStatusBlurb(leg.status || '', leg.result || '') || '';
        const legBadgeMarkup = buildStatusBadgeHTML({
            statusClass: derivedStatus,
            label: statusMeta.statusLabel || leg.status || 'Pending',
            tooltip: statusTooltipText,
            info: statusMeta.badgeContext,
            extraClass: isLiveLeg ? 'live-pulsing' : ''
        });

        // Determine which team is picked for logo emphasis
        let pickedTeamLogo = legAwayLogo;
        let pickedTeamAbbr = legAwayAbbr;
        let pickedTeamName = legTeams.away;
        if (legParsed.pickTeam) {
            const pickTeamLower = legParsed.pickTeam.toLowerCase();
            const homeLower = (legTeams.home || '').toLowerCase();
            if (homeLower.includes(pickTeamLower) || pickTeamLower.includes(homeLower)) {
                pickedTeamLogo = legHomeLogo;
                pickedTeamAbbr = legHomeAbbr;
                pickedTeamName = legTeams.home;
            }
        } else if (legParsed.pickType === 'Over' || legParsed.pickType === 'Under') {
            pickedTeamAbbr = legParsed.pickType.substring(0, 1); // "O" or "U"
        }

        return `
            <tr class="parlay-leg-row ${isLiveLeg ? 'live-game' : ''}" data-pick-type="${legParsed.pickType?.toLowerCase() || 'unknown'}" data-pick-text="${description.toLowerCase()}" data-segment="${leg.segment?.toLowerCase().replace(/\s+/g, '-') || 'full'}" data-odds="${legParsed.odds || '-110'}" data-away="${legTeams.away.toLowerCase()}" data-home="${legTeams.home.toLowerCase()}">
                <td class="leg-number-cell">
                    <div class="leg-number-badge">
                        <span class="leg-label">Leg</span>
                        <span class="leg-value">${legIndex + 1}</span>
                    </div>
                </td>
                <td>
                    <div class="matchup-cell-parlay-leg">
                        <img src="${legAwayLogo}" class="team-logo" loading="lazy" alt="${legAwayAbbr}">
                        <span class="team-name">${legTeams.away}</span>
                        <span class="vs-divider">vs</span>
                        <img src="${legHomeLogo}" class="team-logo" loading="lazy" alt="${legHomeAbbr}">
                        <span class="team-name">${legTeams.home}</span>
                    </div>
                </td>
                <td>
                    <div class="pick-cell-leg">
                        <div class="pick-type">${legParsed.pickType || 'Pick'}</div>
                        <div class="pick-details">${generatePickDisplay(legParsed, pickedTeamLogo, pickedTeamAbbr, pickedTeamName)}</div>
                        <div class="pick-odds">${legParsed.odds || '-110'}</div>
                    </div>
                </td>
                <td class="center">
                    <span class="game-segment">${leg.segment || 'Full'}</span>
                </td>
                <td class="center">
                    ${legBadgeMarkup}
                </td>
            </tr>
        `;
    }).join('');

    legsRow.id = legsRowId;

    legsRow.innerHTML = `
        <td colspan="7">
            <div class="parlay-legs-container">
                <div class="parlay-legs-header">
                    <div class="parlay-legs-title">
                        <span class="parlay-legs-heading">Parlay Legs</span>
                        <span class="parlay-legs-subtitle">${totalLegs} Leg${totalLegs === 1 ? '' : 's'}${liveLegsCount > 0 ? ` • ${liveLegsCount} Live` : ''}</span>
                    </div>
                    <div class="parlay-legs-hint">Collapse when done</div>
                </div>
                <table class="picks-table compact-leg-table parlay-legs-table">
                    <thead class="parlay-legs-table-header">
                        <tr>
                            <th class="leg-number-header">#</th>
                            <th>Matchup</th>
                            <th>Pick</th>
                            <th>Segment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${legsHTML}
                    </tbody>
                </table>
            </div>
        </td>
    `;

    return legsRow;
}

function createParlayRow(pick, index) {
    /**
     * Create a parlay parent row
     */
    const legs = pick.legs || [];
    const statusMeta = buildStatusMeta({
        status: pick.status,
        result: pick.result,
        score: pick.result,
        selection: pick.description,
        description: pick.description,
        matchup: pick.game,
        legs,
        start: pick.scheduled,
        market: pick.market
    });
    const statusClass = (statusMeta.statusKey || pick.status || 'pending').toLowerCase();
    const parlayBadgeMarkup = buildStatusBadgeHTML({
        statusClass,
        label: statusMeta.statusLabel || pick.status || 'Pending',
        tooltip: statusMeta.tooltip || getStatusBlurb(pick.status, pick.result) || '',
        info: statusMeta.badgeContext
    });
    const rowId = `parlay-${index}-${Date.now()}`;
    const legCount = legs.length;
    const liveLegs = legs.filter(leg => {
        const normalized = (leg.status || '').toLowerCase();
        return normalized === 'live' || normalized === 'on-track' || normalized === 'at-risk';
    }).length;

    // Extract odds from description (e.g., "3-Leg Parlay (+600)")
    const oddsMatch = pick.description.match(/\(([+\-]\d+)\)/);
    const odds = oddsMatch ? oddsMatch[1] : '+100';

    const row = document.createElement('tr');
    row.className = 'parlay-row group-start';
    row.id = rowId;
    row.setAttribute('data-row-id', rowId);
    row.setAttribute('data-league', 'multi');
    row.setAttribute('data-book', pick.sportsbook || 'bombay 711');
    row.setAttribute('data-status', statusClass);
    row.setAttribute('data-risk', pick.risk.replace(/,/g, ''));
    row.setAttribute('data-win', pick.win.replace(/,/g, ''));
    row.setAttribute('data-pick-type', 'parlay');
    row.setAttribute('data-pick-text', pick.description.toLowerCase());
    row.setAttribute('data-segment', 'full-game');
    row.setAttribute('data-odds', odds.replace('+', '').replace('-', ''));
    row.setAttribute('data-epoch', new Date(pick.scheduled || pick.accepted).getTime());
    // Store parlay legs data for expansion
    row.setAttribute('data-parlay-legs', JSON.stringify(legs));
    // Keep inline handler for legacy flows while manager handles delegated clicks
    row.setAttribute('onclick', 'toggleParlay(this)');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('aria-label', `${legCount}-game parlay, click to expand details`);
    row.setAttribute('aria-controls', `${rowId}-legs`);

    // Determine live count display
    let liveCountText = '';
    if (liveLegs > 0) {
        if (liveLegs === legCount) {
            liveCountText = `<span class="live-count pulsating">${liveLegs === 2 ? 'Both' : 'All'} Live</span>`;
        } else {
            liveCountText = `<span class="live-count pulsating">${liveLegs} Live</span>`;
        }
    }

    // Create leg snippets for the boxscore column
    const legSnippets = legs.slice(0, 3).map((leg, i) => {
        const legTeams = parseTeamsFromGame(leg.game);
        const legAwayLogo = getTeamLogo(legTeams.away, 'nfl');
        const legResult = leg.result || '';
        const scores = legResult.match(/(\d+)/g) || ['0', '0'];
        return `
            <div class="leg-snippet">
                <span class="leg-num">LEG ${i + 1}</span>
                <div class="score-display">
                    <img src="${legAwayLogo}" class="team-logo-small" loading="lazy" alt="${getTeamAbbr(legTeams.away)}">
                    <span>${scores[0] || '0'}</span>
                    <span class="score-sep">-</span>
                    <span>${scores[1] || '0'}</span>
                </div>
            </div>
        `;
    }).join('');

    const collapsedLegSummary = legs.length
        ? legs.map((_, idx) => `Leg ${idx + 1}`).slice(0, 4).join(' • ') + (legs.length > 4 ? ` • +${legs.length - 4}` : '')
        : '';

    row.innerHTML = `
        <td>
            <div class="datetime-cell parlay-trigger">
                <span class="parlay-toggle-icon">▶</span>
                <span class="date-value">${pick.accepted || 'Nov 7, 2025'}</span>
                <span class="time-value">Multi-Leg</span>
                <span class="sportsbook-value">${pick.sportsbook || 'Bombay 711'}</span>
            </div>
        </td>
        <td>
            <div class="matchup-cell">
                <span class="parlay-info">
                    <span class="game-count">${legCount} Games</span>${liveCountText ? ' • ' + liveCountText : ''}
                    ${collapsedLegSummary ? `<span class="parlay-leg-summary">${collapsedLegSummary}</span>` : ''}
                </span>
            </div>
        </td>
        <td>
            <div class="pick-cell">
                <div class="pick-details">
                    <span class="pick-type">${pick.description.split('(')[0].trim()}</span>
                    <span class="pick-odds">(${odds})</span>
                </div>
            </div>
        </td>
        <td class="center">
            <span class="game-segment">Multi</span>
        </td>
        <td class="center">
            <span class="currency-combined">
                <span class="currency-line">
                    <span class="risk-label">$ At Risk</span>
                    <span class="risk-amount">$${pick.risk}</span>
                </span>
                <span class="currency-line">
                    <span class="win-label">To Win</span>
                    <span class="win-amount">$${pick.win}</span>
                </span>
            </span>
        </td>
        <td class="center">
            <div class="multi-game-summary">
                ${legSnippets}
            </div>
        </td>
        <td class="center">
            ${parlayBadgeMarkup}
        </td>
    `;

    return row;
}

function buildPickRow(pick, index) {
    /**
     * Create a properly formatted table row matching the EXACT template structure
     * Handles both regular picks and parlays
     */

    // Check if this is a parlay
    if (pick.is_parlay) {
        return createParlayRow(pick, index);
    }

    const parsedPick = parsePickDescription(pick.description);
    const statusMeta = buildStatusMeta({
        status: pick.status,
        result: pick.result,
        score: pick.result,
        matchup: pick.game,
        selection: pick.description,
        description: pick.description,
        parsedPick,
        start: pick.scheduled,
        market: pick.market
    });
    const statusClass = (statusMeta.statusKey || pick.status || 'pending').toLowerCase();
    const isLive = statusClass === 'on-track' || statusClass === 'at-risk' || statusClass === 'live';
    const statusBadgeMarkup = buildStatusBadgeHTML({
        statusClass,
        label: statusMeta.statusLabel || pick.status || 'Pending',
        tooltip: statusMeta.tooltip || getStatusBlurb(pick.status, pick.result) || '',
        info: statusMeta.badgeContext
    });

    // Determine league
    let league = 'nfl';
    if (pick.sport) {
        league = pick.sport.toLowerCase();
    } else if (pick.game && (pick.game.includes('Suns') || pick.game.includes('Clippers'))) {
        league = 'nba';
    } else if (pick.game && (pick.game.includes('Georgia') || pick.game.includes('UTSA') || pick.game.includes('Appalachian'))) {
        league = 'college';
    }

    // Parse teams
    const teams = parseTeamsFromGame(pick.game);
    const awayAbbr = getTeamAbbr(teams.away);
    const homeAbbr = getTeamAbbr(teams.home);
    const awayLogo = getTeamLogo(teams.away, league);
    const homeLogo = getTeamLogo(teams.home, league);

    // Determine which team is being picked
    let pickedTeamLogo = awayLogo;
    let pickedTeamAbbr = awayAbbr;
    let pickedTeamName = teams.away;

    if (parsedPick.pickTeam) {
        // Match the picked team name to away or home
        const pickTeamLower = parsedPick.pickTeam.toLowerCase();
        const awayLower = teams.away.toLowerCase();
        const homeLower = teams.home.toLowerCase();

        if (homeLower.includes(pickTeamLower) || pickTeamLower.includes(homeLower)) {
            pickedTeamLogo = homeLogo;
            pickedTeamAbbr = homeAbbr;
            pickedTeamName = teams.home;
        }
    } else if (parsedPick.pickType === 'Over' || parsedPick.pickType === 'Under') {
        // For totals, show game icon or both teams - use away for now
        pickedTeamLogo = awayLogo;
        pickedTeamAbbr = parsedPick.pickType.substring(0, 1); // "O" or "U"
    }

    const row = document.createElement('tr');
    row.className = `group-start ${isLive ? 'live-game' : ''}`;

    // Normalize pick type for filters
    let normalizedPickType = 'spread'; // default
    if (parsedPick.pickType) {
        const pt = parsedPick.pickType.toLowerCase();
        if (pt === 'over' || pt === 'under') {
            normalizedPickType = 'total';
        } else if (pt === 'moneyline') {
            normalizedPickType = 'moneyline';
        } else if (pt === 'spread') {
            normalizedPickType = 'spread';
        }
    }

    // Set all data attributes for filters to work
    row.setAttribute('data-league', league);
    row.setAttribute('data-book', 'hulk wager');
    row.setAttribute('data-status', statusClass);
    row.setAttribute('data-risk', pick.risk.replace(/,/g, ''));
    row.setAttribute('data-win', pick.win.replace(/,/g, ''));
    row.setAttribute('data-away', teams.away.toLowerCase());
    row.setAttribute('data-home', teams.home.toLowerCase());
    row.setAttribute('data-pick-type', normalizedPickType);
    row.setAttribute('data-pick-text', pick.description.toLowerCase());
    row.setAttribute('data-segment', parsedPick.segment.toLowerCase().replace(/\s+/g, '-'));
    row.setAttribute('data-odds', parsedPick.odds || '-110');
    row.setAttribute('data-epoch', new Date(pick.scheduled || pick.accepted).getTime());

    // Generate League Logo URL
    let leagueLogoUrl = '';
    if (league === 'nba') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png';
    else if (league === 'nfl') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';
    else if (league === 'mlb') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png';
    else if (league === 'nhl') leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png';
    else if (league.includes('college') || league.includes('ncaa')) leagueLogoUrl = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';

    row.innerHTML = `
        <td>
            <div class="datetime-cell">
                <span class="cell-date">${pick.accepted || 'Nov 6, 2025'}</span>
                <span class="cell-time">${pick.scheduled ? pick.scheduled.split(' ').slice(-2).join(' ') : ''}</span>
                <span class="sportsbook-value">Hulk Wager</span>
            </div>
        </td>
        <td class="center">
            <div class="league-cell">
                ${leagueLogoUrl ? `<img src="${leagueLogoUrl}" class="league-logo" alt="${league}">` : ''}
                <span class="league-text">${league.replace('college', 'NCAA').toUpperCase()}</span>
            </div>
        </td>
        <td>
            <div class="matchup-cell">
                <div class="team-line">
                    <img src="${awayLogo}" class="team-logo" loading="lazy" alt="${awayAbbr}">
                    <div class="team-name-wrapper">
                        <span class="team-name-full">${teams.away}</span>
                        <span class="team-record" data-team="${awayAbbr}"></span>
                    </div>
                </div>
                <div class="vs-divider">vs</div>
                <div class="team-line">
                    <img src="${homeLogo}" class="team-logo" loading="lazy" alt="${homeAbbr}">
                    <div class="team-name-wrapper">
                        <span class="team-name-full">${teams.home}</span>
                        <span class="team-record" data-team="${homeAbbr}"></span>
                    </div>
                </div>
            </div>
        </td>
        <td>
            <div class="pick-cell">
                ${generatePickDisplay(parsedPick, pickedTeamLogo, pickedTeamAbbr, pickedTeamName)}
            </div>
        </td>
        <td class="center">
            <span class="game-segment">${parsedPick.segment || 'Full Game'}</span>
        </td>
        <td class="center">
            <span class="currency-combined">
                <span class="currency-line">
                    <span class="risk-label">$ At Risk</span>
                    <span class="risk-amount">$${pick.risk}</span>
                </span>
                <span class="currency-line">
                    <span class="win-label">To Win</span>
                    <span class="win-amount">$${pick.win}</span>
                </span>
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
                    ${createBoxScoreRows(pick, awayLogo, awayAbbr, homeLogo, homeAbbr, statusClass)}
                </div>
            </div>
        </td>
        <td class="center">
            ${statusBadgeMarkup}
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
        const response = await fetch(`${apiUrl}/get-picks`);
        console.log('[PICKS LOADER] API response status:', response.status);

        if (!response.ok) {
            console.log('[PICKS LOADER] API not available, using static HTML picks');
            return;
        }

        const data = await response.json();
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
                console.log(`[PICKS LOADER] Creating row ${index + 1} for:`, pick.description);
                const row = buildPickRow(pick, index);
                tbody.appendChild(row);

                // If it's a parlay, also append the legs row (expanded details)
                if (pick.is_parlay) {
                    const rowId = row.getAttribute('data-row-id');
                    const legsRow = createParlayLegsRow(pick, rowId);
                    tbody.appendChild(legsRow);
                    console.log(`[PICKS LOADER] Added parlay legs row for: ${pick.description}`);
                }
            } catch (error) {
                console.error(`[PICKS LOADER] ERROR creating row for pick ${index + 1}:`, error);
                console.error('[PICKS LOADER] Pick data:', pick);
            }
        });

        console.log(`[PICKS LOADER] ✓ Successfully loaded ${picks.length} picks from API`);

        if (window.PicksParlayManager) {
            if (typeof window.PicksParlayManager.reinitParlays === 'function') {
                window.PicksParlayManager.reinitParlays();
            } else if (typeof window.PicksParlayManager.initParlays === 'function') {
                window.PicksParlayManager.initParlays();
            }
        }

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
        // Silently fail - this is expected when viewing static HTML without Flask server
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
            // Hardcoded records for now - will fetch from API later
            const records = {
                'ARI': '5-5',
                'ATL': '6-4',
                'BAL': '7-3',
                'BUF': '8-2',
                'CAR': '3-7',
                'CHI': '4-6',
                'CIN': '5-5',
                'CLE': '3-7',
                'DAL': '7-3',
                'DEN': '5-4',
                'DET': '9-1',
                'GB': '6-4',
                'HOU': '7-3',
                'IND': '6-4',
                'JAX': '2-8',
                'KC': '9-1',
                'LAC': '6-4',
                'LAR': '5-5',
                'LV': '2-6',
                'MIA': '6-4',
                'MIN': '6-4',
                'NE': '2-8',
                'NO': '5-5',
                'NYG': '3-7',
                'NYJ': '4-6',
                'PHI': '9-1',
                'PIT': '6-4',
                'SEA': '5-5',
                'SF': '7-3',
                'TB': '5-5',
                'TEN': '3-7',
                'WAS': '6-4',
                'PHX': '8-1',
                'LAC': '6-4',
                'GASO': '6-3',
                'APP': '5-4',
                'UTSA': '3-6',
                'USF': '4-5'
            };

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
        } catch (error) {
            console.warn('[RECORDS] Could not load team records:', error);
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
 * Load picks from database
 */
async function loadPicksFromDatabase() {
    try {
        // Check if API is available
        if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
            console.warn('API not configured, using local picks');
            return null;
        }

        const apiUrl = window.APP_CONFIG.API_BASE_URL;
        const response = await fetch(`${apiUrl}/get-picks?limit=100`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const picks = data.picks || [];

        console.log(`Loaded ${picks.length} picks from database`);

        // Transform picks to match expected format
        return picks.map(pick => ({
            ...pick,
            awayLogo: pick.awayLogo || getTeamLogo(pick.awayTeam, pick.sport),
            homeLogo: pick.homeLogo || getTeamLogo(pick.homeTeam, pick.sport)
        }));
    } catch (error) {
        console.warn('Failed to load picks from database:', error);
        return null;
    }
}

function initializePicksAndRecords() {
    const recordsPromise = loadTeamRecords();
    if (recordsPromise && typeof recordsPromise.catch === 'function') {
        recordsPromise.catch(error => console.warn('[RECORDS] Initial team records load failed:', error));
    }

    // Try to load from database first, then fall back to uploaded picks
    const databasePromise = loadPicksFromDatabase();
    databasePromise.then(dbPicks => {
        if (dbPicks && dbPicks.length > 0) {
            // Use database picks
            console.log('Using picks from database');
            // Process and display picks
            // TODO: Add logic to append picks to table
        } else {
            // Fall back to uploaded picks
            const picksPromise = loadAndAppendPicks();
            if (picksPromise && typeof picksPromise.catch === 'function') {
                picksPromise.catch(error => console.warn('[PICKS LOADER] Initial load encountered an error:', error));
            }
        }
    }).catch(error => {
        // Fall back to uploaded picks on error
        console.warn('Database load failed, using uploaded picks:', error);
        const picksPromise = loadAndAppendPicks();
        if (picksPromise && typeof picksPromise.catch === 'function') {
            picksPromise.catch(error => console.warn('[PICKS LOADER] Initial load encountered an error:', error));
        }
    });
}

// Auto-load picks on page load - DISABLED while using picks-loader.js for Azure Blob Storage
// Uncomment when database API is configured in config.production.js
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initializePicksAndRecords);
// } else {
//     initializePicksAndRecords();
// }

// Only load team records (not picks) on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const recordsPromise = loadTeamRecords();
        if (recordsPromise && typeof recordsPromise.catch === 'function') {
            recordsPromise.catch(error => console.warn('[RECORDS] Initial team records load failed:', error));
        }
    });
} else {
    const recordsPromise = loadTeamRecords();
    if (recordsPromise && typeof recordsPromise.catch === 'function') {
        recordsPromise.catch(error => console.warn('[RECORDS] Initial team records load failed:', error));
    }
}

if (globalScope) {
    globalScope.loadTeamRecords = loadTeamRecords;
    globalScope.createParlayLegsRow = createParlayLegsRow;
    globalScope.createParlayRow = createParlayRow;
}