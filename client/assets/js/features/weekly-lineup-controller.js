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
    filters: {
      league: "all",
      segment: "all",
      pickType: "all",
      teamSearch: "",
    },
    sort: {
      key: "edge",
      dir: "desc",
    },
    activeFetchButtons: [],
    fetchGeneration: 0,
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

  const FETCH_TIMEOUT_MS = 30000;

  const isNormalizationDebugEnabled = () => {
    try {
      if (window.APP_CONFIG?.WEEKLY_LINEUP_DEBUG_NORMALIZATION === true) {
        return true;
      }
      const localValue = window.localStorage?.getItem(
        "gbsv_weekly_lineup_debug_normalization",
      );
      return (
        localValue === "1" || safeText(localValue).toLowerCase() === "true"
      );
    } catch (_error) {
      return false;
    }
  };

  const debugNormalization = (message, payload) => {
    if (!isNormalizationDebugEnabled()) return;
    if (payload === undefined) {
      console.debug(`[WeeklyLineup] ${message}`);
      return;
    }
    console.debug(`[WeeklyLineup] ${message}`, payload);
  };

  const setFetchButtonsLoading = (buttons, loading) => {
    const active = (buttons || []).filter(Boolean);
    if (!active.length) return;

    active.forEach((btn) => {
      btn.classList.toggle("loading", !!loading);
      btn.disabled = !!loading;
      btn.setAttribute("aria-busy", loading ? "true" : "false");
    });
  };

  const getPrimaryRefreshButton = () =>
    document.querySelector(".ft-fetch-all[data-fetch='all']");

  const withTimeout = async (promise, timeoutMs, message) => {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(message || "Request timed out"));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const formatDateFull = (isoDate) => {
    const text = safeText(isoDate).trim();
    if (!text) return "";
    let d = new Date(text);
    // Short dates like "3/6" or "Mar 6" may parse with wrong year
    if (!Number.isNaN(d.getTime()) && d.getFullYear() < 2020) {
      d = new Date(text + ", " + new Date().getFullYear());
    }
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
    // If already formatted (e.g. "7:00pm CST"), normalize and return
    if (/CST/i.test(timeStr)) {
      return timeStr.replace(/\s*(AM|PM)/i, (_, m) => m.toLowerCase());
    }
    // Try to parse and convert to CST (UTC-6)
    const d = new Date(timeStr);
    if (!Number.isNaN(d.getTime())) {
      const raw = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      });
      // "6:05 PM" → "6:05pm"
      const compact = raw.replace(/\s*(AM|PM)/i, (_, m) => m.toLowerCase());
      return compact + " CST";
    }
    // Fallback: append CST if it looks like a time
    if (/\d/.test(timeStr)) return timeStr + " CST";
    return timeStr;
  };

  const getModelLabel = (pick) => {
    const sport = normalizeSport(pick?.sport || pick?.league);
    const sportName =
      {
        NBA: "NBA",
        NCAAB: "NCAAM",
        NFL: "NFL",
        NCAAF: "NCAAF",
        NHL: "NHL",
        MLB: "MLB",
      }[sport] || sport;
    return `GBSV ${sportName}`;
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
    if (value === "1ST HALF" || value === "FIRST HALF") return "1H";
    if (value === "1H") return "1H";
    if (value === "2ND HALF" || value === "SECOND HALF") return "2H";
    if (value === "2H") return "2H";
    if (value === "1Q" || value === "1ST QUARTER" || value === "FIRST QUARTER")
      return "1Q";
    if (value === "2Q" || value === "2ND QUARTER" || value === "SECOND QUARTER")
      return "2Q";
    if (value === "3Q" || value === "3RD QUARTER" || value === "THIRD QUARTER")
      return "3Q";
    if (value === "4Q" || value === "4TH QUARTER" || value === "FOURTH QUARTER")
      return "4Q";
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
      btn.textContent = labelMap[state.filters.segment] || "Segment";
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
      btn.textContent = labelMap[state.filters.pickType] || "Pick Type";
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
    state.filters.teamSearch = "";
    const searchInput = document.getElementById("ft-team-search");
    if (searchInput) searchInput.value = "";
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

    if (state.filters.teamSearch) {
      const q = state.filters.teamSearch;
      const away = safeText(pick.awayTeam).toLowerCase();
      const home = safeText(pick.homeTeam).toLowerCase();
      const awayFull = resolveFullName(
        pick.awayTeam,
        pick.sport || pick.league,
      ).toLowerCase();
      const homeFull = resolveFullName(
        pick.homeTeam,
        pick.sport || pick.league,
      ).toLowerCase();
      if (
        !away.includes(q) &&
        !home.includes(q) &&
        !awayFull.includes(q) &&
        !homeFull.includes(q)
      ) {
        return false;
      }
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

  const sortPicks = (picks) => {
    const { key, dir } = state.sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...picks].sort((a, b) => {
      const va = sortKeyExtractor(a, key);
      const vb = sortKeyExtractor(b, key);
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * mult;
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
      const pickTypeLabelMap = {
        spread: "Spread",
        moneyline: "ML",
        total: "O/U",
        "team-total": "Team Total",
      };
      chips.push({
        key: "pickType",
        label: `Pick: ${pickTypeLabelMap[state.filters.pickType] || state.filters.pickType}`,
      });
    }
    if (state.filters.teamSearch) {
      chips.push({
        key: "teamSearch",
        label: `Team: ${state.filters.teamSearch}`,
      });
    }

    host.innerHTML = "";
    host.setAttribute("data-has-chips", chips.length > 0 ? "true" : "false");

    chips.forEach((chip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.setAttribute("data-clear-filter", chip.key);
      const label = document.createElement("span");
      label.className = "chip-label";
      label.textContent = chip.label;
      const remove = document.createElement("span");
      remove.className = "chip-remove";
      remove.setAttribute("aria-hidden", "true");
      remove.textContent = "x";
      button.appendChild(label);
      button.appendChild(remove);
      host.appendChild(button);
    });

    if (chips.length > 1) {
      const clearAllBtn = document.createElement("button");
      clearAllBtn.type = "button";
      clearAllBtn.className = "clear-all-filters";
      clearAllBtn.setAttribute("data-clear-filter", "all");
      clearAllBtn.textContent = "Clear All";
      host.appendChild(clearAllBtn);
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (state.filters.league !== "all") count += 1;
    if (state.filters.segment !== "all") count += 1;
    if (state.filters.pickType !== "all") count += 1;
    if (state.filters.teamSearch) count += 1;
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
      th.setAttribute("aria-sort", "none");
      if (icon) icon.textContent = "▲";
      if (key === state.sort.key) {
        th.classList.add(
          state.sort.dir === "asc" ? "sorted-asc" : "sorted-desc",
        );
        th.setAttribute(
          "aria-sort",
          state.sort.dir === "asc" ? "ascending" : "descending",
        );
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
    if (s === "NHL")
      return { src: "assets/icons/league-nhl-official.svg", alt: "NHL" };
    if (s === "MLB") return { src: "assets/mlb-logo.png", alt: "MLB" };
    return { src: "", alt: s };
  };

  const getTeamLogoUrl = (teamName, sport) => {
    if (!teamName) return "";
    const normalizedSport = normalizeSport(sport);
    const leagueKey =
      normalizedSport === "NCAAB" ? "ncaam" : normalizedSport.toLowerCase();

    const compact = (value) =>
      safeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const nbaIdMap = {
      gsw: "gs",
      nyk: "ny",
      nop: "no",
      sas: "sa",
      uta: "utah",
      was: "wsh",
    };

    const normalizeTeamId = (id) => {
      const clean = compact(id);
      if (!clean) return "";
      if (leagueKey === "nba") return nbaIdMap[clean] || clean;
      if (leagueKey === "ncaam" || leagueKey === "ncaab") {
        return /^\d+$/.test(clean) ? clean : "";
      }
      return clean;
    };

    const infoAbbr = window.TeamData?.getTeamInfo?.(teamName, leagueKey)?.abbr;
    const sharedAbbr = window.SharedUtils?.getTeamAbbr?.(teamName);
    const rawNameId = /\s/.test(teamName) ? "" : safeText(teamName);
    const teamId =
      normalizeTeamId(infoAbbr) ||
      normalizeTeamId(sharedAbbr) ||
      normalizeTeamId(rawNameId);

    // Use TeamData for logo if available (most reliable)
    const teamLogo = window.TeamData?.getTeamLogo?.(teamName, leagueKey);
    if (teamLogo) return teamLogo;

    // Prefer ID-based lookup to avoid bad "nba-500-full team name.png" URLs
    // during mapping-load races; NCAA can also use full-name variant resolution.
    if (window.LogoLoader?.getLogoUrl) {
      let loaderLogo = "";
      if (teamId) {
        loaderLogo = window.LogoLoader.getLogoUrl(leagueKey, teamId);
      }
      if (!loaderLogo && (leagueKey === "ncaam" || leagueKey === "ncaab")) {
        loaderLogo = window.LogoLoader.getLogoUrl(
          leagueKey,
          teamName.toLowerCase(),
        );
      }
      if (loaderLogo) return loaderLogo;
    }

    if (!teamId) return "";

    const logoBase = (
      window.APP_CONFIG?.LOGO_BASE_URL ||
      window.APP_CONFIG?.LOGO_FALLBACK_URL ||
      "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos"
    ).replace(/\/+$/, "");
    // NCAA team logos require numeric ESPN IDs; do not synthesize invalid IDs
    // from abbreviations (e.g. "bet", "mic"), which only create noisy 404s.
    if (leagueKey === "ncaam" || leagueKey === "ncaab") {
      if (!/^\d+$/.test(teamId)) return "";
      return `${logoBase}/ncaa-500-${teamId}.png`;
    }

    const folder = leagueKey === "ncaaf" ? "ncaa" : leagueKey;
    return `${logoBase}/${folder}-500-${teamId}.png`;
  };

  const getTeamShortCode = (teamName) => {
    const fromShared = window.SharedUtils?.getTeamAbbr?.(teamName);
    if (fromShared) return safeText(fromShared).toUpperCase().slice(0, 4);

    const raw = safeText(teamName).trim();
    if (!raw) return "TEAM";

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase();
    return parts
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 4)
      .toUpperCase();
  };

  // Resolve abbreviated team names (e.g. "UTA Jazz") to full names ("Utah Jazz")
  const resolveFullName = (teamName, sport) => {
    if (!teamName) return "";
    const info = window.TeamData?.getTeamInfo?.(teamName, sport?.toLowerCase());
    return (info && info.fullName) || teamName;
  };

  const parseMatchupTeams = (matchupText) => {
    const text = safeText(matchupText).trim();
    if (!text) return { awayTeam: "", homeTeam: "" };

    const separators = [" @ ", " at ", " vs ", " vs. ", " v ", " - "];
    for (const sep of separators) {
      const parts = text.split(sep);
      if (parts.length === 2) {
        return {
          awayTeam: safeText(parts[0]).trim(),
          homeTeam: safeText(parts[1]).trim(),
        };
      }
    }

    return { awayTeam: "", homeTeam: "" };
  };

  const normalizeRecordValue = (recordValue) => {
    if (recordValue === undefined || recordValue === null) return "";

    if (typeof recordValue === "string") {
      const trimmed = recordValue.trim();
      return trimmed;
    }

    if (typeof recordValue === "number") {
      return Number.isFinite(recordValue) ? String(recordValue) : "";
    }

    if (typeof recordValue === "object") {
      const wins = recordValue.wins ?? recordValue.win ?? recordValue.W;
      const losses = recordValue.losses ?? recordValue.loss ?? recordValue.L;
      const ties = recordValue.ties ?? recordValue.tie ?? recordValue.T;

      if (wins !== undefined && losses !== undefined) {
        if (ties !== undefined && ties !== null && String(ties) !== "0") {
          return `${wins}-${losses}-${ties}`;
        }
        return `${wins}-${losses}`;
      }

      const nested =
        recordValue.overall || recordValue.record || recordValue.summary;
      if (nested && nested !== recordValue) {
        return normalizeRecordValue(nested);
      }
    }

    return "";
  };

  const lookupFallbackRecord = (teamName, sport) => {
    const team = safeText(teamName).trim();
    if (!team) return "";
    const canonicalTeam = resolveFullName(team, sport);

    const directRecord = window.AutoGameFetcher?.getTeamRecord?.(team);
    if (directRecord) return safeText(directRecord).trim();
    const canonicalDirectRecord =
      window.AutoGameFetcher?.getTeamRecord?.(canonicalTeam);
    if (canonicalDirectRecord) return safeText(canonicalDirectRecord).trim();

    const cache = window.AutoGameFetcher?.getRecordsCache?.();
    if (cache && typeof cache === "object") {
      const lower = team.toLowerCase();
      if (cache[lower]) return safeText(cache[lower]).trim();
      const canonicalLower = safeText(canonicalTeam).toLowerCase();
      if (canonicalLower && cache[canonicalLower]) {
        return safeText(cache[canonicalLower]).trim();
      }
    }

    const info =
      window.TeamData?.getTeamInfo?.(team, sport?.toLowerCase()) ||
      window.TeamData?.getTeamInfo?.(canonicalTeam, sport?.toLowerCase());
    return normalizeRecordValue(info?.record || info?.overallRecord || "");
  };

  const inferSegmentFromText = (...fields) => {
    for (const field of fields) {
      const text = safeText(field).toUpperCase();
      if (!text) continue;
      if (/\b1H\b/.test(text) || /\b1ST\s*HALF\b/.test(text)) return "1H";
      if (/\b2H\b/.test(text) || /\b2ND\s*HALF\b/.test(text)) return "2H";
      if (/\b1Q\b/.test(text) || /\b1ST\s*QU?A?R?T?E?R?\b/.test(text))
        return "1Q";
      if (/\b2Q\b/.test(text) || /\b2ND\s*QU?A?R?T?E?R?\b/.test(text))
        return "2Q";
      if (/\b3Q\b/.test(text) || /\b3RD\s*QU?A?R?T?E?R?\b/.test(text))
        return "3Q";
      if (/\b4Q\b/.test(text) || /\b4TH\s*QU?A?R?T?E?R?\b/.test(text))
        return "4Q";
    }
    return "";
  };

  const normalizeIncomingPick = (pick) => {
    const raw = pick || {};
    const sport = normalizeSport(
      raw.sport || raw.league || raw.modelSport || raw.model_sport,
    );

    const parsedMatchup = parseMatchupTeams(
      raw.matchup || raw.game || raw.event,
    );
    const awayTeam = safeText(
      raw.awayTeam ||
        raw.away_team ||
        raw.away ||
        raw.away_name ||
        raw.awayTeamName ||
        parsedMatchup.awayTeam,
    ).trim();
    const homeTeam = safeText(
      raw.homeTeam ||
        raw.home_team ||
        raw.home ||
        raw.home_name ||
        raw.homeTeamName ||
        parsedMatchup.homeTeam,
    ).trim();

    const normalizedPickType = normalizePickType(
      raw.pickType || raw.pick_type || raw.market || raw.marketType,
    );

    let pickDirection = safeText(
      raw.pickDirection || raw.pick_direction,
    ).trim();
    const pickTeam = safeText(
      raw.pickTeam ||
        raw.pick_team ||
        raw.pick ||
        raw.pickLabel ||
        raw.selection ||
        raw.predictedWinner,
    ).trim();

    if (!pickDirection) {
      const upperPickTeam = pickTeam.toUpperCase();
      if (upperPickTeam === "OVER" || upperPickTeam === "UNDER") {
        pickDirection = upperPickTeam;
      }
    }

    const awayModelRecord = normalizeRecordValue(
      raw.awayRecord ||
        raw.away_record ||
        raw.awayTeamRecord ||
        raw.away_team_record ||
        raw.awayRecordSummary,
    );
    const homeModelRecord = normalizeRecordValue(
      raw.homeRecord ||
        raw.home_record ||
        raw.homeTeamRecord ||
        raw.home_team_record ||
        raw.homeRecordSummary,
    );
    const awayFallbackRecord = awayModelRecord
      ? ""
      : lookupFallbackRecord(awayTeam, sport);
    const homeFallbackRecord = homeModelRecord
      ? ""
      : lookupFallbackRecord(homeTeam, sport);
    const awayRecord = awayModelRecord || awayFallbackRecord;
    const homeRecord = homeModelRecord || homeFallbackRecord;

    const normalizedGameDate = safeText(
      raw.gameDate || raw.game_date || raw.date || "",
    ).trim();
    const normalizedGameTime = safeText(
      raw.gameTime || raw.time || raw.timeCst || raw.time_cst || "",
    ).trim();

    return {
      ...raw,
      sport,
      league: sport,
      awayTeam,
      homeTeam,
      awayRecord,
      homeRecord,
      pickType: normalizedPickType,
      pickTeam,
      pickDirection,
      segment:
        raw.segment ||
        raw.period ||
        raw.gameSegment ||
        inferSegmentFromText(
          pickTeam,
          raw.rawPickLabel,
          raw.pick_display,
          raw.pickLabel,
          raw.pick,
          raw.marketType,
          raw.market,
        ) ||
        "FG",
      line:
        raw.line ||
        raw.marketLine ||
        raw.market_line ||
        raw.pick_line ||
        raw.spread ||
        raw.total ||
        "",
      odds:
        raw.odds ??
        raw.oddsAmerican ??
        raw.odds_american ??
        raw.pick_odds ??
        raw.price ??
        "-110",
      gameDate: normalizedGameDate || new Date().toISOString(),
      gameTime: normalizedGameTime,
      _normalizeMeta: {
        awayRecordSource: awayModelRecord
          ? "model"
          : awayFallbackRecord
            ? "fallback"
            : "none",
        homeRecordSource: homeModelRecord
          ? "model"
          : homeFallbackRecord
            ? "fallback"
            : "none",
        awayTeamSource:
          parsedMatchup.awayTeam && !raw.awayTeam ? "matchup" : "model",
        homeTeamSource:
          parsedMatchup.homeTeam && !raw.homeTeam ? "matchup" : "model",
      },
    };
  };

  const fireEmoji = (fire) => {
    const n = Math.max(0, Math.min(5, parseInt(fire, 10) || 0));
    if (n <= 0) return "";
    return "🔥".repeat(n);
  };

  const resolveOverUnder = (pick) => {
    const dir = safeText(pick.pickDirection).toUpperCase();
    if (dir.includes("OVER")) return "Over";
    if (dir.includes("UNDER")) return "Under";
    const team = safeText(pick.pickTeam).toUpperCase();
    if (team.includes("OVER") || team === "O") return "Over";
    if (team.includes("UNDER") || team === "U") return "Under";
    const raw = safeText(
      pick.rawPickLabel || pick.pick_display || pick.pick || "",
    ).toUpperCase();
    if (raw.includes("OVER") || /\bO\s+\d/.test(raw)) return "Over";
    if (raw.includes("UNDER") || /\bU\s+\d/.test(raw)) return "Under";
    return "";
  };

  const formatPickLabel = (pick) => {
    const type = safeText(pick.pickType || "").toLowerCase();
    const line = safeText(pick.line);

    if (type === "total" || type === "team-total") {
      const dir = resolveOverUnder(pick);
      return dir ? `${dir} ${line}`.trim() : `Total ${line}`.trim();
    }

    if (type === "moneyline" || type === "ml") {
      const team = safeText(pick.pickTeam)
        .replace(/\s+ML$/i, "")
        .trim();
      return team || "ML";
    }

    // Spread — ensure we show team + line
    const team = safeText(pick.pickTeam).trim();
    if (team && line) return `${team} ${line}`;
    if (team) return team;
    return line || "-";
  };

  const pickTypeBadge = (pick) => {
    const type = safeText(pick.pickType || "").toLowerCase();
    if (type === "total") return "O/U";
    if (type === "team-total") return "TT";
    if (type === "moneyline" || type === "ml") return "ML";
    return "SPR";
  };

  /**
   * Format pick cell as a single clean line:
   *   Moneyline: Florida A&M (-110)
   *   Spread: Florida A&M -7.5 (-110)
   *   Total: Full Game Over 175.5 (-110)
   */
  const formatPickCellLine = (pick, pickLabel, odds, segmentLabel) => {
    const type = safeText(pick.pickType || "spread").toLowerCase();
    let oddsStr = safeText(odds).trim();
    // Add "+" prefix for positive American odds
    if (oddsStr && /^\d/.test(oddsStr)) oddsStr = "+" + oddsStr;
    const oddsPart = oddsStr ? ` (${oddsStr})` : "";

    if (type === "moneyline" || type === "ml") {
      const team = safeText(pick.pickTeam)
        .replace(/\s+ML$/i, "")
        .trim();
      return `${team || "ML"}${oddsPart}`;
    }

    if (type === "total" || type === "team-total") {
      const dir = resolveOverUnder(pick);
      const line = safeText(pick.line).trim();
      const seg = segmentLabel || "Full Game";
      if (dir && line) return `${seg} ${dir} ${line}${oddsPart}`;
      if (dir) return `${seg} ${dir}${oddsPart}`;
      if (line) return `${seg} ${line}${oddsPart}`;
      return `${seg} Total${oddsPart}`;
    }

    // Spread — fallback to predictedWinner or infer from line sign
    let team = safeText(pick.pickTeam).trim();
    if (!team) {
      team = safeText(pick.predictedWinner || "").trim();
    }
    const line = safeText(pick.line).trim();
    if (team && line) return `${team} ${line}${oddsPart}`;
    if (team) return `${team}${oddsPart}`;
    return `${line || "-"}${oddsPart}`;
  };

  const formatModelPrediction = (pick) => {
    const pickType = normalizePickType(pick.pickType);
    const marketLine = safeText(pick.line).trim();
    const edge =
      typeof pick.edge === "number"
        ? pick.edge
        : parseFloat(String(pick.edge || "").replace("%", "")) || 0;

    // 1. Explicit prediction from the model
    const explicitPrediction = safeText(
      pick.modelPrediction ||
        pick.prediction ||
        pick.predictedOutcome ||
        pick.projectedOutcome,
    ).trim();
    if (explicitPrediction) return explicitPrediction;

    // 2. Predicted scores → "Away 108 – Home 102"
    const awayScore =
      pick.predictedAwayScore ??
      pick.awayPredictedScore ??
      pick.away_score_pred;
    const homeScore =
      pick.predictedHomeScore ??
      pick.homePredictedScore ??
      pick.home_score_pred;
    if (awayScore != null && homeScore != null) {
      const aNum = parseFloat(awayScore);
      const hNum = parseFloat(homeScore);
      const label = `${safeText(pick.awayTeam)} ${safeText(awayScore)} – ${safeText(pick.homeTeam)} ${safeText(homeScore)}`;
      if (pickType === "total" && !Number.isNaN(aNum) && !Number.isNaN(hNum)) {
        return `${label} (proj ${(aNum + hNum).toFixed(1)})`;
      }
      return label;
    }

    // 3. Model-generated line
    const modelLine = safeText(
      pick.modelSpread ||
        pick.modelPrice ||
        pick.modelLine ||
        pick.model_line ||
        pick.projectedLine,
    ).trim();
    if (modelLine) {
      if (pickType === "total") {
        return marketLine
          ? `Proj ${modelLine} · Line ${marketLine}`
          : `Proj total ${modelLine}`;
      }
      if (pickType === "moneyline") {
        const num = parseFloat(modelLine);
        if (!Number.isNaN(num) && num > 0 && num < 1) {
          return `Win prob ${(num * 100).toFixed(0)}%`;
        }
        return `Model ${modelLine}`;
      }
      // Spread
      return marketLine
        ? `Model ${modelLine} · Line ${marketLine}`
        : `Model ${modelLine}`;
    }

    // 4. Synthesize from edge + market line
    if (edge && marketLine) {
      const mNum = parseFloat(marketLine);
      if (!Number.isNaN(mNum)) {
        if (pickType === "total") {
          const dir = resolveOverUnder(pick);
          const projTotal = dir === "Under" ? mNum - edge : mNum + edge;
          return `Proj ${projTotal.toFixed(1)} · Line ${marketLine}`;
        }
        // Spread: model spread = market line - edge
        return `Model ${(mNum - edge).toFixed(1)} · Line ${marketLine}`;
      }
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
      renderEmptyState("No picks fetched yet. Open Leagues to load picks.");
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

      const date = [
        pick.gameDate,
        pick.date,
        pick.scheduled,
        pick.start,
        pick.time,
        pick.gameTime,
      ]
        .map((value) => safeText(value).trim())
        .find(Boolean);
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
      const awayRec = safeText(pick.awayRecord || "").trim();
      const homeRec = safeText(pick.homeRecord || "").trim();

      // Edge: show pts with toggleable % view
      const edgePts = edge ? edge.toFixed(1) : "";
      const edgePct = pick.edgePct
        ? parseFloat(String(pick.edgePct).replace("%", "")).toFixed(1)
        : edge
          ? (edge * 2.5).toFixed(1)
          : ""; // estimate % if not provided

      const formattedPickLine = formatPickCellLine(
        pick,
        pickLabel,
        odds,
        segmentLabel,
      );
      const pickBadge = pickTypeBadge(pick);
      const awayShort = getTeamShortCode(awayFull || pick.awayTeam);
      const homeShort = getTeamShortCode(homeFull || pick.homeTeam);

      tr.innerHTML = `
        <td class="col-datetime">
          <div class="datetime-cell datetime-cell-inline">
            <span class="datetime-formatted">
              <span class="datetime-piece datetime-date">${safeText(dateText)}</span>
              <span class="datetime-piece datetime-time">${safeText(timeCst) || "TBD"}</span>
              <span class="datetime-piece datetime-model">${safeText(modelLabel)}</span>
            </span>
          </div>
        </td>
        <td class="center col-league">
          <div class="league-cell">
            ${leagueLogo.src ? `<img src="${leagueLogo.src}" class="league-logo" alt="${leagueLogo.alt}" />` : safeText(leagueLogo.alt)}
          </div>
        </td>
        <td class="col-matchup">
          <div class="matchup-cell matchup-inline">
            <span class="team-line">
              <span class="team-logo-wrap${awayLogo ? "" : " logo-fallback-only"}">
                ${awayLogo ? `<img src="${awayLogo}" class="team-logo" alt="${safeText(awayFull)}" onerror="this.style.display='none';this.parentElement.classList.add('logo-fallback-visible');" />` : ""}
                <span class="team-logo-fallback">${safeText(awayShort)}</span>
              </span>
              <span class="team-name-full">${safeText(awayFull)}</span>
              <span class="team-record">${awayRec ? `(${awayRec})` : "(--)"}</span>
            </span>
            <span class="vs-divider">at</span>
            <span class="team-line">
              <span class="team-logo-wrap${homeLogo ? "" : " logo-fallback-only"}">
                ${homeLogo ? `<img src="${homeLogo}" class="team-logo" alt="${safeText(homeFull)}" onerror="this.style.display='none';this.parentElement.classList.add('logo-fallback-visible');" />` : ""}
                <span class="team-logo-fallback">${safeText(homeShort)}</span>
              </span>
              <span class="team-name-full">${safeText(homeFull)}</span>
              <span class="team-record">${homeRec ? `(${homeRec})` : "(--)"}</span>
            </span>
          </div>
        </td>
        <td class="center col-segment">
          <span class="segment-tag" data-segment="${slug(segment)}">${safeText(segmentLabel)}</span>
        </td>
        <td class="col-pick" data-label="Recommended Pick">
          <div class="pick-display pick-display-inline">
            <span class="pick-type-badge pick-type-${slug(safeText(pick.pickType || "spread"))}">${safeText(pickBadge)}</span>
            <span class="pick-line-formatted">${safeText(formattedPickLine)}</span>
          </div>
        </td>
        <td class="col-model-prediction" data-label="Model Prediction">
          <span class="model-prediction-text">${safeText(modelPredictionLabel || "-")}</span>
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

    // Share with Mobile Picks tracker via localStorage
    try {
      const existing = JSON.parse(
        localStorage.getItem("gbsv_shared_fetched_picks") || "[]",
      );
      const seenIds = new Set(existing.map((p) => p.id));
      const merged = [...existing];
      for (const p of picks) {
        if (p.id && !seenIds.has(p.id)) {
          merged.push(p);
          seenIds.add(p.id);
        }
      }
      localStorage.setItem("gbsv_shared_fetched_picks", JSON.stringify(merged));
    } catch (_) {}
  };

  const parseLineNumber = (value) => {
    const cleaned = safeText(value)
      .replace(/[^0-9+.-]/g, "")
      .trim();
    if (!cleaned) return null;
    const numeric = parseFloat(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const teamKey = (teamName, sport) =>
    slug(resolveFullName(safeText(teamName).trim(), sport) || teamName);

  const findSlateMatchForImportedPick = (pick) => {
    const currentSlate = Array.isArray(state.activePicks)
      ? state.activePicks
      : [];
    if (!currentSlate.length) return null;

    const targetSport = normalizeSport(pick.sport || pick.league);
    const targetPickType = normalizePickType(pick.pickType || "");
    const targetSegment = normalizeSegment(pick.segment || "FG");
    const targetPickTeamKey = teamKey(pick.pickTeam, targetSport);
    const targetLine = parseLineNumber(pick.line);
    const targetDirection = safeText(pick.pickDirection).trim().toLowerCase();

    const scored = [];

    for (const slatePick of currentSlate) {
      const slateSport = normalizeSport(slatePick.sport || slatePick.league);
      if (slateSport !== targetSport) continue;

      let score = 0;

      if (normalizePickType(slatePick.pickType) === targetPickType) {
        score += 4;
      }

      if (normalizeSegment(slatePick.segment || "FG") === targetSegment) {
        score += 3;
      }

      const slatePickTeamKey = teamKey(slatePick.pickTeam, slateSport);
      const slateAwayKey = teamKey(slatePick.awayTeam, slateSport);
      const slateHomeKey = teamKey(slatePick.homeTeam, slateSport);

      if (targetPickTeamKey) {
        if (targetPickTeamKey === slatePickTeamKey) score += 6;
        if (
          targetPickTeamKey === slateAwayKey ||
          targetPickTeamKey === slateHomeKey
        ) {
          score += 5;
        }

        if (
          targetPickTeamKey !== slatePickTeamKey &&
          targetPickTeamKey !== slateAwayKey &&
          targetPickTeamKey !== slateHomeKey &&
          ((slateAwayKey && slateAwayKey.includes(targetPickTeamKey)) ||
            (slateHomeKey && slateHomeKey.includes(targetPickTeamKey)) ||
            (targetPickTeamKey.includes(slateAwayKey) &&
              slateAwayKey.length >= 4) ||
            (targetPickTeamKey.includes(slateHomeKey) &&
              slateHomeKey.length >= 4))
        ) {
          score += 2;
        }
      }

      if (
        (targetPickType === "total" || targetPickType === "team-total") &&
        targetDirection &&
        safeText(slatePick.pickDirection).trim().toLowerCase() ===
          targetDirection
      ) {
        score += 2;
      }

      const slateLine = parseLineNumber(slatePick.line);
      if (targetLine != null && slateLine != null) {
        const diff = Math.abs(targetLine - slateLine);
        if (diff < 0.01) score += 3;
        else if (diff <= 0.25) score += 2;
        else if (diff <= 0.5) score += 1;
      }

      if (score > 0) {
        scored.push({ score, slatePick });
      }
    }

    if (!scored.length) return null;

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1];

    // Require a clear match to avoid assigning wrong games.
    if (best.score < 7) return null;
    if (second && second.score === best.score) return null;

    return best.slatePick;
  };

  const buildImportedPick = (rawPick, defaults = {}) => {
    const raw = rawPick || {};
    const fallbackSportsbook = safeText(defaults.sportsbook).trim();
    const fallbackSportsbookKey = safeText(defaults.sportsbookKey).trim();
    const fallbackSource = safeText(defaults.source).trim() || "manual-import";

    const normalized = normalizeIncomingPick({
      ...raw,
      sportsbook:
        safeText(raw.sportsbook || raw.book).trim() ||
        fallbackSportsbook ||
        fallbackSportsbookKey ||
        "Manual Upload",
      book:
        safeText(raw.book || raw.sportsbook).trim() ||
        fallbackSportsbookKey ||
        fallbackSportsbook ||
        "manual",
      source: safeText(raw.source).trim() || fallbackSource,
    });

    const prepared = { ...normalized };
    delete prepared._normalizeMeta;

    if (
      !safeText(prepared.awayTeam).trim() ||
      !safeText(prepared.homeTeam).trim()
    ) {
      const slateMatch = findSlateMatchForImportedPick(prepared);
      if (slateMatch) {
        prepared.sport = prepared.sport || slateMatch.sport;
        prepared.league = prepared.league || slateMatch.league;
        prepared.awayTeam = safeText(
          prepared.awayTeam || slateMatch.awayTeam,
        ).trim();
        prepared.homeTeam = safeText(
          prepared.homeTeam || slateMatch.homeTeam,
        ).trim();
        prepared.gameDate = safeText(
          prepared.gameDate ||
            prepared.date ||
            slateMatch.gameDate ||
            slateMatch.date ||
            "",
        ).trim();
        prepared.gameTime = safeText(
          prepared.gameTime ||
            prepared.time ||
            slateMatch.gameTime ||
            slateMatch.time ||
            "",
        ).trim();
        if (!safeText(prepared.pickTeam).trim()) {
          prepared.pickTeam = safeText(slateMatch.pickTeam).trim();
        }
      }
    }

    prepared.awayTeam = safeText(prepared.awayTeam).trim();
    prepared.homeTeam = safeText(prepared.homeTeam).trim();
    if (!prepared.awayTeam || !prepared.homeTeam) {
      return null;
    }

    prepared.pickType = normalizePickType(prepared.pickType || "spread");
    prepared.segment = normalizeSegment(prepared.segment || "FG");
    prepared.status = safeText(prepared.status || "pending").toLowerCase();
    prepared.gameDate = safeText(prepared.gameDate || prepared.date || nowIso())
      .slice(0, 10)
      .trim();
    prepared.gameTime = safeText(
      prepared.gameTime || prepared.time || "",
    ).trim();
    prepared.id = prepared.id || computePickId(prepared);
    prepared.locked = prepared.locked === true;
    prepared.lockedAt = prepared.locked ? prepared.lockedAt || nowIso() : null;
    prepared.source = safeText(prepared.source || fallbackSource);
    prepared.sportsbook = safeText(prepared.sportsbook).trim();
    prepared.book = safeText(prepared.book).trim();

    return prepared;
  };

  const mergeImportedPicks = (incomingPicks, options = {}) => {
    const sourceList = Array.isArray(incomingPicks) ? incomingPicks : [];
    const defaults = {
      sportsbook: options.sportsbook,
      sportsbookKey: options.sportsbookKey,
      source: options.source || "manual-import",
    };

    const prepared = sourceList
      .map((pick) => buildImportedPick(pick, defaults))
      .filter(Boolean);

    const dropped = Math.max(0, sourceList.length - prepared.length);
    if (!prepared.length) {
      return {
        added: 0,
        updated: 0,
        dropped,
        totalAfter: (state.activePicks || []).length,
        merged: [],
      };
    }

    const byId = new Map(
      (state.activePicks || []).map((pick) => [pick.id, pick]),
    );
    let added = 0;
    let updated = 0;
    const mergedImported = [];

    for (const incoming of prepared) {
      const existing = byId.get(incoming.id);
      if (existing) {
        const existingStatus = safeText(existing.status || "").toLowerCase();
        const merged = {
          ...existing,
          ...incoming,
          status:
            existingStatus && existingStatus !== "pending"
              ? existing.status
              : incoming.status,
          result: existing.result ?? incoming.result,
          pnl: existing.pnl ?? incoming.pnl,
          locked: existing.locked === true ? true : incoming.locked === true,
          lockedAt:
            existing.locked === true
              ? existing.lockedAt || nowIso()
              : incoming.lockedAt || null,
        };
        byId.set(merged.id, merged);
        mergedImported.push(merged);
        updated += 1;
        continue;
      }

      byId.set(incoming.id, incoming);
      mergedImported.push(incoming);
      added += 1;
    }

    state.activePicks = Array.from(byId.values());
    state.lastFetchedAt = nowIso();
    renderFilteredRows();
    setLastRefreshed(state.lastFetchedAt);
    persistWeeklyLineupCache(state.activePicks);

    return {
      added,
      updated,
      dropped,
      totalAfter: state.activePicks.length,
      merged: mergedImported,
    };
  };

  const saveImportedPicksToCosmos = async (picks) => {
    if (!window.PicksService?.create) return false;
    if (!Array.isArray(picks) || picks.length === 0) return false;

    const payload = picks.map((pick) => {
      const normalized = toCosmosPick(pick);
      normalized.id = normalized.id || computePickId(normalized);
      return normalized;
    });

    try {
      await window.PicksService.create(payload);
      return true;
    } catch (error) {
      showToast(
        `Imported picks saved locally but Cosmos sync failed: ${error.message || error}`,
        "warning",
      );
      return false;
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

  const fetchAndRender = async (league, triggerButton) => {
    if (state.isFetching) {
      showToast("Refresh already in progress", "info");
      return;
    }

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      showToast("Model fetchers not loaded", "error");
      return;
    }

    const normalizedLeague = safeText(league).toLowerCase() || "all";
    const buttons = [
      triggerButton,
      getPrimaryRefreshButton(),
      document.querySelector(
        `.league-fetch-item[data-fetch='${normalizedLeague}']`,
      ),
    ].filter(Boolean);
    state.activeFetchButtons = buttons;
    setFetchButtonsLoading(buttons, true);

    state.isFetching = true;
    const fetchGen = state.fetchGeneration;

    // Clear stale persisted picks so they don't resurface on reload
    try {
      localStorage.removeItem(WEEKLY_LINEUP_KEY);
      localStorage.removeItem("gbsv_shared_fetched_picks");
    } catch (_) {}

    try {
      // NCAAM: prefer weekly endpoint which returns the full week's picks
      let result;
      const isNcaam =
        normalizedLeague === "ncaam" || normalizedLeague === "ncaab";
      if (isNcaam && window.NCAAMPicksFetcher?.fetchWeeklyPicks) {
        const weeklyData = await withTimeout(
          window.NCAAMPicksFetcher.fetchWeeklyPicks({ skipCache: true }),
          FETCH_TIMEOUT_MS,
          "NCAAM weekly refresh timed out.",
        );
        if (weeklyData?.picks?.length) {
          // Wrap in the same shape UnifiedPicksFetcher returns
          result = {
            picks: weeklyData.picks.map((p) => ({
              ...p,
              sport: "NCAAM",
              league: "NCAAM",
            })),
            source: "ncaam-weekly",
          };
        }
      }
      // Fallback: use UnifiedPicksFetcher for non-NCAAM or if weekly endpoint failed
      if (!result) {
        const date = getDateParamForFetchers();
        result = await withTimeout(
          window.UnifiedPicksFetcher.fetchPicks(normalizedLeague, date, {
            skipCache: true,
          }),
          FETCH_TIMEOUT_MS,
          "Refresh timed out. Please try again.",
        );
      }

      // If clearSlate was called while fetching, discard results
      if (fetchGen !== state.fetchGeneration) return;

      const picks = Array.isArray(result?.picks) ? result.picks : [];
      const normalized = picks.map((p) => normalizeIncomingPick(p));
      const droppedCount = normalized.filter(
        (p) => !(p.awayTeam && p.homeTeam),
      ).length;

      if (isNormalizationDebugEnabled()) {
        const summary = normalized.reduce(
          (acc, p) => {
            const meta = p._normalizeMeta || {};
            if (meta.awayRecordSource === "fallback") acc.awayFallback += 1;
            if (meta.homeRecordSource === "fallback") acc.homeFallback += 1;
            if (meta.awayRecordSource === "none") acc.awayMissing += 1;
            if (meta.homeRecordSource === "none") acc.homeMissing += 1;
            if (meta.awayTeamSource === "matchup") acc.awayFromMatchup += 1;
            if (meta.homeTeamSource === "matchup") acc.homeFromMatchup += 1;
            return acc;
          },
          {
            total: normalized.length,
            dropped: droppedCount,
            awayFallback: 0,
            homeFallback: 0,
            awayMissing: 0,
            homeMissing: 0,
            awayFromMatchup: 0,
            homeFromMatchup: 0,
          },
        );
        debugNormalization("Normalization summary", summary);
        debugNormalization(
          "Normalization samples",
          normalized.slice(0, 5).map((p) => ({
            sport: p.sport,
            awayTeam: p.awayTeam,
            homeTeam: p.homeTeam,
            awayRecord: p.awayRecord,
            homeRecord: p.homeRecord,
            meta: p._normalizeMeta,
          })),
        );
      }

      const enriched = normalized
        .filter((p) => p.awayTeam && p.homeTeam)
        .map((p) => {
          const withId = { ...p };
          delete withId._normalizeMeta;
          withId.gameDate = safeText(withId.gameDate).slice(0, 10);
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
      setFetchButtonsLoading(state.activeFetchButtons, false);
      state.activeFetchButtons = [];
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
    // Bump generation so any in-flight fetch is discarded on completion
    state.fetchGeneration += 1;
    state.activePicks = [];
    state.lastFetchedAt = null;
    state.isFetching = false;
    setFetchButtonsLoading(state.activeFetchButtons, false);
    state.activeFetchButtons = [];
    try {
      localStorage.removeItem(WEEKLY_LINEUP_KEY);
      localStorage.removeItem("gbsv_shared_fetched_picks");
    } catch (e) {}
    // Flush in-memory caches so stale data can't resurface
    if (window.UnifiedPicksFetcher?.clearCache) {
      window.UnifiedPicksFetcher.clearCache();
    }
    if (window.DataCacheManager?.clear) {
      window.DataCacheManager.clear();
    }
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
        fetchAndRender("all", btn);
        return;
      }

      if (code === "ncaab" || code === "ncaam") {
        fetchAndRender("ncaam", btn);
        return;
      }

      fetchAndRender(code, btn);
    });

    document.addEventListener("click", (evt) => {
      const chipBtn = evt.target.closest("button[data-clear-filter]");
      if (chipBtn) {
        evt.preventDefault();
        const key = chipBtn.getAttribute("data-clear-filter");
        if (key === "all") {
          clearFilters();
          renderFilteredRows();
          return;
        }
        if (key === "league") state.filters.league = "all";
        if (key === "segment") state.filters.segment = "all";
        if (key === "pickType") state.filters.pickType = "all";
        if (key === "teamSearch") {
          state.filters.teamSearch = "";
          const searchInput = document.getElementById("ft-team-search");
          if (searchInput) searchInput.value = "";
        }
        updateToolbarDropdownLabel("segment");
        updateToolbarDropdownLabel("pickType");
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

    const searchInput = document.getElementById("ft-team-search");
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.filters.teamSearch = searchInput.value.trim().toLowerCase();
          renderFilteredRows();
        }, 200);
      });
    }
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

  const BOOTSTRAP_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

  const bootstrapFromCache = () => {
    try {
      const raw = localStorage.getItem(WEEKLY_LINEUP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.picks)) return;

      // Discard stale cached picks (older than 30 min)
      if (parsed.fetchedAt) {
        const age = Date.now() - new Date(parsed.fetchedAt).getTime();
        if (age > BOOTSTRAP_MAX_AGE_MS) {
          localStorage.removeItem(WEEKLY_LINEUP_KEY);
          return;
        }
      }

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
    async appendImportedPicks(picks, options = {}) {
      const summary = mergeImportedPicks(picks, options);
      if (summary.added + summary.updated === 0) {
        return summary;
      }

      const shouldSave = options.saveToCosmos !== false;
      const savedToCosmos = shouldSave
        ? await saveImportedPicksToCosmos(summary.merged)
        : false;

      return {
        ...summary,
        savedToCosmos,
      };
    },
    showNotification(message, type) {
      showToast(message, type);
    },
    showEmptyState(message) {
      renderEmptyState(message);
    },
  };

  const init = () => {
    // Only load from cache initially if live load fails, to prevent stale data
    // bootstrapFromCache();

    attachFetchHandlers();
    attachTrackHandlers();
    attachSortHandlers();
    syncFilterUi();
    syncSortUi();
    renderFilterChips();
    updateToolbarDropdownLabel("segment");
    updateToolbarDropdownLabel("pickType");

    if (state.lastFetchedAt) {
      setLastRefreshed(state.lastFetchedAt);
    }

    // Auto-fetch fresh live data on load (replaces stale cache)
    const refBtn = document.querySelector("button[data-fetch='all']");
    if (refBtn) {
      fetchAndRender("all", refBtn).catch(() => bootstrapFromCache());
    } else {
      fetchAndRender("all").catch(() => bootstrapFromCache());
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
