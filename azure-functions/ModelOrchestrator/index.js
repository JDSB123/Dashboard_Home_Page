const { TableClient } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');
const { getAllowedOrigins, buildCorsHeaders, sendResponse } = require('../shared/http');
const { getModelDefaults, resolveModelEndpoint } = require('../shared/model-registry');

// Model configuration defaults (overridden by registry table when present)
const MODEL_CONFIG = getModelDefaults();

const ALLOWED_ORIGINS = getAllowedOrigins(['*']);


module.exports = async function (context, req) {
    context.log('ModelOrchestrator triggered with request:', JSON.stringify(req.body));

    const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
        methods: 'GET,POST,OPTIONS',
        headers: 'Content-Type, x-functions-key',
        exposeHeaders: 'Location'
    });

    try {
        if (req.method === 'OPTIONS') {
            sendResponse(context, req, 204, null, {}, corsHeaders);
            return;
        }

        // Validate request
        const { model, params = {} } = req.body || {};

        if (!model || !MODEL_CONFIG[model.toLowerCase()]) {
            sendResponse(context, req, 400, {
                error: 'Invalid model type. Valid options: nba, ncaam, nfl, ncaaf'
            }, {}, corsHeaders);
            return;
        }

        const modelType = model.toLowerCase();
        const resolvedEndpoint = await resolveModelEndpoint(modelType, context, {
            defaults: {
                nba: { endpoint: process.env.NBA_API_URL || MODEL_CONFIG.nba.endpoint },
                ncaam: { endpoint: process.env.NCAAM_API_URL || MODEL_CONFIG.ncaam.endpoint },
                nfl: { endpoint: process.env.NFL_API_URL || MODEL_CONFIG.nfl.endpoint },
                ncaaf: { endpoint: process.env.NCAAF_API_URL || MODEL_CONFIG.ncaaf.endpoint }
            }
        });

        if (!resolvedEndpoint) {
            sendResponse(context, req, 500, {
                error: 'No endpoint configured for requested model'
            }, {}, corsHeaders);
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
        }, corsHeaders);

    } catch (error) {
        context.log.error('Error in ModelOrchestrator:', error);
        sendResponse(context, req, 500, {
            error: 'Internal server error',
            message: error.message
        }, {}, corsHeaders);
    }
};
