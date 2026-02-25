/**
 * Unified Mobile Experience System v1.0
 * Consolidates mobile-ui-simplify, weekly-lineup-mobile, and mobile-enhancements
 * Single entry point for all mobile interactions
 *
 * Features:
 * - Mobile detection and layout adaptation
 * - Touch-optimized controls
 * - FAB (floating action button) for mobile actions
 * - Bottom navigation bar
 * - Safe area inset handling (iOS notch support)
 * - Reduced motion preferences
 */

(function () {
  "use strict";

  const TOUCH_BREAKPOINT = 767; // px - switches from desktop to mobile
  const FAB_LONG_PRESS_DURATION = 500; // ms

  const MobileUnified = {
    // State tracking
    isMobile: false,
    isActive: false,
    currentPage: "dashboard", // dashboard, weekly-lineup, picks-tracker, odds-market
    fab: null,
    fabMenu: null,
    bottomNav: null,
    mobileUI: null,

    /**
     * Initialize mobile experience
     * Call on DOMContentLoaded or after DOM is ready
     */
    init() {
      this.detectMobile();
      if (!this.isMobile) {
        console.log("[Mobile] Desktop detected, skipping mobile UI");
        return;
      }

      console.log("[Mobile] Initializing unified mobile experience");
      this.isActive = true;

      // Detect which page we're on
      this.currentPage = this.detectPage();

      // Set up safe area support for iOS
      this.setupSafeAreas();

      // Reduce motion for accessibility
      this.respectReducedMotion();

      // Create mobile UI
      this.createFAB();
      this.createBottomNav();
      this.createSimplifiedControls();

      // Attach event listeners
      this.attachEventListeners();

      // Mark document for CSS targeting
      document.body.classList.add("is-mobile");

      // Apply mobile-specific styling
      this.applyMobileLayout();
    },

    /**
     * Detect if we're on a mobile device
     */
    detectMobile() {
      this.isMobile = window.innerWidth <= TOUCH_BREAKPOINT;
    },

    /**
     * Detect which page the user is on based on URL or body class
     */
    detectPage() {
      if (document.body.classList.contains("page-picks-tracker")) {
        return "picks-tracker";
      }
      if (document.body.classList.contains("page-weekly-lineup")) {
        return "weekly-lineup";
      }
      if (document.body.classList.contains("page-odds-market")) {
        return "odds-market";
      }
      if (document.body.classList.contains("page-active-picks")) {
        return "dashboard";
      }
      return "dashboard"; // default
    },

    /**
     * Set up safe area insets for iOS notch phones
     */
    setupSafeAreas() {
      const style = document.createElement("style");
      style.textContent = `
                @supports (padding: max(0px)) {
                    body {
                        padding-top: max(8px, env(safe-area-inset-top));
                        padding-left: max(8px, env(safe-area-inset-left));
                        padding-right: max(8px, env(safe-area-inset-right));
                        padding-bottom: max(8px, env(safe-area-inset-bottom));
                    }
                    .brand-nav {
                        padding-top: max(8px, env(safe-area-inset-top)) !important;
                        padding-left: max(8px, env(safe-area-inset-left)) !important;
                        padding-right: max(8px, env(safe-area-inset-right)) !important;
                    }
                    .mobile-bottom-nav {
                        padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
                    }
                    body.page-picks-tracker .main-container {
                        padding-bottom: calc(60px + max(8px, env(safe-area-inset-bottom))) !important;
                    }
                }
            `;
      document.head.appendChild(style);
    },

    /**
     * Respect prefers-reduced-motion accessibility setting
     */
    respectReducedMotion() {
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (prefersReduced) {
        const style = document.createElement("style");
        style.textContent = `
                    * {
                        animation: none !important;
                        transition: none !important;
                    }
                `;
        document.head.appendChild(style);
        console.log("[Mobile] Respecting reduced motion preference");
      }
    },

    /**
     * Create floating action button (FAB) for mobile
     */
    createFAB() {
      // Determine which action should be in FAB based on page
      let fabLabel = "✓"; // default
      let fabClass = "mobile-fab-fetch";

      if (this.currentPage === "picks-tracker") {
        fabLabel = "⟳"; // refresh
        fabClass = "mobile-fab-refresh";
      } else if (this.currentPage === "weekly-lineup") {
        fabLabel = "⬇"; // fetch/pull
        fabClass = "mobile-fab-fetch";
      }

      this.fab = document.createElement("button");
      this.fab.className = `mobile-fab ${fabClass}`;
      this.fab.setAttribute(
        "aria-label",
        `Mobile ${faLabel === "✓" ? "confirm" : fabLabel} action`,
      );
      this.fab.innerHTML = fabLabel;
      this.fab.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(0, 214, 137, 0.9), rgba(0, 180, 120, 0.9));
                border: 2px solid rgba(0, 255, 170, 0.3);
                color: white;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0, 214, 137, 0.3);
                transition: all 0.2s ease;
                min-height: 56px;
                min-width: 56px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

      // Hover effect
      this.fab.addEventListener("mouseenter", () => {
        this.fab.style.transform = "scale(1.1)";
        this.fab.style.boxShadow = "0 6px 16px rgba(0, 214, 137, 0.4)";
      });
      this.fab.addEventListener("mouseleave", () => {
        this.fab.style.transform = "scale(1)";
        this.fab.style.boxShadow = "0 4px 12px rgba(0, 214, 137, 0.3)";
      });

      document.body.appendChild(this.fab);
    },

    /**
     * Create bottom navigation bar
     */
    createBottomNav() {
      this.bottomNav = document.createElement("nav");
      this.bottomNav.className = "mobile-bottom-nav";
      this.bottomNav.setAttribute("aria-label", "Mobile navigation");
      this.bottomNav.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 56px;
                background: rgba(3, 11, 22, 0.95);
                backdrop-filter: blur(12px);
                border-top: 1px solid rgba(0, 214, 137, 0.1);
                display: flex;
                justify-content: space-around;
                z-index: 9998;
                padding-bottom: max(8px, env(safe-area-inset-bottom));
            `;

      const navItems = [
        {
          href: "index.html",
          icon: "🏠",
          label: "Dashboard",
          isActive: this.currentPage === "dashboard",
        },
        {
          href: "weekly-lineup.html",
          icon: "📋",
          label: "Weekly",
          isActive: this.currentPage === "weekly-lineup",
        },
        {
          href: "picks-tracker.html",
          icon: "📊",
          label: "Tracker",
          isActive: this.currentPage === "picks-tracker",
        },
        {
          href: "odds-market.html",
          icon: "💰",
          label: "Odds",
          isActive: this.currentPage === "odds-market",
        },
      ];

      navItems.forEach((item) => {
        const link = document.createElement("a");
        link.href = item.href;
        link.className = `mobile-nav-item ${item.isActive ? "active" : ""}`;
        link.setAttribute("aria-current", item.isActive ? "page" : "false");
        link.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    flex: 1;
                    font-size: 22px;
                    color: ${item.isActive ? "rgba(0, 214, 137, 1)" : "rgba(200, 210, 220, 0.7)"};
                    text-decoration: none;
                    transition: color 0.2s ease;
                    font-size: 10px;
                    min-width: 44px;
                    min-height: 44px;
                    padding: 6px;
                    ${item.isActive ? "border-top: 3px solid rgba(0, 214, 137, 0.8)" : "border-top: 3px solid transparent"}
                `;
        link.innerHTML = `<span style="font-size: 24px;">${item.icon}</span><span>${item.label}</span>`;
        this.bottomNav.appendChild(link);
      });

      document.body.appendChild(this.bottomNav);
    },

    /**
     * Create simplified controls for mobile
     */
    createSimplifiedControls() {
      this.mobileUI = document.createElement("div");
      this.mobileUI.className = "mobile-simplified-ui";
      this.mobileUI.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px;
                margin-bottom: 12px;
            `;

      // Refresh button for dashboard
      if (this.currentPage === "dashboard") {
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "mobile-refresh-btn";
        refreshBtn.style.cssText = `
                    min-height: 44px;
                    min-width: 44px;
                    padding: 12px 16px;
                    background: rgba(0, 214, 137, 0.12);
                    border: 1px solid rgba(0, 214, 137, 0.3);
                    color: rgba(0, 214, 137, 1);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 700;
                    transition: all 0.2s ease;
                `;
        refreshBtn.textContent = "⟳ Refresh Picks";
        refreshBtn.addEventListener("click", () => {
          if (window.loadLivePicks) {
            window.loadLivePicks();
            refreshBtn.textContent = "⟳ Loading...";
            setTimeout(() => {
              refreshBtn.textContent = "⟳ Refresh Picks";
            }, 2000);
          }
        });
        this.mobileUI.appendChild(refreshBtn);
      }

      // Insert after main header, before table
      const headerEl =
        document.querySelector(".dashboard-topline") ||
        document.querySelector("header");
      if (headerEl) {
        headerEl.parentNode.insertBefore(this.mobileUI, headerEl.nextSibling);
      }
    },

    /**
     * Attach mobile-specific event listeners
     */
    attachEventListeners() {
      // Handle window resize to detect mobile/desktop transition
      window.addEventListener("resize", () => {
        const wasMobile = this.isMobile;
        this.detectMobile();

        if (wasMobile && !this.isMobile) {
          console.log("[Mobile] Switched to desktop, cleaning up mobile UI");
          this.cleanup();
        } else if (!wasMobile && this.isMobile) {
          console.log("[Mobile] Switched to mobile, initializing UI");
          this.init();
        }
      });

      // Prevent accidental double-tap zoom
      document.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length > 1) {
            e.preventDefault();
          }
        },
        { passive: false },
      );
    },

    /**
     * Apply mobile-specific layout adjustments
     */
    applyMobileLayout() {
      // Add viewport adjustment styles
      const style = document.createElement("style");
      style.textContent = `
                /* Mobile-specific adjustments */
                html, body {
                    -webkit-text-size-adjust: 100%;
                    text-size-adjust: 100%;
                    overflow-x: hidden;
                }

                /* Ensure table doesn't overflow on mobile */
                .table-container {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                /* Bottom nav spacing */
                body.is-mobile {
                    padding-bottom: 64px;
                }

                /* Touch-friendly form controls */
                input, select, button, textarea {
                    font-size: 16px; /* Prevents zoom on iOS */
                    min-height: 44px;
                    min-width: 44px;
                }

                /* Fixed navigation adjustment */
                .brand-nav {
                    position: fixed;
                    top: 0 !important;
                    z-index: 9999;
                    width: 100%;
                    margin-top: 0 !important;
                }

                /* Content adjustment for fixed nav */
                body.is-mobile > *:not(.brand-nav):not(.mobile-fab):not(.mobile-bottom-nav) {
                    margin-top: 48px;
                }
            `;
      document.head.appendChild(style);
    },

    /**
     * Clean up mobile UI when switching back to desktop
     */
    cleanup() {
      if (this.fab) this.fab.remove();
      if (this.bottomNav) this.bottomNav.remove();
      if (this.mobileUI) this.mobileUI.remove();
      document.body.classList.remove("is-mobile");
      this.isActive = false;
    },
  };

  // Auto-initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MobileUnified.init());
  } else {
    MobileUnified.init();
  }

  // Export for access by other scripts
  window.MobileUnified = MobileUnified;
})();
