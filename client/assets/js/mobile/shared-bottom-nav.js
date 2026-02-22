/**
 * Shared Bottom Navigation v1.0.0
 * Thumb-friendly bottom tab bar for all pages on mobile (≤767px)
 */
(function () {
  'use strict';

  class SharedBottomNav {
    constructor() {
      this.nav = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      if (window.innerWidth > 767) return;

      // Don't double-render if weekly-lineup-mobile already created a bottom nav
      if (document.querySelector('.mobile-bottom-nav, .bottom-nav')) return;

      this._create();
      this._injectStyles();
      this._adjustPagePadding();
      this.initialized = true;
    }

    _create() {
      const pages = [
        { label: 'Dashboard', href: '/index.html', icon: '📊', match: ['/index.html', '/'] },
        { label: 'Lineup',    href: '/weekly-lineup.html', icon: '📋', match: ['/weekly-lineup.html'] },
        { label: 'Odds',      href: '/odds-market.html',   icon: '📈', match: ['/odds-market.html'] },
        { label: 'Tracker',   href: '/picks-tracker.html',  icon: '🎯', match: ['/picks-tracker.html'] },
      ];

      this.nav = document.createElement('nav');
      this.nav.className = 'shared-bottom-nav';
      this.nav.setAttribute('aria-label', 'Page navigation');

      const path = window.location.pathname;

      this.nav.innerHTML = pages.map(p => {
        const active = p.match.some(m => path.endsWith(m)) ? ' active' : '';
        return `<a href="${p.href}" class="bottom-nav-item${active}" aria-label="${p.label}">
          <span class="bottom-nav-icon">${p.icon}</span>
          <span class="bottom-nav-label">${p.label}</span>
        </a>`;
      }).join('');

      document.body.appendChild(this.nav);
    }

    _adjustPagePadding() {
      // Ensure page content doesn't get hidden behind the bottom nav
      document.body.style.paddingBottom = 'calc(60px + env(safe-area-inset-bottom, 0px))';
    }

    _injectStyles() {
      if (document.getElementById('shared-bottom-nav-styles')) return;

      const style = document.createElement('style');
      style.id = 'shared-bottom-nav-styles';
      style.textContent = `
        .shared-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-around;
          align-items: center;
          height: 56px;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: linear-gradient(180deg, rgba(10, 22, 40, 0.98), rgba(3, 11, 22, 0.99));
          border-top: 1px solid rgba(0, 214, 137, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9999;
        }

        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex: 1;
          min-height: 44px;
          padding: 6px 4px;
          text-decoration: none;
          color: rgba(200, 210, 220, 0.6);
          transition: color 0.2s;
          -webkit-tap-highlight-color: transparent;
        }

        .bottom-nav-item.active {
          color: rgba(0, 214, 137, 0.95);
        }

        .bottom-nav-item:active {
          color: rgba(0, 214, 137, 0.7);
        }

        .bottom-nav-icon {
          font-size: 20px;
          line-height: 1;
        }

        .bottom-nav-label {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        @media (min-width: 768px) {
          .shared-bottom-nav {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  const bottomNav = new SharedBottomNav();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bottomNav.init());
  } else {
    bottomNav.init();
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 767 && !bottomNav.initialized) {
      bottomNav.init();
    }
  });

  window.SharedBottomNav = bottomNav;
})();
