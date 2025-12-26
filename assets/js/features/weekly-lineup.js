/* ==========================================================================
   WEEKLY LINEUP PAGE JAVASCRIPT v33.00.0
   ==========================================================================
   Production release - Real API data only, no mock data
   Today's Picks - Model outputs with Edge/Fire ratings
   Matches dashboard styling with team logos and sorting
   ========================================================================== */

// IMMEDIATE DEBUG - OUTSIDE OF IIFE
const WL_BUILD = '33.00.0';
console.log(`!!!!! WEEKLY-LINEUP.JS FILE IS BEING PARSED (build ${WL_BUILD}) !!!!!`);
window.__WEEKLY_LINEUP_BUILD__ = WL_BUILD;

(function() {
    'use strict';

    // ===== FILTER INIT STATE (must be at top to avoid TDZ errors) =====
    let filterInitAttempts = 0;
    const MAX_FILTER_INIT_ATTEMPTS = 10;

    // ===== SCRIPT LOADING VERIFICATION =====
    console.log('[Weekly Lineup] Script loaded and executing');

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
    const LEAGUE_LOGOS = {
        'NCAAB': 'assets/logo_ncaam_bball.png',
        'NCAAM': 'assets/logo_ncaam_bball.png',
        'NCAAF': 'assets/logo_ncaa_football.png',
        'NBA': 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
        'NFL': 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png'
    };

    function getTeamInfo(teamName) {
        if (!teamName) return { abbr: 'N/A', logo: '' };
        const lower = teamName.toLowerCase().trim();

        // Check NBA teams first
        const nbaData = NBA_TEAMS[lower];
        if (nbaData) {
            return { abbr: nbaData.abbr, logo: nbaData.logo };
        }

        // Then check NCAAB teams
        const ncaabData = NCAAB_TEAMS[lower];
        if (ncaabData) {
            return { abbr: ncaabData.abbr, logo: ncaabData.logo };
        }

        return { abbr: teamName.substring(0, 4).toUpperCase(), logo: '' };
    }

    // ===== SORTING STATE =====
    let currentSort = { column: 'edge', direction: 'desc' };
    let allPicks = [];  // Store all picks for sorting

    // ===== INITIALIZATION =====
    function runInitialization() {
        console.log('🎬 [Weekly Lineup] runInitialization() called');
        console.log('📄 [Weekly Lineup] document.readyState:', document.readyState);

        // Initialize the table filter system
        initializeFilters();
        initFilterToolbar();

        initializeSorting();
        initializeTimeSlots();
        initializeDateRangeSelector();
        initializeTrackerButtons();

        try {
            console.log('[Weekly Lineup] Starting initialization...');

            // Load picks immediately from mock data (no API delay)
            console.log('[Weekly Lineup] Loading model outputs...');
            loadModelOutputs();

            // Initialize filter system after table is populated
            requestAnimationFrame(() => {
                console.log('[Weekly Lineup] Initializing filter system...');
                if (window.TableFilters) {
                    window.TableFilters.renderFilterChips();
                    window.TableFilters.updateFilterIndicators();
                }
            });

            // Fetch team records in background (non-blocking)
            if (window.AutoGameFetcher && window.AutoGameFetcher.fetchTodaysGames) {
                console.log('[Weekly Lineup] Setting up team records fetch...');
                window.AutoGameFetcher.fetchTodaysGames().then(() => {
                    updateTeamRecords();
                }).catch(() => {});
            }

            console.log('[Weekly Lineup] Initialization completed successfully');
        } catch (error) {
            console.error('[Weekly Lineup] ERROR during initialization:', error);
        }
    }

    // Handle both cases: DOM already ready OR still loading
    console.log('[Weekly Lineup] Checking document.readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('[Weekly Lineup] DOM still loading, adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', runInitialization);
    } else {
        console.log('[Weekly Lineup] DOM already ready, running init immediately');
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

    // ===== LOAD MODEL OUTPUTS (TODAY'S PICKS) =====
    /**
     * v33.00.0 - Production: Fetch real picks from Azure Container Apps APIs
     * No mock/placeholder data - uses unified-picks-fetcher.js
     */
    async function loadModelOutputs() {
        log('🔄 Loading today\'s model picks from APIs...');

        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="8" class="loading-cell"><span class="loading-spinner">Fetching picks from model APIs...</span></td></tr>';
        }

        try {
            // Use UnifiedPicksFetcher to get real picks from all APIs
            if (window.UnifiedPicksFetcher && window.UnifiedPicksFetcher.fetchPicks) {
                const result = await window.UnifiedPicksFetcher.fetchPicks('all', 'today');
                
                if (result.picks && result.picks.length > 0) {
                    console.log(`[Weekly Lineup] ✅ Fetched ${result.picks.length} real picks from APIs`);
                    
                    // Transform picks to table format and sort by edge
                    const formattedPicks = result.picks.map(pick => ({
                        date: pick.date || getTodayDateString(),
                        time: pick.time || 'TBD',
                        sport: pick.sport || pick.league || 'NBA',
                        awayTeam: pick.awayTeam || (pick.game ? pick.game.split(' @ ')[0] : ''),
                        homeTeam: pick.homeTeam || (pick.game ? pick.game.split(' @ ')[1] : ''),
                        segment: pick.segment || 'FG',
                        pickTeam: pick.pickTeam || pick.pick || '',
                        pickType: pick.pickType || 'spread',
                        line: pick.line || '',
                        odds: pick.odds || '-110',
                        modelPrice: pick.modelPrice || pick.model_price || '',
                        edge: parseFloat(pick.edge) || 0,
                        fire: parseInt(pick.fire) || Math.min(5, Math.ceil((parseFloat(pick.edge) || 0) / 1.5)),
                        fireLabel: (parseFloat(pick.edge) >= 6) ? 'MAX' : '',
                        status: pick.status || 'pending'
                    }));

                    // Sort by edge (highest first)
                    formattedPicks.sort((a, b) => b.edge - a.edge);
                    populateWeeklyLineupTable(formattedPicks);
                } else {
                    console.log('[Weekly Lineup] ⚠️ No picks returned from APIs');
                    showNoPicks('No picks available for today. Check back later or fetch manually.');
                }

                // Log any errors
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => {
                        console.warn(`[Weekly Lineup] ${err.league} API error:`, err.error);
                    });
                }
            } else {
                console.warn('[Weekly Lineup] UnifiedPicksFetcher not available, waiting for script load...');
                showNoPicks('Loading picks fetcher... Refresh if this persists.');
            }
        } catch (error) {
            console.error('[Weekly Lineup] ❌ Error fetching picks:', error);
            showNoPicks('Error loading picks. Please try the Fetch button to retry.');
        }
    }

    function showNoPicks(message) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr class="no-picks-row"><td colspan="8" class="no-picks-cell">${message}</td></tr>`;
        }
    }

    // ===== HELPER FUNCTIONS =====
    function buildPickLabel(pick) {
        if (pick.pickType === 'spread') {
            const line = pick.line || '';
            return line.startsWith('+') || line.startsWith('-') ? line : `${line}`;
        } else if (pick.pickType === 'moneyline') {
            return 'ML';
        } else if (pick.pickType === 'total' || pick.pickType === 'team-total') {
            return pick.line || '';
        }
        return '';
    }

    function renderLeagueCell(sport) {
        const logo = LEAGUE_LOGOS[sport] || '';
        return `
            <div class="league-cell">
                ${logo ? `<img src="${logo}" class="league-logo" loading="eager" alt="${sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-text">${sport}</span>
            </div>
        `;
    }

    // ===== POPULATE WEEKLY LINEUP TABLE =====
    function populateWeeklyLineupTable(picks) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        if (!tbody) return;

        // Store picks for sorting
        allPicks = picks;

        // Clear placeholder/stale rows
        tbody.innerHTML = '';

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
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, idx) => {
            row.classList.remove('even', 'odd');
            row.classList.add(idx % 2 === 0 ? 'even' : 'odd');
        });
    }

    function createWeeklyLineupRow(pick, idx) {
        const row = document.createElement('tr');

        // Format date - handle both date string and pre-formatted date
        const formatDate = (dateStr) => {
            if (!dateStr) return 'TBD';
            if (dateStr.match(/^\w{3},\s\w{3}\s\d+$/)) return dateStr;
            const d = new Date(dateStr);
            if (isNaN(d)) return dateStr;
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };

        // Get team info with logos
        const awayTeamName = pick.awayTeam || 'TBD';
        const homeTeamName = pick.homeTeam || 'TBD';
        const pickTeamName = pick.pickTeam || 'Unknown';

        const awayInfo = getTeamInfo(awayTeamName);
        const homeInfo = getTeamInfo(homeTeamName);
        const pickInfo = getTeamInfo(pickTeamName);

        // Get team records - try pick data first, then AutoGameFetcher
        const getRecord = (teamName) => {
            if (window.AutoGameFetcher && window.AutoGameFetcher.getTeamRecord) {
                return window.AutoGameFetcher.getTeamRecord(teamName);
            }
            return '';
        };
        const awayRecord = pick.awayRecord || getRecord(awayTeamName);
        const homeRecord = pick.homeRecord || getRecord(homeTeamName);

        // Build pick display
        const pickLabel = buildPickLabel(pick);
        const isTeamPick = pickTeamName !== 'Over' && pickTeamName !== 'Under';

        // Create logo HTML
        const awayLogoHtml = awayInfo.logo
            ? `<img src="${awayInfo.logo}" class="team-logo" loading="eager" alt="${awayInfo.abbr}" onerror="this.style.display='none'">`
            : '';
        const homeLogoHtml = homeInfo.logo
            ? `<img src="${homeInfo.logo}" class="team-logo" loading="eager" alt="${homeInfo.abbr}" onerror="this.style.display='none'">`
            : '';
        const pickLogoHtml = pickInfo.logo
            ? `<img src="${pickInfo.logo}" class="pick-team-logo" loading="eager" alt="${pickInfo.abbr}" onerror="this.style.display='none'">`
            : '';

        // Matchup HTML with logos
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
            : `<div class="matchup-cell">${awayTeamHtml}<div class="vs-divider">@</div>${homeTeamHtml}</div>`;

        const pickOdds = pick.odds || '-110';

        // Pick cell - unified structure: [Logo] Subject Value (Juice)
        let pickCellHtml;
        if (isTeamPick) {
            if (pick.pickType === 'moneyline') {
                // Moneyline: [Logo] DEN ML -260
                pickCellHtml = `<div class="pick-cell">${pickLogoHtml}<span class="pick-subject">${pickInfo.abbr}</span><span class="pick-label">ML</span><span class="pick-value">${pickOdds}</span></div>`;
            } else {
                // Spread: [Logo] DEN -5.5 (-110)
                pickCellHtml = `<div class="pick-cell">${pickLogoHtml}<span class="pick-subject">${pickInfo.abbr}</span><span class="pick-value">${pickLabel}</span><span class="pick-juice">(${pickOdds})</span></div>`;
            }
        } else {
            // Over/Under: Over 221.5 (-110)
            pickCellHtml = `<div class="pick-cell"><span class="pick-subject">${pickTeamName}</span><span class="pick-value">${pickLabel}</span><span class="pick-juice">(${pickOdds})</span></div>`;
        }

        // Model Prediction - shows model's line/odds
        const getModelPredictionHtml = () => {
            const modelPrice = pick.modelPrice || '-';
            const modelSpread = pick.modelSpread || pick.predictedSpread || pickLabel || '';
            const teamAbbrev = isTeamPick ? pickInfo.abbr : pickTeamName;
            const logoHtml = isTeamPick && pickInfo.logo
                ? `<img src="${pickInfo.logo}" class="prediction-logo" loading="eager" alt="${teamAbbrev}" onerror="this.style.display='none'">`
                : '';

            if (pick.pickType === 'moneyline') {
                // ML: [Logo] DEN [ML] -180
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-type-badge">ML</span><span class="pred-odds">${modelPrice}</span></div>`;
            } else if (pick.pickType === 'spread') {
                // Spread: [Logo] DEN -3.5 (-108)
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-line">${modelSpread}</span><span class="pred-odds-muted">(${modelPrice})</span></div>`;
            } else if (pick.pickType === 'total' || pick.pickType === 'team-total') {
                // Total: Over 221.5 (-110)
                return `<div class="prediction-cell"><span class="pred-direction">${teamAbbrev}</span><span class="pred-line">${modelSpread}</span><span class="pred-odds-muted">(${modelPrice})</span></div>`;
            }
            return `<div class="prediction-cell"><span class="pred-odds">${modelPrice}</span></div>`;
        };

        const modelPredictionHtml = getModelPredictionHtml();

        // Market Odds - actual market line for comparison
        const getMarketHtml = () => {
            const teamAbbrev = isTeamPick ? pickInfo.abbr : pickTeamName;
            const logoHtml = isTeamPick && pickInfo.logo
                ? `<img src="${pickInfo.logo}" class="prediction-logo" loading="eager" alt="${teamAbbrev}" onerror="this.style.display='none'">`
                : '';

            if (pick.pickType === 'moneyline') {
                // ML: [Logo] DEN [ML] -260
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-type-badge">ML</span><span class="pred-odds">${pickOdds}</span></div>`;
            } else if (pick.pickType === 'spread') {
                // Spread: [Logo] DEN -5.5 (-110)
                return `<div class="prediction-cell">${logoHtml}<span class="pred-team">${teamAbbrev}</span><span class="pred-line">${pickLabel}</span><span class="pred-odds-muted">(${pickOdds})</span></div>`;
            } else if (pick.pickType === 'total' || pick.pickType === 'team-total') {
                // Total: Over 221.5 (-110)
                return `<div class="prediction-cell"><span class="pred-direction">${teamAbbrev}</span><span class="pred-line">${pickLabel}</span><span class="pred-odds-muted">(${pickOdds})</span></div>`;
            }
            return `<div class="prediction-cell"><span class="pred-odds">${pickOdds}</span></div>`;
        };

        const marketHtml = getMarketHtml();

        // Edge and Fire rating
        const edge = pick.edge || 0;
        const fire = pick.fire || 0;
        const fireLabel = pick.fireLabel || '';

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

        const sport = (pick.sport || 'NCAAB').toUpperCase();
        const gameDate = pick.date || pick.gameDate;
        const gameTime = pick.time || pick.gameTime || 'TBD';

        // Segment display (FG = Full Game, 1H = First Half, 2H = Second Half)
        const segment = pick.segment || 'FG';
        const getSegmentDisplay = (seg) => {
            const segmentMap = {
                'FG': 'Full Game',
                '1H': '1st Half',
                '2H': '2nd Half',
                '1Q': '1st Qtr',
                '2Q': '2nd Qtr',
                '3Q': '3rd Qtr',
                '4Q': '4th Qtr'
            };
            return segmentMap[seg] || seg;
        };

        // Set data attributes for sorting and filtering
        row.setAttribute('data-edge', edge);
        row.setAttribute('data-fire', fire);
        row.setAttribute('data-time', gameTime);
        row.setAttribute('data-pick-type', pick.pickType || 'spread');
        row.setAttribute('data-league', sport);
        row.setAttribute('data-segment', segment);
        row.setAttribute('data-matchup', `${awayTeamName} @ ${homeTeamName}`);
        row.setAttribute('data-market', pickOdds);
        row.setAttribute('data-model', pick.modelPrice || '');
        row.setAttribute('data-pick', pickTeamName);

        // Set additional data attributes for filtering
        row.setAttribute('data-away', awayTeamName);
        row.setAttribute('data-home', homeTeamName);
        row.setAttribute('data-status', pick.status || 'pending');

        // League cell HTML with logo
        const leagueLogo = LEAGUE_LOGOS[sport] || '';
        const leagueCellHtml = `
            <div class="league-cell">
                ${leagueLogo ? `<img src="${leagueLogo}" class="league-logo" loading="eager" alt="${sport}" onerror="this.style.display='none'">` : ''}
                <span class="league-abbr">${sport}</span>
            </div>`;

        row.innerHTML = `
            <td data-label="Date/Time">
                <div class="datetime-cell">
                    <span class="date-value">${formatDate(gameDate)}</span>
                    <span class="time-value">${gameTime}</span>
                </div>
            </td>
            <td data-label="League" class="center">
                ${leagueCellHtml}
            </td>
            <td data-label="Matchup">
                ${matchupHtml}
            </td>
            <td data-label="Segment" class="center">
                <span class="segment-value">${getSegmentDisplay(segment)}</span>
            </td>
            <td data-label="Recommended Pick">
                ${pickCellHtml}
            </td>
            <td data-label="Edge" class="center">
                <span class="edge-value ${getEdgeClass(edge)}">+${edge.toFixed(1)}</span>
            </td>
            <td data-label="Fire" class="center">
                <span class="fire-rating">${fireDisplay}</span>
            </td>
            <td data-label="Track" class="center">
                <button class="tracker-btn" type="button">+</button>
            </td>
        `;

        return row;
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
        console.log(`🚀 [Weekly Lineup] initializeFilters() attempt ${filterInitAttempts}`);

        // Debug: Check if table exists
        const table = document.querySelector('.weekly-lineup-table');
        console.log('📊 [Weekly Lineup] Table found:', !!table);

        if (!table) {
            console.error('❌ [Weekly Lineup] TABLE NOT FOUND - check HTML structure');
            if (filterInitAttempts < MAX_FILTER_INIT_ATTEMPTS) {
                setTimeout(initializeFilters, 200);
            }
            return;
        }

        // Debug: Check if thead exists
        const thead = table.querySelector('thead');
        console.log('📋 [Weekly Lineup] Thead found:', !!thead);

        // Set up filter button click handlers
        const filterButtons = document.querySelectorAll('.th-filter-btn[data-filter]');
        console.log('🔍 [Weekly Lineup] Found', filterButtons.length, 'filter buttons');

        // Log each button found
        filterButtons.forEach((btn, i) => {
            console.log(`  → Button ${i}: data-filter="${btn.dataset.filter}", aria-controls="${btn.getAttribute('aria-controls')}"`);
        });

        if (filterButtons.length === 0) {
            console.warn('⚠️ [Weekly Lineup] No filter buttons found!');
            if (filterInitAttempts < MAX_FILTER_INIT_ATTEMPTS) {
                console.log(`  → Retrying in 200ms (attempt ${filterInitAttempts + 1}/${MAX_FILTER_INIT_ATTEMPTS})`);
                setTimeout(initializeFilters, 200);
            } else {
                console.error('❌ [Weekly Lineup] GAVE UP - no filter buttons after max attempts');
            }
            return;
        }

        console.log('✅ [Weekly Lineup] Setting up filter buttons...');
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

            // Disable the header filter dropdown arrow so it no longer opens a panel
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                console.log('🚫 [Weekly Lineup] Filter dropdown disabled for arrow click:', this.dataset.filter);
                this.setAttribute('aria-expanded', 'false');
                closeAllDropdowns();
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
                    const allChip = dropdown.querySelector('[data-league="all"], [data-market="all"], [data-segment="all"], [data-edge="all"], [data-fire="all"]');
                    if (allChip) {
                        allChip.click();
                    }
                } else if (action === 'clear') {
                    // Clear all active states and show all rows
                    dropdown.querySelectorAll('.league-chip, .filter-opt[data-market], .filter-opt[data-segment], .filter-opt[data-edge], .filter-opt[data-fire]').forEach(chip => {
                        chip.classList.remove('active');
                    });
                    // Activate "all" option if exists
                    const allChip = dropdown.querySelector('[data-league="all"], [data-market="all"], [data-segment="all"], [data-edge="all"], [data-fire="all"]');
                    if (allChip) {
                        allChip.classList.add('active');
                    }
                    applyTableFilter('reset', '');
                }
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

            // Get active filter values from UI
            const activeLeague = document.querySelector('.league-chip.active')?.getAttribute('data-league') || 'all';
            const activeSegment = document.querySelector('.filter-opt[data-segment].active')?.getAttribute('data-segment') || 'all';
            const activeEdge = document.querySelector('.filter-opt[data-edge].active')?.getAttribute('data-edge') || 'all';
            const activeFire = document.querySelector('.filter-opt[data-fire].active')?.getAttribute('data-fire') || 'all';

            // League filter
            if (activeLeague && activeLeague !== 'all') {
                const rowLeague = (row.getAttribute('data-league') || '').toLowerCase();
                if (rowLeague !== activeLeague.toLowerCase()) {
                    show = false;
                }
            }

            // Segment filter
            if (show && activeSegment && activeSegment !== 'all') {
                const rowSegment = (row.getAttribute('data-segment') || '').toLowerCase();
                if (rowSegment !== activeSegment.toLowerCase() && 
                    rowSegment !== activeSegment.replace('full', 'fg').toLowerCase()) {
                    show = false;
                }
            }

            // Edge filter (e.g., "3+", "5+", "10+")
            if (show && activeEdge && activeEdge !== 'all') {
                const rowEdge = parseFloat(row.getAttribute('data-edge')) || 0;
                const minEdge = parseFloat(activeEdge.replace('+', '')) || 0;
                if (rowEdge < minEdge) {
                    show = false;
                }
            }

            // Fire filter (e.g., "3+", "5")
            if (show && activeFire && activeFire !== 'all') {
                const rowFire = parseInt(row.getAttribute('data-fire')) || 0;
                const minFire = parseInt(activeFire.replace('+', '')) || 0;
                if (activeFire.includes('+')) {
                    if (rowFire < minFire) show = false;
                } else {
                    if (rowFire !== minFire) show = false;
                }
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
            applyToolbarFilters();
        });

        // Fetch dropdown items
        toolbar.querySelectorAll('#fetch-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const fetchType = item.dataset.fetch;
                const fetchBtn = document.getElementById('fetch-dropdown-btn');
                const menu = document.getElementById('fetch-dropdown-menu');
                
                menu.classList.remove('open');
                fetchBtn.classList.remove('open');
                
                fetchBtn.textContent = '⟳ Fetching...';
                fetchBtn.disabled = true;
                
                console.log(`🔄 [Weekly Lineup] Fetching picks: ${fetchType}`);

                // Fetch from model APIs using UnifiedPicksFetcher
                if (window.UnifiedPicksFetcher?.fetchAndDisplayPicks) {
                    window.UnifiedPicksFetcher.fetchAndDisplayPicks(fetchType)
                        .then((result) => {
                            const count = result.picks?.length || 0;
                            fetchBtn.textContent = `✓ ${count} picks`;
                            setTimeout(() => {
                                fetchBtn.textContent = '⟳ Fetch Picks ▾';
                                fetchBtn.disabled = false;
                            }, 2000);

                            // Show errors if any
                            if (result.errors?.length > 0) {
                                console.warn('[Weekly Lineup] Some APIs had errors:', result.errors);
                            }
                        })
                        .catch((err) => {
                            console.error('Fetch error:', err);
                            fetchBtn.textContent = '⟳ Fetch Picks ▾';
                            fetchBtn.disabled = false;
                        });
                } else {
                    // Fallback to AutoGameFetcher for game data only
                    if (window.AutoGameFetcher?.fetchTodaysGames) {
                        window.AutoGameFetcher.fetchTodaysGames()
                            .then(() => {
                                fetchBtn.textContent = '✓ Done';
                                setTimeout(() => {
                                    fetchBtn.textContent = '⟳ Fetch Picks ▾';
                                    fetchBtn.disabled = false;
                                }, 2000);
                            })
                            .catch((err) => {
                                console.error('Fetch error:', err);
                                fetchBtn.textContent = '⟳ Fetch Picks ▾';
                                fetchBtn.disabled = false;
                            });
                    } else {
                        setTimeout(() => {
                            fetchBtn.textContent = '⟳ Fetch Picks ▾';
                            fetchBtn.disabled = false;
                        }, 1000);
                    }
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

        console.log(`🔍 [Toolbar Filter] Leagues: ${activeLeagues.join(',')||'all'}, Edges: ${activeEdges.join(',')||'all'}, Fires: ${activeFires.join(',')||'all'}`);

        // Filter rows
        let visibleCount = 0;
        tbody.querySelectorAll('tr:not(.loading-row):not(.empty-row)').forEach(row => {
            let show = true;

            // League filter
            if (activeLeagues.length > 0) {
                const badge = row.querySelector('.league-badge, [data-league]');
                const lg = badge ? (badge.dataset.league || badge.textContent.trim()).toLowerCase() : '';
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
                const fireCell = row.cells[6];
                const cnt = (fireCell?.textContent.match(/🔥/g) || []).length;
                if (!activeFires.includes(String(cnt))) show = false;
            }

            row.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });

        console.log(`📊 [Toolbar Filter] ${visibleCount} rows visible`);
        applyZebraStripes();
    }

    // ===== SORTING INITIALIZATION =====
    function initializeSorting() {
        const sortButtons = document.querySelectorAll('.th-sort-btn');

        sortButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const th = this.closest('th');
                const sortKey = th.getAttribute('data-sort');
                const currentDirection = th.classList.contains('sort-asc') ? 'asc' :
                                       th.classList.contains('sort-desc') ? 'desc' : null;

                // Remove sort classes from all headers
                document.querySelectorAll('th[data-sort]').forEach(header => {
                    header.classList.remove('sort-asc', 'sort-desc');
                    header.removeAttribute('aria-sort');
                });

                // Set new sort direction
                let newDirection;
                if (currentDirection === 'asc') {
                    newDirection = 'desc';
                    th.classList.add('sort-desc');
                    th.setAttribute('aria-sort', 'descending');
                } else {
                    newDirection = 'asc';
                    th.classList.add('sort-asc');
                    th.setAttribute('aria-sort', 'ascending');
                }

                // Perform sort
                sortTable(sortKey, newDirection);

                // Update sort icons (carats for sorting)
                updateSortIndicators();
            });
        });

        // Initialize sort icons on load (carats for sorting)
        updateSortIndicators();
    }

    function updateSortIndicators() {
        document.querySelectorAll('th[data-sort]').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (!icon) return;

            if (th.classList.contains('sort-desc')) {
                icon.textContent = '▾';
            } else if (th.classList.contains('sort-asc')) {
                icon.textContent = '▴';
            } else {
                // Default (inactive) indicator
                icon.textContent = '▴';
            }
        });
    }

    // ===== SORT TABLE =====
    function sortTable(sortKey, direction) {
        const tbody = document.querySelector('.weekly-lineup-table tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // Update current sort state
        currentSort = { column: sortKey, direction };

        rows.sort((a, b) => {
            let aValue = getCellValue(a, sortKey);
            let bValue = getCellValue(b, sortKey);

            // Handle numeric values
            if (!isNaN(aValue) && !isNaN(bValue)) {
                aValue = parseFloat(aValue);
                bValue = parseFloat(bValue);
            }

            if (direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));

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
        const tbody = document.getElementById('weekly-lineup-tbody');
        if (!tbody) {
            console.warn('[Weekly Lineup] Table body not found for tracker buttons');
            return;
        }

        tbody.addEventListener('click', function(e) {
            const btn = e.target.closest('.tracker-btn');
            if (!btn) return;

            const row = btn.closest('tr');
            if (!row) return;

            // Extract pick data from the row
            const pickData = extractPickFromRow(row);

            if (pickData) {
                addPickToDashboard(pickData, btn);
            }
        });

        console.log('[Weekly Lineup] Tracker buttons initialized');
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

            // Model prediction (6th cell)
            const modelCell = cells[5];
            const modelPrediction = modelCell?.textContent?.trim() || '';

            // Market line (7th cell)
            const marketCell = cells[6];
            const marketLine = marketCell?.textContent?.trim() || '';

            // Edge (8th cell)
            const edgeCell = cells[7];
            const edgeText = edgeCell?.textContent?.trim() || '0';
            const edge = parseFloat(edgeText.replace(/[+%pts]/g, '')) || 0;

            // Fire rating (9th cell)
            const fireCell = cells[8];
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

    function addPickToDashboard(pickData, btn) {
        // Save directly to localStorage (same key as LocalPicksManager)
        const STORAGE_KEY = 'gbsv_picks';

        try {
            // Get existing picks
            const existingData = localStorage.getItem(STORAGE_KEY);
            const existingPicks = existingData ? JSON.parse(existingData) : [];

            // Add ID and timestamp
            pickData.id = `pick_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            pickData.createdAt = new Date().toISOString();

            // Add to array
            existingPicks.push(pickData);

            // Save back
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existingPicks));

            // Visual feedback
            btn.textContent = '✓';
            btn.classList.add('added');
            btn.disabled = true;

            showNotification(`Added ${pickData.pickTeam} ${pickData.line} to Dashboard`, 'success');
            console.log('[Weekly Lineup] Pick saved to localStorage:', pickData);
        } catch (err) {
            console.error('[Weekly Lineup] Failed to save pick:', err);
            showNotification('Failed to add pick', 'error');
        }
    }

    // Export for external use
    window.WeeklyLineup = {
        loadModelOutputs,
        populateTable: populateWeeklyLineupTable,
        showNotification,
        addPickToDashboard
    };

    log('✅ Weekly Lineup v2.0 loaded');
})();

