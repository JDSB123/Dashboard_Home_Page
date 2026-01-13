const { CosmosClient } = require("@azure/cosmos");

/**
 * Picks API - Enterprise-grade Azure Cosmos DB storage
 * 
 * Routes:
 *   GET    /api/picks                - List all picks (with filters)
 *   GET    /api/picks/active         - List active/pending picks only
 *   GET    /api/picks/settled        - List settled picks only
 *   GET    /api/picks/{id}           - Get single pick by ID
 *   POST   /api/picks                - Create new pick(s)
 *   PATCH  /api/picks/{id}           - Update pick status/result
 *   DELETE /api/picks/{id}           - Delete a pick
 *   DELETE /api/picks/clear          - Clear all picks (admin only)
 * 
 * Query Parameters:
 *   ?league=NBA                      - Filter by league
 *   ?status=pending                  - Filter by status
 *   ?date=2026-01-12                 - Filter by game date
 *   ?from=2026-01-01&to=2026-01-12   - Date range filter
 *   ?limit=50                        - Limit results (default: 100)
 */

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
    'https://www.greenbiersportventures.com',
    'https://wittypebble-41c11c65.eastus.azurestaticapps.net',
    'http://localhost:3000',
    'http://localhost:8080'
];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',').map(o => o.trim()).filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req) {
    const origin = req.headers?.origin;
    const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

// Cosmos DB client (lazy initialization)
let cosmosClient = null;
let container = null;

async function getContainer() {
    if (container) return container;

    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || 'picks-db';
    const containerId = process.env.COSMOS_CONTAINER || 'picks';

    if (!endpoint || !key) {
        throw new Error('Cosmos DB not configured: COSMOS_ENDPOINT and COSMOS_KEY required');
    }

    cosmosClient = new CosmosClient({ endpoint, key });
    const database = cosmosClient.database(databaseId);
    container = database.container(containerId);

    return container;
}

// Generate unique pick ID
function generatePickId(pick) {
    const league = (pick.league || pick.sport || 'unknown').toUpperCase();
    const date = pick.gameDate || pick.date || new Date().toISOString().split('T')[0];
    const matchup = (pick.game || pick.matchup || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 40);
    const random = Math.random().toString(36).substring(2, 8);
    return `${league}-${date}-${matchup}-${random}`;
}

// Normalize pick document for storage
function normalizePick(pick, existingId = null) {
    const now = new Date().toISOString();
    const league = (pick.league || pick.sport || 'NBA').toUpperCase();

    // Map league variants
    const leagueMap = {
        'NCAAM': 'NCAAB', 'CBB': 'NCAAB', 'COLLEGE BASKETBALL': 'NCAAB',
        'CFB': 'NCAAF', 'COLLEGE FOOTBALL': 'NCAAF'
    };
    const normalizedLeague = leagueMap[league] || league;

    return {
        id: existingId || pick.id || generatePickId(pick),
        league: normalizedLeague,
        sport: normalizedLeague,
        game: pick.game || pick.matchup || `${pick.awayTeam || ''} @ ${pick.homeTeam || ''}`.trim(),
        awayTeam: pick.awayTeam || '',
        homeTeam: pick.homeTeam || '',
        pickType: (pick.pickType || 'spread').toLowerCase(),
        pickDirection: pick.pickDirection || '',
        pickTeam: pick.pickTeam || pick.team || '',
        line: pick.line || '',
        odds: pick.odds || pick.price || '',
        risk: parseFloat(pick.risk) || 0,
        toWin: parseFloat(pick.toWin || pick.win) || 0,
        segment: pick.segment || 'Full Game',
        sportsbook: pick.sportsbook || pick.book || 'Manual',
        gameDate: pick.gameDate || pick.date || now.split('T')[0],
        gameTime: pick.gameTime || '',
        status: (pick.status || 'pending').toLowerCase(),
        result: pick.result || '',
        pnl: parseFloat(pick.pnl) || 0,
        createdAt: pick.createdAt || now,
        updatedAt: now,
        source: pick.source || 'dashboard',
        model: pick.model || pick.modelStamp || ''
    };
}

// Build Cosmos DB query from request parameters
function buildQuery(query) {
    const conditions = [];
    const parameters = [];

    // Status filter
    if (query.status) {
        const statuses = query.status.split(',').map(s => s.trim().toLowerCase());
        const statusConditions = statuses.map((s, i) => `LOWER(c.status) = @status${i}`);
        conditions.push(`(${statusConditions.join(' OR ')})`);
        statuses.forEach((s, i) => parameters.push({ name: `@status${i}`, value: s }));
    }

    // Active filter (pending, live, on-track, at-risk)
    if (query.active === 'true') {
        conditions.push("(LOWER(c.status) IN ('pending', 'live', 'on-track', 'at-risk'))");
    }

    // Settled filter (win, won, loss, lost, push)
    if (query.settled === 'true') {
        conditions.push("(LOWER(c.status) IN ('win', 'won', 'loss', 'lost', 'push'))");
    }

    // League filter
    if (query.league) {
        conditions.push("UPPER(c.league) = @league");
        parameters.push({ name: '@league', value: query.league.toUpperCase() });
    }

    // Date filter (exact)
    if (query.date) {
        conditions.push("c.gameDate = @date");
        parameters.push({ name: '@date', value: query.date });
    }

    // Date range filter
    if (query.from) {
        conditions.push("c.gameDate >= @fromDate");
        parameters.push({ name: '@fromDate', value: query.from });
    }
    if (query.to) {
        conditions.push("c.gameDate <= @toDate");
        parameters.push({ name: '@toDate', value: query.to });
    }

    // Sportsbook filter
    if (query.sportsbook) {
        conditions.push("LOWER(c.sportsbook) = @sportsbook");
        parameters.push({ name: '@sportsbook', value: query.sportsbook.toLowerCase() });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(query.limit) || 100;

    // Use simple ORDER BY to avoid composite index requirement
    // For multi-field sorting, would need composite index on Cosmos DB
    return {
        query: `SELECT * FROM c ${whereClause} ORDER BY c.gameDate DESC OFFSET 0 LIMIT ${limit}`,
        parameters
    };
}

module.exports = async function (context, req) {
    const corsHeaders = buildCorsHeaders(req);

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    const action = context.bindingData.action || '';
    const id = context.bindingData.id || '';

    try {
        const container = await getContainer();

        // Route: GET /api/picks or GET /api/picks/active or GET /api/picks/settled
        if (req.method === 'GET' && (!action || action === 'active' || action === 'settled')) {
            const query = { ...req.query };
            if (action === 'active') query.active = 'true';
            if (action === 'settled') query.settled = 'true';

            const { query: sqlQuery, parameters } = buildQuery(query);
            context.log(`Executing query: ${sqlQuery}`);

            const { resources: picks } = await container.items
                .query({ query: sqlQuery, parameters })
                .fetchAll();

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: {
                    success: true,
                    count: picks.length,
                    picks
                }
            };
            return;
        }

        // Route: GET /api/picks/{id} - Get single pick
        if (req.method === 'GET' && action && action !== 'active' && action !== 'settled') {
            const pickId = action; // action is actually the ID in this case
            
            // Query by id (since we don't know the partition key)
            const { resources } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.id = @id",
                    parameters: [{ name: '@id', value: pickId }]
                })
                .fetchAll();

            if (resources.length === 0) {
                context.res = {
                    status: 404,
                    headers: corsHeaders,
                    body: { success: false, error: 'Pick not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: { success: true, pick: resources[0] }
            };
            return;
        }

        // Route: POST /api/picks - Create pick(s)
        if (req.method === 'POST') {
            const body = req.body;
            
            // Support both single pick and array of picks
            const picks = Array.isArray(body) ? body : (body.picks || [body]);
            const results = [];
            const errors = [];

            for (const pick of picks) {
                try {
                    const normalized = normalizePick(pick);
                    const { resource } = await container.items.create(normalized);
                    results.push(resource);
                } catch (err) {
                    if (err.code === 409) {
                        // Conflict - item exists, try upsert
                        const normalized = normalizePick(pick);
                        const { resource } = await container.items.upsert(normalized);
                        results.push(resource);
                    } else {
                        errors.push({ pick: pick.id || 'unknown', error: err.message });
                    }
                }
            }

            context.res = {
                status: results.length > 0 ? 201 : 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: {
                    success: results.length > 0,
                    created: results.length,
                    errors: errors.length,
                    picks: results,
                    errorDetails: errors.length > 0 ? errors : undefined
                }
            };
            return;
        }

        // Route: PATCH /api/picks/{id} - Update pick
        if (req.method === 'PATCH' && action) {
            const pickId = action;
            const updates = req.body;

            // Find existing pick
            const { resources } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.id = @id",
                    parameters: [{ name: '@id', value: pickId }]
                })
                .fetchAll();

            if (resources.length === 0) {
                context.res = {
                    status: 404,
                    headers: corsHeaders,
                    body: { success: false, error: 'Pick not found' }
                };
                return;
            }

            const existing = resources[0];
            const updated = {
                ...existing,
                ...updates,
                id: existing.id, // Preserve original ID
                league: existing.league, // Preserve partition key
                updatedAt: new Date().toISOString()
            };

            const { resource } = await container.items.upsert(updated);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: { success: true, pick: resource }
            };
            return;
        }

        // Route: DELETE /api/picks/{id} - Delete pick
        if (req.method === 'DELETE' && action) {
            // Special case: clear all
            if (action === 'clear') {
                // Security: require confirmation header
                if (req.headers['x-confirm-clear'] !== 'true') {
                    context.res = {
                        status: 400,
                        headers: corsHeaders,
                        body: { success: false, error: 'Confirmation header required: x-confirm-clear: true' }
                    };
                    return;
                }

                // Get all picks and delete them
                const { resources } = await container.items.query("SELECT c.id, c.league FROM c").fetchAll();
                let deleted = 0;
                
                for (const pick of resources) {
                    try {
                        await container.item(pick.id, pick.league).delete();
                        deleted++;
                    } catch (e) {
                        context.log.warn(`Failed to delete ${pick.id}: ${e.message}`);
                    }
                }

                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    body: { success: true, deleted }
                };
                return;
            }

            const pickId = action;

            // Find existing pick to get partition key
            const { resources } = await container.items
                .query({
                    query: "SELECT c.id, c.league FROM c WHERE c.id = @id",
                    parameters: [{ name: '@id', value: pickId }]
                })
                .fetchAll();

            if (resources.length === 0) {
                context.res = {
                    status: 404,
                    headers: corsHeaders,
                    body: { success: false, error: 'Pick not found' }
                };
                return;
            }

            const pick = resources[0];
            await container.item(pick.id, pick.league).delete();

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: { success: true, deleted: pickId }
            };
            return;
        }

        // Unknown route
        context.res = {
            status: 400,
            headers: corsHeaders,
            body: { error: 'Invalid request' }
        };

    } catch (error) {
        context.log.error('PicksAPI error:', error.message, error.stack);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                success: false,
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
    }
};
