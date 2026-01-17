/**
 * Utility script to check NCAAM model version
 * Run this in browser console on weekly-lineup.html page
 */

(async function checkNCAAMVersion() {
    console.log('🔍 Checking NCAAM Model Version...\n');

    // 1. Check Registry Version
    try {
        const registryBase = window.APP_CONFIG?.API_BASE_URL || window.APP_CONFIG?.API_BASE_FALLBACK || `${window.location.origin}/api`;
        const registryUrl = `${registryBase}/registry`;
        console.log('📋 Checking Registry:', registryUrl);
        const registryRes = await fetch(registryUrl);
        if (registryRes.ok) {
            const registry = await registryRes.json();
            const ncaamEntry = registry?.ncaam;
            if (ncaamEntry) {
                console.log('✅ Registry Entry:');
                console.log('   Endpoint:', ncaamEntry.endpoint);
                console.log('   Version:', ncaamEntry.version || 'Not specified');
                console.log('   Last Updated:', ncaamEntry.lastUpdated || 'Unknown');
                console.log('   Source:', ncaamEntry.source || 'registry');
            } else {
                console.log('⚠️  No NCAAM entry in registry');
            }
        }
    } catch (err) {
        console.warn('❌ Registry check failed:', err.message);
    }

    console.log('\n');

    // 2. Check API Response Version
    try {
        const endpoint = window.ModelEndpointResolver?.getApiEndpoint?.('ncaam') ||
                        window.APP_CONFIG?.NCAAM_API_URL ||
                        window.NCAAMPicksFetcher?.getEndpoint?.();
        if (!endpoint) {
            throw new Error('No NCAAM endpoint configured');
        }
        const apiUrl = `${endpoint}/api/picks/today`;
        console.log('🌐 Checking API Response:', apiUrl);

        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
            const data = await apiRes.json();

            // Extract version from response
            const version = data.model_version ||
                          data.modelVersion ||
                          data.model_tag ||
                          data.modelTag ||
                          data.meta?.model_version ||
                          data.meta?.model_tag ||
                          data.metadata?.model_version ||
                          data.metadata?.model_tag ||
                          'Not found in response';

            console.log('✅ API Response:');
            console.log('   Model Version/Tag:', version);
            console.log('   Total Picks:', data.total_picks || data.picks?.length || 0);

            // Check if picks have version info
            if (data.picks && data.picks.length > 0) {
                const firstPick = data.picks[0];
                const pickVersion = firstPick.model_version ||
                                  firstPick.modelVersion ||
                                  firstPick.model_tag ||
                                  firstPick.modelTag ||
                                  'Not in pick data';
                console.log('   Version in Pick Data:', pickVersion);
            }
        } else {
            console.warn(`⚠️  API returned ${apiRes.status}: ${apiRes.statusText}`);
        }
    } catch (err) {
        console.warn('❌ API check failed:', err.message);
    }

    console.log('\n');

    // 3. Check Currently Displayed Version
    try {
        const stampEl = document.getElementById('ft-model-stamp');
        if (stampEl) {
            console.log('📊 Currently Displayed:');
            console.log('   Text:', stampEl.textContent);
            console.log('   Title:', stampEl.title);
        }

        // Check picks in table
        const picks = window.UnifiedPicksFetcher?.getCache?.('today') ||
                     window.NCAAMPicksFetcher?.getCache?.('today');
        if (picks && picks.picks) {
            const ncaamPicks = picks.picks.filter(p =>
                (p.sport || '').toUpperCase() === 'NCAAM' ||
                (p.sport || '').toUpperCase() === 'NCAAB'
            );
            if (ncaamPicks.length > 0) {
                const versions = new Set();
                ncaamPicks.forEach(p => {
                    const v = p.model_version || p.modelVersion || p.model_tag || p.modelTag || p.modelStamp;
                    if (v) versions.add(v);
                });
                console.log('   Versions in cached picks:', Array.from(versions).join(', ') || 'None');
            }
        }
    } catch (err) {
        console.warn('❌ Display check failed:', err.message);
    }

    console.log('\n✅ Version check complete!');
})();
