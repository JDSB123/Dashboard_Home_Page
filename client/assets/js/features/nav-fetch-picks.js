/**
 * Nav Fetch Picks Handler
 * Intercepts clicks on the Fetch Picks nav dropdown.
 * Fetches model picks in-place (no navigation) and stores them
 * in localStorage so the Weekly Lineup table picks them up on next visit.
 */
(function () {
  "use strict";

  const WEEKLY_LINEUP_KEY = "gbsv_weekly_lineup_picks";
  let isFetching = false;

  const normalizeSport = (s) => {
    const u = (s || "").toUpperCase();
    if (u === "NCAAB" || u === "NCAAM") return "NCAAM";
    return u || "NBA";
  };

  const nowIso = () => new Date().toISOString();

  /**
   * Fetch picks for a sport and persist to localStorage.
   * Shows toast notifications for progress / success / error.
   */
  const fetchSport = async (sport) => {
    if (isFetching) return;

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      window.Notify?.error("Model fetchers not ready — try again in a moment");
      return;
    }

    const label = sport.toUpperCase();
    isFetching = true;

    // Show loading toast
    const loadingToast = window.Notify?.loading
      ? window.Notify.loading(`${label} — syncing model picks`)
      : null;

    try {
      const result = await window.UnifiedPicksFetcher.fetchPicks(
        sport.toLowerCase(),
        "today",
        { skipCache: true },
      );

      const picks = Array.isArray(result?.picks) ? result.picks : [];

      if (picks.length === 0) {
        loadingToast?.dismiss?.();
        window.Notify?.warning(`${label} — no picks on today's slate`);
        return;
      }

      // Enrich picks with IDs and normalized sport
      const enriched = picks.map((p) => {
        const copy = { ...p };
        copy.sport = normalizeSport(copy.sport || copy.league);
        copy.gameDate = (copy.gameDate || copy.date || nowIso())
          .toString()
          .slice(0, 10);
        copy.id = copy.id || [
          copy.sport,
          copy.gameDate,
          (copy.awayTeam || "").toLowerCase().replace(/\s+/g, "-"),
          (copy.homeTeam || "").toLowerCase().replace(/\s+/g, "-"),
          (copy.pickType || "spread").toLowerCase(),
          (copy.segment || "FG").toLowerCase(),
          (copy.pickDirection || "").toLowerCase(),
        ].join("_");
        copy.locked = copy.locked === true;
        return copy;
      });

      enriched.sort((a, b) => (b.edge || 0) - (a.edge || 0));

      // Merge into existing weekly lineup cache (don't overwrite other sports)
      let existing = [];
      try {
        const raw = localStorage.getItem(WEEKLY_LINEUP_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.picks)) existing = parsed.picks;
        }
      } catch (_) {}

      // Remove old picks for this sport, then add new ones
      const otherSports = existing.filter(
        (p) => normalizeSport(p.sport || p.league) !== normalizeSport(sport),
      );
      const merged = [...enriched, ...otherSports];

      localStorage.setItem(
        WEEKLY_LINEUP_KEY,
        JSON.stringify({ picks: merged, fetchedAt: nowIso() }),
      );

      loadingToast?.dismiss?.();
      window.Notify?.success(
        `${label} — ${picks.length} pick${picks.length === 1 ? "" : "s"} synced`,
      );

      // If we're already on the weekly-lineup page, trigger a re-render
      if (
        window.WeeklyLineup?.getActivePicks &&
        document.body.classList.contains("page-weekly-lineup")
      ) {
        window.dispatchEvent(
          new CustomEvent("weeklyPicksUpdated", { detail: { sport } }),
        );
      }
    } catch (e) {
      loadingToast?.dismiss?.();
      window.Notify?.error(`${label} — sync failed`);
    } finally {
      isFetching = false;
    }
  };

  /**
   * Wire up all fetch-picks nav links (on any page).
   * Links have class="fetch-picks-nav-link" and data-sport="ncaam|nba|mlb".
   */
  const init = () => {
    document.addEventListener("click", (evt) => {
      const link = evt.target.closest(".fetch-picks-nav-link[data-sport]");
      if (!link) return;

      evt.preventDefault();
      evt.stopPropagation();

      const sport = link.getAttribute("data-sport");
      if (!sport) return;

      // Close the nav dropdown
      const dropdown = link.closest(".nav-dropdown");
      if (dropdown) {
        dropdown.classList.remove("open");
        const trigger = dropdown.querySelector(".nav-dropdown-trigger");
        trigger?.setAttribute("aria-expanded", "false");
        const menu = dropdown.querySelector(".nav-dropdown-menu");
        menu?.setAttribute("hidden", "");
      }

      // On fetch-picks page, also render into the page table
      if (
        document.body.classList.contains("page-fetch-picks") &&
        window.FetchPicks?.fetchSport
      ) {
        window.FetchPicks.fetchSport(sport);
        return; // FetchPicks handles its own notification
      }

      fetchSport(sport);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
