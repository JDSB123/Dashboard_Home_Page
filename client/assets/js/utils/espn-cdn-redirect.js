/**
 * ESPN CDN Redirect - Intercepts ESPN CDN image requests and redirects to LogoLoader
 * This fixes CSP violations and eliminates external dependencies
 */

(function() {
    'use strict';

    // Override Image prototype to intercept ESPN CDN requests
    const OriginalImage = window.Image;
    
    function InterceptedImage() {
        const img = new OriginalImage();
        
        const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
        
        Object.defineProperty(img, 'src', {
            get() {
                return originalSetSrc.call(this);
            },
            set(value) {
                // Intercept ESPN CDN URLs
                if (value && value.includes('a.espncdn.com/i/teamlogos')) {
                    const redirectedUrl = redirectESPNUrl(value);
                    if (redirectedUrl) {
                        console.log(`🔄 Redirected ESPN CDN: ${value} → ${redirectedUrl}`);
                        originalSetSrc.call(this, redirectedUrl);
                        return;
                    }
                }
                originalSetSrc.call(this, value);
            },
            configurable: true
        });
        
        return img;
    }
    
    InterceptedImage.prototype = OriginalImage.prototype;
    window.Image = InterceptedImage;

    /**
     * Redirect ESPN CDN URL to LogoLoader
     */
    function redirectESPNUrl(url) {
        if (!window.LogoLoader) {
            console.warn('LogoLoader not available, cannot redirect ESPN URL');
            return null;
        }

        try {
            // Extract team ID and league from ESPN URL
            // Format: https://a.espncdn.com/i/teamlogos/{league}/{size}/{teamId}.png
            // Or: https://a.espncdn.com/i/teamlogos/leagues/{size}/{league}.png
            
            const match = url.match(/teamlogos\/(leagues\/)?([^/]+)\/(\d+)\/([^.]+)\.png/);
            if (!match) return null;

            const [, isLeague, leagueOrSize, sizeOrLeague, teamOrLeague] = match;

            if (isLeague) {
                // League logo: /teamlogos/leagues/500/nba.png
                const league = teamOrLeague.toLowerCase();
                return window.LogoLoader.getLeagueLogoUrl(league);
            } else {
                // Team logo: /teamlogos/nba/500/ny.png
                const league = leagueOrSize.toLowerCase();
                const teamId = teamOrLeague.toLowerCase();
                return window.LogoLoader.getLogoUrl(league, teamId);
            }
        } catch (e) {
            console.error('Error redirecting ESPN URL:', e);
            return null;
        }
    }

    console.log('✅ ESPN CDN Redirect installed - all ESPN image requests will be redirected to LogoLoader');
})();
