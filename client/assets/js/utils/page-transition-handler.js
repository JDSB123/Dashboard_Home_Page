/**
 * Page Transition Handler
 * Improves navigation UX by showing loading state and smooth transitions
 * v1.0.0
 */

(function() {
    'use strict';

    const PageTransitionHandler = {
        isLoading: false,
        loadingOverlay: null,

        init() {
            this.createLoadingOverlay();
            this.setupNavLinkHandlers();
            this.setupLinkPrefetch();
            this.setupHistoryHandler();

            // Clean up loading state on page load complete
            window.addEventListener('load', () => this.hideLoading());
            document.addEventListener('DOMContentLoaded', () => this.hideLoading());

            // Safety: ensure overlay never lingers on slow loads
            setTimeout(() => this.hideLoading(), 1500);
        },

        createLoadingOverlay() {
            // Create loading overlay if it doesn't exist
            if (!document.getElementById('page-transition-overlay')) {
                const overlay = document.createElement('div');
                overlay.id = 'page-transition-overlay';
                overlay.className = 'page-transition-overlay';
                overlay.innerHTML = `
                    <div class="page-transition-content">
                        <div class="page-transition-spinner"></div>
                        <p class="page-transition-text">Loading...</p>
                    </div>
                `;
                document.body.appendChild(overlay);

                // Add styles if not already present
                if (!document.getElementById('page-transition-styles')) {
                    const style = document.createElement('style');
                    style.id = 'page-transition-styles';
                    style.textContent = `
                        .page-transition-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(3, 11, 22, 0.95);
                            backdrop-filter: blur(2px);
                            z-index: 99998;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: 0;
                            visibility: hidden;
                            transition: opacity 0.3s ease, visibility 0.3s ease;
                            pointer-events: none;
                        }

                        .page-transition-overlay.visible {
                            opacity: 1;
                            visibility: visible;
                            pointer-events: auto;
                        }

                        .page-transition-content {
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 16px;
                        }

                        .page-transition-spinner {
                            width: 40px;
                            height: 40px;
                            border: 3px solid rgba(0, 214, 137, 0.2);
                            border-top-color: #00d689;
                            border-radius: 50%;
                            animation: pageTransitionSpin 1s linear infinite;
                        }

                        @keyframes pageTransitionSpin {
                            to { transform: rotate(360deg); }
                        }

                        .page-transition-text {
                            color: rgba(214, 232, 236, 0.8);
                            font-family: 'Cormorant Garamond', Georgia, serif;
                            font-size: 0.95rem;
                            letter-spacing: 0.05em;
                            margin: 0;
                        }

                        /* Fade in body content when new page loads */
                        body {
                            animation: pageContentFadeIn 0.4s ease forwards;
                        }

                        @keyframes pageContentFadeIn {
                            from {
                                opacity: 0.95;
                            }
                            to {
                                opacity: 1;
                            }
                        }

                        /* Smooth fade out on page exit */
                        body.page-exiting {
                            animation: pageContentFadeOut 0.3s ease forwards;
                        }

                        @keyframes pageContentFadeOut {
                            from {
                                opacity: 1;
                            }
                            to {
                                opacity: 0.95;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
            this.loadingOverlay = document.getElementById('page-transition-overlay');
        },

        setupNavLinkHandlers() {
            document.addEventListener('click', (e) => {
                // Find nav link in the clicked element or its parents
                const navLink = e.target.closest('a.nav-link');

                if (navLink && !navLink.hasAttribute('aria-disabled')) {
                    const href = navLink.getAttribute('href');

                    // Only intercept internal navigation
                    if (href && !href.startsWith('http') && !href.startsWith('#')) {
                        // Check if it's a different page
                        const currentPage = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
                        const targetPage = (href.split('/').pop() || 'dashboard.html').toLowerCase();

                        if (currentPage !== targetPage) {
                            e.preventDefault();
                            this.transitionToPage(href);
                        }
                    }
                }
            }, true);
        },

        transitionToPage(url) {
            if (this.isLoading) return;

            this.isLoading = true;
            this.showLoading();

            // Add a small delay to ensure loading state is visible
            // then navigate
            setTimeout(() => {
                window.location.href = url;
            }, 100);
        },

        showLoading() {
            if (this.loadingOverlay) {
                this.loadingOverlay.classList.add('visible');
            }
        },

        hideLoading() {
            if (this.loadingOverlay) {
                this.loadingOverlay.classList.remove('visible');
            }
            this.isLoading = false;
        },

        setupLinkPrefetch() {
            // Prefetch nav links on hover
            const navLinks = document.querySelectorAll('a.nav-link');

            navLinks.forEach(link => {
                link.addEventListener('mouseenter', () => {
                    const href = link.getAttribute('href');
                    if (href && !document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
                        const prefetchLink = document.createElement('link');
                        prefetchLink.rel = 'prefetch';
                        prefetchLink.href = href;
                        document.head.appendChild(prefetchLink);
                    }
                });
            });
        },

        setupHistoryHandler() {
            // Handle back/forward buttons
            window.addEventListener('pageshow', () => {
                this.hideLoading();
            });

            window.addEventListener('pagehide', () => {
                this.showLoading();
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PageTransitionHandler.init());
    } else {
        PageTransitionHandler.init();
    }

    // Export for debugging
    window.PageTransitionHandler = PageTransitionHandler;

})();
