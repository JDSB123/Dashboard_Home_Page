'use strict';

/**
 * ODDS MARKET - Vegas Elite Odds Comparison
 * 
 * Data Sources:
 * - NCAAF, NFL: SportsDataIO API
 * - NBA, NCAAB, NHL: The Odds API (and other open sources)
 * 
 * Shows odds from major market sportsbooks for comparison.
 * Your connected books (Hulk Wager, etc.) are for PLACING bets.
 */
(function() {
    // ===== MARKET SPORTSBOOKS (where odds come from) =====
    // These are the major books that SportsDataIO and The Odds API provide odds from
    const SPORTSBOOKS = [
        { key: 'draftkings', name: 'DraftKings', shortName: 'DK' },
        { key: 'fanduel', name: 'FanDuel', shortName: 'FD' },
        { key: 'betmgm', name: 'BetMGM', shortName: 'MGM' },
        { key: 'caesars', name: 'Caesars', shortName: 'CZR' },
        { key: 'pointsbet', name: 'PointsBet', shortName: 'PB' },
        { key: 'bovada', name: 'Bovada', shortName: 'BOV' }
    ];

    // ===== STATE =====
    const state = {
        games: [],
        market: 'spread',
        sport: 'all',
        liveOnly: false,
        betSlip: [],
        lastRefresh: null
    };

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        console.log('📊 Odds Market initializing...');
        console.log('📡 Data sources: SportsDataIO (NFL, NCAAF) | The Odds API (NBA, NCAAB, NHL)');
        renderBookHeaders();
        bindEvents();
        loadMockData(); // TODO: Replace with real API calls
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

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                simulateRefresh();
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

    // ===== MOCK DATA =====
    // TODO: Replace with real API integration
    // NFL/NCAAF -> SportsDataIO, NBA/NCAAB -> The Odds API
    function loadMockData() {
        const now = new Date();
        const hour = 60 * 60 * 1000;

        state.games = [
            // NFL games - data from SportsDataIO
            // Spreads use actual realistic lines with half-points
            createGame('NFL', 'Houston Texans', 'HOU', '9-5', 'Indianapolis Colts', 'IND', '6-8', 
                { spread: -3.5, total: 44.5 }, now.getTime() + hour, false),
            createGame('NFL', 'San Francisco 49ers', 'SF', '6-8', 'Seattle Seahawks', 'SEA', '8-6', 
                { spread: 2.5, total: 47 }, now.getTime() - 30 * 60 * 1000, true, { away: 14, home: 10, period: 'Q2', clock: '7:32' }),
            createGame('NFL', 'Dallas Cowboys', 'DAL', '7-7', 'Carolina Panthers', 'CAR', '3-11', 
                { spread: -7, total: 42.5 }, now.getTime() + 3 * hour, false),
            
            // NBA games - data from The Odds API
            createGame('NBA', 'Los Angeles Lakers', 'LAL', '15-12', 'Golden State Warriors', 'GSW', '14-11', 
                { spread: 4.5, total: 224.5 }, now.getTime() + 2 * hour, false),
            createGame('NBA', 'Boston Celtics', 'BOS', '22-6', 'Miami Heat', 'MIA', '14-12', 
                { spread: -6.5, total: 217 }, now.getTime() - 45 * 60 * 1000, true, { away: 58, home: 52, period: '3Q', clock: '4:15' }),
            createGame('NBA', 'Denver Nuggets', 'DEN', '16-10', 'Los Angeles Clippers', 'LAC', '17-11', 
                { spread: -2, total: 221.5 }, now.getTime() + 5 * hour, false),
            
            // NCAAF - data from SportsDataIO
            createGame('NCAAF', 'Georgia Bulldogs', 'UGA', '11-2', 'Alabama Crimson Tide', 'ALA', '9-3', 
                { spread: -3, total: 52.5 }, now.getTime() + 6 * hour, false),
            
            // NCAAB - data from The Odds API
            createGame('NCAAB', 'Duke Blue Devils', 'DUKE', '10-2', 'North Carolina Tar Heels', 'UNC', '9-4', 
                { spread: -4.5, total: 148.5 }, now.getTime() + 4 * hour, false)
        ];

        state.lastRefresh = new Date();
        updateRefreshTime();
    }

    /**
     * Create a game with realistic odds across sportsbooks
     * Lines vary by 0.5 points between books (realistic market variance)
     */
    function createGame(sport, awayName, awayAbbr, awayRecord, homeName, homeAbbr, homeRecord, baseOdds, time, isLive, liveData = null) {
        const id = `${sport}-${awayAbbr}-${homeAbbr}`.toLowerCase();
        const { spread: baseSpread, total: baseTotal } = baseOdds;

        // Generate odds for each book with realistic half-point variations
        const books = {};
        SPORTSBOOKS.forEach((book, idx) => {
            // 5% chance a book doesn't have odds (N/A)
            if (Math.random() < 0.05) {
                books[book.key] = null;
                return;
            }

            // Books vary by 0 or 0.5 points - realistic market differences
            const spreadVar = [0, 0, 0, 0.5, -0.5][Math.floor(Math.random() * 5)];
            const totalVar = [0, 0, 0.5, -0.5][Math.floor(Math.random() * 4)];
            
            // Juice varies between -105 and -115
            const juice = () => -110 + (Math.floor(Math.random() * 3) - 1) * 5; // -115, -110, or -105
            
            // Calculate moneylines from spread (rough approximation)
            const awayML = calculateMoneyline(baseSpread + spreadVar);
            const homeML = calculateMoneyline(-(baseSpread + spreadVar));
            
            books[book.key] = {
                spread: {
                    away: { line: baseSpread + spreadVar, odds: juice(), movement: randomMovement() },
                    home: { line: -(baseSpread + spreadVar), odds: juice(), movement: randomMovement() }
                },
                moneyline: {
                    away: { odds: awayML, movement: randomMovement() },
                    home: { odds: homeML, movement: randomMovement() }
                },
                total: {
                    over: { line: baseTotal + totalVar, odds: juice(), movement: randomMovement() },
                    under: { line: baseTotal + totalVar, odds: juice(), movement: randomMovement() }
                }
            };
        });

        return {
            id,
            sport,
            away: { name: awayName, abbr: awayAbbr, record: awayRecord },
            home: { name: homeName, abbr: homeAbbr, record: homeRecord },
            time: new Date(time),
            isLive,
            liveData,
            books
        };
    }

    /**
     * Convert spread to approximate moneyline
     * This is a rough approximation used for mock data only
     */
    function calculateMoneyline(spread) {
        // Favorite (negative spread)
        if (spread < 0) {
            const absSpread = Math.abs(spread);
            if (absSpread <= 1) return -120;
            if (absSpread <= 2.5) return -135;
            if (absSpread <= 3.5) return -160;
            if (absSpread <= 5) return -200;
            if (absSpread <= 7) return -280;
            if (absSpread <= 10) return -400;
            return -500;
        }
        // Underdog (positive spread)
        if (spread > 0) {
            if (spread <= 1) return 100;
            if (spread <= 2.5) return 115;
            if (spread <= 3.5) return 140;
            if (spread <= 5) return 175;
            if (spread <= 7) return 240;
            if (spread <= 10) return 350;
            return 450;
        }
        return -110; // Pick'em
    }

    function randomMovement() {
        const r = Math.random();
        if (r < 0.2) return 'up';
        if (r < 0.4) return 'down';
        return null;
    }

    // ===== REFRESH =====
    function simulateRefresh() {
        state.games.forEach(game => {
            SPORTSBOOKS.forEach(book => {
                const bookData = game.books[book.key];
                if (!bookData) return; // Skip N/A books

                // Spread
                const spreadDelta = (Math.random() * 0.5 - 0.25);
                bookData.spread.away.line = +(bookData.spread.away.line + spreadDelta).toFixed(1);
                bookData.spread.home.line = +(bookData.spread.home.line - spreadDelta).toFixed(1);
                bookData.spread.away.movement = spreadDelta > 0.1 ? 'up' : spreadDelta < -0.1 ? 'down' : null;
                bookData.spread.home.movement = spreadDelta < -0.1 ? 'up' : spreadDelta > 0.1 ? 'down' : null;

                // Total
                const totalDelta = (Math.random() * 0.5 - 0.25);
                bookData.total.over.line = +(bookData.total.over.line + totalDelta).toFixed(1);
                bookData.total.under.line = bookData.total.over.line;
                bookData.total.over.movement = totalDelta > 0.1 ? 'up' : totalDelta < -0.1 ? 'down' : null;
                bookData.total.under.movement = totalDelta < -0.1 ? 'up' : totalDelta > 0.1 ? 'down' : null;
            });
        });

        state.lastRefresh = new Date();
        updateRefreshTime();
        render();
    }

    function updateRefreshTime() {
        const el = document.getElementById('refresh-time');
        if (el && state.lastRefresh) {
            el.textContent = state.lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
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
                if (data.spread.away.line !== undefined) {
                    if (!best[game.id].spread.away || data.spread.away.line > best[game.id].spread.away.line) {
                        best[game.id].spread.away = { book: book.key, line: data.spread.away.line };
                    }
                }
                if (data.spread.home.line !== undefined) {
                    if (!best[game.id].spread.home || data.spread.home.line > best[game.id].spread.home.line) {
                        best[game.id].spread.home = { book: book.key, line: data.spread.home.line };
                    }
                }

                // Moneyline - best is highest odds (more payout)
                if (data.moneyline.away.odds !== undefined) {
                    if (!best[game.id].moneyline.away || data.moneyline.away.odds > best[game.id].moneyline.away.odds) {
                        best[game.id].moneyline.away = { book: book.key, odds: data.moneyline.away.odds };
                    }
                }
                if (data.moneyline.home.odds !== undefined) {
                    if (!best[game.id].moneyline.home || data.moneyline.home.odds > best[game.id].moneyline.home.odds) {
                        best[game.id].moneyline.home = { book: book.key, odds: data.moneyline.home.odds };
                    }
                }

                // Total - over: lowest line, under: highest line
                if (data.total.over.line !== undefined) {
                    if (!best[game.id].total.over || data.total.over.line < best[game.id].total.over.line) {
                        best[game.id].total.over = { book: book.key, line: data.total.over.line };
                    }
                }
                if (data.total.under.line !== undefined) {
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

        // Data source indicator
        const dataSource = (game.sport === 'NFL' || game.sport === 'NCAAF') ? 'SportsDataIO' : 'The Odds API';

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
