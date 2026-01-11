const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const axios = require('axios');

// Model-specific endpoint paths and configurations
function getModelApiConfig(modelType, endpoint, params) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentYear = new Date().getFullYear();

    // Calculate current week (approximate NFL/NCAAF week)
    const startOfYear = new Date(currentYear, 0, 1);
    const currentWeek = Math.ceil((new Date() - startOfYear) / (7 * 24 * 60 * 60 * 1000));

    switch (modelType.toLowerCase()) {
        case 'nba':
            // NBA uses /slate/{date}/executive for daily picks (matching frontend fetcher)
            const nbaDate = params.date || today;
            return {
                url: `${endpoint}/slate/${nbaDate}/executive`,
                method: 'GET',
                data: null
            };

        case 'ncaam':
            // NCAAM uses /api/picks/{date} for predictions
            const ncaamDate = params.date || today;
            return {
                url: `${endpoint}/api/picks/${ncaamDate}`,
                method: 'GET',
                data: null
            };

        case 'nfl':
            // NFL uses /api/v1/predictions/week/{season}/{week}
            const nflSeason = params.season || currentYear;
            const nflWeek = params.week || Math.min(currentWeek - 35, 18); // NFL starts ~week 36
            return {
                url: `${endpoint}/api/v1/predictions/week/${nflSeason}/${nflWeek}`,
                method: 'GET',
                data: null
            };

        case 'ncaaf':
            // NCAAF uses /api/v1/predictions/week/{season}/{week}
            const ncaafSeason = params.season || currentYear;
            const ncaafWeek = params.week || Math.min(currentWeek - 35, 15); // NCAAF starts ~week 35
            return {
                url: `${endpoint}/api/v1/predictions/week/${ncaafSeason}/${ncaafWeek}`,
                method: 'GET',
                data: null
            };

        default:
            // Fallback to generic /execute endpoint
            return {
                url: `${endpoint}/execute`,
                method: 'POST',
                data: { ...params }
            };
    }
}

module.exports = async function (context, jobMessage) {
    const { jobId, modelType, params, endpoint, timestamp } = jobMessage;

    context.log(`Processing job ${jobId} for model ${modelType}`);

    // Initialize Table Storage client
    const tableClient = TableClient.fromConnectionString(
        process.env.AzureWebJobsStorage,
        'modelexecutions'
    );

    // Initialize Blob Storage client for large results
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AzureWebJobsStorage
    );
    const containerClient = blobServiceClient.getContainerClient('model-results');

    try {
        // Update job status to 'running'
        await updateJobStatus(tableClient, modelType, jobId, 'running');

        // Send SignalR update
        context.bindings.signalRMessages = [{
            target: 'modelStatusUpdate',
            arguments: [{ jobId, status: 'running', modelType, progress: 10 }]
        }];

        // Get model-specific API configuration
        const apiConfig = getModelApiConfig(modelType, endpoint, params);
        context.log(`Calling model API: ${apiConfig.method} ${apiConfig.url}`);

        // Call the model API with correct method and endpoint
        // Timeout matches frontend REQUEST_TIMEOUT_MS (60s) for cold starts
        const response = await axios({
            method: apiConfig.method,
            url: apiConfig.url,
            data: apiConfig.data,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': jobId
            },
            timeout: 60000 // 60 seconds timeout (matches frontend cold-start tolerance)
        });

        // Store results
        const results = response.data;
        
        // If results are large, store in blob storage
        if (JSON.stringify(results).length > 30000) {
            const blobName = `${modelType}/${jobId}.json`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            
            await blockBlobClient.upload(
                JSON.stringify(results),
                Buffer.byteLength(JSON.stringify(results))
            );
            
            // Update job with blob reference
            await updateJobStatus(tableClient, modelType, jobId, 'completed', blobName);
        } else {
            // Store results directly in table
            await updateJobStatus(tableClient, modelType, jobId, 'completed', null, results);
        }

        // Send final SignalR update
        context.bindings.signalRMessages = [{
            target: 'modelStatusUpdate',
            arguments: [{
                jobId,
                status: 'completed',
                modelType,
                progress: 100,
                resultsSummary: {
                    totalPicks: results.total_picks || results.predictions?.length || 0,
                    timestamp: new Date().toISOString()
                }
            }]
        }];

        context.log(`Job ${jobId} completed successfully`);

    } catch (error) {
        context.log.error(`Error processing job ${jobId}:`, error);
        
        // Update job status to failed
        await updateJobStatus(tableClient, modelType, jobId, 'failed', null, null, error.message);
        
        // Send error SignalR update
        context.bindings.signalRMessages = [{
            target: 'modelStatusUpdate',
            arguments: [{
                jobId,
                status: 'failed',
                modelType,
                error: error.message,
                progress: 0
            }]
        }];
    }
};

async function updateJobStatus(tableClient, modelType, jobId, status, blobRef = null, results = null, error = null) {
    const entity = {
        partitionKey: modelType,
        rowKey: jobId,
        status: status,
        updatedAt: new Date().toISOString()
    };

    if (blobRef) {
        entity.resultsBlob = blobRef;
    }
    
    if (results) {
        entity.results = JSON.stringify(results);
    }
    
    if (error) {
        entity.error = error;
    }

    if (status === 'completed') {
        entity.completedAt = new Date().toISOString();
    }

    await tableClient.upsertEntity(entity, 'Merge');
}
