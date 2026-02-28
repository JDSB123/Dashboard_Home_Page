/* ==========================================================================
   DAILY SLATE - VEGAS SPORTSBOOK v3.0 (Cleaned)
   ==========================================================================
   - FG + 1H odds in single row per matchup
   - Expandable rows for 1Q, Team Totals, Props
   - Betslip sidebar
   ========================================================================== */

(function () {
  "use strict";

  // ===== STATE =====
  let games = [];
  let betslip = [];
  let activeLeague = "all";
  let expandedGames = new Set();

  // XSS-safe HTML escaping
  const esc = window.SharedUtils?.escapeHtml || ((s) => String(s ?? ""));

  // ===== INITIALIZATION =====
  document.addEventListener("DOMContentLoaded", initDailySlate);

  function initDailySlate() {
    initLeagueTabs();
    initRefreshButton();
    initBetslip();
    initFilters();
    initSorting();
    loadGames();
    console.log("✅ Daily Slate v3.0 loaded");
  }

  // ===== SORTING STATE =====
  let currentSort = { column: "datetime", direction: "asc" };

  // ===== FILTER STATE =====
  let activeFilters = {
    datetime: {
      range: "today",
      timeSlots: [
        "morning",
        "early",
        "afternoon",
        "evening",
        "primetime",
        "late",
      ],
    },
    matchup: { league: "all", teams: [] },
  };

  // ===== REFRESH BUTTON =====
  function initRefreshButton() {
    const refreshBtn = document.getElementById("refresh-slate-btn");
    if (!refreshBtn) return;

    refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("spinning");
      await loadGames();
      setTimeout(() => refreshBtn.classList.remove("spinning"), 500);
    });
  }

  // ===== LEAGUE TABS =====
  function initLeagueTabs() {
    const tabs = document.querySelectorAll(".slate-league-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeLeague = tab.dataset.league;
        renderGames();
      });
    });
  }

  // ===== LOAD GAMES =====
  async function loadGames() {
    console.log("📊 Loading games...");

    try {
      const apiGames = await fetchGamesFromApi();
      games = apiGames && apiGames.length > 0 ? apiGames : [];
    } catch (error) {
      console.error("❌ Error loading games:", error);
      games = [];
    }

    renderGames();
    updateKPIs();
  }

  async function fetchGamesFromApi() {
    // Try to fetch games from The Odds API or ESPN
    // Returns empty array if no odds API is configured
    const baseUrl =
      window.APP_CONFIG?.API_BASE_URL ||
      window.APP_CONFIG?.API_BASE_FALLBACK ||
      `${window.location.origin}/api`;

    try {
      // Try orchestrator odds endpoint first
      const response = await fetch(`${baseUrl}/get-odds`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.games && Array.isArray(data.games)) {
          console.log(`✅ Loaded ${data.games.length} games from API`);
          return data.games;
        }
      }

      console.log("⚠️ Odds API not available - showing empty state");
      return [];
    } catch (error) {
      console.warn("⚠️ Could not fetch odds:", error.message);
      return [];
    }
  }

  // ===== MOCK DATA REMOVED =====
  // Production version - no fake/sample data
  // Real data comes from /api/get-odds endpoint

  // ===== RENDER GAMES =====
  function renderGames() {
    const tbody = document.getElementById("slate-tbody");
    const emptyState = document.getElementById("slate-empty-state");
    if (!tbody) return;

    // Filter by league (from tabs)
    let filtered =
      activeLeague === "all"
        ? games
        : games.filter((g) => g.league === activeLeague);

    // Apply matchup filter (from dropdown)
    if (activeFilters.matchup.league !== "all") {
      filtered = filtered.filter(
        (g) => g.league === activeFilters.matchup.league,
      );
    }

    // Sort games
    filtered = sortGames(filtered);

    if (filtered.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    tbody.innerHTML = filtered
      .map((game) => {
        let html = renderGameRow(game);
        if (expandedGames.has(game.id)) {
          html += renderExpandedRow(game);
        }
        return html;
      })
      .join("");

    bindOddsButtons();
    bindExpandButtons();
    updateKPIs();
  }

  function renderGameRow(game) {
    const isExpanded = expandedGames.has(game.id);
    const fg = game.odds.fg;
    const h1 = game.odds["1h"];
    const tt = game.odds.teamTotal;

    const awayLogo = getTeamLogoUrl(game.awayTeam.abbr, game.league);
    const homeLogo = getTeamLogoUrl(game.homeTeam.abbr, game.league);

    const awayRank = game.awayTeam.rank
      ? `<span class="team-ranking">#${esc(game.awayTeam.rank)}</span>`
      : "";
    const homeRank = game.homeTeam.rank
      ? `<span class="team-ranking">#${esc(game.homeTeam.rank)}</span>`
      : "";

    return `
            <tr class="zebra-row ${game.isLive ? "live-game" : ""}" data-game-id="${esc(game.id)}">
                <td>
                    <div class="datetime-cell">
                        ${
                          game.isLive
                            ? `<span class="live-badge"><span class="live-dot"></span>LIVE</span>
                               <span class="cell-time">${esc(game.liveInfo.period)} ${esc(game.liveInfo.clock)}</span>`
                            : `<span class="cell-date">${esc(game.date)}</span>
                               <span class="cell-time">${esc(game.time)}</span>`
                        }
                    </div>
                </td>
                <td>
                    <div class="matchup-cell">
                        <div class="team-line">
                            <img src="${awayLogo}" class="team-logo" alt="${esc(game.awayTeam.abbr)}" onerror="this.style.display='none'">
                            <div class="team-name-wrapper">
                                ${awayRank}
                                <span class="team-name-full">${esc(game.awayTeam.name)}</span>
                                <span class="team-record">${esc(game.awayTeam.record)}</span>
                            </div>
                            ${game.isLive ? `<span class="live-score">${esc(game.liveInfo.awayScore)}</span>` : ""}
                        </div>
                        <span class="vs-divider">@</span>
                        <div class="team-line">
                            <img src="${homeLogo}" class="team-logo" alt="${esc(game.homeTeam.abbr)}" onerror="this.style.display='none'">
                            <div class="team-name-wrapper">
                                ${homeRank}
                                <span class="team-name-full">${esc(game.homeTeam.name)}</span>
                                <span class="team-record">${esc(game.homeTeam.record)}</span>
                            </div>
                            ${game.isLive ? `<span class="live-score">${esc(game.liveInfo.homeScore)}</span>` : ""}
                        </div>
                    </div>
                </td>
                <td class="center">${renderFullGameSection(game, fg, tt)}</td>
                <td class="center">${renderHalfSection(game, h1)}</td>
                <td class="center">
                    <button class="expand-btn ${isExpanded ? "expanded" : ""}" data-game-id="${game.id}">
                        <span>1Q / TT</span>
                        <span class="expand-arrow">▼</span>
                    </button>
                </td>
            </tr>
        `;
  }

  function renderFullGameSection(game, fg, tt) {
    return `
            <div class="odds-section fg-section">
                ${renderOddsGroup("Spread", [
                  renderOddsRow(game.awayTeam.abbr, [
                    renderOddsBtn(
                      game.id,
                      "spread",
                      "away",
                      "fg",
                      fg.spread.away.line,
                      fg.spread.away.odds,
                    ),
                  ]),
                  renderOddsRow(game.homeTeam.abbr, [
                    renderOddsBtn(
                      game.id,
                      "spread",
                      "home",
                      "fg",
                      fg.spread.home.line,
                      fg.spread.home.odds,
                    ),
                  ]),
                ])}
                ${renderOddsGroup("Moneyline", [
                  renderOddsRow(game.awayTeam.abbr, [
                    renderMlBtn(game.id, "ml", "away", "fg", fg.ml.away),
                  ]),
                  renderOddsRow(game.homeTeam.abbr, [
                    renderMlBtn(game.id, "ml", "home", "fg", fg.ml.home),
                  ]),
                ])}
                ${renderOddsGroup("Total O/U", [
                  renderOddsRow("O", [
                    renderOddsBtn(
                      game.id,
                      "total",
                      "over",
                      "fg",
                      fg.total.line,
                      fg.total.over,
                    ),
                  ]),
                  renderOddsRow("U", [
                    renderOddsBtn(
                      game.id,
                      "total",
                      "under",
                      "fg",
                      fg.total.line,
                      fg.total.under,
                    ),
                  ]),
                ])}
                ${renderTeamTotalsGroup(game, tt)}
            </div>
        `;
  }

  function renderHalfSection(game, h1) {
    if (!h1) return '<div class="odds-placeholder">No 1H lines</div>';

    return `
            <div class="odds-section half-section">
                ${renderOddsGroup("Spread 1H", [
                  renderOddsRow(game.awayTeam.abbr, [
                    renderOddsBtn(
                      game.id,
                      "spread",
                      "away",
                      "1h",
                      h1.spread.away.line,
                      h1.spread.away.odds,
                    ),
                  ]),
                  renderOddsRow(game.homeTeam.abbr, [
                    renderOddsBtn(
                      game.id,
                      "spread",
                      "home",
                      "1h",
                      h1.spread.home.line,
                      h1.spread.home.odds,
                    ),
                  ]),
                ])}
                ${renderOddsGroup("Moneyline 1H", [
                  renderOddsRow(game.awayTeam.abbr, [
                    renderMlBtn(game.id, "ml", "away", "1h", h1.ml.away),
                  ]),
                  renderOddsRow(game.homeTeam.abbr, [
                    renderMlBtn(game.id, "ml", "home", "1h", h1.ml.home),
                  ]),
                ])}
                ${renderOddsGroup("Total O/U 1H", [
                  renderOddsRow("O", [
                    renderOddsBtn(
                      game.id,
                      "total",
                      "over",
                      "1h",
                      h1.total.line,
                      h1.total.over,
                    ),
                  ]),
                  renderOddsRow("U", [
                    renderOddsBtn(
                      game.id,
                      "total",
                      "under",
                      "1h",
                      h1.total.line,
                      h1.total.under,
                    ),
                  ]),
                ])}
            </div>
        `;
  }

  function renderTeamTotalsGroup(game, tt) {
    if (!tt) {
      return renderOddsGroup("Team Total", [
        renderOddsRow("TT", [
          '<span class="odds-placeholder">No team totals</span>',
        ]),
      ]);
    }

    return renderOddsGroup("Team Total", [
      renderOddsRow(game.awayTeam.abbr, [
        renderOddsBtn(
          game.id,
          "teamTotal",
          "away-over",
          "fg",
          "O " + tt.away.line,
          tt.away.over,
        ),
        renderOddsBtn(
          game.id,
          "teamTotal",
          "away-under",
          "fg",
          "U " + tt.away.line,
          tt.away.under,
        ),
      ]),
      renderOddsRow(game.homeTeam.abbr, [
        renderOddsBtn(
          game.id,
          "teamTotal",
          "home-over",
          "fg",
          "O " + tt.home.line,
          tt.home.over,
        ),
        renderOddsBtn(
          game.id,
          "teamTotal",
          "home-under",
          "fg",
          "U " + tt.home.line,
          tt.home.under,
        ),
      ]),
    ]);
  }

  function renderOddsGroup(title, rows) {
    return `
            <div class="odds-group">
                <div class="odds-group-label">${title}</div>
                ${rows.join("")}
            </div>
        `;
  }

  function renderOddsRow(label, buttons) {
    return `
            <div class="odds-row">
                <span class="team-abbr">${label}</span>
                ${buttons.join("")}
            </div>
        `;
  }

  function renderExpandedRow(game) {
    const q1 = game.odds["1q"];
    const tt = game.odds.teamTotal;

    let content = '<div class="expanded-content">';

    if (q1) {
      content += `
                <div class="expanded-section">
                    <div class="expanded-section-title">1st Quarter</div>
                    <div class="expanded-odds-group">
                        ${renderOddsBtn(game.id, "spread", "away", "1q", q1.spread.away.line, q1.spread.away.odds)}
                        ${renderOddsBtn(game.id, "spread", "home", "1q", q1.spread.home.line, q1.spread.home.odds)}
                        ${renderOddsBtn(game.id, "total", "over", "1q", q1.total.line, q1.total.over)}
                        ${renderOddsBtn(game.id, "total", "under", "1q", q1.total.line, q1.total.under)}
                    </div>
                </div>
            `;
    }

    if (tt) {
      content += `
                <div class="expanded-section">
                    <div class="expanded-section-title">Team Totals</div>
                    <div class="expanded-odds-group">
                        <span class="tt-label">${game.awayTeam.abbr}</span>
                        ${renderOddsBtn(game.id, "teamTotal", "away-over", "fg", "O " + tt.away.line, tt.away.over)}
                        ${renderOddsBtn(game.id, "teamTotal", "away-under", "fg", "U " + tt.away.line, tt.away.under)}
                        <span class="tt-label">${game.homeTeam.abbr}</span>
                        ${renderOddsBtn(game.id, "teamTotal", "home-over", "fg", "O " + tt.home.line, tt.home.over)}
                        ${renderOddsBtn(game.id, "teamTotal", "home-under", "fg", "U " + tt.home.line, tt.home.under)}
                    </div>
                </div>
            `;
    }

    content += "</div>";

    return `
            <tr class="expanded-row" data-parent-id="${game.id}">
                <td colspan="5">${content}</td>
            </tr>
        `;
  }

  // ===== ODDS BUTTON RENDERERS =====
  function renderOddsBtn(gameId, type, side, segment, line, odds) {
    const pickId = `${gameId}-${type}-${side}-${segment}`;
    const isSelected = betslip.some((b) => b.id === pickId);
    const juiceClass = odds.startsWith("+") ? "plus" : "minus";

    return `
            <button class="odds-btn ${isSelected ? "selected" : ""}"
                    data-pick-id="${pickId}"
                    data-game-id="${gameId}"
                    data-type="${type}"
                    data-side="${side}"
                    data-segment="${segment}"
                    data-line="${line}"
                    data-odds="${odds}">
                <span class="odds-segment">${segment.toUpperCase()}</span>
                <span class="odds-line">${line}</span>
                <span class="odds-juice ${juiceClass}">${odds}</span>
            </button>
        `;
  }

  function renderMlBtn(gameId, type, side, segment, odds) {
    const pickId = `${gameId}-${type}-${side}-${segment}`;
    const isSelected = betslip.some((b) => b.id === pickId);
    const juiceClass = odds.startsWith("+") ? "plus" : "minus";

    return `
            <button class="odds-btn ${isSelected ? "selected" : ""}"
                    data-pick-id="${pickId}"
                    data-game-id="${gameId}"
                    data-type="${type}"
                    data-side="${side}"
                    data-segment="${segment}"
                    data-line="ML"
                    data-odds="${odds}">
                <span class="odds-segment">${segment.toUpperCase()}</span>
                <span class="odds-juice ${juiceClass}">${odds}</span>
            </button>
        `;
  }

  // ===== TEAM LOGOS =====
  function getTeamLogoUrl(abbr, league) {
    if (
      window.LogoLoader &&
      typeof window.LogoLoader.getLogoUrl === "function"
    ) {
      const normalizedLeague =
        (league || "").toLowerCase() === "ncaab"
          ? "ncaam"
          : (league || "").toLowerCase();
      const viaLoader = window.LogoLoader.getLogoUrl(
        normalizedLeague,
        (abbr || "").toLowerCase(),
      );
      if (viaLoader) return viaLoader;
    }
    if (
      window.LogoCache &&
      typeof window.LogoCache.generateLogoUrl === "function"
    ) {
      return window.LogoCache.generateLogoUrl(abbr, league);
    }
    const leagueMap = {
      nfl: "nfl",
      nba: "nba",
      mlb: "mlb",
      nhl: "nhl",
      ncaab: "ncaa",
      ncaam: "ncaa",
      ncaaf: "ncaa",
    };
    const folder = leagueMap[league] || league;
    const logoBase = (
      window.APP_CONFIG?.LOGO_BASE_URL ||
      window.APP_CONFIG?.LOGO_FALLBACK_URL ||
      "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos"
    ).replace(/\/+$/, "");
    return `${logoBase}/${folder}-500-${abbr.toLowerCase()}.png`;
  }

  // ===== EVENT HANDLERS =====
  function bindOddsButtons() {
    document.querySelectorAll(".odds-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleOddsClick(btn));
    });
  }

  function bindExpandButtons() {
    document.querySelectorAll(".expand-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gameId = btn.dataset.gameId;
        expandedGames.has(gameId)
          ? expandedGames.delete(gameId)
          : expandedGames.add(gameId);
        renderGames();
      });
    });
  }

  // ===== BETSLIP =====
  function initBetslip() {
    const placeBtn = document.getElementById("place-bets-btn");
    if (placeBtn) placeBtn.addEventListener("click", placeBets);
  }

  function handleOddsClick(btn) {
    const pickId = btn.dataset.pickId;
    const existingIndex = betslip.findIndex((b) => b.id === pickId);

    if (existingIndex >= 0) {
      betslip.splice(existingIndex, 1);
      btn.classList.remove("selected");
    } else {
      const gameId = btn.dataset.gameId;
      const game = games.find((g) => g.id === gameId);
      if (!game) return;

      const side = btn.dataset.side;
      let pickTeam =
        side === "away"
          ? game.awayTeam.name
          : side === "home"
            ? game.homeTeam.name
            : null;

      betslip.push({
        id: pickId,
        gameId,
        type: btn.dataset.type,
        side,
        segment: btn.dataset.segment,
        line: btn.dataset.line,
        odds: btn.dataset.odds,
        matchup: `${game.awayTeam.name} @ ${game.homeTeam.name}`,
        pickTeam,
        awayTeam: game.awayTeam.name,
        homeTeam: game.homeTeam.name,
        risk: 0,
      });
      btn.classList.add("selected");
    }

    renderBetslip();
    updateKPIs();
  }

  function renderBetslip() {
    const panel = document.getElementById("betslip-panel");
    const body = document.getElementById("betslip-body");
    const footer = document.getElementById("betslip-footer");
    const countEl = document.getElementById("betslip-count");

    if (!panel || !body) return;

    panel.dataset.count = betslip.length;
    if (countEl) countEl.textContent = betslip.length;

    if (betslip.length === 0) {
      body.innerHTML =
        '<div class="betslip-empty"><p>Click any odds to add</p></div>';
      if (footer) footer.hidden = true;
      return;
    }

    if (footer) footer.hidden = false;

    body.innerHTML = betslip
      .map(
        (pick, idx) => `
            <div class="betslip-item" data-index="${idx}">
                <div class="betslip-item-header">
                    <span class="betslip-pick">${esc(formatPickLabel(pick))}</span>
                    <button class="betslip-remove" data-index="${idx}">✕</button>
                </div>
                <div class="betslip-matchup">${esc(pick.matchup)} • ${esc(pick.segment.toUpperCase())}</div>
                <div class="betslip-odds">${esc(pick.odds)}</div>
                <div class="betslip-wager">
                    <span class="wager-label">Risk $</span>
                    <input type="number" class="wager-input" data-index="${idx}" value="${esc(pick.risk || "")}" placeholder="0" min="0">
                </div>
            </div>
        `,
      )
      .join("");

    // Bind remove buttons
    body.querySelectorAll(".betslip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        const removed = betslip[idx];
        betslip.splice(idx, 1);

        const oddsBtn = document.querySelector(
          `[data-pick-id="${removed.id}"]`,
        );
        if (oddsBtn) oddsBtn.classList.remove("selected");

        renderBetslip();
        updateKPIs();
      });
    });

    // Bind wager inputs
    body.querySelectorAll(".wager-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(input.dataset.index);
        betslip[idx].risk = parseFloat(e.target.value) || 0;
        updateTotals();
      });
    });

    updateTotals();
  }

  function formatPickLabel(pick) {
    switch (pick.type) {
      case "spread":
        return `${pick.pickTeam} ${pick.line}`;
      case "total":
        return `${pick.side === "over" ? "Over" : "Under"} ${pick.line}`;
      case "ml":
        return `${pick.pickTeam} ML`;
      case "teamTotal":
        return pick.line;
      default:
        return "Pick";
    }
  }

  function updateTotals() {
    const totalRiskEl = document.getElementById("total-risk");
    const totalWinEl = document.getElementById("total-win");

    let totalRisk = 0;
    let totalWin = 0;

    betslip.forEach((pick) => {
      const risk = pick.risk || 0;
      totalRisk += risk;
      totalWin += calculateWin(risk, pick.odds);
    });

    if (totalRiskEl) totalRiskEl.textContent = `$${totalRisk.toLocaleString()}`;
    if (totalWinEl)
      totalWinEl.textContent = `$${Math.round(totalWin).toLocaleString()}`;
  }

  function calculateWin(risk, odds) {
    const oddsNum = parseInt(odds);
    if (isNaN(oddsNum)) return 0;
    return oddsNum > 0
      ? risk * (oddsNum / 100)
      : risk / (Math.abs(oddsNum) / 100);
  }

  function placeBets() {
    if (betslip.length === 0) return;

    const picks = betslip.map((pick) => ({
      pickTeam:
        pick.pickTeam ||
        (pick.side === "over"
          ? "Over"
          : pick.side === "under"
            ? "Under"
            : pick.line),
      pickType: pick.type,
      line: pick.line,
      odds: pick.odds,
      segment: pick.segment,
      awayTeam: pick.awayTeam,
      homeTeam: pick.homeTeam,
      risk: pick.risk,
      win: calculateWin(pick.risk, pick.odds),
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    if (window.LocalPicksManager) {
      window.LocalPicksManager.add(picks);
      showNotification(
        `${picks.length} pick(s) added to Dashboard!`,
        "success",
      );
    } else {
      console.log("Picks to add:", picks);
      showNotification(`${picks.length} pick(s) ready`, "info");
    }

    betslip = [];
    renderBetslip();
    renderGames();
    updateKPIs();
  }

  // ===== KPIs =====
  function updateKPIs() {
    const filtered =
      activeLeague === "all"
        ? games
        : games.filter((g) => g.league === activeLeague);

    const gamesCount = document.getElementById("kpi-games-count");
    const liveCount = document.getElementById("kpi-live-count");
    const betslipCount = document.getElementById("kpi-betslip-count");

    if (gamesCount) gamesCount.textContent = filtered.length;
    if (liveCount)
      liveCount.textContent = filtered.filter((g) => g.isLive).length;
    if (betslipCount) betslipCount.textContent = betslip.length;
  }

  // ===== NOTIFICATIONS =====
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `slate-notification ${type}`;
    notification.textContent = message;

    const colors = {
      success: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
      error: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      info: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    };

    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: colors[type] || colors.info,
      color: "white",
      padding: "1rem 1.5rem",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      zIndex: "9999",
      fontWeight: "500",
      fontSize: "0.9rem",
    });

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transition = "opacity 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ===== FILTERS =====
  function initFilters() {
    // Filter button click handlers
    document.querySelectorAll(".th-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const filterName = btn.dataset.filter;
        const dropdown = document.getElementById(`filter-${filterName}`);
        if (!dropdown) return;

        const isOpen = !dropdown.hidden;
        closeAllFilters();

        if (!isOpen) {
          dropdown.hidden = false;
          dropdown.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Date range buttons
    document.querySelectorAll(".date-range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".date-range-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilters.datetime.range = btn.dataset.range;
        renderGames();
      });
    });

    // Time slot buttons
    document.querySelectorAll(".time-slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        const time = btn.dataset.time;
        const slots = activeFilters.datetime.timeSlots;
        if (btn.classList.contains("active")) {
          if (!slots.includes(time)) slots.push(time);
        } else {
          const idx = slots.indexOf(time);
          if (idx > -1) slots.splice(idx, 1);
        }
        renderGames();
      });
    });

    // League pills in matchup filter
    document.querySelectorAll(".league-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        document
          .querySelectorAll(".league-pill")
          .forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeFilters.matchup.league = pill.dataset.league;
        renderGames();
      });
    });

    // Filter action buttons (All/Clear)
    document.querySelectorAll(".filter-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const dropdown = btn.closest(".th-filter-dropdown");

        if (action === "select-all") {
          dropdown
            .querySelectorAll(".time-slot")
            .forEach((s) => s.classList.add("active"));
          dropdown.querySelectorAll(".league-pill").forEach((p) => {
            p.classList.remove("active");
            if (p.dataset.league === "all") p.classList.add("active");
          });
          activeFilters.datetime.timeSlots = [
            "morning",
            "early",
            "afternoon",
            "evening",
            "primetime",
            "late",
          ];
          activeFilters.matchup.league = "all";
        } else if (action === "clear") {
          dropdown
            .querySelectorAll(".time-slot")
            .forEach((s) => s.classList.remove("active"));
          activeFilters.datetime.timeSlots = [];
        }
        renderGames();
      });
    });

    // Close dropdowns on outside click
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".th-filter-dropdown") &&
        !e.target.closest(".th-filter-btn")
      ) {
        closeAllFilters();
      }
    });
  }

  function closeAllFilters() {
    document.querySelectorAll(".th-filter-dropdown").forEach((dropdown) => {
      dropdown.hidden = true;
      dropdown.classList.remove("open");
    });
    document.querySelectorAll(".th-filter-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  // ===== SORTING =====
  function initSorting() {
    document.querySelectorAll(".th-sort-btn").forEach((btn) => {
      const th = btn.closest("th");
      if (!th || !th.dataset.sort) return;

      btn.addEventListener("click", () => {
        const column = th.dataset.sort;

        // Toggle direction if same column
        if (currentSort.column === column) {
          currentSort.direction =
            currentSort.direction === "asc" ? "desc" : "asc";
        } else {
          currentSort.column = column;
          currentSort.direction = "asc";
        }

        // Update sort icons
        updateSortIndicators();
        renderGames();
      });
    });

    // Initialize sort indicators
    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      const icon = th.querySelector(".sort-icon");
      if (!icon) return;

      th.classList.remove("sort-asc", "sort-desc");

      if (th.dataset.sort === currentSort.column) {
        th.classList.add(
          currentSort.direction === "asc" ? "sort-asc" : "sort-desc",
        );
        icon.textContent = currentSort.direction === "asc" ? "▲" : "▼";
      } else {
        icon.textContent = "▲";
      }
    });
  }

  function sortGames(gamesList) {
    const sorted = [...gamesList];

    sorted.sort((a, b) => {
      let valA, valB;

      switch (currentSort.column) {
        case "datetime":
          // Sort by date then time
          valA = `${a.date} ${a.time}`;
          valB = `${b.date} ${b.time}`;
          break;
        case "matchup":
          valA = `${a.awayTeam.name} @ ${a.homeTeam.name}`;
          valB = `${b.awayTeam.name} @ ${b.homeTeam.name}`;
          break;
        case "fg":
          // Sort by home spread
          valA = parseFloat(a.odds.fg.spread.home.line) || 0;
          valB = parseFloat(b.odds.fg.spread.home.line) || 0;
          break;
        case "1h":
          // Sort by 1H home spread
          valA = a.odds["1h"]
            ? parseFloat(a.odds["1h"].spread.home.line) || 0
            : 999;
          valB = b.odds["1h"]
            ? parseFloat(b.odds["1h"].spread.home.line) || 0
            : 999;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (typeof valA === "string") {
        const comparison = valA.localeCompare(valB);
        return currentSort.direction === "asc" ? comparison : -comparison;
      } else {
        return currentSort.direction === "asc" ? valA - valB : valB - valA;
      }
    });

    return sorted;
  }

  // ===== EXPORT =====
  window.DailySlate = {
    loadGames,
    getBetslip: () => betslip,
    placeBets,
  };
})();
