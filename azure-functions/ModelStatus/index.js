const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    const jobId = context.bindingData.jobId;
    
    if (!jobId) {
        context.res = {
            status: 400,
            body: { error: 'Job ID is required' }
        };
        return;
    }

    try {
        // Query Table Storage for job status
        const tableClient = TableClient.fromConnectionString(
            process.env.AzureWebJobsStorage,
            'modelexecutions'
        );

        // Query across all partitions (model types)
        const entities = tableClient.listEntities({
            queryOptions: {
                filter: `RowKey eq '${jobId}'`
            }
        });

        let jobEntity = null;
        for await (const entity of entities) {
            jobEntity = entity;
            break;
        }

        if (!jobEntity) {
            context.res = {
                status: 404,
                body: { error: 'Job not found' }
            };
            return;
        }

        // Prepare response
        const response = {
            jobId: jobEntity.rowKey,
            model: jobEntity.partitionKey,
            status: jobEntity.status,
            createdAt: jobEntity.createdAt,
            updatedAt: jobEntity.updatedAt,
            completedAt: jobEntity.completedAt
        };

        // Include parameters if available
        if (jobEntity.params) {
            response.params = JSON.parse(jobEntity.params);
        }

        // Handle results based on storage location
        if (jobEntity.status === 'completed') {
            if (jobEntity.resultsBlob) {
                // Results are in blob storage
                const blobServiceClient = BlobServiceClient.fromConnectionString(
                    process.env.AzureWebJobsStorage
                );
                const containerClient = blobServiceClient.getContainerClient('model-results');
                const blockBlobClient = containerClient.getBlockBlobClient(jobEntity.resultsBlob);
                
                const downloadBlockBlobResponse = await blockBlobClient.download(0);
                const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
                response.results = JSON.parse(downloaded.toString());
            } else if (jobEntity.results) {
                // Results are in table storage
                response.results = JSON.parse(jobEntity.results);
            }
        }

        // Include error if job failed
        if (jobEntity.status === 'failed' && jobEntity.error) {
            response.error = jobEntity.error;
        }

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: response
        };

    } catch (error) {
        context.log.error('Error retrieving job status:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Internal server error',
                message: error.message
            }
        };
    }
};

async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}
