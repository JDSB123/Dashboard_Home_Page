/**
 * Weekly Lineup Mobile Experience
 * Complete mobile handling for weekly-lineup page
 */

(function() {
    'use strict';

    const WeeklyLineupMobile = {
        isMobile: false,
        
        init() {
            this.isMobile = window.innerWidth <= 767;
            if (!this.isMobile) return;
            
            console.log('[Weekly Mobile] Initializing mobile experience');
            
            // Only run on weekly-lineup page
            if (!document.body.classList.contains('page-weekly-lineup')) return;
            
            this.setupMobileUI();
            this.setupInteractions();
            this.optimizePerformance();
        },

        setupMobileUI() {
            // Add mobile class for CSS targeting
            document.body.classList.add('is-mobile');
            
            // Create floating action button
            this.createFAB();
            
            // Create bottom navigation
            this.createBottomNav();
            
            // Add data labels to table cells for card view
            this.addDataLabels();
            
            // Add status data attributes to rows
            this.addStatusAttributes();
        },

        createFAB() {
            const fab = document.createElement('button');
            fab.className = 'mobile-fab';
            fab.innerHTML = '↻';
            fab.setAttribute('aria-label', 'Refresh picks');
            
            fab.addEventListener('click', () => {
                fab.classList.add('rotating');
                this.refreshData(() => {
                    fab.classList.remove('rotating');
                });
            });
            
            document.body.appendChild(fab);
        },

        createBottomNav() {
            const nav = document.createElement('nav');
            nav.className = 'mobile-bottom-nav';
            nav.innerHTML = `
                <a href="dashboard.html" class="mobile-nav-item">
                    <span>📊</span>
                    <span>Dashboard</span>
                </a>
                <a href="weekly-lineup.html" class="mobile-nav-item active">
                    <span>📋</span>
                    <span>Lineup</span>
                </a>
                <a href="odds-market.html" class="mobile-nav-item">
                    <span>💰</span>
                    <span>Odds</span>
                </a>
                <div class="mobile-nav-item" data-action="filter">
                    <span>⚙</span>
                    <span>Filter</span>
                </div>
            `;
            
            document.body.appendChild(nav);
            
            // Handle filter click
            nav.querySelector('[data-action="filter"]').addEventListener('click', () => {
                this.toggleFilterPanel();
            });
        },

        addDataLabels() {
            const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const labels = ['Status', 'League', 'Teams', 'Time', 'Pick', 'Odds', 'Book', 'Amount', 'Payout', 'Result'];
                
                cells.forEach((cell, index) => {
                    if (labels[index]) {
                        cell.setAttribute('data-label', labels[index]);
                    }
                });
            });
        },

        addStatusAttributes() {
            const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
            rows.forEach(row => {
                // Try to determine status from status cell or class
                const statusCell = row.querySelector('td:nth-child(10)');
                if (statusCell) {
                    const statusText = statusCell.textContent.toLowerCase().trim();
                    if (statusText.includes('won')) {
                        row.setAttribute('data-status', 'won');
                    } else if (statusText.includes('lost')) {
                        row.setAttribute('data-status', 'lost');
                    } else if (statusText.includes('live') || statusText.includes('on track')) {
                        row.setAttribute('data-status', 'live');
                    } else if (statusText.includes('pending')) {
                        row.setAttribute('data-status', 'pending');
                    }
                }
            });
        },

        setupInteractions() {
            // Add swipe to reveal actions on cards
            const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
            rows.forEach(row => {
                let startX = 0;
                let currentX = 0;
                let isDragging = false;
                
                row.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    isDragging = true;
                }, { passive: true });
                
                row.addEventListener('touchmove', (e) => {
                    if (!isDragging) return;
                    currentX = e.touches[0].clientX;
                    const diff = currentX - startX;
                    
                    if (Math.abs(diff) > 10) {
                        e.preventDefault();
                        row.style.transform = `translateX(${diff}px)`;
                    }
                }, { passive: false });
                
                row.addEventListener('touchend', () => {
                    isDragging = false;
                    const diff = currentX - startX;
                    
                    if (Math.abs(diff) > 100) {
                        // Swipe action threshold
                        row.style.transform = '';
                        // Could trigger an action here
                    } else {
                        row.style.transform = '';
                    }
                });
            });
            
            // Pull to refresh
            this.setupPullToRefresh();
        },

        setupPullToRefresh() {
            let startY = 0;
            let pullDistance = 0;
            const threshold = 100;
            
            document.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].clientY;
                }
            }, { passive: true });
            
            document.addEventListener('touchmove', (e) => {
                if (startY > 0) {
                    pullDistance = e.touches[0].clientY - startY;
                    if (pullDistance > 0 && window.scrollY === 0) {
                        e.preventDefault();
                        document.body.style.transform = `translateY(${Math.min(pullDistance / 2, 80)}px)`;
                    }
                }
            }, { passive: false });
            
            document.addEventListener('touchend', () => {
                if (pullDistance > threshold) {
                    this.refreshData();
                }
                document.body.style.transform = '';
                startY = 0;
                pullDistance = 0;
            });
        },

        toggleFilterPanel() {
            // Create filter panel if it doesn't exist
            let panel = document.querySelector('.mobile-filter-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'mobile-filter-panel';
                panel.innerHTML = `
                    <div class="filter-header">
                        <h3>Filters</h3>
                        <button class="close-btn">✕</button>
                    </div>
                    <div class="filter-options">
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="pending">Pending</button>
                        <button class="filter-btn" data-filter="live">Live</button>
                        <button class="filter-btn" data-filter="won">Won</button>
                        <button class="filter-btn" data-filter="lost">Lost</button>
                    </div>
                `;
                document.body.appendChild(panel);
                
                // Setup filter buttons
                panel.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        panel.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        this.applyFilter(e.target.dataset.filter);
                    });
                });
                
                // Close button
                panel.querySelector('.close-btn').addEventListener('click', () => {
                    panel.classList.remove('active');
                });
            }
            
            panel.classList.toggle('active');
        },

        applyFilter(filter) {
            const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
            rows.forEach(row => {
                if (filter === 'all') {
                    row.style.display = '';
                } else {
                    const status = row.getAttribute('data-status');
                    row.style.display = status === filter ? '' : 'none';
                }
            });
        },

        refreshData(callback) {
            console.log('[Weekly Mobile] Refreshing data...');
            
            // Try to use existing refresh mechanisms
            if (window.ActivePicks?.refreshData) {
                window.ActivePicks.refreshData();
            } else if (window.location.reload) {
                window.location.reload();
            }
            
            // Simulate completion
            setTimeout(() => {
                if (callback) callback();
            }, 2000);
        },

        optimizePerformance() {
            // Use passive event listeners where possible
            const passiveSupported = this.checkPassiveSupport();
            const passiveOptions = passiveSupported ? { passive: true } : false;
            
            // Throttle scroll events
            let scrollTimeout;
            window.addEventListener('scroll', () => {
                if (scrollTimeout) return;
                scrollTimeout = setTimeout(() => {
                    scrollTimeout = null;
                    // Handle scroll
                }, 100);
            }, passiveOptions);
            
            // Add will-change to animated elements
            document.querySelectorAll('.weekly-lineup-table tbody tr').forEach(row => {
                row.style.willChange = 'transform';
            });
            
            // Intersection observer for lazy loading
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('visible');
                        }
                    });
                }, { rootMargin: '50px' });
                
                document.querySelectorAll('.weekly-lineup-table tbody tr').forEach(row => {
                    observer.observe(row);
                });
            }
        },

        checkPassiveSupport() {
            let supportsPassive = false;
            try {
                const opts = Object.defineProperty({}, 'passive', {
                    get: function() {
                        supportsPassive = true;
                    }
                });
                window.addEventListener('testPassive', null, opts);
                window.removeEventListener('testPassive', null, opts);
            } catch (e) {}
            return supportsPassive;
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => WeeklyLineupMobile.init());
    } else {
        WeeklyLineupMobile.init();
    }

    // Reinitialize on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const wasMobile = WeeklyLineupMobile.isMobile;
            const isMobile = window.innerWidth <= 767;
            
            if (wasMobile !== isMobile) {
                if (isMobile) {
                    WeeklyLineupMobile.init();
                } else {
                    // Clean up mobile UI
                    document.body.classList.remove('is-mobile');
                    document.querySelector('.mobile-fab')?.remove();
                    document.querySelector('.mobile-bottom-nav')?.remove();
                }
            }
        }, 250);
    });

    // Export for debugging
    window.WeeklyLineupMobile = WeeklyLineupMobile;

})();