/**
 * Status Badge Tooltip System
 * Better tooltip implementation with dynamic positioning
 */

(function() {
    'use strict';

    const BADGE_SELECTOR = '.status-badge, .status-badge--mini';
    let tooltipElement = null;
    let currentTarget = null;
    let hideTimeout = null;
    let showDelayTimeout = null;
    let hideAnimationTimeout = null;

    /**
     * Create tooltip element if it doesn't exist
     */
    function createTooltipElement() {
        if (tooltipElement) return tooltipElement;

        tooltipElement = document.createElement('div');
        tooltipElement.className = 'status-tooltip';
        tooltipElement.setAttribute('role', 'tooltip');
        tooltipElement.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltipElement);
        return tooltipElement;
    }

    /**
     * Get status-specific tooltip styling
     */
    function getStatusTooltipClass(status) {
        const statusMap = {
            'live': 'tooltip-live',
            'on-track': 'tooltip-on-track',
            'at-risk': 'tooltip-at-risk',
            'win': 'tooltip-win',
            'final': 'tooltip-win',
            'loss': 'tooltip-loss',
            'pending': 'tooltip-pending',
            'push': 'tooltip-push'
        };
        return statusMap[status] || '';
    }

    /**
     * Calculate optimal tooltip position
     */
    function calculateTooltipPosition(target, tooltip) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY
        };

        const spacing = 12;
        const arrowSize = 6;
        let top, left, placement = 'top';

        // Try top first (default)
        top = rect.top - tooltipRect.height - spacing - arrowSize;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Check if tooltip goes off top of viewport
        if (top < viewport.scrollY + 10) {
            // Try bottom
            top = rect.bottom + spacing + arrowSize;
            placement = 'bottom';
            
            // If still doesn't fit, try sides
            if (top + tooltipRect.height > viewport.scrollY + viewport.height - 10) {
                // Try right side
                if (rect.right + tooltipRect.width + spacing < viewport.scrollX + viewport.width) {
                    left = rect.right + spacing;
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    placement = 'right';
                }
                // Try left side
                else if (rect.left - tooltipRect.width - spacing > viewport.scrollX) {
                    left = rect.left - tooltipRect.width - spacing;
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    placement = 'left';
                }
            }
        }

        // Keep tooltip within horizontal bounds
        if (left < viewport.scrollX + 10) {
            left = viewport.scrollX + 10;
        } else if (left + tooltipRect.width > viewport.scrollX + viewport.width - 10) {
            left = viewport.scrollX + viewport.width - tooltipRect.width - 10;
        }

        return { top, left, placement };
    }

    /**
     * Format tooltip text with better structure
     */
    function formatTooltipContent(text, status) {
        const escapeHtml = value => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const highlightNumbers = value => {
            const safe = escapeHtml(value);
            return safe.replace(/([+\-]?\d+(?:\.\d+)?%?)/g, '<span class="tooltip-highlight">$1</span>');
        };

        const raw = String(text || '').trim();
        if (!raw) return '';

        // Parse structured content (bullet points)
        const parts = raw.split('•').map(s => s.trim()).filter(s => s);
        
        if (parts.length > 1) {
            // Multi-line format for structured content with line breaks
            return parts.map(highlightNumbers).join('<br>');
        }
        
        // Single line fallback
        return highlightNumbers(raw);
    }

    /**
     * Show tooltip
     */
    function showTooltip(target, text) {
        if (!text || text.trim() === '') return;

        if (hideAnimationTimeout) {
            clearTimeout(hideAnimationTimeout);
            hideAnimationTimeout = null;
        }

        const tooltip = createTooltipElement();
        const status = target.getAttribute('data-status') || '';
        
        // Format and set content with HTML structure
        const formattedContent = formatTooltipContent(text, status);
        tooltip.innerHTML = `<span class="tooltip-content">${formattedContent}</span>`;
        tooltip.className = 'status-tooltip ' + getStatusTooltipClass(status);
        
        // Make visible to measure
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';
        tooltip.setAttribute('aria-hidden', 'false');

        // Calculate position
        const position = calculateTooltipPosition(target, tooltip);
        
        // Apply position
        tooltip.style.top = position.top + 'px';
        tooltip.style.left = position.left + 'px';
        tooltip.setAttribute('data-placement', position.placement);
        
        // Show tooltip with animation
        tooltip.style.visibility = 'visible';
        // Trigger reflow for animation
        void tooltip.offsetWidth;
        tooltip.style.opacity = '1';
        tooltip.classList.add('showing');

        currentTarget = target;
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (!tooltipElement) return;

        if (showDelayTimeout) {
            clearTimeout(showDelayTimeout);
            showDelayTimeout = null;
        }
        
        tooltipElement.classList.remove('showing');
        tooltipElement.style.opacity = '0';
        tooltipElement.setAttribute('aria-hidden', 'true');
        
        if (hideAnimationTimeout) {
            clearTimeout(hideAnimationTimeout);
        }

        // Remove after quick transition
        hideAnimationTimeout = setTimeout(() => {
            if (tooltipElement) {
                tooltipElement.style.display = 'none';
                tooltipElement.style.visibility = 'hidden';
            }
            currentTarget = null;
            hideAnimationTimeout = null;
        }, 80);
    }

    function getTooltipText(target) {
        // Primary tooltip text from data-blurb or title
        const blurb = target.getAttribute('data-blurb') || target.getAttribute('title') || '';
        // Additional status info (e.g., win/loss records like "2W-1L-0P")
        const statusInfo = target.getAttribute('data-status-info') || '';
        
        // Combine both if available, separated by a bullet point
        let text = blurb.trim();
        if (statusInfo && text) {
            text = `${text} • ${statusInfo}`;
        } else if (statusInfo) {
            text = statusInfo;
        }
        
        // Fallback to textContent if no data attributes
        if (!text) {
            text = target.textContent || '';
        }
        
        return text.trim();
    }

    /**
     * Handle mouse enter
     */
    function handleMouseEnter(e) {
        const target = e.currentTarget;
        
        // Remove title attribute to prevent native browser tooltip
        if (target.hasAttribute('title')) {
            const titleText = target.getAttribute('title');
            if (titleText && !target.hasAttribute('data-blurb')) {
                target.setAttribute('data-blurb', titleText);
            }
            target.removeAttribute('title');
        }
        
        const text = getTooltipText(target);
        
        if (!text) return;

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        if (showDelayTimeout) {
            clearTimeout(showDelayTimeout);
            showDelayTimeout = null;
        }
        
        // Show immediately for snappy feel
        showTooltip(target, text);
    }

    /**
     * Handle mouse leave
     */
    function handleMouseLeave(e) {
        if (showDelayTimeout) {
            clearTimeout(showDelayTimeout);
            showDelayTimeout = null;
        }
        // Hide immediately for snappy feel
        hideTooltip();
    }

    /**
     * Handle focus (keyboard navigation)
     */
    function handleFocus(e) {
        const target = e.currentTarget;
        const text = getTooltipText(target);
        if (!text) return;

        if (showDelayTimeout) {
            clearTimeout(showDelayTimeout);
            showDelayTimeout = null;
        }

        showTooltip(target, text);
    }

    /**
     * Handle blur
     */
    function handleBlur() {
        if (showDelayTimeout) {
            clearTimeout(showDelayTimeout);
            showDelayTimeout = null;
        }
        hideTooltip();
    }

    /**
     * Initialize tooltips for all status badges
     */
    function initializeStatusTooltips() {
        const badges = document.querySelectorAll(BADGE_SELECTOR);
        
        badges.forEach(badge => {
            // Remove title attribute to prevent native browser tooltip
            if (badge.hasAttribute('title')) {
                const titleText = badge.getAttribute('title');
                if (titleText && !badge.hasAttribute('data-blurb')) {
                    badge.setAttribute('data-blurb', titleText);
                }
                badge.removeAttribute('title');
            }
            
            // Remove old event listeners if any
            badge.removeEventListener('mouseenter', handleMouseEnter);
            badge.removeEventListener('mouseleave', handleMouseLeave);
            badge.removeEventListener('focus', handleFocus);
            badge.removeEventListener('blur', handleBlur);
            
            // Add new event listeners
            badge.addEventListener('mouseenter', handleMouseEnter);
            badge.addEventListener('mouseleave', handleMouseLeave);
            badge.addEventListener('focus', handleFocus, true);
            badge.addEventListener('blur', handleBlur, true);
            // Make focusable for keyboard navigation
            if (!badge.hasAttribute('tabindex')) {
                badge.setAttribute('tabindex', '0');
            }

        });
    }

    /**
     * Update tooltip position on scroll/resize
     */
    function updateTooltipPosition() {
        if (currentTarget && tooltipElement && tooltipElement.style.opacity === '1') {
            const text = getTooltipText(currentTarget);
            if (text) {
                showTooltip(currentTarget, text);
            }
        }
    }

    // Use event delegation for dynamically created elements
    function setupEventDelegation() {
        // Remove any existing delegated listeners
        document.removeEventListener('mouseenter', delegatedMouseEnter, true);
        document.removeEventListener('mouseleave', delegatedMouseLeave, true);
        document.removeEventListener('focusin', delegatedFocus, true);
        document.removeEventListener('focusout', delegatedBlur, true);

        // Add delegated listeners
        document.addEventListener('mouseenter', delegatedMouseEnter, true);
        document.addEventListener('mouseleave', delegatedMouseLeave, true);
        document.addEventListener('focusin', delegatedFocus, true);
        document.addEventListener('focusout', delegatedBlur, true);
    }

    function delegatedMouseEnter(e) {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest(BADGE_SELECTOR);
        if (!target) return;
        handleMouseEnter({ currentTarget: target });
    }

    function delegatedMouseLeave(e) {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest(BADGE_SELECTOR);
        if (!target) return;
        handleMouseLeave({ currentTarget: target });
    }

    function delegatedFocus(e) {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest(BADGE_SELECTOR);
        if (!target) return;
        handleFocus({ currentTarget: target });
    }

    function delegatedBlur(e) {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest(BADGE_SELECTOR);
        if (!target) return;
        handleBlur();
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeStatusTooltips();
            setupEventDelegation();
        });
    } else {
        initializeStatusTooltips();
        setupEventDelegation();
    }

    // Re-initialize when table updates
    const originalUpdateTable = window.updateTable || function() {};
    window.updateTable = function() {
        originalUpdateTable.apply(this, arguments);
        setTimeout(initializeStatusTooltips, 100);
    };

    // Update position on scroll/resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateTooltipPosition, 100);
    });

    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateTooltipPosition, 50);
    }, { passive: true });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (tooltipElement) {
            tooltipElement.remove();
        }
    });

    // Expose for external use
    window.statusTooltipSystem = {
        initialize: initializeStatusTooltips,
        setupDelegation: setupEventDelegation,
        show: showTooltip,
        hide: hideTooltip
    };

})();
