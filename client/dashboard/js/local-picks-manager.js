/**
 * Local Picks Manager v33.02.0
 * Production version - Real data only, no sample data, auto-cleanup of stale picks
 * Stores picks in localStorage, auto-fetches game data from ESPN
 *
 * @deprecated This module uses localStorage for pick storage. Prefer the
 *   Cosmos DB-backed picks-service.js for new features. This file is still
 *   loaded by dashboard.html and weekly-lineup.html for backward compatibility
 *   and will be removed once all callers migrate to the DB-backed service.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "gbsv_picks";
  const UNIT_MULTIPLIER_KEY = "gbsv_unit_multiplier";

  // ========== STORAGE FUNCTIONS ==========

  function getAllPicks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading picks from localStorage:", e);
      if (window.ErrorHandler) {
        window.ErrorHandler.handleStorage(e, "read");
      }
      return [];
    }
  }

  function savePicks(picks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
      console.log(`✅ Saved ${picks.length} picks to localStorage`);
      return true;
    } catch (e) {
      console.error("Error saving picks to localStorage:", e);
      if (window.ErrorHandler) {
        window.ErrorHandler.handleStorage(e, "write");
      }
      return false;
    }
  }

  function addPicks(newPicks) {
    const existing = getAllPicks();
    const enrichedPicks = newPicks.map((pick, idx) => {
      // Normalize league/sport values
      let sport = (pick.sport || pick.league || "NBA").toUpperCase();

      // Map league variants to standard values
      const leagueMap = {
        NCAAM: "NCAAB",
        NCAB: "NCAAB",
        CBB: "NCAAB",
        "COLLEGE BASKETBALL": "NCAAB",
        NCAAF: "NCAAF",
        CFB: "NCAAF",
        "COLLEGE FOOTBALL": "NCAAF",
        NFL: "NFL",
        NBA: "NBA",
        NCAAB: "NCAAB",
        MLB: "MLB",
        NHL: "NHL",
      };
      sport = leagueMap[sport] || sport;

      // Ensure awayTeam and homeTeam are set correctly
      let awayTeam = pick.awayTeam || "";
      let homeTeam = pick.homeTeam || "";

      // If game field exists, try to parse it
      if (pick.game && !awayTeam && !homeTeam) {
        const parts = pick.game.split(/\s*(?:@|vs\.?|versus)\s*/i);
        if (parts.length === 2) {
          awayTeam = parts[0].trim();
          homeTeam = parts[1].trim();
        }
      }

      // Normalize pick direction for totals
      let pickDirection = pick.pickDirection || "";
      if (pickDirection) {
        pickDirection = pickDirection
          .replace(/^UNDE\b/i, "UNDER")
          .toUpperCase();
      }

      // Ensure pickType is normalized
      let pickType = (pick.pickType || "spread").toLowerCase();
      if (pickType === "ml") pickType = "moneyline";
      if (pickType === "tt") pickType = "team-total";
      if (pickType === "ou") pickType = "total";

      return {
        ...pick,
        id:
          pick.id ||
          `pick_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`,
        createdAt: pick.createdAt || new Date().toISOString(),
        status: pick.status || "pending",
        sport: sport,
        league: sport,
        awayTeam: awayTeam,
        homeTeam: homeTeam,
        pickDirection: pickDirection,
        pickType: pickType,
      };
    });
    const all = [...existing, ...enrichedPicks];
    savePicks(all);
    return enrichedPicks;
  }

  function clearPicks() {
    localStorage.removeItem(STORAGE_KEY);
    console.log("CLEANUP Cleared all picks from localStorage");
    refreshPicksTable();
  }

  function deletePick(pickId) {
    const picks = getAllPicks().filter((p) => p.id !== pickId);
    savePicks(picks);
    refreshPicksTable();
  }

  function updatePickStatus(pickId, newStatus) {
    const picks = getAllPicks().map((p) => {
      if (p.id === pickId) {
        return { ...p, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    savePicks(picks);
    refreshPicksTable();
  }

  function getUnitMultiplier() {
    return parseInt(localStorage.getItem(UNIT_MULTIPLIER_KEY)) || 1000;
  }

  function setUnitMultiplier(multiplier) {
    localStorage.setItem(UNIT_MULTIPLIER_KEY, multiplier.toString());
    if (window.PickStandardizer) {
      window.PickStandardizer.setUnitMultiplier(multiplier);
    }
  }

  // ========== STATUS LABEL HELPER ==========

  /**
   * Format status badge label based on status and game time
   * @param {string} status - The pick status
   * @param {Object} pick - The pick object with countdown/scheduled info
   * @returns {string} - Formatted label for the status badge
   */
  function formatStatusLabel(status, pick = {}) {
    const normalizedStatus = (status || "pending").toLowerCase();

    // Map status to proper labels
    const labelMap = {
      win: "Won",
      won: "Won",
      loss: "Lost",
      lost: "Lost",
      push: "Push",
      "on-track": "On Track",
      "at-risk": "At Risk",
      live: "Live",
    };

    if (labelMap[normalizedStatus]) {
      return labelMap[normalizedStatus];
    }

    // For pending, show countdown or scheduled time if available
    if (normalizedStatus === "pending") {
      if (pick.countdown) {
        return pick.countdown;
      }
      if (pick.scheduled || pick.gameTime) {
        return `Starts ${pick.scheduled || pick.gameTime}`;
      }
      return "Pending";
    }

    // Default: capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Generate tooltip blurb based on status and pick data
   * @param {string} status - The pick status
   * @param {Object} pick - The pick object
   * @returns {string} - Tooltip text
   */
  function generateStatusBlurb(status, pick = {}) {
    const normalizedStatus = (status || "pending").toLowerCase();
    const pickType = (pick.pickType || "spread").toLowerCase();
    const line = pick.line || "";

    switch (normalizedStatus) {
      case "pending":
        if (pick.gameTime) {
          return `Game starts at ${pick.gameTime}`;
        }
        return "Awaiting game start";

      case "on-track":
        if (pickType === "spread") {
          return `Covering by 8.5 pts • ${pick.countdown || "Live"}`;
        } else if (pickType === "total") {
          return `On pace for ${pick.pickDirection || "Over"} • ${pick.countdown || "Live"}`;
        } else if (pickType === "moneyline") {
          return `Leading • ${pick.countdown || "Live"}`;
        }
        return `On track to hit • ${pick.countdown || "Live"}`;

      case "at-risk":
        if (pickType === "spread") {
          return `Need 5.5 pts to cover • ${pick.countdown || "Live"}`;
        } else if (pickType === "total") {
          return `Need 12 more pts • ${pick.countdown || "Live"}`;
        } else if (pickType === "moneyline") {
          return `Trailing • ${pick.countdown || "Live"}`;
        }
        return `At risk • ${pick.countdown || "Live"}`;

      case "win":
      case "won":
        const winAmt = pick.win || 0;
        return `+$${winAmt.toLocaleString()}`;

      case "loss":
      case "lost":
        const lossAmt = pick.risk || 0;
        return `-$${lossAmt.toLocaleString()}`;

      case "push":
        return "$0 • Refunded";

      default:
        return "";
    }
  }

  // ========== TEAM DATA ==========
  // Team data is now loaded from assets/data/team-data.json via TeamDataLoader
  // Fallback to hardcoded data for backward compatibility

  const TEAM_DATA_FALLBACK = {
    // NBA Teams - logos now loaded via LogoLoader
    "san antonio spurs": { abbr: "SAS", league: "nba" },
    spurs: { abbr: "SAS", league: "nba" },
    "new york knicks": { abbr: "NYK", league: "nba" },
    knicks: { abbr: "NYK", league: "nba" },
    "los angeles lakers": { abbr: "LAL", league: "nba" },
    lakers: { abbr: "LAL", league: "nba" },
    "golden state warriors": { abbr: "GSW", league: "nba" },
    warriors: { abbr: "GSW", league: "nba" },
    "boston celtics": { abbr: "BOS", league: "nba" },
    celtics: { abbr: "BOS", league: "nba" },
    "miami heat": { abbr: "MIA", league: "nba" },
    heat: { abbr: "MIA", league: "nba" },
    "dallas mavericks": { abbr: "DAL", league: "nba" },
    mavericks: { abbr: "DAL", league: "nba" },
    mavs: { abbr: "DAL", league: "nba" },
    "denver nuggets": { abbr: "DEN", league: "nba" },
    nuggets: { abbr: "DEN", league: "nba" },
    "phoenix suns": { abbr: "PHX", league: "nba" },
    suns: { abbr: "PHX", league: "nba" },
    "milwaukee bucks": { abbr: "MIL", league: "nba" },
    bucks: { abbr: "MIL", league: "nba" },
    "philadelphia 76ers": { abbr: "PHI", league: "nba" },
    "76ers": { abbr: "PHI", league: "nba" },
    sixers: { abbr: "PHI", league: "nba" },
    "brooklyn nets": { abbr: "BKN", league: "nba" },
    nets: { abbr: "BKN", league: "nba" },
    "chicago bulls": { abbr: "CHI", league: "nba" },
    bulls: { abbr: "CHI", league: "nba" },
    "cleveland cavaliers": { abbr: "CLE", league: "nba" },
    cavaliers: { abbr: "CLE", league: "nba" },
    cavs: { abbr: "CLE", league: "nba" },
    "atlanta hawks": { abbr: "ATL", league: "nba" },
    hawks: { abbr: "ATL", league: "nba" },
    "toronto raptors": { abbr: "TOR", league: "nba" },
    raptors: { abbr: "TOR", league: "nba" },
    "orlando magic": { abbr: "ORL", league: "nba" },
    magic: { abbr: "ORL", league: "nba" },
    "indiana pacers": { abbr: "IND", league: "nba" },
    pacers: { abbr: "IND", league: "nba" },
    "detroit pistons": { abbr: "DET", league: "nba" },
    pistons: { abbr: "DET", league: "nba" },
    "charlotte hornets": { abbr: "CHA", league: "nba" },
    hornets: { abbr: "CHA", league: "nba" },
    "washington wizards": { abbr: "WAS", league: "nba" },
    wizards: { abbr: "WAS", league: "nba" },
    "memphis grizzlies": { abbr: "MEM", league: "nba" },
    grizzlies: { abbr: "MEM", league: "nba" },
    "new orleans pelicans": { abbr: "NOP", league: "nba" },
    pelicans: { abbr: "NOP", league: "nba" },
    "houston rockets": { abbr: "HOU", league: "nba" },
    rockets: { abbr: "HOU", league: "nba" },
    "minnesota timberwolves": { abbr: "MIN", league: "nba" },
    timberwolves: { abbr: "MIN", league: "nba" },
    wolves: { abbr: "MIN", league: "nba" },
    "oklahoma city thunder": { abbr: "OKC", league: "nba" },
    thunder: { abbr: "OKC", league: "nba" },
    "portland trail blazers": { abbr: "POR", league: "nba" },
    "trail blazers": { abbr: "POR", league: "nba" },
    blazers: { abbr: "POR", league: "nba" },
    "utah jazz": { abbr: "UTA", league: "nba" },
    jazz: { abbr: "UTA", league: "nba" },
    "sacramento kings": { abbr: "SAC", league: "nba" },
    kings: { abbr: "SAC", league: "nba" },
    "la clippers": { abbr: "LAC", league: "nba" },
    clippers: { abbr: "LAC", league: "nba" },

    // NCAAB Teams (from today's picks) - Full names and abbreviations
    butler: {
      abbr: "BUT",
      fullName: "Butler Bulldogs",
      league: "ncaam",
      logoId: "2086",
    },
    "butler bulldogs": {
      abbr: "BUT",
      fullName: "Butler Bulldogs",
      league: "ncaam",
      logoId: "2086",
    },
    connecticut: {
      abbr: "CONN",
      fullName: "UConn Huskies",
      league: "ncaam",
      logoId: "41",
    },
    "u conn": {
      abbr: "CONN",
      fullName: "UConn Huskies",
      league: "ncaam",
      logoId: "41",
    },
    uconn: {
      abbr: "CONN",
      fullName: "UConn Huskies",
      league: "ncaam",
      logoId: "41",
    },
    "uconn huskies": {
      abbr: "CONN",
      fullName: "UConn Huskies",
      league: "ncaam",
      logoId: "41",
    },
    "abilene christian": {
      abbr: "ACU",
      fullName: "Abilene Christian Wildcats",
      league: "ncaam",
      logoId: "2000",
    },
    "abilene christian wildcats": {
      abbr: "ACU",
      fullName: "Abilene Christian Wildcats",
      league: "ncaam",
      logoId: "2000",
    },
    // arizona: {
    //   abbr: "ARIZ",
    //   fullName: "Arizona Wildcats",
    //   league: "ncaam",
    //   logoId: "12",
    // },
    "arizona wildcats": {
      abbr: "ARIZ",
      fullName: "Arizona Wildcats",
      league: "ncaam",
      logoId: "12",
    },
    "montana st": {
      abbr: "MTST",
      fullName: "Montana State Bobcats",
      league: "ncaam",
      logoId: "149",
    },
    "montana state": {
      abbr: "MTST",
      fullName: "Montana State Bobcats",
      league: "ncaam",
      logoId: "149",
    },
    "montana state bobcats": {
      abbr: "MTST",
      fullName: "Montana State Bobcats",
      league: "ncaam",
      logoId: "149",
    },
    "cal poly slo": {
      abbr: "CPSU",
      fullName: "Cal Poly Mustangs",
      league: "ncaam",
      logoId: "13",
    },
    "cal poly": {
      abbr: "CPSU",
      fullName: "Cal Poly Mustangs",
      league: "ncaam",
      logoId: "13",
    },
    "cal poly mustangs": {
      abbr: "CPSU",
      fullName: "Cal Poly Mustangs",
      league: "ncaam",
      logoId: "13",
    },
    "oral roberts": {
      abbr: "ORU",
      fullName: "Oral Roberts Golden Eagles",
      league: "ncaam",
      logoId: "198",
    },
    "oral roberts golden eagles": {
      abbr: "ORU",
      fullName: "Oral Roberts Golden Eagles",
      league: "ncaam",
      logoId: "198",
    },
    "missouri st": {
      abbr: "MOST",
      fullName: "Missouri State Bears",
      league: "ncaam",
      logoId: "2623",
    },
    "missouri state": {
      abbr: "MOST",
      fullName: "Missouri State Bears",
      league: "ncaam",
      logoId: "2623",
    },
    "missouri state bears": {
      abbr: "MOST",
      fullName: "Missouri State Bears",
      league: "ncaam",
      logoId: "2623",
    },
    marist: {
      abbr: "MAR",
      fullName: "Marist Red Foxes",
      league: "ncaam",
      logoId: "2368",
    },
    "marist red foxes": {
      abbr: "MAR",
      fullName: "Marist Red Foxes",
      league: "ncaam",
      logoId: "2368",
    },
    "georgia tech": {
      abbr: "GT",
      fullName: "Georgia Tech Yellow Jackets",
      league: "ncaam",
      logoId: "59",
    },
    "georgia tech yellow jackets": {
      abbr: "GT",
      fullName: "Georgia Tech Yellow Jackets",
      league: "ncaam",
      logoId: "59",
    },
    "east tenn st": {
      abbr: "ETSU",
      fullName: "East Tennessee State Buccaneers",
      league: "ncaam",
      logoId: "2193",
    },
    "east tennessee st": {
      abbr: "ETSU",
      fullName: "East Tennessee State Buccaneers",
      league: "ncaam",
      logoId: "2193",
    },
    "east tennessee state": {
      abbr: "ETSU",
      fullName: "East Tennessee State Buccaneers",
      league: "ncaam",
      logoId: "2193",
    },
    "east tennessee state buccaneers": {
      abbr: "ETSU",
      fullName: "East Tennessee State Buccaneers",
      league: "ncaam",
      logoId: "2193",
    },
    "etsu buccaneers": {
      abbr: "ETSU",
      fullName: "East Tennessee State Buccaneers",
      league: "ncaam",
      logoId: "2193",
    },
    "north carolina": {
      abbr: "UNC",
      fullName: "North Carolina Tar Heels",
      league: "ncaam",
      logoId: "153",
    },
    unc: {
      abbr: "UNC",
      fullName: "North Carolina Tar Heels",
      league: "ncaam",
      logoId: "153",
    },
    "north carolina tar heels": {
      abbr: "UNC",
      fullName: "North Carolina Tar Heels",
      league: "ncaam",
      logoId: "153",
    },
    "tar heels": {
      abbr: "UNC",
      fullName: "North Carolina Tar Heels",
      league: "ncaam",
      logoId: "153",
    },

    // NFL Teams
    "buffalo bills": { abbr: "BUF", fullName: "Buffalo Bills", league: "nfl" },
    bills: { abbr: "BUF", fullName: "Buffalo Bills", league: "nfl" },
    buffalo: { abbr: "BUF", fullName: "Buffalo Bills", league: "nfl" },
    "philadelphia eagles": {
      abbr: "PHI",
      fullName: "Philadelphia Eagles",
      league: "nfl",
    },
    eagles: { abbr: "PHI", fullName: "Philadelphia Eagles", league: "nfl" },
    "kansas city chiefs": {
      abbr: "KC",
      fullName: "Kansas City Chiefs",
      league: "nfl",
    },
    chiefs: { abbr: "KC", fullName: "Kansas City Chiefs", league: "nfl" },
    "kansas city": {
      abbr: "KC",
      fullName: "Kansas City Chiefs",
      league: "nfl",
    },
    "detroit lions": { abbr: "DET", fullName: "Detroit Lions", league: "nfl" },
    lions: { abbr: "DET", fullName: "Detroit Lions", league: "nfl" },
    "baltimore ravens": {
      abbr: "BAL",
      fullName: "Baltimore Ravens",
      league: "nfl",
    },
    ravens: { abbr: "BAL", fullName: "Baltimore Ravens", league: "nfl" },
    baltimore: { abbr: "BAL", fullName: "Baltimore Ravens", league: "nfl" },
    "minnesota vikings": {
      abbr: "MIN",
      fullName: "Minnesota Vikings",
      league: "nfl",
    },
    vikings: { abbr: "MIN", fullName: "Minnesota Vikings", league: "nfl" },
    "green bay packers": {
      abbr: "GB",
      fullName: "Green Bay Packers",
      league: "nfl",
    },
    packers: { abbr: "GB", fullName: "Green Bay Packers", league: "nfl" },
    "green bay": { abbr: "GB", fullName: "Green Bay Packers", league: "nfl" },
    "pittsburgh steelers": {
      abbr: "PIT",
      fullName: "Pittsburgh Steelers",
      league: "nfl",
    },
    steelers: { abbr: "PIT", fullName: "Pittsburgh Steelers", league: "nfl" },
    pittsburgh: { abbr: "PIT", fullName: "Pittsburgh Steelers", league: "nfl" },
    "houston texans": {
      abbr: "HOU",
      fullName: "Houston Texans",
      league: "nfl",
    },
    texans: { abbr: "HOU", fullName: "Houston Texans", league: "nfl" },
    "los angeles chargers": {
      abbr: "LAC",
      fullName: "Los Angeles Chargers",
      league: "nfl",
    },
    chargers: { abbr: "LAC", fullName: "Los Angeles Chargers", league: "nfl" },
    "la chargers": {
      abbr: "LAC",
      fullName: "Los Angeles Chargers",
      league: "nfl",
    },
    "denver broncos": {
      abbr: "DEN",
      fullName: "Denver Broncos",
      league: "nfl",
    },
    broncos: { abbr: "DEN", fullName: "Denver Broncos", league: "nfl" },
    denver: { abbr: "DEN", fullName: "Denver Broncos", league: "nfl" },
    "cincinnati bengals": {
      abbr: "CIN",
      fullName: "Cincinnati Bengals",
      league: "nfl",
    },
    bengals: { abbr: "CIN", fullName: "Cincinnati Bengals", league: "nfl" },
    cincinnati: { abbr: "CIN", fullName: "Cincinnati Bengals", league: "nfl" },
    "seattle seahawks": {
      abbr: "SEA",
      fullName: "Seattle Seahawks",
      league: "nfl",
    },
    seahawks: { abbr: "SEA", fullName: "Seattle Seahawks", league: "nfl" },
    seattle: { abbr: "SEA", fullName: "Seattle Seahawks", league: "nfl" },
    "tampa bay buccaneers": {
      abbr: "TB",
      fullName: "Tampa Bay Buccaneers",
      league: "nfl",
    },
    buccaneers: { abbr: "TB", fullName: "Tampa Bay Buccaneers", league: "nfl" },
    bucs: { abbr: "TB", fullName: "Tampa Bay Buccaneers", league: "nfl" },
    "tampa bay": {
      abbr: "TB",
      fullName: "Tampa Bay Buccaneers",
      league: "nfl",
    },
    "san francisco 49ers": {
      abbr: "SF",
      fullName: "San Francisco 49ers",
      league: "nfl",
    },
    "49ers": { abbr: "SF", fullName: "San Francisco 49ers", league: "nfl" },
    niners: { abbr: "SF", fullName: "San Francisco 49ers", league: "nfl" },
    "san francisco": {
      abbr: "SF",
      fullName: "San Francisco 49ers",
      league: "nfl",
    },
    "dallas cowboys": {
      abbr: "DAL",
      fullName: "Dallas Cowboys",
      league: "nfl",
    },
    cowboys: { abbr: "DAL", fullName: "Dallas Cowboys", league: "nfl" },
    "miami dolphins": {
      abbr: "MIA",
      fullName: "Miami Dolphins",
      league: "nfl",
    },
    dolphins: { abbr: "MIA", fullName: "Miami Dolphins", league: "nfl" },
    "los angeles rams": {
      abbr: "LAR",
      fullName: "Los Angeles Rams",
      league: "nfl",
    },
    rams: { abbr: "LAR", fullName: "Los Angeles Rams", league: "nfl" },
    "la rams": { abbr: "LAR", fullName: "Los Angeles Rams", league: "nfl" },
    "arizona cardinals": {
      abbr: "ARI",
      fullName: "Arizona Cardinals",
      league: "nfl",
    },
    cardinals: { abbr: "ARI", fullName: "Arizona Cardinals", league: "nfl" },
    arizona: { abbr: "ARI", fullName: "Arizona Cardinals", league: "nfl" },
    "indianapolis colts": {
      abbr: "IND",
      fullName: "Indianapolis Colts",
      league: "nfl",
    },
    colts: { abbr: "IND", fullName: "Indianapolis Colts", league: "nfl" },
    indianapolis: {
      abbr: "IND",
      fullName: "Indianapolis Colts",
      league: "nfl",
    },
    "tennessee titans": {
      abbr: "TEN",
      fullName: "Tennessee Titans",
      league: "nfl",
    },
    titans: { abbr: "TEN", fullName: "Tennessee Titans", league: "nfl" },
    tennessee: { abbr: "TEN", fullName: "Tennessee Titans", league: "nfl" },
    "jacksonville jaguars": {
      abbr: "JAX",
      fullName: "Jacksonville Jaguars",
      league: "nfl",
    },
    jaguars: { abbr: "JAX", fullName: "Jacksonville Jaguars", league: "nfl" },
    jags: { abbr: "JAX", fullName: "Jacksonville Jaguars", league: "nfl" },
    jacksonville: {
      abbr: "JAX",
      fullName: "Jacksonville Jaguars",
      league: "nfl",
    },
    "cleveland browns": {
      abbr: "CLE",
      fullName: "Cleveland Browns",
      league: "nfl",
    },
    browns: { abbr: "CLE", fullName: "Cleveland Browns", league: "nfl" },
    "new york giants": {
      abbr: "NYG",
      fullName: "New York Giants",
      league: "nfl",
    },
    giants: { abbr: "NYG", fullName: "New York Giants", league: "nfl" },
    "ny giants": { abbr: "NYG", fullName: "New York Giants", league: "nfl" },
    "new york jets": { abbr: "NYJ", fullName: "New York Jets", league: "nfl" },
    jets: { abbr: "NYJ", fullName: "New York Jets", league: "nfl" },
    "ny jets": { abbr: "NYJ", fullName: "New York Jets", league: "nfl" },
    "new england patriots": {
      abbr: "NE",
      fullName: "New England Patriots",
      league: "nfl",
    },
    patriots: { abbr: "NE", fullName: "New England Patriots", league: "nfl" },
    pats: { abbr: "NE", fullName: "New England Patriots", league: "nfl" },
    "new england": {
      abbr: "NE",
      fullName: "New England Patriots",
      league: "nfl",
    },
    "washington commanders": {
      abbr: "WSH",
      fullName: "Washington Commanders",
      league: "nfl",
    },
    commanders: {
      abbr: "WSH",
      fullName: "Washington Commanders",
      league: "nfl",
    },
    "carolina panthers": {
      abbr: "CAR",
      fullName: "Carolina Panthers",
      league: "nfl",
    },
    panthers: { abbr: "CAR", fullName: "Carolina Panthers", league: "nfl" },
    carolina: { abbr: "CAR", fullName: "Carolina Panthers", league: "nfl" },
    "atlanta falcons": {
      abbr: "ATL",
      fullName: "Atlanta Falcons",
      league: "nfl",
    },
    falcons: { abbr: "ATL", fullName: "Atlanta Falcons", league: "nfl" },
    "new orleans saints": {
      abbr: "NO",
      fullName: "New Orleans Saints",
      league: "nfl",
    },
    saints: { abbr: "NO", fullName: "New Orleans Saints", league: "nfl" },
    "new orleans": {
      abbr: "NO",
      fullName: "New Orleans Saints",
      league: "nfl",
    },
    "chicago bears": { abbr: "CHI", fullName: "Chicago Bears", league: "nfl" },
    bears: { abbr: "CHI", fullName: "Chicago Bears", league: "nfl" },
    "las vegas raiders": {
      abbr: "LV",
      fullName: "Las Vegas Raiders",
      league: "nfl",
    },
    raiders: { abbr: "LV", fullName: "Las Vegas Raiders", league: "nfl" },
    "las vegas": { abbr: "LV", fullName: "Las Vegas Raiders", league: "nfl" },
    vegas: { abbr: "LV", fullName: "Las Vegas Raiders", league: "nfl" },
  };

  /**
   * Get team logo URL using LogoLoader (Azure Blob Storage)
   * @param {string} teamAbbr - Team abbreviation (e.g., 'LAL', 'BUF')
   * @param {string} league - League identifier ('nba', 'nfl', 'ncaam', etc.)
   * @param {string} logoId - Optional ESPN logo ID for NCAA teams
   * @returns {string} Logo URL
   */
  function getTeamLogoUrl(teamAbbr, league, logoId) {
    if (!window.LogoLoader || !teamAbbr) return "";

    // For NCAA teams, we may need to use logoId
    if ((league === "ncaam" || league === "ncaaf") && logoId) {
      // LogoLoader expects teamId, for NCAA it's the numeric ID
      return window.LogoLoader.getLogoUrl(league, logoId);
    }

    // For NBA/NFL, use the abbreviation (lowercase)
    const teamId = teamAbbr.toLowerCase();
    return window.LogoLoader.getLogoUrl(league, teamId);
  }

  async function getTeamInfo(teamName) {
    if (!teamName) return { abbr: "N/A", fullName: "", logo: "" };

    // Try to use TeamDataLoader if available
    if (
      window.TeamDataLoader &&
      typeof window.TeamDataLoader.getTeamInfo === "function"
    ) {
      try {
        const info = await window.TeamDataLoader.getTeamInfo(teamName);
        if (info && info.abbr !== "N/A") {
          return info;
        }
      } catch (e) {
        console.warn(
          "[LocalPicksManager] TeamDataLoader failed, using fallback:",
          e,
        );
      }
    }

    // Fallback to hardcoded data
    const lower = teamName.toLowerCase().trim();
    const data = TEAM_DATA_FALLBACK[lower];
    if (data) {
      // Use LogoLoader to get logo URL instead of hardcoded ESPN URL
      const league = data.league || "nba"; // Default to NBA if not specified
      const logo = getTeamLogoUrl(data.abbr, league, data.logoId);
      return {
        abbr: data.abbr,
        fullName: data.fullName || teamName,
        logo: logo,
      };
    }
    return {
      abbr: teamName.substring(0, 3).toUpperCase(),
      fullName: teamName,
      logo: "",
    };
  }

  // Synchronous version for backward compatibility (uses fallback)
  function getTeamInfoSync(teamName) {
    if (!teamName) return { abbr: "N/A", fullName: "", logo: "" };
    const lower = teamName.toLowerCase().trim();
    const data = TEAM_DATA_FALLBACK[lower];
    if (data) {
      // Use LogoLoader to get logo URL instead of hardcoded ESPN URL
      const league = data.league || "nba"; // Default to NBA if not specified
      const logo = getTeamLogoUrl(data.abbr, league, data.logoId);
      return {
        abbr: data.abbr,
        fullName: data.fullName || teamName,
        logo: logo,
      };
    }
    return {
      abbr: teamName.substring(0, 3).toUpperCase(),
      fullName: teamName,
      logo: "",
    };
  }

  // ========== PARSE AND ADD PICKS ==========

  async function parseAndAddPicks(content, sportsbook = "") {
    if (!window.PickStandardizer) {
      console.error("PickStandardizer not loaded");
      return [];
    }

    // Ensure team variant registry is loaded (362 NCAAM + 30 NBA teams)
    if (window.PickStandardizer.loadTeamVariants) {
      await window.PickStandardizer.loadTeamVariants();
    }

    // Set unit multiplier
    window.PickStandardizer.setUnitMultiplier(getUnitMultiplier());

    // Parse content
    const picks = window.PickStandardizer.standardize(content);

    if (picks.length === 0) {
      console.warn("No picks could be parsed from content");
      return [];
    }

    // Add sportsbook and default values to each pick
    const defaultRisk = getUnitMultiplier(); // 1 unit = $1000 default
    const picksWithBook = picks.map((pick) => {
      // Set default risk if not provided
      const risk = pick.risk || defaultRisk;

      // Calculate win from odds if not provided
      let win = pick.win;
      if (!win && pick.odds && risk) {
        const oddsNum = parseInt(pick.odds);
        if (oddsNum > 0) {
          win = risk * (oddsNum / 100);
        } else if (oddsNum < 0) {
          win = risk / (Math.abs(oddsNum) / 100);
        }
      }

      return {
        ...pick,
        sportsbook: sportsbook || pick.sportsbook || "Manual Upload",
        risk: Math.round(risk),
        win: Math.round(win || risk * 0.91), // Default to -110 odds if no odds
        gameDate:
          pick.gameDate ||
          new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        gameTime: pick.gameTime || "TBD",
      };
    });

    // Try to enrich picks with game data from ESPN
    const enrichedPicks = await enrichPicksWithGameData(picksWithBook);

    // Add to storage
    const added = addPicks(enrichedPicks);

    // Refresh the table
    refreshPicksTable();

    return added;
  }

  async function enrichPicksWithGameData(picks) {
    // Fetch today's games if AutoGameFetcher is available
    let todaysGames = [];
    if (window.AutoGameFetcher) {
      try {
        await window.AutoGameFetcher.fetchTodaysGames();
        todaysGames = window.AutoGameFetcher.getTodaysGames() || [];
        console.log(
          `🏀 Found ${todaysGames.length} games today:`,
          todaysGames.map((g) => `${g.awayTeam} @ ${g.homeTeam} (${g.time})`),
        );
      } catch (e) {
        console.warn("Could not fetch games:", e);
      }
    } else {
      console.warn("⚠️ AutoGameFetcher not available");
    }

    return picks.map((pick) => {
      const enriched = { ...pick };
      const teamToFind = pick.pickTeam;

      console.log(`🔍 Looking for game with team: "${teamToFind}"`);

      // Try to find the game
      if (window.AutoGameFetcher && todaysGames.length > 0) {
        const game = window.AutoGameFetcher.findGame(teamToFind);
        if (game) {
          console.log(
            `✅ Found game: ${game.awayTeam} (${game.awayRecord}) @ ${game.homeTeam} (${game.homeRecord}) at ${game.time}`,
          );
          enriched.awayTeam = game.awayTeam;
          enriched.homeTeam = game.homeTeam;
          enriched.awayRecord = game.awayRecord || "";
          enriched.homeRecord = game.homeRecord || "";
          enriched.gameTime = game.time;
          enriched.gameDate = game.date;
          enriched.sport = game.sport;
          enriched.gameStatus = game.status;
          enriched.game = `${game.awayTeam} @ ${game.homeTeam}`;
        } else {
          console.warn(
            `❌ No game found for "${teamToFind}" - available teams:`,
            todaysGames.flatMap((g) => [g.awayTeam, g.homeTeam]),
          );
        }
      }

      // Set default date/time if not found
      if (!enriched.gameDate) {
        enriched.gameDate = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
      if (!enriched.gameTime) {
        enriched.gameTime = "TBD";
      }

      return enriched;
    });
  }

  // ========== REFRESH TABLE ==========

  /**
   * Format currency with fixed two decimals
   */
  function formatCurrencyValue(val) {
    if (val === undefined || val === null || val === "") return "$0.00";
    const num =
      typeof val === "number"
        ? val
        : parseFloat(String(val).replace(/[$,]/g, ""));
    if (isNaN(num)) return "$0.00";
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format date string into short month/day display
   */
  function formatDateValue(date) {
    if (!date) return "Today";
    if (date.includes("/") || date.includes("-")) {
      const d = new Date(date);
      if (!isNaN(d)) {
        return d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }
    }
    return date;
  }

  // League logos now served via LogoLoader (Azure Blob + static assets)
  // LogoLoader automatically handles fallbacks and caching
  function getLeagueLogo(league) {
    if (!league) return "";
    const leagueUpper = league.toUpperCase();

    // Use LogoLoader if available
    if (
      window.LogoLoader &&
      typeof window.LogoLoader.getLeagueLogoUrl === "function"
    ) {
      // Map variations to standard league names
      const leagueMap = {
        NCAAB: "ncaam",
        NCAAM: "ncaam",
        "NCAA MEN'S BASKETBALL": "ncaam",
        CBB: "ncaam",
        NCAAF: "ncaaf",
        "COLLEGE FOOTBALL": "ncaaf",
        CFB: "ncaaf",
        NBA: "nba",
        NFL: "nfl",
        MLB: "mlb",
        NHL: "nhl",
        MLS: "mls",
      };
      const standardLeague =
        leagueMap[leagueUpper] || leagueUpper.toLowerCase();
      return window.LogoLoader.getLeagueLogoUrl(standardLeague);
    }

    // Legacy fallback (should rarely be used)
    const LEAGUE_LOGOS_FALLBACK = {
      NBA: "/assets/nba-logo.png",
      NFL: "/assets/nfl-logo.png",
      NCAAB: "/assets/ncaam-logo.png",
      NCAAM: "/assets/ncaam-logo.png",
      NCAAF: "/assets/ncaaf-logo.png",
      MLB: "/assets/mlb-logo.png",
      NHL: "/assets/nhl-logo.png",
    };
    return LEAGUE_LOGOS_FALLBACK[leagueUpper] || "";
  }

  function renderLeagueCell(sport) {
    // Convert to uppercase for lookup (LEAGUE_LOGOS keys are uppercase)
    const sportUpper = (sport || "").toUpperCase();
    // Map normalized values to display names
    const displayMap = {
      NCAAAB: "NCAAM",
      NCAAB: "NCAAM",
      NCAAF: "NCAAF",
      NBA: "NBA",
      NFL: "NFL",
      MLB: "MLB",
      NHL: "NHL",
    };
    const displayText = displayMap[sportUpper] || sportUpper;
    // Get logo via LogoLoader
    const logo = getLeagueLogo(sportUpper);
    return `
            <div class="league-cell">
                ${logo ? `<img src="${logo}" class="league-logo" alt="${displayText}" onerror="this.style.display='none'">` : ""}
                <span class="league-text">${displayText}</span>
            </div>
        `;
  }

  function refreshPicksTable() {
    const picks = getAllPicks();
    const tbody = document.getElementById("picks-tbody");

    if (!tbody) {
      // Silent return if table not present (e.g. on pages without the picks table)
      return;
    }

    // Clear existing rows
    tbody.innerHTML = "";

    // Update table container class
    const tableContainer = tbody.closest(".table-container");
    if (tableContainer) {
      tableContainer.classList.toggle("has-picks", picks.length > 0);
    }

    if (picks.length === 0) {
      console.log("No picks to display");
      return;
    }

    // Render each pick as a row (using sync version for immediate rendering)
    picks.forEach((pick, idx) => {
      const row = createPickRow(pick, idx);
      tbody.appendChild(row);
    });

    console.log(`📊 Displayed ${picks.length} picks in table`);

    // Trigger recalculations
    if (
      typeof window.calculateKPIs === "function" &&
      typeof window.updateKPITiles === "function"
    ) {
      setTimeout(() => {
        const kpis = window.calculateKPIs(getAllPicks());
        window.updateKPITiles(kpis);
      }, 100);
    }
    if (window.ZebraStripes?.applyPicksTableZebraStripes) {
      setTimeout(() => window.ZebraStripes.applyPicksTableZebraStripes(), 50);
    }

    // Re-apply filters if they exist
    if (
      window.DashboardFilters &&
      typeof window.DashboardFilters.applyFilters === "function"
    ) {
      setTimeout(() => window.DashboardFilters.applyFilters(), 50);
    }

    // Re-apply filter pills if available
    if (
      window.DashboardFilterPills &&
      typeof window.DashboardFilterPills.applyFilters === "function"
    ) {
      setTimeout(() => window.DashboardFilterPills.applyFilters(), 50);
    }

    // ========== ACTIVATE LIVE SCORES & BOX SCORES ==========
    // Fetch today's games and start live score updates
    setTimeout(async () => {
      try {
        // 1. Fetch today's games first (needed for matching)
        if (window.AutoGameFetcher) {
          console.log(
            "[PICKS-TABLE] Fetching today's games for live scores...",
          );
          await window.AutoGameFetcher.fetchTodaysGames(true); // Force refresh
          const games = window.AutoGameFetcher.getTodaysGames() || [];
          console.log(
            `[PICKS-TABLE] Loaded ${games.length} games for live score matching`,
          );
        }

        // 2. Start/restart LiveScoreUpdater
        if (window.LiveScoreUpdater) {
          console.log("[PICKS-TABLE] Starting live score updates...");
          window.LiveScoreUpdater.stopLiveUpdates(); // Stop if running
          window.LiveScoreUpdater.startLiveUpdates(); // Start fresh
          // Also trigger an immediate update
          window.LiveScoreUpdater.updateScores();
        }

        // 3. Populate team records in box scores
        if (typeof window.populateTeamRecordsWhenReady === "function") {
          window.populateTeamRecordsWhenReady(tbody, { force: true });
        }

        console.log("[PICKS-TABLE] ✅ Live scores and box scores activated");
      } catch (e) {
        console.warn("[PICKS-TABLE] Error activating live scores:", e);
      }
    }, 200);

    // Attach sportsbook dropdown event handlers
    attachSportsbookDropdownListeners();

    // Attach risk/win amount edit handlers
    attachRiskWinEditListeners();
  }

  // ========== SPORTSBOOK DROPDOWN HANDLER ==========

  function attachSportsbookDropdownListeners() {
    const dropdowns = document.querySelectorAll(".sportsbook-dropdown");
    dropdowns.forEach((dropdown) => {
      // Remove any existing listeners to avoid duplicates
      dropdown.removeEventListener("change", handleSportsbookChange);
      // Attach new listener
      dropdown.addEventListener("change", handleSportsbookChange);
    });
  }

  function handleSportsbookChange(event) {
    const pickId = event.target.getAttribute("data-pick-id");
    const newSportsbook = event.target.value;

    if (!pickId) return;

    // Update the pick's sportsbook
    const picks = getAllPicks();
    const pick = picks.find((p) => p.id === pickId);

    if (pick) {
      pick.sportsbook = newSportsbook;
      savePicks(picks);
      console.log(
        `✅ Updated pick ${pickId} sportsbook to: ${newSportsbook || "None"}`,
      );
    }
  }

  // ========== RISK/WIN AMOUNT EDIT HANDLERS ==========

  function attachRiskWinEditListeners() {
    const riskInputs = document.querySelectorAll(".editable-risk");
    const winInputs = document.querySelectorAll(".editable-win");

    riskInputs.forEach((input) => {
      input.removeEventListener("change", handleRiskChange);
      input.addEventListener("change", handleRiskChange);
    });

    winInputs.forEach((input) => {
      input.removeEventListener("change", handleWinChange);
      input.addEventListener("change", handleWinChange);
    });
  }

  function handleRiskChange(event) {
    const pickId = event.target.getAttribute("data-pick-id");
    const newRisk = parseFloat(event.target.value) || 0;

    if (!pickId) return;

    const picks = getAllPicks();
    const pick = picks.find((p) => p.id === pickId);

    if (pick) {
      pick.risk = Math.round(newRisk);
      savePicks(picks);
      console.log(
        `✅ Updated pick ${pickId} risk to: $${pick.risk.toLocaleString()}`,
      );
    }
  }

  function handleWinChange(event) {
    const pickId = event.target.getAttribute("data-pick-id");
    const newWin = parseFloat(event.target.value) || 0;

    if (!pickId) return;

    const picks = getAllPicks();
    const pick = picks.find((p) => p.id === pickId);

    if (pick) {
      pick.win = Math.round(newWin);
      savePicks(picks);
      console.log(
        `✅ Updated pick ${pickId} win to: $${pick.win.toLocaleString()}`,
      );
    }
  }

  // ========== CREATE ROW (FULL TEMPLATE) ==========
  // Note: Using synchronous version for immediate rendering
  // Async team data loading happens in background via TeamDataLoader

  function createPickRow(pick, idx) {
    const row = document.createElement("tr");
    const pickTeamInfo = getTeamInfoSync(pick.pickTeam);
    const awayTeam = pick.awayTeam || pick.pickTeam || "TBD";
    const homeTeam = pick.homeTeam || "TBD";
    const awayRecord = pick.awayRecord || "";
    const homeRecord = pick.homeRecord || "";
    const awayInfo = getTeamInfoSync(awayTeam);
    const homeInfo = getTeamInfoSync(homeTeam);

    const segment = pick.segment || "Full Game";
    const segmentKey =
      segment.toLowerCase().includes("1h") ||
      segment.toLowerCase().includes("1st")
        ? "1h"
        : segment.toLowerCase().includes("2h") ||
            segment.toLowerCase().includes("2nd")
          ? "2h"
          : "full-game";

    const segmentLabel =
      {
        "1h": "1st Half",
        "2h": "2nd Half",
        "1q": "1st Quarter",
        "2q": "2nd Quarter",
        "3q": "3rd Quarter",
        "4q": "4th Quarter",
        "full-game": "Full Game",
      }[segmentKey] || "Full Game";

    let selection = "";
    if (pick.pickType === "spread") {
      const line = pick.line || "";
      selection =
        line.startsWith("+") || line.startsWith("-")
          ? line
          : line
            ? `+${line}`
            : "";
    } else if (pick.pickType === "moneyline" || pick.pickType === "ml") {
      selection = "ML";
    } else if (
      pick.pickType === "total" ||
      pick.pickType === "team-total" ||
      pick.pickType === "tt"
    ) {
      // Normalize pickDirection - fix "UNDE" typo
      let direction = (pick.pickDirection || "Over").toUpperCase();
      if (direction === "UNDE" || direction.startsWith("UNDE")) {
        direction = "UNDER";
      }
      selection = `${direction} ${pick.line || ""}`.trim();
    }

    const status = pick.status || "pending";
    const sportsbook = pick.sportsbook || "";
    let sport = (pick.sport || "NBA").toLowerCase();

    // Normalize league values to match filter dropdown options
    const leagueNormMap = {
      college: "ncaaf",
      cfb: "ncaaf",
      "college football": "ncaaf",
      "ncaa football": "ncaaf",
      cbb: "ncaab",
      "college basketball": "ncaab",
      "ncaa basketball": "ncaab",
      ncaam: "ncaab",
    };
    if (leagueNormMap[sport]) {
      sport = leagueNormMap[sport];
    }

    const epochTime =
      pick.gameDate && pick.gameTime
        ? new Date(`${pick.gameDate} ${pick.gameTime}`).getTime()
        : Date.now();

    row.setAttribute("data-pick-id", pick.id || `pick-${idx}`);
    row.setAttribute("data-row-id", pick.id || `pick-${idx}`); // For LiveScoreUpdater
    row.setAttribute("data-league", sport);
    row.setAttribute("data-sport", sport); // For LiveScoreUpdater
    row.setAttribute("data-epoch", epochTime);
    row.setAttribute("data-book", sportsbook.toLowerCase());
    row.setAttribute("data-away", awayTeam.toLowerCase());
    row.setAttribute("data-home", homeTeam.toLowerCase());
    row.setAttribute("data-away-team", awayTeam); // For LiveScoreUpdater
    row.setAttribute("data-home-team", homeTeam); // For LiveScoreUpdater
    row.setAttribute("data-away-abbr", awayInfo.abbr || ""); // For LiveScoreUpdater
    row.setAttribute("data-home-abbr", homeInfo.abbr || ""); // For LiveScoreUpdater
    row.setAttribute("data-pick-type", pick.pickType || "spread");
    row.setAttribute("data-pick-team", pick.pickTeam || ""); // For LiveScoreUpdater
    row.setAttribute("data-pick-text", selection);
    row.setAttribute("data-line", pick.line || ""); // For LiveScoreUpdater
    row.setAttribute("data-segment", segmentKey);
    row.setAttribute("data-odds", pick.odds || "");
    row.setAttribute("data-risk", pick.risk || "");
    row.setAttribute("data-win", pick.win || "");
    row.setAttribute("data-status", status);
    row.setAttribute("data-game-id", pick.gameId || ""); // For LiveScoreUpdater
    row.classList.add("group-start");

    const isSingleTeamBet = !pick.homeTeam || homeTeam === "TBD";

    const awayLogoHtml = awayInfo.logo
      ? `<img src="${awayInfo.logo}" class="team-logo" alt="${awayInfo.abbr}" onerror="this.style.display='none'">`
      : "";
    const homeLogoHtml = homeInfo.logo
      ? `<img src="${homeInfo.logo}" class="team-logo" alt="${homeInfo.abbr}" onerror="this.style.display='none'">`
      : "";
    const pickLogoHtml = pickTeamInfo.logo
      ? `<img src="${pickTeamInfo.logo}" class="pick-team-logo" alt="${pickTeamInfo.abbr}" onerror="this.style.display='none'">`
      : "";

    const matchupHtml = isSingleTeamBet
      ? `<div class="matchup-cell">
                    <div class="team-line">
                        ${awayLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${awayTeam}</span>
                            <span class="team-record">${awayRecord ? `(${awayRecord})` : ""}</span>
                        </div>
                    </div>
                </div>`
      : `<div class="matchup-cell">
                    <div class="team-line">
                        ${awayLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${awayTeam}</span>
                            <span class="team-record">${awayRecord ? `(${awayRecord})` : ""}</span>
                        </div>
                    </div>
                    <div class="vs-divider">vs</div>
                    <div class="team-line">
                        ${homeLogoHtml}
                        <div class="team-name-wrapper">
                            <span class="team-name-full">${homeTeam}</span>
                            <span class="team-record">${homeRecord ? `(${homeRecord})` : ""}</span>
                        </div>
                    </div>
                </div>`;

    // Sport-specific box score layout
    // NBA/NFL: Q1, Q2, Q3, Q4, T (quarters)
    // NCAAB/NCAAF: 1H, 2H, T (halves)
    const useQuarters = sport === "NBA" || sport === "NFL";
    const boxscoreClass = useQuarters ? "boxscore-quarters" : "boxscore-halves";

    let awayBoxRow, homeBoxRow, headerCells;

    if (useQuarters) {
      headerCells = `
                <div class="boxscore-cell header-cell">Q1</div>
                <div class="boxscore-cell header-cell">Q2</div>
                <div class="boxscore-cell header-cell">Q3</div>
                <div class="boxscore-cell header-cell">Q4</div>
                <div class="boxscore-cell header-cell">T</div>`;

      awayBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${awayInfo.logo ? `<img src="${awayInfo.logo}" class="boxscore-team-logo"  alt="${awayInfo.abbr}" onerror="this.style.display='none'">` : ""}
                            <span class="boxscore-team-abbr">${awayInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell q1-away"></div>
                    <div class="boxscore-cell period-cell q2-away"></div>
                    <div class="boxscore-cell period-cell q3-away"></div>
                    <div class="boxscore-cell period-cell q4-away"></div>
                    <div class="boxscore-cell total total-away"></div>
                </div>`;

      homeBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${homeInfo.logo ? `<img src="${homeInfo.logo}" class="boxscore-team-logo"  alt="${homeInfo.abbr}" onerror="this.style.display='none'">` : ""}
                            <span class="boxscore-team-abbr">${homeInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell q1-home"></div>
                    <div class="boxscore-cell period-cell q2-home"></div>
                    <div class="boxscore-cell period-cell q3-home"></div>
                    <div class="boxscore-cell period-cell q4-home"></div>
                    <div class="boxscore-cell total total-home"></div>
                </div>`;
    } else {
      // College basketball/football - halves
      headerCells = `
                <div class="boxscore-cell header-cell">1H</div>
                <div class="boxscore-cell header-cell">2H</div>
                <div class="boxscore-cell header-cell">T</div>`;

      awayBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${awayInfo.logo ? `<img src="${awayInfo.logo}" class="boxscore-team-logo"  alt="${awayInfo.abbr}" onerror="this.style.display='none'">` : ""}
                            <span class="boxscore-team-abbr">${awayInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell h1-away"></div>
                    <div class="boxscore-cell period-cell h2-away"></div>
                    <div class="boxscore-cell total total-away"></div>
                </div>`;

      homeBoxRow = `
                <div class="boxscore-row">
                    <div class="boxscore-cell team-cell">
                        <div class="boxscore-team">
                            ${homeInfo.logo ? `<img src="${homeInfo.logo}" class="boxscore-team-logo"  alt="${homeInfo.abbr}" onerror="this.style.display='none'">` : ""}
                            <span class="boxscore-team-abbr">${homeInfo.abbr}</span>
                        </div>
                    </div>
                    <div class="boxscore-cell period-cell h1-home"></div>
                    <div class="boxscore-cell period-cell h2-home"></div>
                    <div class="boxscore-cell total total-home"></div>
                </div>`;
    }

    // Determine appropriate status for boxscore header
    const pickStatus = pick.status || "pending";
    let statusText = pick.gameTime || "Pending";
    let statusClass = "countdown";

    if (
      pickStatus === "final" ||
      pickStatus === "win" ||
      pickStatus === "loss" ||
      pickStatus === "push"
    ) {
      statusText = "Final";
      statusClass = "final";
    } else if (
      pickStatus === "live" ||
      pickStatus === "on-track" ||
      pickStatus === "at-risk"
    ) {
      statusText = pick.gameTime || "Live";
      statusClass = "live";
    } else if (pickStatus === "pending") {
      statusText = pick.gameTime || "Pending";
      statusClass = "countdown";
    }

    const boxscoreHtml = `
            <div class="boxscore-container" data-live-ready="false">
                <div class="compact-boxscore">
                    <div class="boxscore-grid ${boxscoreClass}">
                        <div class="boxscore-row header">
                            <div class="boxscore-cell header-cell game-time-cell">
                                <span class="game-time-status ${statusClass}">${statusText}</span>
                            </div>
                            ${headerCells}
                        </div>
                        ${awayBoxRow}
                        ${isSingleTeamBet ? "" : homeBoxRow}
                    </div>
                </div>
            </div>`;

    // Calculate hit/miss and won/lost values - both show dollar amounts
    const formatWonLost = (amount) => `$${Math.abs(amount).toLocaleString()}`;
    const hitMissValue =
      status === "win"
        ? `+${formatWonLost(pick.win || 0)}`
        : status === "loss"
          ? `-${formatWonLost(pick.risk || 0)}`
          : status === "push"
            ? "$0"
            : "";
    const wonLostValue = hitMissValue; // Same value for both columns

    row.innerHTML = `
            <td data-label="Date & Time">
                <div class="cell-date">${formatDateValue(pick.gameDate)}</div>
                <div class="cell-time">${pick.gameTime || "TBD"}</div>
                <select class="sportsbook-dropdown" data-pick-id="${pick.id}" aria-label="Change sportsbook for this pick">
                    <option value="">No Book</option>
                    <option value="hulkwager" ${sportsbook === "hulkwager" ? "selected" : ""}>Hulk Wager</option>
                    <option value="bombay711" ${sportsbook === "bombay711" ? "selected" : ""}>Bombay 711</option>
                    <option value="kingofsports" ${sportsbook === "kingofsports" ? "selected" : ""}>King of Sports</option>
                    <option value="primetimeaction" ${sportsbook === "primetimeaction" ? "selected" : ""}>Prime Time Action</option>
                    <option value="other" ${sportsbook === "other" ? "selected" : ""}>Other</option>
                </select>
            </td>
            <td class="center" data-label="League">
                ${renderLeagueCell(sport)}
            </td>
            <td data-label="Matchup">
                ${matchupHtml}
            </td>
            <td class="center" data-label="Segment">
                <span class="game-segment" data-segment="${segmentKey}">${segmentLabel}</span>
            </td>
            <td data-label="Pick">
                <div class="pick-cell">
                    <div class="pick-team-info">
                        ${pickLogoHtml}
                        <span class="pick-team-abbr">${pickTeamInfo.abbr || pick.pickTeam}</span>
                    </div>
                    <div class="pick-details">
                        <span class="pick-line">${selection || pick.line || ""}</span>
                        <span class="pick-odds">(${pick.odds || "-110"})</span>
                    </div>
                    ${pick.edge ? `<div class="pick-edge"><span class="edge-badge">+${parseFloat(pick.edge).toFixed(1)}%</span></div>` : ""}
                </div>
            </td>
            <td class="center" data-label="Risk / Win">
                <div class="currency-combined currency-stacked editable-amounts">
                    <div class="currency-risk-row">
                        <input type="number"
                               class="editable-risk"
                               value="${Math.round(pick.risk || 50000)}"
                               data-pick-id="${pick.id}"
                               aria-label="Risk amount"
                               min="0"
                               step="1000">
                        <span class="currency-separator"> /</span>
                    </div>
                    <input type="number"
                           class="editable-win"
                           value="${Math.round(pick.win || 50000)}"
                           data-pick-id="${pick.id}"
                           aria-label="Win amount"
                           min="0"
                           step="1000">
                </div>
            </td>
            <td class="center" data-label="Box Score">
                ${boxscoreHtml}
            </td>
            <td class="center" data-label="Status">
                <span class="status-badge" data-status="${status}" data-blurb="${generateStatusBlurb(status, pick)}">${formatStatusLabel(status, pick)}</span>
            </td>
            <td class="center" data-label="Hit / Miss">
                <span class="hit-miss-value" data-status="${status}">${hitMissValue}</span>
            </td>
            <td class="center" data-label="$ Won / Lost">
                <span class="won-lost-value" data-status="${status}">${wonLostValue}</span>
                <button class="delete-pick-btn" onclick="event.stopPropagation(); window.LocalPicksManager.delete('${pick.id}')" title="Remove pick from dashboard">✕</button>
            </td>
        `;

    return row;
  }

  // ========== RE-ENRICH EXISTING PICKS ==========

  async function reEnrichExistingPicks() {
    const picks = getAllPicks();
    if (picks.length === 0) return;

    // Check if any picks are missing records
    const needsEnrichment = picks.some((p) => !p.awayRecord && !p.homeRecord);
    if (!needsEnrichment) {
      console.log("✅ All picks already have records");
      return;
    }

    console.log("🔄 Re-enriching existing picks with ESPN data...");

    // Wait for AutoGameFetcher to be ready
    let attempts = 0;
    while (!window.AutoGameFetcher && attempts < 10) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }

    if (!window.AutoGameFetcher) {
      console.warn("⚠️ AutoGameFetcher not available for re-enrichment");
      return;
    }

    // Fetch today's games
    try {
      await window.AutoGameFetcher.fetchTodaysGames();
      const todaysGames = window.AutoGameFetcher.getTodaysGames() || [];

      if (todaysGames.length === 0) {
        console.log("📭 No games today to enrich with");
        return;
      }

      console.log(`🏀 Found ${todaysGames.length} games for enrichment`);

      let updated = false;
      const enrichedPicks = picks.map((pick) => {
        // Skip if already has records
        if (pick.awayRecord || pick.homeRecord) return pick;

        const teamToFind = pick.pickTeam || pick.awayTeam;
        if (!teamToFind) return pick;

        const game = window.AutoGameFetcher.findGame(teamToFind);
        if (game) {
          console.log(
            `📝 Enriching: ${pick.pickTeam} -> ${game.awayTeam} (${game.awayRecord}) vs ${game.homeTeam} (${game.homeRecord})`,
          );
          updated = true;
          return {
            ...pick,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            awayRecord: game.awayRecord || "",
            homeRecord: game.homeRecord || "",
            gameTime: pick.gameTime || game.time,
            gameDate: pick.gameDate || game.date,
            sport: pick.sport || game.sport,
            gameStatus: game.status,
          };
        }
        return pick;
      });

      if (updated) {
        savePicks(enrichedPicks);
        console.log("✅ Picks re-enriched with team records");
        refreshPicksTable();
      }
    } catch (e) {
      console.error("Error re-enriching picks:", e);
    }
  }

  // ========== DEMO PICKS REMOVED (v33.00.0 Production) ==========
  // Demo picks functionality has been completely removed for production.
  // Real picks come from weekly-lineup page and model APIs only.

  // ========== CLEANUP SAMPLE DATA ==========

  /**
   * Clean up stale pending picks older than specified days
   * Runs once per day to prevent accumulation of old picks
   */
  function cleanupStalePicks(daysOld = 7) {
    const LAST_CLEANUP_KEY = "gbsv_last_stale_cleanup";
    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY);
    const today = new Date().toDateString();

    // Only run once per day
    if (lastCleanup === today) {
      return;
    }

    const picks = getAllPicks();
    if (picks.length === 0) {
      localStorage.setItem(LAST_CLEANUP_KEY, today);
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    cutoffDate.setHours(0, 0, 0, 0);

    const freshPicks = picks.filter((pick) => {
      const status = (pick.status || "pending").toLowerCase();

      // Keep all settled picks (won, lost, push) regardless of age
      if (["win", "won", "loss", "lost", "push"].includes(status)) {
        return true;
      }

      // For pending/live picks, check age
      const dateStr = pick.gameDate || pick.createdAt || "";
      let pickDate = null;

      try {
        pickDate = dateStr ? new Date(dateStr) : null;
      } catch {}

      // Keep if we can't determine date (safer to keep)
      if (!pickDate || isNaN(pickDate.getTime())) {
        return true;
      }

      // Remove if older than cutoff
      return pickDate >= cutoffDate;
    });

    if (freshPicks.length < picks.length) {
      const removed = picks.length - freshPicks.length;
      console.log(
        `🗑️ [Stale Cleanup] Removed ${removed} old pending picks (>${daysOld}d), kept ${freshPicks.length} picks`,
      );
      savePicks(freshPicks);
    }

    localStorage.setItem(LAST_CLEANUP_KEY, today);
  }

  function cleanupSampleData() {
    const CLEANUP_VERSION_KEY = "gbsv_cleanup_v5"; // Bump version to re-run cleanup

    // Only run cleanup once per browser (per version)
    if (localStorage.getItem(CLEANUP_VERSION_KEY)) {
      return;
    }

    // Clear the old demo import flag so cleanup runs fresh
    localStorage.removeItem("gbsv_demo_imported_v1");
    localStorage.removeItem("gbsv_cleanup_v1");

    const picks = getAllPicks();
    if (picks.length === 0) {
      localStorage.setItem(CLEANUP_VERSION_KEY, "done");
      return;
    }

    const sampleSources = new Set([
      "demo",
      "sample",
      "mock",
      "placeholder",
      "fake",
      "test",
      "example",
    ]);

    // Filter out ONLY explicitly marked demo/sample picks - keep everything else
    const realPicks = picks.filter((pick) => {
      // Remove if it has explicit demo/sample markers
      if (pick.isDemo === true || pick.isSample === true) {
        return false;
      }
      // Remove if source is explicitly marked as demo/fake
      const source = String(pick.source || "").toLowerCase();
      if (sampleSources.has(source)) {
        return false;
      }
      // Remove Demo Book picks
      const sportsbook = String(pick.sportsbook || "").toLowerCase();
      if (
        sportsbook === "demo book" ||
        /(demo|sample|mock|placeholder|fake|test|example)/.test(sportsbook)
      ) {
        return false;
      }
      // KEEP everything else - don't be aggressive with cleanup
      return true;
    });

    if (realPicks.length < picks.length) {
      const removed = picks.length - realPicks.length;
      console.log(
        `[Cleanup] Removed ${removed} demo picks, kept ${realPicks.length} real picks`,
      );
      savePicks(realPicks);
    }

    localStorage.setItem(CLEANUP_VERSION_KEY, "done");
  }

  // ========== INITIALIZE ==========

  /**
   * Check if we're on the dashboard page (not weekly-lineup or other pages)
   */
  function isDashboardPage() {
    // Check for the page-weekly-lineup class on body
    if (document.body.classList.contains("page-weekly-lineup")) {
      return false;
    }
    // Check the URL path
    const path = window.location.pathname.toLowerCase();
    if (path.includes("weekly-lineup") || path.includes("odds-market")) {
      return false;
    }
    // Default to true if on dashboard.html or dashboard-like page
    return true;
  }

  function initialize() {
    console.log(
      "🏠 LocalPicksManager v33.02.0 initialized (real data only + auto-cleanup)",
    );

    // Clean up any legacy sample/demo data (runs once)
    cleanupSampleData();

    // Clean up stale pending picks (runs daily)
    cleanupStalePicks(7); // Remove pending picks older than 7 days

    // NO DEMO DATA: Production version uses only real picks from weekly-lineup
    // importTodaysPicks(); -- DISABLED: No sample/placeholder data in production

    // Override global functions
    window.processAndSavePicks = parseAndAddPicks;
    window.loadUploadedPicks = refreshPicksTable;

    // Only auto-refresh table on dashboard page (not weekly-lineup)
    if (isDashboardPage()) {
      // Load existing picks first (shows immediately)
      refreshPicksTable();

      // Initialize table sorting
      if (
        window.PicksSortManager &&
        typeof window.PicksSortManager.initSorting === "function"
      ) {
        setTimeout(() => window.PicksSortManager.initSorting(), 100);
      }

      // Then re-enrich with ESPN data (async, updates when ready)
      setTimeout(() => reEnrichExistingPicks(), 500);
    } else {
      console.log(
        "🏠 LocalPicksManager: Skipping auto-refresh (not on dashboard page)",
      );
    }
  }

  // ========== FILTERING HELPERS (read-only, don't modify storage) ==========

  /**
   * Get active picks (pending or live status)
   * These are picks that haven't been settled yet
   */
  function getActivePicks() {
    const picks = getAllPicks();
    return picks.filter((pick) => {
      const status = (pick.status || "pending").toLowerCase();
      return (
        status === "pending" ||
        status === "live" ||
        status === "on-track" ||
        status === "at-risk"
      );
    });
  }

  /**
   * Get settled picks (won, lost, push)
   */
  function getSettledPicks() {
    const picks = getAllPicks();
    return picks.filter((pick) => {
      const status = (pick.status || "pending").toLowerCase();
      return (
        status === "win" ||
        status === "won" ||
        status === "loss" ||
        status === "lost" ||
        status === "push"
      );
    });
  }

  /**
   * Get picks by date range (doesn't delete, just filters)
   * @param {Date|null} startDate - Start of range (inclusive)
   * @param {Date|null} endDate - End of range (inclusive)
   */
  function getPicksByDateRange(startDate = null, endDate = null) {
    const picks = getAllPicks();
    if (!startDate && !endDate) return picks;

    return picks.filter((pick) => {
      const dateStr = pick.gameDate || pick.createdAt || pick.date || "";
      if (!dateStr) return true; // Include if no date info

      try {
        const pickDate = new Date(dateStr);
        if (startDate && pickDate < startDate) return false;
        if (endDate && pickDate > endDate) return false;
        return true;
      } catch {
        return true;
      }
    });
  }

  /**
   * Get picks for today only
   */
  function getTodaysPicks() {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    return getPicksByDateRange(startOfDay, endOfDay);
  }

  /**
   * Archive old settled picks (move to separate storage key for analytics)
   * Only call this manually or on a schedule, not on every page load
   * @param {number} daysOld - Archive picks older than this many days (default 30)
   */
  function archiveOldPicks(daysOld = 30) {
    const picks = getAllPicks();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    cutoffDate.setHours(0, 0, 0, 0);

    const toArchive = [];
    const toKeep = [];

    picks.forEach((pick) => {
      const status = (pick.status || "pending").toLowerCase();
      const isSettled = ["win", "won", "loss", "lost", "push"].includes(status);
      const dateStr = pick.gameDate || pick.createdAt || "";
      let pickDate = null;

      try {
        pickDate = dateStr ? new Date(dateStr) : null;
      } catch {}

      // Archive if: settled AND older than cutoff
      if (isSettled && pickDate && pickDate < cutoffDate) {
        toArchive.push(pick);
      } else {
        toKeep.push(pick);
      }
    });

    if (toArchive.length > 0) {
      // Save archived picks to separate key
      const existingArchive = JSON.parse(
        localStorage.getItem("gbsv_picks_archive") || "[]",
      );
      localStorage.setItem(
        "gbsv_picks_archive",
        JSON.stringify([...existingArchive, ...toArchive]),
      );
      savePicks(toKeep);
      console.log(
        `📦 [LocalPicksManager] Archived ${toArchive.length} old settled picks`,
      );
    }

    return toArchive.length;
  }

  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Export API
  window.LocalPicksManager = {
    getAll: getAllPicks,
    getActive: getActivePicks,
    getSettled: getSettledPicks,
    getByDateRange: getPicksByDateRange,
    getToday: getTodaysPicks,
    add: addPicks,
    parseAndAdd: parseAndAddPicks,
    clear: clearPicks,
    delete: deletePick,
    updateStatus: updatePickStatus,
    refresh: refreshPicksTable,
    reEnrich: reEnrichExistingPicks,
    getUnitMultiplier,
    setUnitMultiplier,
    archiveOldPicks,
    cleanupStale: cleanupStalePicks, // Manually trigger stale picks cleanup
    // Debug helpers
    debug: () => {
      const picks = getAllPicks();
      console.log("=== LocalPicksManager Debug ===");
      console.log(`Total picks in localStorage: ${picks.length}`);
      console.log("Storage key:", STORAGE_KEY);
      console.log(
        "Raw localStorage:",
        localStorage.getItem(STORAGE_KEY)?.substring(0, 500),
      );
      if (picks.length > 0) {
        console.log("Sample pick:", JSON.stringify(picks[0], null, 2));
      }
      const tbody = document.getElementById("picks-tbody");
      console.log("Table element found:", !!tbody);
      console.log("Table rows:", tbody?.children?.length || 0);
      return picks;
    },
    forceRefresh: () => {
      console.log("Force refreshing picks table...");
      refreshPicksTable();
      return getAllPicks().length;
    },
  };

  console.log("✅ LocalPicksManager v33.02.0 loaded (with auto-cleanup)");
})();
