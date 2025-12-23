(function() {
    'use strict';

    if (!document.body.classList.contains('page-weekly-lineup')) return;

    const dropdowns = [];

    function closeAll(except) {
        dropdowns.forEach(({ dropdown, trigger, menu }) => {
            if (except && dropdown === except) return;
            dropdown.classList.remove('open');
            trigger?.setAttribute('aria-expanded', 'false');
            menu?.setAttribute('hidden', '');
        });
    }

    function wireDropdown(dropdown) {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        const menu = dropdown.querySelector('.nav-dropdown-menu');
        if (!trigger || !menu) return;

        dropdowns.push({ dropdown, trigger, menu });

        const toggle = () => {
            const willOpen = !dropdown.classList.contains('open');
            closeAll(willOpen ? dropdown : null);
            dropdown.classList.toggle('open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            if (willOpen) {
                menu.removeAttribute('hidden');
            } else {
                menu.setAttribute('hidden', '');
            }
        };

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggle();
            }
            if (e.key === 'Escape') {
                closeAll();
                trigger.focus();
            }
        });
    }

    document.querySelectorAll('.nav-dropdown').forEach(wireDropdown);
    closeAll();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            closeAll();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
    });
})();
