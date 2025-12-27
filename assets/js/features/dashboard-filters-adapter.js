/**
 * Dashboard Filters Adapter
 * Handles table header filter dropdowns for the Dashboard
 */
(function() {
    'use strict';

    const DashboardFilters = {
        init() {
            console.log('Initializing Dashboard Filters Adapter...');
            this.initHeaderFilters();
            this.initFilterItemClicks();
            
            // Close dropdowns on click outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.th-filter-dropdown') && !e.target.closest('.th-filter-btn')) {
                    this.closeAllDropdowns();
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeAllDropdowns();
            });
        },

        initHeaderFilters() {
            // Find all filter buttons in table headers
            const filterBtns = document.querySelectorAll('.th-filter-btn');
            console.log('[DashboardFilters] Found filter buttons:', filterBtns.length);

            filterBtns.forEach(btn => {
                // Skip if handler already attached by another script (e.g., active-picks-modular.js)
                if (btn.dataset.filterHandlerAttached) {
                    console.log('[DashboardFilters] Skipping - handler already attached for:', btn.getAttribute('aria-controls'));
                    return;
                }
                btn.dataset.filterHandlerAttached = 'dashboard-filters-adapter';

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const dropdownId = btn.getAttribute('aria-controls');
                    const dropdown = document.getElementById(dropdownId);
                    
                    if (!dropdown) {
                        console.warn('Dropdown not found:', dropdownId);
                        return;
                    }
                    
                    const isOpen = dropdown.classList.contains('open');
                    
                    // Close all dropdowns first
                    this.closeAllDropdowns();
                    
                    if (!isOpen) {
                        // Show dropdown first, then position it
                        dropdown.classList.add('open');
                        dropdown.hidden = false;
                        // Explicitly set visible styles
                        dropdown.style.display = 'block';
                        dropdown.style.visibility = 'visible';
                        dropdown.style.opacity = '1';
                        dropdown.style.pointerEvents = 'auto';
                        btn.classList.add('active');
                        btn.setAttribute('aria-expanded', 'true');
                        
                        // Position dropdown using fixed positioning (relative to viewport)
                        // Must happen AFTER showing so we can get accurate dimensions
                        this.positionDropdown(dropdown, btn);
                    }
                });
            });
        },

        positionDropdown(dropdown, btn) {
            const btnRect = btn.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Use actual dimensions if available, otherwise small defaults
            const dropdownWidth = dropdown.offsetWidth || 150;
            const dropdownHeight = dropdown.offsetHeight || 200;

            // Position BELOW the button, aligned with button's right edge
            let top = btnRect.bottom + 4;
            let left = btnRect.right - dropdownWidth;

            // Keep within viewport bounds - left edge
            if (left < 16) {
                left = 16;
            }
            // Keep within viewport bounds - right edge
            if (left + dropdownWidth > viewportWidth - 16) {
                left = viewportWidth - dropdownWidth - 16;
            }

            // If dropdown would go below viewport, position above button instead
            if (top + dropdownHeight > viewportHeight - 16) {
                top = btnRect.top - dropdownHeight - 8;
                if (top < 16) {
                    top = 16;
                }
            }

            console.log('📍 DashboardFilters positioning:', { top, left, btnRect: btnRect.toJSON ? btnRect.toJSON() : btnRect });

            // Use setProperty with !important to override any CSS
            dropdown.style.setProperty('position', 'fixed', 'important');
            dropdown.style.setProperty('top', top + 'px', 'important');
            dropdown.style.setProperty('left', left + 'px', 'important');
            dropdown.style.setProperty('right', 'auto', 'important');
            dropdown.style.setProperty('bottom', 'auto', 'important');
            dropdown.style.setProperty('z-index', '2147483647', 'important');
            dropdown.style.setProperty('transform', 'none', 'important');
        },

        initFilterItemClicks() {
            // Handle clicks on filter items (league, pick type, status)
            document.querySelectorAll('.th-filter-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.classList.toggle('active');
                    this.applyFilters();
                });
            });
            
            // Handle clicks on date chips (compact date filter)
            document.querySelectorAll('.th-date-chip').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Date chips are exclusive - only one active at a time
                    document.querySelectorAll('.th-date-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    this.applyFilters();
                });
            });
            
            // Handle clicks on range buttons (risk/win)
            document.querySelectorAll('.th-range-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    btn.classList.toggle('active');
                    this.applyFilters();
                });
            });
        },

        closeAllDropdowns() {
            document.querySelectorAll('.th-filter-dropdown').forEach(dd => {
                dd.classList.remove('open');
                dd.hidden = true;
                // Explicitly override styles to ensure hidden
                dd.style.display = 'none';
                dd.style.visibility = 'hidden';
                dd.style.opacity = '0';
                dd.style.pointerEvents = 'none';
            });
            
            document.querySelectorAll('.th-filter-btn').forEach(btn => {
                btn.setAttribute('aria-expanded', 'false');
                btn.classList.remove('active');
            });
        },

        applyFilters() {
            // Collect active filters
            // Date chips use .th-date-chip class, not .th-filter-item
            const activeDatetime = Array.from(document.querySelectorAll('#th-datetime-dropdown .th-date-chip.active'))
                .map(el => el.getAttribute('data-v'));
            
            const activeLeagues = Array.from(document.querySelectorAll('#th-league-dropdown .th-filter-item.active'))
                .map(el => el.getAttribute('data-v'));
            
            const activeSegments = Array.from(document.querySelectorAll('#th-segment-dropdown .th-filter-item.active'))
                .map(el => el.getAttribute('data-v'));

            const activePickTypes = Array.from(document.querySelectorAll('#th-picktype-dropdown .th-filter-item.active'))
                .map(el => el.getAttribute('data-v'));
            
            const activeStatuses = Array.from(document.querySelectorAll('#th-status-dropdown .th-filter-item.active'))
                .map(el => el.getAttribute('data-v'));
            
            const activeResults = Array.from(document.querySelectorAll('#th-result-dropdown .th-filter-item.active'))
                .map(el => el.getAttribute('data-v'));
            
            const activeRiskRanges = Array.from(document.querySelectorAll('#th-riskwin-dropdown .th-range-btn.active[data-f="risk"]'))
                .map(el => el.getAttribute('data-v'));
            
            const activeWinRanges = Array.from(document.querySelectorAll('#th-riskwin-dropdown .th-range-btn.active[data-f="win"]'))
                .map(el => el.getAttribute('data-v'));
            
            console.log('Filters:', { activeDatetime, activeLeagues, activeSegments, activePickTypes, activeStatuses, activeResults, activeRiskRanges, activeWinRanges });
            
            // Apply to table rows
            this.filterTableRows({ activeDatetime, activeLeagues, activeSegments, activePickTypes, activeStatuses, activeResults, activeRiskRanges, activeWinRanges });
        },

        filterTableRows(filters) {
            const rows = document.querySelectorAll('#picks-table tbody tr');
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
            const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
            
            rows.forEach(row => {
                let show = true;
                
                // Date/Time filter
                if (filters.activeDatetime && filters.activeDatetime.length > 0 && !filters.activeDatetime.includes('all')) {
                    const epoch = parseInt(row.getAttribute('data-epoch'));
                    const rowDate = epoch ? new Date(epoch) : null;
                    
                    if (rowDate) {
                        const matchesDate = filters.activeDatetime.some(dt => {
                            if (dt === 'today') return rowDate >= today;
                            if (dt === 'yesterday') return rowDate >= yesterday && rowDate < today;
                            if (dt === 'week') return rowDate >= weekAgo;
                            if (dt === 'month') return rowDate >= monthAgo;
                            return true;
                        });
                        if (!matchesDate) show = false;
                    }
                }
                
                // League filter
                if (show && filters.activeLeagues.length > 0) {
                    const rowLeague = row.getAttribute('data-league');
                    if (!filters.activeLeagues.some(l => rowLeague === l || rowLeague?.includes(l))) show = false;
                }

                // Segment filter
                if (show && filters.activeSegments.length > 0) {
                    const rowSegment = row.getAttribute('data-segment'); // '1h', '2h', 'full-game'
                    if (!filters.activeSegments.some(s => {
                        if (s === 'full') return rowSegment === 'full-game';
                        return rowSegment === s;
                    })) show = false;
                }
                
                // Pick Type filter
                if (show && filters.activePickTypes.length > 0) {
                    const rowPickType = row.getAttribute('data-pick-type');
                    if (!filters.activePickTypes.some(p => rowPickType === p)) show = false;
                }
                
                // Status filter
                if (show && filters.activeStatuses.length > 0) {
                    const rowStatus = row.getAttribute('data-status'); // 'pending', 'win', 'loss', 'push'
                    if (!filters.activeStatuses.some(s => {
                        if (s === 'won') return rowStatus === 'win';
                        if (s === 'lost') return rowStatus === 'loss';
                        return rowStatus === s;
                    })) show = false;
                }
                
                // Result filter ($ Won/Lost)
                if (show && filters.activeResults && filters.activeResults.length > 0) {
                    const rowResult = row.querySelector('.won-lost-value')?.textContent.trim();
                    const matchesResult = filters.activeResults.some(r => {
                        if (r === 'positive') return rowResult?.startsWith('+');
                        if (r === 'negative') return rowResult?.startsWith('-');
                        if (r === 'zero') return rowResult === '$0' || rowResult === '0';
                        return true;
                    });
                    if (!matchesResult) show = false;
                }

                // Risk filter
                if (show && filters.activeRiskRanges && filters.activeRiskRanges.length > 0) {
                    const riskVal = parseFloat(row.getAttribute('data-risk')) || 0;
                    const matchesRisk = filters.activeRiskRanges.some(range => {
                        if (range === '1000+') {
                            return riskVal >= 1000;
                        }
                        if (range.endsWith('+')) {
                            return riskVal >= parseFloat(range);
                        }
                        const [min, max] = range.split('-').map(Number);
                        return riskVal >= min && riskVal <= max;
                    });
                    if (!matchesRisk) show = false;
                }

                // Win filter
                if (show && filters.activeWinRanges && filters.activeWinRanges.length > 0) {
                    const winVal = parseFloat(row.getAttribute('data-win')) || 0;
                    const matchesWin = filters.activeWinRanges.some(range => {
                        if (range === '1000+') {
                            return winVal >= 1000;
                        }
                        if (range.endsWith('+')) {
                            return winVal >= parseFloat(range);
                        }
                        const [min, max] = range.split('-').map(Number);
                        return winVal >= min && winVal <= max;
                    });
                    if (!matchesWin) show = false;
                }
                
                row.style.display = show ? '' : 'none';
            });

            // Recalculate KPIs based on visible rows only
            this.recalculateKPIsForVisibleRows();
        },

        recalculateKPIsForVisibleRows() {
            // Get only visible rows and calculate KPIs from their data
            const visibleRows = document.querySelectorAll('#picks-table tbody tr:not([style*="display: none"])');

            if (visibleRows.length === 0) {
                // No visible rows - show zeros
                if (typeof window.updateKPITiles === 'function') {
                    window.updateKPITiles({
                        activePicks: 0, activeRisk: 0, toWin: 0,
                        onTrackAmount: 0, atRiskAmount: 0, projected: 0,
                        netProfit: 0, totalWon: 0, totalLost: 0,
                        wins: 0, losses: 0, pushes: 0,
                        roePercentage: 0, winPercentage: 0, currentStreak: 'W0', totalRisk: 0
                    });
                }
                return;
            }

            // Build picks array from visible rows
            const picks = [];
            visibleRows.forEach(row => {
                const status = row.getAttribute('data-status') || 'pending';
                const risk = parseFloat(row.getAttribute('data-risk')) || 0;
                const win = parseFloat(row.getAttribute('data-win')) || 0;
                const league = row.getAttribute('data-league') || '';
                const pickType = row.getAttribute('data-pick-type') || '';
                const segment = row.getAttribute('data-segment') || '';
                const book = row.getAttribute('data-book') || '';

                picks.push({ status, risk, win, league, pickType, segment, book });
            });

            // Calculate and update KPIs
            if (typeof window.calculateKPIs === 'function' && typeof window.updateKPITiles === 'function') {
                const kpis = window.calculateKPIs(picks);
                window.updateKPITiles(kpis);
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DashboardFilters.init());
    } else {
        DashboardFilters.init();
    }

    // Expose for debugging
    window.DashboardFilters = DashboardFilters;

})();
