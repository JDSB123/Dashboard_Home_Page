/**
 * NBA Picks Fetcher v1.0
 * Fetches NBA model picks from the Azure Container App API
 */

(function() {
    'use strict';

    const DEFAULT_NBA_API_URL = 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io';

    // Date-aware cache: { dateKey: { data, timestamp } }
    const picksCache = {};
    const CACHE_DURATION = 60000; // 1 minute

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
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNBAPicks(date = 'today') {
        const cacheKey = getCacheKey(date);
        const cached = picksCache[cacheKey];
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log(`[NBA-PICKS] Using cached picks for ${cacheKey}`);
            return cached.data;
        }

        const apiUrl = getApiUrl();
        const url = `${apiUrl}/slate/${encodeURIComponent(date)}/executive`;
        console.log(`[NBA-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`NBA API error: ${response.status}`);

            const data = await response.json();
            picksCache[cacheKey] = { data, timestamp: Date.now() };

            console.log(`[NBA-PICKS] Fetched ${data.total_plays || 0} picks for ${cacheKey}`);
            return data;
        } catch (error) {
            console.error('[NBA-PICKS] Error fetching picks:', error.message);

            // The JSON slate endpoints can intermittently fail (e.g., upstream odds API issues).
            // If that happens, fall back to the HTML endpoint which often still renders picks.
            try {
                const fallback = await fetchExecutiveFallbackFromHtml(date);
                picksCache[cacheKey] = { data: fallback, timestamp: Date.now() };
                console.warn(`[NBA-PICKS] Using HTML fallback with ${fallback.total_plays || 0} plays for ${cacheKey}`);
                return fallback;
            } catch (fallbackError) {
                console.error('[NBA-PICKS] HTML fallback also failed:', fallbackError.message);
                throw error;
            }
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
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    async function checkHealth() {
        const apiUrl = getApiUrl();
        const url = `${apiUrl}/health`;
        try {
            const response = await fetch(url, { cache: 'no-store' });
            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Health check failed:', error.message);
            return { status: 'error', message: error.message };
        }
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
            rationale: play.rationale || play.reason || play.analysis || play.notes || play.executive_summary || '',
            modelVersion: play.model_version || play.modelVersion || play.model_tag || play.modelTag || ''
        };
    }

    // Export
    window.NBAPicksFetcher = {
        fetchPicks: fetchNBAPicks,
        fetchFullSlate,
        checkHealth,
        formatPickForTable,
        getCache: () => picksCache,
        clearCache: () => {
            Object.keys(picksCache).forEach((k) => delete picksCache[k]);
        }
    };

    console.log('✅ NBAPicksFetcher v1.0 loaded');

})();
