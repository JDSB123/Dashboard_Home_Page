const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');

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
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
    const jobId = context.bindingData.jobId;
    
    if (req.method === 'OPTIONS') {
        sendResponse(context, req, 204, null);
        return;
    }
    
    if (!jobId) {
        sendResponse(context, req, 400, { error: 'Job ID is required' });
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
            sendResponse(context, req, 404, { error: 'Job not found' });
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

        sendResponse(context, req, 200, response, {
            'Content-Type': 'application/json'
        });

    } catch (error) {
        context.log.error('Error retrieving job status:', error);
        sendResponse(context, req, 500, {
            error: 'Internal server error',
            message: error.message
        });
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
