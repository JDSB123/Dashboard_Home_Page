/**
 * Dashboard Initialization Script
 * Handles dashboard-specific interactions like KPI tile flipping and refresh logic.
 */

(function() {
    'use strict';

    const DashboardInit = {
        init() {
            console.log('Initializing Dashboard UI...');
            this.initKPITiles();
            this.initRefreshButton();
            this.initBackToTop();
        },

        /**
         * Initialize KPI Tile Flip Interaction
         */
        initKPITiles() {
            const tiles = document.querySelectorAll('.kpi-tile[data-action="flip-tile"]');
            
            tiles.forEach(tile => {
                // Click handler
                tile.addEventListener('click', () => {
                    this.flipTile(tile);
                });

                // Keyboard handler (Enter/Space)
                tile.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.flipTile(tile);
                    }
                });
            });
        },

        /**
         * Flip a KPI tile to show the other side
         */
        flipTile(tile) {
            const layers = tile.querySelectorAll('.kpi-tile-layer');
            if (layers.length < 2) return;

            layers.forEach(layer => {
                layer.classList.toggle('active');
            });
        },

        /**
         * Initialize Refresh Button
         */
        initRefreshButton() {
            const refreshBtn = document.querySelector('.refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.handleRefresh(refreshBtn);
                });
            }
        },

        /**
         * Handle Dashboard Refresh
         */
        async handleRefresh(btn) {
            // Add spinning animation
            btn.classList.add('spinning');
            btn.disabled = true;
            
            try {
                // Refresh current table state first.
                if (window.LocalPicksManager && typeof window.LocalPicksManager.refresh === 'function') {
                    window.LocalPicksManager.refresh();
                }

                // Re-enrich picks with latest game data (scores/status/box score details).
                if (window.LocalPicksManager && typeof window.LocalPicksManager.reEnrich === 'function') {
                    await window.LocalPicksManager.reEnrich();
                } else if (typeof window.loadLivePicks === 'function') {
                    await window.loadLivePicks();
                } else if (window.ActivePicks && typeof window.ActivePicks.refreshData === 'function') {
                    window.ActivePicks.refreshData();
                }
            } catch (error) {
                console.error('Dashboard refresh failed:', error);
            }

            // Remove class after timeout to preserve visual feedback.
            setTimeout(() => {
                btn.classList.remove('spinning');
                btn.disabled = false;
            }, 700);
        },

        /**
         * Initialize Back to Top Button
         */
        initBackToTop() {
            const backToTopBtn = document.getElementById('back-to-top');
            if (!backToTopBtn) return;

            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    backToTopBtn.classList.add('visible');
                } else {
                    backToTopBtn.classList.remove('visible');
                }
            });

            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DashboardInit.init());
    } else {
        DashboardInit.init();
    }

})();
