/**
 * Mobile UI Simplification
 * Reduces button overcrowding with smart consolidation
 */

(function() {
    'use strict';

    const MobileUISimplify = {
        init() {
            if (window.innerWidth > 767) return;
            
            console.log('[Mobile UI] Simplifying interface...');
            
            this.createMobileControls();
            this.hideDesktopControls();
            this.setupMobileInteractions();
            this.createBottomBar();
        },

        /**
         * Hide all desktop controls that crowd mobile
         */
        hideDesktopControls() {
            // Hide overcrowded elements
            const elementsToHide = [
                '.filter-toolbar',
                '.date-toggle-group',
                '.export-import-controls',
                '.nav-actions',
                '.sportsbook-dropdown',
                '.dashboard-topline',
                '.brand-header-inline',
                '.ft-fetch-buttons',
                '.segment-filters'
            ];
            
            elementsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    el.style.display = 'none';
                });
            });
        },

        /**
         * Create simplified mobile controls
         */
        createMobileControls() {
            // Create floating filter button
            const filterBtn = document.createElement('button');
            filterBtn.className = 'mobile-filter-toggle';
            filterBtn.setAttribute('aria-label', 'Filters');
            document.body.appendChild(filterBtn);

            // Create filter panel
            const filterPanel = document.createElement('div');
            filterPanel.className = 'mobile-filter-panel';
            filterPanel.innerHTML = `
                <div class="mobile-filter-header">
                    <h3>Filters</h3>
                    <button class="close-filter-btn">✕</button>
                </div>
                <div class="mobile-filter-options">
                    <button class="mobile-filter-option active" data-filter="all">All Picks</button>
                    <button class="mobile-filter-option" data-filter="pending">Pending</button>
                    <button class="mobile-filter-option" data-filter="live">Live</button>
                    <button class="mobile-filter-option" data-filter="won">Won</button>
                    <button class="mobile-filter-option" data-filter="lost">Lost</button>
                </div>
                <div class="mobile-filter-section">
                    <label>League</label>
                    <select class="mobile-status-dropdown">
                        <option value="all">All Leagues</option>
                        <option value="nba">NBA</option>
                        <option value="nfl">NFL</option>
                        <option value="ncaam">NCAAM</option>
                        <option value="ncaaf">NCAAF</option>
                    </select>
                </div>
            `;
            document.body.appendChild(filterPanel);

            // Create simple date selector
            const dateSelector = document.createElement('div');
            dateSelector.className = 'mobile-date-selector';
            dateSelector.innerHTML = `
                <button class="mobile-date-btn active" data-date="today">Today</button>
                <button class="mobile-date-btn" data-date="tomorrow">Tomorrow</button>
                <button class="mobile-date-btn" data-date="week">This Week</button>
            `;
            
            // Insert after nav
            const nav = document.querySelector('.brand-nav');
            if (nav) {
                nav.insertAdjacentElement('afterend', dateSelector);
            }

            // Add refresh button to header
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'mobile-refresh-btn';
            refreshBtn.setAttribute('aria-label', 'Refresh');
            if (nav) {
                nav.appendChild(refreshBtn);
            }
        },

        /**
         * Create bottom quick access bar
         */
        createBottomBar() {
            const bottomBar = document.createElement('div');
            bottomBar.className = 'mobile-quick-bar';
            bottomBar.innerHTML = `
                <div class="mobile-quick-item home active" data-action="home">
                    <span>Home</span>
                </div>
                <div class="mobile-quick-item filter" data-action="filter">
                    <span>Filter</span>
                </div>
                <div class="mobile-quick-item refresh" data-action="refresh">
                    <span>Refresh</span>
                </div>
                <div class="mobile-quick-item stats" data-action="stats">
                    <span>Stats</span>
                </div>
            `;
            document.body.appendChild(bottomBar);
        },

        /**
         * Setup mobile interactions
         */
        setupMobileInteractions() {
            // Filter button toggle
            const filterBtn = document.querySelector('.mobile-filter-toggle');
            const filterPanel = document.querySelector('.mobile-filter-panel');
            const closeBtn = document.querySelector('.close-filter-btn');
            
            if (filterBtn && filterPanel) {
                filterBtn.addEventListener('click', () => {
                    filterPanel.classList.toggle('active');
                    this.createOverlay();
                });
                
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        filterPanel.classList.remove('active');
                        this.removeOverlay();
                    });
                }
            }

            // Filter options
            const filterOptions = document.querySelectorAll('.mobile-filter-option');
            filterOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    filterOptions.forEach(opt => opt.classList.remove('active'));
                    e.target.classList.add('active');
                    this.applyFilter(e.target.dataset.filter);
                });
            });

            // Date buttons
            const dateBtns = document.querySelectorAll('.mobile-date-btn');
            dateBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    dateBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.applyDateFilter(e.target.dataset.date);
                });
            });

            // Refresh button
            const refreshBtn = document.querySelector('.mobile-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    refreshBtn.classList.add('loading');
                    this.refreshData(() => {
                        refreshBtn.classList.remove('loading');
                    });
                });
            }

            // Bottom bar actions
            const bottomItems = document.querySelectorAll('.mobile-quick-item');
            bottomItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    bottomItems.forEach(i => i.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.handleQuickAction(e.currentTarget.dataset.action);
                });
            });
        },

        /**
         * Create overlay for panels
         */
        createOverlay() {
            let overlay = document.querySelector('.mobile-panel-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'mobile-panel-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 599;
                `;
                document.body.appendChild(overlay);
                
                overlay.addEventListener('click', () => {
                    document.querySelector('.mobile-filter-panel')?.classList.remove('active');
                    this.removeOverlay();
                });
            }
        },

        /**
         * Remove overlay
         */
        removeOverlay() {
            const overlay = document.querySelector('.mobile-panel-overlay');
            if (overlay) {
                overlay.remove();
            }
        },

        /**
         * Apply filter
         */
        applyFilter(filter) {
            const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
            rows.forEach(row => {
                if (filter === 'all') {
                    row.style.display = '';
                } else {
                    const status = row.getAttribute('data-status');
                    if (status === filter || (filter === 'live' && (status === 'on-track' || status === 'at-risk'))) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        },

        /**
         * Apply date filter
         */
        applyDateFilter(dateFilter) {
            console.log('Applying date filter:', dateFilter);
            // Implement date filtering logic
            // This would filter picks based on the selected date range
        },

        /**
         * Refresh data
         */
        refreshData(callback) {
            // Trigger data refresh
            if (window.ActivePicks?.refreshData) {
                window.ActivePicks.refreshData();
            } else if (window.UnifiedPicksFetcher?.fetchAllPicks) {
                window.UnifiedPicksFetcher.fetchAllPicks();
            }
            
            // Simulate refresh completion
            setTimeout(() => {
                if (callback) callback();
            }, 2000);
        },

        /**
         * Handle quick bar actions
         */
        handleQuickAction(action) {
            switch(action) {
                case 'home':
                    window.scrollTo(0, 0);
                    break;
                case 'filter':
                    document.querySelector('.mobile-filter-toggle')?.click();
                    break;
                case 'refresh':
                    document.querySelector('.mobile-refresh-btn')?.click();
                    break;
                case 'stats':
                    // Toggle KPI section
                    const kpiSection = document.querySelector('.kpi-section');
                    if (kpiSection) {
                        kpiSection.classList.toggle('collapsed');
                    }
                    break;
            }
        },

        /**
         * Make KPI section collapsible
         */
        setupCollapsibleKPIs() {
            const kpiTiles = document.querySelector('.kpi-tiles');
            if (kpiTiles && !document.querySelector('.kpi-section')) {
                const section = document.createElement('div');
                section.className = 'kpi-section collapsed';
                
                const header = document.createElement('div');
                header.className = 'kpi-header';
                header.innerHTML = '<span>Statistics</span>';
                
                header.addEventListener('click', () => {
                    section.classList.toggle('collapsed');
                });
                
                kpiTiles.parentNode.insertBefore(section, kpiTiles);
                section.appendChild(header);
                section.appendChild(kpiTiles);
            }
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MobileUISimplify.init());
    } else {
        MobileUISimplify.init();
    }

    // Reinit on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth <= 767) {
                MobileUISimplify.init();
            }
        }, 250);
    });

    // Export
    window.MobileUISimplify = MobileUISimplify;

})();