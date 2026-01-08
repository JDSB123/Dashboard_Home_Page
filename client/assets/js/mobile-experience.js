/**
 * Mobile Experience Enhancement Script
 * Handles mobile-specific interactions and optimizations
 */

(function() {
    'use strict';

    const MobileExperience = {
        // Configuration
        config: {
            mobileBreakpoint: 767,
            tabletBreakpoint: 1024,
            swipeThreshold: 50,
            tapDelay: 300
        },

        // State
        state: {
            isMenuOpen: false,
            currentFilter: 'all',
            touchStartX: 0,
            touchStartY: 0,
            isScrolling: false
        },

        /**
         * Initialize mobile experience
         */
        init() {
            if (!this.isMobile()) return;

            console.log('[Mobile] Initializing mobile experience...');
            
            this.setupNavigation();
            this.setupSwipeGestures();
            this.setupFilterBar();
            this.setupCardInteractions();
            this.setupScrollOptimizations();
            this.setupPullToRefresh();
            this.detectDevice();
            this.optimizePerformance();

            // Add mobile class to body
            document.body.classList.add('is-mobile');
            
            // Detect touch device
            if ('ontouchstart' in window) {
                document.body.classList.add('touch-device');
            }
        },

        /**
         * Check if device is mobile
         */
        isMobile() {
            return window.innerWidth <= this.config.mobileBreakpoint ||
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        /**
         * Setup mobile navigation
         */
        setupNavigation() {
            // Create hamburger menu if it doesn't exist
            let menuToggle = document.querySelector('.mobile-nav-toggle');
            if (!menuToggle) {
                const nav = document.querySelector('.brand-nav');
                if (nav) {
                    menuToggle = document.createElement('button');
                    menuToggle.className = 'mobile-nav-toggle';
                    menuToggle.setAttribute('aria-label', 'Menu');
                    menuToggle.innerHTML = '<span></span>';
                    nav.insertBefore(menuToggle, nav.firstChild);
                }
            }

            // Create overlay if it doesn't exist
            let overlay = document.querySelector('.nav-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'nav-overlay';
                document.body.appendChild(overlay);
            }

            // Handle menu toggle
            if (menuToggle) {
                menuToggle.addEventListener('click', () => this.toggleMenu());
            }

            // Handle overlay click
            if (overlay) {
                overlay.addEventListener('click', () => this.closeMenu());
            }

            // Handle menu links
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (this.state.isMenuOpen) {
                        this.closeMenu();
                    }
                });
            });

            // Prevent body scroll when menu is open
            this.preventBodyScroll();
        },

        /**
         * Toggle mobile menu
         */
        toggleMenu() {
            this.state.isMenuOpen = !this.state.isMenuOpen;
            const navLinks = document.querySelector('.nav-links');
            const overlay = document.querySelector('.nav-overlay');
            const toggle = document.querySelector('.mobile-nav-toggle');

            if (this.state.isMenuOpen) {
                navLinks?.classList.add('active');
                overlay?.classList.add('active');
                toggle?.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                navLinks?.classList.remove('active');
                overlay?.classList.remove('active');
                toggle?.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        /**
         * Close mobile menu
         */
        closeMenu() {
            this.state.isMenuOpen = false;
            document.querySelector('.nav-links')?.classList.remove('active');
            document.querySelector('.nav-overlay')?.classList.remove('active');
            document.querySelector('.mobile-nav-toggle')?.classList.remove('active');
            document.body.style.overflow = '';
        },

        /**
         * Setup swipe gestures
         */
        setupSwipeGestures() {
            let touchStartX = 0;
            let touchEndX = 0;

            // Swipe to open menu from left edge
            document.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                
                // Only track if starting from left edge
                if (touchStartX < 20) {
                    this.state.touchStartX = touchStartX;
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (this.state.touchStartX < 20) {
                    touchEndX = e.changedTouches[0].screenX;
                    
                    // Swipe right to open menu
                    if (touchEndX - this.state.touchStartX > this.config.swipeThreshold) {
                        this.toggleMenu();
                    }
                }
                
                // Reset
                this.state.touchStartX = 0;
            }, { passive: true });

            // Swipe on nav to close
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                let navTouchStart = 0;
                
                navLinks.addEventListener('touchstart', (e) => {
                    navTouchStart = e.changedTouches[0].screenX;
                }, { passive: true });

                navLinks.addEventListener('touchend', (e) => {
                    const navTouchEnd = e.changedTouches[0].screenX;
                    
                    // Swipe left to close menu
                    if (navTouchStart - navTouchEnd > this.config.swipeThreshold) {
                        this.closeMenu();
                    }
                }, { passive: true });
            }
        },

        /**
         * Setup filter bar interactions
         */
        setupFilterBar() {
            const filterToolbar = document.querySelector('.filter-toolbar');
            if (!filterToolbar) return;

            // Add momentum scrolling
            filterToolbar.style.scrollSnapType = 'x mandatory';
            
            const filterPills = filterToolbar.querySelectorAll('.ft-pill');
            filterPills.forEach(pill => {
                pill.style.scrollSnapAlign = 'center';
                
                // Improve touch feedback
                pill.addEventListener('touchstart', () => {
                    pill.style.transform = 'scale(0.95)';
                }, { passive: true });
                
                pill.addEventListener('touchend', () => {
                    setTimeout(() => {
                        pill.style.transform = '';
                    }, 100);
                }, { passive: true });
            });

            // Show scroll indicators
            this.addScrollIndicators(filterToolbar);
        },

        /**
         * Setup card interactions
         */
        setupCardInteractions() {
            const cards = document.querySelectorAll('.weekly-lineup-table tbody tr');
            
            cards.forEach(card => {
                // Add touch feedback
                card.addEventListener('touchstart', () => {
                    card.style.transform = 'scale(0.98)';
                    card.style.opacity = '0.95';
                }, { passive: true });
                
                card.addEventListener('touchend', () => {
                    setTimeout(() => {
                        card.style.transform = '';
                        card.style.opacity = '';
                    }, 150);
                }, { passive: true });

                // Swipe to reveal actions (optional)
                this.setupCardSwipeActions(card);
            });
        },

        /**
         * Setup swipe actions on cards
         */
        setupCardSwipeActions(card) {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;

            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isDragging = true;
            }, { passive: true });

            card.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                currentX = e.touches[0].clientX;
                const diffX = currentX - startX;
                
                // Only allow left swipe
                if (diffX < 0 && diffX > -100) {
                    card.style.transform = `translateX(${diffX}px)`;
                }
            }, { passive: true });

            card.addEventListener('touchend', () => {
                isDragging = false;
                const diffX = currentX - startX;
                
                if (diffX < -50) {
                    // Show actions
                    card.style.transform = 'translateX(-80px)';
                    card.classList.add('actions-visible');
                } else {
                    // Reset
                    card.style.transform = '';
                    card.classList.remove('actions-visible');
                }
            }, { passive: true });
        },

        /**
         * Setup scroll optimizations
         */
        setupScrollOptimizations() {
            // Add momentum scrolling to containers
            const scrollContainers = document.querySelectorAll('.table-container, .picks-container');
            
            scrollContainers.forEach(container => {
                container.style.webkitOverflowScrolling = 'touch';
                container.style.scrollBehavior = 'smooth';
                
                // Add scroll indicators
                this.addScrollIndicators(container);
                
                // Lazy load images
                this.setupLazyLoading(container);
            });

            // Debounce scroll events
            let scrollTimer;
            window.addEventListener('scroll', () => {
                if (scrollTimer) clearTimeout(scrollTimer);
                
                document.body.classList.add('is-scrolling');
                
                scrollTimer = setTimeout(() => {
                    document.body.classList.remove('is-scrolling');
                }, 150);
            }, { passive: true });
        },

        /**
         * Add scroll indicators to container
         */
        addScrollIndicators(container) {
            container.addEventListener('scroll', () => {
                const maxScroll = container.scrollWidth - container.clientWidth;
                const currentScroll = container.scrollLeft;
                
                if (currentScroll > 10) {
                    container.classList.add('scroll-left');
                } else {
                    container.classList.remove('scroll-left');
                }
                
                if (currentScroll < maxScroll - 10) {
                    container.classList.add('scroll-right');
                } else {
                    container.classList.remove('scroll-right');
                }
            }, { passive: true });

            // Initial check
            container.dispatchEvent(new Event('scroll'));
        },

        /**
         * Setup lazy loading for images
         */
        setupLazyLoading(container) {
            if ('IntersectionObserver' in window) {
                const images = container.querySelectorAll('img[loading="lazy"]');
                
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.removeAttribute('data-src');
                            }
                            imageObserver.unobserve(img);
                        }
                    });
                }, {
                    rootMargin: '50px'
                });

                images.forEach(img => imageObserver.observe(img));
            }
        },

        /**
         * Setup pull to refresh
         */
        setupPullToRefresh() {
            let startY = 0;
            let pullDistance = 0;
            let isPulling = false;
            const threshold = 100;

            // Create refresh indicator
            const refreshIndicator = document.createElement('div');
            refreshIndicator.className = 'pull-to-refresh-indicator';
            refreshIndicator.innerHTML = '<span>↓ Pull to refresh</span>';
            document.body.appendChild(refreshIndicator);

            document.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].clientY;
                    isPulling = true;
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!isPulling) return;
                
                pullDistance = e.touches[0].clientY - startY;
                
                if (pullDistance > 0 && pullDistance < threshold * 2) {
                    refreshIndicator.style.transform = `translateY(${pullDistance}px)`;
                    refreshIndicator.style.opacity = pullDistance / threshold;
                    
                    if (pullDistance > threshold) {
                        refreshIndicator.innerHTML = '<span>↑ Release to refresh</span>';
                    } else {
                        refreshIndicator.innerHTML = '<span>↓ Pull to refresh</span>';
                    }
                }
            }, { passive: true });

            document.addEventListener('touchend', () => {
                if (isPulling && pullDistance > threshold) {
                    // Trigger refresh
                    refreshIndicator.innerHTML = '<span>⟳ Refreshing...</span>';
                    
                    // Call refresh function
                    if (window.ActivePicks?.refreshData) {
                        window.ActivePicks.refreshData();
                    } else {
                        location.reload();
                    }
                }
                
                // Reset
                isPulling = false;
                pullDistance = 0;
                refreshIndicator.style.transform = '';
                refreshIndicator.style.opacity = '0';
            }, { passive: true });
        },

        /**
         * Prevent body scroll when menu is open
         */
        preventBodyScroll() {
            let scrollPosition = 0;

            document.addEventListener('touchstart', (e) => {
                if (this.state.isMenuOpen) {
                    scrollPosition = window.scrollY;
                    document.body.style.position = 'fixed';
                    document.body.style.top = `-${scrollPosition}px`;
                    document.body.style.width = '100%';
                }
            }, { passive: true });

            document.addEventListener('touchend', () => {
                if (!this.state.isMenuOpen && document.body.style.position === 'fixed') {
                    document.body.style.position = '';
                    document.body.style.top = '';
                    document.body.style.width = '';
                    window.scrollTo(0, scrollPosition);
                }
            }, { passive: true });
        },

        /**
         * Detect device capabilities
         */
        detectDevice() {
            // Detect iOS
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                document.body.classList.add('ios-device');
            }

            // Detect Android
            if (/Android/.test(navigator.userAgent)) {
                document.body.classList.add('android-device');
            }

            // Detect notch (iPhone X+)
            if (window.CSS && CSS.supports('padding: env(safe-area-inset-top)')) {
                document.body.classList.add('has-notch');
            }

            // Detect standalone mode (PWA)
            if (window.matchMedia('(display-mode: standalone)').matches) {
                document.body.classList.add('standalone-mode');
            }
        },

        /**
         * Optimize performance for mobile
         */
        optimizePerformance() {
            // Reduce animation complexity on low-end devices
            if (this.isLowEndDevice()) {
                document.body.classList.add('reduce-motion');
                
                // Disable complex animations
                const style = document.createElement('style');
                style.textContent = `
                    .reduce-motion * {
                        animation-duration: 0.1s !important;
                        transition-duration: 0.1s !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // Use passive event listeners
            const passiveSupported = this.checkPassiveSupport();
            if (passiveSupported) {
                window.addEventListener('touchstart', () => {}, { passive: true });
                window.addEventListener('touchmove', () => {}, { passive: true });
            }

            // Defer non-critical resources
            this.deferNonCriticalResources();
        },

        /**
         * Check if device is low-end
         */
        isLowEndDevice() {
            // Check for low RAM
            if (navigator.deviceMemory && navigator.deviceMemory < 4) {
                return true;
            }

            // Check for slow connection
            if (navigator.connection) {
                const connection = navigator.connection;
                if (connection.saveData || connection.effectiveType === 'slow-2g' || 
                    connection.effectiveType === '2g') {
                    return true;
                }
            }

            // Check for old devices
            const ua = navigator.userAgent;
            const oldDevices = ['iPhone 5', 'iPhone 6', 'Android 4', 'Android 5'];
            return oldDevices.some(device => ua.includes(device));
        },

        /**
         * Check passive event listener support
         */
        checkPassiveSupport() {
            let passiveSupported = false;
            try {
                const options = {
                    get passive() {
                        passiveSupported = true;
                        return false;
                    }
                };
                window.addEventListener('test', null, options);
                window.removeEventListener('test', null, options);
            } catch (e) {}
            return passiveSupported;
        },

        /**
         * Defer non-critical resources
         */
        deferNonCriticalResources() {
            // Lazy load images not in viewport
            const images = document.querySelectorAll('img:not([loading="lazy"])');
            images.forEach(img => {
                if (!this.isInViewport(img)) {
                    img.loading = 'lazy';
                }
            });

            // Defer non-critical scripts
            const scripts = document.querySelectorAll('script[defer]');
            scripts.forEach(script => {
                if (!script.src.includes('mobile') && !script.src.includes('core')) {
                    script.async = true;
                }
            });
        },

        /**
         * Check if element is in viewport
         */
        isInViewport(element) {
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth
            );
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MobileExperience.init());
    } else {
        MobileExperience.init();
    }

    // Re-initialize on orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => MobileExperience.init(), 100);
    });

    // Export for global use
    window.MobileExperience = MobileExperience;

})();