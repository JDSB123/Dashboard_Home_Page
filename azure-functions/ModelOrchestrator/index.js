const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { TableClient } = require('@azure/data-tables');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Model configuration defaults (overridden by registry table when present)
const MODEL_CONFIG = {
    nba: {
        endpoint: process.env.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
        resourceGroup: 'nba-gbsv-model-rg'
    },
    ncaam: {
        endpoint: process.env.NCAAM_API_URL || 'https://ncaam-stable-prediction.blackglacier-5fab3573.centralus.azurecontainerapps.io',
        resourceGroup: 'ncaam-gbsv-model-rg'
    },
    nfl: {
        endpoint: process.env.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
        resourceGroup: 'nfl-gbsv-model-rg'
    },
    ncaaf: {
        endpoint: process.env.NCAAF_API_URL || 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
        resourceGroup: 'ncaaf-gbsv-model-rg'
    }
};

const MODEL_REGISTRY_TABLE = process.env.MODEL_REGISTRY_TABLE || 'modelregistry';
const STORAGE_CONNECTION = process.env.AzureWebJobsStorage;

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
        'Access-Control-Expose-Headers': 'Location',
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

async function resolveModelEndpoint(modelType, context) {
    // Prefer registry table so endpoint updates do not require a code deploy
    try {
        if (!STORAGE_CONNECTION) {
            context.log.warn('AzureWebJobsStorage not configured; falling back to defaults');
            return MODEL_CONFIG[modelType]?.endpoint;
        }

        const registryClient = TableClient.fromConnectionString(
            STORAGE_CONNECTION,
            MODEL_REGISTRY_TABLE
        );

        const registry = registryClient.listEntities({
            queryOptions: {
                filter: `PartitionKey eq '${modelType}' and RowKey eq 'current'`
            }
        });

        for await (const entity of registry) {
            if (entity.endpoint) {
                return entity.endpoint;
            }
        }
    } catch (err) {
        context.log.warn('Model registry lookup failed; using defaults', err.message);
    }

    return MODEL_CONFIG[modelType]?.endpoint;
}

module.exports = async function (context, req) {
    context.log('ModelOrchestrator triggered with request:', JSON.stringify(req.body));

    try {
        if (req.method === 'OPTIONS') {
            sendResponse(context, req, 204, null);
            return;
        }

        // Validate request
        const { model, params = {} } = req.body || {};
        
        if (!model || !MODEL_CONFIG[model.toLowerCase()]) {
            sendResponse(context, req, 400, {
                error: 'Invalid model type. Valid options: nba, ncaam, nfl, ncaaf'
            });
            return;
        }

        const modelType = model.toLowerCase();
        const resolvedEndpoint = await resolveModelEndpoint(modelType, context);

        if (!resolvedEndpoint) {
            sendResponse(context, req, 500, {
                error: 'No endpoint configured for requested model'
            });
            return;
        }
        
        // Generate job ID
        const jobId = uuidv4();
        const timestamp = new Date().toISOString();

        // Create job record in Table Storage
        const tableClient = TableClient.fromConnectionString(
            STORAGE_CONNECTION,
            'modelexecutions'
        );

        const jobEntity = {
            partitionKey: modelType,
            rowKey: jobId,
            status: 'queued',
            model: modelType,
            params: JSON.stringify(params),
            createdAt: timestamp,
            endpoint: resolvedEndpoint
        };

        await tableClient.createEntity(jobEntity);

        // Queue job for async processing
        context.bindings.jobQueue = {
            jobId,
            modelType,
            params,
            endpoint: resolvedEndpoint,
            timestamp
        };

        // Return job ID to client
        sendResponse(context, req, 202, {
            jobId,
            status: 'queued',
            model: modelType,
            message: 'Model execution queued successfully',
            statusUrl: `/api/status/${jobId}`
        }, {
            'Content-Type': 'application/json',
            'Location': `/api/status/${jobId}`
        });

    } catch (error) {
        context.log.error('Error in ModelOrchestrator:', error);
        sendResponse(context, req, 500, {
            error: 'Internal server error',
            message: error.message
        });
    }
};
