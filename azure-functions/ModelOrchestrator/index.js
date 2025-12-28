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
        // Validate request
        const { model, params = {} } = req.body;
        
        if (!model || !MODEL_CONFIG[model.toLowerCase()]) {
            context.res = {
                status: 400,
                body: {
                    error: 'Invalid model type. Valid options: nba, ncaam, nfl, ncaaf'
                }
            };
            return;
        }

        const modelType = model.toLowerCase();
        const resolvedEndpoint = await resolveModelEndpoint(modelType, context);

        if (!resolvedEndpoint) {
            context.res = {
                status: 500,
                body: {
                    error: 'No endpoint configured for requested model'
                }
            };
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
        context.res = {
            status: 202,
            headers: {
                'Content-Type': 'application/json',
                'Location': `/api/status/${jobId}`
            },
            body: {
                jobId,
                status: 'queued',
                model: modelType,
                message: 'Model execution queued successfully',
                statusUrl: `/api/status/${jobId}`
            }
        };

    } catch (error) {
        context.log.error('Error in ModelOrchestrator:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Internal server error',
                message: error.message
            }
        };
    }
};
