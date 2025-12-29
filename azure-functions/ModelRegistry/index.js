const { TableClient } = require('@azure/data-tables');

const MODEL_ENDPOINTS = {
    nba: process.env.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
    ncaam: process.env.NCAAM_API_URL || 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
    nfl: process.env.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
    ncaaf: process.env.NCAAF_API_URL || 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'
};

const DEFAULT_ALLOWED_ORIGINS = ['*'];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req) {
    const origin = req.headers?.origin;
    const allowOrigin = ALLOWED_ORIGINS.includes('*')
        ? '*'
        : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*');

    const headers = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key',
        'Access-Control-Max-Age': '86400'
    };

    if (allowOrigin !== '*') {
        headers['Vary'] = 'Origin';
    }

    return headers;
}

function sendResponse(context, req, status, body, extraHeaders = {}) {
    context.res = {
        status,
        headers: {
            ...buildCorsHeaders(req),
            ...extraHeaders
        },
        body
    };
}

module.exports = async function (context, req) {
    const action = context.bindingData.action || 'get';

    try {
        if (req.method === 'OPTIONS') {
            sendResponse(context, req, 204, null);
            return;
        }

        const tableClient = TableClient.fromConnectionString(
            process.env.AzureWebJobsStorage,
            'modelregistry'
        );

        if (req.method === 'GET' || action === 'get') {
            // Return current model registry
            const registry = {};
            
            const entities = tableClient.listEntities();
            for await (const entity of entities) {
                registry[entity.partitionKey] = {
                    version: entity.version,
                    endpoint: entity.endpoint,
                    lastUpdated: entity.lastUpdated,
                    healthy: entity.healthy !== false
                };
            }

            // Include default endpoints for models not in registry
            for (const [model, endpoint] of Object.entries(MODEL_ENDPOINTS)) {
                if (!registry[model]) {
                    registry[model] = {
                        version: '1.0.0',
                        endpoint: endpoint,
                        lastUpdated: new Date().toISOString(),
                        healthy: true
                    };
                }
            }

            sendResponse(context, req, 200, registry, {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            });

        } else if (req.method === 'POST' && action === 'update') {
            // Update model registry entry
            const { model, version, endpoint } = req.body;

            if (!model) {
                sendResponse(context, req, 400, { error: 'Model type is required' });
                return;
            }

            const entity = {
                partitionKey: model.toLowerCase(),
                rowKey: 'current',
                version: version || '1.0.0',
                endpoint: endpoint || MODEL_ENDPOINTS[model.toLowerCase()],
                lastUpdated: new Date().toISOString(),
                healthy: true
            };

            await tableClient.upsertEntity(entity);

            sendResponse(context, req, 200, {
                message: 'Registry updated successfully',
                model: model,
                version: version
            });

        } else {
            sendResponse(context, req, 400, { error: 'Invalid action' });
        }

    } catch (error) {
        context.log.error('Error in ModelRegistry:', error);
        sendResponse(context, req, 500, {
            error: 'Internal server error',
            message: error.message
        });
    }
};
