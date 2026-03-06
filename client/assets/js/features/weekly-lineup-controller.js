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
    betSlip: [],
    filters: {
      league: "all",
      segment: "all",
      pickType: "all",
    },
    sort: {
      key: "edge",
      dir: "desc",
    },
  };

  const FILTER_CONTROL_IDS = {
    segment: "segment-dropdown-btn",
    pickType: "picktype-dropdown-btn",
  };

  const el = {
    tbody: () => document.getElementById("picks-tbody"),
    lastRefreshed: () =>
      document.querySelector("#ft-last-refreshed .sync-time"),
  };

  const nowIso = () => new Date().toISOString();

  const formatDateFull = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return String(isoDate);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Chicago",
    });
  };

  const formatTimeCst = (timeStr) => {
    if (!timeStr) return "";
    // If already formatted (e.g. "7:00 PM CST"), return as-is
    if (/CST/i.test(timeStr)) return timeStr;
    // Try to parse and convert to CST (UTC-6)
    const d = new Date(timeStr);
    if (!Number.isNaN(d.getTime())) {
      return (
        d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Chicago",
        }) + " CST"
      );
    }
    // Fallback: append CST if it looks like a time
    if (/\d/.test(timeStr)) return timeStr + " CST";
    return timeStr;
  };

  const getModelLabel = (pick) => {
    const sport = normalizeSport(pick.sport || pick.league);
    const sportName =
      {
        NBA: "NBA",
        NCAAB: "NCAAM",
        NFL: "NFL",
        NCAAF: "NCAAF",
        NHL: "NHL",
        MLB: "MLB",
      }[sport] || sport;
    return `GBSV ${sportName} Pick`;
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

  const normalizeSegment = (segment) => {
    const value = safeText(segment).trim().toUpperCase();
    if (!value) return "FG";
    if (value === "FULL" || value === "FULL GAME") return "FG";
    if (value === "FG") return "FG";
    if (value === "1H") return "1H";
    if (value === "2H") return "2H";
    return value;
  };

  const normalizePickType = (type) => {
    const value = safeText(type).trim().toLowerCase();
    if (!value) return "spread";
    if (value === "ml") return "moneyline";
    return value;
  };

  const updateToolbarDropdownLabel = (type) => {
    const id = FILTER_CONTROL_IDS[type];
    if (!id) return;
    const btn = document.getElementById(id);
    if (!btn) return;

    if (type === "segment") {
      const labelMap = {
        all: "Segment",
        full: "Segment: FG",
        "1h": "Segment: 1H",
        "2h": "Segment: 2H",
      };
      btn.textContent = `${labelMap[state.filters.segment] || "Segment"} ▾`;
      return;
    }

    if (type === "pickType") {
      const labelMap = {
        all: "Pick Type",
        spread: "Pick Type: Spread",
        moneyline: "Pick Type: ML",
        total: "Pick Type: O/U",
        "team-total": "Pick Type: Team Total",
      };
      btn.textContent = `${labelMap[state.filters.pickType] || "Pick Type"} ▾`;
    }
  };

  const setLeagueFilter = (league) => {
    const normalized = safeText(league).toLowerCase();
    if (!normalized) return;
    state.filters.league =
      state.filters.league === normalized ? "all" : normalized;
  };

  const setSegmentFilter = (segment) => {
    const normalized = safeText(segment).toLowerCase();
    state.filters.segment = normalized || "all";
    updateToolbarDropdownLabel("segment");
  };

  const setPickTypeFilter = (pickType) => {
    const normalized = safeText(pickType).toLowerCase();
    state.filters.pickType = normalized || "all";
    updateToolbarDropdownLabel("pickType");
  };

  const clearFilters = () => {
    state.filters.league = "all";
    state.filters.segment = "all";
    state.filters.pickType = "all";
    updateToolbarDropdownLabel("segment");
    updateToolbarDropdownLabel("pickType");
  };

  const pickMatchesFilters = (pick) => {
    const league = normalizeSport(pick.sport || pick.league).toLowerCase();
    const segment = normalizeSegment(pick.segment).toLowerCase();
    const pickType = normalizePickType(pick.pickType);

    if (state.filters.league !== "all" && state.filters.league !== league) {
      return false;
    }

    if (state.filters.segment !== "all") {
      if (state.filters.segment === "full" && segment !== "fg") return false;
      if (state.filters.segment === "1h" && segment !== "1h") return false;
      if (state.filters.segment === "2h" && segment !== "2h") return false;
    }

    if (
      state.filters.pickType !== "all" &&
      state.filters.pickType !== pickType
    ) {
      return false;
    }

    return true;
  };

  const sortKeyExtractor = (pick, key) => {
    switch (key) {
      case "date":
        return pick.gameDate || pick.date || "";
      case "league":
        return normalizeSport(pick.sport || pick.league);
      case "matchup":
        return safeText(pick.awayTeam) + " " + safeText(pick.homeTeam);
      case "segment":
        return normalizeSegment(pick.segment);
      case "pick":
        return formatPickLabel(pick);
      case "edge": {
        const e = typeof pick.edge === "number" ? pick.edge
          : parseFloat(String(pick.edge || "").replace("%", "")) || 0;
        return e;
      }
      case "fire":
        return parseInt(pick.fire, 10) || 0;
      default:
        return "";
    }
  };

  const sortPicks = (picks) => {
    const { key, dir } = state.sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...picks].sort((a, b) => {
      const va = sortKeyExtractor(a, key);
      const vb = sortKeyExtractor(b, key);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va).localeCompare(String(vb)) * mult;
    });
  };

  const getVisiblePicks = () =>
    sortPicks((state.activePicks || []).filter(pickMatchesFilters));

  const syncFilterUi = () => {
    document
      .querySelectorAll(".ft-pill.ft-league[data-league]")
      .forEach((pill) => {
        const value = safeText(pill.getAttribute("data-league")).toLowerCase();
        const isActive =
          state.filters.league !== "all" && value === state.filters.league;
        pill.classList.toggle("active", isActive);
        pill.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

    document.querySelectorAll(".league-pill[data-league]").forEach((pill) => {
      const value = safeText(pill.getAttribute("data-league")).toLowerCase();
      const isActive =
        (state.filters.league === "all" && value === "all") ||
        (state.filters.league !== "all" && value === state.filters.league);
      pill.classList.toggle("active", isActive);
    });

    document.querySelectorAll(".segment-pill[data-segment]").forEach((pill) => {
      const value = safeText(pill.getAttribute("data-segment")).toLowerCase();
      const isActive =
        (state.filters.segment === "all" && value === "all") ||
        (state.filters.segment !== "all" && value === state.filters.segment);
      pill.classList.toggle("active", isActive);
    });

    document.querySelectorAll(".pick-pill[data-pick]").forEach((pill) => {
      const value = safeText(pill.getAttribute("data-pick")).toLowerCase();
      const isActive =
        (state.filters.pickType === "all" && value === "all") ||
        (state.filters.pickType !== "all" && value === state.filters.pickType);
      pill.classList.toggle("active", isActive);
    });
  };

  const renderFilterChips = () => {
    const host = document.getElementById("table-filter-chips");
    if (!host) return;

    const chips = [];
    if (state.filters.league !== "all") {
      chips.push({
        key: "league",
        label: `League: ${state.filters.league.toUpperCase()}`,
      });
    }
    if (state.filters.segment !== "all") {
      const label =
        state.filters.segment === "full"
          ? "FG"
          : state.filters.segment.toUpperCase();
      chips.push({ key: "segment", label: `Segment: ${label}` });
    }
    if (state.filters.pickType !== "all") {
      chips.push({ key: "pickType", label: `Pick: ${state.filters.pickType}` });
    }

    host.innerHTML = "";
    host.setAttribute("data-has-chips", chips.length > 0 ? "true" : "false");

    chips.forEach((chip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip-btn";
      button.textContent = chip.label;
      button.setAttribute("data-clear-filter", chip.key);
      host.appendChild(button);
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (state.filters.league !== "all") count += 1;
    if (state.filters.segment !== "all") count += 1;
    if (state.filters.pickType !== "all") count += 1;
    return count;
  };

  const updateClearButtonCount = () => {
    const clearBtn = document.getElementById("ft-clear");
    if (!clearBtn) return;
    const active = getActiveFilterCount() > 0;
    clearBtn.hidden = !active;
  };

  const syncSortUi = () => {
    const thead = document.querySelector(".weekly-lineup-table thead");
    if (!thead) return;
    thead.querySelectorAll("th[data-sort]").forEach((th) => {
      const key = th.getAttribute("data-sort");
      const icon = th.querySelector(".sort-icon");
      th.classList.remove("sorted-asc", "sorted-desc");
      if (icon) icon.textContent = "▲";
      if (key === state.sort.key) {
        th.classList.add(state.sort.dir === "asc" ? "sorted-asc" : "sorted-desc");
        if (icon) icon.textContent = state.sort.dir === "asc" ? "▲" : "▼";
      }
    });
  };

  const renderFilteredRows = () => {
    renderRows(getVisiblePicks());
    syncFilterUi();
    syncSortUi();
    renderFilterChips();
    updateClearButtonCount();
    if (state.betSlip.length > 0) syncSlipSelectedRows();
  };


  const closeToolbarDropdowns = () => {
    document.querySelectorAll(".ft-dropdown-menu").forEach((menu) => {
      menu.classList.remove("open");
    });
    document.querySelectorAll(".ft-dropdown-btn").forEach((btn) => {
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
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
    if (s === "NHL") return { src: "assets/icons/league-nhl-official.svg", alt: "NHL" };
    if (s === "MLB") return { src: "assets/mlb-logo.png", alt: "MLB" };
    return { src: "", alt: s };
  };

  const getTeamLogoUrl = (teamName, sport) => {
    if (!teamName) return "";
    const normalizedSport = normalizeSport(sport);
    const leagueKey =
      normalizedSport === "NCAAB" ? "ncaam" : normalizedSport.toLowerCase();

    // Use TeamData for logo if available (most reliable)
    const teamLogo = window.TeamData?.getTeamLogo?.(teamName, leagueKey);
    if (teamLogo) return teamLogo;

    // Fallback: resolve abbreviation then use LogoLoader
    const teamAbbr =
      window.SharedUtils?.getTeamAbbr?.(teamName) ||
      safeText(teamName).split(" ").pop() ||
      "";
    const teamId = safeText(teamAbbr).toLowerCase();

    if (!teamId) return "";

    if (window.LogoLoader?.getLogoUrl) {
      return window.LogoLoader.getLogoUrl(leagueKey, teamId);
    }

    const logoBase = (
      window.APP_CONFIG?.LOGO_BASE_URL ||
      window.APP_CONFIG?.LOGO_FALLBACK_URL ||
      "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos"
    ).replace(/\/+$/, "");
    const folder =
      leagueKey === "ncaam" || leagueKey === "ncaaf" ? "ncaa" : leagueKey;
    return `${logoBase}/${folder}-500-${teamId}.png`;
  };

  // Resolve abbreviated team names (e.g. "UTA Jazz") to full names ("Utah Jazz")
  const resolveFullName = (teamName, sport) => {
    if (!teamName) return "";
    const info = window.TeamData?.getTeamInfo?.(teamName, sport?.toLowerCase());
    return (info && info.fullName) || teamName;
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

  const formatModelPrediction = (pick) => {
    const explicitPrediction = safeText(
      pick.modelPrediction ||
        pick.prediction ||
        pick.predictedOutcome ||
        pick.projectedOutcome,
    ).trim();
    if (explicitPrediction) return explicitPrediction;

    const awayScore =
      pick.predictedAwayScore ?? pick.awayPredictedScore ?? pick.away_score_pred;
    const homeScore =
      pick.predictedHomeScore ?? pick.homePredictedScore ?? pick.home_score_pred;
    if (
      awayScore !== undefined &&
      awayScore !== null &&
      homeScore !== undefined &&
      homeScore !== null
    ) {
      return `${safeText(pick.awayTeam)} ${safeText(awayScore)} - ${safeText(pick.homeTeam)} ${safeText(homeScore)}`;
    }

    const modelLine = safeText(
      pick.modelSpread ||
        pick.modelPrice ||
        pick.modelLine ||
        pick.model_line ||
        pick.projectedLine,
    ).trim();
    if (modelLine) {
      const pickType = normalizePickType(pick.pickType);
      if (pickType === "total") return `O/U ${modelLine}`;
      if (pickType === "moneyline") return `ML ${modelLine}`;
      return modelLine;
    }

    return "-";
  };

  const renderEmptyState = (message) => {
    const tbody = el.tbody();
    if (!tbody) return;

    tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="9" class="empty-state-cell">
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
      const awayFull = resolveFullName(pick.awayTeam, sport);
      const homeFull = resolveFullName(pick.homeTeam, sport);
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
      tr.setAttribute("data-segment", normalizeSegment(pick.segment));
      tr.setAttribute("data-pick-type", normalizePickType(pick.pickType));
      tr.setAttribute("data-away", slug(awayFull));
      tr.setAttribute("data-home", slug(homeFull));

      const date = pick.gameDate || pick.date;
      const dateText = formatDateFull(date);
      const timeCst = formatTimeCst(pick.time || pick.gameTime || "");
      const modelLabel = getModelLabel(pick);

      const odds = safeText(pick.odds || "-110");
      const segment = safeText(pick.segment || "FG");
      const segmentLabel =
        {
          FG: "Full Game",
          "1H": "1st Half",
          "2H": "2nd Half",
          "1Q": "1st Qtr",
          "2Q": "2nd Qtr",
          "3Q": "3rd Qtr",
          "4Q": "4th Qtr",
        }[segment.toUpperCase()] || segment;
      const pickLabel = formatPickLabel(pick);
      const modelPredictionLabel = formatModelPrediction(pick);

      // Team records (W-L or W-L-T) from model API output
      const awayRec = safeText(pick.awayRecord || "");
      const homeRec = safeText(pick.homeRecord || "");

      // Edge: show pts with toggleable % view
      const edgePts = edge ? edge.toFixed(1) : "";
      const edgePct = pick.edgePct
        ? parseFloat(String(pick.edgePct).replace("%", "")).toFixed(1)
        : edge
          ? (edge * 2.5).toFixed(1)
          : ""; // estimate % if not provided

      tr.innerHTML = `
        <td class="col-datetime">
          <div class="datetime-cell">
            <div class="cell-date">${safeText(dateText)}</div>
            <div class="cell-time">${safeText(timeCst)}</div>
            <div class="cell-book">${safeText(modelLabel)}</div>
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
              ${awayLogo ? `<img src="${awayLogo}" class="team-logo" alt="${safeText(awayFull)}" loading="lazy" onerror="this.style.display='none'" />` : ""}
              <span class="team-name-full">${safeText(awayFull)}</span>
              ${awayRec ? `<span class="team-record">(${awayRec})</span>` : ""}
            </span>
            <span class="vs-divider">at</span>
            <span class="team-line">
              ${homeLogo ? `<img src="${homeLogo}" class="team-logo" alt="${safeText(homeFull)}" loading="lazy" onerror="this.style.display='none'" />` : ""}
              <span class="team-name-full">${safeText(homeFull)}</span>
              ${homeRec ? `<span class="team-record">(${homeRec})</span>` : ""}
            </span>
          </div>
        </td>
        <td class="center col-segment">
          <span class="segment-tag" data-segment="${slug(segment)}">${safeText(segmentLabel)}</span>
        </td>
        <td class="col-pick" data-label="Recommended Pick">
          <div class="pick-display">
            <span class="pick-label">${safeText(pickLabel)}</span>
            <span class="pick-odds">${safeText(odds)}</span>
          </div>
        </td>
        <td class="col-model-prediction" data-label="Model Prediction">
          <span class="model-prediction-text">${safeText(modelPredictionLabel)}</span>
        </td>
        <td class="center col-edge" data-edge-pts="${edgePts}" data-edge-pct="${edgePct}">
          <button class="edge-toggle" type="button" title="Click to toggle pts / %">
            <span class="edge-val edge-val-pts">${edgePts ? edgePts + " pts" : "-"}</span>
            <span class="edge-val edge-val-pct" hidden>${edgePct ? edgePct + "%" : "-"}</span>
          </button>
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

      renderFilteredRows();
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

    // Edge toggle: click toggles all edge cells between pts and %
    tbody.addEventListener("click", (evt) => {
      const toggle = evt.target.closest(".edge-toggle");
      if (!toggle) return;
      evt.preventDefault();
      // Toggle ALL edge cells in the table at once
      const allToggles = tbody.querySelectorAll(".edge-toggle");
      allToggles.forEach((btn) => {
        const pts = btn.querySelector(".edge-val-pts");
        const pct = btn.querySelector(".edge-val-pct");
        if (!pts || !pct) return;
        const showingPts = !pts.hidden;
        pts.hidden = showingPts;
        pct.hidden = !showingPts;
      });
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

      state.activePicks = enriched;
      state.lastFetchedAt = nowIso();

      renderFilteredRows();
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

  const reflectClearOnButton = (clearBtn) => {
    if (!clearBtn) return;
    const label =
      clearBtn.querySelector(".clear-label") || clearBtn.querySelector("span");
    if (!label) return;

    const timerKey = "__clearSlateTimer";
    if (clearBtn[timerKey]) {
      clearTimeout(clearBtn[timerKey]);
    }

    clearBtn.classList.add("is-cleared");
    clearBtn.disabled = true;
    label.textContent = "Cleared";

    clearBtn[timerKey] = setTimeout(() => {
      clearBtn.classList.remove("is-cleared");
      clearBtn.disabled = false;
      label.textContent = "Clear Slate";
      clearBtn[timerKey] = null;
    }, 1200);
  };

  const clearSlate = (clearBtn) => {
    state.activePicks = [];
    state.lastFetchedAt = null;
    try {
      localStorage.removeItem(WEEKLY_LINEUP_KEY);
    } catch (e) {}
    renderEmptyState("No picks loaded.");
    renderFilterChips();
    const target = el.lastRefreshed();
    if (target) target.textContent = "-";
    reflectClearOnButton(clearBtn);
  };

  const attachFetchHandlers = () => {
    const root = document.querySelector(".filter-toolbar");
    if (!root) return;

    root.addEventListener("click", (evt) => {
      const leaguePill = evt.target.closest(".ft-pill.ft-league[data-league]");
      if (leaguePill && !leaguePill.disabled) {
        evt.preventDefault();
        setLeagueFilter(leaguePill.getAttribute("data-league"));
        renderFilteredRows();
        return;
      }

      const toolbarDropdownBtn = evt.target.closest(".ft-dropdown-btn");
      if (toolbarDropdownBtn) {
        evt.preventDefault();
        const menu = toolbarDropdownBtn.nextElementSibling;
        const willOpen = !!menu && !menu.classList.contains("open");
        closeToolbarDropdowns();
        if (menu && willOpen) {
          menu.classList.add("open");
          toolbarDropdownBtn.classList.add("open");
          toolbarDropdownBtn.setAttribute("aria-expanded", "true");
        }
        return;
      }

      const toolbarDropdownItem = evt.target.closest(
        ".ft-dropdown-item[data-f][data-v]",
      );
      if (toolbarDropdownItem) {
        evt.preventDefault();
        const filterType = safeText(
          toolbarDropdownItem.getAttribute("data-f"),
        ).toLowerCase();
        const value = safeText(
          toolbarDropdownItem.getAttribute("data-v"),
        ).toLowerCase();
        if (filterType === "segment") {
          setSegmentFilter(value);
        } else if (filterType === "pick-type") {
          setPickTypeFilter(value);
        }
        closeToolbarDropdowns();
        renderFilteredRows();
        return;
      }

      const toolbarClear = evt.target.closest("#ft-clear");
      if (toolbarClear) {
        evt.preventDefault();
        clearFilters();
        closeToolbarDropdowns();
        renderFilteredRows();
        return;
      }

      // Clear Slate button
      const clearBtn = evt.target.closest("button[data-action='clear-slate']");
      if (clearBtn) {
        evt.preventDefault();
        clearSlate(clearBtn);
        return;
      }

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

    document.addEventListener("click", (evt) => {
      const chipBtn = evt.target.closest("button[data-clear-filter]");
      if (chipBtn) {
        evt.preventDefault();
        const key = chipBtn.getAttribute("data-clear-filter");
        if (key === "league") state.filters.league = "all";
        if (key === "segment") state.filters.segment = "all";
        if (key === "pickType") state.filters.pickType = "all";
        updateToolbarDropdownLabel("segment");
        updateToolbarDropdownLabel("pickType");
        renderFilteredRows();
        return;
      }

      const leaguePill = evt.target.closest(".league-pill[data-league]");
      if (leaguePill) {
        evt.preventDefault();
        const value = safeText(
          leaguePill.getAttribute("data-league"),
        ).toLowerCase();
        state.filters.league = value || "all";
        renderFilteredRows();
        return;
      }

      const segmentPill = evt.target.closest(".segment-pill[data-segment]");
      if (segmentPill) {
        evt.preventDefault();
        setSegmentFilter(segmentPill.getAttribute("data-segment"));
        renderFilteredRows();
        return;
      }

      const pickPill = evt.target.closest(".pick-pill[data-pick]");
      if (pickPill) {
        evt.preventDefault();
        setPickTypeFilter(pickPill.getAttribute("data-pick"));
        renderFilteredRows();
        return;
      }

      const quickAction = evt.target.closest(".filter-action-btn[data-action]");
      if (quickAction) {
        evt.preventDefault();
        const action = quickAction.getAttribute("data-action");
        const dropdown = quickAction.closest(".th-filter-dropdown");
        if (!dropdown) return;

        if (action === "clear" || action === "select-all") {
          if (dropdown.id === "filter-league") state.filters.league = "all";
          if (dropdown.id === "filter-segment") state.filters.segment = "all";
          if (dropdown.id === "filter-pick") state.filters.pickType = "all";
        }

        renderFilteredRows();
        return;
      }

      if (!evt.target.closest(".ft-dropdown")) {
        closeToolbarDropdowns();
      }
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        closeToolbarDropdowns();
      }
    });
  };

  const attachSortHandlers = () => {
    const thead = document.querySelector(".weekly-lineup-table thead");
    if (!thead) return;
    thead.addEventListener("click", (evt) => {
      const btn = evt.target.closest(".th-sort-btn");
      if (!btn) return;
      const th = btn.closest("th[data-sort]");
      if (!th) return;
      evt.preventDefault();
      const key = th.getAttribute("data-sort");
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.dir = key === "edge" || key === "fire" ? "desc" : "asc";
      }
      renderFilteredRows();
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

      renderFilteredRows();
      if (state.lastFetchedAt) setLastRefreshed(state.lastFetchedAt);
    } catch (e) {}
  };

  // Public API expected by WeeklyLineupSync
  window.WeeklyLineup = {
    getActivePicks() {
      return state.activePicks || [];
    },
    exportToDashboard() {
      return (state.activePicks || []).map((pick) => toCosmosPick(pick));
    },
    syncDashboardOutcomes(updatedPicks) {
      if (!Array.isArray(updatedPicks) || updatedPicks.length === 0) return;

      const updatesById = new Map(
        updatedPicks
          .filter((p) => p && p.id)
          .map((p) => [
            p.id,
            {
              status: p.status,
              result: p.result,
              pnl: p.pnl,
            },
          ]),
      );

      if (updatesById.size === 0) return;

      state.activePicks = (state.activePicks || []).map((pick) => {
        const updates = updatesById.get(pick.id);
        return updates ? { ...pick, ...updates } : pick;
      });

      renderFilteredRows();
      persistWeeklyLineupCache(state.activePicks);
    },
    populateTable(picks) {
      // Compatibility for other callers
      state.activePicks = Array.isArray(picks) ? picks : [];
      renderFilteredRows();
      persistWeeklyLineupCache(state.activePicks);
    },
    showNotification(message, type) {
      showToast(message, type);
    },
    showEmptyState(message) {
      renderEmptyState(message);
    },
  };

  // ===== BET SLIP =====

  const formatOddsDisplay = (odds) => {
    if (!odds || odds === "-") return "N/A";
    const n = parseInt(odds, 10);
    if (isNaN(n)) return String(odds);
    return n > 0 ? "+" + n : String(n);
  };

  const calculatePayout = (risk, odds) => {
    if (!risk || !odds) return 0;
    const n = parseInt(odds, 10);
    if (isNaN(n)) return 0;
    return n > 0 ? risk * (n / 100) : risk * (100 / Math.abs(n));
  };

  const handlePickRowClick = (evt) => {
    if (evt.target.closest("button")) return;
    if (evt.target.closest("input")) return;

    const row = evt.target.closest(".pick-row");
    if (!row) return;

    const pickId = row.getAttribute("data-pick-id");
    if (!pickId) return;

    const pick = state.activePicks.find((p) => p.id === pickId);
    if (!pick) return;

    const existingIdx = state.betSlip.findIndex((s) => s.pickId === pickId);
    if (existingIdx >= 0) {
      state.betSlip.splice(existingIdx, 1);
      row.classList.remove("slip-selected");
    } else {
      state.betSlip.push({
        pickId: pick.id,
        away: safeText(pick.awayTeam),
        home: safeText(pick.homeTeam),
        pick: formatPickLabel(pick),
        odds: safeText(pick.odds || "-110"),
        segment: normalizeSegment(pick.segment),
        sport: normalizeSport(pick.sport || pick.league),
        risk: 100,
      });
      row.classList.add("slip-selected");

      if (state.betSlip.length === 1) {
        document.body.classList.add("slip-open");
      }
    }

    renderBetSlip();
  };

  const renderBetSlip = () => {
    const picksContainer = document.getElementById("slip-picks");
    const emptyState = document.getElementById("slip-empty");
    const footer = document.getElementById("slip-footer");
    const countEl = document.getElementById("slip-count");

    if (!picksContainer) return;

    if (countEl) countEl.textContent = state.betSlip.length;

    if (state.betSlip.length === 0) {
      picksContainer.innerHTML = "";
      if (emptyState) emptyState.style.display = "";
      if (footer) footer.hidden = true;
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (footer) footer.hidden = false;

    const html = state.betSlip
      .map((pick, idx) => {
        const oddsDisplay = formatOddsDisplay(pick.odds);
        const payout = calculatePayout(pick.risk, pick.odds);

        return `
        <div class="slip-pick" data-idx="${idx}">
          <div class="slip-pick-header">
            <span class="slip-pick-game">${pick.away} @ ${pick.home}</span>
            <button class="slip-pick-remove" data-idx="${idx}">\u00d7</button>
          </div>
          <div class="slip-pick-selection">${pick.pick}</div>
          <div class="slip-pick-details">
            <span class="slip-pick-book">${pick.sport} \u00b7 ${pick.segment}</span>
            <span class="slip-pick-odds">${oddsDisplay}</span>
          </div>
          <div class="slip-pick-input">
            <span class="slip-input-label">Risk $</span>
            <input type="number" class="slip-input" id="slip-input-${idx}" name="slip-input-${idx}" value="${pick.risk}" data-idx="${idx}" min="0">
          </div>
          <div class="slip-pick-payout">
            <span class="slip-payout-label">To Win</span>
            <span class="slip-payout-value">$${payout.toFixed(2)}</span>
          </div>
        </div>
      `;
      })
      .join("");

    picksContainer.innerHTML = html;

    picksContainer.querySelectorAll(".slip-pick-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        removeBetSlipItem(idx);
      });
    });

    picksContainer.querySelectorAll(".slip-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        state.betSlip[idx].risk = parseFloat(e.target.value) || 0;
        updateSlipTotals();
      });
    });

    updateSlipTotals();
  };

  const removeBetSlipItem = (idx) => {
    const removed = state.betSlip.splice(idx, 1)[0];
    if (removed) {
      const row = document.querySelector(
        `.pick-row[data-pick-id="${removed.pickId}"]`,
      );
      if (row) row.classList.remove("slip-selected");
    }
    renderBetSlip();
  };

  const clearBetSlip = () => {
    state.betSlip = [];
    document
      .querySelectorAll(".pick-row.slip-selected")
      .forEach((r) => r.classList.remove("slip-selected"));
    renderBetSlip();
  };

  const updateSlipTotals = () => {
    const riskEl = document.getElementById("slip-risk");
    const winEl = document.getElementById("slip-win");
    let totalRisk = 0;
    let totalWin = 0;
    state.betSlip.forEach((pick) => {
      totalRisk += pick.risk || 0;
      totalWin += calculatePayout(pick.risk, pick.odds);
    });
    if (riskEl) riskEl.textContent = "$" + totalRisk.toFixed(0);
    if (winEl) winEl.textContent = "$" + totalWin.toFixed(2);
  };

  const toggleBetSlip = () => {
    document.body.classList.toggle("slip-open");
  };

  const attachBetSlipHandlers = () => {
    const tbody = el.tbody();
    if (tbody) {
      tbody.addEventListener("click", handlePickRowClick);
    }

    const slipToggle = document.getElementById("slip-toggle");
    if (slipToggle) {
      slipToggle.addEventListener("click", toggleBetSlip);
    }

    const slipClear = document.getElementById("slip-clear");
    if (slipClear) {
      slipClear.addEventListener("click", clearBetSlip);
    }
  };

  const syncSlipSelectedRows = () => {
    const selectedIds = new Set(state.betSlip.map((s) => s.pickId));
    document.querySelectorAll(".pick-row[data-pick-id]").forEach((row) => {
      const id = row.getAttribute("data-pick-id");
      row.classList.toggle("slip-selected", selectedIds.has(id));
    });
  };

  const init = () => {
    bootstrapFromCache();
    attachFetchHandlers();
    attachTrackHandlers();
    attachSortHandlers();
    attachBetSlipHandlers();
    syncFilterUi();
    syncSortUi();
    renderFilterChips();
    updateToolbarDropdownLabel("segment");
    updateToolbarDropdownLabel("pickType");

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
