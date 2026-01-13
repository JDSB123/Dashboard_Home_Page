/**
 * WeeklyLineup Azure Function
 * Proxies picks requests to sport-specific Container Apps
 *
 * Routes:
 *   GET /api/weekly-lineup/nba   -> NBA Container App /slate/today/executive
 *   GET /api/weekly-lineup/ncaam -> NCAAM Container App /api/picks/today
 *   GET /api/weekly-lineup/nfl   -> NFL Container App /api/v1/predictions/week/{season}/{week}
 *   GET /api/weekly-lineup/ncaaf -> NCAAF Container App /api/v1/predictions/week/{season}/{week}
 */

const axios = require('axios');

// Container App endpoints (can be overridden via env vars)
const SPORT_ENDPOINTS = {
    nba: {
        baseUrl: process.env.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
        path: (date) => `/slate/${date || 'today'}/executive`
    },
    ncaam: {
        baseUrl: process.env.NCAAM_API_URL || 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
        path: (date) => `/api/picks/${date || 'today'}`
    },
    nfl: {
        baseUrl: process.env.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
        path: (date) => {
            const { season, week } = getNFLSeasonWeek(date);
            return `/api/v1/predictions/week/${season}/${week}`;
        }
    },
    ncaaf: {
        baseUrl: process.env.NCAAF_API_URL || 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
        path: (date) => {
            const { season, week } = getNCAAFSeasonWeek(date);
            return `/api/v1/predictions/week/${season}/${week}`;
        }
    }
};

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
    'https://www.greenbiersportventures.com',
    'https://wittypebble-41c11c65.eastus.azurestaticapps.net',
    'http://localhost:3000',
    'http://localhost:8080'
];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req) {
    const origin = req.headers?.origin;
    const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key',
        'Vary': 'Origin'
    };
}

/**
 * Calculate NFL season and week from date
 */
