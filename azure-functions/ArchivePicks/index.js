const { BlobServiceClient } = require("@azure/storage-blob");

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
    'https://www.greenbiersportventures.com',
    'http://localhost:3000',
    'http://localhost:8080'
];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req) {
    const origin = req.headers?.origin;
    const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-functions-key',
        'Vary': 'Origin'
    };
}

/**
 * Archive Picks to Azure Blob Storage
 * POST /api/archive-picks
 *
 * Request body:
 * {
 *   "picks": [...],
 *   "weekId": "week-1",
 *   "slateDate": "2025-01-06"
 * }
 */
module.exports = async function (context, req) {
    context.log('Archive picks request received');
    const corsHeaders = buildCorsHeaders(req);

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        context.res = {
            status: 405,
            headers: corsHeaders,
            body: { error: 'Method not allowed' }
        };
        return;
    }

    const { picks, weekId, slateDate } = req.body || {};

    if (!picks || !Array.isArray(picks)) {
        context.res = {
            status: 400,
            headers: corsHeaders,
            body: { error: 'Missing or invalid picks array' }
        };
        return;
    }

    if (!weekId || !slateDate) {
        context.res = {
            status: 400,
            headers: corsHeaders,
            body: { error: 'Missing weekId or slateDate' }
        };
        return;
    }

    try {
        // Get connection string from environment (loaded from Key Vault)
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

        if (!connectionString) {
            context.log.error('AZURE_STORAGE_CONNECTION_STRING not configured');
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: { error: 'Storage not configured' }
            };
            return;
        }

        // Create blob client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = 'picks-archive';
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Create container if it doesn't exist
        await containerClient.createIfNotExists({
            access: 'blob' // Allow anonymous read access to blobs
        });

        // Generate blob name with structure: year/week/picks.json
        const year = new Date(slateDate).getFullYear();
        const blobName = `${year}/${weekId}/${slateDate}-picks.json`;

        // Prepare archive data
        const archiveData = {
            weekId,
            slateDate,
            archivedAt: new Date().toISOString(),
            pickCount: picks.length,
            picks: picks.map(pick => ({
                ...pick,
                archivedAt: new Date().toISOString()
            }))
        };

        // Upload to blob
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const content = JSON.stringify(archiveData, null, 2);

        await blockBlobClient.upload(content, Buffer.byteLength(content), {
            blobHTTPHeaders: {
                blobContentType: 'application/json'
            },
            metadata: {
                weekid: weekId,
                slatedate: slateDate,
                pickcount: String(picks.length)
            }
        });

        context.log(`Archived ${picks.length} picks to ${blobName}`);

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            },
            body: {
                success: true,
                message: `Archived ${picks.length} picks`,
                blobPath: blobName,
                blobUrl: blockBlobClient.url
            }
        };

    } catch (error) {
        context.log.error('Archive error:', error);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                error: 'Failed to archive picks',
                details: error.message
            }
        };
    }
};
