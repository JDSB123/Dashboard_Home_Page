/* ==========================================================================
   WEEKLY LINEUP PAGE JAVASCRIPT v33.01.0
   ==========================================================================
   Production release - Real API data only, no mock data
   Today's Picks - Model outputs with Edge/Fire ratings
   Matches dashboard styling with team logos and sorting

   v33.01.0 - Added Archive/History feature:
   - Auto-archives picks when games are completed
   - Tracks outcomes (W/L/P) for all picks including non-dashboard ones
   - Active/History view toggle
   - Weekly stats summary with win rate
   - Filter by week in history view
   ========================================================================== */

// Build version tracking
const WL_BUILD = '34.00.3';
window.__WEEKLY_LINEUP_BUILD__ = WL_BUILD;

(function() {
    'use strict';

    // ===== FILTER INIT STATE (must be at top to avoid TDZ errors) =====
    let filterInitAttempts = 0;
    const MAX_FILTER_INIT_ATTEMPTS = 10;

    // ===== STORAGE FOR WEEKLY LINEUP PICKS =====
    const WEEKLY_LINEUP_STORAGE_KEY = 'gbsv_weekly_lineup_picks';
    const WEEKLY_LINEUP_SPORTSBOOK_OVERRIDES_KEY = 'gbsv_weekly_lineup_sportsbook_overrides_v1';
    const TRACKED_PICKS_STORAGE_KEY = 'gbsv_tracked_weekly_picks';
    const ARCHIVED_PICKS_STORAGE_KEY = 'gbsv_archived_weekly_picks';
    const WEEKLY_LINEUP_CLEANUP_KEY = 'gbsv_weekly_lineup_cleanup_v1';

    // ===== VIEW STATE =====
    let currentView = 'active'; // 'active' or 'history'

    // ===== SCRIPT LOADING VERIFICATION =====

    // debug-config.js normalizes window.DEBUG to a boolean. Support both boolean and object-based flags.
    const debugEnabled = Boolean(
        window.DEBUG === true ||
        window.DEBUG_MODE === true ||
        window.APP_CONFIG?.DEBUG_MODE === true ||
        window.DEBUG?.weeklyLineup ||
        window.DEBUG?.weekly_lineup
    );
    const log = (...args) => {
        if (debugEnabled) console.log(...args);
    };

    // ===== CLEANUP PLACEHOLDER/SAMPLE DATA =====
    const SAMPLE_SOURCE_KEYS = new Set(['demo', 'sample', 'mock', 'placeholder', 'fake', 'test', 'example']);

    function isPlaceholderPick(pick) {
        if (!pick || typeof pick !== 'object') return true;
        if (pick.isDemo === true || pick.isSample === true || pick.isPlaceholder === true) return true;

        const source = String(pick.source || '').toLowerCase();
        if (SAMPLE_SOURCE_KEYS.has(source)) return true;

        const sportsbook = String(pick.sportsbook || '').toLowerCase();
        if (/(demo|sample|mock|placeholder|fake|test|example)/.test(sportsbook)) return true;

        return false;
    }

    function filterPlaceholderPicks(picks) {
        const list = Array.isArray(picks) ? picks : [];
        const cleaned = list.filter((pick) => !isPlaceholderPick(pick));
        return { cleaned, removed: list.length - cleaned.length };
    }

    function normalizeSportsbookLabel(value) {
        if (!value) return '';
        const s = String(value).trim();
        if (!s) return '';

        // Normalize common internal keys to display names
        const key = s.toLowerCase().replace(/\s+/g, '');
        const map = {
            hulkwager: 'Hulk Wager',
            bombay711: 'Bombay 711',
            kingofsports: 'King of Sports',
            primetimeaction: 'Prime Time Action',
            manual: 'Manual',
            modelpick: 'Model Pick'
        };
        return map[key] || s;
    }

    function buildPickKey(pick) {
        const sport = String(pick?.sport || pick?.league || '').toUpperCase().trim();
        const date = String(pick?.date || pick?.gameDate || '').trim();
        const time = String(pick?.time || pick?.gameTime || '').trim();
        const away = String(pick?.awayTeam || '').toLowerCase().trim();
        const home = String(pick?.homeTeam || '').toLowerCase().trim();
        const pickTeam = String(pick?.pickTeam || pick?.pick || '').toLowerCase().trim();
        const pickType = String(pick?.pickType || pick?.market || '').toLowerCase().trim();
        const segment = String(pick?.segment || pick?.period || '').toLowerCase().trim();
        const line = String(pick?.line || '').trim();
        return [sport, date, time, away, home, pickTeam, pickType, segment, line].join('|');
    }

    function loadSportsbookOverrides() {
        try {
            const raw = localStorage.getItem(WEEKLY_LINEUP_SPORTSBOOK_OVERRIDES_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function saveSportsbookOverrides(overrides) {
        try {
            localStorage.setItem(WEEKLY_LINEUP_SPORTSBOOK_OVERRIDES_KEY, JSON.stringify(overrides || {}));
        } catch (_) {
            // ignore
        }
    }

    function getSportsbookOverride(pick) {
        const overrides = loadSportsbookOverrides();
        const key = buildPickKey(pick);
        return overrides[key] || '';
    }

    function setSportsbookOverride(pick, sportsbook) {
        const key = buildPickKey(pick);
        const overrides = loadSportsbookOverrides();
        const normalized = normalizeSportsbookLabel(sportsbook);
        if (normalized) {
            overrides[key] = normalized;
        } else {
            delete overrides[key];
        }
        saveSportsbookOverrides(overrides);
    }

    function cleanupWeeklyLineupSampleData() {
        if (localStorage.getItem(WEEKLY_LINEUP_CLEANUP_KEY)) return;

        try {
            const activeRaw = localStorage.getItem(WEEKLY_LINEUP_STORAGE_KEY);
            if (activeRaw) {
                const activeParsed = JSON.parse(activeRaw);
                const { cleaned, removed } = filterPlaceholderPicks(activeParsed?.picks);
                if (removed > 0) {
                    if (cleaned.length === 0) {
                        localStorage.removeItem(WEEKLY_LINEUP_STORAGE_KEY);
                    } else {
                        localStorage.setItem(WEEKLY_LINEUP_STORAGE_KEY, JSON.stringify({
                            picks: cleaned,
                            timestamp: activeParsed?.timestamp || new Date().toISOString()
                        }));
                    }
                    log(`[Cleanup] Removed ${removed} placeholder picks from weekly lineup cache`);
                }
            }

            const archivedRaw = localStorage.getItem(ARCHIVED_PICKS_STORAGE_KEY);
            if (archivedRaw) {
                const archivedParsed = JSON.parse(archivedRaw);
                const { cleaned, removed } = filterPlaceholderPicks(archivedParsed?.picks);
                if (removed > 0) {
                    localStorage.setItem(ARCHIVED_PICKS_STORAGE_KEY, JSON.stringify({
                        picks: cleaned,
                        weeklyStats: archivedParsed?.weeklyStats || {}
                    }));
                    log(`[Cleanup] Removed ${removed} placeholder picks from weekly lineup archive`);
                }
            }
        } catch (e) {
            console.error('Error cleaning weekly lineup placeholder data:', e);
        }

        localStorage.setItem(WEEKLY_LINEUP_CLEANUP_KEY, 'done');
    }

    // ===== NBA TEAM DATA =====
    const NBA_TEAMS = {
        'atlanta hawks': { abbr: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png' },
        'boston celtics': { abbr: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
        'brooklyn nets': { abbr: 'BKN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' },
        'charlotte hornets': { abbr: 'CHA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png' },
        'chicago bulls': { abbr: 'CHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png' },
        'cleveland cavaliers': { abbr: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
        'dallas mavericks': { abbr: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
        'denver nuggets': { abbr: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
        'detroit pistons': { abbr: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png' },
        'golden state warriors': { abbr: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' },
        'houston rockets': { abbr: 'HOU', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png' },
        'indiana pacers': { abbr: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png' },
        'los angeles clippers': { abbr: 'LAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png' },
        'los angeles lakers': { abbr: 'LAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
        'memphis grizzlies': { abbr: 'MEM', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png' },
        'miami heat': { abbr: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' },
        'milwaukee bucks': { abbr: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' },
        'minnesota timberwolves': { abbr: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
        'new orleans pelicans': { abbr: 'NOP', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png' },
        'new york knicks': { abbr: 'NYK', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png' },
        'oklahoma city thunder': { abbr: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
        'orlando magic': { abbr: 'ORL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png' },
        'philadelphia 76ers': { abbr: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
        'phoenix suns': { abbr: 'PHX', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png' },
        'portland trail blazers': { abbr: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
        'sacramento kings': { abbr: 'SAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png' },
        'san antonio spurs': { abbr: 'SAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png' },
        'toronto raptors': { abbr: 'TOR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png' },
        'utah jazz': { abbr: 'UTA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png' },
        'washington wizards': { abbr: 'WAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png' }
    };

    // ===== NCAAB TEAM DATA =====
    const NCAAB_TEAMS = {
        // Today's games teams with ESPN IDs
        'jackson st tigers': { abbr: 'JKST', id: '2341', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png' },
        'jackson st': { abbr: 'JKST', id: '2341', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png' },
        'hampton pirates': { abbr: 'HAMP', id: '2277', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2277.png' },
        'hampton': { abbr: 'HAMP', id: '2277', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2277.png' },
        'siu-edwardsville cougars': { abbr: 'SIUE', id: '2565', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2565.png' },
        'siu-edwardsville': { abbr: 'SIUE', id: '2565', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2565.png' },
        'eastern illinois panthers': { abbr: 'EIU', id: '2197', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2197.png' },
        'eastern illinois': { abbr: 'EIU', id: '2197', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2197.png' },
        'coastal carolina chanticleers': { abbr: 'CCU', id: '324', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png' },
        'coastal carolina': { abbr: 'CCU', id: '324', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png' },
        'appalachian st mountaineers': { abbr: 'APP', id: '2026', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png' },
        'appalachian st': { abbr: 'APP', id: '2026', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png' },
        'delaware st hornets': { abbr: 'DSU', id: '2169', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2169.png' },
        'delaware st': { abbr: 'DSU', id: '2169', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2169.png' },
        "saint joseph's hawks": { abbr: 'SJU', id: '2603', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2603.png' },
        "saint joseph's": { abbr: 'SJU', id: '2603', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2603.png' },
        'fairfield stags': { abbr: 'FAIR', id: '2217', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2217.png' },
        'fairfield': { abbr: 'FAIR', id: '2217', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2217.png' },
        'central connecticut st blue devils': { abbr: 'CCSU', id: '2115', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2115.png' },
        'central connecticut st': { abbr: 'CCSU', id: '2115', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2115.png' },
        'temple owls': { abbr: 'TEM', id: '218', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png' },
        'temple': { abbr: 'TEM', id: '218', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png' },
        'davidson wildcats': { abbr: 'DAV', id: '2166', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2166.png' },
        'davidson': { abbr: 'DAV', id: '2166', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2166.png' },
        'bradley braves': { abbr: 'BRAD', id: '71', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/71.png' },
        'bradley': { abbr: 'BRAD', id: '71', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/71.png' },
        'indiana st sycamores': { abbr: 'INST', id: '282', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png' },
        'indiana st': { abbr: 'INST', id: '282', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png' },
        'western carolina catamounts': { abbr: 'WCU', id: '2717', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png' },
        'western carolina': { abbr: 'WCU', id: '2717', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png' },
        '#27 georgia bulldogs': { abbr: 'UGA', id: '61', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
        'georgia bulldogs': { abbr: 'UGA', id: '61', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
        'georgia': { abbr: 'UGA', id: '61', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
        'southern utah thunderbirds': { abbr: 'SUU', id: '253', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png' },
        'southern utah': { abbr: 'SUU', id: '253', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png' },
        'northern arizona lumberjacks': { abbr: 'NAU', id: '2464', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png' },
        'northern arizona': { abbr: 'NAU', id: '2464', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png' },
        'furman paladins': { abbr: 'FUR', id: '231', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png' },
        'furman': { abbr: 'FUR', id: '231', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png' },
        'manhattan jaspers': { abbr: 'MAN', id: '2363', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2363.png' },
        'manhattan': { abbr: 'MAN', id: '2363', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2363.png' },
        'radford highlanders': { abbr: 'RAD', id: '2547', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2547.png' },
        'radford': { abbr: 'RAD', id: '2547', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2547.png' },
        'william & mary tribe': { abbr: 'W&M', id: '2729', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png' },
        'william & mary': { abbr: 'W&M', id: '2729', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png' },
        'lafayette leopards': { abbr: 'LAF', id: '322', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png' },
        'lafayette': { abbr: 'LAF', id: '322', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png' },
        'charlotte 49ers': { abbr: 'CLT', id: '2429', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png' },
        'charlotte': { abbr: 'CLT', id: '2429', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png' },
        'american eagles': { abbr: 'AU', id: '44', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/44.png' },
        'american': { abbr: 'AU', id: '44', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/44.png' },
        'vcu rams': { abbr: 'VCU', id: '2670', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2670.png' },
        'vcu': { abbr: 'VCU', id: '2670', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2670.png' },
        'grambling st tigers': { abbr: 'GRAM', id: '2755', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2755.png' },
        'grambling st': { abbr: 'GRAM', id: '2755', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2755.png' },
        'norfolk st spartans': { abbr: 'NSU', id: '2450', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png' },
        'norfolk st': { abbr: 'NSU', id: '2450', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png' },
        'oral roberts golden eagles': { abbr: 'ORU', id: '198', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/198.png' },
        'oral roberts': { abbr: 'ORU', id: '198', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/198.png' },
        'tcu horned frogs': { abbr: 'TCU', id: '2628', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png' },
        'tcu': { abbr: 'TCU', id: '2628', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png' },
        'drake bulldogs': { abbr: 'DRKE', id: '2181', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2181.png' },
        'drake': { abbr: 'DRKE', id: '2181', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2181.png' },
        'murray st racers': { abbr: 'MURR', id: '93', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png' },
        'murray st': { abbr: 'MURR', id: '93', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png' },
        'umkc kangaroos': { abbr: 'UMKC', id: '140', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/140.png' },
        'umkc': { abbr: 'UMKC', id: '140', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/140.png' },
        'oklahoma st cowboys': { abbr: 'OKST', id: '197', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png' },
        'oklahoma st': { abbr: 'OKST', id: '197', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png' },
        'georgia st panthers': { abbr: 'GAST', id: '2247', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png' },
        'georgia st': { abbr: 'GAST', id: '2247', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png' },
        'georgia southern eagles': { abbr: 'GASO', id: '290', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png' },
        'georgia southern': { abbr: 'GASO', id: '290', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png' },
        'winthrop eagles': { abbr: 'WIN', id: '2747', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png' },
        'winthrop': { abbr: 'WIN', id: '2747', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png' },
        'north dakota fighting hawks': { abbr: 'UND', id: '155', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png' },
        'north dakota': { abbr: 'UND', id: '155', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png' },
        'western illinois leathernecks': { abbr: 'WIU', id: '2710', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png' },
        'western illinois': { abbr: 'WIU', id: '2710', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png' },
        'lindenwood lions': { abbr: 'LIND', id: '2815', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2815.png' },
        'lindenwood': { abbr: 'LIND', id: '2815', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2815.png' },
        'tenn-martin skyhawks': { abbr: 'UTM', id: '2630', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png' },
        'tenn-martin': { abbr: 'UTM', id: '2630', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png' },
        'tennessee st tigers': { abbr: 'TNST', id: '2634', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png' },
        'tennessee st': { abbr: 'TNST', id: '2634', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png' },
        'se missouri st redhawks': { abbr: 'SEMO', id: '2546', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png' },
        'se missouri st': { abbr: 'SEMO', id: '2546', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png' },
        '#12 tennessee tech golden eagles': { abbr: 'TTU', id: '2635', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png' },
        'tennessee tech golden eagles': { abbr: 'TTU', id: '2635', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png' },
        'tennessee tech': { abbr: 'TTU', id: '2635', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png' },
        "louisiana ragin' cajuns": { abbr: 'ULL', id: '309', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png' },
        'louisiana': { abbr: 'ULL', id: '309', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png' },
        'southern miss golden eagles': { abbr: 'USM', id: '2572', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png' },
        'southern miss': { abbr: 'USM', id: '2572', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png' },
        'arkansas-little rock trojans': { abbr: 'UALR', id: '2031', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2031.png' },
        'arkansas-little rock': { abbr: 'UALR', id: '2031', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2031.png' },
        'southern indiana screaming eagles': { abbr: 'USI', id: '88', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/88.png' },
        'southern indiana': { abbr: 'USI', id: '88', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/88.png' },
        'illinois st redbirds': { abbr: 'ILST', id: '2287', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png' },
        'illinois st': { abbr: 'ILST', id: '2287', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png' },
        'southern illinois salukis': { abbr: 'SIU', id: '79', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png' },
        'southern illinois': { abbr: 'SIU', id: '79', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png' },
        'pepperdine waves': { abbr: 'PEPP', id: '2492', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2492.png' },
        'pepperdine': { abbr: 'PEPP', id: '2492', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2492.png' },
        'long beach st 49ers': { abbr: 'LBSU', id: '299', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/299.png' },
        'long beach st': { abbr: 'LBSU', id: '299', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/299.png' }
    };

    // League logos
    const BASE_LEAGUE_LOGOS = {
        'NCAAB': '/assets/icons/league-ncaam.svg',
        'NCAAM': '/assets/icons/league-ncaam.svg',
        'NCAAF': '/assets/icons/league-ncaaf.svg',
        'NBA': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nba.png',
        'NFL': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nfl.png'
    };

    function resolveLeagueLogo(leagueKey) {
        const normalizedKey = (leagueKey || '').toString().trim();
        if (window.LogoLoader?.getLeagueLogoUrl) {
            const remoteLogo = window.LogoLoader.getLeagueLogoUrl(normalizedKey);
            if (remoteLogo) return remoteLogo;
        }
        const upperKey = normalizedKey.toUpperCase();
        return BASE_LEAGUE_LOGOS[upperKey] || '';
    }

    function getTeamInfo(teamName) {
        if (!teamName) return { abbr: 'N/A', logo: '' };
        const lower = teamName.toLowerCase().trim();

        // Check NBA teams first
        const nbaData = NBA_TEAMS[lower];
        if (nbaData) {
            // Use Azure Blob Storage for logo
            const league = 'nba';
            const teamId = nbaData.abbr.toLowerCase();
            const logo = window.LogoLoader ? window.LogoLoader.getLogoUrl(league, teamId) : '';
            return { abbr: nbaData.abbr, logo };
        }

        // Then check NCAAB teams
        const ncaabData = NCAAB_TEAMS[lower];
        if (ncaabData) {
            // Use Azure Blob Storage for logo
            const league = 'ncaam';
            const teamId = ncaabData.abbr.toLowerCase();
            const logo = window.LogoLoader ? window.LogoLoader.getLogoUrl(league, teamId) : '';
            return { abbr: ncaabData.abbr, logo };
        }

        // Default: fallback abbr, no logo
        return { abbr: teamName.substring(0, 4).toUpperCase(), logo: '' };
    }

    // ===== SORTING STATE =====
    let currentSort = { column: 'edge', direction: 'desc' };
    let allPicks = [];  // Store all picks for sorting

    // ===== SHARED CONSTANTS (must be declared before initialization runs) =====
    const SORT_ICONS = {
        unsorted: '\u25B2',  // default sortable indicator
        asc: '\u25B2',
        desc: '\u25BC'
    };

    // Store last fetch times per league so timestamps can be updated safely
    const lastFetchTimes = {
        all: null,
        nba: null,
        ncaab: null,
        nfl: null,
        ncaaf: null
    };

    // ===== INITIALIZATION =====
    function runInitialization() {
        log('🎬 [Weekly Lineup] runInitialization() called');
        log('📄 [Weekly Lineup] document.readyState:', document.readyState);

        // Initialize the table filter system
        initializeFilters();
        initFilterToolbar();

        initializeSorting();
        initializeTimeSlots();
        initializeDateRangeSelector();
        initializeTrackerButtons();
        initializeRationaleToggles();
        initializeSportsbookEditors();
        initializeViewToggle(); // Active/History toggle

        try {
            log('[Weekly Lineup] Starting initialization...');

            // Archive expired picks on page load
            archiveExpiredPicks();

            // v33.01.1: Auto-fetch fresh picks on page load (production behavior)
            // Always fetch fresh data from API to ensure latest picks are shown
            log('🚀 [Weekly Lineup] Auto-fetching fresh picks from API...');
            loadModelOutputs();

            // Initialize filter system
            requestAnimationFrame(() => {
                log('[Weekly Lineup] Initializing filter system...');
                if (window.TableFilters) {
                    window.TableFilters.renderFilterChips();
                    window.TableFilters.updateFilterIndicators();
                }
            });

            // Fetch team records in background (non-blocking)
            if (window.AutoGameFetcher && window.AutoGameFetcher.fetchTodaysGames) {
                log('[Weekly Lineup] Setting up team records fetch...');
                window.AutoGameFetcher.fetchTodaysGames().then(() => {
                    updateTeamRecords();
                }).catch(() => {});
            }

            log('[Weekly Lineup] Initialization completed successfully');
        } catch (error) {
            console.error('[Weekly Lineup] ERROR during initialization:', error);
        }
    }

    // Handle both cases: DOM already ready OR still loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInitialization);
    } else {
        runInitialization();
    }

    // Update team records in existing rows after AutoGameFetcher loads
    function updateTeamRecords() {
        if (!window.AutoGameFetcher || !window.AutoGameFetcher.getTeamRecord) return;

        const recordSpans = document.querySelectorAll('.weekly-lineup-table .team-record');
        recordSpans.forEach(span => {
            const teamName = span.closest('.team-line')?.querySelector('.team-name-full')?.textContent;
            if (teamName && !span.textContent) {
                const record = window.AutoGameFetcher.getTeamRecord(teamName);
                if (record) {
                    span.textContent = `(${record})`;
                }
            }
        });
    }

    // ===== DATE HELPER =====
    /**
     * Generate formatted date string for today (e.g., "Sun, Dec 21")
     */
    function getTodayDateString() {
        const today = new Date();
        return today.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    // ===== WAIT FOR FETCHER HELPER =====
    /**
     * Wait for UnifiedPicksFetcher to be available
     * Retries up to 20 times with 250ms delay (5 seconds total)
     */
    async function waitForFetcher(maxRetries = 20, delay = 250) {
        for (let i = 0; i < maxRetries; i++) {
            if (window.UnifiedPicksFetcher && window.UnifiedPicksFetcher.fetchPicks) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        return false;
    }

    // ===== LOAD MODEL OUTPUTS (TODAY'S PICKS) =====
    /**
     * v33.00.0 - Production: Fetch real picks from Azure Container Apps APIs
     * No mock/placeholder data - uses unified-picks-fetcher.js
     */
    async function loadModelOutputs() {
        log('🔄 Loading today\'s model picks from APIs...');

        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📊</span><span class="empty-message">Loading picks...</span></div></td></tr>';
        }

        try {
            // Wait for UnifiedPicksFetcher to load (handles script load order)
            const fetcherReady = await waitForFetcher();

            if (!fetcherReady) {
                console.warn('[Weekly Lineup] UnifiedPicksFetcher not available after timeout');
                showNoPicks('API fetcher failed to load. Please refresh the page.');
                return;
            }

            const result = await window.UnifiedPicksFetcher.fetchPicks('all', 'today');

            if (result.picks && result.picks.length > 0) {
                console.log(`[Weekly Lineup] ✅ Fetched ${result.picks.length} real picks from APIs`);

                    // Transform picks to table format and sort by edge
                    const formattedPicks = result.picks.map(pick => {
                        const edge = parseFloat(pick.edge) || 0;
                        const fireMeta = normalizeFireRating(pick.fire ?? pick.confidence ?? pick.fire_rating ?? pick.fireRating, edge);
                        const rawMatchup = pick.matchup ?? pick.game ?? '';
                        const matchupSource = typeof rawMatchup === 'string' ? rawMatchup : String(rawMatchup);
                        const trimmedMatchup = matchupSource.trim();
                        const parsedMatchup = parseMatchupString(trimmedMatchup);
                        const awayField = pickTeamFromFields(pick, ['awayTeam', 'away_team', 'away', 'teamAway', 'team_away', 'awayTeamFull']);
                        const homeField = pickTeamFromFields(pick, ['homeTeam', 'home_team', 'home', 'teamHome', 'team_home', 'homeTeamFull']);
                        const awayTeam = awayField || parsedMatchup.away || '';
                        const homeTeam = homeField || parsedMatchup.home || '';
                        const matchupValue = trimmedMatchup || (awayTeam && homeTeam ? `${awayTeam} @ ${homeTeam}` : '');

                        const formatted = {
                            date: pick.date || getTodayDateString(),
                            time: pick.time || pick.gameTime || 'TBD',
                            sport: pick.sport || pick.league || 'NBA',
                            awayTeam: awayTeam,
                            homeTeam: homeTeam,
                            matchup: matchupValue,
                            awayRecord: pick.awayRecord || pick.away_record || '',
                            homeRecord: pick.homeRecord || pick.home_record || '',
                            segment: normalizeSegment(pick.segment || pick.period || 'FG'),
                            pickTeam: pick.pickTeam || pick.pick || '',
                            pickType: normalizePickType(pick.pickType || pick.market || 'spread'),
                            pickDirection: pick.pickDirection || pick.pick_direction || '',
                            line: pick.line || '',
                            odds: pick.odds || '-110',
                            modelPrice: pick.modelPrice || pick.model_price || '',
                            modelSpread: pick.modelSpread || pick.model_spread || pick.predictedSpread || '',
                            edge: edge,
                            fire: fireMeta.fire,
                            fireLabel: pick.fireLabel || fireMeta.fireLabel,
                            rationale: pick.rationale || pick.reason || pick.notes || pick.explanation || '',
                            modelStamp: pick.modelStamp || pick.model_version || pick.modelVersion || pick.modelTag || '',
                            status: pick.status || 'pending',
                            sportsbook: pick.sportsbook || pick.book || ''
                        };

                        // If the API didn’t provide a sportsbook, apply any saved override.
                        if (!formatted.sportsbook) {
                            formatted.sportsbook = getSportsbookOverride(formatted);
                        } else {
                            formatted.sportsbook = normalizeSportsbookLabel(formatted.sportsbook);
                        }

                        return formatted;
                    });

                    // Sort by edge (highest first)
                    formattedPicks.sort((a, b) => b.edge - a.edge);
                    populateWeeklyLineupTable(formattedPicks);
                    updateModelStamp(formattedPicks);

                    // Update last fetched timestamp
                    updateLastFetchedTime();

                    // Auto-save snapshot when picks are loaded
                    savePicksSnapshot(formattedPicks, 'auto-load');
                } else {
                    console.log('[Weekly Lineup] ⚠️ No picks returned from APIs');
                    showNoPicks('No picks available for today. Check back later or fetch manually.');
                    updateModelStamp([]);
                }

                // Log any errors
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => {
                        console.warn(`[Weekly Lineup] ${err.league} API error:`, err.error);
                    });
                }
        } catch (error) {
            console.error('[Weekly Lineup] ❌ Error fetching picks:', error);
            showNoPicks('Error loading picks. Please try the Fetch button to retry.');
            updateModelStamp([]);
        }
    }

    // Update last fetched timestamp display
    function updateLastFetchedTime(league = 'all', count = null) {
        const el = document.getElementById('ft-last-refreshed');
        if (el) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            lastFetchTimes[league] = timeStr;
            const syncSpan = el.querySelector('.sync-time');
            if (syncSpan) {
                syncSpan.textContent = timeStr;
            }
        }
    }

    function updateModelStamp(picks) {
        const el = document.getElementById('ft-model-stamp');
        if (!el) return;

        if (!Array.isArray(picks) || picks.length === 0) {
            el.textContent = 'Models: --';
            el.title = 'Model build/tag used for the currently displayed picks';
            return;
        }

        const stampsBySport = new Map();
        picks.forEach((pick) => {
            const sport = (pick.sport || '').toString().toUpperCase().trim();
            const stamp = (pick.modelStamp || pick.modelVersion || pick.modelTag || '').toString().trim();
            if (!sport || !stamp) return;

            if (!stampsBySport.has(sport)) stampsBySport.set(sport, new Set());
            stampsBySport.get(sport).add(stamp);
        });

        const parts = Array.from(stampsBySport.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([sport, stamps]) => {
                const list = Array.from(stamps);
                return `${sport}: ${list.length === 1 ? list[0] : 'mixed'}`;
            });

        el.textContent = parts.length ? `Models: ${parts.join(' | ')}` : 'Models: unknown';

        const titleLines = Array.from(stampsBySport.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([sport, stamps]) => `${sport}: ${Array.from(stamps).join(', ')}`);
        el.title = titleLines.length
            ? `Model build/tag used for the currently displayed picks\n${titleLines.join('\n')}`
            : 'Model build/tag used for the currently displayed picks';
    }

    function showNoPicks(message) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📊</span><span class="empty-message">${message}</span></div></td></tr>`;
        }
    }

    // Alias for showEmptyState (used by unified-picks-fetcher.js)
    function showEmptyState(message) {
        showNoPicks(message);
    }

    function sanitizeTeamName(value) {
        if (value === undefined || value === null) return '';
        const text = value.toString().trim();
        if (!text) return '';
        return text.toLowerCase() === 'unknown' ? '' : text;
    }

    function pickTeamFromFields(pick, fields) {
        if (!pick) return '';
        for (const field of fields) {
            const candidate = sanitizeTeamName(pick[field]);
            if (candidate) return candidate;
        }
        return '';
    }

    function parseMatchupString(matchup) {
        if (matchup === undefined || matchup === null) return { away: '', home: '' };
        const normalized = matchup.toString().replace(/\s+/g, ' ').trim();
        if (!normalized) return { away: '', home: '' };

        const patterns = [
            /^(.*?)\s*@\s*(.*?)$/i,
            /^(.*?)\s+vs\.?\s+(.*?)$/i,
            /^(.*?)\s+versus\s+(.*?)$/i,
            /^(.*?)\s+at\s+(.*?)$/i
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match && match[1] && match[2]) {
                return {
                    away: sanitizeTeamName(match[1]),
                    home: sanitizeTeamName(match[2])
                };
            }
        }

        return { away: '', home: '' };
    }

    // ===== HELPER FUNCTIONS =====
    function normalizePickType(raw) {
        const value = (raw ?? '').toString().trim().toLowerCase();
        if (!value) return 'spread';
        if (value === 'moneyline' || value === 'ml' || value === 'money line') return 'ml';
        if (value === 'team total' || value === 'team-total' || value === 'team_total' || value === 'tt') return 'tt';
        if (value === 'total' || value === 'ou' || value === 'over/under') return 'total';
        if (value === 'spread' || value === 'spreads') return 'spread';
        return value;
    }

    function normalizeSegment(raw) {
        const value = (raw ?? '').toString().trim().toLowerCase();
        if (!value) return 'full';
        if (value === 'fg' || value === 'full' || value === 'full game' || value === 'full-game') return 'full';
        if (value === '1h' || value === '1st half' || value === 'first half') return '1h';
        if (value === '2h' || value === '2nd half' || value === 'second half') return '2h';
        return value;
    }

    function normalizeFireRating(rawFire, edgeValue = 0) {
        const clamp = (n) => Math.max(0, Math.min(5, n));

        if (typeof rawFire === 'number' && Number.isFinite(rawFire)) {
            const fire = clamp(Math.round(rawFire));
            return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
        }

        const str = (rawFire ?? '').toString().trim();
        if (str) {
            const asNum = parseInt(str, 10);
            if (!Number.isNaN(asNum)) {
                const fire = clamp(asNum);
                return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
            }

            const upper = str.toUpperCase();
            const map = { MAX: 5, ELITE: 5, STRONG: 4, GOOD: 3, STANDARD: 2, LOW: 1 };
            if (upper in map) {
                const fire = map[upper];
                return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
            }
        }

        const computed = clamp(Math.ceil((parseFloat(edgeValue) || 0) / 1.5));
        return { fire: computed, fireLabel: computed === 5 ? 'MAX' : '' };
    }

    function buildPickLabel(pick) {
        // Use the full pick text from API if available (e.g., "OVER 218.5", "Utah Jazz +4.0")
        if (pick.pick && typeof pick.pick === 'string' && pick.pick.trim()) {
            let label = pick.pick.trim();
            // Fix "UNDE" typo → "UNDER" (with or without space after)
            label = label.replace(/^UNDE\b/i, 'UNDER');
            return label;
        }

        // Fallback to constructing from components
        const pickType = normalizePickType(pick.pickType);
        if (pickType === 'spread') {
            const line = pick.line || '';
            return line.startsWith('+') || line.startsWith('-') ? line : `${line}`;
        } else if (pickType === 'ml') {
            return 'ML';
        } else if (pickType === 'total' || pickType === 'tt') {
            return pick.line || '';
        }
        return '';
    }

    function renderLeagueCell(sport) {
        const logo = resolveLeagueLogo(sport);
        return `
            <div class="league-cell">
                ${logo ? `<img src="${logo}" class="league-logo" loading="eager" alt="${sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-text">${sport}</span>
            </div>
        `;
    }

    // ===== STORAGE FUNCTIONS FOR WEEKLY LINEUP PICKS =====
    function saveWeeklyLineupPicks(picks) {
        try {
            const safePicks = Array.isArray(picks) ? picks : [];
            localStorage.setItem(WEEKLY_LINEUP_STORAGE_KEY, JSON.stringify({
                picks: safePicks,
                timestamp: new Date().toISOString()
            }));
            log(`💾 Saved ${safePicks.length} weekly lineup picks to localStorage`);
        } catch (e) {
            console.error('Error saving weekly lineup picks:', e);
        }
    }

    function loadWeeklyLineupPicks() {
        try {
            cleanupWeeklyLineupSampleData();
            const data = localStorage.getItem(WEEKLY_LINEUP_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);

                // Check cache expiry: clear if timestamp is from previous day
                if (parsed.timestamp) {
                    const cachedDate = new Date(parsed.timestamp).toDateString();
                    const today = new Date().toDateString();
                    if (cachedDate !== today) {
                        log(`⏰ Clearing stale picks (cached ${cachedDate}, today is ${today})`);
                        localStorage.removeItem(WEEKLY_LINEUP_STORAGE_KEY);
                        return null;
                    }
                }

                if (parsed.picks && Array.isArray(parsed.picks) && parsed.picks.length > 0) {
                    const { cleaned, removed } = filterPlaceholderPicks(parsed.picks);
                    if (removed > 0) {
                        log(`[Cleanup] Removed ${removed} placeholder picks from weekly lineup cache on load`);
                        if (cleaned.length === 0) {
                            localStorage.removeItem(WEEKLY_LINEUP_STORAGE_KEY);
                            return null;
                        }
                        localStorage.setItem(WEEKLY_LINEUP_STORAGE_KEY, JSON.stringify({
                            picks: cleaned,
                            timestamp: parsed.timestamp || new Date().toISOString()
                        }));
                    }
                    log(`📂 Loaded ${cleaned.length} weekly lineup picks from localStorage (cached today)`);
                    return cleaned;
                }
            }
        } catch (e) {
            console.error('Error loading weekly lineup picks:', e);
        }
        return null;
    }

    // ===== ARCHIVE FUNCTIONS FOR WEEKLY LINEUP PICKS =====

    /**
     * Get the week identifier string (e.g., "Dec 23-29, 2025")
     */
    function getWeekIdentifier(date = new Date()) {
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        // Get start of week (Sunday)
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - dayOfWeek);
        // Get end of week (Saturday)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const options = { month: 'short', day: 'numeric' };
        const startStr = startOfWeek.toLocaleDateString('en-US', options);
        const endStr = endOfWeek.toLocaleDateString('en-US', { day: 'numeric' });
        const year = endOfWeek.getFullYear();

        return `${startStr}-${endStr}, ${year}`;
    }

    /**
     * Load archived picks from localStorage
     */
    function loadArchivedPicks() {
        try {
            cleanupWeeklyLineupSampleData();
            const data = localStorage.getItem(ARCHIVED_PICKS_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                const { cleaned, removed } = filterPlaceholderPicks(parsed.picks || []);
                if (removed > 0) {
                    log(`[Cleanup] Removed ${removed} placeholder picks from weekly lineup archive on load`);
                    localStorage.setItem(ARCHIVED_PICKS_STORAGE_KEY, JSON.stringify({
                        picks: cleaned,
                        weeklyStats: parsed.weeklyStats || {}
                    }));
                }
                return {
                    picks: cleaned,
                    weeklyStats: parsed.weeklyStats || {}
                };
            }
        } catch (e) {
            console.error('Error loading archived picks:', e);
        }
        return { picks: [], weeklyStats: {} };
    }

    /**
     * Save archived picks to localStorage
     */
    function saveArchivedPicks(archiveData) {
        try {
            localStorage.setItem(ARCHIVED_PICKS_STORAGE_KEY, JSON.stringify(archiveData));
            log(`📦 Saved ${archiveData.picks.length} archived picks`);
        } catch (e) {
            console.error('Error saving archived picks:', e);
        }
    }

    /**
     * Check if a pick's game has passed (game time is in the past)
     */
    function isGamePassed(pick) {
        try {
            // Parse date and time
            const dateStr = pick.date || '';
            const timeStr = pick.time || '';

            // Try to construct a date object
            let gameDate;

            // Handle formats like "Mon, Dec 23" or "Dec 23"
            const currentYear = new Date().getFullYear();
            const monthDayMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);

            if (monthDayMatch) {
                const monthStr = monthDayMatch[1];
                const day = parseInt(monthDayMatch[2]);
                const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
                const month = monthMap[monthStr.toLowerCase()];

                // Parse time (e.g., "6:10 PM")
                let hours = 23, minutes = 59;
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                if (timeMatch) {
                    hours = parseInt(timeMatch[1]);
                    minutes = parseInt(timeMatch[2]);
                    const period = (timeMatch[3] || '').toUpperCase();
                    if (period === 'PM' && hours < 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                }

                gameDate = new Date(currentYear, month, day, hours, minutes);

                // If the date is in the past by more than 6 months, it's probably next year
                const now = new Date();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                if (gameDate < sixMonthsAgo) {
                    gameDate.setFullYear(currentYear + 1);
                }
            } else {
                // Fallback: try direct parsing
                gameDate = new Date(dateStr);
                if (isNaN(gameDate.getTime())) {
                    return false; // Can't parse, assume not passed
                }
            }

            // Add 3 hours buffer after game start to ensure game is finished
            const gameEndEstimate = new Date(gameDate.getTime() + 3 * 60 * 60 * 1000);
            return new Date() > gameEndEstimate;
        } catch (e) {
            log('Error checking if game passed:', e);
            return false;
        }
    }

    function normalizePickIdentityFields(pick) {
        return {
            pickTeam: (pick.pickTeam || '').toUpperCase().trim(),
            line: (pick.line || '').toString().trim(),
            awayTeam: (pick.awayTeam || '').toUpperCase().trim(),
            homeTeam: (pick.homeTeam || '').toUpperCase().trim(),
            segment: normalizeSegment(pick.segment || pick.period || 'FG').toUpperCase(),
            odds: (pick.odds || '').toString().trim(),
            date: (pick.date || pick.gameDate || '').toLowerCase().trim()
        };
    }

    function picksMatch(pickA, pickB) {
        const a = normalizePickIdentityFields(pickA || {});
        const b = normalizePickIdentityFields(pickB || {});

        const sameTeams = a.awayTeam === b.awayTeam && a.homeTeam === b.homeTeam;
        const samePick = a.pickTeam === b.pickTeam && a.line === b.line;
        const sameSegment = a.segment === b.segment;

        const oddsComparable = a.odds && b.odds ? a.odds === b.odds : true;
        const dateComparable = a.date && b.date ? a.date === b.date : true;

        return sameTeams && samePick && sameSegment && oddsComparable && dateComparable;
    }

    /**
     * Get outcome for a pick from dashboard data
     */
    function getPickOutcome(pick) {
        try {
            const dashboardPicks = JSON.parse(localStorage.getItem('gbsv_picks') || '[]');
            const matched = dashboardPicks.find(dp => picksMatch(dp, pick));

            if (matched && matched.status) {
                // Return status: win, loss, push
                if (['win', 'loss', 'push'].includes(matched.status.toLowerCase())) {
                    return matched.status.toLowerCase();
                }
            }
            return 'no_action'; // Not tracked or no result yet
        } catch (e) {
            return 'no_action';
        }
    }

    /**
     * Archive expired picks (games that have passed)
     */
    function archiveExpiredPicks() {
        const currentPicks = loadWeeklyLineupPicks() || [];
        if (currentPicks.length === 0) return;

        const archiveData = loadArchivedPicks();
        const now = new Date();
        const activePicks = [];
        let archivedCount = 0;

        currentPicks.forEach(pick => {
            if (isGamePassed(pick)) {
                // This pick's game has passed - archive it
                const weekId = getWeekIdentifier(now);
                const pickId = generatePickId(pick);

                // Check if already archived (avoid duplicates)
                const alreadyArchived = archiveData.picks.some(ap =>
                    generatePickId(ap) === pickId
                );

                if (!alreadyArchived) {
                    // Get outcome from dashboard if available
                    const outcome = getPickOutcome(pick);

                    // Check if it was sent to dashboard
                    const trackedData = getTrackingMetadata(pick);
                    const sentToDashboard = !!trackedData;

                    const archivedPick = {
                        ...pick,
                        archivedAt: now.toISOString(),
                        weekOf: weekId,
                        outcome: outcome,
                        sentToDashboard: sentToDashboard,
                        dashboardPickId: trackedData?.pickId || null
                    };

                    archiveData.picks.push(archivedPick);

                    // Update weekly stats
                    if (!archiveData.weeklyStats[weekId]) {
                        archiveData.weeklyStats[weekId] = {
                            total: 0,
                            tracked: 0,
                            wins: 0,
                            losses: 0,
                            pushes: 0,
                            noAction: 0
                        };
                    }

                    archiveData.weeklyStats[weekId].total++;
                    if (sentToDashboard) archiveData.weeklyStats[weekId].tracked++;
                    if (outcome === 'win') archiveData.weeklyStats[weekId].wins++;
                    else if (outcome === 'loss') archiveData.weeklyStats[weekId].losses++;
                    else if (outcome === 'push') archiveData.weeklyStats[weekId].pushes++;
                    else archiveData.weeklyStats[weekId].noAction++;

                    archivedCount++;
                }
            } else {
                // Game hasn't passed - keep in active list
                activePicks.push(pick);
            }
        });

        if (archivedCount > 0) {
            // Save archive
            saveArchivedPicks(archiveData);

            // Update active picks (remove archived ones)
            saveWeeklyLineupPicks(activePicks);

            log(`📦 Archived ${archivedCount} expired picks`);
            showNotification(`Archived ${archivedCount} completed picks`, 'info');
        }
    }

    /**
     * Manually archive a specific pick (for testing or manual control)
     */
    function archivePick(pick, outcome = 'no_action') {
        const archiveData = loadArchivedPicks();
        const now = new Date();
        const weekId = getWeekIdentifier(now);

        const trackedData = getTrackingMetadata(pick);

        const archivedPick = {
            ...pick,
            archivedAt: now.toISOString(),
            weekOf: weekId,
            outcome: outcome,
            sentToDashboard: !!trackedData,
            dashboardPickId: trackedData?.pickId || null
        };

        archiveData.picks.push(archivedPick);

        // Update weekly stats
        if (!archiveData.weeklyStats[weekId]) {
            archiveData.weeklyStats[weekId] = {
                total: 0, tracked: 0, wins: 0, losses: 0, pushes: 0, noAction: 0
            };
        }
        archiveData.weeklyStats[weekId].total++;
        if (trackedData) archiveData.weeklyStats[weekId].tracked++;
        if (outcome === 'win') archiveData.weeklyStats[weekId].wins++;
        else if (outcome === 'loss') archiveData.weeklyStats[weekId].losses++;
        else if (outcome === 'push') archiveData.weeklyStats[weekId].pushes++;
        else archiveData.weeklyStats[weekId].noAction++;

        saveArchivedPicks(archiveData);

        // Remove from active picks
        const currentPicks = loadWeeklyLineupPicks() || [];
        const pickId = generatePickId(pick);
        const filtered = currentPicks.filter(p => generatePickId(p) !== pickId);
        saveWeeklyLineupPicks(filtered);

        log(`📦 Manually archived pick: ${pick.pickTeam} ${pick.line}`);
    }

    /**
     * Update outcome for an archived pick
     */
    function updateArchivedPickOutcome(pickId, newOutcome) {
        const archiveData = loadArchivedPicks();
        const pickIndex = archiveData.picks.findIndex(p => generatePickId(p) === pickId);

        if (pickIndex >= 0) {
            const oldOutcome = archiveData.picks[pickIndex].outcome;
            const weekId = archiveData.picks[pickIndex].weekOf;

            // Update pick
            archiveData.picks[pickIndex].outcome = newOutcome;

            // Update stats
            if (archiveData.weeklyStats[weekId]) {
                // Decrement old outcome
                if (oldOutcome === 'win') archiveData.weeklyStats[weekId].wins--;
                else if (oldOutcome === 'loss') archiveData.weeklyStats[weekId].losses--;
                else if (oldOutcome === 'push') archiveData.weeklyStats[weekId].pushes--;
                else archiveData.weeklyStats[weekId].noAction--;

                // Increment new outcome
                if (newOutcome === 'win') archiveData.weeklyStats[weekId].wins++;
                else if (newOutcome === 'loss') archiveData.weeklyStats[weekId].losses++;
                else if (newOutcome === 'push') archiveData.weeklyStats[weekId].pushes++;
                else archiveData.weeklyStats[weekId].noAction++;
            }

            saveArchivedPicks(archiveData);
            log(`📦 Updated outcome for archived pick to: ${newOutcome}`);
            return true;
        }
        return false;
    }

    /**
     * Get weekly stats summary
     */
    function getWeeklyStatsSummary() {
        const archiveData = loadArchivedPicks();
        const weeks = Object.keys(archiveData.weeklyStats).sort().reverse();

        return weeks.map(weekId => ({
            week: weekId,
            ...archiveData.weeklyStats[weekId],
            winRate: archiveData.weeklyStats[weekId].total > 0
                ? ((archiveData.weeklyStats[weekId].wins / (archiveData.weeklyStats[weekId].wins + archiveData.weeklyStats[weekId].losses)) * 100).toFixed(1)
                : '0.0'
        }));
    }

    // ===== VIEW TOGGLE (Active/History) =====

    /**
     * Initialize the Active/History view toggle
     */
    function initializeViewToggle() {
        const viewToggle = document.getElementById('view-toggle');
        if (!viewToggle) return;

        const viewBtns = viewToggle.querySelectorAll('.ft-view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Switch view
                const view = btn.dataset.view;
                currentView = view;

                if (view === 'active') {
                    showActiveView();
                } else {
                    showHistoryView();
                }
            });
        });

        log('📌 View toggle initialized');
    }

    /**
     * Switch to active picks view
     */
    function showActiveView() {
        log('📌 Switching to Active view');

        // Remove history stats bar if present
        const existingStatsBar = document.querySelector('.history-stats-bar');
        if (existingStatsBar) existingStatsBar.remove();

        // Show fetch controls
        const fetchControls = document.querySelector('.fetch-controls-wrapper');
        if (fetchControls) fetchControls.style.display = '';

        // Restore active picks
        const savedPicks = loadWeeklyLineupPicks();
        if (savedPicks && savedPicks.length > 0) {
            populateWeeklyLineupTable(savedPicks);
        } else {
            const tbody = document.querySelector('.weekly-lineup-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📊</span><span class="empty-message">No picks fetched yet. Click Fetch to load picks.</span></div></td></tr>';
            }
        }
    }

    /**
     * Switch to history/archived picks view
     */
    function showHistoryView() {
        log('📌 Switching to History view');

        // Hide fetch controls (not needed for history)
        const fetchControls = document.querySelector('.fetch-controls-wrapper');
        if (fetchControls) fetchControls.style.display = 'none';

        // Sync outcomes from dashboard before displaying
        // This ensures archived picks have latest win/loss/push status
        syncArchivedOutcomes();

        // Load and display archived picks
        populateArchivedPicks();
    }

    /**
     * Populate table with archived picks
     */
    function populateArchivedPicks(weekFilter = null) {
        const archiveData = loadArchivedPicks();
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        const tableContainer = document.querySelector('.weekly-lineup-table-wrapper');

        if (!tbody || !tableContainer) return;

        // Get available weeks for dropdown
        const weeks = Object.keys(archiveData.weeklyStats).sort().reverse();

        // Create or update stats bar
        let statsBar = document.querySelector('.history-stats-bar');
        if (!statsBar) {
            statsBar = document.createElement('div');
            statsBar.className = 'history-stats-bar';
            tableContainer.parentNode.insertBefore(statsBar, tableContainer);
        }

        // Calculate stats for selected week or all time
        let stats;
        let filteredPicks;

        if (weekFilter) {
            stats = archiveData.weeklyStats[weekFilter] || { total: 0, tracked: 0, wins: 0, losses: 0, pushes: 0, noAction: 0 };
            filteredPicks = archiveData.picks.filter(p => p.weekOf === weekFilter);
        } else {
            // All time stats
            stats = { total: 0, tracked: 0, wins: 0, losses: 0, pushes: 0, noAction: 0 };
            weeks.forEach(w => {
                const ws = archiveData.weeklyStats[w];
                if (ws) {
                    stats.total += ws.total;
                    stats.tracked += ws.tracked;
                    stats.wins += ws.wins;
                    stats.losses += ws.losses;
                    stats.pushes += ws.pushes;
                    stats.noAction += ws.noAction;
                }
            });
            filteredPicks = archiveData.picks;
        }

        const winRate = (stats.wins + stats.losses) > 0
            ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
            : '0.0';

        // Render stats bar
        statsBar.innerHTML = `
            <div class="history-week-selector">
                <label>Week:</label>
                <select id="week-filter">
                    <option value="">All Time</option>
                    ${weeks.map(w => `<option value="${w}" ${weekFilter === w ? 'selected' : ''}>${w}</option>`).join('')}
                </select>
            </div>
            <div class="stat-item"><span class="stat-value">${stats.total}</span><span class="stat-label">Total Picks</span></div>
            <div class="stat-item"><span class="stat-value">${stats.tracked}</span><span class="stat-label">Tracked</span></div>
            <div class="stat-item"><span class="stat-value wins">${stats.wins}</span><span class="stat-label">Wins</span></div>
            <div class="stat-item"><span class="stat-value losses">${stats.losses}</span><span class="stat-label">Losses</span></div>
            <div class="stat-item"><span class="stat-value pushes">${stats.pushes}</span><span class="stat-label">Pushes</span></div>
            <div class="stat-item"><span class="stat-value win-rate">${winRate}%</span><span class="stat-label">Win Rate</span></div>
        `;

        // Add week filter change handler
        const weekSelect = statsBar.querySelector('#week-filter');
        if (weekSelect) {
            weekSelect.addEventListener('change', (e) => {
                const selectedWeek = e.target.value || null;
                populateArchivedPicks(selectedWeek);
            });
        }

        // Clear table
        tbody.innerHTML = '';

        // Show empty state if no archived picks
        if (!filteredPicks || filteredPicks.length === 0) {
            tbody.innerHTML = '<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📦</span><span class="empty-message">No archived picks yet. Completed games will appear here.</span></div></td></tr>';
            return;
        }

        // Sort by archived date (most recent first)
        filteredPicks.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

        // Render archived picks
        filteredPicks.forEach((pick, idx) => {
            const row = createArchivedPickRow(pick, idx);
            tbody.appendChild(row);
        });

        // Apply zebra striping
        applyZebraStripes();

        log(`📦 Displayed ${filteredPicks.length} archived picks`);
    }

    /**
     * Create a table row for an archived pick
     */
    function createArchivedPickRow(pick, idx) {
        const row = document.createElement('tr');
        row.classList.add('archived-pick-row');

        // XSS protection
        const escapeHtml = (str) => {
            if (!str) return '';
            if (window.PicksDOMUtils?.escapeHtml) {
                return window.PicksDOMUtils.escapeHtml(str);
            }
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        // Get team info for logos
        const awayInfo = getTeamInfo(pick.awayTeam);
        const homeInfo = getTeamInfo(pick.homeTeam);
        const leagueLogo = resolveLeagueLogo(pick.sport || pick.league || 'NBA');

        // Outcome badge
        const outcomeClass = pick.outcome || 'no-action';
        const outcomeLabel = pick.outcome === 'win' ? 'W'
            : pick.outcome === 'loss' ? 'L'
            : pick.outcome === 'push' ? 'P'
            : '-';

        // Tracked indicator
        const trackedHtml = pick.sentToDashboard
            ? '<span class="tracked-indicator" title="Sent to Dashboard">✓</span>'
            : '';

        // Fire display
        const fireValue = pick.fire || pick.fireRating || 0;
        const fireEmojis = '🔥'.repeat(Math.min(fireValue, 5));
        const fireLabel = pick.fireLabel || ['', '', 'Warm', 'Warm', 'Hot', 'Max'][fireValue] || '';

        // Edge class
        const edgeValue = parseFloat(pick.edge) || 0;
        const edgeClass = edgeValue >= 5 ? 'high' : edgeValue >= 2 ? 'medium' : 'low';

        // Segment display
        const segmentDisplay = pick.segment === '1H' ? '1st Half'
            : pick.segment === '2H' ? '2nd Half'
            : 'Full Game';

        // Pick display
        let pickDisplay = escapeHtml(pick.pickTeam || '');
        if (pick.line) {
            pickDisplay += ` <span class="line-value">${escapeHtml(pick.line)}</span>`;
        }
        if (pick.odds) {
            pickDisplay += ` <span class="odds-value">(${escapeHtml(pick.odds)})</span>`;
        }

        row.innerHTML = `
            <td class="col-datetime">
                <div class="datetime-cell">
                    <span class="date-text">${escapeHtml(pick.date || '')}</span>
                    <span class="time-text">${escapeHtml(pick.time || '')}</span>
                </div>
            </td>
            <td class="center col-league">
                ${leagueLogo ? `<img src="${leagueLogo}" class="league-logo-sm" alt="${pick.sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-label-sm">${escapeHtml(pick.sport || '')}</span>
            </td>
            <td class="col-matchup">
                <div class="matchup-cell">
                    <div class="team-line away">
                        ${awayInfo.logo ? `<img src="${awayInfo.logo}" class="team-logo-sm" alt="${awayInfo.abbr}" loading="lazy" onerror="this.style.display='none'">` : ''}
                        <span class="team-name-full">${escapeHtml(pick.awayTeam || '')}</span>
                    </div>
                    <span class="vs-label">@</span>
                    <div class="team-line home">
                        ${homeInfo.logo ? `<img src="${homeInfo.logo}" class="team-logo-sm" alt="${homeInfo.abbr}" loading="lazy" onerror="this.style.display='none'">` : ''}
                        <span class="team-name-full">${escapeHtml(pick.homeTeam || '')}</span>
                    </div>
                </div>
            </td>
            <td class="center col-segment">
                <span class="segment-badge">${segmentDisplay}</span>
            </td>
            <td class="col-pick">
                <div class="pick-cell">
                    <span class="pick-display">${pickDisplay}</span>
                </div>
            </td>
            <td class="center col-market">
                <span class="market-value">${escapeHtml(pick.modelSpread || pick.modelPrice || pick.predictedSpread || pick.predictedTotal || '-')}</span>
            </td>
            <td class="center col-edge">
                <span class="edge-value edge-${edgeClass}">${edgeValue.toFixed(1)}%</span>
            </td>
            <td class="center col-fire">
                <span class="fire-display" title="${fireLabel}">${fireEmojis || '-'}</span>
            </td>
            <td class="center col-track">
                <span class="outcome-badge ${outcomeClass}">${outcomeLabel}</span>
                ${trackedHtml}
            </td>
        `;

        return row;
    }

    // ===== POPULATE WEEKLY LINEUP TABLE =====
    function populateWeeklyLineupTable(picks) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;

        // Store picks for sorting
        allPicks = picks;

        // Save picks to localStorage for persistence across page refreshes
        saveWeeklyLineupPicks(picks);

        // Clear placeholder/stale rows
        tbody.innerHTML = '';

        // Show empty state if no picks
        if (!picks || picks.length === 0) {
            tbody.innerHTML = '<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📊</span><span class="empty-message">No picks available. Try fetching again or check back later.</span></div></td></tr>';
            log('📊 No picks to display');
            return;
        }

        // Add each pick as a row
        picks.forEach((pick, idx) => {
            const row = createWeeklyLineupRow(pick, idx);
            tbody.appendChild(row);
        });

        // Apply zebra striping
        applyZebraStripes();

        log(`📊 Populated weekly lineup table with ${picks.length} picks`);
    }

    function applyZebraStripes() {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'))
            .filter((row) => row.style.display !== 'none' && !row.classList.contains('empty-state-row'));
        rows.forEach((row, idx) => {
            row.classList.remove('even', 'odd');
            row.classList.add(idx % 2 === 0 ? 'even' : 'odd');
        });
    }

    function createWeeklyLineupRow(pick, idx) {
        const row = document.createElement('tr');

        // XSS protection - escape HTML in user/API-provided data
        const escapeHtml = (str) => {
            if (!str) return '';
            if (window.PicksDOMUtils?.escapeHtml) {
                return window.PicksDOMUtils.escapeHtml(str);
            }
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        // Fix UNDE typo globally - applies to any string
        const fixUnde = (str) => {
            if (!str || typeof str !== 'string') return str;
            return str.replace(/\bUNDE\b/gi, 'UNDER');
        };

        // Format date in CST (Central Time) - always show as CST
        const formatDate = (dateStr) => {
            if (!dateStr) return 'TBD';
            // Try to parse and convert to CST
            const d = new Date(dateStr);
            if (isNaN(d)) return dateStr;
            // Convert to CST (America/Chicago)
            try {
                return d.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    timeZone: 'America/Chicago'
                });
            } catch (e) {
                // fallback if timeZone not supported
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
        };

        // Format time in CST (Central Time)
        const formatTime = (timeStr, dateStr) => {
            // If timeStr is already formatted, use it
            if (!timeStr) return 'TBD';
            // Try to parse as a time on the given date
            let d;
            if (dateStr) {
                d = new Date(dateStr + 'T' + timeStr);
            } else {
                d = new Date('1970-01-01T' + timeStr);
            }
            if (isNaN(d)) return timeStr;
            try {
                return d.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                    timeZone: 'America/Chicago'
                }) + ' CST';
            } catch (e) {
                return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' CST';
            }
        };

        // Use raw team names for lookup/records (escaping is only for rendering).
        const rawAwayTeam = (pick.awayTeam ?? '').toString().trim();
        const rawHomeTeam = (pick.homeTeam ?? '').toString().trim();
        const rawPickTeam = (pick.pickTeam ?? '').toString().trim();

        const awayTeamName = escapeHtml(rawAwayTeam) || 'TBD';
        const homeTeamName = escapeHtml(rawHomeTeam) || 'TBD';
        const pickTeamName = fixUnde(escapeHtml(rawPickTeam)) || 'Unknown';

        const awayInfo = getTeamInfo(rawAwayTeam || awayTeamName);
        const homeInfo = getTeamInfo(rawHomeTeam || homeTeamName);
        const pickInfo = getTeamInfo(rawPickTeam || pickTeamName);

        // Get team records - try pick data first, then AutoGameFetcher
        const getRecord = (teamName) => {
            if (window.AutoGameFetcher && window.AutoGameFetcher.getTeamRecord) {
                return window.AutoGameFetcher.getTeamRecord(teamName);
            }
            return '';
        };
        const awayRecord = escapeHtml(pick.awayRecord || getRecord(rawAwayTeam));
        const homeRecord = escapeHtml(pick.homeRecord || getRecord(rawHomeTeam));

        // Build pick display (escape the label)
        const pickLabel = fixUnde(escapeHtml(buildPickLabel(pick)));
        // Normalize pickTeamName - ensure "Under" is spelled correctly (not "UNDE")
        const normalizedPickTeamName = (pickTeamName.toUpperCase() === 'UNDE' || pickTeamName.toUpperCase().startsWith('UNDE'))
            ? 'UNDER'
            : pickTeamName;
        const isTeamPick = normalizedPickTeamName !== 'Over' && normalizedPickTeamName !== 'Under' && normalizedPickTeamName !== 'OVER' && normalizedPickTeamName !== 'UNDER';
        const pickType = normalizePickType(pick.pickType || pick.market || 'spread');

        // Helper function to escape regex metacharacters
        const escapeRegex = (str) => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // Create logo HTML (robust fallback)
        const awayLogoHtml = awayInfo.logo
            ? `<img src="${awayInfo.logo}" class="team-logo" loading="eager" alt="${awayInfo.abbr}" onerror="this.style.display='none'">`
            : `<span class="team-logo-missing">?</span>`;
        const homeLogoHtml = homeInfo.logo
            ? `<img src="${homeInfo.logo}" class="team-logo" loading="eager" alt="${homeInfo.abbr}" onerror="this.style.display='none'">`
            : `<span class="team-logo-missing">?</span>`;
        const pickLogoHtml = pickInfo.logo
            ? `<img src="${pickInfo.logo}" class="pick-team-logo" loading="eager" alt="${pickInfo.abbr}" onerror="this.style.display='none'">`
            : '';

        // Matchup HTML with logos and records, always show both teams if available
        const isSingleTeamBet = !pick.homeTeam || pick.homeTeam === 'TBD';

        const awayTeamHtml = `
            <div class="team-line team-away">
                ${awayLogoHtml}
                <div class="team-name-wrapper">
                    <span class="team-name-full">${awayTeamName}</span>
                    <span class="team-record">${awayRecord ? `(${awayRecord})` : ''}</span>
                </div>
            </div>`;

        const homeTeamHtml = `
            <div class="team-line team-home">
                ${homeLogoHtml}
                <div class="team-name-wrapper">
                    <span class="team-name-full">${homeTeamName}</span>
                    <span class="team-record">${homeRecord ? `(${homeRecord})` : ''}</span>
                </div>
            </div>`;

        const matchupHtml = isSingleTeamBet
            ? `<div class="matchup-cell">${awayTeamHtml}</div>`
            : `<div class="matchup-cell">${awayTeamHtml}<div class="vs-divider">vs.</div>${homeTeamHtml}</div>`;

        const pickOdds = escapeHtml(pick.odds) || '-110';

        // Pick cell - unified structure: [Logo] Subject Value (Juice)
        let pickCellHtml;
        if (isTeamPick) {
            if (pickType === 'ml') {
                // Moneyline: [Logo] DEN ML -260
                pickCellHtml = `<div class="pick-cell">${pickLogoHtml}<span class="pick-subject">${pickInfo.abbr}</span><span class="pick-label">ML</span><span class="pick-value">${pickOdds}</span></div>`;
            } else {
                // Spread: [Logo] DEN -5.5 (-110)
                pickCellHtml = `<div class="pick-cell">${pickLogoHtml}<span class="pick-subject">${pickInfo.abbr}</span><span class="pick-value">${pickLabel}</span><span class="pick-juice">(${pickOdds})</span></div>`;
            }
        } else {
            // Over/Under: OVER 218.5 (-110) or UNDER 261.5 (-110)
            // Ensure proper capitalization and fix "UNDE" typo
            let directionText = '';
            if (normalizedPickTeamName && (normalizedPickTeamName.toUpperCase() === 'OVER' || normalizedPickTeamName.toUpperCase() === 'UNDER')) {
                directionText = normalizedPickTeamName.toUpperCase();
            } else if (pickLabel.toUpperCase().startsWith('OVER')) {
                directionText = 'OVER';
            } else if (pickLabel.toUpperCase().startsWith('UNDER') || pickLabel.toUpperCase().startsWith('UNDE')) {
                directionText = 'UNDER';
            } else if (pick.pickDirection) {
                directionText = pick.pickDirection.toUpperCase();
            }

            // If pickLabel already contains OVER/UNDER, use it directly; otherwise prepend direction
            // Note: pickLabel is already HTML-escaped, so we don't escape again
            // Fix any remaining UNDE → UNDER (with or without space)
            let displayLabel = pickLabel.replace(/^UNDE\b/gi, 'UNDER');
            if (!displayLabel.toUpperCase().startsWith('OVER') && !displayLabel.toUpperCase().startsWith('UNDER')) {
                displayLabel = directionText ? `${escapeHtml(directionText)} ${displayLabel}` : displayLabel;
            }
            pickCellHtml = `<div class="pick-cell"><span class="pick-value">${displayLabel}</span><span class="pick-juice">(${pickOdds})</span></div>`;
        }

        // Model Prediction - shows model's line/odds
        const getModelPredictionHtml = () => {
            const modelPriceRaw = pick.modelPrice ?? pick.model_price ?? '';
            const modelPrice = escapeHtml(modelPriceRaw);
            const hasModelOdds = modelPrice && modelPrice !== '-' && modelPrice.toUpperCase() !== 'N/A';
            const modelSpread = escapeHtml(pick.modelSpread || pick.predictedSpread) || pickLabel || '';
            const teamAbbrev = isTeamPick ? pickInfo.abbr : normalizedPickTeamName;
            const logoHtml = isTeamPick && pickInfo.logo
                ? `<img src="${pickInfo.logo}" class="prediction-logo" loading="eager" alt="${teamAbbrev}" onerror="this.style.display='none'">`
                : '';

            if (pickType === 'ml') {
                // ML: [Logo] DEN [ML] -180
                const oddsHtml = hasModelOdds ? `<span class="pred-odds">${modelPrice}</span>` : '';
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-type-badge">ML</span>${oddsHtml}</div>`;
            } else if (pickType === 'spread') {
                // Spread: [Logo] DEN -3.5 (-108)
                const oddsHtml = hasModelOdds ? `<span class="pred-odds-muted">(${modelPrice})</span>` : '';
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-line">${modelSpread}</span>${oddsHtml}</div>`;
            } else if (pickType === 'total' || pickType === 'tt') {
                // Total: Over 221.5 (-110)
                const oddsHtml = hasModelOdds ? `<span class="pred-odds-muted">(${modelPrice})</span>` : '';
                return `<div class="prediction-cell"><span class="pred-direction">${teamAbbrev}</span><span class="pred-line">${modelSpread}</span>${oddsHtml}</div>`;
            }
            return `<div class="prediction-cell"><span class="pred-odds">${hasModelOdds ? modelPrice : '-'}</span></div>`;
        };

        const modelPredictionHtml = getModelPredictionHtml();

        // Market Odds - actual market line for comparison
        const getMarketHtml = () => {
            const teamAbbrev = isTeamPick ? pickInfo.abbr : normalizedPickTeamName;
            const logoHtml = isTeamPick && pickInfo.logo
                ? `<img src="${pickInfo.logo}" class="prediction-logo" loading="eager" alt="${teamAbbrev}" onerror="this.style.display='none'">`
                : '';

            if (pickType === 'ml') {
                // ML: [Logo] DEN [ML] -260
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-type-badge">ML</span><span class="pred-odds">${pickOdds}</span></div>`;
            } else if (pickType === 'spread') {
                // Spread: [Logo] DEN -5.5 (-110)
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-line">${pickLabel}</span><span class="pred-odds-muted">(${pickOdds})</span></div>`;
            } else if (pickType === 'total' || pickType === 'tt') {
                // Total: Over 221.5 (-110)
                return `<div class="prediction-cell"><span class="pred-direction">${teamAbbrev}</span><span class="pred-line">${pickLabel}</span><span class="pred-odds-muted">(${pickOdds})</span></div>`;
            }
            return `<div class="prediction-cell"><span class="pred-odds">${pickOdds}</span></div>`;
        };

        const marketHtml = getMarketHtml();

        // Edge and Fire rating
        const edge = parseFloat(pick.edge) || 0;
        const normalizedFire = normalizeFireRating(pick.fire ?? pick.confidence ?? pick.fire_rating ?? pick.fireRating, edge);
        const fire = normalizedFire.fire;
        const fireLabel = escapeHtml(pick.fireLabel || normalizedFire.fireLabel) || '';

        // Generate fire emoji display with styled MAX badge
        const fireEmojis = '🔥'.repeat(fire);
        const fireDisplay = fireLabel ? `${fireEmojis} <span class="fire-max-badge">${fireLabel}</span>` : fireEmojis;

        // Edge color class based on value
        const getEdgeClass = (edgeVal) => {
            if (edgeVal >= 10) return 'edge-hot';
            if (edgeVal >= 5) return 'edge-good';
            if (edgeVal >= 2.5) return 'edge-ok';
            return 'edge-low';
        };

        const sport = escapeHtml((pick.sport || 'NCAAB').toUpperCase());
        const gameDate = pick.date || pick.gameDate;
        const gameTime = escapeHtml(pick.time || pick.gameTime) || 'TBD';

        const sportsbookLabel = normalizeSportsbookLabel(pick.sportsbook || pick.book || '');
        const sportsbookHtml = sportsbookLabel
            ? `<span class="sportsbook-value" title="Sportsbook">${escapeHtml(sportsbookLabel)}</span>`
            : `<button type="button" class="sportsbook-set-btn" data-pick-key="${escapeHtml(buildPickKey(pick))}" title="Set sportsbook">+ Book</button>`;

        // Segment display
        const rawSegment = escapeHtml(pick.segment) || 'FG';
        const segment = normalizeSegment(rawSegment);
        const getSegmentDisplay = (seg) => {
            const segmentMap = {
                'full': 'Full Game',
                '1h': '1st Half',
                '2h': '2nd Half'
            };
            return segmentMap[seg] || rawSegment;
        };

        // Rationale + model version stamp (when provided by APIs)
        const rationaleId = `wl-rationale-${idx}`;
        const rationaleRaw = (pick.rationale ?? pick.reason ?? pick.notes ?? pick.explanation ?? '').toString().trim();
        const modelStampRaw = (pick.modelStamp ?? pick.modelVersion ?? pick.modelTag ?? '').toString().trim();

        // Build model prediction vs market comparison - cleaner format
        const modelPriceRaw = pick.modelPrice || pick.model_price || '';
        const modelLineRaw = pick.modelSpread || pick.predictedSpread || pick.modelLine || '';
        const modelTotal = pick.modelTotal || pick.predicted_total || '';
        const edgeValue = edge.toFixed(1);

        // For totals, show the predicted total vs market total
        // For spreads, show the predicted spread vs market spread
        let modelDisplay = '-';
        let marketDisplay = '-';

        if (!isTeamPick) {
            // Total pick - show totals
            const direction = normalizedPickTeamName.toUpperCase() === 'OVER' ? 'OVER' : 'UNDER';
            const marketTotal = pick.line || '';
            modelDisplay = modelTotal ? `${direction} ${modelTotal}` : `${direction} (model: ${modelPriceRaw || '-'})`;
            marketDisplay = `${direction} ${marketTotal}`;
        } else {
            // Team pick - show spread/line
            const teamAbbr = escapeHtml(pickInfo.abbr || pickTeamName);
            modelDisplay = modelLineRaw ? `${teamAbbr} ${modelLineRaw}` : `${teamAbbr} (${modelPriceRaw || '-'})`;
            marketDisplay = `${teamAbbr} ${escapeHtml(pick.line || '')}`;
        }

        // Build comparison section - horizontal header row
        const hasModelLine = modelLineRaw || modelTotal;
        const hasMarketLine = pick.line;

        // Single row: Model vs Market vs Edge
        let comparisonHtml = `
            <div class="details-header">
                <div class="details-col">
                    <span class="details-label">Model</span>
                    <span class="details-val model-val">${hasModelLine ? (modelLineRaw || modelTotal) : '-'}</span>
                </div>
                <div class="details-col">
                    <span class="details-label">Market</span>
                    <span class="details-val market-val">${hasMarketLine ? pick.line : '-'} <span class="odds-tag">${pickOdds}</span></span>
                </div>
                <div class="details-col">
                    <span class="details-label">Edge</span>
                    <span class="details-val edge-val">+${edgeValue}%</span>
                </div>
            </div>`;

        // Format rationale - clean bullet points, left-aligned
        const formatRationale = (text) => {
            if (!text) return '';

            const escaped = escapeHtml(text);
            // Split on periods followed by space, newlines, or semicolons
            const points = escaped
                .split(/(?<=[.!?])\s+|\n|;\s*/)
                .map(s => s.trim())
                .filter(s => s.length > 5 && !s.match(/^[A-Z]{2,4}$/)); // Filter out tiny fragments

            if (points.length === 0) return '';
            if (points.length === 1) {
                return `<div class="rationale-text">${points[0]}</div>`;
            }

            return `<ul class="rationale-list">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
        };

        const rationaleHtml = formatRationale(rationaleRaw);
        const modelStampHtml = modelStampRaw
            ? `<div class="details-footer">${escapeHtml(modelStampRaw)}</div>`
            : '';

        // Set data attributes for sorting and filtering
        row.setAttribute('data-edge', edge);
        row.setAttribute('data-fire', fire);
        row.setAttribute('data-time', gameTime);
        row.setAttribute('data-pick-type', pickType);
        row.setAttribute('data-league', sport);
        row.setAttribute('data-segment', segment);
        row.setAttribute('data-matchup', `${awayTeamName} @ ${homeTeamName}`);
        row.setAttribute('data-market', pickOdds);
        row.setAttribute('data-model', pick.modelSpread || pick.modelPrice || pick.predictedSpread || pick.predictedTotal || '');
        row.setAttribute('data-pick', pickTeamName);
        row.setAttribute('data-pick-key', buildPickKey(pick));
        row.setAttribute('data-sportsbook', sportsbookLabel);

        // Set additional data attributes for filtering
        row.setAttribute('data-away', awayTeamName);
        row.setAttribute('data-home', homeTeamName);
        row.setAttribute('data-status', pick.status || 'pending');

        // Check if this pick is tracked and detect changes
        const tracked = getTrackingMetadata(pick);
        const changes = tracked ? detectPickChanges(pick, tracked) : null;
        const isTracked = !!tracked;
        const trackedTime = tracked ? formatTrackedTime(tracked.trackedAt) : '';

        // Add tracking indicator class
        if (isTracked) {
            row.classList.add('pick-tracked');
        }
        if (changes) {
            row.classList.add('pick-changed');
        }

        // Build change indicators HTML
        let changeIndicatorsHtml = '';
        if (changes) {
            const changeItems = [];
            if (changes.line) {
                changeItems.push(`Line: ${changes.line.from} → ${changes.line.to}`);
            }
            if (changes.odds) {
                changeItems.push(`Odds: ${changes.odds.from} → ${changes.odds.to}`);
            }
            if (changes.edge) {
                changeItems.push(`Edge: ${changes.edge.from.toFixed(1)}% → ${changes.edge.to.toFixed(1)}%`);
            }
            if (changes.fire) {
                changeItems.push(`Fire: ${changes.fire.from} → ${changes.fire.to}`);
            }

            changeIndicatorsHtml = `
                <div class="pick-change-alert" title="${changeItems.join(', ')}">
                    <span class="change-icon">⚠️</span>
                    <span class="change-text">Changed</span>
                </div>
            `;
        }

        // Build tracking status HTML for Track column
        let trackingStatusHtml = '';
        if (isTracked) {
            trackingStatusHtml = `
                <div class="tracking-status">
                    <div class="tracked-badge" title="Tracked ${trackedTime}">
                        <span class="tracked-icon">✓</span>
                        <span class="tracked-time">${trackedTime}</span>
                    </div>
                    ${changeIndicatorsHtml}
                    <button class="remove-tracked-btn" type="button" title="Remove from Dashboard">✕</button>
                </div>
            `;
        }

        // Update pick cell to show changes if line/odds changed
        let updatedPickCellHtml = pickCellHtml;
        if (changes && (changes.line || changes.odds)) {
            const changeClass = changes.line || changes.odds ? 'pick-value-changed' : '';
            // Wrap the changed values with indicators
            // Note: pickCellHtml contains HTML-escaped values, so we need to escape the search value too
            if (changes.line) {
                // Escape the value for HTML (to match what's in the HTML) and escape regex metacharacters
                const escapedLineTo = escapeHtml(changes.line.to);
                const escapedLineFrom = escapeHtml(changes.line.from);
                const regexPattern = escapeRegex(escapedLineTo);
                updatedPickCellHtml = updatedPickCellHtml.replace(
                    new RegExp(`(${regexPattern})`, 'g'),
                    `<span class="value-changed ${changeClass}" title="Was: ${escapedLineFrom}">$1</span>`
                );
            }
            if (changes.odds) {
                // Escape the value for HTML (to match what's in the HTML) and escape regex metacharacters
                const escapedOddsTo = escapeHtml(changes.odds.to);
                const escapedOddsFrom = escapeHtml(changes.odds.from);
                const regexPattern = escapeRegex(escapedOddsTo);
                updatedPickCellHtml = updatedPickCellHtml.replace(
                    new RegExp(`\\(${regexPattern}\\)`, 'g'),
                    `<span class="value-changed ${changeClass}" title="Was: ${escapedOddsFrom}">(${escapedOddsTo})</span>`
                );
            }
        }

        // Update edge display if changed
        let edgeDisplayHtml = `<span class="edge-value ${getEdgeClass(edge)}">+${edge.toFixed(1)}</span>`;
        if (changes && changes.edge) {
            edgeDisplayHtml = `
                <div class="edge-value-wrapper">
                    <span class="edge-value ${getEdgeClass(edge)} value-changed" title="Was: ${changes.edge.from.toFixed(1)}%">+${edge.toFixed(1)}</span>
                    <span class="edge-change-indicator">⚠️</span>
                </div>
            `;
        }

        // League cell HTML with logo
        // Use LogoLoader for league logo
        const leagueLogo = window.LogoLoader ? window.LogoLoader.getLeagueLogoUrl(sport) : '';
        const leagueCellHtml = `
            <div class="league-cell">
                ${leagueLogo ? `<img src="${leagueLogo}" class="league-logo" loading="eager" alt="${sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-abbr">${sport}</span>
            </div>`;

        row.innerHTML = `
            <td data-label="Date/Time">
                <div class="datetime-cell">
                    <span class="date-value">${formatDate(gameDate)}</span>
                    <span class="time-value">${formatTime(pick.time || pick.gameTime, gameDate)}</span>
                    ${sportsbookHtml}
                </div>
            </td>
            <td data-label="League" class="center">
                ${leagueCellHtml}
            </td>
            <td data-label="Matchup">
                ${matchupHtml}
            </td>
            <td data-label="Segment" class="center">
                <span class="segment-value game-segment">${getSegmentDisplay(segment)}</span>
            </td>
            <td data-label="Recommended Pick">
                <div class="pick-cell-wrapper">
                    <div class="pick-cell-content">
                        ${updatedPickCellHtml}
                        <button class="rationale-toggle" type="button" aria-expanded="false" aria-controls="${rationaleId}" title="Show details">Details</button>
                    </div>
                    <div class="rationale-panel" id="${rationaleId}" hidden>
                        ${comparisonHtml}
                        ${rationaleHtml ? `<div class="rationale-body">${rationaleHtml}</div>` : ''}
                        ${modelStampHtml}
                    </div>
                </div>
            </td>
            <td data-label="Market" class="center col-market">
                <div class="market-stack">
                    <div class="market-row market-row-model">
                        <span class="market-label">Model</span>
                        <div class="market-pick">${modelPredictionHtml}</div>
                    </div>
                    <div class="market-row market-row-market">
                        <span class="market-label">Market</span>
                        <div class="market-pick">${marketHtml}</div>
                    </div>
                </div>
            </td>
            <td data-label="Edge" class="center">
                ${edgeDisplayHtml}
            </td>
            <td data-label="Fire" class="center">
                <span class="fire-rating">${fireDisplay}</span>
            </td>
            <td data-label="Track" class="center">
                ${isTracked ? trackingStatusHtml : '<button class="tracker-btn" type="button">+</button>'}
            </td>
        `;

        return row;
    }

    function initializeSportsbookEditors() {
        const tbody = document.getElementById('picks-tbody') || document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;

        const choices = [
            'Hulk Wager',
            'Bombay 711',
            'King of Sports',
            'Prime Time Action',
            'Manual'
        ];

        tbody.addEventListener('click', function(e) {
            const btn = e.target.closest('.sportsbook-set-btn');
            if (!btn) return;

            const pickKey = btn.getAttribute('data-pick-key');
            if (!pickKey) return;

            const pick = Array.isArray(allPicks) ? allPicks.find(p => buildPickKey(p) === pickKey) : null;
            if (!pick) return;

            const current = normalizeSportsbookLabel(pick.sportsbook || '');
            const promptMsg = `Set sportsbook\n\nOptions: ${choices.join(', ')}\n\nEnter a sportsbook name:`;
            const next = window.prompt(promptMsg, current || choices[0] || '');
            if (next === null) return;

            const normalized = normalizeSportsbookLabel(next);
            pick.sportsbook = normalized;
            setSportsbookOverride(pick, normalized);
            saveWeeklyLineupPicks(allPicks);

            // Update the cell in-place
            try {
                const container = btn.closest('.datetime-cell');
                if (container) {
                    const safe = window.PicksDOMUtils?.escapeHtml
                        ? window.PicksDOMUtils.escapeHtml(normalized)
                        : (() => { const d = document.createElement('div'); d.textContent = normalized; return d.innerHTML; })();
                    btn.outerHTML = `<span class="sportsbook-value" title="Sportsbook">${safe}</span>`;
                }
            } catch (_) {}

            showNotification(`Sportsbook set: ${normalized}`, 'success');
        });
    }



    // ===== TIME SLOTS FILTER =====
    function initializeTimeSlots() {
        const timeSlots = document.querySelectorAll('.time-slot');
        timeSlots.forEach(slot => {
            slot.addEventListener('click', function() {
                this.classList.toggle('active');
                // Apply filters using TableFilters module
                if (window.TableFilters) {
                    window.TableFilters.applyFilters();
                }
            });
        });
    }

    // ===== DATE RANGE SELECTOR =====
    function initializeDateRangeSelector() {
        const dateRangeButtons = document.querySelectorAll('.date-range-btn');
        dateRangeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                dateRangeButtons.forEach(b => b.classList.remove('active'));
                // Add active to clicked button
                this.classList.add('active');

                const range = this.getAttribute('data-range');
                handleDateRangeSelection(range);

                // Apply filters using TableFilters module
                if (window.TableFilters) {
                    window.TableFilters.applyFilters();
                }
            });
        });
    }

    // ===== DATE RANGE HANDLER =====
    function handleDateRangeSelection(range) {
        const today = new Date();
        let startDate, endDate;

        switch(range) {
            case 'today':
                startDate = today;
                endDate = today;
                break;
            case 'tomorrow':
                startDate = new Date(today);
                startDate.setDate(today.getDate() + 1);
                endDate = startDate;
                break;
            case 'week':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                break;
            case 'weekend':
                // Find next Friday-Sunday
                const dayOfWeek = today.getDay();
                const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
                startDate = new Date(today);
                startDate.setDate(today.getDate() + daysUntilFriday);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 2);
                break;
            case 'next7':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                break;
            case 'custom':
                // Would open a date picker modal
                return;
        }

        // Apply date filter logic here
    }

    // ===== FILTER INITIALIZATION =====
    function initializeFilters() {
        filterInitAttempts++;
        log(`[Weekly Lineup] initializeFilters() attempt ${filterInitAttempts}`);

        const table = document.querySelector('.weekly-lineup-table');
        if (!table) {
            if (filterInitAttempts < MAX_FILTER_INIT_ATTEMPTS) {
                setTimeout(initializeFilters, 200);
            }
            return;
        }

        // Set up filter button click handlers
        const filterButtons = document.querySelectorAll('.th-filter-btn[data-filter]');

        if (filterButtons.length === 0) {
            if (filterInitAttempts < MAX_FILTER_INIT_ATTEMPTS) {
                setTimeout(initializeFilters, 200);
            }
            return;
        }

        log(`[Weekly Lineup] Setting up ${filterButtons.length} filter buttons`);
        setupFilterButtons(filterButtons);
    }

    // Separate function for setting up filter buttons (allows retry)
    function setupFilterButtons(filterButtons) {
        // Keep one active dropdown anchored
        let activeDropdown = null;
        let activeBtn = null;

        const closeAllDropdowns = () => {
            document.querySelectorAll('.th-filter-dropdown').forEach(dd => {
                dd.classList.remove('open');
                dd.setAttribute('hidden', '');
                dd.hidden = true;
                // Clear inline styles that were forcing visibility
                dd.style.removeProperty('display');
                dd.style.removeProperty('visibility');
                dd.style.removeProperty('opacity');
            });
            document.querySelectorAll('.th-filter-btn').forEach(btn => {
                btn.setAttribute('aria-expanded', 'false');
            });
            activeDropdown = null;
            activeBtn = null;
        };

        const positionDropdown = (dropdown, btn) => {
            const btnRect = btn.getBoundingClientRect();
            const thRect = btn.closest('th').getBoundingClientRect();
            const tableRect = document.querySelector('.weekly-lineup-table')?.getBoundingClientRect();

            // Position dropdown BELOW the header row (dropping down)
            // CRITICAL: Clear any conflicting CSS positioning first
            dropdown.style.setProperty('position', 'fixed', 'important');
            dropdown.style.setProperty('bottom', 'auto', 'important');
            dropdown.style.setProperty('right', 'auto', 'important');
            dropdown.style.setProperty('top', (thRect.bottom + 8) + 'px', 'important');

            // Get dropdown width for centering calculation
            dropdown.style.visibility = 'hidden';
            dropdown.style.display = 'flex';
            const dropdownWidth = dropdown.offsetWidth || 300;

            // Center on the column, but keep within viewport
            let left = thRect.left + (thRect.width / 2) - (dropdownWidth / 2);
            left = Math.max(16, Math.min(left, window.innerWidth - dropdownWidth - 16));
            dropdown.style.setProperty('left', left + 'px', 'important');

            // Ensure dropdown doesn't go off-screen bottom
            const viewportHeight = window.innerHeight;
            const dropdownMaxHeight = viewportHeight - thRect.bottom - 32;
            dropdown.style.maxHeight = Math.min(dropdownMaxHeight, 500) + 'px';
            dropdown.style.overflowY = 'auto';
        };

        const applyWeeklyDropdownLook = (dropdown) => {
            // Don't clear styles completely - just ensure correct values
            // Removing all styles can cause positioning issues

            // Force the card look at the strongest layer (inline + important)
            dropdown.style.setProperty('display', 'flex', 'important');
            dropdown.style.setProperty('flex-direction', 'column', 'important');
            dropdown.style.setProperty('visibility', 'visible', 'important');
            dropdown.style.setProperty('opacity', '1', 'important');
            dropdown.style.setProperty('position', 'fixed', 'important');
            dropdown.style.setProperty('z-index', '2147483647', 'important');
            dropdown.style.setProperty('pointer-events', 'auto', 'important');

            dropdown.style.setProperty('min-width', '240px', 'important');
            dropdown.style.setProperty('max-width', '320px', 'important');
            dropdown.style.setProperty('padding', '0', 'important');
            dropdown.style.setProperty('border-radius', '14px', 'important');
            dropdown.style.setProperty(
                'background',
                'linear-gradient(180deg, rgba(10, 16, 28, 0.92) 0%, rgba(6, 10, 20, 0.94) 100%)',
                'important'
            );
            dropdown.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.12)', 'important');
            dropdown.style.setProperty(
                'box-shadow',
                '0 18px 50px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(0, 0, 0, 0.35), 0 0 22px rgba(0, 214, 137, 0.10)',
                'important'
            );
            dropdown.style.setProperty('backdrop-filter', 'blur(16px) saturate(120%)', 'important');
            dropdown.style.setProperty('-webkit-backdrop-filter', 'blur(16px) saturate(120%)', 'important');
            dropdown.style.setProperty('overflow-x', 'hidden', 'important');
            dropdown.style.setProperty('overflow-y', 'auto', 'important');

            // Grid normalization so we never get the “3-column empty space bar”
            const filterGrids = dropdown.querySelectorAll('.filter-grid');
            filterGrids.forEach((grid) => {
                grid.style.setProperty('display', 'grid', 'important');
                grid.style.setProperty('justify-items', 'stretch', 'important');

                // Date filter is intentionally 3-up. Fire is 4-up. Everything else is 2-up.
                const isDate = dropdown.id === 'filter-date';
                const isMarketOdds = dropdown.id === 'filter-market';
                const isFire = grid.classList.contains('fire-grid');
                // Market odds looks best as a readable list (ranges are long)
                const cols = isDate ? 3 : isFire ? 4 : isMarketOdds ? 1 : 2;
                grid.style.setProperty('grid-template-columns', `repeat(${cols}, minmax(0, 1fr))`, 'important');
                grid.style.setProperty('gap', '10px', 'important');

                // Make "All" span full width (avoids awkward empty cells)
                const allBtns = grid.querySelectorAll(
                    '.filter-opt[data-segment="all"], .filter-opt[data-market="all"], .filter-opt[data-model="all"], .filter-opt[data-odds="all"], .filter-opt[data-edge="all"], .filter-opt[data-fire="all"]'
                );
                allBtns.forEach((btn) => btn.style.setProperty('grid-column', '1 / -1', 'important'));
            });

            // Ensure options are full-width touch targets
            dropdown.querySelectorAll('.filter-opt, .league-chip').forEach((btn) => {
                btn.style.setProperty('width', '100%', 'important');
            });

            const leagueGrid = dropdown.querySelector('.league-grid-compact');
            if (leagueGrid) {
                leagueGrid.style.setProperty('display', 'grid', 'important');
                leagueGrid.style.setProperty('justify-items', 'stretch', 'important');
                leagueGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
                leagueGrid.style.setProperty('gap', '10px', 'important');
                const allLeague = leagueGrid.querySelector('.league-chip[data-league="all"]');
                if (allLeague) allLeague.style.setProperty('grid-column', '1 / -1', 'important');
            }
        };

        const openDropdown = (dropdown, btn) => {
            console.log('📂 [Weekly Lineup] Opening dropdown:', dropdown.id);

            // Close any open dropdown first
            closeAllDropdowns();

            // CRITICAL: Move dropdown to body to escape table stacking context
            if (dropdown.parentElement !== document.body) {
                document.body.appendChild(dropdown);
            }

            // Tag dropdown so weekly-lineup-only styles still apply after moving to <body>
            dropdown.classList.add('weekly-lineup-filter-dropdown');

            // Inject a lightweight header (title + close) once for readability
            if (!dropdown.querySelector('.wl-filter-header')) {
                const rawTitle =
                    btn.getAttribute('aria-label') ||
                    btn.closest('th')?.querySelector('.header-main-text')?.textContent ||
                    btn.getAttribute('data-filter') ||
                    'Filter';

                const cleanedTitle = rawTitle
                    .replace(/^filter by\s+/i, '')
                    .replace(/\s*\(.*?\)\s*/g, '')
                    .trim();

                const header = document.createElement('div');
                header.className = 'wl-filter-header';
                const titleEl = document.createElement('span');
                titleEl.className = 'wl-filter-title';
                titleEl.textContent = cleanedTitle || 'Filter';

                const closeEl = document.createElement('button');
                closeEl.type = 'button';
                closeEl.className = 'wl-filter-close';
                closeEl.setAttribute('aria-label', 'Close filter panel');
                closeEl.textContent = '✕';

                header.appendChild(titleEl);
                header.appendChild(closeEl);
                dropdown.prepend(header);

                const closeBtn = header.querySelector('.wl-filter-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeAllDropdowns();
                        btn.focus();
                    });
                }
            }

            // CRITICAL: Remove hidden attribute BEFORE any other operations
            dropdown.removeAttribute('hidden');
            dropdown.hidden = false; // Belt and suspenders

            // Add the open class
            dropdown.classList.add('open');

            // Apply the card styling (sets visibility, display, z-index, etc.)
            applyWeeklyDropdownLook(dropdown);

            // Position the dropdown relative to the button
            positionDropdown(dropdown, btn);

            // Force visibility with inline !important (overrides any CSS)
            dropdown.style.setProperty('display', 'flex', 'important');
            dropdown.style.setProperty('visibility', 'visible', 'important');
            dropdown.style.setProperty('opacity', '1', 'important');
            dropdown.style.setProperty('top', dropdown.style.top, 'important');
            dropdown.style.setProperty('left', dropdown.style.left, 'important');
            if (dropdown.style.maxHeight) {
                dropdown.style.setProperty('max-height', dropdown.style.maxHeight, 'important');
            }

            btn.setAttribute('aria-expanded', 'true');
            activeDropdown = dropdown;
            activeBtn = btn;

            // Focus first interactive element for accessibility
            const firstFocusable = dropdown.querySelector('button, input, [tabindex="0"]');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 50);
            }

            console.log('✅ [Weekly Lineup] Dropdown opened with inline styles');
        };

        // DIRECT click handlers on each filter button (more reliable than delegation)
        const allFilterButtons = document.querySelectorAll('.th-filter-btn[data-filter]');
        console.log('🔧 [Weekly Lineup] Attaching handlers to', allFilterButtons.length, 'filter buttons');

        allFilterButtons.forEach((btn, index) => {
            const dropdownId = btn.getAttribute('aria-controls');
            console.log(`  → Button ${index}: ${btn.dataset.filter} -> ${dropdownId}`);

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const dropdown = dropdownId ? document.getElementById(dropdownId) : null;
                if (!dropdown) return;

                const isOpen = activeDropdown === dropdown && this.getAttribute('aria-expanded') === 'true' && dropdown.hidden === false;
                if (isOpen) {
                    closeAllDropdowns();
                    return;
                }

                openDropdown(dropdown, this);
            });
        });

        if (allFilterButtons.length === 0) {
            console.error('❌ [Weekly Lineup] NO FILTER BUTTONS FOUND! Check HTML structure.');
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            // Don't close if clicking on a filter button or inside a dropdown
            if (e.target.closest('.th-filter-btn') || e.target.closest('.th-filter-dropdown')) {
                return;
            }
            closeAllDropdowns();
        });

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeAllDropdowns();
            }
        });

        // Reposition on scroll/resize
        let resizeTimeout;
        const handleReposition = () => {
            if (activeDropdown && activeBtn) {
                positionDropdown(activeDropdown, activeBtn);
            }
        };
        window.addEventListener('scroll', handleReposition, { passive: true });
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleReposition, 100);
        });

        // ===== FILTER CHIP HANDLERS =====
        setupFilterChipHandlers();

        console.log('✅ [Weekly Lineup] Filter button setup complete');
    }

    // Setup handlers for filter chips inside dropdowns
    function setupFilterChipHandlers() {
        console.log('🎛️ [Weekly Lineup] Setting up filter chip handlers...');

        // League filter chips (exclusive selection)
        document.querySelectorAll('.league-chip').forEach(chip => {
            chip.addEventListener('click', function(e) {
                e.stopPropagation();
                const leagueValue = this.getAttribute('data-league');
                console.log('🏆 [Weekly Lineup] League chip clicked:', leagueValue);

                // Exclusive selection - remove active from siblings
                const parent = this.closest('.league-grid-compact') || this.parentElement;
                parent.querySelectorAll('.league-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                applyTableFilter('league', leagueValue === 'all' ? '' : leagueValue);
            });
        });

        // Bet type chips (exclusive selection)
        document.querySelectorAll('.filter-opt[data-market]').forEach(chip => {
            chip.addEventListener('click', function(e) {
                e.stopPropagation();
                const marketValue = this.getAttribute('data-market');
                console.log('💰 [Weekly Lineup] Bet type chip clicked:', marketValue);

                const parent = this.closest('.filter-grid') || this.parentElement;
                parent.querySelectorAll('.filter-opt[data-market]').forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                applyTableFilter('pickType', marketValue === 'all' ? '' : marketValue);
            });
        });

        // Segment pills (exclusive selection)
        document.querySelectorAll('.filter-opt[data-segment]').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.stopPropagation();
                const segmentValue = this.getAttribute('data-segment');
                console.log('⏱️ [Weekly Lineup] Segment pill clicked:', segmentValue);

                const parent = this.closest('.filter-grid') || this.parentElement;
                parent.querySelectorAll('.filter-opt[data-segment]').forEach(p => p.classList.remove('active'));
                this.classList.add('active');

                applyTableFilter('segment', segmentValue === 'all' ? '' : segmentValue);
            });
        });

        // Edge filter chips (exclusive selection)
        document.querySelectorAll('.filter-opt[data-edge]').forEach(chip => {
            chip.addEventListener('click', function(e) {
                e.stopPropagation();
                const edgeValue = this.getAttribute('data-edge');
                console.log('🎯 [Weekly Lineup] Edge chip clicked:', edgeValue);

                const parent = this.closest('.filter-grid') || this.parentElement;
                parent.querySelectorAll('.filter-opt[data-edge]').forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                applyTableFilter('edge', edgeValue === 'all' ? '' : edgeValue);
            });
        });

        // Fire filter chips (exclusive selection)
        document.querySelectorAll('.filter-opt[data-fire]').forEach(chip => {
            chip.addEventListener('click', function(e) {
                e.stopPropagation();
                const fireValue = this.getAttribute('data-fire');
                console.log('🔥 [Weekly Lineup] Fire chip clicked:', fireValue);

                const parent = this.closest('.filter-grid') || this.parentElement;
                parent.querySelectorAll('.filter-opt[data-fire]').forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                applyTableFilter('fire', fireValue === 'all' ? '' : fireValue);
            });
        });

        // Filter quick actions (Select All / Clear)
        document.querySelectorAll('.filter-action-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.getAttribute('data-action');
                const dropdown = this.closest('.th-filter-dropdown');

                console.log('⚡ [Weekly Lineup] Filter action:', action);

                if (action === 'select-all') {
                    // Find and activate the "all" option
                    const allChip = dropdown.querySelector(
                        '.league-pill[data-league=\"all\"], .segment-pill[data-segment=\"all\"], .pick-pill[data-pick=\"all\"], .edge-pill[data-edge=\"all\"], .fire-pill[data-fire=\"all\"], [data-league=\"all\"], [data-market=\"all\"], [data-segment=\"all\"], [data-edge=\"all\"], [data-fire=\"all\"]'
                    );
                    if (allChip) {
                        allChip.click();
                    }
                } else if (action === 'clear') {
                    // Clear all active states and show all rows
                    dropdown.querySelectorAll('.league-pill, .segment-pill, .pick-pill, .edge-pill, .fire-pill, .league-chip, .filter-opt[data-market], .filter-opt[data-segment], .filter-opt[data-edge], .filter-opt[data-fire]').forEach(chip => {
                        chip.classList.remove('active');
                    });
                    // Activate "all" option if exists
                    const allChip = dropdown.querySelector(
                        '.league-pill[data-league=\"all\"], .segment-pill[data-segment=\"all\"], .pick-pill[data-pick=\"all\"], .edge-pill[data-edge=\"all\"], .fire-pill[data-fire=\"all\"], [data-league=\"all\"], [data-market=\"all\"], [data-segment=\"all\"], [data-edge=\"all\"], [data-fire=\"all\"]'
                    );
                    if (allChip) {
                        allChip.classList.add('active');
                    }
                    applyTableFilter('reset', '');
                }
            });
        });

        // Weekly Lineup header pill filters (league/segment/pick/edge/fire)
        const setExclusiveActive = (btn, selector) => {
            const parent = btn.parentElement;
            parent?.querySelectorAll(selector)?.forEach((el) => el.classList.remove('active'));
            btn.classList.add('active');
        };

        document.querySelectorAll('.league-pill[data-league]').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                setExclusiveActive(pill, '.league-pill[data-league]');
                applyTableFilter();
            });
        });

        document.querySelectorAll('.segment-pill[data-segment]').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                setExclusiveActive(pill, '.segment-pill[data-segment]');
                applyTableFilter();
            });
        });

        document.querySelectorAll('.pick-pill[data-pick]').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                setExclusiveActive(pill, '.pick-pill[data-pick]');
                applyTableFilter();
            });
        });

        document.querySelectorAll('.edge-pill[data-edge]').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                setExclusiveActive(pill, '.edge-pill[data-edge]');
                applyTableFilter();
            });
        });

        document.querySelectorAll('.fire-pill[data-fire]').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                setExclusiveActive(pill, '.fire-pill[data-fire]');
                applyTableFilter();
            });
        });

        console.log('✅ [Weekly Lineup] Filter chip handlers complete');
    }

    // Apply filter to table rows
    function applyTableFilter(filterType, filterValue) {
        const tbody = document.getElementById('picks-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        let visibleCount = 0;

        rows.forEach(row => {
            let show = true;

            // Get active filter values from UI (weekly lineup pills)
            const normalizeLeagueKey = (raw) => (raw ?? '').toString().trim().toLowerCase().replace('ncaam', 'ncaab');

            const activeLeague = normalizeLeagueKey(document.querySelector('.league-pill.active')?.getAttribute('data-league') || 'all');
            const activeSegment = (document.querySelector('.segment-pill.active')?.getAttribute('data-segment') || 'all').toString().trim().toLowerCase();
            const activePickType = (document.querySelector('.pick-pill.active')?.getAttribute('data-pick') || 'all').toString().trim().toLowerCase();
            const activeEdge = (document.querySelector('.edge-pill.active')?.getAttribute('data-edge') || 'all').toString().trim().toLowerCase();
            const activeFire = (document.querySelector('.fire-pill.active')?.getAttribute('data-fire') || 'all').toString().trim().toLowerCase();

            // League filter
            if (activeLeague && activeLeague !== 'all') {
                const rowLeague = normalizeLeagueKey(row.getAttribute('data-league'));
                if (rowLeague !== activeLeague) {
                    show = false;
                }
            }

            // Segment filter
            if (show && activeSegment && activeSegment !== 'all') {
                const rowSegment = (row.getAttribute('data-segment') || '').toLowerCase();
                if (rowSegment !== activeSegment) {
                    show = false;
                }
            }

            // Pick type filter
            if (show && activePickType && activePickType !== 'all') {
                const rowPickType = (row.getAttribute('data-pick-type') || '').toString().trim().toLowerCase();
                if (rowPickType !== activePickType) {
                    show = false;
                }
            }

            // Edge filter (high/medium/low)
            if (show && activeEdge && activeEdge !== 'all') {
                const rowEdge = parseFloat(row.getAttribute('data-edge')) || 0;
                if (activeEdge === 'high' && rowEdge < 5) show = false;
                else if (activeEdge === 'medium' && (rowEdge < 2 || rowEdge >= 5)) show = false;
                else if (activeEdge === 'low' && rowEdge >= 2) show = false;
            }

            // Fire filter (exact 1-5)
            if (show && activeFire && activeFire !== 'all') {
                const rowFire = parseInt(row.getAttribute('data-fire'), 10) || 0;
                const selectedFire = parseInt(activeFire, 10) || 0;
                if (selectedFire && rowFire !== selectedFire) show = false;
            }

            row.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });

        console.log(`📊 [Weekly Lineup] Filter applied: ${visibleCount}/${rows.length} rows visible`);

        // Re-apply zebra stripes to visible rows
        applyZebraStripes();
    }

    // ===== FILTER TOOLBAR =====
    function initFilterToolbar() {
        const toolbar = document.getElementById('filter-toolbar');
        if (!toolbar) {
            console.warn('⚠️ [Weekly Lineup] Filter toolbar not found');
            return;
        }
        console.log('✅ [Weekly Lineup] Initializing filter toolbar');

        // Dropdown toggle logic
        const dropdowns = toolbar.querySelectorAll('.ft-dropdown');

        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.ft-dropdown-btn');
            const menu = dropdown.querySelector('.ft-dropdown-menu');
            if (!btn || !menu) return;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                dropdowns.forEach(d => {
                    if (d !== dropdown) {
                        d.querySelector('.ft-dropdown-menu')?.classList.remove('open');
                        d.querySelector('.ft-dropdown-btn')?.classList.remove('open');
                    }
                });
                // Toggle this dropdown
                menu.classList.toggle('open');
                btn.classList.toggle('open');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ft-dropdown')) {
                toolbar.querySelectorAll('.ft-dropdown-menu').forEach(m => m.classList.remove('open'));
                toolbar.querySelectorAll('.ft-dropdown-btn').forEach(b => b.classList.remove('open'));
            }
        });

        // League pill clicks (multi-select)
        toolbar.querySelectorAll('.ft-league').forEach(pill => {
            pill.addEventListener('click', () => {
                pill.classList.toggle('active');
                applyToolbarFilters();
            });
        });

        // Edge dropdown items (multi-select)
        toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('active');
                const menu = item.closest('.ft-dropdown-menu');
                const btn = menu.previousElementSibling;
                const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                btn.textContent = activeCount > 0 ? `📊 Edge (${activeCount}) ▾` : '📊 Edge ▾';
                applyToolbarFilters();
            });
        });

        // Fire dropdown items (multi-select)
        toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('active');
                const menu = item.closest('.ft-dropdown-menu');
                const btn = menu.previousElementSibling;
                const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                btn.textContent = activeCount > 0 ? `🔥 Fire (${activeCount}) ▾` : '🔥 Fire ▾';
                applyToolbarFilters();
            });
        });

        // Segment dropdown items (multi-select)
        toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('active');
                const menu = item.closest('.ft-dropdown-menu');
                const btn = menu.previousElementSibling;
                const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                btn.textContent = activeCount > 0 ? `⏱ Segment (${activeCount}) ▾` : '⏱ Segment ▾';
                applyToolbarFilters();
            });
        });

        // Pick Type dropdown items (multi-select)
        toolbar.querySelectorAll('#picktype-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('active');
                const menu = item.closest('.ft-dropdown-menu');
                const btn = menu.previousElementSibling;
                const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                btn.textContent = activeCount > 0 ? `📋 Pick (${activeCount}) ▾` : '📋 Pick ▾';
                applyToolbarFilters();
            });
        });

        // Clear button
        const clearBtn = document.getElementById('ft-clear');
        clearBtn?.addEventListener('click', () => {
            // Clear league pills
            toolbar.querySelectorAll('.ft-league').forEach(p => p.classList.remove('active'));
            // Clear edge dropdown
            toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
            document.getElementById('edge-dropdown-btn').textContent = '📊 Edge ▾';
            // Clear fire dropdown
            toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
            document.getElementById('fire-dropdown-btn').textContent = '🔥 Fire ▾';
            // Clear segment dropdown
            toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
            document.getElementById('segment-dropdown-btn').textContent = '⏱ Segment ▾';
            // Clear pick type dropdown
            toolbar.querySelectorAll('#picktype-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
            document.getElementById('picktype-dropdown-btn').textContent = '📋 Pick ▾';
            applyToolbarFilters();
        });

        // Helper to format league name nicely
        function formatLeagueName(fetchType) {
            if (fetchType === 'all') return 'All Leagues';
            return fetchType.toUpperCase().replace('NCAAB', 'NCAAM').replace('NCAAF', 'NCAAF');
        }

        // Individual Fetch Buttons - one per league
        toolbar.querySelectorAll('.ft-fetch-league-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fetchType = btn.dataset.fetch;

                // Add loading state
                btn.classList.add('loading');
                const originalContent = btn.innerHTML;

                console.log(`🔄 [Weekly Lineup] Fetching picks: ${fetchType}`);

                try {
                    // Wait for fetcher if not ready
                    const fetcherReady = await waitForFetcher(10, 200);
                    if (!fetcherReady) {
                        throw new Error('Fetcher not available');
                    }

                    // Show loading state in table
                    const tbody = document.querySelector('.weekly-lineup-table tbody');
                    if (tbody) {
                        tbody.innerHTML = '<tr class="empty-state-row"><td colspan="9" class="empty-state-cell"><div class="empty-state"><span class="empty-icon">📊</span><span class="empty-message">Loading picks...</span></div></td></tr>';
                    }

                    const result = await window.UnifiedPicksFetcher.fetchPicks(
                        fetchType === 'all' ? 'all' : fetchType,
                        'today'
                    );

                    let pickCount = 0;
                    if (result.picks && result.picks.length > 0) {
                        pickCount = result.picks.length;
                        // Add fetched picks to table
                        const formattedPicks = result.picks.map(pick => {
                            const edge = parseFloat(pick.edge) || 0;
                            const fireMeta = normalizeFireRating(pick.fire ?? pick.confidence ?? pick.fire_rating ?? pick.fireRating, edge);

                            return {
                                date: pick.date || getTodayDateString(),
                                time: pick.time || 'TBD',
                                sport: pick.sport || pick.league || 'NBA',
                                awayTeam: pick.awayTeam || (pick.game ? pick.game.split(' @ ')[0] : ''),
                                homeTeam: pick.homeTeam || (pick.game ? pick.game.split(' @ ')[1] : ''),
                                segment: normalizeSegment(pick.segment || pick.period || 'FG'),
                                pickTeam: pick.pickTeam || pick.pick || '',
                                pickType: normalizePickType(pick.pickType || pick.market || 'spread'),
                                line: pick.line || '',
                                odds: pick.odds || '-110',
                                modelPrice: pick.modelPrice || pick.model_price || '',
                                edge: edge,
                                fire: fireMeta.fire,
                                fireLabel: pick.fireLabel || fireMeta.fireLabel,
                                rationale: pick.rationale || pick.reason || pick.notes || pick.explanation || '',
                                modelStamp: pick.modelStamp || pick.model_version || pick.modelVersion || pick.modelTag || '',
                                status: pick.status || 'pending'
                            };
                        });
                        formattedPicks.sort((a, b) => b.edge - a.edge);
                        populateWeeklyLineupTable(formattedPicks);
                        updateModelStamp(formattedPicks);
                        console.log(`[Weekly Lineup] ✅ Fetched ${result.picks.length} picks for ${fetchType}`);

                        // Auto-save snapshot when picks are manually fetched
                        savePicksSnapshot(formattedPicks, 'manual-fetch');
                    } else {
                        // Show empty state when no picks returned
                        populateWeeklyLineupTable([]);
                        updateModelStamp([]);
                        console.log(`[Weekly Lineup] ⚠️ No picks returned for ${fetchType}`);
                    }

                    // Update last fetched timestamp with count
                    updateLastFetchedTime(fetchType, pickCount);

                    // Show success or empty state
                    if (pickCount > 0) {
                        btn.innerHTML = '<span style="color:#00d689; font-weight:bold;">✓</span>';
                    } else {
                        btn.innerHTML = '<span style="color:#fbbf24; font-size:0.6rem; font-weight:bold;">EMPTY</span>';
                    }

                    setTimeout(() => {
                        btn.innerHTML = originalContent;
                        btn.classList.remove('loading');
                    }, 2000);

                    // Log any errors
                    if (result.errors?.length > 0) {
                        result.errors.forEach(err => {
                            console.warn(`[Weekly Lineup] ${err.league} API error:`, err.error);
                        });
                    }
                } catch (err) {
                    console.error('[Weekly Lineup] Fetch error:', err);
                    btn.innerHTML = '<span style="color:#ff6b6b; font-weight:bold;">✕</span>';

                    // Show error state in table
                    const tbody = document.querySelector('.weekly-lineup-table tbody');
                    if (tbody) {
                        showNoPicks('Error fetching picks. Please try again.');
                    }

                    setTimeout(() => {
                        btn.innerHTML = originalContent;
                        btn.classList.remove('loading');
                    }, 2000);
                }
            });
        });
    }

    function applyToolbarFilters() {
        const toolbar = document.getElementById('filter-toolbar');
        const tbody = document.getElementById('picks-tbody');
        if (!toolbar || !tbody) return;

        // Gather active filters
        const activeLeagues = [];
        toolbar.querySelectorAll('.ft-league.active').forEach(p => {
            activeLeagues.push(p.dataset.league.toLowerCase());
        });

        const activeEdges = [];
        toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item.active').forEach(i => {
            activeEdges.push(i.dataset.v);
        });

        const activeFires = [];
        toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item.active').forEach(i => {
            activeFires.push(i.dataset.v);
        });

        const activeSegments = [];
        toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item.active').forEach(i => {
            activeSegments.push(i.dataset.v.toUpperCase());
        });

        const activePickTypes = [];
        toolbar.querySelectorAll('#picktype-dropdown-menu .ft-dropdown-item.active').forEach(i => {
            activePickTypes.push(i.dataset.v.toLowerCase());
        });

        console.log(`🔍 [Toolbar Filter] Leagues: ${activeLeagues.join(',')||'all'}, Edges: ${activeEdges.join(',')||'all'}, Fires: ${activeFires.join(',')||'all'}, Segments: ${activeSegments.join(',')||'all'}, PickTypes: ${activePickTypes.join(',')||'all'}`);

        // Filter rows
        let visibleCount = 0;
        tbody.querySelectorAll('tr:not(.loading-row):not(.empty-row)').forEach(row => {
            let show = true;

            // League filter
            if (activeLeagues.length > 0) {
                // Check data-league on the row itself first
                const rowLeague = (row.dataset.league || '').toLowerCase();
                // Fallback to checking children if row attribute is missing (legacy support)
                const badge = row.querySelector('.league-badge, [data-league]');
                const childLeague = badge ? (badge.dataset.league || badge.textContent.trim()).toLowerCase() : '';

                const lg = rowLeague || childLeague;

                if (!activeLeagues.includes(lg)) show = false;
            }

            // Edge filter
            if (show && activeEdges.length > 0) {
                const edgeCell = row.cells[5];
                const edgeVal = parseFloat((edgeCell?.textContent || '0').replace('%', '')) || 0;
                const match = activeEdges.some(lvl =>
                    (lvl === 'high' && edgeVal >= 5) ||
                    (lvl === 'medium' && edgeVal >= 2 && edgeVal < 5) ||
                    (lvl === 'low' && edgeVal < 2)
                );
                if (!match) show = false;
            }

            // Fire filter
            if (show && activeFires.length > 0) {
                const rowFire = parseInt(row.getAttribute('data-fire') || '0', 10) || 0;
                if (!activeFires.includes(String(rowFire))) show = false;
            }

            // Segment filter
            if (show && activeSegments.length > 0) {
                const rowSegment = (row.getAttribute('data-segment') || 'FG').toUpperCase();
                if (!activeSegments.includes(rowSegment)) show = false;
            }

            // Pick Type filter
            if (show && activePickTypes.length > 0) {
                const rowPickType = (row.getAttribute('data-pick-type') || 'spread').toLowerCase();
                // Handle variations: "total" matches "total", "ou", "over", "under"
                const match = activePickTypes.some(pt => {
                    if (pt === 'total' && (rowPickType === 'total' || rowPickType === 'ou' || rowPickType === 'over/under')) return true;
                    if (pt === 'team-total' && (rowPickType === 'team-total' || rowPickType === 'team total' || rowPickType === 'tt')) return true;
                    if (pt === 'moneyline' && (rowPickType === 'moneyline' || rowPickType === 'ml')) return true;
                    if (pt === 'spread' && rowPickType === 'spread') return true;
                    return rowPickType === pt;
                });
                if (!match) show = false;
            }

            row.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });

        console.log(`📊 [Toolbar Filter] ${visibleCount} rows visible`);
        applyZebraStripes();
    }

    function initializeSorting() {
        const sortButtons = document.querySelectorAll('.th-sort-btn');

        sortButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const th = this.closest('th');
                const sortKey = th.getAttribute('data-sort');
                // Check both naming conventions for compatibility
                const currentDirection = th.classList.contains('sorted-asc') || th.classList.contains('sort-asc') ? 'asc' :
                                       th.classList.contains('sorted-desc') || th.classList.contains('sort-desc') ? 'desc' : null;

                // Remove sort classes from all headers (both naming conventions for compatibility)
                document.querySelectorAll('th[data-sort]').forEach(header => {
                    header.classList.remove('sorted-asc', 'sorted-desc', 'sort-asc', 'sort-desc');
                    header.removeAttribute('aria-sort');
                });

                // Set new sort direction - use standardized class names
                let newDirection;
                if (currentDirection === 'asc') {
                    newDirection = 'desc';
                    th.classList.add('sorted-desc');
                    th.setAttribute('aria-sort', 'descending');
                } else {
                    newDirection = 'asc';
                    th.classList.add('sorted-asc');
                    th.setAttribute('aria-sort', 'ascending');
                }

                // Perform sort
                sortTable(sortKey, newDirection);

                // Update sort icons
                updateSortIndicators();
            });
        });

        // Initialize sort icons on load
        updateSortIndicators();
    }

    function updateSortIndicators() {
        document.querySelectorAll('th[data-sort]').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (!icon) return;

            // Check both naming conventions for compatibility
            if (th.classList.contains('sorted-desc') || th.classList.contains('sort-desc')) {
                icon.textContent = SORT_ICONS.desc;
            } else if (th.classList.contains('sorted-asc') || th.classList.contains('sort-asc')) {
                icon.textContent = SORT_ICONS.asc;
            } else {
                // Default unsorted indicator
                icon.textContent = SORT_ICONS.unsorted;
            }
        });
    }

    // ===== SORT TABLE =====
    function sortTable(sortKey, direction) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'))
            .filter((row) => !row.classList.contains('empty-state-row'));

        // Update current sort state
        currentSort = { column: sortKey, direction };

        const indexed = rows.map((row, idx) => ({ row, idx }));

        const compareValues = (a, b, dir) => {
            const directionMultiplier = dir === 'desc' ? -1 : 1;

            if (typeof a === 'number' && typeof b === 'number') {
                if (a === b) return 0;
                return (a - b) * directionMultiplier;
            }

            const aStr = (a ?? '').toString();
            const bStr = (b ?? '').toString();
            const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
            return cmp * directionMultiplier;
        };

        indexed.sort((a, b) => {
            const aRow = a.row;
            const bRow = b.row;

            const primary = compareValues(getCellValue(aRow, sortKey), getCellValue(bRow, sortKey), direction);
            if (primary !== 0) return primary;

            // Secondary: matchup time/date (always ascending unless the primary is date)
            const timeDir = sortKey === 'date' ? direction : 'asc';
            const secondary = compareValues(getCellValue(aRow, 'date'), getCellValue(bRow, 'date'), timeDir);
            if (secondary !== 0) return secondary;

            // Tertiary: like matchups together
            const matchup = compareValues(getCellValue(aRow, 'matchup'), getCellValue(bRow, 'matchup'), 'asc');
            if (matchup !== 0) return matchup;

            // Quaternary: pick text for deterministic ordering
            const pick = compareValues(getCellValue(aRow, 'pick'), getCellValue(bRow, 'pick'), 'asc');
            if (pick !== 0) return pick;

            // Stable fallback
            return a.idx - b.idx;
        });

        // Re-append sorted rows
        indexed.forEach(({ row }) => tbody.appendChild(row));

        // Re-apply zebra stripes
        applyZebraStripes();
    }

    // ===== GET CELL VALUE FOR SORTING =====
    function getCellValue(row, sortKey) {
        switch(sortKey) {
            case 'date': {
                // Sort by time value from data attribute
                const timeStr = row.getAttribute('data-time') || '';
                // Convert time like "6:00 PM" to sortable number (1800 for 6pm)
                const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|a|p)/i);
                if (match) {
                    let hours = parseInt(match[1]);
                    const mins = parseInt(match[2]);
                    const isPM = match[3].toLowerCase().startsWith('p');
                    if (isPM && hours !== 12) hours += 12;
                    if (!isPM && hours === 12) hours = 0;
                    return hours * 60 + mins;
                }
                return 0;
            }
            case 'league':
                return row.getAttribute('data-league') || '';
            case 'matchup': {
                return row.getAttribute('data-matchup') || '';
            }
            case 'segment':
                return row.getAttribute('data-segment') || '';
            case 'edge':
                // Use data attribute for numeric sorting
                return parseFloat(row.getAttribute('data-edge')) || 0;
            case 'market':
            case 'odds': {
                const marketStr = row.getAttribute('data-market') || '';
                return parseInt(marketStr.replace(/[^\d-+]/g, '')) || 0;
            }
            case 'model': {
                const modelVal = row.getAttribute('data-model') || '';
                return parseFloat(modelVal.toString().replace(/[^\d.-]/g, '')) || 0;
            }
            case 'pick':
                return row.getAttribute('data-pick') || '';
            case 'fire':
                return parseInt(row.getAttribute('data-fire')) || 0;
            default:
                return '';
        }
    }


    // ===== NOTIFICATION =====
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `general-notification ${type}`;
        notification.textContent = message;

        const colors = {
            success: 'linear-gradient(135deg, var(--emerald-600) 0%, var(--emerald-500) 100%)',
            error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ===== TRACKER BUTTON HANDLER =====
    function initializeTrackerButtons() {
        // Use event delegation on the table body
        const tbody = document.getElementById('picks-tbody') || document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) {
            console.warn('[Weekly Lineup] Table body not found for tracker buttons');
            return;
        }

        tbody.addEventListener('click', function(e) {
            // Handle tracker button click (add to dashboard)
            const trackerBtn = e.target.closest('.tracker-btn');
            if (trackerBtn) {
                const row = trackerBtn.closest('tr');
                if (!row) return;

                // Get pick index from row position
                const rowIndex = Array.from(row.parentNode.children).indexOf(row);

                // Get pick data from stored picks array (more reliable than DOM parsing)
                let pickData = null;
                if (rowIndex >= 0 && allPicks && allPicks[rowIndex]) {
                    pickData = allPicks[rowIndex];
                } else {
                    // Fallback to DOM extraction if array not available
                    pickData = extractPickFromRow(row);
                }

                if (pickData) {
                    addPickToDashboard(pickData, trackerBtn);
                }
                return;
            }

            // Handle remove button click (remove from dashboard)
            const removeBtn = e.target.closest('.remove-tracked-btn');
            if (removeBtn) {
                const row = removeBtn.closest('tr');
                if (!row) return;

                const rowIndex = Array.from(row.parentNode.children).indexOf(row);
                let pickData = null;
                if (rowIndex >= 0 && allPicks && allPicks[rowIndex]) {
                    pickData = allPicks[rowIndex];
                }

                if (pickData) {
                    removePickFromDashboard(pickData, row, rowIndex);
                }
                return;
            }
        });

        console.log('[Weekly Lineup] Tracker buttons initialized');
    }

    function initializeRationaleToggles() {
        const tbody = document.getElementById('picks-tbody') || document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;

        tbody.addEventListener('click', function(e) {
            const btn = e.target.closest('.rationale-toggle');
            if (!btn) return;

            const panelId = btn.getAttribute('aria-controls');
            if (!panelId) return;

            const panel = document.getElementById(panelId);
            if (!panel) return;

            const isOpen = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            panel.hidden = isOpen;
            btn.textContent = isOpen ? 'Details' : 'Hide';

            // CRITICAL FIX: Force overflow visible on parent TD and TR when panel is open
            // This overrides any CSS that might be clipping the dropdown
            const parentTd = panel.closest('td');
            const parentTr = panel.closest('tr');
            if (!isOpen) {
                // Opening the panel - force overflow visible
                if (parentTd) {
                    parentTd.style.overflow = 'visible';
                }
                if (parentTr) {
                    parentTr.style.overflow = 'visible';
                }
            } else {
                // Closing the panel - restore default (let CSS handle it)
                if (parentTd) {
                    parentTd.style.overflow = '';
                }
                if (parentTr) {
                    parentTr.style.overflow = '';
                }
            }
        });
    }

    function extractPickFromRow(row) {
        try {
            // Get data from cells
            const cells = row.querySelectorAll('td');

            // Time cell (first cell)
            const timeCell = cells[0];
            const time = timeCell?.querySelector('.time-value')?.textContent?.trim() ||
                         timeCell?.textContent?.trim() || '';

            // League/Sport (second cell)
            const leagueCell = cells[1];
            const sport = leagueCell?.querySelector('.league-badge')?.textContent?.trim() ||
                          leagueCell?.textContent?.trim() || 'NBA';

            // Matchup (third cell) - format: "Away Team (W-L) @ Home Team (W-L)"
            const matchupCell = cells[2];
            const matchupText = matchupCell?.textContent?.trim() || '';
            const matchupParts = matchupText.split('@').map(s => s.trim());

            // Parse away team and record
            let awayTeam = '', awayRecord = '';
            if (matchupParts[0]) {
                const awayMatch = matchupParts[0].match(/^(.+?)\s*\((\d+-\d+)\)$/);
                if (awayMatch) {
                    awayTeam = awayMatch[1].trim();
                    awayRecord = awayMatch[2];
                } else {
                    awayTeam = matchupParts[0];
                }
            }

            // Parse home team and record
            let homeTeam = '', homeRecord = '';
            if (matchupParts[1]) {
                const homeMatch = matchupParts[1].match(/^(.+?)\s*\((\d+-\d+)\)$/);
                if (homeMatch) {
                    homeTeam = homeMatch[1].trim();
                    homeRecord = homeMatch[2];
                } else {
                    homeTeam = matchupParts[1];
                }
            }

            // Segment (4th cell)
            const segmentCell = cells[3];
            const segment = segmentCell?.textContent?.trim() || 'FG';

            // Pick (5th cell) - contains team and line
            const pickCell = cells[4];
            const pickTeam = pickCell?.querySelector('.pick-team')?.textContent?.trim() ||
                            pickCell?.querySelector('.team-name')?.textContent?.trim() || '';
            const pickLine = pickCell?.querySelector('.pick-line')?.textContent?.trim() || '';
            const pickOdds = pickCell?.querySelector('.pick-odds')?.textContent?.replace(/[()]/g, '').trim() || '-110';

            // Determine pick type from line
            let pickType = 'spread';
            let pickDirection = '';
            if (pickLine.toLowerCase().includes('over')) {
                pickType = 'total';
                pickDirection = 'Over';
            } else if (pickLine.toLowerCase().includes('under')) {
                pickType = 'total';
                pickDirection = 'Under';
            } else if (pickLine.toLowerCase() === 'ml' || pickLine === '') {
                pickType = 'moneyline';
            }

            // Model prediction (Market column - stacked)
            const marketColumnCell = cells[5];
            const modelPrediction = marketColumnCell
                ?.querySelector('.market-row-model')
                ?.textContent
                ?.replace(/^Model/i, '')
                ?.trim() || '';

            // Market line (Market column - stacked)
            const marketLine = marketColumnCell
                ?.querySelector('.market-row-market')
                ?.textContent
                ?.replace(/^Market/i, '')
                ?.trim() || '';

            // Edge (8th cell)
            const edgeCell = cells[6];
            const edgeText = edgeCell?.textContent?.trim() || '0';
            const edge = parseFloat(edgeText.replace(/[+%pts]/g, '')) || 0;

            // Fire rating (9th cell)
            const fireCell = cells[7];
            const fireRating = fireCell?.textContent?.trim() || '';

            // Build the pick object for LocalPicksManager
            return {
                sport: sport.toUpperCase(),
                awayTeam: awayTeam,
                homeTeam: homeTeam,
                awayRecord: awayRecord,
                homeRecord: homeRecord,
                pickTeam: pickTeam || awayTeam,
                pickType: pickType,
                pickDirection: pickDirection,
                line: pickLine.replace(/over|under/gi, '').trim(),
                odds: pickOdds,
                segment: segment,
                gameTime: time,
                gameDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                modelPrediction: modelPrediction,
                marketLine: marketLine,
                edge: edge,
                fireRating: fireRating,
                risk: 100,  // Default risk amount
                win: calculateWin(100, pickOdds),
                status: 'pending',
                source: 'weekly-lineup'
            };
        } catch (err) {
            console.error('[Weekly Lineup] Error extracting pick from row:', err);
            return null;
        }
    }

    function calculateWin(risk, odds) {
        const oddsNum = parseInt(odds) || -110;
        if (oddsNum > 0) {
            return Math.round(risk * (oddsNum / 100));
        } else {
            return Math.round(risk * (100 / Math.abs(oddsNum)));
        }
    }

    // ===== TRACKING FUNCTIONS =====
    /**
     * Generate a unique ID for a pick based on its key attributes
     */
    function generatePickId(pick) {
        const key = `${pick.sport || ''}_${pick.awayTeam || ''}_${pick.homeTeam || ''}_${pick.pickTeam || ''}_${pick.line || ''}_${pick.odds || ''}_${pick.segment || 'FG'}_${pick.pickType || 'spread'}`;
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `wl_${Math.abs(hash)}`;
    }

    /**
     * Save tracking metadata when a pick is added to dashboard
     */
    function saveTrackingMetadata(pick, trackedAt) {
        try {
            const pickId = generatePickId(pick);
            // Normalize fire rating (could be fire or fireRating)
            const fireValue = pick.fire !== undefined ? pick.fire : (pick.fireRating || 0);
            const tracked = {
                pickId: pickId,
                trackedAt: trackedAt || new Date().toISOString(),
                originalLine: (pick.line || '').trim(),
                originalOdds: (pick.odds || '').trim(),
                originalEdge: parseFloat(pick.edge) || 0,
                originalFire: fireValue,
                matchup: `${pick.awayTeam || ''} @ ${pick.homeTeam || ''}`,
                pickTeam: pick.pickTeam || '',
                segment: pick.segment || 'FG',
                sport: pick.sport || ''
            };

            const existing = localStorage.getItem(TRACKED_PICKS_STORAGE_KEY);
            const trackedPicks = existing ? JSON.parse(existing) : {};
            trackedPicks[pickId] = tracked;
            localStorage.setItem(TRACKED_PICKS_STORAGE_KEY, JSON.stringify(trackedPicks));

            log(`📌 Saved tracking metadata for pick: ${pickId}`);
            return tracked;
        } catch (e) {
            console.error('Error saving tracking metadata:', e);
            return null;
        }
    }

    /**
     * Get tracking metadata for a pick
     */
    function getTrackingMetadata(pick) {
        try {
            const pickId = generatePickId(pick);
            const existing = localStorage.getItem(TRACKED_PICKS_STORAGE_KEY);
            if (!existing) return null;

            const trackedPicks = JSON.parse(existing);
            return trackedPicks[pickId] || null;
        } catch (e) {
            console.error('Error getting tracking metadata:', e);
            return null;
        }
    }

    /**
     * Compare current pick values with tracked values and return changes
     */
    function detectPickChanges(pick, tracked) {
        if (!tracked) return null;

        const changes = {};
        const currentLine = (pick.line || '').trim();
        const currentOdds = (pick.odds || '').trim();
        const currentEdge = parseFloat(pick.edge) || 0;
        // Normalize fire rating (could be fire or fireRating)
        const currentFire = pick.fire !== undefined ? pick.fire : (pick.fireRating || 0);

        if (currentLine !== tracked.originalLine && currentLine && tracked.originalLine) {
            changes.line = { from: tracked.originalLine, to: currentLine };
        }
        if (currentOdds !== tracked.originalOdds && currentOdds && tracked.originalOdds) {
            changes.odds = { from: tracked.originalOdds, to: currentOdds };
        }
        if (Math.abs(currentEdge - tracked.originalEdge) > 0.1) {
            changes.edge = { from: tracked.originalEdge, to: currentEdge };
        }
        if (currentFire !== tracked.originalFire) {
            changes.fire = { from: tracked.originalFire, to: currentFire };
        }

        return Object.keys(changes).length > 0 ? changes : null;
    }

    /**
     * Format game time from pick data
     */
    function formatGameTime(pick) {
        // Try to get time from various sources
        if (pick.time && pick.time !== 'TBD') return pick.time;
        if (pick.gameTime) return pick.gameTime;

        // Try to parse from date string
        if (pick.date && pick.date.includes(' ')) {
            const parts = pick.date.split(' ');
            if (parts.length > 1) {
                return parts.slice(1).join(' ');
            }
        }

        // Default to current time + 1 hour as estimate
        const now = new Date();
        now.setHours(now.getHours() + 1);
        return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    /**
     * Determine pick direction (OVER/UNDER) from pick data
     */
    function determinePickDirection(pick) {
        if (pick.pickDirection) return pick.pickDirection;

        const pickTeam = (pick.pickTeam || '').toUpperCase();
        const pickLabel = (pick.pick || '').toUpperCase();

        if (pickTeam === 'OVER' || pickTeam === 'UNDER' || pickLabel.startsWith('OVER') || pickLabel.startsWith('UNDER')) {
            if (pickTeam === 'OVER' || pickLabel.startsWith('OVER')) return 'OVER';
            if (pickTeam === 'UNDER' || pickLabel.startsWith('UNDER')) return 'UNDER';
        }

        return '';
    }

    /**
     * Format timestamp for display
     */
    function formatTrackedTime(isoString) {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;

            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            return 'Unknown';
        }
    }

    function addPickToDashboard(pickData, btn) {
        // Save directly to localStorage (same key as LocalPicksManager)
        const STORAGE_KEY = 'gbsv_picks';
        const trackedAt = new Date().toISOString();

        try {
            // Get existing picks
            const existingData = localStorage.getItem(STORAGE_KEY);
            const existingPicks = existingData ? JSON.parse(existingData) : [];
            const pickId = generatePickId(pickData);

            const isDuplicate = existingPicks.some(p => generatePickId(p) === pickId);
            if (isDuplicate) {
                btn.textContent = '✓';
                btn.classList.add('added');
                btn.disabled = true;
                showNotification('Pick already added to Dashboard', 'info');
                return;
            }

            // Transform data to match dashboard expected format
            const dashboardPick = {
                id: pickId,
                createdAt: trackedAt,
                // Date/Time - dashboard expects gameDate and gameTime
                gameDate: pickData.date || getTodayDateString(),
                gameTime: pickData.time && pickData.time !== 'TBD' ? pickData.time : formatGameTime(pickData),
                // Teams
                awayTeam: pickData.awayTeam || '',
                homeTeam: pickData.homeTeam || '',
                awayRecord: pickData.awayRecord || '',
                homeRecord: pickData.homeRecord || '',
                // Pick details
                pickTeam: pickData.pickTeam || '',
                pickType: pickData.pickType || 'spread',
                pickDirection: pickData.pickDirection || determinePickDirection(pickData),
                line: pickData.line || '',
                odds: pickData.odds || '-110',
                // Model info
                edge: pickData.edge || 0,
                fire: pickData.fire || 0,
                fireLabel: pickData.fireLabel || '',
                modelPrice: pickData.modelPrice || '',
                rationale: pickData.rationale || '',
                modelStamp: pickData.modelStamp || '',
                // Metadata
                sport: pickData.sport || 'NBA',
                segment: pickData.segment || 'FG',
                status: 'pending',
                sportsbook: pickData.sportsbook || ''
            };

            // Copy over for tracking purposes
            pickData.id = dashboardPick.id;
            pickData.createdAt = trackedAt;

            // Add to array
            existingPicks.push(dashboardPick);

            // Save back
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existingPicks));

            // Save tracking metadata for weekly lineup display
            saveTrackingMetadata(pickData, trackedAt);

            // Visual feedback
            btn.textContent = '✓';
            btn.classList.add('added');
            btn.disabled = true;

            showNotification(`Added ${pickData.pickTeam} ${pickData.line} to Dashboard`, 'success');
            console.log('[Weekly Lineup] Pick saved to localStorage:', pickData);

            // Refresh the row to show tracking indicators
            const row = btn.closest('tr');
            if (row) {
                const rowIndex = Array.from(row.parentNode.children).indexOf(row);
                if (rowIndex >= 0 && allPicks[rowIndex]) {
                    const updatedRow = createWeeklyLineupRow(allPicks[rowIndex], rowIndex);
                    row.replaceWith(updatedRow);
                }
            }
        } catch (err) {
            console.error('[Weekly Lineup] Failed to save pick:', err);
            showNotification('Failed to add pick', 'error');
        }
    }

    /**
     * Remove a pick from the dashboard and clear tracking metadata
     */
    function removePickFromDashboard(pickData, row, rowIndex) {
        const STORAGE_KEY = 'gbsv_picks';

        try {
            const pickId = generatePickId(pickData);

            // Remove from dashboard picks
            const existingData = localStorage.getItem(STORAGE_KEY);
            if (existingData) {
                const existingPicks = JSON.parse(existingData);
                // Find and remove the pick - match by key attributes
                const filtered = existingPicks.filter(p => {
                    const pId = generatePickId(p);
                    return pId !== pickId;
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
                console.log(`[Weekly Lineup] Removed pick from dashboard. ${existingPicks.length} → ${filtered.length} picks`);
            }

            // Remove tracking metadata
            removeTrackingMetadata(pickData);

            showNotification(`Removed ${pickData.pickTeam} ${pickData.line} from Dashboard`, 'info');

            // Refresh the row to show tracker button again
            if (rowIndex >= 0 && allPicks[rowIndex]) {
                const updatedRow = createWeeklyLineupRow(allPicks[rowIndex], rowIndex);
                row.replaceWith(updatedRow);
            }
        } catch (err) {
            console.error('[Weekly Lineup] Failed to remove pick:', err);
            showNotification('Failed to remove pick', 'error');
        }
    }

    /**
     * Remove tracking metadata for a pick
     */
    function removeTrackingMetadata(pick) {
        try {
            const pickId = generatePickId(pick);
            const existing = localStorage.getItem(TRACKED_PICKS_STORAGE_KEY);
            if (!existing) return;

            const trackedPicks = JSON.parse(existing);
            delete trackedPicks[pickId];
            localStorage.setItem(TRACKED_PICKS_STORAGE_KEY, JSON.stringify(trackedPicks));

            log(`🗑️ Removed tracking metadata for pick: ${pickId}`);
        } catch (e) {
            console.error('Error removing tracking metadata:', e);
        }
    }

    /**
     * Sync outcomes from dashboard to archived picks
     * Call this to update archived pick outcomes based on dashboard status
     */
    function syncArchivedOutcomes() {
        try {
            const archiveData = loadArchivedPicks();
            if (!archiveData.picks || archiveData.picks.length === 0) return;

            const dashboardPicks = JSON.parse(localStorage.getItem('gbsv_picks') || '[]');
            let updatedCount = 0;

            archiveData.picks.forEach(archivedPick => {
                const matched = dashboardPicks.find(dp => picksMatch(dp, archivedPick));

                if (matched && matched.status) {
                    const newOutcome = ['win', 'loss', 'push'].includes(matched.status.toLowerCase())
                        ? matched.status.toLowerCase()
                        : 'no_action';

                    if (archivedPick.outcome !== newOutcome) {
                        // Update stats
                        const weekId = archivedPick.weekOf;
                        if (archiveData.weeklyStats[weekId]) {
                            // Decrement old
                            if (archivedPick.outcome === 'win') archiveData.weeklyStats[weekId].wins--;
                            else if (archivedPick.outcome === 'loss') archiveData.weeklyStats[weekId].losses--;
                            else if (archivedPick.outcome === 'push') archiveData.weeklyStats[weekId].pushes--;
                            else archiveData.weeklyStats[weekId].noAction--;

                            // Increment new
                            if (newOutcome === 'win') archiveData.weeklyStats[weekId].wins++;
                            else if (newOutcome === 'loss') archiveData.weeklyStats[weekId].losses++;
                            else if (newOutcome === 'push') archiveData.weeklyStats[weekId].pushes++;
                            else archiveData.weeklyStats[weekId].noAction++;
                        }

                        archivedPick.outcome = newOutcome;
                        updatedCount++;
                    }
                }
            });

            if (updatedCount > 0) {
                saveArchivedPicks(archiveData);
                log(`📊 Synced ${updatedCount} archived pick outcomes from dashboard`);

                // Refresh history view if currently active
                if (currentView === 'history') {
                    populateArchivedPicks();
                }
            }

            return updatedCount;
        } catch (e) {
            console.error('Error syncing archived outcomes:', e);
            return 0;
        }
    }

    /**
     * Force archive all current picks (for testing/manual use)
     */
    function forceArchiveAllPicks() {
        const currentPicks = loadWeeklyLineupPicks() || [];
        if (currentPicks.length === 0) {
            log('📦 No picks to archive');
            return 0;
        }

        let archivedCount = 0;
        currentPicks.forEach(pick => {
            archivePick(pick, getPickOutcome(pick));
            archivedCount++;
        });

        // Clear current picks
        saveWeeklyLineupPicks([]);

        log(`📦 Force archived ${archivedCount} picks`);
        showNotification(`Archived ${archivedCount} picks`, 'info');

        // Refresh view
        if (currentView === 'history') {
            populateArchivedPicks();
        } else {
            showActiveView();
        }

        return archivedCount;
    }

    /**
     * Clear all archived picks (for testing/reset)
     */
    function clearArchivedPicks() {
        localStorage.removeItem(ARCHIVED_PICKS_STORAGE_KEY);
        log('🗑️ Cleared all archived picks');

        if (currentView === 'history') {
            populateArchivedPicks();
        }
    }

    // ===== SNAPSHOT INTEGRATION =====
    /**
     * Save picks snapshot using PicksSnapshotManager
     * @param {Array} picks - Picks to save
     * @param {string} source - Source of the snapshot
     */
    function savePicksSnapshot(picks, source = 'manual') {
        try {
            if (window.PicksSnapshotManager && Array.isArray(picks) && picks.length > 0) {
                const snapshotId = window.PicksSnapshotManager.saveSnapshot(picks, source);
                if (snapshotId) {
                    log(`📸 Snapshot saved: ${snapshotId} (${picks.length} picks)`);
                    // Dispatch event for UI updates
                    document.dispatchEvent(new CustomEvent('picks-updated', {
                        detail: { picks, snapshotId }
                    }));
                }
            }
        } catch (error) {
            console.error('Failed to save snapshot:', error);
        }
    }

    // Listen for snapshot load events
    document.addEventListener('load-snapshot', (e) => {
        const snapshot = e.detail?.snapshot;
        if (snapshot && snapshot.picks) {
            log(`📂 Loading snapshot: ${snapshot.id}`);
            populateWeeklyLineupTable(snapshot.picks);
            updateModelStamp(snapshot.picks);

            // Show notification
            showNotification(`Loaded snapshot from ${snapshot.timestampDisplay}`, 'info');
        }
    });

    // Export for external use
    window.WeeklyLineup = {
        loadModelOutputs,
        populateTable: populateWeeklyLineupTable,
        showNotification,
        showEmptyState,
        showNoPicks,
        addPickToDashboard,
        removePickFromDashboard,
        // Archive functions
        archiveExpiredPicks,
        syncArchivedOutcomes,
        forceArchiveAllPicks,
        // New: Sync bridge - get current active picks for Dashboard
        getActivePicks: () => allPicks || [],
        exportToDashboard: () => {
            // Export all currently active picks in a format Dashboard can consume
            const picks = allPicks || [];
            return picks.map(pick => ({
                ...pick,
                source: 'weekly-lineup',
                createdAt: pick.createdAt || new Date().toISOString(),
                status: pick.status || 'pending'
            }));
        },
        // Sync picks directly to Dashboard's localStorage
        syncToDashboard: () => {
            const picks = allPicks || [];
            if (picks.length === 0) {
                log('[Sync] No picks to sync');
                showNotification('No picks to sync', 'warning');
                return 0;
            }

            const DASHBOARD_KEY = 'gbsv_picks';
            const dashboardPicks = picks.map((pick, idx) => ({
                id: `pick_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`,
                pickTeam: pick.pickTeam || pick.pick || '',
                awayTeam: pick.awayTeam || '',
                homeTeam: pick.homeTeam || '',
                awayRecord: pick.awayRecord || '',
                homeRecord: pick.homeRecord || '',
                game: `${pick.awayTeam || ''} @ ${pick.homeTeam || ''}`,
                sport: pick.sport || 'NBA',
                segment: pick.segment || 'Full Game',
                pickType: pick.pickType || 'spread',
                line: pick.line || '',
                odds: pick.odds || '-110',
                risk: 50000, // Default 1 unit = $50k
                win: 45455, // Default at -110 odds
                edge: pick.edge || 0,
                fire: pick.fire || 0,
                status: 'pending',
                gameDate: pick.date || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                gameTime: pick.time || 'TBD',
                sportsbook: 'Model Pick',
                source: 'weekly-lineup-sync',
                createdAt: new Date().toISOString()
            }));

            // Save to dashboard localStorage (replace existing)
            localStorage.setItem(DASHBOARD_KEY, JSON.stringify(dashboardPicks));
            log(`[Sync] ✅ Synced ${dashboardPicks.length} picks to Dashboard localStorage`);
            showNotification(`Synced ${dashboardPicks.length} picks to Dashboard`, 'success');
            return dashboardPicks.length;
        },
        // Sync: Dashboard can call this to push results back
        syncDashboardOutcomes: (dashboardPicks) => {
            // Update archived picks with outcomes from Dashboard
            if (!Array.isArray(dashboardPicks)) return;
            log('[Weekly Lineup] Syncing outcomes from Dashboard...');
            dashboardPicks.forEach(dbPick => {
                if (dbPick.status && ['win', 'loss', 'push'].includes(dbPick.status.toLowerCase())) {
                    const pickId = generatePickId(dbPick);
                    updateArchivedPickOutcome(pickId, dbPick.status.toLowerCase());
                }
            });
        },
        clearArchivedPicks,
        getWeeklyStatsSummary,
        loadArchivedPicks,
        updateArchivedPickOutcome,
        // Snapshot function
        savePicksSnapshot
    };

    log('✅ Weekly Lineup v33.01.0 loaded (with archive support)');
})();