function getNFLSeasonWeek(date = 'today') {
    let targetDate;

    if (date === 'today') {
        targetDate = new Date();
    } else if (date === 'tomorrow') {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
    } else {
        targetDate = new Date(date);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    // NFL season spans calendar years, starts in September
    let season;
    if (month >= 9) {
        season = year;
    } else {
        season = year - 1;
    }

    // Calculate week (approximate - NFL starts around week 36)
    const startOfSeason = new Date(season, 8, 1); // September 1
    const daysSinceStart = Math.floor((targetDate - startOfSeason) / (24 * 60 * 60 * 1000));
    const week = Math.max(1, Math.min(18, Math.floor(daysSinceStart / 7) + 1));

    return { season, week };
}

/**
 * Calculate NCAAF season and week from date
 */
function getNCAAFSeasonWeek(date = 'today') {
    let targetDate;

    if (date === 'today') {
        targetDate = new Date();
    } else if (date === 'tomorrow') {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
    } else {
        targetDate = new Date(date);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    // NCAAF season runs Aug-Jan
    const season = month >= 8 ? year : year - 1;

    // Calculate week (starts late August)
    const seasonStart = new Date(season, 7, 24); // Aug 24
    const weekNum = Math.max(1, Math.ceil((targetDate - seasonStart) / (7 * 24 * 60 * 60 * 1000)));

    return { season, week: Math.min(weekNum, 15) };
}

/**
 * Normalize response format for frontend consistency
 */
function normalizeResponse(sport, data) {
    const normalized = {
        sport: sport.toUpperCase(),
        date: new Date().toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
        version: data.version || data.model_version || 'unknown'
    };

    // Handle different response formats
    if (data.plays) {
        // NBA format
        // Patch: Ensure awayTeam/homeTeam are set for each pick
        normalized.picks = data.plays.map(pick => {
            let patchedPick = { ...pick };
            // If awayTeam or homeTeam missing or 'Unknown', try to parse from matchup/game string
            if ((!patchedPick.awayTeam || patchedPick.awayTeam === 'Unknown') || (!patchedPick.homeTeam || patchedPick.homeTeam === 'Unknown')) {
                const matchup = patchedPick.matchup || patchedPick.game || '';
                // Try to parse "TeamA @ TeamB" or "TeamA vs TeamB"
                let away = '', home = '';
                const atMatch = matchup.match(/^(.*?)\s*@\s*(.*?)$/);
                const vsMatch = matchup.match(/^(.*?)\s+vs\.?\s+(.*?)$/i);
                if (atMatch) {
                    away = atMatch[1].trim();
                    home = atMatch[2].trim();
                } else if (vsMatch) {
                    away = vsMatch[1].trim();
                    home = vsMatch[2].trim();
                }
                if (away && (!patchedPick.awayTeam || patchedPick.awayTeam === 'Unknown')) patchedPick.awayTeam = away;
                if (home && (!patchedPick.homeTeam || patchedPick.homeTeam === 'Unknown')) patchedPick.homeTeam = home;
            }
            return patchedPick;
        });
        normalized.total_plays = data.total_plays || data.plays.length;
    } else if (data.picks) {
        // NCAAM format
        normalized.picks = data.picks;
        normalized.total_plays = data.total_picks || data.picks.length;
    } else if (data.predictions) {
        // NFL/NCAAF format
        normalized.picks = data.predictions;
        normalized.total_plays = data.count || data.predictions.length;
    } else if (Array.isArray(data)) {
        normalized.picks = data;
        normalized.total_plays = data.length;
    } else {
        normalized.picks = [];
        normalized.total_plays = 0;
    }

    // Copy over summary if present
    if (data.summary) {
        normalized.summary = data.summary;
    }

    return normalized;
}

module.exports = async function (context, req) {
    const sport = (req.params.sport || '').toLowerCase();
    const date = req.query.date || 'today';
    const corsHeaders = buildCorsHeaders(req);

    context.log(`WeeklyLineup request: sport=${sport}, date=${date}`);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    // Validate sport
    if (!sport || !SPORT_ENDPOINTS[sport]) {
        context.res = {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            body: {
                error: 'Invalid sport',
                message: `Valid sports: ${Object.keys(SPORT_ENDPOINTS).join(', ')}`,
                sport: sport || 'none'
            }
        };
        return;
    }

    const endpoint = SPORT_ENDPOINTS[sport];
    const url = `${endpoint.baseUrl}${endpoint.path(date)}`;

    context.log(`Proxying to: ${url}`);

    try {
        const response = await axios.get(url, {
            timeout: 30000, // 30 second timeout
            headers: {
                'Accept': 'application/json'
            }
        });

        const normalizedData = normalizeResponse(sport, response.data);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            body: normalizedData
        };

    } catch (error) {
        context.log.error(`WeeklyLineup error for ${sport}:`, error.message);

        // NFL fallback: try Scoreboard proxy if main endpoint fails
        if (sport === 'nfl') {
            try {
                // Use Scoreboard proxy for NFL scores/picks
                const scoreboardUrl = `${process.env.SCOREBOARD_API_URL || 'https://gbsv-orchestrator.azurewebsites.net/api/scoreboard/nfl'}?date=${date}`;
                context.log(`[WeeklyLineup] NFL fallback to Scoreboard: ${scoreboardUrl}`);
                const scoreboardResp = await axios.get(scoreboardUrl, { timeout: 20000 });
                // Transform scoreboard data to picks format
                const picks = Array.isArray(scoreboardResp.data) ? scoreboardResp.data.map(game => ({
                    league: 'NFL',
                    sport: 'NFL',
                    game: `${game.AwayTeam} @ ${game.HomeTeam}`,
                    awayTeam: game.AwayTeam,
                    homeTeam: game.HomeTeam,
                    gameDate: game.Day,
                    gameTime: game.DateTime,
                    status: game.Status,
                    segment: 'Full Game',
                    result: '',
                    model: '',
                    source: 'scoreboard',
                    // Add more fields as needed
                })) : [];
                const normalizedData = {
                    sport: 'NFL',
                    date,
                    generated_at: new Date().toISOString(),
                    version: 'scoreboard-fallback',
                    picks,
                    total_plays: picks.length
                };
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    body: normalizedData
                };
                return;
            } catch (fallbackErr) {
                context.log.error(`[WeeklyLineup] NFL fallback failed:`, fallbackErr.message);
                // Continue to error response below
            }
        }
        // ...existing error handling code...
        let status = 500;
        let errorBody = {
            error: 'Failed to fetch picks',
            sport: sport.toUpperCase(),
            details: error.message
        };

        if (error.response) {
            status = error.response.status;
            errorBody.upstream_status = error.response.status;
            errorBody.upstream_message = error.response.data?.error || error.response.statusText;
        } else if (error.code === 'ECONNABORTED') {
            status = 504;
            errorBody.error = 'Request timed out';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            status = 503;
            errorBody.error = 'Service unavailable';
        }

        context.res = {
            status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            body: errorBody
        };
    }
};
