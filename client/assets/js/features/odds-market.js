'use strict';

/**
 * ODDS MARKET v35.00.0 - Vegas Elite Odds Comparison
 * Live data from The Odds API v4
 *
 * Layout: Consensus | Sharp Books (4) | Square Books (4)
 * Refresh: Manual only (click refresh button)
 */
(function() {
    // ===== SHARP BOOKS (left side) =====
    const SHARP_BOOKS = [
        { key: 'pinnacle',     name: 'Pinnacle',    shortName: 'PIN' },
        { key: 'betonlineag',  name: 'BetOnline',   shortName: 'BOL' },
        { key: 'lowvig',       name: 'LowVig',      shortName: 'LV' },
        { key: 'bovada',       name: 'Bovada',       shortName: 'BOV' },
    ];

    // ===== SQUARE BOOKS (right side) =====
    const SQUARE_BOOKS = [
        { key: 'draftkings',    name: 'DraftKings',  shortName: 'DK' },
        { key: 'fanduel',       name: 'FanDuel',     shortName: 'FD' },
        { key: 'betmgm',        name: 'BetMGM',      shortName: 'MGM' },
        { key: 'williamhill_us', name: 'Caesars',     shortName: 'CZR' },
    ];

    const ALL_BOOKS = [...SHARP_BOOKS, ...SQUARE_BOOKS];

    // Sports to fetch
    const SPORT_CONFIGS = [
        { key: 'nba',   label: 'NBA',   apiSport: 'nba',   league: 'nba' },
        { key: 'ncaab', label: 'NCAAB', apiSport: 'ncaab',  league: 'ncaam' },
        { key: 'nfl',   label: 'NFL',   apiSport: 'nfl',    league: 'nfl' },
        { key: 'ncaaf', label: 'NCAAF', apiSport: 'ncaaf',  league: 'ncaaf' },
        { key: 'nhl',   label: 'NHL',   apiSport: 'nhl',    league: 'nhl' },
        { key: 'mlb',   label: 'MLB',   apiSport: 'mlb',    league: 'mlb' },
    ];

    // ===== TEAM NAME → ABBREVIATION MAP =====
    // Maps full Odds API team names to abbreviations for logo lookup
    const TEAM_ABBR_MAP = {
        // NBA
        'Atlanta Hawks': 'atl', 'Boston Celtics': 'bos', 'Brooklyn Nets': 'bkn',
        'Charlotte Hornets': 'cha', 'Chicago Bulls': 'chi', 'Cleveland Cavaliers': 'cle',
        'Dallas Mavericks': 'dal', 'Denver Nuggets': 'den', 'Detroit Pistons': 'det',
        'Golden State Warriors': 'gs', 'Houston Rockets': 'hou', 'Indiana Pacers': 'ind',
        'Los Angeles Clippers': 'lac', 'Los Angeles Lakers': 'lal', 'LA Clippers': 'lac', 'LA Lakers': 'lal',
        'Memphis Grizzlies': 'mem', 'Miami Heat': 'mia', 'Milwaukee Bucks': 'mil',
        'Minnesota Timberwolves': 'min', 'New Orleans Pelicans': 'no', 'New York Knicks': 'ny',
        'Oklahoma City Thunder': 'okc', 'Orlando Magic': 'orl', 'Philadelphia 76ers': 'phi',
        'Phoenix Suns': 'phx', 'Portland Trail Blazers': 'por', 'Sacramento Kings': 'sac',
        'San Antonio Spurs': 'sa', 'Toronto Raptors': 'tor', 'Utah Jazz': 'uta', 'Washington Wizards': 'wsh',
        // NFL
        'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'bal',
        'Buffalo Bills': 'buf', 'Carolina Panthers': 'car', 'Chicago Bears': 'chi',
        'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle', 'Dallas Cowboys': 'dal',
        'Denver Broncos': 'den', 'Detroit Lions': 'det', 'Green Bay Packers': 'gb',
        'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax',
        'Kansas City Chiefs': 'kc', 'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac',
        'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia', 'Minnesota Vikings': 'min',
        'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg',
        'New York Jets': 'nyj', 'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit',
        'San Francisco 49ers': 'sf', 'Seattle Seahawks': 'sea', 'Tampa Bay Buccaneers': 'tb',
        'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh',
        // NHL
        'Anaheim Ducks': 'ana', 'Arizona Coyotes': 'ari', 'Boston Bruins': 'bos',
        'Buffalo Sabres': 'buf', 'Calgary Flames': 'cgy', 'Carolina Hurricanes': 'car',
        'Chicago Blackhawks': 'chi', 'Colorado Avalanche': 'col', 'Columbus Blue Jackets': 'cbj',
        'Dallas Stars': 'dal', 'Detroit Red Wings': 'det', 'Edmonton Oilers': 'edm',
        'Florida Panthers': 'fla', 'Los Angeles Kings': 'la', 'Minnesota Wild': 'min',
        'Montreal Canadiens': 'mtl', 'Nashville Predators': 'nsh', 'New Jersey Devils': 'nj',
        'New York Islanders': 'nyi', 'New York Rangers': 'nyr', 'Ottawa Senators': 'ott',
        'Philadelphia Flyers': 'phi', 'Pittsburgh Penguins': 'pit', 'San Jose Sharks': 'sj',
        'Seattle Kraken': 'sea', 'St Louis Blues': 'stl', 'St. Louis Blues': 'stl',
        'Tampa Bay Lightning': 'tb', 'Toronto Maple Leafs': 'tor', 'Utah Hockey Club': 'uta',
        'Vancouver Canucks': 'van', 'Vegas Golden Knights': 'vgk', 'Washington Capitals': 'wsh',
        'Winnipeg Jets': 'wpg',
        // MLB
        'Arizona Diamondbacks': 'ari', 'Atlanta Braves': 'atl', 'Baltimore Orioles': 'bal',
        'Boston Red Sox': 'bos', 'Chicago Cubs': 'chc', 'Chicago White Sox': 'chw',
        'Cincinnati Reds': 'cin', 'Cleveland Guardians': 'cle', 'Colorado Rockies': 'col',
        'Detroit Tigers': 'det', 'Houston Astros': 'hou', 'Kansas City Royals': 'kc',
        'Los Angeles Angels': 'laa', 'Los Angeles Dodgers': 'lad', 'Miami Marlins': 'mia',
        'Milwaukee Brewers': 'mil', 'Minnesota Twins': 'min', 'New York Mets': 'nym',
        'New York Yankees': 'nyy', 'Oakland Athletics': 'oak', 'Philadelphia Phillies': 'phi',
        'Pittsburgh Pirates': 'pit', 'San Diego Padres': 'sd', 'San Francisco Giants': 'sf',
        'Seattle Mariners': 'sea', 'St. Louis Cardinals': 'stl', 'Tampa Bay Rays': 'tb',
        'Texas Rangers': 'tex', 'Toronto Blue Jays': 'tor', 'Washington Nationals': 'wsh',
    };

    // ===== STATE =====
    const state = {
        games: [],
        market: 'spread',
        sport: 'all',
        liveOnly: false,
        betSlip: [],
        lastRefresh: null,
        loading: false
    };

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        console.log('[OddsMarket] v35.00.0 — sharp/square layout');
        renderBookHeaders();
        bindEvents();
        loadLiveOdds();
    }

    // ===== EVENT BINDING =====
    function bindEvents() {
        // Market type buttons
        document.querySelectorAll('.market-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.market = btn.dataset.market;
                render();
            });
        });

        // Sport tabs
        document.querySelectorAll('#sport-tabs .date-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#sport-tabs .date-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.sport = btn.dataset.sport;
                render();
            });
        });

        // Live only filter
        const liveCheckbox = document.getElementById('live-only');
        if (liveCheckbox) {
            liveCheckbox.addEventListener('change', () => {
                state.liveOnly = liveCheckbox.checked;
                render();
            });
        }

        // Refresh button — manual refresh only
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (!state.loading) loadLiveOdds();
            });
        }

        // Bet slip toggle
        const slipToggle = document.getElementById('slip-toggle');
        if (slipToggle) slipToggle.addEventListener('click', toggleBetSlip);

        // Clear bet slip
        const slipClear = document.getElementById('slip-clear');
        if (slipClear) slipClear.addEventListener('click', clearBetSlip);

        // KPI slip tile
        document.querySelector('[data-tile-id="3"]')?.addEventListener('click', toggleBetSlip);
    }

    // ===== RENDER BOOK HEADERS =====
    function renderBookHeaders() {
        const container = document.getElementById('books-header-row');
        if (!container) return;

        const sharpHtml = SHARP_BOOKS.map(book => `
            <div class="book-header-col sharp-book" data-book="${book.key}">
                <span class="book-short-name">${book.shortName}</span>
                <span class="book-full-name">${book.name}</span>
            </div>
        `).join('');

        const squareHtml = SQUARE_BOOKS.map(book => `
            <div class="book-header-col square-book" data-book="${book.key}">
                <span class="book-short-name">${book.shortName}</span>
                <span class="book-full-name">${book.name}</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="consensus-header-col">
                <span class="book-short-name">CONS</span>
                <span class="book-full-name">Consensus</span>
            </div>
            <div class="book-group sharp-group">
                <div class="book-group-label">Sharp</div>
                <div class="book-group-cols">${sharpHtml}</div>
            </div>
            <div class="book-group-divider"></div>
            <div class="book-group square-group">
                <div class="book-group-label">Square</div>
                <div class="book-group-cols">${squareHtml}</div>
            </div>
        `;
    }

    // ===== TEAM LOGO URL =====
    function getTeamLogoUrl(teamName, league) {
        const abbr = TEAM_ABBR_MAP[teamName];
        if (!abbr || !window.LogoLoader) return '';
        try {
            return window.LogoLoader.getLogoUrl(league, abbr);
        } catch { return ''; }
    }

    // ===== TRANSFORM EVENT =====
    function transformEvent(event, sportLabel, league) {
        const books = {};

        const trackedKeys = new Set(ALL_BOOKS.map(b => b.key));

        for (const bookie of (event.bookmakers || [])) {
            if (!trackedKeys.has(bookie.key)) continue;
            if (books[bookie.key]) continue;

            const entry = {
                spread:    { away: { line: null, odds: null }, home: { line: null, odds: null } },
                moneyline: { away: { odds: null }, home: { odds: null } },
                total:     { over: { line: null, odds: null }, under: { line: null, odds: null } }
            };

            for (const market of (bookie.markets || [])) {
                const outcomes = market.outcomes || [];
                if (market.key === 'spreads') {
                    for (const o of outcomes) {
                        if (o.name === event.home_team) {
                            entry.spread.home = { line: o.point, odds: o.price };
                        } else {
                            entry.spread.away = { line: o.point, odds: o.price };
                        }
                    }
                } else if (market.key === 'h2h') {
                    for (const o of outcomes) {
                        if (o.name === event.home_team) {
                            entry.moneyline.home = { odds: o.price };
                        } else {
                            entry.moneyline.away = { odds: o.price };
                        }
                    }
                } else if (market.key === 'totals') {
                    for (const o of outcomes) {
                        if (o.name === 'Over') {
                            entry.total.over = { line: o.point, odds: o.price };
                        } else if (o.name === 'Under') {
                            entry.total.under = { line: o.point, odds: o.price };
                        }
                    }
                }
            }

            books[bookie.key] = entry;
        }

        const commenceTime = new Date(event.commence_time);
        const now = new Date();
        const isLive = event.completed === false && commenceTime <= now;

        return {
            id: event.id,
            sport: sportLabel,
            league: league,
            away: { name: event.away_team, abbr: TEAM_ABBR_MAP[event.away_team] || '' },
            home: { name: event.home_team, abbr: TEAM_ABBR_MAP[event.home_team] || '' },
            time: commenceTime,
            isLive,
            liveData: isLive && event.scores ? { away: event.scores?.[0]?.score || '', home: event.scores?.[1]?.score || '' } : null,
            books
        };
    }

    // ===== CONSENSUS CALCULATION =====
    function calcConsensus(game) {
        const cons = {
            spread:    { away: { line: null, odds: null }, home: { line: null, odds: null } },
            moneyline: { away: { odds: null }, home: { odds: null } },
            total:     { over: { line: null, odds: null }, under: { line: null, odds: null } }
        };

        const spreadAway = [], spreadHome = [], spreadAwayOdds = [], spreadHomeOdds = [];
        const mlAway = [], mlHome = [];
        const totalOver = [], totalUnder = [], totalOverOdds = [], totalUnderOdds = [];

        ALL_BOOKS.forEach(book => {
            const d = game.books[book.key];
            if (!d) return;
            if (d.spread.away.line != null) { spreadAway.push(d.spread.away.line); spreadAwayOdds.push(d.spread.away.odds); }
            if (d.spread.home.line != null) { spreadHome.push(d.spread.home.line); spreadHomeOdds.push(d.spread.home.odds); }
            if (d.moneyline.away.odds != null) mlAway.push(d.moneyline.away.odds);
            if (d.moneyline.home.odds != null) mlHome.push(d.moneyline.home.odds);
            if (d.total.over.line != null) { totalOver.push(d.total.over.line); totalOverOdds.push(d.total.over.odds); }
            if (d.total.under.line != null) { totalUnder.push(d.total.under.line); totalUnderOdds.push(d.total.under.odds); }
        });

        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const median = arr => {
            if (!arr.length) return null;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        // Use median for lines (more robust), average for odds
        cons.spread.away = { line: median(spreadAway), odds: avg(spreadAwayOdds) != null ? Math.round(avg(spreadAwayOdds)) : null };
        cons.spread.home = { line: median(spreadHome), odds: avg(spreadHomeOdds) != null ? Math.round(avg(spreadHomeOdds)) : null };
        cons.moneyline.away = { odds: avg(mlAway) != null ? Math.round(avg(mlAway)) : null };
        cons.moneyline.home = { odds: avg(mlHome) != null ? Math.round(avg(mlHome)) : null };
        cons.total.over = { line: median(totalOver), odds: avg(totalOverOdds) != null ? Math.round(avg(totalOverOdds)) : null };
        cons.total.under = { line: median(totalUnder), odds: avg(totalUnderOdds) != null ? Math.round(avg(totalUnderOdds)) : null };

        return cons;
    }

    // ===== VIG CALCULATION =====
    // Vig = overround percentage. Lower = sharper.
    function calcVig(oddsA, oddsB) {
        if (oddsA == null || oddsB == null) return null;
        const impliedProb = (odds) => {
            if (odds > 0) return 100 / (odds + 100);
            return Math.abs(odds) / (Math.abs(odds) + 100);
        };
        const total = impliedProb(oddsA) + impliedProb(oddsB);
        return ((total - 1) * 100); // e.g. 4.5 means 4.5% vig
    }

    // ===== LOAD LIVE ODDS =====
    async function loadLiveOdds() {
        state.loading = true;
        state.games = [];
        state.lastRefresh = new Date();

        const container = document.getElementById('games-list');
        if (container) {
            container.innerHTML = '<div class="loading-odds">Loading live odds...</div>';
        }

        // Show spinner on refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) refreshBtn.classList.add('refreshing');

        const API_BASE = 'https://proud-cliff-008e2e20f.2.azurestaticapps.net/api';
        const allGames = [];

        const results = await Promise.allSettled(
            SPORT_CONFIGS.map(async (cfg) => {
                const url = API_BASE + '/odds/' + cfg.apiSport + '/odds?markets=h2h,spreads,totals&regions=us,us2,eu';
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(cfg.key + ' HTTP ' + resp.status);
                const events = await resp.json();
                return { cfg, events };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { cfg, events } = result.value;
                if (!Array.isArray(events)) continue;
                for (const ev of events) {
                    if (!ev.bookmakers || ev.bookmakers.length === 0) continue;
                    allGames.push(transformEvent(ev, cfg.label, cfg.league));
                }
                console.log('[OddsMarket] ' + cfg.label + ': ' + events.length + ' events');
            } else {
                console.warn('[OddsMarket] Failed:', result.reason?.message || result.reason);
            }
        }

        state.games = allGames;
        state.loading = false;
        if (refreshBtn) refreshBtn.classList.remove('refreshing');

        // Update last refresh display
        const timeEl = document.getElementById('refresh-time');
        if (timeEl) {
            timeEl.textContent = state.lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }

        console.log('[OddsMarket] Total games: ' + allGames.length);
        render();
        updateKPIs();
    }

    // ===== MAIN RENDER =====
    function render() {
        const container = document.getElementById('games-list');
        const emptyState = document.getElementById('odds-empty');
        if (!container) return;

        let games = state.games.filter(game => {
            if (state.sport !== 'all' && game.sport.toLowerCase() !== state.sport) return false;
            if (state.liveOnly && !game.isLive) return false;
            return true;
        });

        games.sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            return a.time - b.time;
        });

        if (games.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.hidden = false;
            return;
        }

        if (emptyState) emptyState.hidden = true;

        const bestOdds = findBestOdds(games);
        const html = games.map(game => renderGameRow(game, bestOdds)).join('');
        container.innerHTML = html;

        // Bind odds cell clicks
        container.querySelectorAll('.odds-cell:not(.unavailable)').forEach(cell => {
            cell.addEventListener('click', () => handleOddsClick(cell));
        });

        updateKPIs();
    }

    // ===== FIND BEST ODDS =====
    function findBestOdds(games) {
        const best = {};
        games.forEach(game => {
            best[game.id] = {
                spread: { away: null, home: null },
                moneyline: { away: null, home: null },
                total: { over: null, under: null }
            };

            ALL_BOOKS.forEach(book => {
                const data = game.books[book.key];
                if (!data) return;

                if (data.spread.away.line != null) {
                    if (!best[game.id].spread.away || data.spread.away.line > best[game.id].spread.away.line) {
                        best[game.id].spread.away = { book: book.key, line: data.spread.away.line };
                    }
                }
                if (data.spread.home.line != null) {
                    if (!best[game.id].spread.home || data.spread.home.line > best[game.id].spread.home.line) {
                        best[game.id].spread.home = { book: book.key, line: data.spread.home.line };
                    }
                }
                if (data.moneyline.away.odds != null) {
                    if (!best[game.id].moneyline.away || data.moneyline.away.odds > best[game.id].moneyline.away.odds) {
                        best[game.id].moneyline.away = { book: book.key, odds: data.moneyline.away.odds };
                    }
                }
                if (data.moneyline.home.odds != null) {
                    if (!best[game.id].moneyline.home || data.moneyline.home.odds > best[game.id].moneyline.home.odds) {
                        best[game.id].moneyline.home = { book: book.key, odds: data.moneyline.home.odds };
                    }
                }
                if (data.total.over.line != null) {
                    if (!best[game.id].total.over || data.total.over.line < best[game.id].total.over.line) {
                        best[game.id].total.over = { book: book.key, line: data.total.over.line };
                    }
                }
                if (data.total.under.line != null) {
                    if (!best[game.id].total.under || data.total.under.line > best[game.id].total.under.line) {
                        best[game.id].total.under = { book: book.key, line: data.total.under.line };
                    }
                }
            });
        });
        return best;
    }

    // ===== RENDER GAME ROW =====
    function renderGameRow(game, bestOdds) {
        const timeStr = game.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const dayStr = game.time.toLocaleDateString([], { weekday: 'short' });

        const awayLogo = getTeamLogoUrl(game.away.name, game.league);
        const homeLogo = getTeamLogoUrl(game.home.name, game.league);

        const awayLogoHtml = awayLogo ? `<img class="team-logo" src="${awayLogo}" alt="" loading="lazy">` : '';
        const homeLogoHtml = homeLogo ? `<img class="team-logo" src="${homeLogo}" alt="" loading="lazy">` : '';

        const liveHtml = game.isLive ? `<span class="live-badge">LIVE</span>` : '';

        const awayScore = game.isLive && game.liveData ? `<span class="team-score">${game.liveData.away}</span>` : '';
        const homeScore = game.isLive && game.liveData ? `<span class="team-score">${game.liveData.home}</span>` : '';

        // Consensus
        const consensus = calcConsensus(game);
        const consensusHtml = renderConsensusCol(game, consensus);

        // Vig for consensus
        let vigHtml = '';
        if (state.market === 'spread') {
            const vig = calcVig(consensus.spread.away.odds, consensus.spread.home.odds);
            vigHtml = vig != null ? `<span class="vig-display">${vig.toFixed(1)}%</span>` : '';
        } else if (state.market === 'moneyline') {
            const vig = calcVig(consensus.moneyline.away.odds, consensus.moneyline.home.odds);
            vigHtml = vig != null ? `<span class="vig-display">${vig.toFixed(1)}%</span>` : '';
        } else {
            const vig = calcVig(consensus.total.over.odds, consensus.total.under.odds);
            vigHtml = vig != null ? `<span class="vig-display">${vig.toFixed(1)}%</span>` : '';
        }

        // Short team name (last word)
        const shortName = (name) => {
            const parts = (name || '').split(/\s+/);
            return parts[parts.length - 1] || name;
        };

        // Sharp books columns
        const sharpHtml = SHARP_BOOKS.map(book => renderBookCol(game, book, bestOdds, 'sharp')).join('');
        // Square books columns
        const squareHtml = SQUARE_BOOKS.map(book => renderBookCol(game, book, bestOdds, 'square')).join('');

        return `
            <div class="game-row ${game.isLive ? 'is-live' : ''}" data-game-id="${game.id}">
                <div class="game-info">
                    <div class="game-status-bar">
                        <span class="game-league">${game.sport}</span>
                        ${liveHtml}
                        <span class="game-time">${dayStr} ${timeStr}</span>
                    </div>
                    <div class="game-teams">
                        <div class="team-line team-away">
                            ${awayLogoHtml}
                            <span class="team-name">${shortName(game.away.name)}</span>
                            ${awayScore}
                        </div>
                        <div class="team-line team-home">
                            ${homeLogoHtml}
                            <span class="team-name">${shortName(game.home.name)}</span>
                            ${homeScore}
                        </div>
                    </div>
                </div>
                <div class="consensus-col">
                    ${consensusHtml}
                    <div class="vig-row">${vigHtml}</div>
                </div>
                <div class="game-books sharp-side">
                    ${sharpHtml}
                </div>
                <div class="book-divider-line"></div>
                <div class="game-books square-side">
                    ${squareHtml}
                </div>
            </div>
        `;
    }

    // ===== RENDER CONSENSUS COLUMN =====
    function renderConsensusCol(game, consensus) {
        let awayData, homeData;

        if (state.market === 'spread') {
            awayData = { line: formatLine(consensus.spread.away.line), odds: formatOdds(consensus.spread.away.odds) };
            homeData = { line: formatLine(consensus.spread.home.line), odds: formatOdds(consensus.spread.home.odds) };
        } else if (state.market === 'moneyline') {
            awayData = { line: formatOdds(consensus.moneyline.away.odds), odds: '' };
            homeData = { line: formatOdds(consensus.moneyline.home.odds), odds: '' };
        } else {
            awayData = { line: 'O ' + (consensus.total.over.line != null ? consensus.total.over.line : 'N/A'), odds: formatOdds(consensus.total.over.odds) };
            homeData = { line: 'U ' + (consensus.total.under.line != null ? consensus.total.under.line : 'N/A'), odds: formatOdds(consensus.total.under.odds) };
        }

        return `
            <div class="consensus-cell">
                <span class="odds-line">${awayData.line}</span>
                ${awayData.odds ? `<span class="odds-price">${awayData.odds}</span>` : ''}
            </div>
            <div class="consensus-cell">
                <span class="odds-line">${homeData.line}</span>
                ${homeData.odds ? `<span class="odds-price">${homeData.odds}</span>` : ''}
            </div>
        `;
    }

    // ===== RENDER BOOK COLUMN =====
    function renderBookCol(game, book, bestOdds, type) {
        const data = game.books[book.key];

        if (!data) {
            return `<div class="book-odds-col ${type}-book" data-book="${book.name}">
                <div class="odds-cell unavailable"><span class="odds-na">--</span></div>
                <div class="odds-cell unavailable"><span class="odds-na">--</span></div>
            </div>`;
        }

        let awayCellData, homeCellData;

        if (state.market === 'spread') {
            awayCellData = {
                line: formatLine(data.spread.away.line),
                odds: formatOdds(data.spread.away.odds),
                isBest: bestOdds[game.id]?.spread?.away?.book === book.key,
                side: 'away', rawLine: data.spread.away.line, rawOdds: data.spread.away.odds
            };
            homeCellData = {
                line: formatLine(data.spread.home.line),
                odds: formatOdds(data.spread.home.odds),
                isBest: bestOdds[game.id]?.spread?.home?.book === book.key,
                side: 'home', rawLine: data.spread.home.line, rawOdds: data.spread.home.odds
            };
        } else if (state.market === 'moneyline') {
            awayCellData = {
                line: formatOdds(data.moneyline.away.odds), odds: '',
                isBest: bestOdds[game.id]?.moneyline?.away?.book === book.key,
                side: 'away', rawOdds: data.moneyline.away.odds
            };
            homeCellData = {
                line: formatOdds(data.moneyline.home.odds), odds: '',
                isBest: bestOdds[game.id]?.moneyline?.home?.book === book.key,
                side: 'home', rawOdds: data.moneyline.home.odds
            };
        } else {
            awayCellData = {
                line: `O ${data.total.over.line}`, odds: formatOdds(data.total.over.odds),
                isBest: bestOdds[game.id]?.total?.over?.book === book.key,
                side: 'over', rawLine: data.total.over.line, rawOdds: data.total.over.odds
            };
            homeCellData = {
                line: `U ${data.total.under.line}`, odds: formatOdds(data.total.under.odds),
                isBest: bestOdds[game.id]?.total?.under?.book === book.key,
                side: 'under', rawLine: data.total.under.line, rawOdds: data.total.under.odds
            };
        }

        return `
            <div class="book-odds-col ${type}-book" data-book="${book.name}">
                ${renderOddsCell(game, book, awayCellData)}
                ${renderOddsCell(game, book, homeCellData)}
            </div>
        `;
    }

    function renderOddsCell(game, book, data) {
        const isSelected = state.betSlip.some(s =>
            s.gameId === game.id && s.book === book.key && s.side === data.side && s.market === state.market
        );

        return `
            <div class="odds-cell ${data.isBest ? 'best-odds' : ''} ${isSelected ? 'selected' : ''}"
                 data-game-id="${game.id}" data-book="${book.key}" data-book-name="${book.name}"
                 data-side="${data.side}" data-market="${state.market}"
                 data-line="${data.rawLine || ''}" data-odds="${data.rawOdds || ''}"
                 data-away="${game.away.name}" data-home="${game.home.name}">
                <span class="odds-line">${data.line}</span>
                ${data.odds ? `<span class="odds-price">${data.odds}</span>` : ''}
            </div>
        `;
    }

    // ===== FORMAT HELPERS =====
    function formatLine(line) {
        if (line == null) return '--';
        const num = parseFloat(line);
        if (isNaN(num)) return '--';
        return num > 0 ? `+${num % 1 === 0 ? num : num.toFixed(1)}` : (num % 1 === 0 ? String(num) : num.toFixed(1));
    }

    function formatOdds(odds) {
        if (odds == null) return '';
        return odds > 0 ? `+${odds}` : `${odds}`;
    }

    // ===== BET SLIP =====
    function handleOddsClick(cell) {
        const data = {
            gameId: cell.dataset.gameId, book: cell.dataset.book,
            bookName: cell.dataset.bookName, side: cell.dataset.side,
            market: cell.dataset.market, line: cell.dataset.line,
            odds: cell.dataset.odds, away: cell.dataset.away,
            home: cell.dataset.home, risk: 100
        };

        const existingIdx = state.betSlip.findIndex(s =>
            s.gameId === data.gameId && s.book === data.book && s.side === data.side && s.market === data.market
        );

        if (existingIdx >= 0) {
            state.betSlip.splice(existingIdx, 1);
            cell.classList.remove('selected');
        } else {
            state.betSlip.push(data);
            cell.classList.add('selected');
        }

        renderBetSlip();
        updateKPIs();
        if (state.betSlip.length === 1) document.body.classList.add('slip-open');
    }

    function renderBetSlip() {
        const picksContainer = document.getElementById('slip-picks');
        const emptyState = document.getElementById('slip-empty');
        const footer = document.getElementById('slip-footer');
        const countEl = document.getElementById('slip-count');
        if (!picksContainer) return;

        if (countEl) countEl.textContent = state.betSlip.length;

        if (state.betSlip.length === 0) {
            picksContainer.innerHTML = '';
            if (emptyState) emptyState.style.display = '';
            if (footer) footer.hidden = true;
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (footer) footer.hidden = false;

        const html = state.betSlip.map((pick, idx) => {
            const sideLabel = pick.side === 'over' ? 'Over' : pick.side === 'under' ? 'Under' : pick.side === 'away' ? pick.away : pick.home;
            const lineDisplay = pick.line ? formatLine(parseFloat(pick.line)) : '';
            const oddsDisplay = formatOdds(parseInt(pick.odds));
            const payout = calculatePayout(pick.risk, parseInt(pick.odds));

            return `
                <div class="slip-pick" data-idx="${idx}">
                    <div class="slip-pick-header">
                        <span class="slip-pick-game">${pick.away} @ ${pick.home}</span>
                        <button class="slip-pick-remove" data-idx="${idx}">x</button>
                    </div>
                    <div class="slip-pick-selection">${sideLabel} ${lineDisplay}</div>
                    <div class="slip-pick-details">
                        <span class="slip-pick-book">${pick.bookName}</span>
                        <span class="slip-pick-odds">${oddsDisplay}</span>
                    </div>
                    <div class="slip-pick-input">
                        <span class="slip-input-label">Risk $</span>
                        <input type="number" class="slip-input" id="slip-input-${idx}" name="slip-input-${idx}" value="${pick.risk}" data-idx="${idx}" min="0">
                    </div>
                    <div class="slip-pick-payout">
                        <span class="slip-payout-label">To Win</span>
                        <span class="slip-payout-value">$${payout.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');

        picksContainer.innerHTML = html;

        picksContainer.querySelectorAll('.slip-pick-remove').forEach(btn => {
            btn.addEventListener('click', () => removeBetSlipItem(parseInt(btn.dataset.idx)));
        });

        picksContainer.querySelectorAll('.slip-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                state.betSlip[idx].risk = parseFloat(e.target.value) || 0;
                updateSlipTotals();
            });
        });

        updateSlipTotals();
    }

    function removeBetSlipItem(idx) {
        const removed = state.betSlip.splice(idx, 1)[0];
        const cell = document.querySelector(`.odds-cell[data-game-id="${removed.gameId}"][data-book="${removed.book}"][data-side="${removed.side}"][data-market="${removed.market}"]`);
        if (cell) cell.classList.remove('selected');
        renderBetSlip();
        updateKPIs();
    }

    function clearBetSlip() {
        state.betSlip = [];
        document.querySelectorAll('.odds-cell.selected').forEach(cell => cell.classList.remove('selected'));
        renderBetSlip();
        updateKPIs();
    }

    function calculatePayout(risk, odds) {
        if (!risk || !odds) return 0;
        return odds > 0 ? risk * (odds / 100) : risk * (100 / Math.abs(odds));
    }

    function updateSlipTotals() {
        const riskEl = document.getElementById('slip-risk');
        const winEl = document.getElementById('slip-win');
        let totalRisk = 0, totalWin = 0;
        state.betSlip.forEach(pick => {
            totalRisk += pick.risk || 0;
            totalWin += calculatePayout(pick.risk, parseInt(pick.odds));
        });
        if (riskEl) riskEl.textContent = `$${totalRisk.toFixed(0)}`;
        if (winEl) winEl.textContent = `$${totalWin.toFixed(2)}`;
    }

    function toggleBetSlip() {
        document.body.classList.toggle('slip-open');
    }

    // ===== KPIs =====
    function updateKPIs() {
        const gamesEl = document.getElementById('kpi-games');
        const valueEl = document.getElementById('kpi-value');
        const slipEl = document.getElementById('kpi-slip');

        const filteredGames = state.games.filter(g => {
            if (state.sport !== 'all' && g.sport.toLowerCase() !== state.sport) return false;
            if (state.liveOnly && !g.isLive) return false;
            return true;
        });
        if (gamesEl) gamesEl.textContent = filteredGames.length;

        let valuePlays = 0;
        filteredGames.forEach(game => {
            const lines = [];
            ALL_BOOKS.forEach(book => {
                const data = game.books[book.key];
                if (data?.spread?.away?.line != null) lines.push(data.spread.away.line);
            });
            if (lines.length > 1) {
                const diff = Math.max(...lines) - Math.min(...lines);
                if (diff >= 0.5) valuePlays++;
            }
        });
        if (valueEl) valueEl.textContent = valuePlays;
        if (slipEl) slipEl.textContent = state.betSlip.length;
    }

})();
