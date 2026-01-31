const { TableClient } = require('@azure/data-tables');
const { getAllowedOrigins, buildCorsHeaders, sendResponse } = require('../shared/http');
const { getModelDefaults } = require('../shared/model-registry');
const { validateSharedKey } = require('../shared/auth');

const MODEL_ENDPOINTS = getModelDefaults({
    nba: { endpoint: process.env.NBA_API_URL },
    ncaam: { endpoint: process.env.NCAAM_API_URL },
    nfl: { endpoint: process.env.NFL_API_URL },
    ncaaf: { endpoint: process.env.NCAAF_API_URL }
});

const ALLOWED_ORIGINS = getAllowedOrigins(['*']);

module.exports = async function (context, req) {
    const action = context.bindingData.action || 'get';
    const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
        methods: 'GET,POST,OPTIONS',
        headers: 'Content-Type, x-functions-key',
        maxAge: '86400'
    });

    try {
        if (req.method === 'OPTIONS') {
            sendResponse(context, req, 204, null, {}, corsHeaders);
            return;
        }

        const tableName = process.env.MODEL_REGISTRY_TABLE || 'modelregistry';
        const tableClient = TableClient.fromConnectionString(
            process.env.AzureWebJobsStorage,
            tableName
        );

        if (req.method === 'GET' || action === 'get') {
            // Return current model registry
            const registry = {};

            try {
                const entities = tableClient.listEntities();
                for await (const entity of entities) {
                    const modelKey = entity.partitionKey?.toLowerCase();
                    if (modelKey && entity.endpoint) {
                        registry[modelKey] = {
                            version: entity.version || '1.0.0',
                            endpoint: entity.endpoint,
                            lastUpdated: entity.lastUpdated || entity.Timestamp || new Date().toISOString(),
                            healthy: entity.healthy !== false
                        };
                        context.log(`[ModelRegistry] Found registry entry for ${modelKey}: ${entity.endpoint}`);
                    }
                }
            } catch (err) {
                context.log.warn('[ModelRegistry] Error reading from table, using defaults:', err.message);
            }

            // Include default endpoints for models not in registry
            for (const [model, entry] of Object.entries(MODEL_ENDPOINTS)) {
                if (!registry[model]) {
                    registry[model] = {
                        version: '1.0.0',
                        endpoint: entry.endpoint,
                        lastUpdated: new Date().toISOString(),
                        healthy: true,
                        source: 'default'
                    };
                    context.log(`[ModelRegistry] Using default endpoint for ${model}: ${entry.endpoint}`);
                } else {
                    registry[model].source = 'registry';
                }
            }

            sendResponse(context, req, 200, registry, {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            }, corsHeaders);

        } else if (req.method === 'POST' && action === 'update') {
            const auth = validateSharedKey(req, context, { requireEnv: 'REQUIRE_REGISTRY_WRITE_KEY' });
            if (!auth.ok) {
                sendResponse(context, req, 401, { error: auth.reason }, {}, corsHeaders);
                return;
            }

            // Update model registry entry
            const { model, version, endpoint } = req.body;

            if (!model) {
                sendResponse(context, req, 400, { error: 'Model type is required' }, {}, corsHeaders);
                return;
            }

            const entity = {
                partitionKey: model.toLowerCase(),
                rowKey: 'current',
                version: version || '1.0.0',
                endpoint: endpoint || MODEL_ENDPOINTS[model.toLowerCase()]?.endpoint,
                lastUpdated: new Date().toISOString(),
                healthy: true
            };

            await tableClient.upsertEntity(entity);

            sendResponse(context, req, 200, {
                message: 'Registry updated successfully',
                model: model,
                version: version
            }, {}, corsHeaders);

        } else {
            sendResponse(context, req, 400, { error: 'Invalid action' }, {}, corsHeaders);
        }

    } catch (error) {
        context.log.error('Error in ModelRegistry:', error);
        sendResponse(context, req, 500, {
            error: 'Internal server error',
            message: error.message
        }, {}, corsHeaders);
    }
};
