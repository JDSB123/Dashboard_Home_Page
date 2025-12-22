/**
 * Picks Data Processor Module
 * Handles data collection, processing, and facet extraction from table
 */
(function() {
    'use strict';

    const DataProcessor = {
        /**
         * Collect all unique date/time/book values from table
         */
        collectDateFilterFacets() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return { dates: new Set(), times: new Set(), books: new Set() };

            const facets = {
                dates: new Set(),
                times: new Set(),
                books: new Set()
            };

            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');
            rows.forEach(row => {
                const dateCell = row.querySelector('td:first-child');
                if (!dateCell) return;

                // Extract date
                const dateEl = dateCell.querySelector('.cell-date');
                if (dateEl) {
                    const dateText = dateEl.textContent.trim();
                    if (dateText) {
                        // Add with weekday
                        const weekday = window.PicksDOMUtils ?
                            window.PicksDOMUtils.getWeekdayName(dateText) : '';
                        const fullDate = weekday ? `${weekday} ${dateText}` : dateText;
                        facets.dates.add(fullDate);
                    }
                }

                // Extract time
                const timeEl = dateCell.querySelector('.cell-time');
                if (timeEl) {
                    const timeText = timeEl.textContent.trim();
                    if (timeText) {
                        facets.times.add(timeText);
                    }
                }

                // Extract sportsbook
                const bookEl = dateCell.querySelector('.cell-book, .sportsbook-name');
                if (bookEl) {
                    const bookText = bookEl.textContent.trim();
                    if (bookText) {
                        facets.books.add(bookText);
                    }
                }
            });

            return {
                dates: Array.from(facets.dates).sort(),
                times: Array.from(facets.times).sort((a, b) => {
                    // Sort times chronologically
                    const timeA = this.parseTimeValue(a);
                    const timeB = this.parseTimeValue(b);
                    return timeA - timeB;
                }),
                books: Array.from(facets.books).sort()
            };
        },

        /**
         * Parse time value for sorting
         */
        parseTimeValue(timeText) {
            const match = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
            if (!match) return 0;

            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3] ? match[3].toLowerCase() : '';

            if (period === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period === 'am' && hours === 12) {
                hours = 0;
            }

            return hours * 60 + minutes;
        },

        /**
         * Get all unique leagues from table
         */
        getLeaguesFromTable() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return [];

            const leagues = new Set();
            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');

            rows.forEach(row => {
                const matchupCell = row.querySelector('td:nth-child(2)');
                if (matchupCell) {
                    const league = this.detectLeagueFromCell(matchupCell);
                    if (league) {
                        leagues.add(league.toUpperCase());
                    }
                }
            });

            return Array.from(leagues).sort();
        },

        /**
         * Detect league from matchup cell
         */
        detectLeagueFromCell(cell) {
            if (!cell) return '';

            const text = cell.textContent.toLowerCase();

            // Check for league indicators
            const leaguePatterns = {
                'nfl': /(?:patriots|cowboys|packers|chiefs|bills|dolphins|jets|ravens|bengals|browns|steelers|texans|colts|jaguars|titans|broncos|chargers|raiders|eagles|giants|commanders|bears|lions|vikings|falcons|panthers|saints|buccaneers|cardinals|rams|49ers|seahawks)/,
                'nba': /(?:celtics|nets|knicks|76ers|raptors|bulls|cavaliers|pistons|pacers|bucks|hawks|heat|magic|wizards|hornets|nuggets|timberwolves|thunder|blazers|jazz|warriors|clippers|lakers|suns|kings|mavericks|rockets|grizzlies|pelicans|spurs)/,
                'mlb': /(?:orioles|red sox|yankees|rays|blue jays|white sox|guardians|tigers|royals|twins|astros|athletics|angels|mariners|rangers|braves|marlins|mets|phillies|nationals|brewers|cubs|reds|pirates|cardinals|diamondbacks|rockies|dodgers|padres|giants)/,
                'nhl': /(?:bruins|sabres|red wings|panthers|canadiens|senators|lightning|maple leafs|hurricanes|blue jackets|devils|islanders|rangers|flyers|penguins|capitals|blackhawks|avalanche|stars|wild|predators|blues|jets|ducks|coyotes|flames|oilers|kings|sharks|kraken|canucks|golden knights)/,
                'ncaa': /(?:alabama|georgia|michigan|ohio state|clemson|lsu|oklahoma|texas|florida|usc|notre dame|penn state|tennessee|auburn|wisconsin|oregon|washington|miami|florida state|nebraska)/,
                'soccer': /(?:manchester|liverpool|chelsea|arsenal|barcelona|real madrid|bayern|juventus|psg|milan|inter|atletico|dortmund|ajax|benfica|porto|celtic|rangers)/
            };

            for (const [league, pattern] of Object.entries(leaguePatterns)) {
                if (pattern.test(text)) {
                    return league;
                }
            }

            return '';
        },

        /**
         * Get teams for a specific league
         */
        getTeamsForLeague(league) {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody || !league) return [];

            const teams = new Set();
            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');

            rows.forEach(row => {
                const matchupCell = row.querySelector('td:nth-child(2)');
                if (matchupCell) {
                    const cellLeague = this.detectLeagueFromCell(matchupCell);
                    if (cellLeague.toUpperCase() === league.toUpperCase()) {
                        const extractedTeams = this.extractTeamsFromCell(matchupCell);
                        extractedTeams.forEach(team => teams.add(team));
                    }
                }
            });

            return Array.from(teams).sort();
        },

        /**
         * Extract team names from matchup cell
         */
        extractTeamsFromCell(cell) {
            if (!cell) return [];

            const teams = [];

            // Try to get from logos
            const logos = cell.querySelectorAll('.team-logo');
            if (logos.length > 0) {
                logos.forEach(logo => {
                    const name = logo.getAttribute('alt') ||
                                logo.getAttribute('title') ||
                                '';
                    if (name) teams.push(name);
                });
            }

            // Fallback to text parsing
            if (teams.length === 0) {
                const text = cell.textContent;
                // Split on common separators
                const parts = text.split(/\s+(?:vs?\.?|@|at)\s+/i);
                parts.forEach(part => {
                    const cleaned = part.trim();
                    if (cleaned && cleaned.length > 2) {
                        teams.push(cleaned);
                    }
                });
            }

            return teams;
        },

        /**
         * Get game day/date from row
         */
        getGameDayFromRow(row) {
            const dateCell = row.querySelector('td:first-child');
            if (!dateCell) return null;

            const dateEl = dateCell.querySelector('.cell-date');
            if (!dateEl) return null;

            const dateText = dateEl.textContent.trim();
            if (!dateText) return null;

            // Parse MM/DD format
            const match = dateText.match(/(\d{1,2})\/(\d{1,2})/);
            if (!match) return null;

            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            const year = new Date().getFullYear();

            return new Date(year, month - 1, day);
        },

        /**
         * Collect all status values from table
         */
        collectStatusValues() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return [];

            const statuses = new Set();
            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');

            rows.forEach(row => {
                const statusCell = row.querySelector('td:last-child');
                if (statusCell) {
                    const badge = statusCell.querySelector('.status-badge');
                    if (badge) {
                        const status = badge.getAttribute('data-status') ||
                                      badge.className.match(/status-(\w+)/)?.[1] ||
                                      badge.textContent.trim();
                        if (status) {
                            statuses.add(status.toLowerCase());
                        }
                    }
                }
            });

            return Array.from(statuses).sort();
        },

        /**
         * Collect risk/win ranges from table
         */
        collectValueRanges(columnIndex) {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return [];

            const values = [];
            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');

            rows.forEach(row => {
                const cell = row.querySelector(`td:nth-child(${columnIndex})`);
                if (cell) {
                    const text = cell.textContent.replace(/[$,]/g, '').trim();
                    const value = parseFloat(text);
                    if (!isNaN(value)) {
                        values.push(value);
                    }
                }
            });

            // Create ranges based on data distribution
            return this.createValueRanges(values);
        },

        /**
         * Create value ranges for filtering
         */
        createValueRanges(values) {
            if (!values || values.length === 0) return [];

            const sorted = values.sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];

            // Create logical ranges
            const ranges = [];

            if (max <= 100) {
                ranges.push('0-25', '25-50', '50-75', '75-100');
            } else if (max <= 500) {
                ranges.push('0-50', '50-100', '100-250', '250-500');
            } else if (max <= 1000) {
                ranges.push('0-100', '100-250', '250-500', '500-1000');
            } else {
                ranges.push('0-100', '100-500', '500-1000', '1000-5000', '5000+');
            }

            // Filter to only include ranges with data
            return ranges.filter(range => {
                const [rangeMin, rangeMax] = range.includes('+') ?
                    [parseFloat(range), Infinity] :
                    range.split('-').map(parseFloat);

                return values.some(v => v >= rangeMin && v <= rangeMax);
            });
        },

        /**
         * Calculate KPIs from visible rows
         */
        calculateKPIsFromVisibleRows() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return this.getEmptyKPIs();

            const visibleRows = Array.from(tbody.querySelectorAll('tr:not(.parlay-legs)'))
                .filter(row => row.style.display !== 'none');

            let totalRisk = 0;
            let totalWin = 0;
            let wins = 0;
            let losses = 0;
            let pushes = 0;
            let pending = 0;
            let live = 0;

            visibleRows.forEach(row => {
                // Get risk amount
                const riskCell = row.querySelector('td:nth-child(4)');
                if (riskCell) {
                    const risk = parseFloat(riskCell.textContent.replace(/[$,]/g, '')) || 0;
                    totalRisk += risk;
                }

                // Get win amount
                const winCell = row.querySelector('td:nth-child(5)');
                if (winCell) {
                    const win = parseFloat(winCell.textContent.replace(/[$,]/g, '')) || 0;
                    totalWin += win;
                }

                // Get status
                const statusCell = row.querySelector('td:last-child');
                if (statusCell) {
                    const badge = statusCell.querySelector('.status-badge');
                    const statusText = badge ?
                        (badge.getAttribute('data-status') || badge.textContent.trim()) :
                        statusCell.textContent.trim();

                    const normalized = window.PicksDOMUtils && window.PicksDOMUtils.normalizeStatus ?
                        window.PicksDOMUtils.normalizeStatus(statusText) :
                        statusText.toLowerCase();

                    if (normalized === 'win' || normalized.includes('win') || normalized === 'won') wins++;
                    else if (normalized === 'loss' || normalized.includes('loss') || normalized === 'lost') losses++;
                    else if (normalized === 'push' || normalized.includes('push')) pushes++;
                    else if (normalized === 'live' || normalized.includes('live') || normalized.includes('active')) live++;
                    else if (normalized === 'pending' || normalized.includes('pending') || normalized === 'open') pending++;
                }
            });

            const totalBets = visibleRows.length;
            const settledBets = wins + losses + pushes;
            const winRate = settledBets > 0 ? (wins / settledBets * 100).toFixed(1) : 0;
            const roi = totalRisk > 0 ? ((totalWin - totalRisk) / totalRisk * 100).toFixed(1) : 0;

            return {
                totalBets,
                totalRisk,
                totalWin,
                profit: totalWin - totalRisk,
                roi,
                winRate,
                wins,
                losses,
                pushes,
                pending,
                live,
                settled: settledBets
            };
        },

        /**
         * Get empty KPI object
         */
        getEmptyKPIs() {
            return {
                totalBets: 0,
                totalRisk: 0,
                totalWin: 0,
                profit: 0,
                roi: 0,
                winRate: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                pending: 0,
                live: 0,
                settled: 0
            };
        },

        /**
         * Detect bet types from all rows
         */
        collectBetTypes() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return { types: [], subtypes: [] };

            const types = new Set();
            const subtypes = new Set();

            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');
            rows.forEach(row => {
                const pickCell = row.querySelector('td:nth-child(3)');
                if (pickCell) {
                    const detected = this.detectBetTypeFromCell(pickCell);
                    if (detected.type) types.add(detected.type);
                    if (detected.subtype) subtypes.add(detected.subtype);
                }
            });

            return {
                types: Array.from(types).sort(),
                subtypes: Array.from(subtypes).sort()
            };
        },

        /**
         * Detect bet type from pick cell
         */
        detectBetTypeFromCell(cell) {
            if (!cell) return { type: '', subtype: '' };

            const text = (cell.textContent || '').toLowerCase();

            // Check data attributes first
            const betTypeEl = cell.querySelector('[data-bet-type]');
            if (betTypeEl) {
                return {
                    type: betTypeEl.getAttribute('data-bet-type') || '',
                    subtype: betTypeEl.getAttribute('data-bet-subtype') || ''
                };
            }

            // Pattern matching
            if (text.includes('spread') || /[+-]\d+\.?\d*/.test(text)) {
                return { type: 'spread', subtype: this.detectSegmentFromText(text) };
            }

            if (text.includes('total') || text.includes('over') || text.includes('under')) {
                return { type: 'total', subtype: this.detectSegmentFromText(text) };
            }

            if (text.includes('moneyline') || text.includes(' ml ')) {
                return { type: 'moneyline', subtype: this.detectSegmentFromText(text) };
            }

            if (text.includes('parlay')) {
                return { type: 'parlay', subtype: '' };
            }

            if (text.includes('prop') || text.includes('player')) {
                return { type: 'prop', subtype: '' };
            }

            return { type: '', subtype: '' };
        },

        /**
         * Detect segment from text
         */
        detectSegmentFromText(text) {
            const lower = text.toLowerCase();

            if (lower.includes('1st') || lower.includes('first') ||
                lower.includes('1h') || lower.includes('1q')) {
                return '1h';
            }

            if (lower.includes('2nd') || lower.includes('second') ||
                lower.includes('2h') || lower.includes('3q') || lower.includes('4q')) {
                return '2h';
            }

            return 'game';
        }
    };

    // Export to global scope
    window.PicksDataProcessor = DataProcessor;

})();