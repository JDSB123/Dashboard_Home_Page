/**
 * PicksAPI route handlers
 * Extracted from index.js for maintainability.
 */

const { sendResponse } = require("../shared/http");
const { normalizePick, buildQuery } = require("./helpers");
const cache = require("../shared/cache");

// ── GET /picks - List picks ──────────────────────────────────────────────

async function handleListPicks(context, req, container, { sport, action, corsHeaders, log }) {
  const queryOptions = {
    sport: sport || req.query.sport,
    status: req.query.status,
    active: action === "active" || req.query.active === "true",
    settled: action === "settled" || req.query.settled === "true",
    archived: action === "archived" || req.query.archived === "true",
    locked:
      req.query.locked === undefined
        ? undefined
        : req.query.locked === true || req.query.locked === "true",
    date: req.query.date,
    from: req.query.from,
    to: req.query.to,
    sportsbook: req.query.sportsbook,
    limit: parseInt(req.query.limit) || 100,
  };

  // Check cache for GET list requests
  const cacheKey = `picks-${sport || "all"}-${action || "list"}-${JSON.stringify(queryOptions)}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    if (log) log.info("Cache hit", { cacheKey });
    sendResponse(context, 200, cached, corsHeaders);
    return;
  }

  const { query, parameters } = buildQuery(queryOptions);
  if (log) log.info("Query", { query });

  const { resources: picks } = await container.items.query({ query, parameters }).fetchAll();

  const bySport = picks.reduce((acc, p) => {
    acc[p.sport] = (acc[p.sport] || 0) + 1;
    return acc;
  }, {});

  const responseBody = { success: true, count: picks.length, bySport, filters: { sport, action, ...req.query }, picks };
  cache.set(cacheKey, responseBody, 30000); // 30s cache for picks lists
  sendResponse(context, 200, responseBody, corsHeaders);
}

// ── GET /picks/{sport}/{id} - Single pick ────────────────────────────────

async function handleGetPick(context, req, container, { sport, pickId, corsHeaders }) {
  let pick;
  if (sport) {
    try {
      const { resource } = await container.item(pickId, sport).read();
      pick = resource;
    } catch (e) {
      if (e.code !== 404) throw e;
    }
  }

  if (!pick) {
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: pickId }],
      })
      .fetchAll();
    pick = resources[0];
  }

  if (!pick) {
    sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
    return;
  }

  sendResponse(context, 200, { success: true, pick }, corsHeaders);
}

// ── POST /picks - Create pick(s) ────────────────────────────────────────

async function handleCreatePicks(context, req, container, { sport, corsHeaders, log }) {
  const body = req.body;
  if (!body) {
    sendResponse(context, 400, { success: false, error: "Request body required" }, corsHeaders);
    return;
  }
  const picks = Array.isArray(body) ? body : body.picks || [body];

  if (picks.length === 0) {
    sendResponse(context, 200, { success: true, created: 0, picks: [] }, corsHeaders);
    return;
  }

  const results = [];
  const errors = [];

  for (const pick of picks) {
    try {
      const normalized = normalizePick(pick, sport);
      const { resource } = await container.items.upsert(normalized);
      results.push(resource);
      if (log) log.info("Created pick", { id: normalized.id, sport: normalized.sport });
    } catch (err) {
      errors.push({ id: pick.id || "unknown", error: err.message });
      if (log) log.warn("Error creating pick", { error: err.message });
    }
  }

  cache.invalidate("picks-"); // bust stale list caches
  sendResponse(
    context,
    results.length > 0 ? 201 : 400,
    {
      success: results.length > 0,
      created: results.length,
      errors: errors.length,
      picks: results,
      errorDetails: errors.length > 0 ? errors : undefined,
    },
    corsHeaders,
  );
}

// ── POST /{sport}/archive - Archive settled picks ────────────────────────

async function handleArchive(context, req, container, { sport, corsHeaders, log }) {
  const { resources: settledPicks } = await container.items
    .query({
      query: `SELECT * FROM c WHERE c.sport = @sport AND LOWER(c.status) IN ('win', 'won', 'loss', 'lost', 'push')`,
      parameters: [{ name: "@sport", value: sport }],
    })
    .fetchAll();

  let archived = 0;
  for (const pick of settledPicks) {
    try {
      const updated = { ...pick, status: "archived", archivedAt: new Date().toISOString() };
      await container.items.upsert(updated);
      archived++;
    } catch (e) {
      if (log) log.warn("Failed to archive pick", { id: pick.id, error: e.message });
    }
  }

  cache.invalidate("picks-");
  sendResponse(
    context, 200,
    { success: true, sport, archived, message: `Archived ${archived} settled picks for ${sport}` },
    corsHeaders,
  );
}

// ── PATCH /picks/{sport}/{id} - Update pick ──────────────────────────────

async function handleUpdatePick(context, req, container, { sport, pickId, corsHeaders, log }) {
  const updates = req.body;

  let existing;
  if (sport) {
    try {
      const { resource } = await container.item(pickId, sport).read();
      existing = resource;
    } catch (e) {
      if (e.code !== 404) throw e;
    }
  }

  if (!existing) {
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: pickId }],
      })
      .fetchAll();
    existing = resources[0];
  }

  if (!existing) {
    sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
    return;
  }

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    sport: existing.sport,
    league: existing.sport,
    updatedAt: new Date().toISOString(),
  };

  const { resource } = await container.items.upsert(updated);
  cache.invalidate("picks-");
  if (log) log.info("Updated pick", { id: pickId });

  sendResponse(context, 200, { success: true, pick: resource }, corsHeaders);
}

// ── DELETE - Delete pick or clear sport ──────────────────────────────────

async function handleDelete(context, req, container, { sport, pickId, action, corsHeaders, log }) {
  // Clear all picks for sport
  if (action === "clear" && sport) {
    if (req.headers["x-confirm-clear"] !== "true") {
      sendResponse(
        context, 400,
        { success: false, error: "Confirmation required: add header x-confirm-clear: true" },
        corsHeaders,
      );
      return;
    }

    const { resources } = await container.items
      .query({
        query: "SELECT c.id, c.sport FROM c WHERE c.sport = @sport",
        parameters: [{ name: "@sport", value: sport }],
      })
      .fetchAll();

    let deleted = 0;
    for (const pick of resources) {
      try {
        await container.item(pick.id, pick.sport).delete();
        deleted++;
      } catch (e) {
        if (log) log.warn("Failed to delete pick", { id: pick.id, error: e.message });
      }
    }

    cache.invalidate("picks-");
    sendResponse(
      context, 200,
      { success: true, sport, deleted, message: `Deleted ${deleted} picks for ${sport}` },
      corsHeaders,
    );
    return;
  }

  // Delete single pick
  if (pickId) {
    let pickSport = sport;

    if (!pickSport) {
      const { resources } = await container.items
        .query({
          query: "SELECT c.id, c.sport FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: pickId }],
        })
        .fetchAll();

      if (resources.length === 0) {
        sendResponse(context, 404, { success: false, error: "Pick not found" }, corsHeaders);
        return;
      }
      pickSport = resources[0].sport;
    }

    await container.item(pickId, pickSport).delete();
    cache.invalidate("picks-");
    if (log) log.info("Deleted pick", { id: pickId });

    sendResponse(context, 200, { success: true, deleted: pickId }, corsHeaders);
    return;
  }

  sendResponse(context, 400, { error: "Invalid delete request" }, corsHeaders);
}

module.exports = {
  handleListPicks,
  handleGetPick,
  handleCreatePicks,
  handleArchive,
  handleUpdatePick,
  handleDelete,
};
