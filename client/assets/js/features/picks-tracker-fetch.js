/**
 * Picks Tracker — Inline Model Picks Fetcher
 * Renders fetched model picks as swipeable iPhone-first cards directly on
 * the picks-tracker page. No navigation away, no table layout.
 */
(function () {
  "use strict";

  let activeFetch = null;

  const nowIso = () => new Date().toISOString();

  const normalizeSport = (s) => {
    const u = (s || "").toUpperCase();
    if (u === "NCAAB" || u === "NCAAM") return "NCAAB";
    return u || "NBA";
  };

  const safeText = (v) => (v == null ? "" : String(v));

  const fireEmoji = (n) => {
    const count = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
    return count > 0 ? "🔥".repeat(count) : "";
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
      return line ? `${label} ${line}` : label;
    }
    if (type === "moneyline" || type === "ml") {
      return `${safeText(pick.pickTeam || pick.pickDirection)} ML`.trim();
    }
    const team = safeText(pick.pickTeam || pick.pickDirection || "");
    return team && line ? `${team} ${line}` : team || line || "—";
  };

  const getEdge = (pick) => {
    if (typeof pick.edge === "number") return pick.edge;
    return parseFloat(String(pick.edge || "").replace("%", "")) || 0;
  };

  const getLeagueIcon = (sport) => {
    const s = normalizeSport(sport);
    if (s === "NBA") return { src: "assets/nba-logo.png", alt: "NBA" };
    if (s === "NCAAB") return { src: "assets/ncaam-logo.png", alt: "NCAAM" };
    if (s === "NFL") return { src: "assets/nfl-logo.png", alt: "NFL" };
    if (s === "NCAAF") return { src: "assets/ncaaf-logo.png", alt: "NCAAF" };
    if (s === "NHL") return { src: "assets/icons/league-nhl-official.svg", alt: "NHL" };
    return { src: "", alt: s };
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return safeText(iso).slice(5, 10).replace("-", "/");
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const setButtonState = (btn, state) => {
    if (!btn) return;
    btn.classList.remove("mp-loading", "mp-ok", "mp-err");
    if (state) btn.classList.add(`mp-${state}`);
    btn.disabled = state === "loading";
  };

  const renderSkeletons = (container, count = 4) => {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "mp-card mp-card-skeleton";
      el.innerHTML =
        '<div class="mp-skel-row"></div>' +
        '<div class="mp-skel-row mp-skel-body"></div>' +
        '<div class="mp-skel-row mp-skel-footer"></div>';
      container.appendChild(el);
    }
  };

  const renderCards = (container, picks) => {
    container.innerHTML = "";

    if (!picks.length) {
      container.innerHTML =
        '<div class="mp-empty-state"><span class="mp-empty-icon">📊</span>' +
        "<span>No picks available for today</span></div>";
      return;
    }

    const frag = document.createDocumentFragment();

    for (const pick of picks) {
      const sport = normalizeSport(pick.sport || pick.league);
      const icon = getLeagueIcon(sport);
      const edge = getEdge(pick);
      const pickLabel = formatPickLabel(pick);
      const odds = safeText(pick.odds || "-110");
      const segment = safeText(pick.segment || "FG");
      const segNorm = segment.toLowerCase().replace(/\s+/g, "-");
      const away = safeText(pick.awayTeam || "Away");
      const home = safeText(pick.homeTeam || "Home");
      const dateStr = formatDate(pick.gameDate || pick.date);
      const fire = fireEmoji(pick.fire_rating ?? pick.fire);
      const edgeText = edge ? `${edge.toFixed(1)}%` : "–";
      const edgeCls =
        edge >= 4 ? "mp-edge-high" : edge >= 2 ? "mp-edge-mid" : "mp-edge-low";
      const pickTypeLabel = (() => {
        const t = safeText(pick.pickType || "").toLowerCase();
        if (t === "spread") return "Spread";
        if (t === "total") return "O/U";
        if (t === "moneyline" || t === "ml") return "ML";
        if (t === "team-total" || t === "tt") return "Team Total";
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
      })();

      const card = document.createElement("article");
      card.className = "mp-card";
      card.setAttribute("data-league", sport);

      const logoHtml = icon.src
        ? `<img src="${icon.src}" alt="${icon.alt}" class="mp-league-icon" loading="lazy" />`
        : `<span class="mp-league-badge">${icon.alt}</span>`;

      card.innerHTML = `
        <div class="mp-card-header">
          ${logoHtml}
          <span class="mp-matchup">${away}&nbsp;<span class="mp-at">@</span>&nbsp;${home}</span>
          <span class="mp-date">${dateStr}</span>
        </div>
        <div class="mp-card-body">
          <span class="mp-pick-label">${pickLabel}</span>
          <span class="mp-odds-label">${odds}</span>
        </div>
        <div class="mp-card-footer">
          <span class="mp-edge-badge ${edgeCls}">${edgeText} edge</span>
          ${fire ? `<span class="mp-fire" aria-label="Fire rating">${fire}</span>` : ""}
          <span class="mp-segment-pill" data-segment="${segNorm}">${segment}</span>
          ${pickTypeLabel ? `<span class="mp-pick-type-tag">${pickTypeLabel}</span>` : ""}
        </div>
      `;

      frag.appendChild(card);
    }

    container.appendChild(frag);
  };

  const setLastRefreshed = (iso) => {
    const el = document.getElementById("mp-last-refreshed");
    if (!el) return;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return;
    el.textContent = `Updated ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const allButtons = () =>
    Array.from(
      document.querySelectorAll("#mp-fetch-trigger, .mp-fetch-item[data-mp-fetch]"),
    );

  const fetchAndRender = async (sport, btn) => {
    if (activeFetch) return;

    const container = document.getElementById("model-picks-cards");
    if (!container) return;

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      container.innerHTML =
        '<div class="mp-empty-state mp-err-state">' +
        "<span>Picks service not ready — please refresh the page.</span></div>";
      return;
    }

    activeFetch = sport;
    allButtons().forEach((b) => {
      b.disabled = true;
    });
    setButtonState(btn, "loading");
    renderSkeletons(container);

    try {
      let allPicks = [];

      if (sport === "all") {
        const [nba, ncaam] = await Promise.allSettled([
          window.UnifiedPicksFetcher.fetchPicks("nba", "today", {
            skipCache: true,
          }),
          window.UnifiedPicksFetcher.fetchPicks("ncaab", "today", {
            skipCache: true,
          }),
        ]);
        for (const r of [nba, ncaam]) {
          if (r.status === "fulfilled" && Array.isArray(r.value?.picks)) {
            allPicks.push(...r.value.picks);
          }
        }
      } else {
        const result = await window.UnifiedPicksFetcher.fetchPicks(
          sport,
          "today",
          { skipCache: true },
        );
        if (Array.isArray(result?.picks)) allPicks = result.picks;
      }

      allPicks.sort((a, b) => getEdge(b) - getEdge(a));

      renderCards(container, allPicks);

      // Auto-add fetched picks to tracker as straight bets
      if (window.PicksTracker?.addFetchedPicks) {
        window.PicksTracker.addFetchedPicks(allPicks);
      }

      setLastRefreshed(nowIso());
      setButtonState(btn, allPicks.length ? "ok" : null);
      setTimeout(() => setButtonState(btn, null), 2000);
    } catch (_err) {
      container.innerHTML =
        '<div class="mp-empty-state mp-err-state">' +
        "<span>Failed to load picks. Open Leagues to retry.</span></div>";
      setButtonState(btn, "err");
      setTimeout(() => setButtonState(btn, null), 3000);
    } finally {
      activeFetch = null;
      allButtons().forEach((b) => {
        b.disabled = false;
      });
    }
  };

  const init = () => {
    const closeMenu = () => {
      const menu = document.getElementById("mp-fetch-menu");
      const trigger = document.getElementById("mp-fetch-trigger");
      if (!menu || !trigger) return;
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    // Handle fetch from dropdown items
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".mp-fetch-item[data-mp-fetch]");
      if (!btn) return;
      e.preventDefault();
      const sport = btn.getAttribute("data-mp-fetch");
      closeMenu();
      if (!sport) return;
      const trigger = document.getElementById("mp-fetch-trigger");
      fetchAndRender(sport, trigger || btn);
    });

    // Dropdown toggle
    const trigger = document.getElementById("mp-fetch-trigger");
    const menu = document.getElementById("mp-fetch-menu");
    if (trigger && menu) {
      trigger.addEventListener("click", () => {
        const open = !menu.hidden;
        menu.hidden = open;
        trigger.setAttribute("aria-expanded", String(!open));
      });
      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#mp-fetch-dropdown") && !menu.hidden) {
          closeMenu();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !menu.hidden) {
          closeMenu();
        }
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
