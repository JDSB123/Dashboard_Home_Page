const { BlobServiceClient } = require('@azure/storage-blob');
const { buildCorsHeaders, getAllowedOrigins } = require('../shared/http');
const { validateSharedKey } = require('../shared/auth');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.greenbiersportventures.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
];

const ALLOWED_ORIGINS = getAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);

const ARCHIVE_CONTAINER = process.env.ARCHIVE_CONTAINER || 'weekly-lineup-archives';

function getStorageConnectionString() {
  return (
    process.env.AZURE_FUNCTIONS_STORAGE_CONNECTION ||
    process.env.AzureWebJobsStorage ||
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    ''
  );
}

function send(context, status, body, headers) {
  context.res = {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  };
}

function toBool(val) {
  if (val === true) return true;
  if (val === false) return false;
  const s = (val ?? '').toString().trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return null;
}

function normalizeBlobName(action) {
  const raw = (action ?? '').toString().trim();
  if (!raw) return '';
  const base = raw.replace(/\.json$/i, '');
  // Restrict to safe name chars
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

module.exports = async function (context, req) {
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS, {
    methods: 'GET,POST,OPTIONS',
    headers: 'Content-Type, x-functions-key, Authorization',
  });

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const connectionString = getStorageConnectionString();
  if (!connectionString) {
    send(
      context,
      500,
      { success: false, error: 'Blob storage not configured (missing connection string)' },
      corsHeaders,
    );
    return;
  }

  const action = (context.bindingData.action || '').toString();
  const actionLower = action.toLowerCase();

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(ARCHIVE_CONTAINER);
    await containerClient.createIfNotExists();

    // GET /api/archive-picks/list
    if (req.method === 'GET' && actionLower === 'list') {
      const limit = parseInt(req.query.limit, 10) || 50;
      const includeMetadata = toBool(req.query.includeMetadata) === true;

      const results = [];
      for await (const blob of containerClient.listBlobsFlat({ includeMetadata: includeMetadata })) {
        const id = blob.name.replace(/\.json$/i, '');
        results.push(
          includeMetadata
            ? {
                id,
                name: blob.name,
                lastModified: blob.properties?.lastModified?.toISOString?.() || null,
                size: blob.properties?.contentLength ?? null,
              }
            : id,
        );
        if (results.length >= limit) break;
      }

      // Sort newest first if metadata present; otherwise keep service order
      if (includeMetadata) {
        results.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
      }

      send(context, 200, { success: true, weeks: results }, corsHeaders);
      return;
    }

    // GET /api/archive-picks/{id}
    if (req.method === 'GET' && action && actionLower !== 'list') {
      const id = normalizeBlobName(action);
      if (!id) {
        send(context, 400, { success: false, error: 'Missing archive id' }, corsHeaders);
        return;
      }

      const blobClient = containerClient.getBlobClient(`${id}.json`);
      const exists = await blobClient.exists();
      if (!exists) {
        send(context, 404, { success: false, error: 'Archive not found' }, corsHeaders);
        return;
      }

      const download = await blobClient.download();
      const json = await streamToString(download.readableStreamBody);

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        parsed = { raw: json };
      }

      send(context, 200, parsed, corsHeaders);
      return;
    }

    // POST /api/archive-picks
    if (req.method === 'POST' && (!action || actionLower === '')) {
      const auth = validateSharedKey(req, context, { requireEnv: 'REQUIRE_PICKS_WRITE_KEY' });
      if (!auth.ok) {
        send(context, 401, { success: false, error: auth.reason }, corsHeaders);
        return;
      }

      const payload = req.body || {};
      const id = normalizeBlobName(payload.id || payload.archiveId || '');
      if (!id) {
        send(context, 400, { success: false, error: 'Archive payload must include id' }, corsHeaders);
        return;
      }

      const blobClient = containerClient.getBlockBlobClient(`${id}.json`);
      const content = JSON.stringify(payload, null, 2);

      await blobClient.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });

      send(context, 200, { success: true, archiveId: id, blobUrl: blobClient.url }, corsHeaders);
      return;
    }

    send(context, 400, { success: false, error: 'Unsupported archive operation' }, corsHeaders);
  } catch (e) {
    context.log.error('[ArchivePicks] Error:', e.message);
    send(context, 500, { success: false, error: e.message }, corsHeaders);
  }
};

async function streamToString(readableStream) {
  if (!readableStream) return '';
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data.toString()));
    readableStream.on('end', () => resolve(chunks.join('')));
    readableStream.on('error', reject);
  });
}
