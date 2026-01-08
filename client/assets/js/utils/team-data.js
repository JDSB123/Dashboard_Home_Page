/**
 * Team Data Module v1.0
 * Consolidated team data provider - single source of truth
 * Loads from assets/data/team-config.json and provides lookup APIs
 */
(function() {
    'use strict';

    // Cache for loaded team data
    let teamConfig = null;
    let teamLookup = {};
    let isLoaded = false;
    let loadPromise = null;

    // ESPN logo URL templates
    const LOGO_TEMPLATES = {
        nba: 'https://a.espncdn.com/i/teamlogos/nba/500/{id}.png',
        nfl: 'https://a.espncdn.com/i/teamlogos/nfl/500/{id}.png',
        nhl: 'https://a.espncdn.com/i/teamlogos/nhl/500/{id}.png',
        ncaab: 'https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png',
        ncaaf: 'https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png',
        mlb: 'https://a.espncdn.com/i/teamlogos/mlb/500/{id}.png'
    };

    // League logo URLs
    const LEAGUE_LOGOS = {
        'NBA': 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
        'NFL': 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png',
        'NHL': 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
        'MLB': 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
        'NCAAB': 'assets/logo_ncaam_bball.png',
        'NCAAM': 'assets/logo_ncaam_bball.png',
        'NCAAF': 'assets/logo_ncaa_football.png',
        'CBB': 'assets/logo_ncaam_bball.png',
        'CFB': 'assets/logo_ncaa_football.png'
    };

    // ESPN team ID mappings for logos (NCAA uses numeric IDs)
    const ESPN_TEAM_IDS = {
        // NBA uses lowercase abbreviations
        'atl': 'atl', 'bos': 'bos', 'bkn': 'bkn', 'cha': 'cha', 'chi': 'chi',
        'cle': 'cle', 'dal': 'dal', 'den': 'den', 'det': 'det', 'gsw': 'gs',
        'hou': 'hou', 'ind': 'ind', 'lac': 'lac', 'lal': 'lal', 'mem': 'mem',
        'mia': 'mia', 'mil': 'mil', 'min': 'min', 'nop': 'no', 'nyk': 'ny',
        'okc': 'okc', 'orl': 'orl', 'phi': 'phi', 'phx': 'phx', 'por': 'por',
        'sac': 'sac', 'sas': 'sa', 'tor': 'tor', 'uta': 'utah', 'was': 'wsh',
        
        // NFL uses lowercase abbreviations
        'ari': 'ari', 'bal': 'bal', 'buf': 'buf', 'car': 'car', 'cin': 'cin',
        'gb': 'gb', 'hou': 'hou', 'jax': 'jax', 'kc': 'kc', 'lv': 'lv',
        'lar': 'lar', 'mia': 'mia', 'min': 'min', 'ne': 'ne', 'no': 'no',
        'nyg': 'nyg', 'nyj': 'nyj', 'pit': 'pit', 'sea': 'sea', 'sf': 'sf',
        'tb': 'tb', 'ten': 'ten', 'was': 'wsh',

        // NCAA Basketball - numeric IDs
        'duke': '150', 'unc': '153', 'uk': '96', 'ku': '2305', 'msu': '127',
        'iu': '84', 'cuse': '183', 'conn': '41', 'ucla': '26', 'lou': '97',
        'gonz': '2250', 'baylor': '239',
        
        // NCAA common teams
        'georgia southern': '290', 'appalachian st': '2026', 'utsa': '2636',
        'south florida': '58', 'butler': '2086', 'uconn': '41',
        'abilene christian': '2000', 'arizona': '12', 'montana st': '149',
        'cal poly': '13', 'oral roberts': '198', 'missouri st': '2623',
        'marist': '2368', 'georgia tech': '59', 'east tenn st': '2193'
    };

    /**
     * Load team configuration from JSON
     */
    async function loadConfig() {
        if (loadPromise) return loadPromise;
        if (isLoaded) return teamConfig;

        loadPromise = (async () => {
            try {
                const response = await fetch('assets/data/team-config.json');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                teamConfig = await response.json();
                buildLookupTable();
                isLoaded = true;
                console.log('[TeamData] Loaded team configuration');
                return teamConfig;
            } catch (error) {
                console.warn('[TeamData] Could not load config, using defaults:', error);
                teamConfig = getDefaultConfig();
                buildLookupTable();
                isLoaded = true;
                return teamConfig;
            }
        })();

        return loadPromise;
    }

    /**
     * Build lookup table for fast team searches
     */
    function buildLookupTable() {
        if (!teamConfig) return;

        teamLookup = {};

        // Process each league
        ['nfl', 'nba', 'nhl', 'ncaab', 'ncaaf'].forEach(league => {
            const leagueData = teamConfig[league];
            if (!leagueData || !leagueData.teams) return;

            Object.entries(leagueData.teams).forEach(([abbr, team]) => {
                const entry = {
                    abbr: abbr.toUpperCase(),
                    name: team.name,
                    fullName: team.fullName,
                    city: team.city,
                    league: league.toUpperCase(),
                    logo: getTeamLogoUrl(abbr.toLowerCase(), league)
                };

                // Index by abbreviation
                teamLookup[abbr.toLowerCase()] = entry;
                
                // Index by full name
                if (team.fullName) {
                    teamLookup[team.fullName.toLowerCase()] = entry;
                }
                
                // Index by name only
                if (team.name) {
                    teamLookup[team.name.toLowerCase()] = entry;
                }
                
                // Index by city + name
                if (team.city && team.name) {
                    teamLookup[`${team.city} ${team.name}`.toLowerCase()] = entry;
                }
            });
        });
    }

    /**
     * Get team logo URL
     */
    function getTeamLogoUrl(teamId, league) {
        const template = LOGO_TEMPLATES[league.toLowerCase()];
        if (!template) return '';

        // Get ESPN ID mapping
        const espnId = ESPN_TEAM_IDS[teamId.toLowerCase()] || teamId.toLowerCase();
        
        return template.replace('{id}', espnId);
    }

    /**
     * Get default config if JSON fails to load
     */
    function getDefaultConfig() {
        return {
            nfl: { teams: {} },
            nba: { teams: {} },
            nhl: { teams: {} },
            ncaab: { teams: {} },
            ncaaf: { teams: {} }
        };
    }

    /**
     * Get team info by name or abbreviation
     * @param {string} teamName - Team name, abbreviation, or full name
     * @param {string} [league] - Optional league hint
     * @returns {{ abbr: string, name: string, fullName: string, logo: string, league: string }}
     */
    function getTeamInfo(teamName, league) {
        if (!teamName) return { abbr: 'N/A', name: '', fullName: '', logo: '', league: '' };

        const key = teamName.toLowerCase().trim();
        
        // Direct lookup
        if (teamLookup[key]) {
            return teamLookup[key];
        }

        // Try partial matches
        for (const [lookupKey, team] of Object.entries(teamLookup)) {
            if (lookupKey.includes(key) || key.includes(lookupKey)) {
                return team;
            }
        }

        // Fallback - generate basic info
        return {
            abbr: generateAbbreviation(teamName),
            name: teamName,
            fullName: teamName,
            logo: league ? getTeamLogoUrl(teamName.toLowerCase().replace(/\s+/g, ''), league) : '',
            league: league || ''
        };
    }

    /**
     * Generate abbreviation from team name
     */
    function generateAbbreviation(name) {
        if (!name) return 'N/A';
        
        const words = name.trim().split(/\s+/).filter(Boolean);
        if (words.length === 1) {
            return words[0].substring(0, 3).toUpperCase();
        }
        
        // Use first letters of each word
        const abbr = words.map(w => w[0]).join('').toUpperCase();
        return abbr.length >= 2 && abbr.length <= 4 ? abbr : words[0].substring(0, 3).toUpperCase();
    }

    /**
     * Get team abbreviation
     */
    function getTeamAbbr(teamName, league) {
        return getTeamInfo(teamName, league).abbr;
    }

    /**
     * Get team logo URL
     */
    function getTeamLogo(teamName, league) {
        const info = getTeamInfo(teamName, league);
        if (info.logo) return info.logo;

        // Fallback to direct URL generation
        if (league) {
            const id = ESPN_TEAM_IDS[teamName.toLowerCase()] || 
                       teamName.toLowerCase().replace(/\s+/g, '').substring(0, 3);
            return getTeamLogoUrl(id, league);
        }
        
        return '';
    }

    /**
     * Get league logo URL
     */
    function getLeagueLogo(league) {
        return LEAGUE_LOGOS[league.toUpperCase()] || '';
    }

    /**
     * Parse teams from game string (e.g., "Team A @ Team B")
     */
    function parseTeamsFromGame(gameString) {
        if (!gameString) return { away: '', home: '' };

        const separators = [' @ ', ' vs ', ' vs. ', ' / ', ' v '];
        for (const sep of separators) {
            if (gameString.includes(sep)) {
                const parts = gameString.split(sep);
                return {
                    away: parts[0].trim(),
                    home: parts[1] ? parts[1].trim() : ''
                };
            }
        }

        return { away: gameString.trim(), home: '' };
    }

    /**
     * Get status sort order
     */
    function getStatusSortOrder(status) {
        const order = teamConfig?.statusSortOrder || {
            'pending': 1, 'on-track': 2, 'at-risk': 3,
            'win': 4, 'lost': 5, 'push': 6
        };
        return order[status.toLowerCase()] || 99;
    }

    /**
     * Get bet type label
     */
    function getBetTypeLabel(betType) {
        const labels = teamConfig?.betTypeLabels || {
            'spread': 'Spread', 'moneyline': 'Moneyline', 'total': 'Total',
            'parlay': 'Parlay', 'prop': 'Prop'
        };
        return labels[betType.toLowerCase()] || betType;
    }

    /**
     * Get segment label
     */
    function getSegmentLabel(segment) {
        const labels = teamConfig?.segmentLabels || {
            'full-game': 'Full Game', '1h': '1st Half', '2h': '2nd Half',
            'fg': 'Full Game', '1q': '1st Quarter', '2q': '2nd Quarter',
            '3q': '3rd Quarter', '4q': '4th Quarter'
        };
        return labels[segment.toLowerCase()] || segment;
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadConfig);
    } else {
        loadConfig();
    }

    // Export API
    window.TeamData = {
        load: loadConfig,
        getTeamInfo,
        getTeamAbbr,
        getTeamLogo,
        getLeagueLogo,
        parseTeamsFromGame,
        getStatusSortOrder,
        getBetTypeLabel,
        getSegmentLabel,
        LEAGUE_LOGOS
    };

    console.log('[TeamData] Module loaded');
})();

