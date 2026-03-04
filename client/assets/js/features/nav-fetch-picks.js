/**
 * Nav Fetch Picks Handler
 * Intercepts clicks on the Fetch Picks nav dropdown.
 * Fetches model picks in-place (no navigation) and shows
 * inline status directly on the clicked link row — no toasts.
 */
(function () {
  "use strict";

  const WEEKLY_LINEUP_KEY = "gbsv_weekly_lineup_picks";
  let activeSport = null; // only one fetch at a time

  const normalizeSport = (s) => {
    const u = (s || "").toUpperCase();
    if (u === "NCAAB" || u === "NCAAM") return "NCAAM";
    return u || "NBA";
  };
  const nowIso = () => new Date().toISOString();

  /* ── inline status helpers ── */

  /** Show a tiny spinner + "Syncing" on the sublabel */
  function setLinkLoading(link) {
    const sub = link.querySelector(".fetch-picks-nav-sublabel");
    if (!sub) return;
    sub.dataset.original = sub.textContent;
    sub.textContent = "Syncing…";
    link.classList.add("fp-loading");
    link.classList.remove("fp-ok", "fp-warn", "fp-err");
  }

  /** Flash a result, then revert after 1.6 s */
  function setLinkResult(link, text, cls) {
    const sub = link.querySelector(".fetch-picks-nav-sublabel");
    if (!sub) return;
    const original = sub.dataset.original || "";
    sub.textContent = text;
    link.classList.remove("fp-loading");
    link.classList.add(cls);
    setTimeout(() => {
      sub.textContent = original;
      link.classList.remove(cls);
    }, 1600);
  }

  /* ── core fetch ── */
  const fetchSport = async (sport, link) => {
    if (activeSport) return;

    if (!window.UnifiedPicksFetcher?.fetchPicks) {
      setLinkResult(link, "Not ready", "fp-err");
      return;
    }

    activeSport = sport;
    setLinkLoading(link);

    try {
      const result = await window.UnifiedPicksFetcher.fetchPicks(
        sport.toLowerCase(),
        "today",
        { skipCache: true },
      );

      const picks = Array.isArray(result?.picks) ? result.picks : [];

      if (picks.length === 0) {
        setLinkResult(link, "No picks today", "fp-warn");
        return;
      }

      // Enrich picks
      const enriched = picks.map((p) => {
        const copy = { ...p };
        copy.sport = normalizeSport(copy.sport || copy.league);
        copy.gameDate = (copy.gameDate || copy.date || nowIso())
          .toString()
          .slice(0, 10);
        copy.id =
          copy.id ||
          [
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

      // Merge into localStorage
      let existing = [];
      try {
        const raw = localStorage.getItem(WEEKLY_LINEUP_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.picks)) existing = parsed.picks;
        }
      } catch (_) {}

      const otherSports = existing.filter(
        (p) => normalizeSport(p.sport || p.league) !== normalizeSport(sport),
      );
      const merged = [...enriched, ...otherSports];
      localStorage.setItem(
        WEEKLY_LINEUP_KEY,
        JSON.stringify({ picks: merged, fetchedAt: nowIso() }),
      );

      setLinkResult(link, `✓ ${picks.length} synced`, "fp-ok");

      // If on weekly-lineup page, trigger re-render
      if (
        window.WeeklyLineup?.getActivePicks &&
        document.body.classList.contains("page-weekly-lineup")
      ) {
        window.dispatchEvent(
          new CustomEvent("weeklyPicksUpdated", { detail: { sport } }),
        );
      }
    } catch (e) {
      setLinkResult(link, "Sync failed", "fp-err");
    } finally {
      activeSport = null;
    }
  };

  /* ── event wiring ── */
  const init = () => {
    document.addEventListener("click", (evt) => {
      const link = evt.target.closest(".fetch-picks-nav-link[data-sport]");
      if (!link) return;

      evt.preventDefault();
      evt.stopPropagation();

      const sport = link.getAttribute("data-sport");
      if (!sport) return;

      // On fetch-picks page, delegate to page controller
      if (
        document.body.classList.contains("page-fetch-picks") &&
        window.FetchPicks?.fetchSport
      ) {
        // Close dropdown then delegate
        const dropdown = link.closest(".nav-dropdown");
        if (dropdown) {
          dropdown.classList.remove("open");
          dropdown
            .querySelector(".nav-dropdown-trigger")
            ?.setAttribute("aria-expanded", "false");
          dropdown
            .querySelector(".nav-dropdown-menu")
            ?.setAttribute("hidden", "");
        }
        window.FetchPicks.fetchSport(sport);
        return;
      }

      // Keep dropdown open so user sees inline status
      fetchSport(sport, link);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
