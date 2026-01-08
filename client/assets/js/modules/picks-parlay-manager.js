/**
 * Picks Parlay Manager Module
 * Handles all parlay-related functionality including leg management,
 * status calculation, and parlay rendering
 */
(function() {
    'use strict';

    const ParlayManager = {
        _columnIndexCache: new WeakMap(),

        getColumnIndex(row, columnKey) {
            try {
                const table = row?.closest?.('table');
                if (!table) return null;

                let cacheForTable = this._columnIndexCache.get(table);
                if (!cacheForTable) {
                    cacheForTable = new Map();
                    this._columnIndexCache.set(table, cacheForTable);
                }

                if (cacheForTable.has(columnKey)) {
                    return cacheForTable.get(columnKey);
                }

                const th = table.querySelector(`thead th[data-sort="${columnKey}"]`) ||
                           table.querySelector(`thead th[data-filter="${columnKey}"]`);
                if (!th) {
                    cacheForTable.set(columnKey, null);
                    return null;
                }

                const tr = th.closest('tr');
                const ths = tr ? Array.from(tr.children).filter(el => el.tagName === 'TH') : [];
                const idx = ths.indexOf(th);
                const oneBased = idx >= 0 ? idx + 1 : null;
                cacheForTable.set(columnKey, oneBased);
                return oneBased;
            } catch (e) {
                return null;
            }
        },

        getCell(row, columnKey, fallbackIndex) {
            const idx = this.getColumnIndex(row, columnKey) || fallbackIndex || null;
            return idx ? row.querySelector(`td:nth-child(${idx})`) : null;
        },

        getColumnCount(row, fallback = 10) {
            const table = row?.closest?.('table');
            const ths = table ? table.querySelectorAll('thead th') : null;
            return ths && ths.length ? ths.length : fallback;
        },

        /**
         * Calculate parlay status from leg statuses
         */
        calculateParlayStatus(legs) {
            if (!legs || legs.length === 0) return 'pending';

            const utils = window.PicksDOMUtils || {};
            const normalize = utils.normalizeStatus ?
                utils.normalizeStatus.bind(utils) :
                this.normalizeLegStatus.bind(this);

            const statuses = legs.map(leg => normalize(leg.status));

            // If any leg is lost, parlay is lost
            if (statuses.includes('loss')) {
                return 'loss';
            }

            // If any leg is void, check remaining
            if (statuses.includes('void')) {
                const nonVoidStatuses = statuses.filter(s => s !== 'void');
                if (nonVoidStatuses.length === 0) {
                    return 'void';
                }
                // Continue with non-void legs
                return this.calculateParlayStatus(
                    legs.filter(leg => normalize(leg.status) !== 'void')
                );
            }

            // If any leg is live, parlay is live
            if (statuses.includes('live')) {
                return 'live';
            }

            // If any leg is pending, parlay is pending
            if (statuses.includes('pending')) {
                return 'pending';
            }

            // If all legs are push, parlay is push
            if (statuses.every(s => s === 'push')) {
                return 'push';
            }

            // If all remaining legs are wins, parlay wins
            if (statuses.every(s => s === 'win')) {
                return 'win';
            }

            // Mixed wins and pushes = win (pushes reduce payout but don't void)
            if (statuses.every(s => s === 'win' || s === 'push')) {
                return 'win';
            }

            return 'pending';
        },

        /**
         * Normalize leg status
         * @deprecated Use window.PicksDOMUtils.normalizeStatus instead
         */
        normalizeLegStatus(status) {
            if (window.PicksDOMUtils && window.PicksDOMUtils.normalizeStatus) {
                return window.PicksDOMUtils.normalizeStatus(status);
            }
            if (!status) return 'pending';

            const lower = status.toString().toLowerCase().trim();
            const statusMap = {
                'win': 'win',
                'won': 'win',
                'winner': 'win',
                'loss': 'loss',
                'lost': 'loss',
                'lose': 'loss',
                'push': 'push',
                'tie': 'push',
                'void': 'void',
                'voided': 'void',
                'cancelled': 'void',
                'pending': 'pending',
                'open': 'pending',
                'live': 'live',
                'active': 'live',
                'in-progress': 'live'
            };

            return statusMap[lower] || 'pending';
        },

        /**
         * Find parlay legs row for a parent row
         */
        findParlayLegsRow(parentRow) {
            if (!parentRow) return null;

            // Try data-row-id first
            const rowId = parentRow.getAttribute('data-row-id');
            if (rowId) {
                const tbody = parentRow.parentElement;
                const legsRow = tbody.querySelector(`tr.parlay-legs[data-parent-id="${rowId}"]`);
                if (legsRow) return legsRow;
            }

            // Fallback to next sibling
            const nextRow = parentRow.nextElementSibling;
            if (nextRow && nextRow.classList.contains('parlay-legs')) {
                return nextRow;
            }

            return null;
        },

        /**
         * Format leg line for display - Full row format matching main table structure
         */
        formatLegLine(leg, index, parentRow, parentDate, parentTime) {
            const utils = window.PicksDOMUtils || {};
            const legNum = index + 1;
            
            // Get helper functions from global scope
            const parsePickDescription = window.parsePickDescription || (() => ({}));
            const parseTeamsFromGame = window.parseTeamsFromGame || ((game) => ({ away: '', home: '' }));
            const getTeamAbbr = window.getTeamAbbr || ((name) => name);
            const getTeamLogo = window.getTeamLogo || ((name, league) => 'assets/data/logos/default.png');
            const generatePickDisplay = window.generatePickDisplay || (() => '');
            const buildStatusMeta = window.buildStatusMeta || (() => ({}));
            const buildStatusBadgeHTML = window.buildStatusBadgeHTML || (() => '');
            const getStatusBlurb = window.getStatusBlurb || (() => '');

            // Parse pick description
            const pickDescription = leg.description || leg.pick || '';
            const legParsed = parsePickDescription(pickDescription);
            
            // Parse teams from game/matchup
            const gameString = leg.game || leg.matchup || '';
            const legTeams = parseTeamsFromGame(gameString);
            const legAwayAbbr = getTeamAbbr(legTeams.away);
            const legHomeAbbr = getTeamAbbr(legTeams.home);
            const league = (leg.league || leg.sport || 'nfl').toLowerCase();
            const legAwayLogo = getTeamLogo(legTeams.away, league);
            const legHomeLogo = getTeamLogo(legTeams.home, league);

            // Build status metadata
            const statusMeta = buildStatusMeta({
                status: leg.status || 'pending',
                result: leg.score || leg.result,
                score: leg.score || leg.result,
                matchup: leg.matchup || leg.game,
                selection: leg.selection,
                description: leg.description,
                parsedPick: legParsed,
                market: leg.market,
                start: leg.start || leg.countdown
            });

            const legStatusClass = (leg.status || 'pending').toLowerCase();
            const derivedStatus = (statusMeta.statusKey || legStatusClass || 'pending').toLowerCase();
            const isLiveLeg = derivedStatus === 'on-track' || derivedStatus === 'at-risk' || derivedStatus === 'live';
            const statusTooltipText = statusMeta.tooltip || getStatusBlurb(leg.status || '', leg.result || '') || '';
            
            const legBadgeMarkup = buildStatusBadgeHTML({
                statusClass: derivedStatus,
                label: statusMeta.statusLabel || leg.status || 'Pending',
                tooltip: statusTooltipText,
                info: statusMeta.badgeContext,
                extraClass: isLiveLeg ? 'live-pulsing' : ''
            });

            // Determine which team is picked for logo emphasis
            let pickedTeamLogo = legAwayLogo;
            let pickedTeamAbbr = legAwayAbbr;
            let pickedTeamName = legTeams.away;
            if (legParsed.pickTeam) {
                const pickTeamLower = legParsed.pickTeam.toLowerCase();
                const homeLower = (legTeams.home || '').toLowerCase();
                if (homeLower.includes(pickTeamLower) || pickTeamLower.includes(homeLower)) {
                    pickedTeamLogo = legHomeLogo;
                    pickedTeamAbbr = legHomeAbbr;
                    pickedTeamName = legTeams.home;
                }
            } else if (legParsed.pickType === 'Over' || legParsed.pickType === 'Under') {
                pickedTeamAbbr = legParsed.pickType.substring(0, 1); // "O" or "U"
            }

            // Get date/time
            const dateValue = leg.accepted || parentDate || '';
            const timeValue = leg.scheduled ? leg.scheduled.split(' ').slice(-2).join(' ') : (leg.start || leg.countdown || parentTime || '');

            // Generate pick display
            const pickDisplay = generatePickDisplay(legParsed, pickedTeamLogo, pickedTeamAbbr, pickedTeamName);

            // Create boxscore rows
            const boxScoreRows = createBoxScoreRows(leg, legAwayLogo, legAwayAbbr, legHomeLogo, legHomeAbbr, derivedStatus);

            // Build full row matching main table structure
            return `
                <tr class="parlay-leg-row group-start ${isLiveLeg ? 'live-game' : ''}" 
                    data-leg-index="${index}" 
                    data-leg-number="${legNum}"
                    data-status="${derivedStatus}"
                    data-pick-type="${legParsed.pickType?.toLowerCase() || 'unknown'}" 
                    data-pick-text="${(pickDescription || '').toLowerCase()}" 
                    data-segment="${(leg.segment || 'full-game').toLowerCase().replace(/\s+/g, '-')}" 
                    data-odds="${legParsed.odds || '-110'}" 
                    data-away="${legTeams.away.toLowerCase()}" 
                    data-home="${legTeams.home.toLowerCase()}">
                    <td>
                        <div class="datetime-cell">
                            <span class="date-value">${dateValue}</span>
                            ${timeValue ? `<span class="time-value">${timeValue}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="matchup-cell-parlay-leg">
                            <img src="${legAwayLogo}" class="team-logo" loading="lazy" alt="${legAwayAbbr}">
                            <span class="team-name-full">${utils.escapeHtml ? utils.escapeHtml(legTeams.away) : legTeams.away}</span>
                            <span class="team-record" data-team="${legAwayAbbr}"></span>
                            <span class="vs-divider-inline">vs</span>
                            <img src="${legHomeLogo}" class="team-logo" loading="lazy" alt="${legHomeAbbr}">
                            <span class="team-name-full">${utils.escapeHtml ? utils.escapeHtml(legTeams.home) : legTeams.home}</span>
                            <span class="team-record" data-team="${legHomeAbbr}"></span>
                        </div>
                    </td>
                    <td>
                        <div class="pick-cell">
                            ${pickDisplay}
                        </div>
                    </td>
                    <td class="center">
                        <span class="game-segment">${leg.segment || 'Full Game'}</span>
                    </td>
                    <td class="center">
                        ${legBadgeMarkup}
                    </td>
                </tr>
            `;
        },

        /**
         * Sync parlay summary with leg data
         */
        syncParlaySummary(parentRow, legsData) {
            if (!parentRow || !legsData) return;

            const summaryEl = parentRow.querySelector('.parlay-summary');
            if (!summaryEl) return;

            const legCount = legsData.length;
            const legStatuses = legsData.map(leg => this.normalizeLegStatus(leg.status));

            // Count statuses
            const statusCounts = {
                win: legStatuses.filter(s => s === 'win').length,
                loss: legStatuses.filter(s => s === 'loss').length,
                push: legStatuses.filter(s => s === 'push').length,
                pending: legStatuses.filter(s => s === 'pending').length,
                live: legStatuses.filter(s => s === 'live').length,
                void: legStatuses.filter(s => s === 'void').length
            };

            // Build status summary
            const statusParts = [];
            if (statusCounts.win > 0) statusParts.push(`${statusCounts.win} won`);
            if (statusCounts.loss > 0) statusParts.push(`${statusCounts.loss} lost`);
            if (statusCounts.push > 0) statusParts.push(`${statusCounts.push} push`);
            if (statusCounts.pending > 0) statusParts.push(`${statusCounts.pending} pending`);
            if (statusCounts.live > 0) statusParts.push(`${statusCounts.live} live`);
            if (statusCounts.void > 0) statusParts.push(`${statusCounts.void} void`);

            const statusSummary = statusParts.length > 0 ?
                ` (${statusParts.join(', ')})` : '';

            summaryEl.textContent = `${legCount}-leg parlay${statusSummary}`;
        },

        /**
         * Hydrate parlay legs (populate expanded view)
         */
        hydrateParlayLegs(parentRow, presetLegsRow) {
            if (!parentRow) return;

            // Try to get legs data from multiple possible attributes
            const legsDataAttr = parentRow.getAttribute('data-parlay-legs') || 
                                parentRow.getAttribute('data-legs');
            if (!legsDataAttr) return;

            let legsData;
            try {
                legsData = JSON.parse(legsDataAttr);
            } catch (e) {
                console.error('Failed to parse parlay legs data:', e);
                return;
            }

            if (!Array.isArray(legsData) || legsData.length === 0) return;

            // Find or use provided legs row
            const legsRow = presetLegsRow || this.findParlayLegsRow(parentRow);
            if (!legsRow) return;

            console.warn('createParlayLegsRow function not found or failed, using fallback formatLegLine');

            // Fallback: Use formatLegLine method
            const dateCell = parentRow.querySelector('td:first-child');
            const parentDate = dateCell ? dateCell.querySelector('.date-value, .cell-date')?.textContent : '';
            const parentTime = dateCell ? dateCell.querySelector('.time-value, .cell-time')?.textContent : '';

            // Build legs HTML
            const legsHtml = legsData.map((leg, index) =>
                this.formatLegLine(leg, index, parentRow, parentDate, parentTime)
            ).join('');

            // Update legs row content with compact table and header
            const legsContainer = legsRow.querySelector('.parlay-legs-container');
            const tableHtml = `
                <div class="parlay-legs-header">
                    <div class="parlay-legs-title">
                        <span class="parlay-legs-heading">Parlay Details</span>
                    </div>
                </div>
                <table class="picks-table compact-leg-table" style="margin: 0;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Matchup</th>
                            <th>Pick</th>
                            <th>Segment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${legsHtml}
                    </tbody>
                </table>
            `;

            if (legsContainer) {
                legsContainer.innerHTML = tableHtml;
            } else {
                // Create container if doesn't exist
                const td = legsRow.querySelector('td');
                if (td) {
                    td.innerHTML = `<div class="parlay-legs-container">${tableHtml}</div>`;
                }
            }

            // Hydrate team logos
            this.hydrateLegLogos(legsRow);

            // Populate team records if function available
            if (typeof populateTeamRecordsWhenReady === 'function') {
                populateTeamRecordsWhenReady(legsRow);
            }

            // Update parlay summary
            this.syncParlaySummary(parentRow, legsData);

            // Update parent row status based on legs
            this.updateParlayStatus(parentRow, legsData);
        },

        /**
         * Hydrate team logos in parlay legs
         */
        hydrateLegLogos(legsRow) {
            if (!legsRow) return;

            const logos = legsRow.querySelectorAll('.team-logo[data-team]');
            logos.forEach(async (logo) => {
                const team = logo.getAttribute('data-team');
                const league = logo.getAttribute('data-league') || 'nfl';

                if (team && window.getTeamLogo) {
                    try {
                        const logoUrl = await window.getTeamLogo(team, league);
                        if (logoUrl) {
                            logo.src = logoUrl;
                        }
                    } catch (e) {
                        console.warn(`Failed to load logo for ${team}:`, e);
                    }
                }
            });
        },

        /**
         * Update parlay status based on leg statuses
         */
        updateParlayStatus(parentRow, legsData) {
            if (!parentRow) return;

            // Calculate overall status
            const parlayStatus = this.calculateParlayStatus(legsData);

            // Update status badge
            const statusCell = this.getCell(parentRow, 'status') || parentRow.querySelector('td:last-child');
            if (statusCell) {
                const badge = statusCell.querySelector('.status-badge');
                if (badge) {
                    badge.setAttribute('data-status', parlayStatus);
                    badge.className = `status-badge status-${parlayStatus}`;

                    const utils = window.PicksDOMUtils || {};
                    badge.textContent = utils.formatBadgeStatus ?
                        utils.formatBadgeStatus(parlayStatus) : parlayStatus.toUpperCase();
                }
            }
        },

        /**
         * Refresh all parlay statuses in table
         */
        refreshParlayStatuses() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return;

            const parlayRows = tbody.querySelectorAll('tr.parlay-row');
            parlayRows.forEach(row => {
                const legsDataAttr = row.getAttribute('data-parlay-legs');
                if (legsDataAttr) {
                    try {
                        const legsData = JSON.parse(legsDataAttr);
                        this.updateParlayStatus(row, legsData);
                    } catch (e) {
                        console.error('Failed to parse parlay legs:', e);
                    }
                }
            });
        },

        /**
         * Toggle parlay expansion
         */
        toggleParlayExpansion(parentRow) {
            if (!parentRow || !parentRow.classList.contains('parlay-row')) return;

            // Get current state
            const isCurrentlyExpanded = parentRow.classList.contains('expanded');
            const newState = !isCurrentlyExpanded;

            // Get parlay ID for state management
            let parlayId = parentRow.getAttribute('data-row-id') || 
                          parentRow.getAttribute('data-parlay-id') ||
                          parentRow.id;
            
            if (!parlayId) {
                parlayId = `parlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                parentRow.setAttribute('data-row-id', parlayId);
                if (!parentRow.id) {
                    parentRow.id = parlayId;
                }
            }

            // Update state manager
            if (window.PicksStateManager) {
                window.PicksStateManager.setParlayExpanded(parlayId, newState);
            }

            // Apply UI changes
            this.setRowExpansionState(parentRow, newState);
        },

        /**
         * Set row expansion state (UI only)
         */
        setRowExpansionState(parentRow, isExpanded) {
            if (!parentRow) return;

            // Update parent row classes and attributes
            if (isExpanded) {
                parentRow.classList.add('expanded');
                parentRow.setAttribute('aria-expanded', 'true');
            } else {
                parentRow.classList.remove('expanded');
                parentRow.setAttribute('aria-expanded', 'false');
            }

            // Find and update legs row
            let legsRow = this.findParlayLegsRow(parentRow);
            
            // If no legs row found, try to create it
            if (!legsRow && isExpanded) {
                const legsDataAttr = parentRow.getAttribute('data-parlay-legs');
                if (legsDataAttr) {
                    // Try to create legs row via ingestParlayLegs
                    this.ingestParlayLegs(parentRow, JSON.parse(legsDataAttr));
                    legsRow = this.findParlayLegsRow(parentRow);
                }
            }

            // Update legs row visibility
            if (legsRow) {
                if (isExpanded) {
                    legsRow.classList.add('show');
                    legsRow.style.display = 'table-row';
                    
                    // Hydrate legs if not already done
                    const container = legsRow.querySelector('.parlay-legs-container');
                    if (container && !container.querySelector('.parlay-leg-row')) {
                        this.hydrateParlayLegs(parentRow, legsRow);
                    }
                } else {
                    legsRow.classList.remove('show');
                    legsRow.style.display = 'none';
                }
            }

            // Update toggle icons (they rotate via CSS)
            const toggleElements = parentRow.querySelectorAll('.parlay-toggle, .parlay-toggle-icon, .parlay-expand-arrow');
            toggleElements.forEach(el => {
                el.setAttribute('aria-expanded', String(isExpanded));
            });

            // Reapply zebra stripes if function exists
            if (typeof applyPicksTableZebraStripes === 'function') {
                setTimeout(() => applyPicksTableZebraStripes(), 10);
            }
        },

        /**
         * Refresh all parlay visibility based on state
         */
        refreshAllParlayVisibility() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return;

            const parlayRows = tbody.querySelectorAll('tr.parlay-row');
            parlayRows.forEach(row => {
                const parlayId = row.getAttribute('data-row-id');
                const isExpanded = window.PicksStateManager ?
                    window.PicksStateManager.isParlayExpanded(parlayId) :
                    row.getAttribute('aria-expanded') === 'true';

                this.setRowExpansionState(row, isExpanded);
            });
        },

        /**
         * Ensure leg row follows parent row in DOM
         */
        ensureLegRowPosition(parentRow) {
            if (!parentRow) return;

            const legsRow = this.findParlayLegsRow(parentRow);
            if (legsRow && parentRow.nextElementSibling !== legsRow) {
                parentRow.parentNode.insertBefore(legsRow, parentRow.nextSibling);
            }
        },

        /**
         * Initialize parlay functionality
         */
        initParlays() {
            // Parlays disabled - not initializing any parlay functionality
            return;
        },

        /**
         * Re-initialize parlays after dynamic content changes
         * DISABLED: Parlay expansion and toggle insertion removed. Implement later if needed.
         */
        reinitParlays() {
            // Feature disabled
            return;
        },

        /**
         * Prime parlay summaries on load
         */
        primeParlaySummaries() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return;

            const parlayRows = tbody.querySelectorAll('tr.parlay-row');
            parlayRows.forEach(row => {
                const legsDataAttr = row.getAttribute('data-parlay-legs');
                if (legsDataAttr) {
                    try {
                        const legsData = JSON.parse(legsDataAttr);
                        this.syncParlaySummary(row, legsData);
                    } catch (e) {
                        console.error('Failed to parse parlay legs:', e);
                    }
                }
            });
        },

        /**
         * Ingest parlay legs data (for dynamic updates)
         * DISABLED: Parlay legs display removed. Implement later if needed.
         */
        ingestParlayLegs(rowRef, legsData) {
            // Feature disabled
            return;
        },

        /**
         * Format a single leg line for the legs table
         */
        formatLegLine(leg, index, parentRow, parentDate, parentTime) {
            const utils = window.PicksDOMUtils || {};
            const getTeamInfo = window.getTeamInfo || ((name) => ({ abbr: name, logo: '' }));
            
            const pickTeamInfo = getTeamInfo(leg.pickTeam);
            const awayTeam = leg.awayTeam || leg.pickTeam || 'TBD';
            const homeTeam = leg.homeTeam || 'TBD';
            const awayInfo = getTeamInfo(awayTeam);
            const homeInfo = getTeamInfo(homeTeam);
            
            let selection = '';
            let market = '';
            if (leg.pickType === 'spread') {
                const line = leg.line || '';
                selection = line.startsWith('+') || line.startsWith('-') ? line : `+${line}`;
                market = 'Spread';
            } else if (leg.pickType === 'moneyline') {
                selection = 'ML';
                market = 'Moneyline';
            } else if (leg.pickType === 'total' || leg.pickType === 'team-total') {
                selection = `${leg.pickDirection || 'Over'} ${leg.line || ''}`;
                market = 'Total';
            }

            const status = leg.status || 'pending';
            const isSingleTeamBet = !leg.homeTeam || homeTeam === 'TBD';
            
            const awayLogoHtml = awayInfo.logo 
                ? `<img src="${awayInfo.logo}" class="team-logo" loading="lazy" alt="${awayInfo.abbr}" onerror="this.style.display='none'">`
                : '';
            const homeLogoHtml = homeInfo.logo 
                ? `<img src="${homeInfo.logo}" class="team-logo" loading="lazy" alt="${homeInfo.abbr}" onerror="this.style.display='none'">`
                : '';
            const pickLogoHtml = pickTeamInfo.logo
                ? `<img src="${pickTeamInfo.logo}" class="pick-team-logo" loading="lazy" alt="${pickTeamInfo.abbr}" onerror="this.style.display='none'">`
                : '';

            const matchupHtml = isSingleTeamBet 
                ? `<div class="matchup-cell-parlay-leg">
                        <div class="team-line">
                            ${awayLogoHtml}
                            <span class="team-name-full">${awayTeam}</span>
                        </div>
                    </div>`
                : `<div class="matchup-cell-parlay-leg">
                        <div class="team-line">
                            ${awayLogoHtml}
                            <span class="team-name-full">${awayTeam}</span>
                        </div>
                        <div class="vs-divider">vs</div>
                        <div class="team-line">
                            ${homeLogoHtml}
                            <span class="team-name-full">${homeTeam}</span>
                        </div>
                    </div>`;

            // Format date/time
            let dateStr = parentDate;
            let timeStr = parentTime;
            
            if (leg.gameDate) {
                const d = new Date(leg.gameDate);
                if (!isNaN(d)) {
                    dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                }
            }
            if (leg.gameTime) timeStr = leg.gameTime;

            return `
                <tr class="parlay-leg-item">
                    <td data-label="Date & Time">
                        <div class="cell-date">${dateStr}</div>
                        <div class="cell-time">${timeStr}</div>
                    </td>
                    <td>
                        ${matchupHtml}
                    </td>
                    <td>
                        <div class="pick-cell">
                            <div class="pick-team-info">
                                ${pickLogoHtml}
                                <span class="pick-team-abbr">${pickTeamInfo.abbr}</span>
                            </div>
                            <div class="pick-details">
                                <span class="pick-market">${market}</span>
                                <span class="pick-selection">${selection}</span>
                                <span class="pick-odds">(${leg.odds || '-110'})</span>
                            </div>
                        </div>
                    </td>
                    <td class="center">
                        <span class="game-segment">${leg.segment || 'Full Game'}</span>
                    </td>
                    <td class="center">
                        <span class="status-badge" data-status="${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </td>
                </tr>
            `;
        },

        /**
         * Get mini status badge text
         */
        getMiniStatusBadgeText(status, statusMeta, legInfo) {
            // For live bets, show score if available
            if (status === 'live' && statusMeta && statusMeta.score) {
                return statusMeta.score;
            }

            // Otherwise return formatted status
            const utils = window.PicksDOMUtils || {};
            return utils.formatBadgeStatus ?
                utils.formatBadgeStatus(status) : status.toUpperCase();
        }
    };

    // Export to global scope
    window.PicksParlayManager = ParlayManager;

    // Also expose the ingestParlayLegs function globally for backward compatibility
    window.ingestParlayLegs = function(rowRef, legsData) {
        ParlayManager.ingestParlayLegs(rowRef, legsData);
    };

})();