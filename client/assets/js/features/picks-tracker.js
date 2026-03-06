/**
 * Mobile Picks v1.1
 * Live tracking for today's picks with real-time ESPN scores
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════
  // UNIQUE GAME LEGS — the individual bets that appear across tickets
  // ═══════════════════════════════════════════════════════════════════
  const LEGS = [];

  // ═══════════════════════════════════════════════════════════════════
  // STRAIGHT BETS
  // ═══════════════════════════════════════════════════════════════════
  const STRAIGHTS = [];

  // ═══════════════════════════════════════════════════════════════════
  // ROUND ROBIN TICKETS
  // ═══════════════════════════════════════════════════════════════════
  const ROUND_ROBINS = [];

  // ═══════════════════════════════════════════════════════════════════
  // UNIQUE GAMES — deduplicated from legs (for score fetching)
  // ═══════════════════════════════════════════════════════════════════
  const GAMES = {};

  // Map leg → game key for lookups
  const LEG_TO_GAME = {};

  function rebuildGameMaps() {
    Object.keys(GAMES).forEach((k) => delete GAMES[k]);
    Object.keys(LEG_TO_GAME).forEach((k) => delete LEG_TO_GAME[k]);

    LEGS.forEach((leg) => {
      const key = `${leg.away}__${leg.home}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      if (!GAMES[key]) {
        GAMES[key] = {
          sport: leg.sport,
          away: leg.away,
          home: leg.home,
          awayScore: 0,
          homeScore: 0,
          awayHalf1: 0,
          homeHalf1: 0,
          status: "scheduled",
          statusDetail: "",
          period: 0,
          clock: "",
          isFinal: false,
          isLive: false,
          legIds: [],
        };
      }
      GAMES[key].legIds.push(leg.id);
      LEG_TO_GAME[leg.id] = key;
    });
  }

  rebuildGameMaps();

  const parseNumber = (value, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.+-]/g, "");
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  };

  const parseOdds = (value, fallback = -110) => {
    const parsed = parseNumber(value, fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const calcToWinFromOdds = (risk, odds) => {
    if (!Number.isFinite(risk) || risk <= 0) return 0;
    if (!Number.isFinite(odds) || odds === 0) return 0;
    if (odds > 0) return (risk * odds) / 100;
    return (risk * 100) / Math.abs(odds);
  };

  const normalizeSportForTracker = (sport) => {
    const s = String(sport || "nba").toLowerCase();
    if (s === "ncaab") return "ncaam";
    return s;
  };

  const normalizeSportForApi = (sport) => {
    const upper = String(sport || "")
      .trim()
      .toUpperCase();
    if (!upper) return "";
    if (upper === "NCAAM") return "NCAAB";
    return upper;
  };

  const getTrackerSportScopeConfig = () => {
    const cfg = window.APP_CONFIG || {};
    const mode = String(cfg.TRACKER_SPORT_SCOPE_MODE || "auto").toLowerCase();
    const allowlist = Array.isArray(cfg.TRACKER_SPORT_ALLOWLIST)
      ? cfg.TRACKER_SPORT_ALLOWLIST.map((s) => normalizeSportForApi(s)).filter(
          Boolean,
        )
      : [];
    return {
      mode: mode === "allowlist" ? "allowlist" : "auto",
      allowlist,
    };
  };

  const inferPickType = (pick) => {
    const raw = String(pick.pickType || pick.market || "spread").toLowerCase();
    if (raw.includes("moneyline") || raw === "ml") return "ml";
    if (raw.includes("total") || raw.includes("over") || raw.includes("under"))
      return "total";
    return "spread";
  };

  const inferPickSide = (pick, type) => {
    const direction = String(pick.pickDirection || "").toLowerCase();
    const pickTeam = String(pick.pickTeam || pick.pick || "").toLowerCase();
    const away = String(pick.awayTeam || "").toLowerCase();
    const home = String(pick.homeTeam || "").toLowerCase();

    if (type === "total") {
      if (direction.includes("under") || pickTeam === "under") return "under";
      return "over";
    }

    if (direction.includes("away")) return "away";
    if (direction.includes("home")) return "home";
    if (pickTeam && away && pickTeam === away) return "away";
    if (pickTeam && home && pickTeam === home) return "home";
    return "home";
  };

  const formatLineValue = (line) => {
    if (line === null || line === undefined || line === "") return "";
    const num = parseNumber(line, NaN);
    if (Number.isNaN(num)) return String(line);
    if (Number.isInteger(num)) return String(num);
    return String(num);
  };

  const buildLegLabel = (
    type,
    side,
    line,
    odds,
    awayTeam,
    homeTeam,
    pickTeam,
  ) => {
    const awayShort = String(awayTeam || "Away")
      .split(" ")
      .slice(-1)[0];
    const homeShort = String(homeTeam || "Home")
      .split(" ")
      .slice(-1)[0];
    const lineText = formatLineValue(line);

    if (type === "total") {
      const prefix = side === "under" ? "U" : "O";
      return `${awayShort}/${homeShort} ${prefix} ${lineText}`.trim();
    }

    if (type === "ml") {
      const team = pickTeam || (side === "away" ? awayTeam : homeTeam);
      return `${team} ML ${odds >= 0 ? `+${odds}` : odds}`.trim();
    }

    const team = pickTeam || (side === "away" ? awayTeam : homeTeam);
    const spreadText = lineText
      ? String(lineText).startsWith("-")
        ? lineText
        : `+${lineText}`
      : "";
    return `${team} ${spreadText}`.trim();
  };

  const mapPickToLeg = (pick, index) => {
    const awayTeam = String(pick.awayTeam || "").trim();
    const homeTeam = String(pick.homeTeam || "").trim();
    if (!awayTeam || !homeTeam) return null;

    const type = inferPickType(pick);
    const side = inferPickSide(pick, type);
    const line = type === "ml" ? null : parseNumber(pick.line, 0);
    const odds = parseOdds(pick.odds, -110);
    const pickTeam = String(pick.pickTeam || pick.pick || "").trim();
    const label = buildLegLabel(
      type,
      side,
      line,
      odds,
      awayTeam,
      homeTeam,
      pickTeam,
    );
    const segment = String(pick.segment || "")
      .toUpperCase()
      .includes("1H")
      ? "1H"
      : undefined;

    const fallbackId = `${awayTeam}-${homeTeam}-${type}-${index}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return {
      id: String(pick.id || fallbackId),
      sport: normalizeSportForTracker(pick.sport || pick.league),
      type,
      side,
      line,
      odds,
      away: awayTeam,
      home: homeTeam,
      label,
      pickTeam,
      segment,
      resultStatus: String(pick.status || "").toLowerCase(),
    };
  };

  async function loadLockedPicksFromService() {
    if (!window.PicksService?.getAll) return false;

    try {
      const scope = getTrackerSportScopeConfig();
      let rows = [];

      if (scope.mode === "allowlist" && scope.allowlist.length > 0) {
        const responses = await Promise.all(
          scope.allowlist.map((sport) =>
            window.PicksService.getAll({
              locked: true,
              sport,
              limit: 300,
            }),
          ),
        );
        rows = responses.flat();
      } else {
        rows = await window.PicksService.getAll({ locked: true, limit: 300 });
      }

      if (!Array.isArray(rows) || rows.length === 0) return false;

      const deduped = [];
      const seenIds = new Set();
      rows.forEach((pick) => {
        const id = String(pick?.id || "");
        if (!id) {
          deduped.push(pick);
          return;
        }
        if (seenIds.has(id)) return;
        seenIds.add(id);
        deduped.push(pick);
      });

      const legs = [];
      const straights = [];

      deduped.forEach((pick, idx) => {
        const leg = mapPickToLeg(pick, idx);
        if (!leg) return;

        const risk = parseNumber(pick.risk, 100);
        const toWin = parseNumber(
          pick.toWin,
          calcToWinFromOdds(risk, leg.odds),
        );

        legs.push(leg);
        straights.push({ legId: leg.id, risk, toWin });
      });

      if (legs.length === 0) return false;

      LEGS.splice(0, LEGS.length, ...legs);
      STRAIGHTS.splice(0, STRAIGHTS.length, ...straights);
      ROUND_ROBINS.splice(0, ROUND_ROBINS.length);
      rebuildGameMaps();
      return true;
    } catch (error) {
      console.warn(
        "[TRACKER] Failed to load locked picks from PicksService:",
        error,
      );
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESPN TEAM-NAME ALIASES (for fuzzy matching)
  // ═══════════════════════════════════════════════════════════════════
  const TEAM_ALIASES = {
    "cleveland cavaliers": ["cavaliers", "cleveland", "cavs", "cle"],
    "oklahoma city thunder": ["thunder", "okc", "oklahoma city"],
    "northern kentucky": [
      "northern kentucky",
      "nku",
      "norse",
      "n kentucky",
      "northern ky",
    ],
    "youngstown state": ["youngstown", "youngstown st", "ysu", "penguins"],
    "saint peter's": [
      "saint peters",
      "st peters",
      "st. peter's",
      "saint peter's",
      "peacocks",
      "st peter's",
    ],
    siena: ["siena", "saints", "siena saints"],
    "robert morris": ["robert morris", "rmu", "rob morris", "colonials"],
    "wright state": ["wright state", "wright st", "raiders"],
    "purdue fort wayne": [
      "purdue fort wayne",
      "ipfw",
      "pfw",
      "mastodons",
      "fort wayne",
    ],
    "cleveland state": ["cleveland state", "cleveland st", "csu", "vikings"],
    "ohio state": ["ohio state", "ohio st", "osu", "buckeyes"],
    "michigan state": ["michigan state", "michigan st", "msu", "spartans"],
    iona: ["iona", "gaels"],
    merrimack: ["merrimack", "warriors"],
    "green bay": [
      "green bay",
      "wisc green bay",
      "wisconsin green bay",
      "phoenix",
      "gb",
    ],
    "detroit mercy": ["detroit mercy", "detroit", "titans", "det"],
    rice: ["rice", "owls"],
    utsa: ["utsa", "roadrunners", "ut san antonio"],
    milwaukee: [
      "milwaukee",
      "wisc milwaukee",
      "wisconsin milwaukee",
      "uwm",
      "panthers",
    ],
    oakland: ["oakland", "golden grizzlies"],
    uab: ["uab", "blazers", "alabama-birmingham"],
    "louisiana tech": ["louisiana tech", "la tech", "bulldogs"],
  };

  function normalizeTeam(name) {
    return (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  function teamsMatch(espnName, ourName) {
    const n1 = normalizeTeam(espnName);
    const n2 = normalizeTeam(ourName);
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    const aliases = TEAM_ALIASES[n2] || [];
    return aliases.some((a) => n1.includes(a) || a.includes(n1));
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCORE FETCHING — ESPN Scoreboard API
  // ═══════════════════════════════════════════════════════════════════
  let isUpdating = false;

  async function fetchScores() {
    if (isUpdating) return;
    isUpdating = true;
    try {
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const [nbaData, ncaamData] = await Promise.all([
        fetchESPN("basketball", "nba", today),
        fetchESPN("basketball", "mens-college-basketball", today),
      ]);
      matchGames(nbaData, "nba");
      matchGames(ncaamData, "ncaam");
      renderAll();
    } catch (e) {
      console.error("[TRACKER] Score fetch error:", e);
    } finally {
      isUpdating = false;
    }
  }

  async function fetchESPN(category, league, dateStr) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${category}/${league}/scoreboard?dates=${dateStr}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch (e) {
      clearTimeout(timer);
      console.warn("[TRACKER] ESPN fetch failed:", e.message);
      return [];
    }
  }

  function matchGames(events, sport) {
    for (const evt of events) {
      const comp = evt.competitions?.[0];
      if (!comp) continue;
      const competitors = comp.competitors || [];
      const homeC = competitors.find((c) => c.homeAway === "home");
      const awayC = competitors.find((c) => c.homeAway === "away");
      if (!homeC || !awayC) continue;

      const espnAway =
        awayC.team?.displayName || awayC.team?.shortDisplayName || "";
      const espnHome =
        homeC.team?.displayName || homeC.team?.shortDisplayName || "";

      // Find matching game in our list
      for (const [key, game] of Object.entries(GAMES)) {
        if (game.sport !== sport) continue;
        if (
          teamsMatch(espnAway, game.away) &&
          teamsMatch(espnHome, game.home)
        ) {
          game.awayScore = parseInt(awayC.score) || 0;
          game.homeScore = parseInt(homeC.score) || 0;

          const st = comp.status?.type || {};
          game.isFinal = st.completed === true;
          game.isLive = st.state === "in";
          game.status = st.state || "pre";
          game.statusDetail = st.detail || st.shortDetail || "";
          game.period = st.period || comp.status?.period || 0;
          game.clock = comp.status?.displayClock || "";

          // Extract half scores for 1H bets
          const linescores = awayC.linescores || [];
          const homeLinescores = homeC.linescores || [];
          game.awayHalf1 = parseInt(linescores[0]?.value) || 0;
          game.homeHalf1 = parseInt(homeLinescores[0]?.value) || 0;
          game.awayQuarters = linescores.map((ls) => parseInt(ls.value) || 0);
          game.homeQuarters = homeLinescores.map(
            (ls) => parseInt(ls.value) || 0,
          );

          // ESPN team abbrs for logo URLs
          game.awayAbbr = awayC.team?.abbreviation || "";
          game.homeAbbr = homeC.team?.abbreviation || "";
          game.awayLogo = awayC.team?.logo || "";
          game.homeLogo = homeC.team?.logo || "";
          break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LEG RESULT EVALUATION
  // ═══════════════════════════════════════════════════════════════════
  function evaluateLeg(leg) {
    if (leg.resultStatus === "won" || leg.resultStatus === "win") {
      return { status: "win", detail: "Graded WIN" };
    }
    if (leg.resultStatus === "lost" || leg.resultStatus === "loss") {
      return { status: "loss", detail: "Graded LOSS" };
    }
    if (leg.resultStatus === "push") {
      return { status: "push", detail: "Graded PUSH" };
    }

    const gameKey = LEG_TO_GAME[leg.id];
    const game = GAMES[gameKey];
    if (!game) return { status: "pending", detail: "" };

    if (game.status === "pre" || game.status === "scheduled") {
      return { status: "pending", detail: "Awaiting tipoff" };
    }

    const awayScore = game.awayScore;
    const homeScore = game.homeScore;
    const total = awayScore + homeScore;
    const isFinal = game.isFinal;
    // For 1H segment bets
    const is1H = leg.segment === "1H";
    const h1Done = game.period > 1 || isFinal;

    if (leg.type === "total") {
      let relevantTotal = total;
      if (is1H && h1Done) {
        relevantTotal = game.awayHalf1 + game.homeHalf1;
      }

      const diff =
        leg.side === "over"
          ? relevantTotal - leg.line
          : leg.line - relevantTotal;

      if (isFinal || (is1H && h1Done)) {
        if (diff > 0)
          return {
            status: "win",
            detail: `${relevantTotal} pts (${leg.side === "over" ? "+" : ""}${diff.toFixed(1)})`,
          };
        if (diff < 0)
          return {
            status: "loss",
            detail: `${relevantTotal} pts (${diff.toFixed(1)})`,
          };
        return { status: "push", detail: `${relevantTotal} pts (push)` };
      }
      // Live
      const pace =
        game.period > 0
          ? (relevantTotal * (game.sport === "nba" ? 4 : 2)) / game.period
          : 0;
      if (diff >= 0 || pace > leg.line)
        return {
          status: "on-track",
          detail: `${relevantTotal} pts | Pace: ${Math.round(pace)}`,
        };
      return {
        status: "at-risk",
        detail: `${relevantTotal} pts | Pace: ${Math.round(pace)}`,
      };
    }

    if (leg.type === "spread") {
      let aS = awayScore,
        hS = homeScore;
      if (is1H && h1Done) {
        aS = game.awayHalf1;
        hS = game.homeHalf1;
      }

      const pickIsAway = leg.side === "away";
      const margin = pickIsAway ? aS - hS : hS - aS;
      const cover = margin + leg.line;

      if (isFinal || (is1H && h1Done)) {
        if (cover > 0)
          return {
            status: "win",
            detail: `${pickIsAway ? aS : hS}-${pickIsAway ? hS : aS} (covered by ${cover.toFixed(1)})`,
          };
        if (cover < 0)
          return {
            status: "loss",
            detail: `${pickIsAway ? aS : hS}-${pickIsAway ? hS : aS} (missed by ${Math.abs(cover).toFixed(1)})`,
          };
        return { status: "push", detail: `Push` };
      }
      if (cover > 0)
        return {
          status: "on-track",
          detail: `${pickIsAway ? "+" : "+"}${cover.toFixed(1)} cover margin`,
        };
      return { status: "at-risk", detail: `${cover.toFixed(1)} cover margin` };
    }

    if (leg.type === "ml") {
      const pickIsAway = leg.side === "away";
      const pickScore = pickIsAway ? awayScore : homeScore;
      const oppScore = pickIsAway ? homeScore : awayScore;
      const lead = pickScore - oppScore;

      if (isFinal) {
        if (lead > 0) return { status: "win", detail: `Won by ${lead}` };
        if (lead < 0)
          return { status: "loss", detail: `Lost by ${Math.abs(lead)}` };
        return { status: "push", detail: "Push" };
      }
      if (lead >= 0)
        return {
          status: "on-track",
          detail: `${lead > 0 ? "Leading" : "Tied"} ${Math.abs(lead)}`,
        };
      return { status: "at-risk", detail: `Down ${Math.abs(lead)}` };
    }

    return { status: "pending", detail: "" };
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDERING — DOM Updates
  // ═══════════════════════════════════════════════════════════════════
  function renderAll() {
    renderGameCards();
    renderStraights();
    renderPickFeed();
    renderRoundRobins();
    renderRRFeed();
    renderKPIs();
  }

  // ── Unified Pick Feed (mobile card layout) ──
  function renderPickFeed() {
    const feed = document.getElementById("straights-feed");
    const empty = document.getElementById("feed-empty");
    if (!feed) return;

    feed.innerHTML = "";

    if (STRAIGHTS.length === 0) {
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";

    const TD = window.TeamData || {};
    const getLogo = TD.getTeamLogo || (() => "");
    const getLeagueLogo = TD.getLeagueLogo || (() => "");

    STRAIGHTS.forEach((bet) => {
      const leg = LEGS.find((l) => l.id === bet.legId);
      if (!leg) return;
      const result = evaluateLeg(leg);
      const gameKey = LEG_TO_GAME[leg.id];
      const game = GAMES[gameKey];
      const score =
        game && game.status !== "pre"
          ? `${game.awayScore}-${game.homeScore}`
          : "";
      const sportUp = (leg.sport || "").toUpperCase();
      const pnl = pnlValue(result.status, bet);
      const pnlCls = pnlClass(result.status, bet);

      // Team logos
      const league = leg.sport || "";
      const awayLogo = leg.away ? getLogo(leg.away, league) : "";
      const homeLogo = leg.home ? getLogo(leg.home, league) : "";
      const leagueLogo = getLeagueLogo(league);

      // Build matchup with logos
      let matchupHTML = "";
      if (leg.away && leg.home) {
        const awayImg = awayLogo ? `<img class="pf-team-logo" src="${awayLogo}" alt="" />` : "";
        const homeImg = homeLogo ? `<img class="pf-team-logo" src="${homeLogo}" alt="" />` : "";
        matchupHTML = `<div class="pf-matchup">${awayImg}<span>${leg.away}</span> <span class="pf-at">@</span> ${homeImg}<span>${leg.home}</span>${score ? ` <span class="pf-score">&middot; ${score}</span>` : ""}</div>`;
      }

      // League icon for sport tag
      const leagueImg = leagueLogo ? `<img class="pf-league-icon" src="${leagueLogo}" alt="" />` : "";

      const card = document.createElement("div");
      card.className = "pf-card";
      card.setAttribute("data-status", result.status);

      card.innerHTML = `
        <div class="pf-top">
          <span class="pf-sport">${leagueImg}${sportUp}</span>
          <span class="pf-status" data-status="${result.status}">${statusLabel(result.status)}</span>
        </div>
        <div class="pf-pick">${leg.label}</div>
        ${matchupHTML}
        ${result.detail ? `<div class="pf-detail">${result.detail}</div>` : ""}
        <div class="pf-money">
          <span class="pf-m"><span class="pf-ml">Risk</span>$${bet.risk.toLocaleString()}</span>
          <span class="pf-m"><span class="pf-ml">Win</span>$${bet.toWin.toLocaleString()}</span>
          <span class="pf-m pf-pnl ${pnlCls}"><span class="pf-ml">P&L</span>${pnl}</span>
        </div>
      `;
      feed.appendChild(card);
    });
  }

  function renderRRFeed() {
    const rrSection = document.getElementById("rr-section");
    const rrFeed = document.getElementById("rr-feed");
    if (!rrSection || !rrFeed) return;

    if (ROUND_ROBINS.length === 0) {
      rrSection.classList.add("rr-section-hidden");
      return;
    }
    rrSection.classList.remove("rr-section-hidden");
    rrFeed.innerHTML = "";

    ROUND_ROBINS.forEach((rr) => {
      const legs = rr.legs
        .map((id) => LEGS.find((l) => l.id === id))
        .filter(Boolean);
      const results = legs.map((l) => evaluateLeg(l));
      const allWin = results.every((r) => r.status === "win");
      const anyLoss = results.some((r) => r.status === "loss");
      const allSettled = results.every((r) =>
        ["win", "loss", "push"].includes(r.status),
      );

      let rrStatus = "pending";
      if (allWin) rrStatus = "win";
      else if (anyLoss && allSettled) rrStatus = "loss";
      else if (anyLoss) rrStatus = "at-risk";
      else if (results.some((r) => r.status === "on-track" || r.status === "at-risk"))
        rrStatus = results.some((r) => r.status === "at-risk") ? "at-risk" : "on-track";

      const legsHTML = legs
        .map((l, i) => {
          const r = results[i];
          return `<span class="pf-rr-leg"><span class="status-dot" data-status="${r.status}"></span>${l.label}</span>`;
        })
        .join("");

      const pnl = pnlValue(rrStatus, rr);
      const pnlCls = pnlClass(rrStatus, rr);

      const card = document.createElement("div");
      card.className = "pf-card";
      card.setAttribute("data-status", rrStatus);
      card.innerHTML = `
        <div class="pf-top">
          <span class="pf-sport">${rr.teams}-TEAM RR</span>
          <span class="pf-status" data-status="${rrStatus}">${statusLabel(rrStatus)}</span>
        </div>
        <div class="pf-rr-legs">${legsHTML}</div>
        <div class="pf-money">
          <span class="pf-m"><span class="pf-ml">Risk</span>$${rr.risk.toLocaleString()}</span>
          <span class="pf-m"><span class="pf-ml">Win</span>$${rr.toWin.toLocaleString()}</span>
          <span class="pf-m pf-pnl ${pnlCls}"><span class="pf-ml">P&L</span>${pnl}</span>
        </div>
      `;
      rrFeed.appendChild(card);
    });
  }

  function renderGameCards() {
    const container = document.getElementById("game-cards");
    if (!container) return;

    container.innerHTML = "";
    Object.entries(GAMES).forEach(([key, game]) => {
      const card = document.createElement("div");
      card.className = "game-card";
      if (game.isLive) card.classList.add("live");
      if (game.isFinal) card.classList.add("final");

      const sportLabel = game.sport === "nba" ? "NBA" : "NCAAM";
      const isHalves = game.sport === "ncaam";

      // Build period scores
      let periodHeaders = "";
      let awayPeriods = "";
      let homePeriods = "";

      if (isHalves) {
        periodHeaders =
          '<span class="period-hdr">1H</span><span class="period-hdr">2H</span>';
        const aq = game.awayQuarters || [];
        const hq = game.homeQuarters || [];
        awayPeriods = `<span class="period-score">${aq[0] ?? "-"}</span><span class="period-score">${aq[1] ?? "-"}</span>`;
        homePeriods = `<span class="period-score">${hq[0] ?? "-"}</span><span class="period-score">${hq[1] ?? "-"}</span>`;
      } else {
        for (let i = 1; i <= 4; i++) {
          periodHeaders += `<span class="period-hdr">Q${i}</span>`;
        }
        const aq = game.awayQuarters || [];
        const hq = game.homeQuarters || [];
        for (let i = 0; i < 4; i++) {
          awayPeriods += `<span class="period-score">${aq[i] ?? "-"}</span>`;
          homePeriods += `<span class="period-score">${hq[i] ?? "-"}</span>`;
        }
      }

      // Status chip
      let statusHTML = "";
      if (game.isFinal) {
        statusHTML = '<span class="game-status-chip final">FINAL</span>';
      } else if (game.isLive) {
        statusHTML = `<span class="game-status-chip live"><span class="live-dot"></span>${game.statusDetail || "LIVE"}</span>`;
      } else {
        statusHTML = `<span class="game-status-chip pre">${game.statusDetail || "Scheduled"}</span>`;
      }

      // Related legs
      const relatedLegs = LEGS.filter((l) => LEG_TO_GAME[l.id] === key);
      let legsHTML = relatedLegs
        .map((l) => {
          const result = evaluateLeg(l);
          return `<div class="leg-row"><span class="leg-label">${l.label}</span><span class="status-badge--mini" data-status="${result.status}">${statusLabel(result.status)}</span><span class="leg-detail">${result.detail}</span></div>`;
        })
        .join("");

      card.innerHTML = `
        <div class="game-card-header">
          <span class="sport-tag">${sportLabel}</span>
          ${statusHTML}
        </div>
        <div class="scoreboard-mini">
          <div class="sb-header">
            <span class="team-col"></span>
            ${periodHeaders}
            <span class="period-hdr total-hdr">T</span>
          </div>
          <div class="sb-row away">
            <span class="team-col">
              ${game.awayLogo ? `<img src="${game.awayLogo}" class="team-logo-sm" alt="" />` : ""}
              <span class="team-abbr">${game.awayAbbr || shortName(game.away)}</span>
            </span>
            ${awayPeriods}
            <span class="period-score total-score">${game.status !== "pre" ? game.awayScore : "-"}</span>
          </div>
          <div class="sb-row home">
            <span class="team-col">
              ${game.homeLogo ? `<img src="${game.homeLogo}" class="team-logo-sm" alt="" />` : ""}
              <span class="team-abbr">${game.homeAbbr || shortName(game.home)}</span>
            </span>
            ${homePeriods}
            <span class="period-score total-score">${game.status !== "pre" ? game.homeScore : "-"}</span>
          </div>
        </div>
        <div class="game-legs">${legsHTML}</div>
      `;
      container.appendChild(card);
    });
  }

  function shortName(name) {
    const parts = name.split(" ");
    return parts.length > 1
      ? parts[parts.length - 1].substring(0, 4).toUpperCase()
      : name.substring(0, 4).toUpperCase();
  }

  function statusLabel(s) {
    const map = {
      pending: "PENDING",
      "on-track": "ON TRACK",
      "at-risk": "AT RISK",
      win: "WIN",
      loss: "LOSS",
      push: "PUSH",
    };
    return map[s] || s.toUpperCase();
  }

  function renderStraights() {
    const tbody = document.getElementById("straights-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    STRAIGHTS.forEach((bet) => {
      const leg = LEGS.find((l) => l.id === bet.legId);
      if (!leg) return;
      const result = evaluateLeg(leg);
      const gameKey = LEG_TO_GAME[leg.id];
      const game = GAMES[gameKey];
      const score =
        game && game.status !== "pre"
          ? `${game.awayScore}-${game.homeScore}`
          : "--";

      const tr = document.createElement("tr");
      tr.setAttribute("data-status", result.status);
      tr.innerHTML = `
        <td class="label-cell">${leg.label}</td>
        <td class="score-cell">${score}</td>
        <td class="center"><span class="status-badge" data-status="${result.status}">${statusLabel(result.status)}</span></td>
        <td class="detail-cell">${result.detail}</td>
        <td class="money-cell risk">$${bet.risk.toLocaleString()}</td>
        <td class="money-cell win">$${bet.toWin.toLocaleString()}</td>
        <td class="money-cell pnl ${pnlClass(result.status, bet)}">${pnlValue(result.status, bet)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderRoundRobins() {
    const tbody = document.getElementById("rr-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    ROUND_ROBINS.forEach((rr, idx) => {
      const legs = rr.legs
        .map((id) => LEGS.find((l) => l.id === id))
        .filter(Boolean);
      const results = legs.map((l) => evaluateLeg(l));
      const allWin = results.every((r) => r.status === "win");
      const anyLoss = results.some((r) => r.status === "loss");
      const allSettled = results.every((r) =>
        ["win", "loss", "push"].includes(r.status),
      );

      let rrStatus = "pending";
      if (allWin) rrStatus = "win";
      else if (anyLoss && allSettled) rrStatus = "loss";
      else if (anyLoss) rrStatus = "at-risk";
      else if (
        results.some((r) => r.status === "on-track" || r.status === "at-risk")
      )
        rrStatus = results.some((r) => r.status === "at-risk")
          ? "at-risk"
          : "on-track";

      const legsHTML = legs
        .map((l, i) => {
          const r = results[i];
          return `<span class="rr-leg"><span class="status-dot" data-status="${r.status}"></span>${l.label}</span>`;
        })
        .join("");

      const tr = document.createElement("tr");
      tr.setAttribute("data-status", rrStatus);
      tr.innerHTML = `
        <td class="rr-type-cell">${rr.teams}-Team</td>
        <td class="rr-legs-cell">${legsHTML}</td>
        <td class="center"><span class="status-badge--mini" data-status="${rrStatus}">${statusLabel(rrStatus)}</span></td>
        <td class="money-cell risk">$${rr.risk.toLocaleString()}</td>
        <td class="money-cell win">$${rr.toWin.toLocaleString()}</td>
        <td class="money-cell pnl ${pnlClass(rrStatus, rr)}">${pnlValue(rrStatus, rr)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function pnlClass(status, bet) {
    if (status === "win") return "positive";
    if (status === "loss") return "negative";
    return "";
  }

  function pnlValue(status, bet) {
    if (status === "win") return `+$${bet.toWin.toLocaleString()}`;
    if (status === "loss") return `-$${bet.risk.toLocaleString()}`;
    if (status === "push") return "$0";
    return "--";
  }

  function renderKPIs() {
    // Totals from straights
    let totalRisk = 0,
      totalToWin = 0,
      settledPnl = 0,
      liveCount = 0,
      pendingCount = 0;
    let winsS = 0,
      lossesS = 0;

    STRAIGHTS.forEach((bet) => {
      totalRisk += bet.risk;
      totalToWin += bet.toWin;
      const leg = LEGS.find((l) => l.id === bet.legId);
      const result = evaluateLeg(leg);
      if (result.status === "win") {
        settledPnl += bet.toWin;
        winsS++;
      } else if (result.status === "loss") {
        settledPnl -= bet.risk;
        lossesS++;
      } else if (result.status === "on-track" || result.status === "at-risk")
        liveCount++;
      else pendingCount++;
    });

    let rrRisk = 0,
      rrToWin = 0;
    ROUND_ROBINS.forEach((rr) => {
      rrRisk += rr.risk;
      rrToWin += rr.toWin;
      const legs = rr.legs
        .map((id) => LEGS.find((l) => l.id === id))
        .filter(Boolean);
      const results = legs.map((l) => evaluateLeg(l));
      const allWin = results.every((r) => r.status === "win");
      const anyLoss = results.some((r) => r.status === "loss");
      if (allWin) settledPnl += rr.toWin;
      else if (anyLoss) settledPnl -= rr.risk;
    });

    totalRisk += rrRisk;
    totalToWin += rrToWin;

    setText("kpi-risk", `$${totalRisk.toLocaleString()}`);
    setText("kpi-to-win", `$${totalToWin.toLocaleString()}`);
    const pnlEl = document.getElementById("kpi-pnl");
    if (pnlEl) {
      const prefix = settledPnl >= 0 ? "+$" : "-$";
      pnlEl.textContent = `${prefix}${Math.abs(settledPnl).toLocaleString()}`;
      pnlEl.className = `kpi-value ${settledPnl >= 0 ? "positive" : "negative"}`;
    }
    setText("kpi-live", liveCount.toString());
    setText("kpi-pending", pendingCount.toString());
    setText("kpi-record", `${winsS}-${lossesS}`);

    // Last updated
    setText("last-updated", new Date().toLocaleTimeString());
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════
  let pollInterval = null;

  function setDynamicDate() {
    var now = new Date();
    var opts = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    var formatted = now.toLocaleDateString("en-US", opts);
    var dateLabel = document.getElementById("tracker-date-label");
    if (dateLabel) dateLabel.textContent = formatted;

    var shortOpts = { month: "short", day: "numeric", year: "numeric" };
    var shortDate = now.toLocaleDateString("en-US", shortOpts);
    document.title = "Mobile Picks \u2014 " + shortDate + " | GBSV";
  }

  function updateTableCounts() {
    setText("straights-count", STRAIGHTS.length.toString());
    setText("rr-count", ROUND_ROBINS.length.toString());
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOCAL STORAGE PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════
  const STORAGE_KEY = "gbsv_tracker_picks";

  function persistPicksToStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          legs: LEGS,
          straights: STRAIGHTS,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch (_) {}
  }

  function loadPicksFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!Array.isArray(data?.legs) || data.legs.length === 0) return false;
      LEGS.splice(0, LEGS.length, ...data.legs);
      STRAIGHTS.splice(0, STRAIGHTS.length, ...(data.straights || []));
      ROUND_ROBINS.splice(0, ROUND_ROBINS.length);
      rebuildGameMaps();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // AUTO-ADD FETCHED PICKS AS TRACKABLE STRAIGHTS
  // ═══════════════════════════════════════════════════════════════════
  function addFetchedPicks(picks) {
    if (!Array.isArray(picks) || picks.length === 0) return 0;

    const BASE = 500;
    const existingIds = new Set(LEGS.map((l) => l.id));
    let added = 0;

    picks.forEach((pick, idx) => {
      const leg = mapPickToLeg(pick, LEGS.length + idx);
      if (!leg) return;
      if (existingIds.has(leg.id)) return;

      const odds = leg.odds;
      let risk, toWin;
      if (odds < 0) {
        // Negative odds: to win $500, risk = 500 * (|odds| / 100)
        risk = Math.round(BASE * (Math.abs(odds) / 100));
        toWin = BASE;
      } else {
        // Positive odds: risk $500, to win = 500 * (odds / 100)
        risk = BASE;
        toWin = Math.round(BASE * (odds / 100));
      }

      LEGS.push(leg);
      STRAIGHTS.push({ legId: leg.id, risk, toWin });
      existingIds.add(leg.id);
      added++;
    });

    if (added > 0) {
      rebuildGameMaps();
      updateTableCounts();
      renderAll();
      fetchScores();
      persistPicksToStorage();
    }
    return added;
  }

  async function init() {
    setDynamicDate();

    const loaded = await loadLockedPicksFromService();
    if (!loaded) loadPicksFromStorage();

    // Pick up any picks fetched on other pages (Weekly Lineup, Dashboard, etc.)
    try {
      const shared = JSON.parse(
        localStorage.getItem("gbsv_shared_fetched_picks") || "[]",
      );
      if (shared.length > 0) addFetchedPicks(shared);
    } catch (_) {}

    updateTableCounts();
    fetchScores();
    pollInterval = setInterval(fetchScores, 30000);

    window.addEventListener("picksUpdated", async () => {
      const loaded = await loadLockedPicksFromService();
      if (loaded) {
        updateTableCounts();
        fetchScores();
      }
    });
  }

  // Visibility API — pause when tab hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(pollInterval);
      pollInterval = null;
    } else {
      fetchScores();
      if (!pollInterval) pollInterval = setInterval(fetchScores, 30000);
    }
  });

  document.addEventListener("DOMContentLoaded", init);

  // Manual refresh button
  document.addEventListener("click", (e) => {
    if (e.target.closest("#refresh-btn")) {
      fetchScores();
    }
  });

  // Clear all picks
  function clearAllPicks() {
    LEGS.splice(0, LEGS.length);
    STRAIGHTS.splice(0, STRAIGHTS.length);
    ROUND_ROBINS.splice(0, ROUND_ROBINS.length);
    Object.keys(GAMES).forEach((k) => delete GAMES[k]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("gbsv_shared_fetched_picks");
    } catch (_) {}
    updateTableCounts();
    renderAll();
    // Show empty state in feed
    const empty = document.getElementById("feed-empty");
    if (empty) empty.style.display = "";
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#mp-clear-picks")) {
      clearAllPicks();
    }
  });

  // Expose for debugging
  window.PicksTracker = {
    LEGS,
    STRAIGHTS,
    ROUND_ROBINS,
    GAMES,
    fetchScores,
    renderAll,
    addFetchedPicks,
    clearAllPicks,
  };
})();
