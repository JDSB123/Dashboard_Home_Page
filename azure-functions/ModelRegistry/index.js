const { TableClient } = require('@azure/data-tables');

const MODEL_ENDPOINTS = {
    nba: process.env.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
    ncaam: process.env.NCAAM_API_URL || 'https://ncaam-stable-prediction.blackglacier-5fab3573.centralus.azurecontainerapps.io',
    nfl: process.env.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
    ncaaf: process.env.NCAAF_API_URL || 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'
};

module.exports = async function (context, req) {
    const action = context.bindingData.action || 'get';

    try {
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

            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=60'
                },
                body: registry
            };

        } else if (req.method === 'POST' && action === 'update') {
            // Update model registry entry
            const { model, version, endpoint } = req.body;

            if (!model) {
                context.res = {
                    status: 400,
                    body: { error: 'Model type is required' }
                };
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

            context.res = {
                status: 200,
                body: {
                    message: 'Registry updated successfully',
                    model: model,
                    version: version
                }
            };

        } else {
            context.res = {
                status: 400,
                body: { error: 'Invalid action' }
            };
        }

    } catch (error) {
        context.log.error('Error in ModelRegistry:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Internal server error',
                message: error.message
            }
        };
    }
};
