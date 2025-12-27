/**
 * KPI Calculator
 * Calculates and updates KPI metrics from picks data
 */

function parseScoreFromResult(resultString) {
    /**
     * Parse score from result string
     * E.g., "Raiders 7 - Broncos 10" => { away: 7, home: 10 }
     */
    if (!resultString) return { away: null, home: null };

    const scorePattern = /(\d+)\s*-\s*(\d+)/;
    const match = resultString.match(scorePattern);

    if (match) {
        return {
            away: parseInt(match[1]),
            home: parseInt(match[2])
        };
    }

    return { away: null, home: null };
}

function normalizeStatus(status) {
    const value = (status || '').toString().toLowerCase();
    return value === 'lost' ? 'loss' : value;
}

function calculateKPIs(picks) {
    /**
     * Calculate all KPI metrics from picks array
     */
    // Defensive: ensure picks is an array
    if (!picks || !Array.isArray(picks)) {
        picks = [];
    }

    const kpis = {
        activePicks: 0,
        activeRisk: 0,
        toWin: 0,
        onTrackAmount: 0,
        atRiskAmount: 0,
        projected: 0,
        netProfit: 0,
        totalWon: 0,
        totalLost: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        roePercentage: 0,
        winPercentage: 0,
        currentStreak: '',
        totalRisk: 0,
        topLeague: { name: 'N/A', winRate: 0 },
        topBetType: { name: 'N/A', winRate: 0 },
        topSegment: { name: 'N/A', winRate: 0 },
        topSportsbook: { name: 'N/A', winRate: 0 }
    };

    // Track stats by category for "top" calculations
    const leagueStats = {};
    const betTypeStats = {};
    const segmentStats = {};
    const sportsbookStats = {};

    picks.forEach(pick => {
        // Safely parse risk and win values - handle both string and number types
        const riskStr = pick.risk != null ? String(pick.risk).replace(/,/g, '') : '0';
        const winStr = pick.win != null ? String(pick.win).replace(/,/g, '') : '0';
        const risk = parseFloat(riskStr) || 0;
        const win = parseFloat(winStr) || 0;
        const status = normalizeStatus(pick.status);
        const isLoss = status === 'loss';

        // Active picks (pending, live, on-track, at-risk)
        if (status === 'pending' || status === 'live' || status === 'on-track' || status === 'at-risk') {
            kpis.activePicks++;
            kpis.toWin += win;
            kpis.activeRisk += risk;
            
            // Track on-track vs at-risk amounts
            if (status === 'on-track') {
                kpis.onTrackAmount += win; // Potential payout for on-track picks
            } else if (status === 'at-risk') {
                kpis.atRiskAmount += risk; // Risk amount for at-risk picks
            } else if (status === 'pending') {
                // Pending picks are neither on-track nor at-risk yet
                kpis.onTrackAmount += win * 0.5; // Assume 50% distribution for pending
                kpis.atRiskAmount += risk * 0.5;
            }
        }

        // Wins
        if (status === 'win') {
            kpis.wins++;
            kpis.totalWon += win;

            // Track wins by category
            trackWin(leagueStats, pick.league || 'Unknown');
            trackWin(betTypeStats, pick.pickType || 'Unknown');
            trackWin(segmentStats, pick.segment || 'Full Game');
            trackWin(sportsbookStats, pick.book || 'Unknown');
        }

        // Losses
        if (isLoss) {
            kpis.losses++;
            kpis.totalLost += risk;

            // Track losses by category
            trackLoss(leagueStats, pick.league || 'Unknown');
            trackLoss(betTypeStats, pick.pickType || 'Unknown');
            trackLoss(segmentStats, pick.segment || 'Full Game');
            trackLoss(sportsbookStats, pick.book || 'Unknown');
        }

        // Pushes
        if (status === 'push') {
            kpis.pushes++;
        }

        // Total risk
        kpis.totalRisk += risk;
    });

    // Calculate projected gain if all active picks win
    kpis.projected = kpis.toWin - kpis.activeRisk;

    // Calculate net profit/loss
    kpis.netProfit = kpis.totalWon - kpis.totalLost;

    // Calculate percentages
    const totalGames = kpis.wins + kpis.losses + kpis.pushes;
    if (totalGames > 0) {
        kpis.winPercentage = ((kpis.wins / (kpis.wins + kpis.losses)) * 100).toFixed(1);
    }

    // Calculate ROE (Return on Equity)
    if (kpis.totalRisk > 0) {
        kpis.roePercentage = ((kpis.netProfit / kpis.totalRisk) * 100).toFixed(1);
    }

    // Calculate streak
    kpis.currentStreak = calculateStreak(picks);

    // Find top performers
    kpis.topLeague = findTopPerformer(leagueStats);
    kpis.topBetType = findTopPerformer(betTypeStats);
    kpis.topSegment = findTopPerformer(segmentStats);
    kpis.topSportsbook = findTopPerformer(sportsbookStats);

    return kpis;
}

