const { BlobServiceClient } = require("@azure/storage-blob");

/**
 * List Archived Picks Weeks
 * GET /api/archive-picks/list
 * 
 * Returns list of available week archives
 */
async function listWeeks(context) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
        context.res = { status: 500, body: { error: 'Storage not configured' } };
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
            headers: { 'Content-Type': 'application/json' },
            body: {
                weeks: Array.from(weeks).sort().reverse()
            }
        };

    } catch (error) {
        context.log.error('List weeks error:', error);
        context.res = {
            status: 500,
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
async function getWeek(context, weekId) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
        context.res = { status: 500, body: { error: 'Storage not configured' } };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('picks-archive');

        const allPicks = [];
        let weekStats = {};

        // Find all blobs for this week
        for await (const blob of containerClient.listBlobsFlat({ prefix: `2026/${weekId}/` })) {
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

        // Also check year 2025 (if present)
        for await (const blob of containerClient.listBlobsFlat({ prefix: `2025/${weekId}/` })) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const downloadResponse = await blobClient.download();
            const content = await streamToString(downloadResponse.readableStreamBody);
            const data = JSON.parse(content);

            if (data.picks) {
                allPicks.push(...data.picks);
            }
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
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

    if (req.method === 'OPTIONS') {
        context.res = { status: 204 };
        return;
    }

    const action = req.params.action;

    if (!action || action === 'list') {
        return await listWeeks(context);
    } else {
        return await getWeek(context, action);
    }
};
