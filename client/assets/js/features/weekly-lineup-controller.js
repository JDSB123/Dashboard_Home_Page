/**
 * Weekly Lineup Controller
 * - Fetches model picks via UnifiedPicksFetcher
 * - Renders picks into weekly-lineup table
 * - Auto-saves fetched picks into Cosmos (locked=false)
 * - Track button toggles locked/unlocked (Dashboard shows locked picks)
 */

(function () {
  "use strict";

  const WEEKLY_LINEUP_KEY = "gbsv_weekly_lineup_picks";

  const state = {
    activePicks: [],
    lastFetchedAt: null,
    isFetching: false,
  };

  const el = {
    tbody: () => document.getElementById("picks-tbody"),
    lastRefreshed: () =>
      document.querySelector("#ft-last-refreshed .sync-time"),
  };

  const nowIso = () => new Date().toISOString();

  const formatMmDd = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return String(isoDate);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  };

  const safeText = (value) => (value ?? "").toString();

  const slug = (value) =>
    safeText(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const normalizeSport = (sport) => {
    const upper = safeText(sport).toUpperCase();
    if (upper === "NCAAM") return "NCAAB";
    if (upper === "NCAAB") return "NCAAB";
    return upper || "NBA";
  };

  // Deterministic ID to avoid duplicates across refreshes
  const computePickId = (pick) => {
    const sport = normalizeSport(pick.sport || pick.league);
    const date = (pick.gameDate || pick.date || "").toString().slice(0, 10);
    const away = slug(pick.awayTeam);
    const home = slug(pick.homeTeam);
    const pickType = slug(pick.pickType);
    const segment = slug(pick.segment);
    const direction = slug(
      pick.pickDirection || pick.pickTeam || pick.pick || "",
    );
    const line = slug(pick.line);

    const base = `${sport}-${date}-${away}-at-${home}-${pickType}-${segment}-${direction}-${line}`;
    return base.length <= 255 ? base : base.slice(0, 255);
  };

  const showToast = (message, type = "info") => {
    if (window.showNotification) {
      window.showNotification(message, type);
      return;
    }

    // Fallback toast (minimal)
    try {
      const node = document.createElement("div");
      node.textContent = message;
      node.style.cssText =
        "position:fixed;top:20px;right:20px;z-index:99999;padding:10px 14px;border-radius:10px;" +
        "background:rgba(6,28,20,0.95);color:#e8f0f2;border:1px solid rgba(60,255,181,0.35);";
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 2500);
    } catch (e) {}
  };

  const setLastRefreshed = (iso) => {
    const target = el.lastRefreshed();
    if (!target) return;

    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      target.textContent = "-";
      return;
    }

    target.textContent = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLeagueLogo = (sport) => {
    const s = normalizeSport(sport);
    if (s === "NBA") return { src: "assets/nba-logo.png", alt: "NBA" };
    if (s === "NCAAB") return { src: "assets/ncaam-logo.png", alt: "NCAAM" };
    if (s === "NFL") return { src: "assets/nfl-logo.png", alt: "NFL" };
    if (s === "NCAAF") return { src: "assets/ncaaf-logo.png", alt: "NCAAF" };
    return { src: "", alt: s };
  };

  const getTeamLogoUrl = (teamName, sport) => {
    const normalizedSport = normalizeSport(sport);
    const leagueKey =
      normalizedSport === "NCAAB" ? "ncaam" : normalizedSport.toLowerCase();

    const teamAbbr =
      window.SharedUtils?.getTeamAbbr?.(teamName) ||
      safeText(teamName).split(" ").pop() ||
      "";
    const teamId = safeText(teamAbbr).toLowerCase();

    if (!teamId) return "";

    if (window.LogoLoader?.getLogoUrl) {
      return window.LogoLoader.getLogoUrl(leagueKey, teamId);
    }

    const espnLeague =
      leagueKey === "ncaam" || leagueKey === "ncaaf" ? "ncaa" : leagueKey;
    return `https://a.espncdn.com/i/teamlogos/${espnLeague}/500/${teamId}.png`;
  };

  const fireEmoji = (fire) => {
    const n = Math.max(0, Math.min(5, parseInt(fire, 10) || 0));
    if (n <= 0) return "";
    return "🔥".repeat(n);
  };

  const formatPickLabel = (pick) => {
    const type = safeText(pick.pickType || "").toLowerCase();
    const line = safeText(pick.line);

    if (type === "total") {
      const dir = safeText(pick.pickDirection).toUpperCase();
      const label = dir.includes("UNDER")
        ? "Under"
        : dir.includes("OVER")
          ? "Over"
          : dir;
      return `${label} ${line}`.trim();
    }

    if (type === "moneyline" || type === "ml") {
      return `${safeText(pick.pickTeam)} ML`.trim();
    }

    return `${safeText(pick.pickTeam)} ${line}`.trim();
  };

  const renderEmptyState = (message) => {
    const tbody = el.tbody();
    if (!tbody) return;

    tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="8" class="empty-state-cell">
          <div class="empty-state">
            <span class="empty-icon">📊</span>
            <span class="empty-message">${safeText(message || "No picks")}</span>
          </div>
        </td>
      </tr>
    `;
  };

  const renderRows = (picks) => {
    const tbody = el.tbody();
    if (!tbody) return;

    if (!Array.isArray(picks) || picks.length === 0) {
      renderEmptyState("No picks fetched yet. Click Fetch to load picks.");
      return;
    }

    tbody.innerHTML = "";

    for (const pick of picks) {
      const sport = normalizeSport(pick.sport || pick.league);
      const leagueLogo = getLeagueLogo(sport);
      const awayLogo = getTeamLogoUrl(pick.awayTeam, sport);
      const homeLogo = getTeamLogoUrl(pick.homeTeam, sport);
      const edge =
        typeof pick.edge === "number"
          ? pick.edge
          : parseFloat(String(pick.edge || "").replace("%", "")) || 0;
      const isLocked = pick.locked === true;

      const tr = document.createElement("tr");
      tr.className = "pick-row";
      tr.setAttribute("data-row-id", pick.id);
      tr.setAttribute("data-pick-id", pick.id);
      tr.setAttribute("data-league", sport);

      const date = pick.gameDate || pick.date;
      const dateText = formatMmDd(date);

      const odds = safeText(pick.odds || "-110");
      const segment = safeText(pick.segment || "FG");
      const pickLabel = formatPickLabel(pick);

      tr.innerHTML = `
        <td class="col-datetime">
          <div class="datetime-cell">
            <div class="cell-date">${safeText(dateText)}</div>
            <div class="cell-time">${safeText(pick.time || pick.gameTime || "")}</div>
            <div class="cell-book">${safeText(pick.sportsbook || pick.book || pick.source || "Model")}</div>
          </div>
        </td>
        <td class="center col-league">
          <div class="league-cell">
            ${leagueLogo.src ? `<img src="${leagueLogo.src}" class="league-logo" alt="${leagueLogo.alt}" loading="lazy" />` : safeText(leagueLogo.alt)}
          </div>
        </td>
        <td class="col-matchup">
          <div class="matchup-cell matchup-inline">
            <span class="team-line">
              ${awayLogo ? `<img src="${awayLogo}" class="team-logo" alt="${safeText(pick.awayTeam)}" loading="lazy" onerror="this.style.display='none'" />` : ""}
              <span class="team-name-full">${safeText(pick.awayTeam)}</span>
            </span>
            <span class="vs-divider">@</span>
            <span class="team-line">
              ${homeLogo ? `<img src="${homeLogo}" class="team-logo" alt="${safeText(pick.homeTeam)}" loading="lazy" onerror="this.style.display='none'" />` : ""}
              <span class="team-name-full">${safeText(pick.homeTeam)}</span>
            </span>
          </div>
        </td>
        <td class="center col-segment">
          <span class="segment-pill" data-segment="${slug(segment)}">${safeText(segment)}</span>
        </td>
        <td class="col-pick">
          <div class="pick-inline">
            <span class="pick-team">${safeText(pickLabel)}</span>
            <span class="pick-odds">(${safeText(odds)})</span>
          </div>
        </td>
        <td class="center col-edge">
          <span class="edge-badge">${edge ? `${edge.toFixed(1)}%` : "-"}</span>
        </td>
        <td class="center col-fire">
          <span class="fire-cell" title="Fire rating">${fireEmoji(pick.fire)}</span>
        </td>
        <td class="center col-track">
          <button
            class="tracker-btn"
            type="button"
            data-pick-id="${pick.id}"
            aria-pressed="${isLocked ? "true" : "false"}"
            title="${isLocked ? "Locked in (on Dashboard)" : "Not locked"}"
          >${isLocked ? "🔒" : "＋"}</button>
        </td>
      `;

      tbody.appendChild(tr);
    }

    if (window.Accessibility?.init) {
      window.Accessibility.init();
    }
  };

  const persistWeeklyLineupCache = (picks) => {
    try {
      localStorage.setItem(
        WEEKLY_LINEUP_KEY,
        JSON.stringify({ picks, fetchedAt: nowIso() }),
      );
    } catch (e) {}
  };

  const toCosmosPick = (pick) => {
    const sport = normalizeSport(pick.sport || pick.league);
    const gameDate = (pick.gameDate || pick.date || nowIso())
      .toString()
      .slice(0, 10);

    const normalized = {
      id: pick.id || computePickId(pick),
      sport,
      league: sport,
      awayTeam: safeText(pick.awayTeam),
      homeTeam: safeText(pick.homeTeam),
      pickType: safeText(pick.pickType || "spread").toLowerCase(),
      pickDirection: safeText(pick.pickDirection || ""),
      pickTeam: safeText(pick.pickTeam || ""),
      line: safeText(pick.line || ""),
      odds: safeText(pick.odds || ""),
      edge:
        typeof pick.edge === "number"
          ? pick.edge
          : parseFloat(String(pick.edge || "").replace("%", "")) || 0,
      segment: safeText(pick.segment || "FG"),
      sportsbook: safeText(pick.sportsbook || pick.book || "Model"),
      gameDate,
      gameTime: safeText(pick.time || pick.gameTime || ""),
      status: safeText(pick.status || "pending").toLowerCase(),
      locked: pick.locked === true,
      lockedAt: pick.locked === true ? pick.lockedAt || nowIso() : null,
      source: "weekly-lineup",
      model: safeText(pick.modelStamp || pick.model || ""),
      confidence: pick.fire ?? pick.confidence ?? null,
      notes: safeText(pick.rationale || pick.notes || ""),
    };

    return normalized;
  };

  const saveFetchedPicksToCosmos = async (picks) => {
    if (!window.PicksService?.create) {
      showToast("PicksService not available (Cosmos sync disabled)", "warning");
      return;
    }

    if (!Array.isArray(picks) || picks.length === 0) {
      return;
    }

    // Auto-save fetched picks as unlocked
    const payload = picks.map((p) => {
      const cosmosPick = toCosmosPick({ ...p, locked: false, lockedAt: null });
      // Ensure deterministic ID
      cosmosPick.id = cosmosPick.id || computePickId(cosmosPick);
      return cosmosPick;
    });

    try {
      await window.PicksService.create(payload);
      showToast(
        `Saved ${payload.length} picks to Dashboard (unlocked)`,
        "success",
      );
    } catch (e) {
      showToast(`Failed to save picks: ${e.message || e}`, "error");
    }
  };

  const toggleLock = async (pickId, locked) => {
    const pick = state.activePicks.find((p) => p.id === pickId);
    if (!pick) return;

    if (!window.PicksService?.update) {
      showToast("PicksService not available (cannot lock/unlock)", "error");
      return;
    }

    try {
      const patch = locked
        ? { locked: true, lockedAt: nowIso() }
        : { locked: false, lockedAt: null };

      await window.PicksService.update(pickId, patch);

      pick.locked = locked;
      pick.lockedAt = patch.lockedAt;

      renderRows(state.activePicks);
      persistWeeklyLineupCache(state.activePicks);

      showToast(
        locked
          ? "Locked in — now on Dashboard"
          : "Unlocked — removed from Dashboard",
        "success",
      );
    } catch (e) {
      showToast(`Lock update failed: ${e.message || e}`, "error");
    }
  };

  const attachTrackHandlers = () => {
    const tbody = el.tbody();
    if (!tbody) return;

    tbody.addEventListener("click", (evt) => {
      const btn = evt.target.closest(".tracker-btn");
      if (!btn) return;

      evt.preventDefault();
      evt.stopPropagation();

      const pickId = btn.getAttribute("data-pick-id");
      if (!pickId) return;

      const isPressed = btn.getAttribute("aria-pressed") === "true";
      toggleLock(pickId, !isPressed);
    });
  };

  const getDateParamForFetchers = () => {
    // Keep it simple: fetchers default to 'today'
    return "today";
  };

  const fetchAndRender = async (league) => {
    if (state.isFetching) return;

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      showToast("Model fetchers not loaded", "error");
      return;
    }

    state.isFetching = true;

    try {
      const date = getDateParamForFetchers();
      const result = await window.UnifiedPicksFetcher.fetchPicks(league, date, {
        skipCache: true,
      });

      const picks = Array.isArray(result?.picks) ? result.picks : [];
      const enriched = picks.map((p) => {
        const withId = { ...p };
        withId.sport = normalizeSport(withId.sport || withId.league);
        withId.gameDate = (withId.gameDate || withId.date || nowIso())
          .toString()
          .slice(0, 10);
        withId.id = withId.id || computePickId(withId);
        withId.locked = withId.locked === true;
        return withId;
      });

      // Show newest first by edge
      enriched.sort((a, b) => (b.edge || 0) - (a.edge || 0));

      state.activePicks = enriched;
      state.lastFetchedAt = nowIso();

      renderRows(enriched);
      setLastRefreshed(state.lastFetchedAt);
      persistWeeklyLineupCache(enriched);

      await saveFetchedPicksToCosmos(enriched);

      if (result?.errors?.length) {
        const leaguesFailed = result.errors.map((e) => e.league).join(", ");
        showToast(`Some leagues unavailable: ${leaguesFailed}`, "warning");
      }
    } catch (e) {
      showToast(`Fetch failed: ${e.message || e}`, "error");
      renderEmptyState("Unable to fetch picks. Please try again.");
    } finally {
      state.isFetching = false;
    }
  };

  const attachFetchHandlers = () => {
    const root = document.querySelector(".filter-toolbar");
    if (!root) return;

    root.addEventListener("click", (evt) => {
      const btn = evt.target.closest("button[data-fetch]");
      if (!btn) return;

      evt.preventDefault();

      const code = safeText(btn.getAttribute("data-fetch")).toLowerCase();
      if (!code) return;

      if (code === "all") {
        fetchAndRender("all");
        return;
      }

      if (code === "ncaab" || code === "ncaam") {
        fetchAndRender("ncaam");
        return;
      }

      fetchAndRender(code);
    });
  };

  const bootstrapFromCache = () => {
    try {
      const raw = localStorage.getItem(WEEKLY_LINEUP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.picks)) return;

      state.activePicks = parsed.picks;
      state.lastFetchedAt = parsed.fetchedAt || null;

      renderRows(state.activePicks);
      if (state.lastFetchedAt) setLastRefreshed(state.lastFetchedAt);
    } catch (e) {}
  };

  // Public API expected by WeeklyLineupSync
  window.WeeklyLineup = {
    getActivePicks() {
      return state.activePicks || [];
    },
    populateTable(picks) {
      // Compatibility for other callers
      state.activePicks = Array.isArray(picks) ? picks : [];
      renderRows(state.activePicks);
      persistWeeklyLineupCache(state.activePicks);
    },
    showNotification(message, type) {
      showToast(message, type);
    },
    showEmptyState(message) {
      renderEmptyState(message);
    },
  };

  const init = () => {
    bootstrapFromCache();
    attachFetchHandlers();
    attachTrackHandlers();

    // Initialize last refreshed label
    if (state.lastFetchedAt) {
      setLastRefreshed(state.lastFetchedAt);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
