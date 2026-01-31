const { BlobServiceClient } = require("@azure/storage-blob");

// CORS configuration
const DEFAULT_ALLOWED_ORIGINS = [
    'https://www.greenbiersportventures.com',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
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
 * List Archived Picks Weeks
 * GET /api/archive-picks/list
 *
 * Returns list of available week archives
 */
async function listWeeks(context, corsHeaders) {
    const connectionString = process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
        context.res = { status: 500, headers: corsHeaders, body: { error: 'Storage not configured' } };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('picks-archive');

        const weeks = new Set();

        // List all blobs and extract week IDs
        for await (const blob of containerClient.listBlobsFlat()) {
            // Path format: year/week-id/date-picks.json
            const parts = blob.name.split('/');
            if (parts.length >= 2) {
                weeks.add(parts[1]); // week-id
            }
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            body: {
                weeks: Array.from(weeks).sort().reverse()
            }
        };

    } catch (error) {
        context.log.error('List weeks error:', error);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: { error: 'Failed to list weeks', details: error.message }
        };
    }
}

/**
 * Get Archived Picks for a Week
 * GET /api/archive-picks/{weekId}
 *
 * Returns all picks for a specific week
 */
async function getWeek(context, weekId, corsHeaders) {
    const connectionString = process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
        context.res = { status: 500, headers: corsHeaders, body: { error: 'Storage not configured' } };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('picks-archive');

        const allPicks = [];
        let weekStats = {};

        // Dynamically check multiple years (current year and previous 2 years)
        const currentYear = new Date().getFullYear();
        const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2];

        for (const year of yearsToCheck) {
            for await (const blob of containerClient.listBlobsFlat({ prefix: `${year}/${weekId}/` })) {
                const blobClient = containerClient.getBlobClient(blob.name);
                const downloadResponse = await blobClient.download();
                const content = await streamToString(downloadResponse.readableStreamBody);
                const data = JSON.parse(content);

                if (data.picks) {
                    allPicks.push(...data.picks);
                }
                if (data.stats) {
                    weekStats = { ...weekStats, ...data.stats };
                }
            }
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            body: {
                weekId,
                pickCount: allPicks.length,
                picks: allPicks,
                stats: weekStats
            }
        };

    } catch (error) {
        context.log.error('Get week error:', error);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: { error: 'Failed to get week data', details: error.message }
        };
    }
}

/**
 * Helper to convert stream to string
 */
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

/**
 * Main handler - routes to list or get based on path
 */
module.exports = async function (context, req) {
    context.log('Archive picks GET request:', req.params);
    const corsHeaders = buildCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    const action = req.params.action;

    if (!action || action === 'list') {
        return await listWeeks(context, corsHeaders);
    } else {
        return await getWeek(context, action, corsHeaders);
    }
};
