/**
 * Status Logic and KPI Sync for Dashboard v2.0
 * Handles On Track vs At Risk determination and real-time KPI updates
 */

(function() {
    'use strict';

    // ===== STATUS CALCULATION LOGIC =====

    /**
     * Calculate status (On Track vs At Risk) based on game state
     * @param {Object} pick - Pick data object
     * @returns {string} - 'on-track', 'at-risk', 'win', 'lost', 'pending', 'push'
     */
    function calculatePickStatus(pick) {
        // If game hasn't started
        if (!pick.isLive) {
            return 'pending';
        }

        // If game is final
        if (pick.isFinal) {
            if (pick.didWin) return 'win';
            if (pick.didLose) return 'loss';
            if (pick.isPush) return 'push';
        }

        // Live game logic
        if (pick.pickType === 'spread') {
            return calculateSpreadStatus(pick);
        } else if (pick.pickType === 'total' || pick.pickType.includes('ou')) {
            return calculateTotalStatus(pick);
        } else if (pick.pickType === 'moneyline') {
            return calculateMoneylineStatus(pick);
        }

        return 'pending';
    }

    /**
     * Calculate spread bet status
     */
    function calculateSpreadStatus(pick) {
        const { awayScore, homeScore, pickTeam, spread, timeRemaining, quarter } = pick;

        // Determine if picking away or home
        const isAwayPick = pickTeam === pick.awayTeam;
        const actualSpread = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);
        const coverMargin = actualSpread - spread;

        // Win/Loss thresholds based on time remaining
        const criticalTime = getCriticalTimeThreshold(quarter, timeRemaining);

        if (coverMargin > 3 || (coverMargin > 0 && criticalTime < 0.15)) {
            return 'on-track';  // Comfortably covering
        } else if (coverMargin < -3 || (coverMargin < 0 && criticalTime < 0.15)) {
            return 'at-risk';   // Not covering
        } else if (Math.abs(coverMargin) <= 3) {
            // Close game - check possession and time
            return coverMargin >= 0 ? 'on-track' : 'at-risk';
        }

        return coverMargin >= 0 ? 'on-track' : 'at-risk';
    }

    /**
     * Calculate total (over/under) bet status
     */
    function calculateTotalStatus(pick) {
        const { awayScore, homeScore, pickTeam, total, isOver, timeRemaining, quarter, isTeamTotal = false } = pick;
        let currentTotal;
        if (isTeamTotal && pickTeam) {
            const teamScore = pickTeam === pick.awayTeam ? awayScore : homeScore;
            currentTotal = teamScore;
        } else {
            currentTotal = awayScore + homeScore;
        }
        const difference = isOver ? (currentTotal - total) : (total - currentTotal);

        const criticalTime = getCriticalTimeThreshold(quarter, timeRemaining);
        const remainingPossessions = estimateRemainingPossessions(timeRemaining, quarter);
        const expectedPointsRemaining = remainingPossessions * 7; // Avg 7 pts per possession

        if (isOver) {
            // Need points - currently over or tracking well
            if (difference > expectedPointsRemaining * 0.5) {
                return 'on-track';
            } else if (difference < -expectedPointsRemaining) {
                return 'at-risk';
            }
        } else {
            // Need under - currently under or tracking well
            if (difference > expectedPointsRemaining * 0.5) {
                return 'on-track';
            } else if (difference < -expectedPointsRemaining) {
                return 'at-risk';
            }
        }

        return difference >= 0 ? 'on-track' : 'at-risk';
    }

    /**
     * Calculate moneyline bet status
     */
    function calculateMoneylineStatus(pick) {
        const { awayScore, homeScore, pickTeam, timeRemaining, quarter } = pick;

        const isAwayPick = pickTeam === pick.awayTeam;
        const leadMargin = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);

        const criticalTime = getCriticalTimeThreshold(quarter, timeRemaining);

        // Winning
        if (leadMargin > 7 || (leadMargin > 0 && criticalTime < 0.10)) {
            return 'on-track';
        }
        // Losing
        else if (leadMargin < -7 || (leadMargin < 0 && criticalTime < 0.10)) {
            return 'at-risk';
        }
        // Close game
        else {
            return leadMargin >= 0 ? 'on-track' : 'at-risk';
        }
    }

    /**
     * Get critical time threshold (0.0 to 1.0) representing game completion
     */
    function getCriticalTimeThreshold(quarter, timeRemaining) {
        // Convert to total game time remaining percentage
        const totalGameSeconds = 3600; // 60 minutes for NFL/NCAAF
        let secondsRemaining = 0;

        if (quarter === 'Q1') {
            secondsRemaining = (45 * 60) + parseTimeToSeconds(timeRemaining);
        } else if (quarter === 'Q2') {
            secondsRemaining = (30 * 60) + parseTimeToSeconds(timeRemaining);
        } else if (quarter === 'Q3') {
            secondsRemaining = (15 * 60) + parseTimeToSeconds(timeRemaining);
        } else if (quarter === 'Q4') {
            secondsRemaining = parseTimeToSeconds(timeRemaining);
        }

        return secondsRemaining / totalGameSeconds;
    }

    /**
     * Estimate remaining possessions based on time
     */
    function estimateRemainingPossessions(timeRemaining, quarter) {
        const totalSeconds = getCriticalTimeThreshold(quarter, timeRemaining) * 3600;
        const avgPossessionTime = 180; // 3 minutes average
        return Math.ceil(totalSeconds / avgPossessionTime);
    }

    /**
     * Parse time string "14:32" to seconds
     */
    function parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const [min, sec] = timeStr.split(':').map(Number);
        return (min * 60) + (sec || 0);
    }

    // ===== STATUS TOOLTIP GENERATION =====

    /**
     * Generate tooltip text for status chip
     */
    function generateStatusTooltip(pick, status) {
        if (status === 'pending') {
            return `Game starts ${pick.startTime}`;
        }

        const { awayScore, homeScore, pickTeam, spread, total, isOver, finalScore, isTeamTotal = false } = pick;
        let tooltipText = '';

        if (status === 'win' || status === 'loss') {
            if (pick.isFinal) {
                const isAwayPick = pickTeam === pick.awayTeam;
                let diff, line, betType;
                
                if (pick.pickType === 'spread') {
                    const actualSpread = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);
                    diff = actualSpread - spread;
                    line = spread;
                    betType = 'spread';
                } else if (pick.pickType === 'total' || pick.pickType.includes('ou')) {
                    let currentTotal;
                    if (isTeamTotal && pickTeam) {
                        const teamScore = isAwayPick ? awayScore : homeScore;
                        currentTotal = teamScore;
                    } else {
                        currentTotal = awayScore + homeScore;
                    }
                    diff = isOver ? (currentTotal - total) : (total - currentTotal);
                    line = total;
                    betType = isTeamTotal ? 'team total' : 'total';
                } else if (pick.pickType === 'moneyline') {
                    const lead = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);
                    diff = lead;
                    betType = 'moneyline';
                }

                const absDiff = Math.abs(diff).toFixed(1);
                const ttSuffix = isTeamTotal ? ' (TT)' : '';
                
                if (status === 'win') {
                    if (betType === 'spread') {
                        tooltipText = `✓ Bet won - Covered ${line >= 0 ? ' + ' : ''}${line} by ${absDiff} pts${ttSuffix} - ${finalScore}`;
                    } else if (betType === 'total') {
                        tooltipText = `✓ Bet won - ${isOver ? 'Over' : 'Under'} ${line}${ttSuffix} by ${absDiff} pts - ${finalScore}`;
                    } else if (betType === 'moneyline') {
                        tooltipText = `✓ Bet won - Won by ${absDiff} pts - ${finalScore}`;
                    }
                } else { // lost
                    if (betType === 'spread') {
                        tooltipText = `✗ Bet lost - Failed to cover ${line >= 0 ? '+' : ''}${line} (missed by ${absDiff} pts)${ttSuffix} - ${finalScore}`;
                    } else if (betType === 'total') {
                        if (isOver) {
                            tooltipText = `✗ Bet lost - Over ${line}${ttSuffix} (scored ${currentTotal}, short ${absDiff} pts) - ${finalScore}`;
                        } else {
                            tooltipText = `✗ Bet lost - Under ${line}${ttSuffix} (scored ${currentTotal}, over by ${absDiff} pts) - ${finalScore}`;
                        }
                    } else if (betType === 'moneyline') {
                        tooltipText = `✗ Bet lost - Lost by ${absDiff} pts - ${finalScore}`;
                    }
                }
                
                if (tooltipText) return tooltipText;
            }
            // Fallback
            if (status === 'win') {
                return `✓ Bet won - ${finalScore || 'Final'}`;
            } else {
                return `✗ Bet lost - ${finalScore || 'Final'}`;
            }
        }

        if (status === 'push') {
            return `Push - ${finalScore || pick.finalScore}`;
        }

        // Live game tooltips
        if (pick.isLive) {
            if (pick.pickType === 'spread') {
                const isAwayPick = pickTeam === pick.awayTeam;
                const actualSpread = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);
                const coverMargin = actualSpread - spread;
                if (status === 'on-track') {
                    return `Covering by ${Math.abs(coverMargin).toFixed(1)} pts • ${pick.timeRemaining} ${pick.quarter}`;
                } else {
                    return `Need ${Math.abs(coverMargin).toFixed(1)} pts to cover • ${pick.timeRemaining} ${pick.quarter}`;
                }
            }

            if (pick.pickType === 'total' || pick.pickType.includes('ou')) {
                const isAwayPick = pickTeam === pick.awayTeam; // for team total
                let currentTotal;
                if (isTeamTotal && pickTeam) {
                    currentTotal = isAwayPick ? awayScore : homeScore;
                } else {
                    currentTotal = awayScore + homeScore;
                }
                const diff = isOver ? (currentTotal - total) : (total - currentTotal);
                const ttPrefix = isTeamTotal ? 'TT ' : '';
                if (status === 'on-track') {
                    return `${isOver ? 'Over' : 'Under'} ${ttPrefix}by ${Math.abs(diff).toFixed(1)} pts • ${pick.timeRemaining} ${pick.quarter}`;
                } else {
                    return `Need ${Math.abs(diff).toFixed(1)} more pts for ${isOver ? 'over' : 'under'} ${ttPrefix}• ${pick.timeRemaining} ${pick.quarter}`;
                }
            }

            if (pick.pickType === 'moneyline') {
                const isAwayPick = pickTeam === pick.awayTeam;
                const lead = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);
                if (status === 'on-track') {
                    return `Leading by ${Math.abs(lead)} • ${pick.timeRemaining} ${pick.quarter}`;
                } else {
                    return `Down ${Math.abs(lead)} • ${pick.timeRemaining} ${pick.quarter}`;
                }
            }

            return `Live • ${pick.timeRemaining} ${pick.quarter}`;
        }

        return `Status: ${status}`;
    }

    // ===== KPI SYNC FUNCTIONALITY =====

    /**
     * Sync KPI tiles with current table data
     */
    function syncKPIsWithTable() {
        const tbody = document.getElementById('picks-tbody');
        if (!tbody) return;

        // Get all visible parent rows (not parlay-legs)
        const visibleRows = Array.from(tbody.children)
            .filter(row => row && row.tagName === 'TR' && !row.classList.contains('parlay-legs'))
            .filter(row => row.style.display !== 'none');

        const stats = {
            totalActivePicks: 0,
            toWin: 0,
            riskAmount: 0,
            winCount: 0,
            lossCount: 0,
            pendingCount: 0,
            onTrackCount: 0,
            atRiskCount: 0
        };

        visibleRows.forEach(row => {
            const status = (row.getAttribute('data-status') || '').toLowerCase();
            const risk = parseFloat(row.getAttribute('data-risk')) || 0;
            const win = parseFloat(row.getAttribute('data-win')) || 0;

            stats.riskAmount += risk;

            if (status === 'win') {
                stats.winCount++;
                stats.toWin += win;
            } else if (status === 'loss') {
                stats.lossCount++;
            } else if (status === 'pending') {
                stats.pendingCount++;
                stats.totalActivePicks++;
                stats.toWin += win;
            } else if (status === 'on-track') {
                stats.onTrackCount++;
                stats.totalActivePicks++;
                stats.toWin += win;
            } else if (status === 'at-risk') {
                stats.atRiskCount++;
                stats.totalActivePicks++;
                stats.toWin += win;
            }
        });

        // Update KPI tiles
        updateKPITile('active-picks', stats.totalActivePicks);
        updateKPITile('to-win', `$${stats.toWin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

        // Calculate ROE%
        const roi = stats.riskAmount > 0 ? ((stats.toWin - stats.riskAmount) / stats.riskAmount * 100) : 0;
        updateKPITile('roe', `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`);

        // Calculate streak
        const recentResults = getRecentResults(visibleRows, 10);
        const streak = calculateStreak(recentResults);
        updateKPITile('streak', streak);
    }

    /**
     * Update individual KPI tile
     */
    function updateKPITile(tileId, value) {
        const tileSelectors = [
            `#${tileId} .kpi-value`,
            `.kpi-tile[data-metric="${tileId}"] .kpi-value`,
            `.metric-card[data-metric="${tileId}"] .metric-value`
        ];

        for (const selector of tileSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = value;
                return;
            }
        }
    }

    /**
     * Get recent results for streak calculation
     */
    function getRecentResults(rows, limit = 10) {
        return rows
            .filter(row => {
                const status = (row.getAttribute('data-status') || '').toLowerCase();
                return status === 'win' || status === 'loss';
            })
            .slice(0, limit)
            .map(row => {
                const status = (row.getAttribute('data-status') || '').toLowerCase();
                return status === 'win' ? 'W' : 'L';
            });
    }

    /**
     * Calculate win/loss streak
     */
    function calculateStreak(results) {
        if (results.length === 0) return 'N/A';

        const mostRecent = results[0];
        let count = 0;

        for (const result of results) {
            if (result === mostRecent) {
                count++;
            } else {
                break;
            }
        }

        return `${mostRecent}${count}`;
    }

    // ===== INITIALIZE STATUS TOOLTIPS =====

    function initializeStatusTooltips() {
        const statusBadges = document.querySelectorAll('.status-badge, .status-chip, .status-badge--mini');

        statusBadges.forEach(badge => {
            const existingTooltip = badge.getAttribute('data-blurb') || badge.getAttribute('title');

            if (!existingTooltip || existingTooltip === '') {
                const row = badge.closest('tr');
                if (row) {
                    const status = badge.getAttribute('data-status') || row.getAttribute('data-status');
                    const tooltip = generateDefaultTooltip(status);
                    badge.setAttribute('data-blurb', tooltip);
                }
            }

            // Remove native title attributes to avoid double-tooltips;
            // the dedicated status-tooltip.js handles rendering.
            if (badge.hasAttribute('title')) {
                badge.removeAttribute('title');
            }
        });
    }

    /**
     * Generate default tooltip based on status
     */
    function generateDefaultTooltip(status) {
        const tooltips = {
            'pending': 'Awaiting game start',
            'on-track': 'Currently covering the bet',
            'at-risk': 'Currently not covering',
            'win': 'Bet won successfully',
            'loss': 'Bet did not cover',
            'push': 'Bet pushed (tie)'
        };

        return tooltips[status] || 'Status unknown';
    }

    // ===== AUTO-SYNC KPIs ON PAGE LOAD AND TABLE CHANGES =====

    // Sync on page load
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            syncKPIsWithTable();
            initializeStatusTooltips();
        }, 500);
    });

    // Sync when table is filtered or sorted
    const originalUpdateTable = window.updateTable || function() {};
    window.updateTable = function() {
        originalUpdateTable.apply(this, arguments);
        setTimeout(syncKPIsWithTable, 100);
    };

    // Expose functions globally for external use
    window.dashboardStatusLogic = {
        calculatePickStatus,
        generateStatusTooltip,
        syncKPIsWithTable,
        initializeStatusTooltips
    };

})();
