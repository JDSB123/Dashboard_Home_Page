const { TableClient } = require('@azure/data-tables');

const DEFAULT_MODEL_CONFIG = {
    nba: {
        endpoint: 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
        resourceGroup: 'nba-gbsv-model-rg'
    },
    ncaam: {
        endpoint: 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
        resourceGroup: 'ncaam-gbsv-model-rg'
    },
    nfl: {
        endpoint: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
        resourceGroup: 'nfl-gbsv-model-rg'
    },
    ncaaf: {
        endpoint: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
        resourceGroup: 'ncaaf-gbsv-model-rg'
    }
};

function getModelDefaults(overrides = {}) {
    return {
        ...DEFAULT_MODEL_CONFIG,
        ...(overrides || {})
    };
}

async function resolveModelEndpoint(modelType, context, options = {}) {
    const modelConfig = getModelDefaults(options.defaults);
    const storageConnection = options.storageConnection || process.env.AzureWebJobsStorage;
    const tableName = options.tableName || process.env.MODEL_REGISTRY_TABLE || 'modelregistry';

    if (!modelType || !modelConfig[modelType]) {
        return null;
    }

    if (!storageConnection) {
        if (context?.log) {
            context.log.warn('AzureWebJobsStorage not configured; falling back to defaults');
        }
        return modelConfig[modelType].endpoint;
    }

    try {
        const registryClient = TableClient.fromConnectionString(storageConnection, tableName);
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
        if (context?.log) {
            context.log.warn('Model registry lookup failed; using defaults', err.message);
        }
    }

    return modelConfig[modelType].endpoint;
}

module.exports = {
    getModelDefaults,
    resolveModelEndpoint
};
