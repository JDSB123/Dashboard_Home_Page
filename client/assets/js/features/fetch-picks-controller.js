/**
 * Fetch Picks Controller
 * - Lightweight, read-only model-picks viewer
 * - Fetches picks via UnifiedPicksFetcher (no Cosmos save, no localStorage)
 * - Renders into a 7-column table (no Track column)
 */

(function () {
  "use strict";

  const state = {
    activePicks: [],
    lastFetchedAt: null,
    isFetching: false,
    sortColumn: "edge",
    sortDirection: "desc",
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
    if (s === "NHL") return { src: "assets/icons/league-nhl.svg", alt: "NHL" };
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
        <td colspan="7" class="empty-state-cell">
          <div class="empty-state">
            <span class="empty-icon">📊</span>
            <span class="empty-message">${safeText(message || "No picks")}</span>
          </div>
        </td>
      </tr>
    `;
  };

  const renderSkeletonRows = (count = 5) => {
    const tbody = el.tbody();
    if (!tbody) return;
    tbody.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const tr = document.createElement("tr");
      tr.className = "skeleton-row";
      tr.innerHTML = Array(7).fill('<td class="skeleton-cell"></td>').join("");
      tbody.appendChild(tr);
    }
  };

  const renderRows = (picks) => {
    const tbody = el.tbody();
    if (!tbody) return;

    if (!Array.isArray(picks) || picks.length === 0) {
      renderEmptyState(
        "No picks fetched yet. Tap a league or Fetch All to load model predictions.",
      );
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

      const tr = document.createElement("tr");
      tr.className = "pick-row";
      tr.setAttribute("data-row-id", pick.id);
      tr.setAttribute("data-league", sport);

      const date = pick.gameDate || pick.date;
      const dateText = formatMmDd(date);
      const odds = safeText(pick.odds || "-110");
      const segment = safeText(pick.segment || "FG");
      const pickLabel = formatPickLabel(pick);

      tr.innerHTML = `
        <td class="col-datetime" data-label="Date/Time">
          <div class="datetime-cell">
            <div class="cell-date">${safeText(dateText)}</div>
            <div class="cell-time">${safeText(pick.time || pick.gameTime || "")}</div>
            <div class="cell-book">${safeText(pick.source || pick.model || "Model")}</div>
          </div>
        </td>
        <td class="center col-league" data-label="League">
          <div class="league-cell">
            ${leagueLogo.src ? `<img src="${leagueLogo.src}" class="league-logo" alt="${leagueLogo.alt}" loading="lazy" />` : safeText(leagueLogo.alt)}
          </div>
        </td>
        <td class="col-matchup" data-label="Matchup">
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
        <td class="center col-segment" data-label="Segment">
          <span class="segment-pill" data-segment="${slug(segment)}">${safeText(segment)}</span>
        </td>
        <td class="col-pick" data-label="Pick">
          <div class="pick-inline">
            <span class="pick-team">${safeText(pickLabel)}</span>
            <span class="pick-odds">(${safeText(odds)})</span>
          </div>
        </td>
        <td class="center col-edge" data-label="Edge">
          <span class="edge-badge">${edge ? `${edge.toFixed(1)}%` : "-"}</span>
        </td>
        <td class="center col-fire" data-label="Fire">
          <span class="fire-cell" title="Fire rating">${fireEmoji(pick.fire)}</span>
        </td>
      `;

      tbody.appendChild(tr);
    }
  };

  /* ── Sorting ────────────────────────────────────────────────── */

  const getSortValue = (pick, col) => {
    switch (col) {
      case "date":
        return pick.gameDate || pick.date || "";
      case "league":
        return normalizeSport(pick.sport || pick.league);
      case "matchup":
        return `${safeText(pick.awayTeam)} ${safeText(pick.homeTeam)}`;
      case "segment":
        return safeText(pick.segment);
      case "pick":
        return formatPickLabel(pick);
      case "edge": {
        const e =
          typeof pick.edge === "number"
            ? pick.edge
            : parseFloat(String(pick.edge || "").replace("%", "")) || 0;
        return e;
      }
      case "fire":
        return parseInt(pick.fire, 10) || 0;
      default:
        return "";
    }
  };

  const sortPicks = (picks, column, direction) => {
    const dir = direction === "asc" ? 1 : -1;
    return [...picks].sort((a, b) => {
      const va = getSortValue(a, column);
      const vb = getSortValue(b, column);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  };

  const attachSortHandlers = () => {
    const thead = document.querySelector(".fetch-picks-table thead");
    if (!thead) return;

    thead.addEventListener("click", (evt) => {
      const btn = evt.target.closest(".th-sort-btn");
      if (!btn) return;
      const th = btn.closest("th");
      if (!th) return;
      const col = th.getAttribute("data-sort");
      if (!col) return;

      evt.preventDefault();

      // Toggle direction
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = col;
        state.sortDirection = col === "edge" || col === "fire" ? "desc" : "asc";
      }

      // Update visual indicators
      thead.querySelectorAll("th").forEach((h) => {
        h.classList.remove("sorted-asc", "sorted-desc");
      });
      th.classList.add(
        state.sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
      );

      // Re-sort and re-render
      state.activePicks = sortPicks(
        state.activePicks,
        state.sortColumn,
        state.sortDirection,
      );
      renderRows(state.activePicks);
    });
  };

  /* ── Fetching ───────────────────────────────────────────────── */

  const setFetchingState = (btn, isFetching) => {
    if (!btn) return;
    if (isFetching) {
      btn.classList.add("fetching");
      btn.disabled = true;
    } else {
      btn.classList.remove("fetching");
      btn.disabled = false;
    }
  };

  const fetchAndRender = async (league, triggerBtn) => {
    if (state.isFetching) return;

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      showToast("Model fetchers not loaded yet — please wait", "error");
      return;
    }

    state.isFetching = true;
    setFetchingState(triggerBtn, true);
    renderSkeletonRows(6);

    try {
      const result = await window.UnifiedPicksFetcher.fetchPicks(
        league,
        "today",
        { skipCache: true },
      );

      const picks = Array.isArray(result?.picks) ? result.picks : [];
      const enriched = picks.map((p) => {
        const withId = { ...p };
        withId.sport = normalizeSport(withId.sport || withId.league);
        withId.gameDate = (withId.gameDate || withId.date || nowIso())
          .toString()
          .slice(0, 10);
        withId.id = withId.id || computePickId(withId);
        return withId;
      });

      // Sort by edge descending by default
      const sorted = sortPicks(enriched, state.sortColumn, state.sortDirection);

      state.activePicks = sorted;
      state.lastFetchedAt = nowIso();

      renderRows(sorted);
      setLastRefreshed(state.lastFetchedAt);

      const count = sorted.length;
      showToast(
        count > 0
          ? `Fetched ${count} pick${count !== 1 ? "s" : ""}`
          : "No picks available right now",
        count > 0 ? "success" : "info",
      );

      if (result?.errors?.length) {
        const leaguesFailed = result.errors.map((e) => e.league).join(", ");
        showToast(`Some leagues unavailable: ${leaguesFailed}`, "warning");
      }
    } catch (e) {
      showToast(`Fetch failed: ${e.message || e}`, "error");
      renderEmptyState("Unable to fetch picks. Please try again.");
    } finally {
      state.isFetching = false;
      setFetchingState(triggerBtn, false);
    }
  };

  /* ── Event handlers ─────────────────────────────────────────── */

  const attachFetchHandlers = () => {
    // Desktop toolbar
    const toolbar = document.querySelector(".filter-toolbar");
    if (toolbar) {
      toolbar.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-fetch]");
        if (!btn || btn.disabled) return;
        evt.preventDefault();
        const code = safeText(btn.getAttribute("data-fetch")).toLowerCase();
        if (!code) return;
        if (code === "ncaab" || code === "ncaam") {
          fetchAndRender("ncaam", btn);
        } else if (code === "all") {
          fetchAndRender("all", btn);
        } else {
          fetchAndRender(code, btn);
        }
      });
    }

    // Mobile FAB
    const fab = document.getElementById("mobile-fetch-fab");
    const fabMenu = document.getElementById("mobile-fetch-menu");
    if (fab && fabMenu) {
      fab.addEventListener("click", (evt) => {
        evt.preventDefault();
        const isOpen = !fabMenu.hidden;
        fabMenu.hidden = isOpen;
        fab.setAttribute("aria-expanded", String(!isOpen));
      });

      fabMenu.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-fetch]");
        if (!btn) return;
        evt.preventDefault();
        fabMenu.hidden = true;
        fab.setAttribute("aria-expanded", "false");
        const code = safeText(btn.getAttribute("data-fetch")).toLowerCase();
        if (!code) return;
        if (code === "ncaab" || code === "ncaam") {
          fetchAndRender("ncaam", null);
        } else if (code === "all") {
          fetchAndRender("all", null);
        } else {
          fetchAndRender(code, null);
        }
      });

      // Close menu on outside tap
      document.addEventListener("click", (evt) => {
        if (
          !fabMenu.hidden &&
          !fabMenu.contains(evt.target) &&
          evt.target !== fab
        ) {
          fabMenu.hidden = true;
          fab.setAttribute("aria-expanded", "false");
        }
      });
    }
  };

  const attachDropdownHandlers = () => {
    document.querySelectorAll(".ft-dropdown-btn").forEach((btn) => {
      btn.addEventListener("click", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const menu = btn.nextElementSibling;
        if (!menu) return;
        const isOpen = menu.classList.contains("open");
        // Close all others
        document
          .querySelectorAll(".ft-dropdown-menu.open")
          .forEach((m) => m.classList.remove("open"));
        if (!isOpen) menu.classList.add("open");
      });
    });

    // Close dropdowns on outside click
    document.addEventListener("click", (evt) => {
      if (!evt.target.closest(".ft-dropdown")) {
        document
          .querySelectorAll(".ft-dropdown-menu.open")
          .forEach((m) => m.classList.remove("open"));
      }
    });
  };

  /* ── Public API ─────────────────────────────────────────────── */

  window.FetchPicks = {
    getActivePicks() {
      return state.activePicks || [];
    },
    showNotification(message, type) {
      showToast(message, type);
    },
    showEmptyState(message) {
      renderEmptyState(message);
    },
  };

  /* ── Init ────────────────────────────────────────────────────── */

  const init = () => {
    attachFetchHandlers();
    attachSortHandlers();
    attachDropdownHandlers();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
