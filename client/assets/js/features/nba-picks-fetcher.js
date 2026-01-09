/**
 * NBA Picks Fetcher v1.1
 * Fetches NBA model picks from Azure Function App (primary) or Container App (fallback)
 * 
 * Primary: nba-picks-trigger Function App (/api/weekly-lineup/nba)
 * Fallback: nba-gbsv-api Container App (/slate/{date}/executive)
 */

(function() {
    'use strict';

    // Primary: Function App for Weekly Lineup picks
    const NBA_FUNCTION_URL = window.APP_CONFIG?.NBA_FUNCTION_URL || 'https://nba-picks-trigger.azurewebsites.net';
    // Fallback: Container App for model API
    const NBA_API_URL = window.APP_CONFIG?.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    let lastSource = null; // Track which source was used
    const CACHE_DURATION = 60000; // 1 minute
    const REQUEST_TIMEOUT = 60000; // 60 seconds (Increased for cold starts)

    /**
     * Fetch with timeout
     */
    async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs}ms`);
            }
            throw error;
        }
    }

    const getApiUrl = () => window.APP_CONFIG?.NBA_API_URL || DEFAULT_NBA_API_URL;

    const getCacheKey = (date) => (date || 'today').toString().trim().toLowerCase() || 'today';

    const extractCardDataJsonFromHtml = (html) => {
        if (!html || typeof html !== 'string') return null;

        // The HTML page embeds a JSON object: `const cardData = {...};`
        // We can't rely on regex alone due to nested braces; extract by balancing braces.
        const marker = 'const cardData';
        const markerIndex = html.indexOf(marker);
        if (markerIndex < 0) return null;

        const afterMarker = html.slice(markerIndex);
        const equalsIndex = afterMarker.indexOf('=');
        if (equalsIndex < 0) return null;

        const braceStart = afterMarker.indexOf('{', equalsIndex);
        if (braceStart < 0) return null;

        const start = markerIndex + braceStart;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = start; i < html.length; i++) {
            const ch = html[i];

            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === '\\\\') {
                    escape = true;
                } else if (ch === '\"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '\"') {
                inString = true;
                continue;
            }

            if (ch === '{') depth += 1;
            else if (ch === '}') {
                depth -= 1;
                if (depth === 0) {
                    const jsonText = html.slice(start, i + 1);
                    try {
                        return JSON.parse(jsonText);
                    } catch (e) {
                        console.warn('[NBA-PICKS] Unable to parse cardData JSON from /picks/html:', e.message);
                        return null;
                    }
                }
            }
        }

        return null;
    };

    const parseExecutivePlaysFromCardData = (cardData) => {
        const body = Array.isArray(cardData?.body) ? cardData.body : [];
        const table = body.find((item) => item && item.type === 'Table' && Array.isArray(item.rows));
        const rows = Array.isArray(table?.rows) ? table.rows : [];

        // First row is header; subsequent rows contain pick data.
        const dataRows = rows.slice(1);
        const plays = [];

        dataRows.forEach((row) => {
            const cells = Array.isArray(row?.cells) ? row.cells : [];
            const period = (cells[0]?.text ?? '').toString().trim();      // "1H" / "FG"
            const matchup = (cells[1]?.text ?? '').toString().trim();     // "Away (...) @ Home (...)"
            const pickWithConf = (cells[2]?.text ?? '').toString().trim();// "Team +1.5 (92%)" / "OVER 227.5 (95%)"
            const marketCell = (cells[3]?.text ?? '').toString().trim();  // "+1.5" / "227.5"
            const edgeCell = (cells[4]?.text ?? '').toString().trim();    // "+1.3 pts"

            if (!matchup || !pickWithConf) return;

            let confidence = '';
            let pickText = pickWithConf;
            const confMatch = pickWithConf.match(/\((\d+(?:\.\d+)?%?)\)\s*$/);
            if (confMatch) {
                confidence = confMatch[1].includes('%') ? confMatch[1] : `${confMatch[1]}%`;
                pickText = pickWithConf.slice(0, confMatch.index).trim();
            }

            const upper = pickText.toUpperCase();
            const isOver = upper.startsWith('OVER ');
            const isUnder = upper.startsWith('UNDER ');

            let market = 'SPREAD';
            let pick = pickText;
            let marketLine = marketCell || '';

            if (isOver || isUnder) {
                market = 'TOTAL';
                pick = isOver ? 'Over' : 'Under';
                const maybeLine = pickText.replace(/^(OVER|UNDER)\s+/i, '').trim();
                marketLine = marketCell || maybeLine || marketLine;
            } else if (/\bML\b/i.test(pickText)) {
                market = 'ML';
                pick = pickText.replace(/\bML\b/ig, '').trim();
                marketLine = '';
            } else if (marketLine && (marketLine.startsWith('+') || marketLine.startsWith('-'))) {
                // Spread-style line: strip line from the pick text to get the team name.
                pick = pickText.replace(marketLine, '').trim() || pickText;
            }

            plays.push({
                time_cst: '', // not provided by /picks/html
                matchup,
                period: period || 'FG',
                market,
                pick,
                pick_odds: '-110',
                market_line: marketLine,
                edge: edgeCell,
                confidence: confidence,
                fire_rating: '',
                model_prediction: confidence,
                rationale: ''
            });
        });

        return plays;
    };

    const fetchExecutiveFallbackFromHtml = async (date) => {
        const apiUrl = getApiUrl();
        const qs = date ? `?date=${encodeURIComponent(date)}` : '';
        const url = `${apiUrl}/picks/html${qs}`;

        console.warn(`[NBA-PICKS] Falling back to HTML picks endpoint: ${url}`);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`NBA HTML picks error: ${res.status}`);

        const html = await res.text();
        const cardData = extractCardDataJsonFromHtml(html);
        const plays = parseExecutivePlaysFromCardData(cardData);

        return {
            date: (date || '').toString(),
            total_plays: plays.length,
            plays,
            _source: 'html'
        };
    };

    /**
     * Fetch NBA picks for a given date
     * Tries Function App first, falls back to Container App
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNBAPicks(date = 'today') {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log(`[NBA-PICKS] Using cached picks (source: ${lastSource})`);
            return picksCache;
        }

        // Try Function App first (primary source for Weekly Lineup)
        const functionUrl = `${NBA_FUNCTION_URL}/api/weekly-lineup/nba`;
        console.log(`[NBA-PICKS] Trying Function App: ${functionUrl}`);

        try {
            const response = await fetchWithTimeout(functionUrl);
            if (response.ok) {
                const data = await response.json();
                picksCache = data;
                lastFetch = Date.now();
                lastSource = 'function-app';
                const pickCount = data.plays?.length || data.picks?.length || data.total_plays || 0;
                console.log(`[NBA-PICKS] ✅ Function App returned ${pickCount} picks`);
                return data;
            }
            console.warn(`[NBA-PICKS] Function App returned ${response.status}, trying Container App...`);
        } catch (error) {
            console.warn(`[NBA-PICKS] Function App failed: ${error.message}, trying Container App...`);
        }

        // Fallback to Container App
        const containerUrl = `${NBA_API_URL}/slate/${date}/executive`;
        console.log(`[NBA-PICKS] Falling back to Container App: ${containerUrl}`);

        try {
            const response = await fetchWithTimeout(containerUrl);
            if (!response.ok) {
                throw new Error(`Container App error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();
            lastSource = 'container-app';

            console.log(`[NBA-PICKS] ✅ Container App returned ${data.total_plays || 0} picks`);
            return data;
        } catch (error) {
            console.error('[NBA-PICKS] Both sources failed:', error.message);
            throw error;
        }
    }

    /**
     * Fetch full slate analysis
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Full slate data
     */
    async function fetchFullSlate(date = 'today') {
        const apiUrl = getApiUrl();
        const url = `${apiUrl}/slate/${encodeURIComponent(date)}`;
        console.log(`[NBA-PICKS] Fetching full slate from: ${url}`);

        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`NBA API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Error fetching slate:', error.message);
            throw error;
        }
    }

    /**
     * Check API health for both sources
     * @returns {Promise<Object>} Health status
     */
    async function checkHealth() {
        const health = {
            functionApp: { status: 'unknown' },
            containerApp: { status: 'unknown' }
        };

        // Check Function App
        try {
            const response = await fetchWithTimeout(`${NBA_FUNCTION_URL}/api/health`, 5000);
            if (response.ok) {
                health.functionApp = await response.json();
                health.functionApp.status = 'healthy';
            } else {
                health.functionApp = { status: 'error', code: response.status };
            }
        } catch (error) {
            health.functionApp = { status: 'error', message: error.message };
        }

        // Check Container App
        try {
            const response = await fetchWithTimeout(`${NBA_API_URL}/health`, 5000);
            if (response.ok) {
                health.containerApp = await response.json();
                health.containerApp.status = 'healthy';
            } else {
                health.containerApp = { status: 'error', code: response.status };
            }
        } catch (error) {
            health.containerApp = { status: 'error', message: error.message };
        }

        return health;
    }

    /**
     * Format pick for display in the picks table
     * @param {Object} play - Raw play from API executive endpoint
     * @returns {Object} Formatted pick for table display
     *
     * API returns:
     * {
     *   time_cst: "12/25 11:10 AM",
     *   matchup: "Cleveland Cavaliers (17-14) @ New York Knicks (20-9)",
     *   period: "1H",
     *   market: "ML",
     *   pick: "New York Knicks",
     *   pick_odds: "-170",
     *   model_prediction: "79.2%",
     *   market_line: "63.0%",
     *   edge: "+16.2%",
     *   confidence: "57%",
     *   fire_rating: "GOOD"
     * }
     */
    function generateRationale(play) {
        // Generate detailed rationale from model data
        const parts = [];

        // Add model prediction vs market line
        if (play.model_prediction && play.market_line) {
            const modelPred = parseFloat(play.model_prediction);
            const marketLine = parseFloat(play.market_line);
            const diff = Math.abs(modelPred - marketLine);

            if (play.market === 'TOTAL') {
                if (play.pick.startsWith('OVER')) {
                    parts.push(`Model predicts ${modelPred.toFixed(1)} total points (${diff >= 2 ? 'strongly' : 'moderately'} favoring OVER)`);
                } else if (play.pick.startsWith('UNDER')) {
                    parts.push(`Model predicts ${modelPred.toFixed(1)} total points (${diff >= 2 ? 'strongly' : 'moderately'} favoring UNDER)`);
                }
            } else if (play.market === 'SPREAD') {
                if (play.model_prediction.includes(' ')) {
                    // Format: "Team -0.2"
                    parts.push(`Model predicts ${play.model_prediction} spread movement`);
                }
            }
        }

        // Add edge analysis
        if (play.edge) {
            const edgeVal = parseFloat(play.edge.replace('%', ''));
            parts.push(`${Math.abs(edgeVal).toFixed(1)}% edge ${edgeVal > 0 ? 'advantage' : 'disadvantage'}`);
        }

        // Add probability analysis
        if (play.p_model && play.p_fair) {
            const modelProb = (parseFloat(play.p_model) * 100).toFixed(1);
            const fairProb = (parseFloat(play.p_fair) * 100).toFixed(1);
            parts.push(`Model probability: ${modelProb}% vs fair market: ${fairProb}%`);
        }

        // Add EV analysis
        if (play.ev_pct) {
            const ev = parseFloat(play.ev_pct);
            if (ev > 0) {
                parts.push(`Positive expected value: ${ev.toFixed(1)}%`);
            }
        }

        // Add Kelly criterion
        if (play.kelly_fraction) {
            const kelly = parseFloat(play.kelly_fraction);
            if (kelly > 0) {
                const recommendedBet = (kelly * 100).toFixed(1);
                parts.push(`Kelly criterion suggests ${recommendedBet}% of bankroll`);
            }
        }

        // Add confidence/fire rating explanation
        if (play.fire_rating) {
            const rating = play.fire_rating.toUpperCase();
            if (rating === 'ELITE') {
                parts.push('ELITE rating: 70%+ confidence with 5+ point edge');
            } else if (rating === 'STRONG') {
                parts.push('STRONG rating: 60%+ confidence with 3+ point edge');
            } else if (rating === 'GOOD') {
                parts.push('GOOD rating: Passes all quality filters');
            }
        }

        // Add market context
        if (play.market === 'TOTAL') {
            parts.push(`Market line: ${play.market_line} points`);
        } else if (play.market === 'SPREAD') {
            parts.push(`Market spread: ${play.market_line}`);
        }

        return parts.length > 0 ? parts.join('. ') : 'Advanced machine learning analysis of team performance, injuries, pace, and historical data.';
    }

    function formatPickForTable(play) {
        // Parse matchup to get teams (format: "Away Team (W-L) @ Home Team (W-L)")
        const matchupStr = play.matchup || '';
        const matchParts = matchupStr.split(' @ ');
        const awayTeam = matchParts[0]?.replace(/\s*\([^)]*\)/, '').trim() || '';
        const homeTeam = matchParts[1]?.replace(/\s*\([^)]*\)/, '').trim() || '';

        // Parse edge - format is "+16.2%" or "-5.3%"
        let edgeValue = 0;
        if (typeof play.edge === 'string') {
            edgeValue = parseFloat(play.edge.replace('%', '').replace('+', '')) || 0;
        } else if (typeof play.edge === 'number') {
            edgeValue = play.edge;
        }

        // Convert fire_rating to number (ELITE=5, STRONG=4, GOOD=3)
        let fireNum = 3;
        const fireRating = (play.fire_rating || '').toUpperCase();
        if (fireRating === 'ELITE' || fireRating === 'MAX') fireNum = 5;
        else if (fireRating === 'STRONG') fireNum = 4;
        else if (fireRating === 'GOOD') fireNum = 3;

        // Map market types (ML, SPREAD, TOTAL) to table format
        let marketType = (play.market || 'spread').toLowerCase();
        if (marketType === 'ml') marketType = 'moneyline';

        // Parse time from "12/25 11:10 AM" format
        let timeStr = play.time_cst || '';
        if (timeStr.includes(' ')) {
            // Extract just the time part
            const timeParts = timeStr.split(' ');
            timeStr = timeParts.slice(1).join(' '); // "11:10 AM"
        }

        return {
            sport: 'NBA',
            game: `${awayTeam} @ ${homeTeam}`,
            pick: play.pick || '',
            odds: play.pick_odds || '-110',
            edge: edgeValue,
            confidence: play.confidence || play.model_prediction || fireNum,
            time: timeStr,
            market: marketType,
            period: play.period || 'FG',
            line: play.market_line || '',
            modelPrice: play.model_prediction || '',
            fire_rating: play.fire_rating || '',
            rationale: generateRationale(play),
            modelVersion: play.model_version || play.modelVersion || play.model_tag || play.modelTag || play.version || 'NBA_v33.0.8.0'
        };
    }

    // Export
    window.NBAPicksFetcher = {
        fetchPicks: fetchNBAPicks,
        fetchFullSlate,
        checkHealth,
        formatPickForTable,
        getCache: () => picksCache,
        getLastSource: () => lastSource,
        clearCache: () => { picksCache = null; lastFetch = null; lastSource = null; }
    };

    console.log('✅ NBAPicksFetcher v1.1 loaded (Function App + Container App fallback)');

})();