function trackWin(stats, key) {
    if (!stats[key]) stats[key] = { wins: 0, losses: 0 };
    stats[key].wins++;
}

function trackLoss(stats, key) {
    if (!stats[key]) stats[key] = { wins: 0, losses: 0 };
    stats[key].losses++;
}

function findTopPerformer(stats) {
    let topName = 'N/A';
    let topWinRate = 0;

    for (const [name, record] of Object.entries(stats)) {
        const total = record.wins + record.losses;
        if (total >= 3) { // Minimum 3 picks to qualify
            const winRate = (record.wins / total) * 100;
            if (winRate > topWinRate) {
                topWinRate = winRate;
                topName = name;
            }
        }
    }

    return { name: topName, winRate: topWinRate.toFixed(1) };
}

function calculateStreak(picks) {
    /**
     * Calculate current win/loss streak
     */
    const finishedPicks = picks.filter(p => {
        const status = normalizeStatus(p.status);
        return status === 'win' || status === 'loss';
    }).reverse(); // Most recent first

    if (finishedPicks.length === 0) return 'W0';

    let streak = 1;
    const lastStatus = normalizeStatus(finishedPicks[0].status);

    for (let i = 1; i < finishedPicks.length; i++) {
        if (normalizeStatus(finishedPicks[i].status) === lastStatus) {
            streak++;
        } else {
            break;
        }
    }

    return lastStatus === 'win' ? `W${streak}` : `L${streak}`;
}

function updateKPITiles(kpis) {
    /**
     * Update the KPI tiles in the dashboard
     * Uses simplified single-layer structure (.kpi-tile-front only)
     */

    // Tile 1 - Projected PnL
    const tile1 = document.querySelector('[data-tile-id="1"]');
    if (tile1) {
        const valueEl = tile1.querySelector('.kpi-tile-front .kpi-value');
        const subtextEl = tile1.querySelector('.kpi-tile-front .kpi-subtext');
        
        if (valueEl) {
            const projectedSign = kpis.projected >= 0 ? '+' : '';
            valueEl.textContent = `${projectedSign}$${Math.abs(kpis.projected).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            
            // Apply conditional formatting
            valueEl.classList.remove('positive', 'negative');
            if (kpis.projected > 0) {
                valueEl.classList.add('positive');
            } else if (kpis.projected < 0) {
                valueEl.classList.add('negative');
            }
        }
        
        if (subtextEl) {
            subtextEl.textContent = `${kpis.activePicks} Active Picks`;
        }
    }

    // Tile 2 - Win Rate
    const tile2 = document.querySelector('[data-tile-id="2"]');
    if (tile2) {
        const valueEl = tile2.querySelector('.kpi-tile-front .kpi-value');
        const subtextEl = tile2.querySelector('.kpi-tile-front .kpi-subtext');
        
        if (valueEl) {
            valueEl.textContent = `${kpis.winPercentage}%`;
        }
        
        if (subtextEl) {
            subtextEl.textContent = `${kpis.wins}-${kpis.losses}-${kpis.pushes} Record`;
        }
    }

    // Tile 3 - Active Volume (Total Risk)
    const tile3 = document.querySelector('[data-tile-id="3"]');
    if (tile3) {
        const valueEl = tile3.querySelector('.kpi-tile-front .kpi-value');
        const subtextEl = tile3.querySelector('.kpi-tile-front .kpi-subtext');
        
        if (valueEl) {
            valueEl.textContent = `$${kpis.activeRisk.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        
        if (subtextEl) {
            subtextEl.textContent = `Total Risk`;
        }
    }
}

// Export functions
window.calculateKPIs = calculateKPIs;
window.updateKPITiles = updateKPITiles;
window.parseScoreFromResult = parseScoreFromResult;
