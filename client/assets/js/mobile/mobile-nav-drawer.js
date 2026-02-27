/**
 * Mobile Navigation Drawer v1.0.0
 * Slide-out navigation menu for mobile devices
 */

(function () {
  "use strict";

  class MobileNavDrawer {
    constructor() {
      this.isOpen = false;
      this.drawer = null;
      this.overlay = null;
      this.hamburger = null;
      this.initialized = false;
    }

    /**
     * Initialize the mobile navigation drawer
     */
    init() {
      if (this.initialized) return;

      // Only initialize on mobile
      if (window.innerWidth > 767) {
        return;
      }

      this._createDrawer();
      this._createOverlay();
      this._setupHamburger();
      this._setupEventListeners();

      this.initialized = true;
    }

    /**
     * Create the drawer element
     */
    _createDrawer() {
      this.drawer = document.createElement("nav");
      this.drawer.id = "mobile-nav-drawer";
      this.drawer.className = "mobile-nav-drawer";
      this.drawer.innerHTML = `
                <div class="drawer-header">
                    <img src="assets/Logo%208.5.png" alt="GBSV" class="drawer-logo">
                    <button class="drawer-close" aria-label="Close menu">×</button>
                </div>
                <ul class="drawer-menu">
                    <li><a href="/dashboard.html" class="drawer-link ${this._isActive("/dashboard.html") ? "active" : ""}">
                        <span class="drawer-icon">📊</span> Dashboard
                    </a></li>
                    <li><a href="/weekly-lineup.html" class="drawer-link ${this._isActive("/weekly-lineup.html") ? "active" : ""}">
                        <span class="drawer-icon">📋</span> Weekly Lineup
                    </a></li>
                    <li><a href="/odds-market.html" class="drawer-link ${this._isActive("/odds-market.html") ? "active" : ""}">
                        <span class="drawer-icon">📈</span> Odds Market
                    </a></li>
                    <li><a href="/picks-tracker.html" class="drawer-link ${this._isActive("/picks-tracker.html") ? "active" : ""}">
                        <span class="drawer-icon">🎯</span> Picks Tracker
                    </a></li>
                    <li><a href="/fetch-picks.html" class="drawer-link ${this._isActive("/fetch-picks.html") ? "active" : ""}">
                        <span class="drawer-icon">📥</span> Fetch Picks
                    </a></li>
                </ul>
                <div class="drawer-section">
                    <h4 class="drawer-section-title">Quick Actions</h4>
                    <ul class="drawer-menu drawer-actions">
                        <li><button class="drawer-btn" id="drawer-fetch-all">
                            <span class="drawer-icon">🔄</span> Fetch All Picks
                        </button></li>
                        <li><button class="drawer-btn" id="drawer-manual-pick">
                            <span class="drawer-icon">✏️</span> Manual Pick Entry
                        </button></li>
                    </ul>
                </div>
                <div class="drawer-footer">
                    <div class="drawer-status">
                        <span class="status-dot online"></span>
                        <span>Connected</span>
                    </div>
                    <div class="drawer-version">v36.01.0</div>
                </div>
            `;

      document.body.appendChild(this.drawer);

      // Style the drawer
      this._injectStyles();
    }

    /**
     * Create overlay for drawer
     */
    _createOverlay() {
      this.overlay = document.createElement("div");
      this.overlay.id = "mobile-nav-overlay";
      this.overlay.className = "mobile-nav-overlay";
      document.body.appendChild(this.overlay);
    }

    /**
     * Set up hamburger menu button
     */
    _setupHamburger() {
      // Find existing hamburger or create one
      this.hamburger = document.querySelector(
        ".mobile-hamburger, .hamburger-menu, #hamburger-btn",
      );

      if (!this.hamburger) {
        // Create hamburger button
        this.hamburger = document.createElement("button");
        this.hamburger.id = "hamburger-btn";
        this.hamburger.className = "hamburger-btn";
        this.hamburger.setAttribute("aria-label", "Open menu");
        this.hamburger.innerHTML = `
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                `;

        // Insert at the start of the body or header
        const header = document.querySelector(
          "header, .header, .mobile-header",
        );
        if (header) {
          header.insertBefore(this.hamburger, header.firstChild);
        } else {
          document.body.insertBefore(this.hamburger, document.body.firstChild);
        }
      }
    }

    /**
     * Set up event listeners
     */
    _setupEventListeners() {
      // Hamburger click
      this.hamburger.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggle();
      });

      // Overlay click to close
      this.overlay.addEventListener("click", () => {
        this.close();
      });

      // Close button
      const closeBtn = this.drawer.querySelector(".drawer-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.close());
      }

      // Handle escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });

      // Handle swipe to close
      this._setupSwipeHandler();

      // Quick action buttons
      const fetchAllBtn = document.getElementById("drawer-fetch-all");
      if (fetchAllBtn) {
        fetchAllBtn.addEventListener("click", () => {
          this.close();
          // Trigger fetch all picks
          if (window.fetchAllPicks) {
            window.fetchAllPicks();
          } else {
            document.querySelector('[data-action="refresh-all"]')?.click();
          }
        });
      }

      const manualPickBtn = document.getElementById("drawer-manual-pick");
      if (manualPickBtn) {
        manualPickBtn.addEventListener("click", () => {
          this.close();
          // Open manual pick modal
          if (window.ManualPickModal) {
            window.ManualPickModal.show();
          }
        });
      }

      // Update connection status
      window.addEventListener("signalr:connected", () =>
        this._updateStatus(true),
      );
      window.addEventListener("signalr:disconnected", () =>
        this._updateStatus(false),
      );
    }

    /**
     * Set up swipe to close gesture
     */
    _setupSwipeHandler() {
      let startX = 0;
      let currentX = 0;

      this.drawer.addEventListener(
        "touchstart",
        (e) => {
          startX = e.touches[0].clientX;
        },
        { passive: true },
      );

      this.drawer.addEventListener(
        "touchmove",
        (e) => {
          currentX = e.touches[0].clientX;
          const diff = startX - currentX;

          if (diff > 0) {
            // Swiping left (closing)
            this.drawer.style.transform = `translateX(-${Math.min(diff, 280)}px)`;
          }
        },
        { passive: true },
      );

      this.drawer.addEventListener(
        "touchend",
        () => {
          const diff = startX - currentX;

          if (diff > 100) {
            // Swipe threshold reached - close
            this.close();
          } else {
            // Reset position
            this.drawer.style.transform = "";
          }
        },
        { passive: true },
      );
    }

    /**
     * Toggle drawer open/close
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Open the drawer
     */
    open() {
      this.isOpen = true;
      this.drawer.classList.add("open");
      this.overlay.classList.add("visible");
      this.hamburger.classList.add("active");
      document.body.style.overflow = "hidden";
      this.drawer.style.transform = "";
    }

    /**
     * Close the drawer
     */
    close() {
      this.isOpen = false;
      this.drawer.classList.remove("open");
      this.overlay.classList.remove("visible");
      this.hamburger.classList.remove("active");
      document.body.style.overflow = "";
      this.drawer.style.transform = "";
    }

    /**
     * Check if current page matches path
     */
    _isActive(path) {
      return (
        window.location.pathname.endsWith(path) ||
        (path === "/dashboard.html" && window.location.pathname === "/")
      );
    }

    /**
     * Update connection status in drawer
     */
    _updateStatus(isOnline) {
      const dot = this.drawer?.querySelector(".status-dot");
      const text = this.drawer?.querySelector(".drawer-status span:last-child");

      if (dot) {
        dot.className = `status-dot ${isOnline ? "online" : "offline"}`;
      }
      if (text) {
        text.textContent = isOnline ? "Connected" : "Offline";
      }
    }

    /**
     * Inject CSS styles
     */
    _injectStyles() {
      if (document.getElementById("mobile-nav-drawer-styles")) return;

      const style = document.createElement("style");
      style.id = "mobile-nav-drawer-styles";
      style.textContent = `
                .mobile-nav-drawer {
                    position: fixed;
                    top: 0;
                    left: -280px;
                    width: 280px;
                    height: 100%;
                    background: linear-gradient(180deg, #0a1628 0%, #030b16 100%);
                    z-index: 10002;
                    transition: left 0.3s ease, transform 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 2px 0 20px rgba(0,0,0,0.5);
                    overflow-y: auto;
                }

                .mobile-nav-drawer.open {
                    left: 0;
                }

                .drawer-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .drawer-logo {
                    height: 40px;
                    width: auto;
                }

                .drawer-close {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .drawer-menu {
                    list-style: none;
                    padding: 10px 0;
                    margin: 0;
                }

                .drawer-link, .drawer-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 20px;
                    color: rgba(255,255,255,0.8);
                    text-decoration: none;
                    font-size: 16px;
                    transition: all 0.2s ease;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                }

                .drawer-link:hover, .drawer-btn:hover,
                .drawer-link.active {
                    background: rgba(59, 130, 246, 0.15);
                    color: #fff;
                }

                .drawer-link.active {
                    border-left: 3px solid #3b82f6;
                }

                .drawer-icon {
                    font-size: 20px;
                }

                .drawer-section {
                    padding: 10px 0;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    margin-top: 10px;
                }

                .drawer-section-title {
                    color: rgba(255,255,255,0.5);
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    padding: 10px 20px 5px;
                    margin: 0;
                }

                .drawer-footer {
                    margin-top: auto;
                    padding: 20px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .drawer-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: rgba(255,255,255,0.6);
                    font-size: 12px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-dot.online {
                    background: #22c55e;
                    box-shadow: 0 0 8px #22c55e;
                }

                .status-dot.offline {
                    background: #ef4444;
                }

                .drawer-version {
                    color: rgba(255,255,255,0.4);
                    font-size: 11px;
                }

                .mobile-nav-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 10001;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }

                .mobile-nav-overlay.visible {
                    opacity: 1;
                    visibility: visible;
                }

                .hamburger-btn {
                    position: fixed;
                    top: 15px;
                    left: 15px;
                    width: 44px;
                    height: 44px;
                    background: rgba(10, 22, 40, 0.95);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                    padding: 0;
                }

                .hamburger-line {
                    width: 22px;
                    height: 2px;
                    background: #fff;
                    border-radius: 2px;
                    transition: all 0.3s ease;
                }

                .hamburger-btn.active .hamburger-line:nth-child(1) {
                    transform: rotate(45deg) translate(5px, 5px);
                }

                .hamburger-btn.active .hamburger-line:nth-child(2) {
                    opacity: 0;
                }

                .hamburger-btn.active .hamburger-line:nth-child(3) {
                    transform: rotate(-45deg) translate(5px, -5px);
                }

                @media (min-width: 768px) {
                    .mobile-nav-drawer,
                    .mobile-nav-overlay,
                    .hamburger-btn {
                        display: none !important;
                    }
                }
            `;
      document.head.appendChild(style);
    }
  }

  // Create and initialize on DOM ready
  const mobileNav = new MobileNavDrawer();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mobileNav.init());
  } else {
    mobileNav.init();
  }

  // Re-init on resize if crossing breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 767 && !mobileNav.initialized) {
      mobileNav.init();
    }
  });

  // Export to window
  window.MobileNavDrawer = mobileNav;
})();
