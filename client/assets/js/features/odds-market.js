'use strict';

/**
 * ODDS MARKET v34.00.0 - Vegas Elite Odds Comparison
 * Production release - Live data from The Odds API v4
 *
 * Data Source: The Odds API via /api/odds/{sport}/odds Azure Function proxy
 * Sports: NBA, NCAAB, NFL, NCAAF, NHL, MLB (fetched in parallel)
 *
 * Shows odds from major market sportsbooks for comparison.
 * Your connected books (Hulk Wager, etc.) are for PLACING bets.
 */
(function() {
    // ===== MARKET SPORTSBOOKS (where odds come from) =====
    // These are the major books that The Odds API provides odds from
    const SPORTSBOOKS = [
        { key: 'draftkings', name: 'DraftKings', shortName: 'DK' },
        { key: 'fanduel', name: 'FanDuel', shortName: 'FD' },
        { key: 'betmgm', name: 'BetMGM', shortName: 'MGM' },
        { key: 'williamhill_us', name: 'Caesars', shortName: 'CZR' },
        { key: 'pointsbetus', name: 'PointsBet', shortName: 'PB' },
        { key: 'bovada', name: 'Bovada', shortName: 'BOV' }
    ];

    // Map Odds API bookmaker keys to our SPORTSBOOKS keys (handles aliases)
    const BOOKMAKER_KEY_MAP = {
        draftkings: 'draftkings',
        fanduel: 'fanduel',
        betmgm: 'betmgm',
        williamhill_us: 'williamhill_us',
        caesars: 'williamhill_us',
        pointsbetus: 'pointsbetus',
        bovada: 'bovada',
        betonlineag: 'bovada', // fallback alias
    };

    // Sports to fetch from the OddsAPI proxy
    const SPORT_CONFIGS = [
        { key: 'nba',   label: 'NBA',   apiSport: 'nba' },
        { key: 'ncaab', label: 'NCAAB', apiSport: 'ncaab' },
        { key: 'nfl',   label: 'NFL',   apiSport: 'nfl' },
        { key: 'ncaaf', label: 'NCAAF', apiSport: 'ncaaf' },
        { key: 'nhl',   label: 'NHL',   apiSport: 'nhl' },
        { key: 'mlb',   label: 'MLB',   apiSport: 'mlb' },
    ];

    // ===== AUTO-REFRESH CONFIG =====
    const REFRESH_INTERVAL_MS = 120000; // 2 min — matches server cache TTL

    // ===== STATE =====
    const state = {
        games: [],
        market: 'spread',
        sport: 'all',
        liveOnly: false,
        betSlip: [],
        lastRefresh: null,
        refreshTimerId: null,
        countdownId: null,
        nextRefreshAt: null,
        autoRefreshPaused: false
    };

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        console.log('[OddsMarket] v34.00.0 initializing — The Odds API v4');
        renderBookHeaders();
        bindEvents();
        loadLiveOdds();
        render();
        updateKPIs();
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

        // Refresh button — re-fetch live data from APIs
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadLiveOdds();
            });
        }

        // Bet slip toggle
        const slipToggle = document.getElementById('slip-toggle');
        if (slipToggle) {
            slipToggle.addEventListener('click', toggleBetSlip);
        }

        // Clear bet slip
        const slipClear = document.getElementById('slip-clear');
        if (slipClear) {
            slipClear.addEventListener('click', clearBetSlip);
        }

        // Click on KPI slip tile to toggle bet slip
        document.querySelector('[data-tile-id="3"]')?.addEventListener('click', toggleBetSlip);

        // Pause auto-refresh when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                // Tab became visible — refresh immediately if stale (>2min since last)
                const stale = !state.lastRefresh || (Date.now() - state.lastRefresh.getTime() > REFRESH_INTERVAL_MS);
                if (stale) {
                    loadLiveOdds();
                } else {
                    scheduleAutoRefresh();
                }
            }
        });
    }

    // ===== RENDER BOOK HEADERS =====
    function renderBookHeaders() {
        const container = document.getElementById('books-header-row');
        if (!container) return;

        const html = SPORTSBOOKS.map(book => `
            <div class="book-header-col" data-book="${book.key}">
                <span class="book-short-name">${book.shortName}</span>
                <span class="book-full-name">${book.name}</span>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // ===== TRANSFORM ODDS API EVENT → UI GAME =====
    /**
     * Convert a raw Odds API v4 event into the shape our renderer expects.
     * Input: { id, sport_key, home_team, away_team, commence_time, bookmakers: [...] }
     * Output: { id, sport, away, home, time, isLive, liveData, books: { [bookKey]: { spread, moneyline, total } } }
     */
    function transformEvent(event, sportLabel) {
        const books = {};

        // Build a set of our tracked bookmaker keys for fast lookup
        const trackedKeys = new Set(SPORTSBOOKS.map(b => b.key));

        for (const bookie of (event.bookmakers || [])) {
            const mappedKey = BOOKMAKER_KEY_MAP[bookie.key];
            if (!mappedKey || !trackedKeys.has(mappedKey)) continue;

            // Initialize book entry (first writer wins — skip if alias already filled)
            if (books[mappedKey]) continue;

            const entry = {
                spread:    { away: { line: null, odds: null, movement: null }, home: { line: null, odds: null, movement: null } },
                moneyline: { away: { odds: null, movement: null }, home: { odds: null, movement: null } },
                total:     { over: { line: null, odds: null, movement: null }, under: { line: null, odds: null, movement: null } }
            };

            for (const market of (bookie.markets || [])) {
                const outcomes = market.outcomes || [];

                if (market.key === 'spreads') {
                    for (const o of outcomes) {
                        if (o.name === event.home_team) {
                            entry.spread.home = { line: o.point, odds: o.price, movement: null };
                        } else {
                            entry.spread.away = { line: o.point, odds: o.price, movement: null };
                        }
                    }
                } else if (market.key === 'h2h') {
                    for (const o of outcomes) {
                        if (o.name === event.home_team) {
                            entry.moneyline.home = { odds: o.price, movement: null };
                        } else {
                            entry.moneyline.away = { odds: o.price, movement: null };
                        }
                    }
                } else if (market.key === 'totals') {
                    for (const o of outcomes) {
                        if (o.name === 'Over') {
                            entry.total.over = { line: o.point, odds: o.price, movement: null };
                        } else if (o.name === 'Under') {
                            entry.total.under = { line: o.point, odds: o.price, movement: null };
                        }
                    }
                }
            }

            books[mappedKey] = entry;
        }

        // Derive abbreviation from team name (last word, uppercase)
        const abbr = (name) => {
            const parts = (name || '').trim().split(/\s+/);
            return (parts[parts.length - 1] || '???').toUpperCase().slice(0, 4);
        };

        const commenceTime = new Date(event.commence_time);
        const now = new Date();
        const isLive = event.completed === false && commenceTime <= now;

        return {
            id: event.id,
            sport: sportLabel,
            away: { name: event.away_team, abbr: abbr(event.away_team), record: '' },
            home: { name: event.home_team, abbr: abbr(event.home_team), record: '' },
            time: commenceTime,
            isLive,
            liveData: isLive ? (event.scores ? { period: '', clock: 'LIVE', away: event.scores?.[0]?.score || '', home: event.scores?.[1]?.score || '' } : null) : null,
            books
        };
    }

    // ===== LOAD LIVE ODDS FROM APIs =====
    async function loadLiveOdds() {
        state.games = [];
        state.lastRefresh = new Date();

        const container = document.getElementById('games-list');
        if (container) {
            container.innerHTML = '<div class="loading-odds" style="text-align:center;padding:2rem;color:var(--text-secondary,#aaa);">Loading live odds...</div>';
        }

        const API_BASE = window.APP_CONFIG?.API_BASE_URL || window.APP_CONFIG?.API_BASE_FALLBACK || (window.location.origin + '/api');
        const allGames = [];

        // Fetch all sports in parallel — failures are isolated per sport
        const results = await Promise.allSettled(
            SPORT_CONFIGS.map(async (cfg) => {
                const url = API_BASE + '/odds/' + cfg.apiSport + '/odds?markets=h2h,spreads,totals';
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
                    // Skip events with no bookmakers (no odds available)
                    if (!ev.bookmakers || ev.bookmakers.length === 0) continue;
                    allGames.push(transformEvent(ev, cfg.label));
                }
                console.log('[OddsMarket] ' + cfg.label + ': ' + events.length + ' events');
            } else {
                console.warn('[OddsMarket] Failed to load sport:', result.reason?.message || result.reason);
            }
        }

        state.games = allGames;
        console.log('[OddsMarket] Total games loaded: ' + allGames.length);

        scheduleAutoRefresh();
        render();
    }

    // ===== AUTO-REFRESH & COUNTDOWN =====
    function scheduleAutoRefresh() {
        clearTimeout(state.refreshTimerId);
        clearInterval(state.countdownId);

        state.nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;

        // Tick the countdown display every second
        state.countdownId = setInterval(updateCountdown, 1000);
        updateCountdown();

        // Schedule the actual refresh
        state.refreshTimerId = setTimeout(async () => {
            if (!state.autoRefreshPaused && !document.hidden) {
                await loadLiveOdds();
            } else {
                // If paused or tab hidden, just reschedule
                scheduleAutoRefresh();
            }
        }, REFRESH_INTERVAL_MS);
    }

    function updateCountdown() {
        const el = document.getElementById('refresh-time');
        if (!el || !state.nextRefreshAt) return;

        const remaining = Math.max(0, state.nextRefreshAt - Date.now());
        const secs = Math.ceil(remaining / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        el.textContent = m + ':' + String(s).padStart(2, '0');
    }

    function stopAutoRefresh() {
        clearTimeout(state.refreshTimerId);
        clearInterval(state.countdownId);
        state.refreshTimerId = null;
        state.countdownId = null;
        state.nextRefreshAt = null;
    }

    // ===== MAIN RENDER =====
    function render() {
        const container = document.getElementById('games-list');
        const emptyState = document.getElementById('odds-empty');
        if (!container) return;

        // Filter games
        let games = state.games.filter(game => {
            if (state.sport !== 'all' && game.sport.toLowerCase() !== state.sport) return false;
            if (state.liveOnly && !game.isLive) return false;
            return true;
        });

        // Sort: live first, then by time
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

        // Find best odds for highlighting
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

            SPORTSBOOKS.forEach(book => {
                const data = game.books[book.key];
                if (!data) return; // Skip N/A books

                // Spread - best is highest line (more points for dog)
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

                // Moneyline - best is highest odds (more payout)
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

                // Total - over: lowest line, under: highest line
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

        const liveInfo = game.isLive && game.liveData ? `
            <div class="game-live-badge">
                <span class="live-indicator"></span>
                ${game.liveData.period} ${game.liveData.clock}
            </div>
        ` : '';

        const awayScore = game.isLive && game.liveData ? `<span class="team-score">${game.liveData.away}</span>` : '';
        const homeScore = game.isLive && game.liveData ? `<span class="team-score">${game.liveData.home}</span>` : '';

        // Format records
        const awayRecordHtml = game.away.record ? `<span class="team-record">(${game.away.record})</span>` : '';
        const homeRecordHtml = game.home.record ? `<span class="team-record">(${game.home.record})</span>` : '';

        const booksHtml = SPORTSBOOKS.map(book => {
            const data = game.books[book.key];

            // Handle N/A (no data from this book)
            if (!data) {
                return `<div class="book-odds-col" data-book="${book.name}">
                    <div class="odds-cell unavailable"><span class="odds-na">N/A</span></div>
                    <div class="odds-cell unavailable"><span class="odds-na">N/A</span></div>
                </div>`;
            }

            let awayCellData, homeCellData;

            if (state.market === 'spread') {
                awayCellData = {
                    line: formatLine(data.spread.away.line),
                    odds: formatOdds(data.spread.away.odds),
                    movement: data.spread.away.movement,
                    isBest: bestOdds[game.id]?.spread?.away?.book === book.key,
                    side: 'away',
                    rawLine: data.spread.away.line,
                    rawOdds: data.spread.away.odds
                };
                homeCellData = {
                    line: formatLine(data.spread.home.line),
                    odds: formatOdds(data.spread.home.odds),
                    movement: data.spread.home.movement,
                    isBest: bestOdds[game.id]?.spread?.home?.book === book.key,
                    side: 'home',
                    rawLine: data.spread.home.line,
                    rawOdds: data.spread.home.odds
                };
            } else if (state.market === 'moneyline') {
                awayCellData = {
                    line: formatOdds(data.moneyline.away.odds),
                    odds: '',
                    movement: data.moneyline.away.movement,
                    isBest: bestOdds[game.id]?.moneyline?.away?.book === book.key,
                    side: 'away',
                    rawOdds: data.moneyline.away.odds
                };
                homeCellData = {
                    line: formatOdds(data.moneyline.home.odds),
                    odds: '',
                    movement: data.moneyline.home.movement,
                    isBest: bestOdds[game.id]?.moneyline?.home?.book === book.key,
                    side: 'home',
                    rawOdds: data.moneyline.home.odds
                };
            } else { // total
                awayCellData = {
                    line: `O ${data.total.over.line}`,
                    odds: formatOdds(data.total.over.odds),
                    movement: data.total.over.movement,
                    isBest: bestOdds[game.id]?.total?.over?.book === book.key,
                    side: 'over',
                    rawLine: data.total.over.line,
                    rawOdds: data.total.over.odds
                };
                homeCellData = {
                    line: `U ${data.total.under.line}`,
                    odds: formatOdds(data.total.under.odds),
                    movement: data.total.under.movement,
                    isBest: bestOdds[game.id]?.total?.under?.book === book.key,
                    side: 'under',
                    rawLine: data.total.under.line,
                    rawOdds: data.total.under.odds
                };
            }

            return `
                <div class="book-odds-col" data-book="${book.name}">
                    ${renderOddsCell(game, book, awayCellData)}
                    ${renderOddsCell(game, book, homeCellData)}
                </div>
            `;
        }).join('');

        return `
            <div class="game-row ${game.isLive ? 'is-live' : ''}" data-game-id="${game.id}">
                <div class="game-info">
                    <div class="game-status-bar">
                        <span class="game-league">${game.sport}</span>
                        ${game.isLive ? liveInfo : `<span class="game-time">${dayStr} ${timeStr}</span>`}
                    </div>
                    <div class="game-teams">
                        <div class="team-line team-away">
                            <span class="team-name">${game.away.name}</span>
                            ${awayRecordHtml}
                            ${awayScore}
                        </div>
                        <div class="vs-divider">vs</div>
                        <div class="team-line team-home">
                            <span class="team-name">${game.home.name}</span>
                            ${homeRecordHtml}
                            ${homeScore}
                        </div>
                    </div>
                </div>
                <div class="game-books">
                    ${booksHtml}
                </div>
            </div>
        `;
    }

    function renderOddsCell(game, book, data) {
        const movementIcon = data.movement === 'up' ? '<span class="line-movement up">↑</span>' :
                            data.movement === 'down' ? '<span class="line-movement down">↓</span>' : '';

        const isSelected = state.betSlip.some(s =>
            s.gameId === game.id && s.book === book.key && s.side === data.side && s.market === state.market
        );

        return `
            <div class="odds-cell ${data.isBest ? 'best-odds' : ''} ${isSelected ? 'selected' : ''}"
                 data-game-id="${game.id}"
                 data-book="${book.key}"
                 data-book-name="${book.name}"
                 data-side="${data.side}"
                 data-market="${state.market}"
                 data-line="${data.rawLine || ''}"
                 data-odds="${data.rawOdds || ''}"
                 data-away="${game.away.name}"
                 data-home="${game.home.name}">
                <span class="odds-line">${data.line}${movementIcon}</span>
                ${data.odds ? `<span class="odds-price">${data.odds}</span>` : ''}
            </div>
        `;
    }

    // ===== FORMAT HELPERS =====
    function formatLine(line) {
        if (line === undefined || line === null) return 'N/A';
        const num = parseFloat(line);
        if (isNaN(num)) return 'N/A';
        return num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1);
    }

    function formatOdds(odds) {
        if (odds === undefined || odds === null) return 'N/A';
        return odds > 0 ? `+${odds}` : `${odds}`;
    }

    // ===== BET SLIP =====
    function handleOddsClick(cell) {
        const data = {
            gameId: cell.dataset.gameId,
            book: cell.dataset.book,
            bookName: cell.dataset.bookName,
            side: cell.dataset.side,
            market: cell.dataset.market,
            line: cell.dataset.line,
            odds: cell.dataset.odds,
            away: cell.dataset.away,
            home: cell.dataset.home,
            risk: 100
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

        if (state.betSlip.length === 1) {
            document.body.classList.add('slip-open');
        }
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
                        <button class="slip-pick-remove" data-idx="${idx}">×</button>
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
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                removeBetSlipItem(idx);
            });
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
        if (odds > 0) {
            return risk * (odds / 100);
        } else {
            return risk * (100 / Math.abs(odds));
        }
    }

    function updateSlipTotals() {
        const riskEl = document.getElementById('slip-risk');
        const winEl = document.getElementById('slip-win');

        let totalRisk = 0;
        let totalWin = 0;

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

        // Value plays (games with significant line differences)
        let valuePlays = 0;
        filteredGames.forEach(game => {
            const lines = [];
            SPORTSBOOKS.forEach(book => {
                const data = game.books[book.key];
                if (data?.spread?.away?.line) lines.push(data.spread.away.line);
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
