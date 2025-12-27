const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const axios = require('axios');

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

        // Get managed identity token for authentication
        const credential = new DefaultAzureCredential();
        
        // Call the model API
        context.log(`Calling model API at ${endpoint}/execute`);
        
        const response = await axios.post(
            `${endpoint}/execute`,
            {
                ...params,
                requestId: jobId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': jobId
                },
                timeout: 300000 // 5 minutes timeout
            }
        );

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
