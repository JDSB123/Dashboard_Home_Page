/**
 * Theme Manager
 * Handles dark/light theme toggling with persistent user preference
 */

(function() {
    'use strict';

    const THEME_KEY = 'bears-bulls-theme';
    const THEMES = {
        DARK: 'dark',
        LIGHT: 'light'
    };

    // ===== THEME DETECTION & INITIALIZATION =====
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    }

    function getSavedTheme() {
        return localStorage.getItem(THEME_KEY) || getSystemTheme();
    }

    function saveTheme(theme) {
        localStorage.setItem(THEME_KEY, theme);
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || THEMES.DARK;
    }

    // ===== THEME APPLICATION =====
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeToggleUI(theme);
        
        // Dispatch custom event for components that need to react to theme changes
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        applyTheme(newTheme);
        saveTheme(newTheme);
        
        console.log(`Theme switched: ${currentTheme} → ${newTheme}`);
    }

    // ===== UI UPDATES =====
    function updateThemeToggleUI(theme) {
        const toggleBtn = document.querySelector('.theme-toggle');
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('.theme-icon');
        const label = toggleBtn.querySelector('.theme-label');

        if (theme === THEMES.DARK) {
            if (icon) icon.textContent = '🌙';
            if (label) label.textContent = 'Dark';
            toggleBtn.setAttribute('aria-label', 'Switch to light theme');
        } else {
            if (icon) icon.textContent = '☀️';
            if (label) label.textContent = 'Light';
            toggleBtn.setAttribute('aria-label', 'Switch to dark theme');
        }
    }

    // ===== THEME TOGGLE BUTTON SETUP =====
    function setupThemeToggle() {
        // Check if toggle already exists
        if (document.querySelector('.theme-toggle')) return;

        // Find a suitable location for the theme toggle
        const navActions = document.querySelector('.nav-actions, .user-profile, .dashboard-toolbar');
        
        if (!navActions) {
            console.warn('Theme toggle: No suitable location found');
            return;
        }

        // Create theme toggle button
        const toggleHTML = `
            <button class="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
                <span class="theme-icon">🌙</span>
            </button>
        `;

        navActions.insertAdjacentHTML('afterbegin', toggleHTML);

        // Attach event listener
        const toggleBtn = document.querySelector('.theme-toggle');
        toggleBtn?.addEventListener('click', toggleTheme);
    }

    // ===== SYSTEM THEME CHANGE LISTENER =====
    function watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't explicitly set a preference
            if (!localStorage.getItem(THEME_KEY)) {
                const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
                applyTheme(newTheme);
                console.log(`System theme changed: ${newTheme}`);
            }
        });
    }

    // ===== INITIALIZE =====
    function init() {
        const savedTheme = getSavedTheme();
        applyTheme(savedTheme);
        setupThemeToggle();
        watchSystemTheme();
        
        console.log(`✅ Theme Manager initialized: ${savedTheme}`);
    }

    // Initialize immediately (before DOM ready) to prevent flash
    init();

    // Setup UI controls after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupThemeToggle);
    }

    // ===== EXPORT =====
    window.ThemeManager = {
        toggle: toggleTheme,
        set: (theme) => {
            if (Object.values(THEMES).includes(theme)) {
                applyTheme(theme);
                saveTheme(theme);
            }
        },
        get: getCurrentTheme,
        THEMES
    };

})();
