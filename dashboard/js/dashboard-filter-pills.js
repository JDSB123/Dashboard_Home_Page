/**
 * Dashboard Filter Pills Handler
 * Handles filter pill clicks and updates filter chips display
 * Similar to weekly-lineup filter logic
 */

(function() {
    'use strict';

    let activeFilters = {
        league: '',
        segment: '',
        pick: '',
        status: ''
    };

    /**
     * Initialize filter pill handlers
     */
    function initializeFilterPills() {
        console.log('[DashboardFilterPills] Initializing filter pills...');

        // League filter pills (exclusive selection)
        document.querySelectorAll('.ft-pill.ft-league').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.stopPropagation();
                const leagueValue = this.getAttribute('data-league');
                console.log('[DashboardFilterPills] League pill clicked:', leagueValue);

                // Exclusive selection - remove active from siblings
                document.querySelectorAll('.ft-pill.ft-league').forEach(p => p.classList.remove('active'));
                this.classList.add('active');

                activeFilters.league = leagueValue === 'all' ? '' : leagueValue;
                applyFilters();
                updateFilterChips();
            });
        });

        // Segment filter pills (exclusive selection)
        document.querySelectorAll('.ft-pill.ft-segment').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.stopPropagation();
                const segmentValue = this.getAttribute('data-segment');
                console.log('[DashboardFilterPills] Segment pill clicked:', segmentValue);

                // Exclusive selection
                document.querySelectorAll('.ft-pill.ft-segment').forEach(p => p.classList.remove('active'));
                this.classList.add('active');

                activeFilters.segment = segmentValue === 'all' ? '' : segmentValue;
                applyFilters();
                updateFilterChips();
            });
        });

        // Pick type filter pills (exclusive selection)
        document.querySelectorAll('.ft-pill.ft-pick').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.stopPropagation();
                const pickValue = this.getAttribute('data-pick');
                console.log('[DashboardFilterPills] Pick type pill clicked:', pickValue);

                // Exclusive selection
                document.querySelectorAll('.ft-pill.ft-pick').forEach(p => p.classList.remove('active'));
                this.classList.add('active');

                activeFilters.pick = pickValue === 'all' ? '' : pickValue;
                applyFilters();
                updateFilterChips();
            });
        });

        // Status filter pills (exclusive selection)
        document.querySelectorAll('.ft-pill.ft-status').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.stopPropagation();
                const statusValue = this.getAttribute('data-status');
                console.log('[DashboardFilterPills] Status pill clicked:', statusValue);

                // Exclusive selection
                document.querySelectorAll('.ft-pill.ft-status').forEach(p => p.classList.remove('active'));
                this.classList.add('active');

                activeFilters.status = statusValue === 'all' ? '' : statusValue;
                applyFilters();
                updateFilterChips();
            });
        });

        // Clear button
        const clearBtn = document.getElementById('ft-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DashboardFilterPills] Clear filters clicked');
                clearAllFilters();
            });
        }

        console.log('[DashboardFilterPills] Filter pills initialized');
    }

    /**
     * Apply filters to table rows
     */
    function applyFilters() {
        const rows = document.querySelectorAll('#picks-table tbody tr');
        let visibleCount = 0;

        rows.forEach(row => {
            let shouldShow = true;

            // League filter
            if (activeFilters.league) {
                const rowLeague = row.getAttribute('data-league') || '';
                if (rowLeague.toLowerCase() !== activeFilters.league.toLowerCase()) {
                    shouldShow = false;
                }
            }

            // Segment filter
            if (activeFilters.segment) {
                const rowSegment = row.getAttribute('data-segment') || '';
                if (rowSegment.toLowerCase() !== activeFilters.segment.toLowerCase()) {
                    shouldShow = false;
                }
            }

            // Pick type filter
            if (activeFilters.pick) {
                const rowPickType = row.getAttribute('data-pick-type') || '';
                if (rowPickType.toLowerCase() !== activeFilters.pick.toLowerCase()) {
                    shouldShow = false;
                }
            }

            // Status filter
            if (activeFilters.status) {
                const rowStatus = row.getAttribute('data-status') || '';
                if (rowStatus.toLowerCase() !== activeFilters.status.toLowerCase()) {
                    shouldShow = false;
                }
            }

            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        console.log(`[DashboardFilterPills] Applied filters - ${visibleCount} rows visible`);

        // Update KPIs if function exists
        if (typeof window.updateKPIValues === 'function') {
            window.updateKPIValues();
        } else if (typeof window.recalculateKPIs === 'function') {
            window.recalculateKPIs();
        }

        // Update table with filters if function exists
        if (typeof window.updateTableWithFilters === 'function') {
            window.updateTableWithFilters();
        }
    }

    /**
     * Update filter chips display
     */
    function updateFilterChips() {
        const chipsContainer = document.getElementById('table-filter-chips');
        if (!chipsContainer) return;

        const chips = [];
        
        if (activeFilters.league) {
            const leagueLabel = activeFilters.league.toUpperCase();
            chips.push({ type: 'league', value: activeFilters.league, label: `League: ${leagueLabel}` });
        }
        
        if (activeFilters.segment) {
            const segmentLabels = {
                'full': 'Full Game',
                '1h': '1st Half',
                '2h': '2nd Half'
            };
            chips.push({ type: 'segment', value: activeFilters.segment, label: `Segment: ${segmentLabels[activeFilters.segment] || activeFilters.segment}` });
        }
        
        if (activeFilters.pick) {
            const pickLabels = {
                'spread': 'Spread',
                'ml': 'Moneyline',
                'total': 'Total',
                'tt': 'Team Total'
            };
            chips.push({ type: 'pick', value: activeFilters.pick, label: `Pick: ${pickLabels[activeFilters.pick] || activeFilters.pick}` });
        }
        
        if (activeFilters.status) {
            const statusLabels = {
                'pending': 'Pending',
                'win': 'Won',
                'loss': 'Lost',
                'push': 'Push'
            };
            chips.push({ type: 'status', value: activeFilters.status, label: `Status: ${statusLabels[activeFilters.status] || activeFilters.status}` });
        }

        if (chips.length === 0) {
            chipsContainer.setAttribute('data-has-chips', 'false');
            chipsContainer.innerHTML = '';
            return;
        }

        chipsContainer.setAttribute('data-has-chips', 'true');
        chipsContainer.innerHTML = chips.map(chip => `
            <div class="filter-chip" data-filter-type="${chip.type}" data-filter-value="${chip.value}">
                <span>${chip.label}</span>
                <span class="chip-remove" data-filter-type="${chip.type}" data-filter-value="${chip.value}">×</span>
            </div>
        `).join('');

        // Add remove handlers to chips
        chipsContainer.querySelectorAll('.chip-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const filterType = this.getAttribute('data-filter-type');
                const filterValue = this.getAttribute('data-filter-value');
                removeFilter(filterType, filterValue);
            });
        });
    }

    /**
     * Remove a specific filter
     */
    function removeFilter(type, value) {
        console.log('[DashboardFilterPills] Removing filter:', type, value);
        
        activeFilters[type] = '';
        
        // Reset pill to "all"
        const allPill = document.querySelector(`.ft-pill.ft-${type}[data-${type}="all"]`);
        if (allPill) {
            document.querySelectorAll(`.ft-pill.ft-${type}`).forEach(p => p.classList.remove('active'));
            allPill.classList.add('active');
        }
        
        applyFilters();
        updateFilterChips();
    }

    /**
     * Clear all filters
     */
    function clearAllFilters() {
        activeFilters = {
            league: '',
            segment: '',
            pick: '',
            status: ''
        };

        // Reset all pills to "all"
        document.querySelectorAll('.ft-pill').forEach(pill => {
            pill.classList.remove('active');
            if (pill.getAttribute('data-league') === 'all' ||
                pill.getAttribute('data-segment') === 'all' ||
                pill.getAttribute('data-pick') === 'all' ||
                pill.getAttribute('data-status') === 'all') {
                pill.classList.add('active');
            }
        });

        applyFilters();
        updateFilterChips();
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFilterPills);
    } else {
        initializeFilterPills();
    }

    // Export for external access
    window.DashboardFilterPills = {
        applyFilters,
        clearAllFilters,
        removeFilter,
        updateFilterChips
    };

})();

