# Mobile UI Responsive Fixes

## Overview

This document describes the mobile responsive fixes implemented for the Dashboard and Weekly Lineup pages to address issues on mobile phones at common viewport widths (320px, 375px, 390px).

## Changes Made

### 1. New Mobile CSS File: `client/assets/css/mobile-fixes.css`

A comprehensive mobile-first CSS file targeting specific mobile viewport issues:

#### Key Features:

**Base Mobile Constraints (all mobile devices)**
- Prevents horizontal overflow with `overflow-x: hidden`
- Ensures 100% width usage with proper box-sizing
- Sets minimum supported width to 320px
- Applies consistent padding (12px) to all containers

**Navigation Improvements**
- Fixed header at top (56px height)
- Mobile hamburger menu implementation
- Proper z-index layering (nav: 1000, dropdown menus: 999)
- Content offset to account for fixed header (68px margin-top)

**KPI Tiles**
- Responsive grid layout: 2 columns on mobile, 1 column on very small phones (< 360px)
- Auto-height with minimum 70px
- Reduced padding and font sizes for better fit
- 4 columns in landscape mode for optimal horizontal space usage

**Filter Toolbar**
- Horizontal scrolling with touch optimization
- Sticky positioning below header
- Compact pills (40px min-height)
- Proper backdrop-filter for iOS
- No scrollbar visibility (hidden but functional)

**Table Transformation**
- Card-based layout instead of traditional table
- Each row becomes a vertically-stacked card
- Data labels added before each value
- Hide less important columns:
  - Dashboard: Box Score column
  - Weekly Lineup: Fire and Track columns
- Proper spacing with 12px gap between cards

**Cell-Specific Layouts**
- Matchup cell: Vertical stack with team logos (24px)
- Pick cell: Horizontal with wrap capability
- DateTime cell: Vertical stack for date/time/model
- League cell: Horizontal with 20px logos
- Currency/Risk-Win: Vertical stack with 120px max-width inputs

**Touch Target Optimization**
- Minimum 44x44px for all interactive elements (WCAG 2.1 Level AAA)
- Compact buttons maintain 40px minimum
- Clear focus indicators (2px solid outline)
- Touch feedback with scale transform on active state

**Typography**
- Base font size: 14px
- Minimum readable size enforced
- Labels: 0.7rem uppercase with letter-spacing
- Prevents iOS text auto-zoom with 16px minimum on inputs

**Dropdowns and Modals**
- Fixed to bottom of screen for easier thumb access
- 60vh max-height with scroll
- Border-radius on top corners only
- 48px minimum height for dropdown items

**Very Small Phones (≤ 360px)**
- Further reduced padding (8px)
- Compact card padding (10px)
- Smaller labels (0.65rem)
- Smaller buttons and pills
- Single column KPI grid

**Landscape Orientation**
- Reduced vertical padding to show more content
- 48px compact nav height
- 4-column KPI grid
- Optimized for horizontal space

**iOS Safe Areas**
- Proper env(safe-area-inset-*) support
- Nav padding adjusts for notch
- Content offset accounts for safe areas
- Bottom nav respects home indicator area

### 2. Build Configuration Update: `client/build.mjs`

Added `mobile-fixes.css` to the `SHARED_CSS` array to ensure it's included in all page bundles.

### 3. Generated Bundles

The build system now includes mobile fixes in:
- `dist/core.min.css` (151.3K) - Shared across all pages
- `dist/dashboard.min.css` (113.7K) - Dashboard-specific
- `dist/weekly-lineup.min.css` (148.6K) - Weekly Lineup-specific

## Testing Recommendations

### Manual Testing with Browser DevTools

1. **Chrome DevTools Device Toolbar**
   - Open DevTools (F12)
   - Click "Toggle device toolbar" (Ctrl+Shift+M)
   - Test these presets:
     - iPhone SE (375x667)
     - iPhone 12 Pro (390x844)
     - Galaxy S8+ (360x740)
   - Custom viewport: 320x568 (iPhone 5/SE minimum)

2. **Responsive Design Mode (Firefox)**
   - Open DevTools (F12)
   - Click "Responsive Design Mode" (Ctrl+Shift+M)
   - Test same viewports as above

3. **Safari Responsive Design Mode**
   - Develop menu → Enter Responsive Design Mode
   - Test iOS devices

### Test Checklist

For each viewport width (320px, 375px, 390px):

#### Dashboard Page (`dashboard.html`)
- [ ] KPI tiles display in proper grid (2 columns, or 1 on 320px)
- [ ] All KPI values and labels are readable
- [ ] Filter toolbar scrolls horizontally without overflow
- [ ] Filter pills are tappable (minimum 44px)
- [ ] Table displays as cards with proper spacing
- [ ] Each card shows: Date/Time, League, Matchup, Pick, Segment, Risk/Win, Status, $ Won/Lost
- [ ] Box Score column is hidden
- [ ] Matchup team names don't overflow
- [ ] Pick details are readable
- [ ] Buttons are easily tappable
- [ ] No horizontal scrolling on main content
- [ ] Navigation menu opens/closes properly
- [ ] Dropdown menus appear at bottom

#### Weekly Lineup Page (`weekly-lineup.html`)
- [ ] Similar checks as Dashboard
- [ ] Fire and Track columns are hidden
- [ ] Edge values are visible and readable
- [ ] Confidence scores display properly

#### Both Pages (Common Elements)
- [ ] Fixed header stays at top when scrolling
- [ ] Content doesn't hide under header
- [ ] Safe area insets work on iOS (notch/home indicator)
- [ ] Touch targets are minimum 44x44px
- [ ] Focus indicators are visible
- [ ] Text is readable (no clipping or overflow)
- [ ] Images/logos scale properly
- [ ] Forms inputs don't trigger auto-zoom on iOS

### Landscape Orientation
- [ ] KPI tiles show 4 columns
- [ ] Navigation is compact (48px)
- [ ] Content is optimized for horizontal space

## Known Limitations

1. **Horizontal scrolling on filters**: This is intentional design - allows more filter options without cluttering the UI
2. **Hidden columns**: Some less critical data is hidden on mobile to prioritize essential information
3. **Card view only**: Traditional table view is completely replaced with cards on mobile for better usability

## Browser Compatibility

- Chrome/Edge 90+ (full support)
- Firefox 88+ (full support)
- Safari 14+ (full support including iOS)
- Older browsers: Graceful degradation (may lack backdrop-filter, safe areas)

## Performance Considerations

- CSS is minified and bundled
- No JavaScript changes required
- No additional HTTP requests
- Total CSS bundle increase: ~15KB minified
- Uses GPU-accelerated transforms for smooth animations

## Future Improvements

Consider implementing:
1. Swipe gestures for navigation between cards
2. Pull-to-refresh on mobile
3. Bottom sheet for filter controls
4. Virtualized scrolling for very long lists
5. Progressive Web App (PWA) enhancements
6. Offline support

## References

- WCAG 2.1 Level AAA touch target guidelines: 44x44px minimum
- Material Design mobile best practices
- iOS Human Interface Guidelines for safe areas
- Android accessibility guidelines
