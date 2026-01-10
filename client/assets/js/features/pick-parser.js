/**
 * Universal Pick Parser v1.0.0
 * Parses picks from multiple formats: plain text, CSV, Telegram exports, etc.
 * Returns standardized pick objects for use in dashboard
 */

(function() {
    'use strict';

    /**
     * Parse picks from various text formats
     * Supports:
     * - "Lakers -3.5 -110 $50k" (simple format)
     * - "Lakers -3.5 @ -110 odds $50 risk" (natural language)
     * - CSV rows with League,Matchup,Pick,Odds,Risk columns
     * - Telegram text exports with emoji parsing
     * 
     * @param {string} text - Raw text input
     * @param {string} league - Optional default league (NBA, NFL, NCAAM, NCAAF)
     * @returns {Array} Array of pick objects
     */
    function parsePicksFromText(text, league = null) {
        if (!text || typeof text !== 'string') return [];

        const picks = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
            const pick = parsePickLine(line, league);
            if (pick && isValidPick(pick)) {
                picks.push(pick);
            }
        }

        return picks;
    }

    /**
     * Parse a single line into a pick object
     * @param {string} line - Single line of text
     * @param {string} defaultLeague - Optional default league
     * @returns {Object|null} Pick object or null if invalid
     */
    function parsePickLine(line, defaultLeague = null) {
        line = line.trim();
        if (!line) return null;

        // Remove Telegram metadata (timestamps, usernames, etc.)
        line = cleanTelegramText(line);

        // Try multiple patterns in order of specificity
        let pick = tryParseSimpleFormat(line);
        if (!pick) pick = tryParseNaturalLanguage(line);
        if (!pick) pick = tryParseCSVFormat(line);
        if (!pick) pick = tryParseTelegramFormat(line);

        if (pick && defaultLeague) {
            pick.league = pick.league || defaultLeague;
        }

        return pick;
    }

    /**
     * Remove Telegram-specific metadata
     * Examples: "12:30 PM", "@username", "forwarded from...", etc.
     */
    function cleanTelegramText(text) {
        // Remove timestamps (12:30 AM, 14:30, etc.)
        text = text.replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\b/g, '');
        
        // Remove @username mentions at start
        text = text.replace(/^@\w+\s+/i, '');
        
        // Remove "forwarded from" messages
        text = text.replace(/forwarded from.*$/i, '');
        
        return text.trim();
    }

    /**
     * Try simple format: "Lakers -3.5 -110 $50k"
     * Pattern: Team Pick Odds Amount
     */
    function tryParseSimpleFormat(line) {
        // Pattern: Something -X.X -XXX $XXk or $XX
        const pattern = /^(.+?)\s+([+-]?\d+\.?\d*)\s+([+-]?\d{2,4})\s+\$?([\d.]+k?|\d+)/i;
        const match = line.match(pattern);

        if (!match) return null;

        const [, matchupPart, pick, odds, amount] = match;

        return {
            matchup: matchupPart.trim(),
            pick: `${matchupPart.trim()} ${pick}`.trim(),
            odds: parseInt(odds),
            risk: parseAmount(amount),
            league: detectLeague(matchupPart),
            segment: detectSegment(line),
            fire: detectFire(line)
        };
    }

    /**
     * Try natural language format: "Lakers -3.5 at -110 odds, $50k risk"
     */
    function tryParseNaturalLanguage(line) {
        // More flexible pattern that handles variations
        const teamPickPattern = /^(.+?)\s+([+-]?\d+\.?\d*(?:\s*(?:vs|@|-)\s*)?(?:spread|over|under)?)/i;
        const match = line.match(teamPickPattern);

        if (!match) return null;

        const [, matchupPart, pickPart] = match;

        // Extract odds: -110, +220, 120 etc
        const oddsMatch = line.match(/([+-]?\d{2,4})(?:\s+odds)?/);
        const odds = oddsMatch ? parseInt(oddsMatch[1]) : -110;

        // Extract risk/amount
        const amountMatch = line.match(/\$?([\d.]+k?|\d+)(?:\s+(?:risk|to risk|at risk))?/i);
        const risk = amountMatch ? parseAmount(amountMatch[1]) : 50000;

        return {
            matchup: matchupPart.trim(),
            pick: `${matchupPart.trim()} ${pickPart}`.trim(),
            odds: odds,
            risk: risk,
            league: detectLeague(matchupPart),
            segment: detectSegment(line),
            fire: detectFire(line)
        };
    }

    /**
     * Try CSV format: league,matchup,pick,odds,risk
     */
    function tryParseCSVFormat(line) {
        const parts = line.split(',').map(p => p.trim());

        if (parts.length < 4) return null;

        // Check if first part looks like a league
        const potentialLeague = parts[0].toUpperCase();
        if (!['NBA', 'NFL', 'NCAAM', 'NCAAF'].includes(potentialLeague)) {
            return null;
        }

        return {
            league: potentialLeague,
            matchup: parts[1],
            pick: parts[2],
            odds: parseInt(parts[3]) || -110,
            risk: parts[4] ? parseAmount(parts[4]) : 50000,
            segment: parts[5] || 'FG',
            fire: parts[6] ? parseInt(parts[6]) : 1
        };
    }

    /**
     * Try Telegram format with emojis and special text
     * Examples: "🔥🔥🔥 Lakers -3.5 -110 | $50k"
     */
    function tryParseTelegramFormat(line) {
        // Remove emojis temporarily to parse, but track fire level
        const fire = (line.match(/🔥/g) || []).length;
        const cleanLine = line.replace(/🔥/g, '').replace(/\s+/g, ' ').trim();

        // Remove special separators
        const normalized = cleanLine
            .replace(/[|•·]/g, ' ')
            .replace(/\s+/g, ' ');

        // Try parsing the cleaned line
        let pick = tryParseSimpleFormat(normalized) || tryParseNaturalLanguage(normalized);

        if (pick && fire > 0) {
            pick.fire = fire;
        }

        return pick;
    }

    /**
     * Validate that a pick has required fields
     */
    function isValidPick(pick) {
        return pick
            && pick.matchup
            && pick.pick
            && pick.odds
            && pick.risk > 0;
    }

    /**
     * Parse amount string: "50k" -> 50000, "100" -> 100000, "50" -> 50000
     */
    function parseAmount(str) {
        if (!str) return 50000;

        str = str.toString().toLowerCase().trim();

        // Remove dollar signs
        str = str.replace('$', '');

        // Handle 'k' suffix (thousands)
        if (str.includes('k')) {
            return Math.round(parseFloat(str.replace('k', '')) * 1000);
        }

        // Parse as number
        const num = parseFloat(str);
        if (isNaN(num)) return 50000;

        // If number is less than 1000, assume it's in units (multiply by 1000)
        if (num < 1000) {
            return num * 1000;
        }

        return Math.round(num);
    }

    /**
     * Detect league from team names
     */
    function detectLeague(text) {
        const upperText = text.toUpperCase();

        // NBA teams
        const nbaTeams = ['LAKERS', 'CELTICS', 'WARRIORS', 'NETS', 'BULLS', 'HEAT', 'NUGGETS', 'SUNS', 'CLIPPERS', 'GRIZZLIES', 'MAVS', 'KINGS', 'TRAIL BLAZERS', 'SPURS', 'HAWKS', 'KNICKS', 'RAPTORS', 'SIXERS', 'BUCKS', 'TIMBERWOLVES', 'PACERS', 'CAVALIERS', 'PISTONS', 'MAGIC', 'HORNETS', 'PELICANS', 'JAZZ', 'ROCKETS', 'THUNDER'];
        if (nbaTeams.some(team => upperText.includes(team))) return 'NBA';

        // NFL teams
        const nflTeams = ['CHIEFS', 'COWBOYS', 'PATRIOTS', 'PACKERS', 'STEELERS', 'RAVENS', '49ERS', 'SEAHAWKS', 'EAGLES', 'BRONCOS', 'LIONS', 'CHARGERS', 'COLTS', 'BILLS', 'DOLPHINS', 'JETS', 'TEXANS', 'TITANS', 'BENGALS', 'BROWNS', 'CARDINALS', 'RAMS', 'SAINTS', 'FALCONS', 'PANTHERS', 'VIKINGS', 'BUCCANEERS', 'RAIDERS', 'JAGUARS', 'WASHINGTON', 'GIANTS'];
        if (nflTeams.some(team => upperText.includes(team))) return 'NFL';

        // Default
        return null;
    }

    /**
     * Detect segment from text (1H, 2H, FG, etc.)
     */
    function detectSegment(text) {
        const upperText = text.toUpperCase();

        if (upperText.includes('1H') || upperText.includes('FIRST HALF')) return '1H';
        if (upperText.includes('2H') || upperText.includes('SECOND HALF')) return '2H';
        if (upperText.includes('1Q') || upperText.includes('FIRST QUARTER')) return '1Q';
        if (upperText.includes('2Q') || upperText.includes('SECOND QUARTER')) return '2Q';
        if (upperText.includes('3Q') || upperText.includes('THIRD QUARTER')) return '3Q';
        if (upperText.includes('4Q') || upperText.includes('FOURTH QUARTER')) return '4Q';

        return 'FG'; // Full game default
    }

    /**
     * Detect fire level from emojis or text
     */
    function detectFire(text) {
        const fireCount = (text.match(/🔥/g) || []).length;
        if (fireCount > 0) return fireCount;

        const upperText = text.toUpperCase();
        if (upperText.includes('HOT') || upperText.includes('FIRE')) return 3;
        if (upperText.includes('WARM')) return 2;

        return 1; // Default
    }

    /**
     * Parse picks from CSV content
     * Expects header row: Date,League,Matchup,Pick,Odds,Risk,etc.
     */
    function parsePicksFromCSV(csvContent) {
        const lines = csvContent.split('\n');
        if (lines.length < 2) return [];

        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const picks = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (!values[0]) continue; // Skip empty lines

            const pick = {
                league: values[header.indexOf('league')] || null,
                matchup: values[header.indexOf('matchup')] || null,
                pick: values[header.indexOf('pick')] || null,
                odds: parseInt(values[header.indexOf('odds')]) || -110,
                risk: parseAmount(values[header.indexOf('risk')]) || 50000,
                segment: values[header.indexOf('segment')] || 'FG',
                fire: parseInt(values[header.indexOf('fire')]) || 1,
                date: values[header.indexOf('date')] || null
            };

            if (isValidPick(pick)) {
                picks.push(pick);
            }
        }

        return picks;
    }

    // Public API
    window.PickParser = {
        parseText: parsePicksFromText,
        parseLine: parsePickLine,
        parseCSV: parsePicksFromCSV,
        parseAmount: parseAmount,
        isValidPick: isValidPick,
        detectLeague: detectLeague,
        detectSegment: detectSegment,
        detectFire: detectFire
    };

})();
