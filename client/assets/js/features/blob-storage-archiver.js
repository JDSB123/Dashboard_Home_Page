/**
 * Blob Storage Archiver v1.0.0
 * Archives weekly lineup picks to Azure Blob Storage
 * 
 * Archives are triggered:
 * 1. When all picks in a slate expire (games completed)
 * 2. When a refresh replaces existing picks
 * 3. Manual archive via UI button
 */

(function() {
    'use strict';

    const ARCHIVE_ENDPOINT = window.APP_CONFIG?.FUNCTIONS_BASE_URL 
        ? `${window.APP_CONFIG.FUNCTIONS_BASE_URL}/api/archive-picks`
        : '/api/archive-picks';

    class BlobStorageArchiver {
        constructor() {
            this.pendingArchives = [];
            this.isArchiving = false;
            this.archiveContainerName = 'weekly-lineup-archives';
        }

        /**
         * Archive picks to Azure Blob Storage
         * @param {Array} picks - Array of pick objects to archive
         * @param {Object} metadata - Additional metadata (source, timestamp, etc.)
         */
        async archivePicks(picks, metadata = {}) {
            if (!picks || picks.length === 0) {
                console.log('No picks to archive');
                return { success: false, reason: 'No picks provided' };
            }

            const archivePayload = {
                id: this._generateArchiveId(),
                timestamp: new Date().toISOString(),
                source: metadata.source || 'weekly-lineup',
                triggerReason: metadata.triggerReason || 'manual',
                picksCount: picks.length,
                picks: picks,
                metadata: {
                    userAgent: navigator.userAgent,
                    archiveVersion: '1.0.0',
                    ...metadata
                }
            };

            try {
                this.isArchiving = true;
                
                // Show archiving indicator
                this._showArchiveProgress('Archiving picks to cloud storage...');

                const response = await fetch(ARCHIVE_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(archivePayload)
                });

                if (!response.ok) {
                    throw new Error(`Archive failed: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();

                console.log('✅ Picks archived successfully:', result);
                this._showArchiveProgress('Archived successfully!', 'success');

                // Emit event for other components
                window.dispatchEvent(new CustomEvent('picks:archived', {
                    detail: { archiveId: archivePayload.id, count: picks.length }
                }));

                return { success: true, archiveId: archivePayload.id, blobUrl: result.blobUrl };

            } catch (error) {
                console.error('Archive failed:', error);
                this._showArchiveProgress('Archive failed - saving locally', 'error');
                
                // Fall back to local storage archive
                this._archiveLocally(archivePayload);
                
                return { success: false, error: error.message, localFallback: true };
            } finally {
                this.isArchiving = false;
                setTimeout(() => this._hideArchiveProgress(), 3000);
            }
        }

        /**
         * Archive when weekly lineup is refreshed
         * Called before new picks replace old ones
         */
        async archiveOnRefresh(currentPicks, sport = 'all') {
            if (!currentPicks || currentPicks.length === 0) {
                return;
            }

            return this.archivePicks(currentPicks, {
                triggerReason: 'refresh',
                sport: sport,
                replacedAt: new Date().toISOString()
            });
        }

        /**
         * Archive when all games in a slate are complete
         */
        async archiveCompletedSlate(picks) {
            if (!picks || picks.length === 0) {
                return;
            }

            // Calculate stats before archiving
            const stats = this._calculateSlateStats(picks);

            return this.archivePicks(picks, {
                triggerReason: 'slate-complete',
                stats: stats,
                completedAt: new Date().toISOString()
            });
        }

        /**
         * Calculate stats for a completed slate
         */
        _calculateSlateStats(picks) {
            let wins = 0, losses = 0, pushes = 0, pending = 0;

            picks.forEach(pick => {
                const outcome = (pick.outcome || pick.result || '').toUpperCase();
                if (outcome === 'W' || outcome === 'WIN') wins++;
                else if (outcome === 'L' || outcome === 'LOSS') losses++;
                else if (outcome === 'P' || outcome === 'PUSH') pushes++;
                else pending++;
            });

            const decided = wins + losses;
            const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) : 0;

            return {
                total: picks.length,
                wins, losses, pushes, pending,
                winRate: parseFloat(winRate),
                record: `${wins}-${losses}${pushes > 0 ? '-' + pushes : ''}`
            };
        }

        /**
         * Get archived picks from blob storage
         * @param {Object} filters - Optional filters (date range, sport, etc.)
         */
        async getArchivedPicks(filters = {}) {
            const queryParams = new URLSearchParams(filters).toString();
            const url = `${ARCHIVE_ENDPOINT}?${queryParams}`;

            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch archives: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Failed to fetch archived picks:', error);
                
                // Fall back to local archives
                return this._getLocalArchives(filters);
            }
        }

        /**
         * Fall back to local storage if blob storage fails
         */
        _archiveLocally(archivePayload) {
            const localKey = 'gbsv_blob_archive_fallback';
            
            try {
                const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
                existing.push(archivePayload);
                
                // Keep last 50 archives locally
                if (existing.length > 50) {
                    existing.shift();
                }
                
                localStorage.setItem(localKey, JSON.stringify(existing));
                console.log('Archived to localStorage as fallback');
            } catch (e) {
                console.error('Local archive also failed:', e);
            }
        }

        /**
         * Get local fallback archives
         */
        _getLocalArchives(filters) {
            const localKey = 'gbsv_blob_archive_fallback';
            
            try {
                const archives = JSON.parse(localStorage.getItem(localKey) || '[]');
                
                // Apply filters if provided
                if (filters.sport) {
                    return archives.filter(a => a.metadata?.sport === filters.sport);
                }
                
                return archives;
            } catch (e) {
                return [];
            }
        }

        /**
         * Sync local fallback archives to blob storage
         * Call this when connection is restored
         */
        async syncLocalArchives() {
            const localKey = 'gbsv_blob_archive_fallback';
            
            try {
                const localArchives = JSON.parse(localStorage.getItem(localKey) || '[]');
                
                if (localArchives.length === 0) {
                    return { synced: 0 };
                }

                let synced = 0;
                const failed = [];

                for (const archive of localArchives) {
                    try {
                        const response = await fetch(ARCHIVE_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...archive,
                                metadata: { ...archive.metadata, syncedFromLocal: true }
                            })
                        });

                        if (response.ok) {
                            synced++;
                        } else {
                            failed.push(archive);
                        }
                    } catch (e) {
                        failed.push(archive);
                    }
                }

                // Keep only failed ones in local storage
                localStorage.setItem(localKey, JSON.stringify(failed));

                console.log(`Synced ${synced} archives, ${failed.length} failed`);
                return { synced, failed: failed.length };

            } catch (e) {
                console.error('Sync failed:', e);
                return { synced: 0, error: e.message };
            }
        }

        /**
         * Generate unique archive ID
         */
        _generateArchiveId() {
            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const rand = Math.random().toString(36).substring(2, 8);
            return `archive-${date}-${rand}`;
        }

        /**
         * Show archive progress indicator
         */
        _showArchiveProgress(message, type = 'info') {
            // Create or update progress indicator
            let indicator = document.getElementById('archive-progress-indicator');
            
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'archive-progress-indicator';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    z-index: 10000;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                `;
                document.body.appendChild(indicator);
            }

            // Set color based on type
            const colors = {
                info: { bg: '#1a365d', border: '#3182ce', text: '#90cdf4' },
                success: { bg: '#1c4532', border: '#38a169', text: '#9ae6b4' },
                error: { bg: '#742a2a', border: '#e53e3e', text: '#feb2b2' }
            };
            const c = colors[type] || colors.info;
            
            indicator.style.backgroundColor = c.bg;
            indicator.style.border = `1px solid ${c.border}`;
            indicator.style.color = c.text;
            
            const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '↻';
            indicator.innerHTML = `<span>${icon}</span> ${message}`;
            indicator.style.display = 'flex';
        }

        /**
         * Hide archive progress indicator
         */
        _hideArchiveProgress() {
            const indicator = document.getElementById('archive-progress-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    }

    // Create singleton instance
    window.BlobStorageArchiver = new BlobStorageArchiver();

})();
