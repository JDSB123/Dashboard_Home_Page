/**
 * Team Data Loader
 * Loads team data from external JSON file
 * Falls back to hardcoded data if file fails to load
 */

(function() {
    'use strict';

    let teamDataCache = null;
    let teamDataPromise = null;

    /**
     * Load team data from JSON file
     * @returns {Promise<Object>} Team data object
     */
    async function loadTeamData() {
        if (teamDataCache) {
            return teamDataCache;
        }

        if (teamDataPromise) {
            return teamDataPromise;
        }

        teamDataPromise = (async () => {
            try {
                const response = await fetch('assets/data/team-data.json?v=20250101');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                
                // Flatten the structure for backward compatibility
                const flattened = {};
                Object.keys(data).forEach(league => {
                    Object.assign(flattened, data[league]);
                });
                
                teamDataCache = flattened;
                return flattened;
            } catch (error) {
                console.warn('[TeamDataLoader] Failed to load team-data.json, using fallback:', error);
                // Return empty object - will fall back to hardcoded data in local-picks-manager
                return {};
            }
        })();

        return teamDataPromise;
    }

    /**
     * Get team info from loaded data
     * @param {string} teamName - Team name to lookup
     * @param {string} league - Optional league hint (nba, nfl, ncaab)
     * @returns {Object} Team info with abbr, logo, fullName
     */
    async function getTeamInfo(teamName, league = null) {
        if (!teamName) {
            return { abbr: 'N/A', fullName: '', logo: '' };
        }

        // Ensure data is loaded
        const data = await loadTeamData();
        
        const lower = teamName.toLowerCase().trim();
        
        // Try direct lookup
        if (data[lower]) {
            return {
                abbr: data[lower].abbr || teamName.substring(0, 3).toUpperCase(),
                fullName: data[lower].fullName || teamName,
                logo: data[lower].logo || ''
            };
        }

        // Try with league-specific lookup if league provided
        if (league && window.TEAM_DATA_BY_LEAGUE && window.TEAM_DATA_BY_LEAGUE[league]) {
            const leagueData = window.TEAM_DATA_BY_LEAGUE[league];
            if (leagueData[lower]) {
                return {
                    abbr: leagueData[lower].abbr || teamName.substring(0, 3).toUpperCase(),
                    fullName: leagueData[lower].fullName || teamName,
                    logo: leagueData[lower].logo || ''
                };
            }
        }

        // Fallback: generate abbreviation
        return {
            abbr: teamName.substring(0, 3).toUpperCase(),
            fullName: teamName,
            logo: ''
        };
    }

    /**
     * Preload team data (call on page load)
     */
    function preloadTeamData() {
        loadTeamData().catch(err => {
            console.warn('[TeamDataLoader] Preload failed:', err);
        });
    }

    // Export to global scope
    window.TeamDataLoader = {
        load: loadTeamData,
        getTeamInfo: getTeamInfo,
        preload: preloadTeamData
    };

    // Auto-preload on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', preloadTeamData);
    } else {
        preloadTeamData();
    }

})();
