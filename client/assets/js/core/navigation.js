/**
 * Navigation JavaScript for Green Bier Sport Ventures Dashboard
 * Handles dropdown functionality, accessibility, and responsive behavior
 */

class NavigationManager {
    constructor() {
        this.dropdowns = [];
        this.navLinks = null;
        this.isInitialized = false;
        this.mobileMenuOpen = false;
        this.mobileMenuToggle = null;
        this.mobileMenuOverlay = null;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        // Setup mobile menu first
        this.setupMobileMenu();
        
        // Handle multiple dropdowns
        const dropdownElements = document.querySelectorAll('.nav-dropdown');
        dropdownElements.forEach(dropdown => {
            const trigger = dropdown.querySelector('.nav-dropdown-trigger');
            const menu = dropdown.querySelector('.nav-dropdown-menu');
            
            if (trigger && menu) {
                this.dropdowns.push({ dropdown, trigger, menu });
                this.setupDropdown(dropdown, trigger, menu);
            }
        });
        
        this.navLinks = document.querySelectorAll('.nav-link');
        
        this.setupKeyboardNavigation();
        this.setupResponsiveBehavior();
        this.setupAccessibility();
        this.setupNavState();
        this.setupTableScrollIndicators();

        this.isInitialized = true;
    }
    
    setupMobileMenu() {
        const brandNav = document.querySelector('.brand-nav');
        const navLinks = document.querySelector('.nav-links');
        
        if (!brandNav || !navLinks) return;
        
        // Create hamburger toggle button if it doesn't exist
        if (!document.querySelector('.mobile-menu-toggle')) {
            this.mobileMenuToggle = document.createElement('button');
            this.mobileMenuToggle.className = 'mobile-menu-toggle';
            this.mobileMenuToggle.setAttribute('aria-label', 'Toggle navigation menu');
            this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
            this.mobileMenuToggle.innerHTML = '<span></span>';
            
            // Insert at the beginning of nav
            brandNav.insertBefore(this.mobileMenuToggle, brandNav.firstChild);
        } else {
            this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        }
        
        // Create overlay if it doesn't exist
        if (!document.querySelector('.mobile-menu-overlay')) {
            this.mobileMenuOverlay = document.createElement('div');
            this.mobileMenuOverlay.className = 'mobile-menu-overlay';
            document.body.appendChild(this.mobileMenuOverlay);
        } else {
            this.mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
        }
        
        // Toggle menu on hamburger click
        this.mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMobileMenu();
        });
        
        // Close menu on overlay click
        this.mobileMenuOverlay.addEventListener('click', () => {
            this.closeMobileMenu();
        });
        
        // Close menu on nav link click (for navigation)
        navLinks.querySelectorAll('.nav-link:not(.nav-dropdown-trigger)').forEach(link => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.mobileMenuOpen) {
                this.closeMobileMenu();
            }
        });
    }
    
    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        
        const navLinks = document.querySelector('.nav-links');
        
        if (this.mobileMenuOpen) {
            navLinks?.classList.add('mobile-open');
            this.mobileMenuToggle?.classList.add('active');
            this.mobileMenuOverlay?.classList.add('active');
            this.mobileMenuToggle?.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        } else {
            navLinks?.classList.remove('mobile-open');
            this.mobileMenuToggle?.classList.remove('active');
            this.mobileMenuOverlay?.classList.remove('active');
            this.mobileMenuToggle?.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    }
    
    closeMobileMenu() {
        if (this.mobileMenuOpen) {
            this.mobileMenuOpen = false;
            const navLinks = document.querySelector('.nav-links');
            navLinks?.classList.remove('mobile-open');
            this.mobileMenuToggle?.classList.remove('active');
            this.mobileMenuOverlay?.classList.remove('active');
            this.mobileMenuToggle?.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    }
    
    setupTableScrollIndicators() {
        // Add scroll indicators to table containers
        const tableContainers = document.querySelectorAll('.table-container');
        
        tableContainers.forEach(container => {
            const updateScrollIndicators = () => {
                const scrollLeft = container.scrollLeft;
                const scrollWidth = container.scrollWidth;
                const clientWidth = container.clientWidth;
                
                // Can scroll right
                if (scrollLeft < scrollWidth - clientWidth - 5) {
                    container.classList.add('scroll-right');
                } else {
                    container.classList.remove('scroll-right');
                }
                
                // Can scroll left
                if (scrollLeft > 5) {
                    container.classList.add('scroll-left');
                } else {
                    container.classList.remove('scroll-left');
                }
            };
            
            container.addEventListener('scroll', updateScrollIndicators);
            window.addEventListener('resize', updateScrollIndicators);
            
            // Initial check
            setTimeout(updateScrollIndicators, 100);
        });
    }
    
    setupDropdown(dropdown, trigger, menu) {
        // Click handler for dropdown trigger
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(dropdown, trigger, menu);
        });
        
        // Keyboard handler for dropdown trigger
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                this.toggleDropdown(dropdown, trigger, menu);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                this.closeDropdown(dropdown, trigger, menu);
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdown.classList.contains('open')) {
                this.closeDropdown(dropdown, trigger, menu);
                trigger.focus();
            }
        });
        
        // Handle sync button clicks (only for sportsbooks dropdown)
        if (dropdown.querySelector('.sportsbook-card')) {
            this.setupSyncHandlers(menu);
            
            // Handle "Add Additional Book" buttons
            const addBtns = menu.querySelectorAll('.add-book-btn-compact');
            addBtns.forEach(addBtn => {
                addBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleAddSportsbook();
                });
            });
        }
    }
    
    setupSyncHandlers(menu) {
        const syncBtns = menu.querySelectorAll(
            '.sportsbook-fetch-btn-compact, .sportsbook-fetch-btn-sleek, .sportsbook-fetch-inline'
        );
        
        syncBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const card = btn.closest('.sportsbook-card');
                const sportsbookName = card.querySelector('.sportsbook-name')?.textContent || 'Sportsbook';
                
                this.handleSync(card, sportsbookName);
            });
        });
    }
    
    handleSync(card, sportsbookName) {
        // Add syncing state
        card.classList.add('syncing');
        
        this.showNotification(`Syncing picks from ${sportsbookName}...`, 'info');
        
        // Simulate sync (in production, this would be an API call)
        setTimeout(() => {
            card.classList.remove('syncing');
            
            // Update last sync time
            const syncTimeEl = card.querySelector('.sync-time');
            if (syncTimeEl) {
                syncTimeEl.textContent = 'Just now';
            }
            
            this.showNotification(`Successfully synced picks from ${sportsbookName}`, 'success');
        }, 2000);
    }
    
    handleAddSportsbook() {
        this.showNotification('Add Sportsbook feature coming soon', 'info');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        const accentGradient = 'linear-gradient(135deg, rgba(0, 214, 137, 0.95), rgba(60, 255, 181, 0.92))';
        const infoGradient = 'linear-gradient(135deg, rgba(6, 28, 20, 0.95), rgba(16, 58, 40, 0.92))';
        const errorGradient = 'linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(40, 40, 50, 0.92))';
        const background = type === 'error' ? errorGradient : type === 'success' ? accentGradient : infoGradient;
        const borderColor = type === 'error' ? 'rgba(214, 40, 40, 0.5)' : 'rgba(60, 255, 181, 0.7)';
        const textColor = type === 'error' ? '#FF6B6B' : type === 'success' ? '#03150e' : '#e8f0f2';
        const glow = type === 'error'
            ? '0 18px 32px rgba(0, 0, 0, 0.5)'
            : '0 18px 32px rgba(60, 255, 181, 0.35)';
        
        notification.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            background: ${background};
            color: ${textColor};
            padding: 14px 22px;
            border-radius: 14px;
            border: 1px solid ${borderColor};
            z-index: 999999;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.4px;
            box-shadow: ${glow};
            backdrop-filter: blur(14px);
            text-shadow: ${type === 'error' ? 'none' : '0 1px 1px rgba(0, 0, 0, 0.15)'};
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    toggleDropdown(dropdown, trigger, menu) {
        const willOpen = !dropdown.classList.contains('open');
        
        // Close all other dropdowns first
        this.dropdowns.forEach(({ dropdown: otherDropdown, trigger: otherTrigger, menu: otherMenu }) => {
            if (otherDropdown !== dropdown && otherDropdown.classList.contains('open')) {
                this.closeDropdown(otherDropdown, otherTrigger, otherMenu);
            }
        });
        
        dropdown.classList.toggle('open', willOpen);
        trigger.setAttribute('aria-expanded', willOpen);
        
        if (menu) {
            if (willOpen) {
                menu.removeAttribute('hidden');
                menu.offsetHeight; // Force reflow
            } else {
                setTimeout(() => {
                    if (!dropdown.classList.contains('open')) {
                        menu.setAttribute('hidden', '');
                    }
                }, 200);
            }
        }
    }
    
    closeDropdown(dropdown, trigger, menu) {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        if (menu) {
            setTimeout(() => {
                if (!dropdown.classList.contains('open')) {
                    menu.setAttribute('hidden', '');
                }
            }, 200);
        }
    }
    
    closeAllDropdowns() {
        this.dropdowns.forEach(({ dropdown, trigger, menu }) => {
            this.closeDropdown(dropdown, trigger, menu);
        });
    }
    
    setupKeyboardNavigation() {
        this.navLinks.forEach(link => {
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            });
        });
    }
    
    setupResponsiveBehavior() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }
    
    handleResize() {
        if (window.innerWidth <= 768) {
            this.closeAllDropdowns();
        }
        
        // Close mobile menu when resizing to desktop
        if (window.innerWidth > 767 && this.mobileMenuOpen) {
            this.closeMobileMenu();
        }
    }
    
    setupAccessibility() {
        this.dropdowns.forEach(({ dropdown, trigger, menu }) => {
            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
                trigger.setAttribute('aria-haspopup', 'true');
                const menuId = menu?.getAttribute('id');
                if (menuId) {
                    trigger.setAttribute('aria-controls', menuId);
                }
            }
            
            if (menu) {
                menu.setAttribute('role', 'menu');
                const triggerId = trigger?.getAttribute('id');
                if (triggerId) {
                    menu.setAttribute('aria-labelledby', triggerId);
                }
            }
        });
        
        this.setupScreenReaderSupport();
    }
    
    setupScreenReaderSupport() {
        let liveRegion = document.getElementById('navigation-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'navigation-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        
        // Store reference for notifications
        this.liveRegion = liveRegion;
    }
    
    openDropdown(dropdown, trigger, menu) {
        if (!dropdown.classList.contains('open')) {
            this.toggleDropdown(dropdown, trigger, menu);
        }
    }
    
    setupNavState() {
        // Handle active nav link states based on current page
        try {
            const links = document.querySelectorAll('.nav-link');
            const path = (location.pathname.split('/').pop() || '').toLowerCase();

            links.forEach(link => {
                const href = (link.getAttribute('href') || '').toLowerCase();
                const isDisabled = link.getAttribute('aria-disabled') === 'true';

                // Never mark disabled links as active / current
                if (isDisabled) {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                    return;
                }

                const isActive =
                    !!href &&
                    (
                        href === path ||                      // Exact file match
                        (href.endsWith('.html') && path === '') // Root route serving an HTML file
                    );

                link.classList.toggle('active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        } catch (e) {
            // no-op
        }
    }

    destroy() {
        this.isInitialized = false;
    }
}

// Add notification animation styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(20px);
        }
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
`;
document.head.appendChild(styleSheet);

// Back to Top Button functionality
class BackToTopButton {
    constructor() {
        this.button = document.getElementById('back-to-top');
        this.scrollThreshold = 200; // Show button after scrolling this many pixels
        
        if (this.button) {
            this.init();
        }
    }
    
    init() {
        // Handle scroll events
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });
        
        // Handle click
        this.button.addEventListener('click', () => {
            this.scrollToTop();
        });
        
        // Initial check
        this.handleScroll();
    }
    
    handleScroll() {
        if (window.scrollY > this.scrollThreshold) {
            this.button.classList.add('visible');
        } else {
            this.button.classList.remove('visible');
        }
    }
    
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navigationManager = new NavigationManager();
    window.backToTopButton = new BackToTopButton();
});

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
}
