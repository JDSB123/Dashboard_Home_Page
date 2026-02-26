/**
 * Pick Standardizer v3.0
 * Parses picks from multiple formats:
 * - Sportsbook game lines HTML (div-based panels)
 * - Sportsbook HTML tables (legacy bet slip format)
 * - Text shorthand (e.g., "Spurs 2.5 -105 $50")
 * - Screenshot OCR text
 */

(function () {
  "use strict";

  // Default unit multiplier (e.g., $50 = $50,000 when unit is 1000)
  let unitMultiplier = 1000; // $1 = $1,000

  // Team name mappings (abbreviations to full names)
  const TEAM_ALIASES = {
    // NBA - Full names and nicknames
    spurs: "San Antonio Spurs",
    "san antonio": "San Antonio Spurs",
    sas: "San Antonio Spurs",
    knicks: "New York Knicks",
    "new york": "New York Knicks",
    nyk: "New York Knicks",
    lakers: "Los Angeles Lakers",
    "la lakers": "Los Angeles Lakers",
    lal: "Los Angeles Lakers",
    clippers: "Los Angeles Clippers",
    "la clippers": "Los Angeles Clippers",
    lac: "Los Angeles Clippers",
    warriors: "Golden State Warriors",
    "golden state": "Golden State Warriors",
    gsw: "Golden State Warriors",
    gs: "Golden State Warriors",
    celtics: "Boston Celtics",
    boston: "Boston Celtics",
    bos: "Boston Celtics",
    heat: "Miami Heat",
    miami: "Miami Heat",
    mia: "Miami Heat",
    bulls: "Chicago Bulls",
    chicago: "Chicago Bulls",
    chi: "Chicago Bulls",
    cavs: "Cleveland Cavaliers",
    cavaliers: "Cleveland Cavaliers",
    cleveland: "Cleveland Cavaliers",
    cle: "Cleveland Cavaliers",
    mavs: "Dallas Mavericks",
    mavericks: "Dallas Mavericks",
    dallas: "Dallas Mavericks",
    dal: "Dallas Mavericks",
    nuggets: "Denver Nuggets",
    denver: "Denver Nuggets",
    den: "Denver Nuggets",
    pistons: "Detroit Pistons",
    detroit: "Detroit Pistons",
    det: "Detroit Pistons",
    rockets: "Houston Rockets",
    houston: "Houston Rockets",
    hou: "Houston Rockets",
    pacers: "Indiana Pacers",
    indiana: "Indiana Pacers",
    ind: "Indiana Pacers",
    grizzlies: "Memphis Grizzlies",
    memphis: "Memphis Grizzlies",
    mem: "Memphis Grizzlies",
    bucks: "Milwaukee Bucks",
    milwaukee: "Milwaukee Bucks",
    mil: "Milwaukee Bucks",
    wolves: "Minnesota Timberwolves",
    timberwolves: "Minnesota Timberwolves",
    minnesota: "Minnesota Timberwolves",
    min: "Minnesota Timberwolves",
    pelicans: "New Orleans Pelicans",
    "new orleans": "New Orleans Pelicans",
    nop: "New Orleans Pelicans",
    no: "New Orleans Pelicans",
    nets: "Brooklyn Nets",
    brooklyn: "Brooklyn Nets",
    bkn: "Brooklyn Nets",
    bk: "Brooklyn Nets",
    thunder: "Oklahoma City Thunder",
    okc: "Oklahoma City Thunder",
    magic: "Orlando Magic",
    orlando: "Orlando Magic",
    orl: "Orlando Magic",
    "76ers": "Philadelphia 76ers",
    sixers: "Philadelphia 76ers",
    philly: "Philadelphia 76ers",
    philadelphia: "Philadelphia 76ers",
    phi: "Philadelphia 76ers",
    suns: "Phoenix Suns",
    phoenix: "Phoenix Suns",
    phx: "Phoenix Suns",
    blazers: "Portland Trail Blazers",
    portland: "Portland Trail Blazers",
    por: "Portland Trail Blazers",
    kings: "Sacramento Kings",
    sacramento: "Sacramento Kings",
    sac: "Sacramento Kings",
    raptors: "Toronto Raptors",
    toronto: "Toronto Raptors",
    tor: "Toronto Raptors",
    jazz: "Utah Jazz",
    utah: "Utah Jazz",
    uta: "Utah Jazz",
    wizards: "Washington Wizards",
    washington: "Washington Wizards",
    was: "Washington Wizards",
    wsh: "Washington Wizards",
    hawks: "Atlanta Hawks",
    atlanta: "Atlanta Hawks",
    atl: "Atlanta Hawks",
    hornets: "Charlotte Hornets",
    charlotte: "Charlotte Hornets",
    cha: "Charlotte Hornets",

    // NFL
    chiefs: "Kansas City Chiefs",
    "kansas city": "Kansas City Chiefs",
    kc: "Kansas City Chiefs",
    eagles: "Philadelphia Eagles",
    cowboys: "Dallas Cowboys",
    niners: "San Francisco 49ers",
    "49ers": "San Francisco 49ers",
    bills: "Buffalo Bills",
    buffalo: "Buffalo Bills",
    ravens: "Baltimore Ravens",
    baltimore: "Baltimore Ravens",
    bengals: "Cincinnati Bengals",
    cincinnati: "Cincinnati Bengals",
    browns: "Cleveland Browns",
    steelers: "Pittsburgh Steelers",
    pittsburgh: "Pittsburgh Steelers",
    colts: "Indianapolis Colts",
    texans: "Houston Texans",
    jaguars: "Jacksonville Jaguars",
    jags: "Jacksonville Jaguars",
    jacksonville: "Jacksonville Jaguars",
    titans: "Tennessee Titans",
    tennessee: "Tennessee Titans",
    broncos: "Denver Broncos",
    chargers: "Los Angeles Chargers",
    "la chargers": "Los Angeles Chargers",
    raiders: "Las Vegas Raiders",
    vegas: "Las Vegas Raiders",
    seahawks: "Seattle Seahawks",
    seattle: "Seattle Seahawks",
    cardinals: "Arizona Cardinals",
    arizona: "Arizona Cardinals",
    rams: "Los Angeles Rams",
    "la rams": "Los Angeles Rams",
    packers: "Green Bay Packers",
    "green bay": "Green Bay Packers",
    bears: "Chicago Bears",
    lions: "Detroit Lions",
    vikings: "Minnesota Vikings",
    saints: "New Orleans Saints",
    falcons: "Atlanta Falcons",
    panthers: "Carolina Panthers",
    carolina: "Carolina Panthers",
    bucs: "Tampa Bay Buccaneers",
    buccaneers: "Tampa Bay Buccaneers",
    tampa: "Tampa Bay Buccaneers",
    "tampa bay": "Tampa Bay Buccaneers",
    commanders: "Washington Commanders",
    giants: "New York Giants",
    "ny giants": "New York Giants",
    jets: "New York Jets",
    "ny jets": "New York Jets",
    patriots: "New England Patriots",
    pats: "New England Patriots",
    "new england": "New England Patriots",
    dolphins: "Miami Dolphins",

    // College - Power conferences & common
    army: "Army Black Knights",
    navy: "Navy Midshipmen",
    alabama: "Alabama Crimson Tide",
    bama: "Alabama Crimson Tide",
    georgia: "Georgia Bulldogs",
    "ohio state": "Ohio State Buckeyes",
    "ohio st": "Ohio State Buckeyes",
    osu: "Ohio State Buckeyes",
    michigan: "Michigan Wolverines",
    "michigan state": "Michigan State Spartans",
    "michigan st": "Michigan State Spartans",
    msu: "Michigan State Spartans",
    texas: "Texas Longhorns",
    "notre dame": "Notre Dame Fighting Irish",
    duke: "Duke Blue Devils",
    unc: "North Carolina Tar Heels",
    "north carolina": "North Carolina Tar Heels",
    kentucky: "Kentucky Wildcats",
    kansas: "Kansas Jayhawks",
    gonzaga: "Gonzaga Bulldogs",
    auburn: "Auburn Tigers",
    // tennessee: "Tennessee Volunteers", // Duplicate key, conflicts with Titans
    purdue: "Purdue Boilermakers",
    uconn: "UConn Huskies",
    "iowa state": "Iowa State Cyclones",
    "iowa st": "Iowa State Cyclones",
    // houston: "Houston Cougars", // Duplicate key, conflicts with Rockets/Texans
    baylor: "Baylor Bears",
    // arizona: "Arizona Wildcats", // Duplicate key, conflicts with Cardinals
    ucla: "UCLA Bruins",
    florida: "Florida Gators",
    lsu: "LSU Tigers",
    arkansas: "Arkansas Razorbacks",
    oregon: "Oregon Ducks",
    wisconsin: "Wisconsin Badgers",
    illinois: "Illinois Fighting Illini",
    iowa: "Iowa Hawkeyes",

    // NCAAM - Mid-majors & smaller conferences (Horizon, MAAC, C-USA, etc.)
    siena: "Siena Saints",
    "st peters": "Saint Peter's Peacocks",
    "saint peters": "Saint Peter's Peacocks",
    "st peter's": "Saint Peter's Peacocks",
    "saint peter's": "Saint Peter's Peacocks",
    iona: "Iona Gaels",
    merrimack: "Merrimack Warriors",
    "robert morris": "Robert Morris Colonials",
    "rob morris": "Robert Morris Colonials",
    "wright state": "Wright State Raiders",
    "wright st": "Wright State Raiders",
    "cleveland state": "Cleveland State Vikings",
    "cleveland st": "Cleveland State Vikings",
    ipfw: "Purdue Fort Wayne Mastodons",
    "purdue fort wayne": "Purdue Fort Wayne Mastodons",
    "n kentucky": "Northern Kentucky Norse",
    "northern kentucky": "Northern Kentucky Norse",
    nku: "Northern Kentucky Norse",
    youngstown: "Youngstown State Penguins",
    "youngstown state": "Youngstown State Penguins",
    "youngstown st": "Youngstown State Penguins",
    "wisc green bay": "Green Bay Phoenix",
    // "green bay": "Green Bay Phoenix", // Duplicate key, conflicts with Packers
    "wisconsin green bay": "Green Bay Phoenix",
    "detroit mercy": "Detroit Mercy Titans",
    // detroit: "Detroit Mercy Titans", // Duplicate key, conflicts with Lions/Pistons
    rice: "Rice Owls",
    utsa: "UTSA Roadrunners",
    tulane: "Tulane Green Wave",
    uab: "UAB Blazers",
    "louisiana tech": "Louisiana Tech Bulldogs",
    "la tech": "Louisiana Tech Bulldogs",
    "wisc milwaukee": "Milwaukee Panthers",
    // milwaukee: "Milwaukee Panthers", // Duplicate key, conflicts with Bucks
    "wisconsin milwaukee": "Milwaukee Panthers",
    uwm: "Milwaukee Panthers",
    oakland: "Oakland Golden Grizzlies",
    marist: "Marist Red Foxes",
    "sacred heart": "Sacred Heart Pioneers",
    fairfield: "Fairfield Stags",
    quinnipiac: "Quinnipiac Bobcats",
    rider: "Rider Broncs",
    niagara: "Niagara Purple Eagles",
    manhattan: "Manhattan Jaspers",
    canisius: "Canisius Golden Griffins",
    "mount st marys": "Mount St. Mary's Mountaineers",
    wagner: "Wagner Seahawks",
    // "youngstown state": "Youngstown State Penguins", // Duplicate key
    // "purdue fort wayne": "Purdue Fort Wayne Mastodons", // Duplicate key
    marshall: "Marshall Thundering Herd",
    wku: "Western Kentucky Hilltoppers",
    "western kentucky": "Western Kentucky Hilltoppers",
    fiu: "FIU Panthers",
    "middle tennessee": "Middle Tennessee Blue Raiders",
    mtsu: "Middle Tennessee Blue Raiders",
    "old dominion": "Old Dominion Monarchs",
    odu: "Old Dominion Monarchs",
    // charlotte: "Charlotte 49ers", // Duplicate key, conflicts with Hornets
    "east carolina": "East Carolina Pirates",
    ecu: "East Carolina Pirates",
    "north texas": "North Texas Mean Green",
    utep: "UTEP Miners",
    "sam houston": "Sam Houston Bearkats",
    "jacksonville st": "Jacksonville State Gamecocks",
    "new mexico st": "New Mexico State Aggies",
    liberty: "Liberty Flames",
    "kennesaw state": "Kennesaw State Owls",
  };

  // ═══════════════════════════════════════════════════════════════════
  // TEAM VARIANT REGISTRY — loaded from JSON (362 NCAAM + 30 NBA teams)
  // Builds a lookup: lowercase name/location/abbreviation → canonical name
  // ═══════════════════════════════════════════════════════════════════
  let _variantsLoaded = false;

  async function loadTeamVariants() {
    if (_variantsLoaded) return;
    try {
      const [ncaamRes, nbaRes] = await Promise.all([
        fetch("assets/data/team-variants/ncaam_team_variants.json")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("assets/data/team-variants/nba_team_variants.json")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (ncaamRes) {
        let count = 0;
        for (const [abbr, team] of Object.entries(ncaamRes)) {
          const canonical = team.name;
          const loc = (team.location || "").toLowerCase().trim();
          const nick = (team.nickname || "").toLowerCase().trim();
          if (loc && !TEAM_ALIASES[loc]) TEAM_ALIASES[loc] = canonical;
          if (abbr && !TEAM_ALIASES[abbr.toLowerCase()])
            TEAM_ALIASES[abbr.toLowerCase()] = canonical;
          for (const alt of team.abbreviations || []) {
            const a = alt.toLowerCase().trim();
            if (a.length > 2 && !TEAM_ALIASES[a]) TEAM_ALIASES[a] = canonical;
          }
          if (nick && nick.length > 5 && !TEAM_ALIASES[nick])
            TEAM_ALIASES[nick] = canonical;
          count++;
        }
        console.log(`✅ Loaded ${count} NCAAM team variants into standardizer`);
      }

      if (nbaRes) {
        let count = 0;
        for (const [abbr, team] of Object.entries(nbaRes)) {
          const canonical = team.name || team.fullName;
          const loc = (team.location || "").toLowerCase().trim();
          if (loc && !TEAM_ALIASES[loc]) TEAM_ALIASES[loc] = canonical;
          if (abbr && !TEAM_ALIASES[abbr.toLowerCase()])
            TEAM_ALIASES[abbr.toLowerCase()] = canonical;
          for (const alt of team.abbreviations || []) {
            const a = alt.toLowerCase().trim();
            if (a.length > 1 && !TEAM_ALIASES[a]) TEAM_ALIASES[a] = canonical;
          }
          count++;
        }
        console.log(`✅ Loaded ${count} NBA team variants into standardizer`);
      }

      _variantsLoaded = true;
    } catch (e) {
      console.warn("[PickStandardizer] Could not load team variants:", e);
    }
  }

  // Kick off loading immediately
  loadTeamVariants();

  /**
   * Main entry point - detects format and parses accordingly
   */
  function standardizePicks(input, options = {}) {
    if (options.unitMultiplier) {
      unitMultiplier = options.unitMultiplier;
    }

    // Detect bet-history format (timestamps + picks + dollar amounts)
    if (typeof input === "string" && isBetHistoryFormat(input)) {
      console.log("📋 Detected bet-history paste format");
      return parseBetHistory(input);
    }

    // Detect if input is HTML
    if (typeof input === "string" && input.includes("<")) {
      // Check for sportsbook game lines format (div-based panels)
      if (
        input.includes('data-panel="line"') ||
        input.includes("data-sport-line")
      ) {
        return parseSportsbookGameLines(input);
      }
      // Legacy bet slip table format
      if (input.includes("<table") || input.includes("<tr")) {
        return parseHTMLPicks(input);
      }
      // Generic HTML with classes (may contain picks)
      if (input.includes("class=")) {
        return parseSportsbookGameLines(input);
      }
    }

    // Otherwise treat as text
    return parseTextPicks(input);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bet history support (minimal)
  // The UI references these helpers; keep them defined to avoid runtime
  // ReferenceErrors even when bet-history parsing isn't used.
  // ═══════════════════════════════════════════════════════════════════

  function isBetHistoryFormat(text) {
    if (typeof text !== "string") return false;
    const hasMoney = /\$[\d,]+/.test(text);
    const hasTimestamp =
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b\s+\d{1,2},?\s*\d{4}/i.test(
        text,
      );
    const hasOddsSignals = /\bML\b/i.test(text) || /[+-]\d{3,4}/.test(text);
    return hasMoney && (hasTimestamp || hasOddsSignals);
  }

  function parseBetHistory(text) {
    if (typeof text !== "string") return [];

    // Strip common bet-history timestamp prefixes and $risk/$win lines,
    // then fall back to the existing flexible text parser.
    const cleanedLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) =>
        line
          .replace(
            /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s*\d{4}\s+\d{1,2}:\d{2}\s*(?:am|pm)?\s*/i,
            "",
          )
          .trim(),
      )
      .filter((line) => !/^\$[\d,]+/.test(line));

    return parseTextPicks(cleanedLines.join("\n"));
  }

  function parseBetHistoryLeg(line, defaultSport = "NBA", currentGame = null) {
    if (typeof line !== "string") return null;
    return parseFlexibleLine(line, defaultSport, currentGame);
  }

  /**
   * Parse sportsbook game lines HTML (div-based panels)
   * Handles structure like: div[data-panel="line"] with nested teams, dates, and betting lines
   */
  function parseSportsbookGameLines(html) {
    const picks = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all game panels - try multiple selectors
    let gamePanels = doc.querySelectorAll('[data-panel="line"]');

    if (gamePanels.length === 0) {
      gamePanels = doc.querySelectorAll(
        ".line-panel, .game-panel, [data-sport-line]",
      );
    }

    if (gamePanels.length === 0) {
      // Try alternate selector for different HTML structures
      gamePanels = doc.querySelectorAll(".lines-row, .game-row, .event-row");
    }

    console.log(`🔍 Found ${gamePanels.length} game panels to parse`);

    gamePanels.forEach((panel, idx) => {
      try {
        const gamePicks = parseGamePanel(panel);
        console.log(`  Panel ${idx + 1}: ${gamePicks.length} picks found`);
        picks.push(...gamePicks);
      } catch (e) {
        console.warn("Failed to parse game panel:", e);
      }
    });

    // If no picks found from HTML structure, try extracting text and parsing as text
    if (picks.length === 0) {
      console.log("📝 No HTML picks found, falling back to text parsing...");
      const textContent =
        doc.body?.textContent || html.replace(/<[^>]*>/g, " ");
      const textPicks = parseTextPicks(textContent);
      picks.push(...textPicks);
    }

    console.log(`📊 Total parsed: ${picks.length} betting lines`);
    return picks;
  }

  /**
   * Parse a single game panel into multiple betting line picks
   */
  function parseGamePanel(panel) {
    const picks = [];

    // Extract game metadata
    const gameInfo = extractGameInfo(panel);

    if (!gameInfo.firstTeam && !gameInfo.secondTeam) {
      // No teams found, skip this panel
      return picks;
    }

    // Find all betting line groups
    const lineGroups = panel.querySelectorAll(
      ".group, .line-group, [data-group-line]",
    );

    lineGroups.forEach((group) => {
      try {
        const groupPicks = parseLineGroup(group, gameInfo);
        picks.push(...groupPicks);
      } catch (e) {
        console.warn("Failed to parse line group:", e);
      }
    });

    // If no line groups found, try parsing individual lines
    if (picks.length === 0) {
      const individualLines = panel.querySelectorAll(
        '.line-play, .bet-line, [data-field="line"]',
      );
      individualLines.forEach((line) => {
        const pick = parseIndividualLine(line, gameInfo);
        if (pick) picks.push(pick);
      });
    }

    return picks;
  }

  /**
   * Extract game information from a panel (teams, date, time, sport)
   */
  function extractGameInfo(panel) {
    const info = {
      firstTeam: "",
      secondTeam: "",
      date: getTodayDate(),
      time: "",
      sport: "NBA", // Default
      league: "",
    };

    // Extract team names
    const firstTeamEl = panel.querySelector(
      '[data-field="first-team"], .first-team, .away-team, .team-1',
    );
    const secondTeamEl = panel.querySelector(
      '[data-field="second-team"], .second-team, .home-team, .team-2',
    );

    if (firstTeamEl) info.firstTeam = firstTeamEl.textContent.trim();
    if (secondTeamEl) info.secondTeam = secondTeamEl.textContent.trim();

    // Extract date and time
    const dateEl = panel.querySelector(
      '[data-field="min-date"], .game-date, .date',
    );
    const timeEl = panel.querySelector(
      '[data-field="min-time"], .game-time, .time',
    );

    if (dateEl) info.date = dateEl.textContent.trim();
    if (timeEl) info.time = timeEl.textContent.trim();

    // Extract sport/league
    const leagueEl = panel.querySelector(
      '[data-field="league-name"], .league, .sport-name',
    );
    if (leagueEl) {
      info.league = leagueEl.textContent.trim();
      info.sport = detectSportFromLeague(info.league);
    }

    // Try to detect sport from panel attributes
    const sportLine = panel.querySelector("[data-sport-line]");
    if (sportLine) {
      const sportAttr = sportLine.getAttribute("data-sport-line");
      if (sportAttr) {
        info.sport = detectSportFromAttribute(sportAttr);
      }
    }

    // Build game string
    if (info.firstTeam && info.secondTeam) {
      info.game = `${info.firstTeam} @ ${info.secondTeam}`;
      info.awayTeam = info.firstTeam;
      info.homeTeam = info.secondTeam;
    }

    return info;
  }

  /**
   * Parse a betting line group (spread, moneyline, total, etc.)
   */
  function parseLineGroup(group, gameInfo) {
    const picks = [];

    // Determine the bet type from the group
    const groupType = detectGroupType(group);

    // Find all line plays within this group
    const linePlays = group.querySelectorAll(
      ".line-play, .bet-option, [data-type]",
    );

    linePlays.forEach((play, index) => {
      const pick = parseLinePlacement(play, gameInfo, groupType, index);
      if (pick) picks.push(pick);
    });

    return picks;
  }

  /**
   * Detect the type of betting group (spread, ML, total, team total)
   */
  function detectGroupType(group) {
    const groupClass = group.className || "";
    const dataType = group.getAttribute("data-type") || "";
    const groupText = group.textContent.toLowerCase();

    // Check data-type attribute
    if (dataType.includes("spread") || dataType.includes("ps")) return "spread";
    if (dataType.includes("ml") || dataType.includes("money"))
      return "moneyline";
    if (dataType.includes("total") || dataType.includes("ou")) {
      if (dataType.includes("team") || dataType.includes("tt"))
        return "team-total";
      return "total";
    }

    // Check class names
    if (groupClass.includes("spread")) return "spread";
    if (groupClass.includes("money") || groupClass.includes("ml"))
      return "moneyline";
    if (groupClass.includes("team-total") || groupClass.includes("tt"))
      return "team-total";
    if (groupClass.includes("total") || groupClass.includes("ou"))
      return "total";

    // Check group position/content
    if (groupClass.includes("group-1") || groupClass.includes("group-0"))
      return "spread";
    if (groupClass.includes("group-2")) return "moneyline";
    if (groupClass.includes("group-3")) return "total";
    if (groupClass.includes("group-4") || groupClass.includes("group-5"))
      return "team-total";

    // Infer from text content
    if (groupText.includes("spread")) return "spread";
    if (groupText.includes("money")) return "moneyline";
    if (groupText.includes("over") || groupText.includes("under"))
      return "total";

    return "spread"; // Default
  }

  /**
   * Parse an individual line placement into a pick object
   */
  function parseLinePlacement(play, gameInfo, betType, index) {
    const pick = {
      sport: gameInfo.sport,
      segment: "Full Game",
      status: "pending",
      date: gameInfo.date,
      time: gameInfo.time,
      game: gameInfo.game,
      awayTeam: gameInfo.awayTeam,
      homeTeam: gameInfo.homeTeam,
    };

    // Extract line value
    const lineEl = play.querySelector(
      '[data-field="line"], .line, .spread-value, .total-value',
    );
    const priceEl = play.querySelector(
      '[data-field="price"], .price, .odds, .juice',
    );

    let line = lineEl ? lineEl.textContent.trim() : "";
    let price = priceEl ? priceEl.textContent.trim() : "-110";

    // Normalize line (convert fractions to decimals)
    line = line.replace(/½/g, ".5").replace(/¼/g, ".25").replace(/¾/g, ".75");

    // Determine which team this line is for
    const teamIndex = determineTeamIndex(play, index);

    switch (betType) {
      case "spread":
        pick.pickType = "spread";
        pick.pickTeam =
          teamIndex === 0 ? gameInfo.firstTeam : gameInfo.secondTeam;
        pick.line = formatLine(line);
        pick.odds = formatOdds(price);
        break;

      case "moneyline":
        pick.pickType = "moneyline";
        pick.pickTeam =
          teamIndex === 0 ? gameInfo.firstTeam : gameInfo.secondTeam;
        pick.odds = formatOdds(line || price); // ML often shows odds in the line field
        break;

      case "total":
        pick.pickType = "total";
        pick.pickDirection = teamIndex === 0 ? "Over" : "Under";
        pick.pickTeam = pick.pickDirection;
        pick.line = line.replace(/[ou]/gi, "").trim();
        pick.odds = formatOdds(price);
        break;

      case "team-total":
        pick.pickType = "team-total";
        pick.pickDirection = determineOverUnder(play, index);
        // Team totals alternate: Team1 Over, Team1 Under, Team2 Over, Team2 Under
        const ttTeamIdx = Math.floor(index / 2);
        pick.pickTeam =
          ttTeamIdx === 0 ? gameInfo.firstTeam : gameInfo.secondTeam;
        pick.line = line.replace(/[ou]/gi, "").trim();
        pick.odds = formatOdds(price);
        break;
    }

    // Validate pick has required fields
    if (!pick.pickTeam || !pick.pickType) {
      return null;
    }

    // Skip if no meaningful line/odds
    if (!pick.line && !pick.odds && pick.pickType !== "moneyline") {
      return null;
    }

    return pick;
  }

  /**
   * Parse an individual line element (fallback when no groups found)
   */
  function parseIndividualLine(lineEl, gameInfo) {
    const pick = {
      sport: gameInfo.sport,
      segment: "Full Game",
      status: "pending",
      date: gameInfo.date,
      time: gameInfo.time,
      game: gameInfo.game,
      awayTeam: gameInfo.awayTeam,
      homeTeam: gameInfo.homeTeam,
    };

    const lineText = lineEl.textContent.trim();

    // Try to parse the line text
    if (!lineText) return null;

    // Determine bet type and parse accordingly
    parseLineAndOdds(pick, lineText);

    if (!pick.pickType) return null;

    // Default to first team if we can't determine
    if (!pick.pickTeam) {
      pick.pickTeam = gameInfo.firstTeam || "Unknown";
    }

    return pick;
  }

  /**
   * Determine team index (0 = first/away, 1 = second/home)
   */
  function determineTeamIndex(play, defaultIndex) {
    // Check for data attributes
    const teamAttr =
      play.getAttribute("data-team") || play.getAttribute("data-index");
    if (teamAttr) {
      return parseInt(teamAttr) || 0;
    }

    // Check parent for position info
    const parent = play.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const position = siblings.indexOf(play);
      if (position !== -1) {
        return position % 2; // Alternates between 0 and 1
      }
    }

    return defaultIndex % 2;
  }

  /**
   * Determine over/under for team totals
   */
  function determineOverUnder(play, index) {
    const text = play.textContent.toLowerCase();
    if (text.includes("over") || text.includes("o ")) return "Over";
    if (text.includes("under") || text.includes("u ")) return "Under";

    // Alternates: even = Over, odd = Under
    return index % 2 === 0 ? "Over" : "Under";
  }

  /**
   * Format line value (ensure proper +/- prefix)
   */
  function formatLine(line) {
    if (!line) return "";
    line = line.trim();

    // If it's a total number without prefix (e.g., "220"), return as-is
    if (/^\d+\.?\d*$/.test(line)) return line;

    // Ensure +/- prefix for spreads
    if (/^[+-]/.test(line)) return line;
    if (/^\d/.test(line)) return "+" + line;

    return line;
  }

  /**
   * Format odds value (ensure proper format)
   */
  function formatOdds(odds) {
    if (!odds) return "-110";
    odds = odds.trim();

    // Remove any currency symbols
    odds = odds.replace(/[$€£]/g, "");

    // If just a number, assume negative
    if (/^\d+$/.test(odds)) {
      const num = parseInt(odds);
      return num >= 100 ? `-${num}` : `+${num}`;
    }

    // Already has +/-
    if (/^[+-]\d+/.test(odds)) return odds;

    return "-110"; // Default
  }

  /**
   * Detect sport from league name
   */
  function detectSportFromLeague(league) {
    const lower = league.toLowerCase();
    if (lower.includes("nba") || lower.includes("basketball")) return "NBA";
    if (lower.includes("nfl") || lower.includes("football")) return "NFL";
    if (
      lower.includes("ncaab") ||
      lower.includes("ncaam") ||
      lower.includes("college basketball")
    )
      return "NCAAB";
    if (lower.includes("ncaaf") || lower.includes("college football"))
      return "NCAAF";
    if (lower.includes("mlb") || lower.includes("baseball")) return "MLB";
    if (lower.includes("nhl") || lower.includes("hockey")) return "NHL";
    if (
      lower.includes("soccer") ||
      lower.includes("mls") ||
      lower.includes("premier")
    )
      return "Soccer";
    return "NBA"; // Default
  }

  /**
   * Detect sport from data attribute
   */
  function detectSportFromAttribute(attr) {
    const lower = attr.toLowerCase();
    if (lower.includes("nba")) return "NBA";
    if (lower.includes("nfl")) return "NFL";
    if (lower.includes("ncaab") || lower.includes("ncaam")) return "NCAAB";
    if (lower.includes("ncaaf")) return "NCAAF";
    if (lower.includes("mlb")) return "MLB";
    if (lower.includes("nhl")) return "NHL";
    return "NBA";
  }

  /**
   * Parse HTML from sportsbook bet slip tables
   * Enhanced to handle parlays, round robins, and multi-leg bets
   */
  function parseHTMLPicks(html) {
    const picks = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all bet rows
    const rows = doc.querySelectorAll("tr[data-ticket], tr.odd, tr.even");

    // Track seen tickets to avoid duplicates in round robins
    const seenLegs = new Set();

    rows.forEach((row) => {
      try {
        const ticketId = row.getAttribute("data-ticket") || "";

        // Check if this is a parlay/round robin row
        const parlayLabel = row.querySelector(".type-magic");
        const isParlayRow = parlayLabel !== null;

        if (isParlayRow) {
          // Parse parlay row - extract all legs
          const parlayType = parlayLabel.textContent.trim();
          const legs = row.querySelectorAll(".wager-simple");

          // Get the row's total risk/win (shared among all 2-leg combos in round robin)
          const rowRisk =
            parseFloat(
              row.querySelector("[data-risk]")?.getAttribute("data-risk"),
            ) || 0;
          const rowWin =
            parseFloat(
              row.querySelector("[data-win]")?.getAttribute("data-win"),
            ) || 0;

          legs.forEach((leg, legIdx) => {
            const legPick = parseParlayLeg(leg, ticketId, parlayType, legIdx);
            if (legPick) {
              // Create unique key for this leg to avoid duplicates
              const legKey = `${ticketId}_${legPick.pickTeam}_${legPick.line || "ML"}_${legPick.segment}`;

              if (!seenLegs.has(legKey)) {
                seenLegs.add(legKey);
                // Distribute risk/win proportionally across legs
                legPick.risk = Math.round(rowRisk / legs.length);
                legPick.win = Math.round(rowWin / legs.length);
                legPick.parlayId = ticketId;
                legPick.parlayType = parlayType;
                legPick.isParlay = true;
                picks.push(legPick);
              }
            }
          });
        } else {
          // Single bet row
          const pick = parseHTMLRow(row);
          if (pick) {
            pick.isParlay = false;
            picks.push(pick);
          }
        }
      } catch (e) {
        console.warn("Failed to parse HTML row:", e);
      }
    });

    return picks;
  }

  /**
   * Parse a single leg from a parlay/round robin wager
   */
  function parseParlayLeg(legEl, ticketId, parlayType, legIndex) {
    const pick = {
      sport: "NCAAB", // Default for college games
      segment: "Full Game",
      status: "pending",
    };

    // Get team name
    const teamEl = legEl.querySelector(".choosen");
    if (teamEl) {
      pick.pickTeam = teamEl.textContent.trim();
      // Check if it contains a "/" indicating a total bet on a game
      if (pick.pickTeam.includes("/")) {
        const parts = pick.pickTeam.split("/").map((s) => s.trim());
        pick.awayTeam = parts[0];
        pick.homeTeam = parts[1];
      }
    }

    // Get line/odds
    const lineEl = legEl.querySelector(".line-selected");
    if (lineEl) {
      const lineText = lineEl.textContent.trim();
      parseLineAndOdds(pick, lineText);
    }

    // Get period/segment
    const periodEl = legEl.querySelector(".period-description-s");
    if (periodEl) {
      const periodText = periodEl.textContent.trim().toLowerCase();
      if (periodText.includes("1st half") || periodText.includes("1h")) {
        pick.segment = "1st Half";
      } else if (periodText.includes("2nd half") || periodText.includes("2h")) {
        pick.segment = "2nd Half";
      }
    }

    // Detect sport from icon or team name
    const icon = legEl.querySelector("img.team-logo");
    if (icon) {
      const src = icon.getAttribute("src") || "";
      if (
        src.includes("NBA") ||
        src.includes("Spurs") ||
        src.includes("Knicks")
      ) {
        pick.sport = "NBA";
      }
    }

    // Check pick team name to infer sport
    if (pick.pickTeam) {
      const teamLower = pick.pickTeam.toLowerCase();
      if (
        teamLower.includes("spurs") ||
        teamLower.includes("knicks") ||
        teamLower.includes("lakers") ||
        teamLower.includes("celtics")
      ) {
        pick.sport = "NBA";
      }
    }

    // Get date from nearest sibling with date
    const dateCell = legEl.closest("tr")?.querySelector("td span");
    if (dateCell) {
      const dateText = dateCell.textContent.trim();
      const parsed = parseDateTimeString(dateText);
      if (parsed) {
        pick.date = parsed.date;
        pick.time = parsed.time;
      }
    }

    // Validate
    if (!pick.pickTeam || !pick.pickType) {
      return null;
    }

    return pick;
  }

  /**
   * Parse a single HTML table row from sportsbook
   */
  function parseHTMLRow(row) {
    const pick = {
      sport: "NBA",
      segment: "Full Game",
      status: "pending",
    };

    // Get accepted date/time
    const dateCell = row.querySelector("td span");
    if (dateCell) {
      const dateText = dateCell.textContent.trim();
      const parsed = parseDateTimeString(dateText);
      if (parsed) {
        pick.date = parsed.date;
        pick.time = parsed.time;
      }
    }

    // Get team name
    const teamEl = row.querySelector(".choosen");
    if (teamEl) {
      pick.pickTeam = teamEl.textContent.trim();
    }

    // Get line/odds - handle both spread and moneyline
    const lineEl = row.querySelector(".line-selected");
    if (lineEl) {
      const lineText = lineEl.textContent.trim();
      parseLineAndOdds(pick, lineText);
    }

    // Get period/segment
    const periodEl = row.querySelector(".period-description-s");
    if (periodEl) {
      const periodText = periodEl.textContent.trim().toLowerCase();
      if (periodText.includes("1st half") || periodText.includes("1h")) {
        pick.segment = "1st Half";
      } else if (periodText.includes("2nd half") || periodText.includes("2h")) {
        pick.segment = "2nd Half";
      } else if (
        periodText.includes("1st quarter") ||
        periodText.includes("q1") ||
        periodText.includes("1q")
      ) {
        pick.segment = "1st Quarter";
      }
    }

    // Get risk amount
    const riskEl = row.querySelector("[data-risk]");
    if (riskEl) {
      pick.risk = parseFloat(riskEl.getAttribute("data-risk")) || 0;
    } else {
      const riskText = row.querySelector(".risk-col span");
      if (riskText) {
        pick.risk = parseCurrency(riskText.textContent);
      }
    }

    // Get win amount
    const winEl = row.querySelector("[data-win]");
    if (winEl) {
      pick.win = parseFloat(winEl.getAttribute("data-win")) || 0;
    } else {
      const winText = row.querySelector(".win-col span");
      if (winText) {
        pick.win = parseCurrency(winText.textContent);
      }
    }

    // Get game info from hidden details
    const gameEl = row.querySelector(".d-r");
    if (gameEl) {
      const gameText = gameEl.textContent;
      if (
        gameText.includes("/") ||
        gameText.includes(" vs ") ||
        gameText.includes(" @ ")
      ) {
        pick.game = gameText.trim();
        const teams = parseGameString(gameText);
        if (teams) {
          pick.awayTeam = teams.away;
          pick.homeTeam = teams.home;
        }
      }
    }

    // Detect sport from selection info
    const selectionEl = row.querySelector(
      ".selection-S .d-r, .selection-M .d-r",
    );
    if (selectionEl) {
      const selText = selectionEl.textContent.toLowerCase();
      if (selText.includes("nba")) pick.sport = "NBA";
      else if (selText.includes("nfl")) pick.sport = "NFL";
      else if (selText.includes("ncaab") || selText.includes("ncaam"))
        pick.sport = "NCAAB";
      else if (selText.includes("ncaaf")) pick.sport = "NCAAF";
      else if (selText.includes("mlb")) pick.sport = "MLB";
      else if (selText.includes("nhl")) pick.sport = "NHL";
    }

    // Validate minimum fields
    if (!pick.pickTeam || !pick.pickType) {
      return null;
    }

    return pick;
  }

  /**
   * Parse line and odds from text like "+1½ -115" or "ML +115"
   */
  function parseLineAndOdds(pick, text) {
    // Convert fractions to decimals
    text = text.replace(/½/g, ".5").replace(/¼/g, ".25").replace(/¾/g, ".75");

    // Check for moneyline first
    if (/\bML\b/i.test(text)) {
      pick.pickType = "moneyline";
      // Extract odds after ML
      const oddsMatch = text.match(/ML\s*([+-]\d+)/i);
      if (oddsMatch) {
        pick.odds = oddsMatch[1];
      }
      return;
    }

    // Check for total (over/under)
    if (/\b(over|under|o|u)\s*(\d+\.?\d*)/i.test(text)) {
      const match = text.match(/\b(over|under|o|u)\s*(\d+\.?\d*)/i);
      pick.pickType = "total";
      pick.pickDirection = /over|o/i.test(match[1]) ? "Over" : "Under";
      pick.line = match[2];
      // Extract odds
      const oddsMatch = text.match(/([+-]\d{2,4})(?:\s|$)/);
      if (oddsMatch) {
        pick.odds = oddsMatch[1];
      }
      return;
    }

    // Otherwise it's a spread
    // Pattern: "+2.5 -110" or "-3 +105"
    const spreadMatch = text.match(/([+-]?\d+\.?\d*)\s+([+-]\d{2,4})/);
    if (spreadMatch) {
      pick.pickType = "spread";
      pick.line =
        spreadMatch[1].startsWith("+") || spreadMatch[1].startsWith("-")
          ? spreadMatch[1]
          : "+" + spreadMatch[1];
      pick.odds = spreadMatch[2];
      return;
    }

    // Just a line without odds
    const lineOnly = text.match(/([+-]?\d+\.?\d*)/);
    if (lineOnly) {
      pick.pickType = "spread";
      pick.line =
        lineOnly[1].startsWith("+") || lineOnly[1].startsWith("-")
          ? lineOnly[1]
          : "+" + lineOnly[1];
    }
  }

  /**
   * Parse text-based picks - SMART INTUITIVE PARSER
   * Handles any reasonable format:
   *   "POR +7"
   *   "bills fg -3; bills over 44.5"
   *   "bills ml 1h; bills -2.5 1h"
   *   "bills o10 tto 1h"
   *   "BOS @ POR under 117.5"
   *   "1H POR +3.5"
   *   "under 220"
   */
  function parseTextPicks(text) {
    const picks = [];

    // Split on newlines, semicolons, and periods (but not decimal points)
    const rawLines = text
      .replace(/;/g, "\n")
      .replace(/\.\s+/g, "\n") // Period followed by space = new line
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let currentSport = "NBA";
    let currentGame = null;

    for (const line of rawLines) {
      // ===== PIPE-DELIMITED FORMAT =====
      // Format: "Team1 vs Team2 | Full Game | Pick Line (Odds)"
      // Example: "Memphis vs FAU | Full Game | FAU -2 (-110)"
      if (line.includes("|")) {
        const pipePick = parsePipeDelimitedLine(line);
        if (pipePick) {
          // Ensure sport is uppercase
          if (pipePick.sport) pipePick.sport = pipePick.sport.toUpperCase();
          picks.push(pipePick);
          continue;
        }
      }

      // Check for sport/game context
      const contextInfo = extractContext(line);
      if (contextInfo.sport) currentSport = contextInfo.sport.toUpperCase();
      if (contextInfo.game) currentGame = contextInfo.game;

      // Skip if it's just a context line (no bet info)
      if (contextInfo.isContextOnly) continue;

      const pick = parseFlexibleLine(line, currentSport, currentGame);
      if (pick) {
        picks.push(pick);
      }
    }

    // Normalize all picks for consistency
    const normalizedPicks = picks.map((pick) => ({
      ...pick,
      sport: (pick.sport || "NBA").toUpperCase(),
      league: (pick.league || pick.sport || "NBA").toUpperCase(),
      pickDirection: pick.pickDirection
        ? pick.pickDirection.replace(/^UNDE\b/i, "UNDER").toUpperCase()
        : "",
      pickType: (pick.pickType || "spread").toLowerCase(),
    }));

    console.log(`📊 Parsed ${normalizedPicks.length} picks from text input`);
    return normalizedPicks;
  }

  /**
   * Extract context (sport, game) from a line
   */
  function extractContext(line) {
    const lower = line.toLowerCase();
    const result = { sport: null, game: null, isContextOnly: false };

    // Detect sport - ALWAYS uppercase
    if (/\bnfl\b/i.test(lower)) result.sport = "NFL";
    else if (/\bnba\b/i.test(lower)) result.sport = "NBA";
    else if (/\bncaab\b|\bncaam\b|\bcbb\b/i.test(lower)) result.sport = "NCAAB";
    else if (/\bncaaf\b|\bcfb\b/i.test(lower)) result.sport = "NCAAF";
    else if (/\bmlb\b/i.test(lower)) result.sport = "MLB";
    else if (/\bnhl\b/i.test(lower)) result.sport = "NHL";

    // Detect game matchup (eagles at bills, bos @ por, etc.)
    const gameMatch = line.match(
      /\b([A-Za-z]+)\s*(?:at|@|vs\.?|versus)\s*([A-Za-z]+)\b/i,
    );
    if (gameMatch) {
      result.game = {
        away: resolveTeamName(gameMatch[1]),
        home: resolveTeamName(gameMatch[2]),
      };
    }

    // Check if this line is ONLY context (no numbers = no bet)
    if (!line.match(/\d/) && (result.sport || result.game)) {
      result.isContextOnly = true;
    }

    return result;
  }

  /**
   * Smart flexible parser - handles any format intuitively
   */
  function parseFlexibleLine(line, defaultSport, currentGame) {
    // Normalize default sport to uppercase
    const normalizedSport = (defaultSport || "NBA").toUpperCase();
    const pick = {
      sport: normalizedSport,
      league: normalizedSport,
      segment: "Full Game",
      status: "pending",
      date: getTodayDate(),
      gameDate: new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      gameTime: "TBD",
    };

    // Apply game context if available
    if (currentGame) {
      pick.awayTeam = currentGame.away;
      pick.homeTeam = currentGame.home;
      pick.game = `${currentGame.away} @ ${currentGame.home}`;
    }

    // Normalize: remove extra spaces, handle slashes as spaces
    let normalized = line
      .replace(/\s*\/\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const originalLine = normalized;

    // ===== STEP 1: Extract segment (1H, 2H, FG, 1st half, etc.) =====
    const segmentPatterns = [
      { pattern: /\b(1st\s*half|first\s*half|1h)\b/i, segment: "1st Half" },
      { pattern: /\b(2nd\s*half|second\s*half|2h)\b/i, segment: "2nd Half" },
      {
        pattern: /\b(1st\s*quarter|first\s*quarter|1q)\b/i,
        segment: "1st Quarter",
      },
      { pattern: /\b(full\s*game|fg)\b/i, segment: "Full Game" },
    ];

    for (const { pattern, segment } of segmentPatterns) {
      if (pattern.test(normalized)) {
        pick.segment = segment;
        normalized = normalized.replace(pattern, " ").trim();
        break;
      }
    }

    // ===== STEP 2: Check for MONEYLINE (ml) =====
    if (/\bml\b/i.test(normalized)) {
      pick.pickType = "moneyline";
      normalized = normalized.replace(/\bml\b/gi, " ").trim();

      // Find the team
      const teamKeys = Object.keys(TEAM_ALIASES);
      for (const teamKey of teamKeys) {
        const teamRegex = new RegExp(`\\b${teamKey}\\b`, "i");
        if (teamRegex.test(normalized)) {
          pick.pickTeam = resolveTeamName(teamKey);
          break;
        }
      }

      // Extract odds if present
      const oddsMatch = normalized.match(/([+-]\d{3,4})/);
      if (oddsMatch) pick.odds = oddsMatch[1];

      if (pick.pickTeam) {
        console.log(
          `✅ Parsed ML: "${originalLine}" -> ${pick.pickTeam} ML (${pick.segment})`,
        );
        return pick;
      }
    }

    // ===== STEP 3: Check for TEAM TOTAL (tto/ttu or "team o/u") =====
    const teamTotalMatch =
      normalized.match(/\b([A-Za-z]+)\s*(?:tto|ttu|o|u)\s*([\d.]+)/i) ||
      normalized.match(/\b([A-Za-z]+)\s+(?:over|under)\s*([\d.]+)/i);
    if (teamTotalMatch) {
      const teamPart = teamTotalMatch[1].toLowerCase();
      const linePart = teamTotalMatch[2];
      const fullMatch = teamTotalMatch[0].toLowerCase();

      // Check if it's actually a team (not "over" or "under")
      if (
        teamPart !== "over" &&
        teamPart !== "under" &&
        teamPart !== "o" &&
        teamPart !== "u"
      ) {
        pick.pickType = "team-total";
        pick.pickTeam = resolveTeamName(teamPart);
        pick.line = linePart;

        // Determine over/under
        if (/tto|over|\bo\d/i.test(fullMatch)) {
          pick.pickDirection = "Over";
        } else {
          pick.pickDirection = "Under";
        }

        console.log(
          `✅ Parsed team total: "${originalLine}" -> ${pick.pickTeam} ${pick.pickDirection} ${pick.line} (${pick.segment})`,
        );
        return pick;
      }
    }

    // ===== STEP 4: Detect GAME TOTAL (over/under without team prefix) =====
    const gameTotalMatch = normalized.match(/\b(over|under|o|u)\s*([\d.]+)/i);
    if (gameTotalMatch) {
      pick.pickType = "total";
      pick.pickDirection = /^(over|o)$/i.test(gameTotalMatch[1])
        ? "Over"
        : "Under";
      pick.pickTeam = pick.pickDirection;
      pick.line = gameTotalMatch[2];

      // Extract odds if present
      const oddsMatch = normalized.match(/([+-]\d{3,4})/);
      if (oddsMatch) pick.odds = oddsMatch[1];

      console.log(
        `✅ Parsed game total: "${originalLine}" -> ${pick.pickDirection} ${pick.line}`,
      );
      return pick;
    }

    // Remove remaining keywords
    normalized = normalized
      .replace(/\b(spread|total|moneyline)\b/gi, " ")
      .trim();

    // ===== STEP 5: Find team and spread =====
    const teamKeys = Object.keys(TEAM_ALIASES);
    let foundTeam = null;
    let foundTeamPos = -1;

    for (const teamKey of teamKeys) {
      const teamRegex = new RegExp(`\\b${teamKey}\\b`, "i");
      const match = normalized.match(teamRegex);
      if (match) {
        const pos = match.index;
        if (foundTeamPos === -1 || pos < foundTeamPos) {
          foundTeam = teamKey;
          foundTeamPos = pos;
        }
      }
    }

    if (!foundTeam) {
      // Try to find any capitalized word that might be a team
      const capsMatch = normalized.match(/\b([A-Z]{2,4})\b/);
      if (capsMatch) {
        foundTeam = capsMatch[1].toLowerCase();
      }
    }

    if (!foundTeam) {
      console.log(`⚠️ No team found in: "${originalLine}"`);
      return null;
    }

    pick.pickTeam = resolveTeamName(foundTeam);

    // ===== STEP 4: Find the line (spread) =====
    // Look for +/- number patterns
    const spreadPatterns = [
      /([+-]?\d+\.?\d*)\s*([+-]\d{3,4})?/, // "+7.0 -110" or "+7" or "7.0"
    ];

    // Find all numbers in the line
    const numbers = normalized.match(/[+-]?\d+\.?\d*/g) || [];

    for (const num of numbers) {
      const numVal = parseFloat(num);

      // Skip if it looks like odds (100+ with sign)
      if (
        Math.abs(numVal) >= 100 &&
        (num.startsWith("+") || num.startsWith("-"))
      ) {
        // This is likely odds, not a spread
        pick.odds = num;
        continue;
      }

      // This is likely a spread
      if (!pick.line) {
        pick.pickType = "spread";
        pick.line =
          num.startsWith("+") || num.startsWith("-") ? num : `+${num}`;
      }
    }

    // If no spread found but we have a team, might be ML
    if (!pick.line && pick.pickTeam) {
      // Check if there's just odds (moneyline)
      const mlOdds = normalized.match(/([+-]\d{3,4})/);
      if (mlOdds) {
        pick.pickType = "moneyline";
        pick.odds = mlOdds[1];
      } else {
        // Just a team name with no line - invalid
        console.log(`⚠️ No line/odds found for team in: "${originalLine}"`);
        return null;
      }
    }

    // ===== STEP 5: Try to find game context (opponent) =====
    const vsMatch = normalized.match(/([A-Za-z]+)\s*[@vs]+\s*([A-Za-z]+)/i);
    if (vsMatch) {
      pick.awayTeam = resolveTeamName(vsMatch[1]);
      pick.homeTeam = resolveTeamName(vsMatch[2]);
      pick.game = `${pick.awayTeam} @ ${pick.homeTeam}`;
    }

    console.log(
      `✅ Parsed: "${originalLine}" -> ${pick.pickTeam} ${pick.line || pick.odds} (${pick.segment})`,
    );
    return pick;
  }

  /**
   * Parse pipe-delimited format: "Team1 vs Team2 | Full Game | Pick Line (Odds)"
   * Examples:
   *   "Memphis vs FAU | Full Game | FAU -2 (-110)"
   *   "Siena vs Mount St Marys | Full Game | Siena -3 (-110)"
   *   "UAB vs East Carolina | Full Game | UAB -7.5 (-110)"
   *   "IPFW vs Robert Morris | Full Game | IPFW +4 (-110)"
   *   "Northern Kentucky vs Wisc Green Bay | Full Game | N Kentucky -4 (-110)"
   */
  function parsePipeDelimitedLine(line) {
    const parts = line.split("|").map((p) => p.trim());

    if (parts.length < 3) return null;

    const [matchupPart, segmentPart, pickPart] = parts;

    // Parse matchup (Team1 vs Team2)
    const matchupMatch = matchupPart.match(
      /^(.+?)\s*(?:vs\.?|@|versus)\s*(.+)$/i,
    );
    if (!matchupMatch) return null;

    const awayTeam = matchupMatch[1].trim();
    const homeTeam = matchupMatch[2].trim();

    // Parse segment
    let segment = "Full Game";
    const segLower = segmentPart.toLowerCase();
    if (segLower.includes("1st half") || segLower.includes("1h")) {
      segment = "1st Half";
    } else if (segLower.includes("2nd half") || segLower.includes("2h")) {
      segment = "2nd Half";
    } else if (segLower.includes("1st quarter") || segLower.includes("1q")) {
      segment = "1st Quarter";
    }

    // Parse pick part: "FAU -2 (-110)" or "Over 150 (-110)" or "FAU ML (-110)"
    const pick = {
      sport: "NCAAB", // Default for college basketball
      segment: segment,
      status: "pending",
      date: getTodayDate(),
      gameDate: new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      gameTime: "TBD",
      awayTeam: awayTeam,
      homeTeam: homeTeam,
      game: `${awayTeam} @ ${homeTeam}`,
    };

    // Extract odds (in parentheses at end)
    const oddsMatch = pickPart.match(/\(([+-]?\d+)\)\s*$/);
    if (oddsMatch) {
      pick.odds =
        oddsMatch[1].startsWith("+") || oddsMatch[1].startsWith("-")
          ? oddsMatch[1]
          : `-${oddsMatch[1]}`;
    }

    // Remove odds from pick part for further parsing
    let pickText = pickPart.replace(/\s*\([+-]?\d+\)\s*$/, "").trim();

    // Check for game total (Over/Under)
    const totalMatch = pickText.match(/^(over|under|o|u)\s+(\d+\.?\d*)/i);
    if (totalMatch) {
      pick.pickType = "total";
      pick.pickDirection = /^(over|o)$/i.test(totalMatch[1]) ? "Over" : "Under";
      pick.pickTeam = pick.pickDirection;
      pick.line = totalMatch[2];
      console.log(
        `✅ Parsed pipe format (total): "${line}" -> ${pick.pickDirection} ${pick.line}`,
      );
      return pick;
    }

    // Check for moneyline (Team ML)
    const mlMatch = pickText.match(/^(.+?)\s+ml$/i);
    if (mlMatch) {
      pick.pickType = "moneyline";
      pick.pickTeam = mlMatch[1].trim();
      console.log(
        `✅ Parsed pipe format (ML): "${line}" -> ${pick.pickTeam} ML`,
      );
      return pick;
    }

    // Default: Spread (Team +/- Line)
    const spreadMatch = pickText.match(/^(.+?)\s+([+-]?\d+\.?\d*)$/);
    if (spreadMatch) {
      pick.pickType = "spread";
      pick.pickTeam = spreadMatch[1].trim();
      const lineVal = spreadMatch[2];
      pick.line =
        lineVal.startsWith("+") || lineVal.startsWith("-")
          ? lineVal
          : `+${lineVal}`;
      console.log(
        `✅ Parsed pipe format (spread): "${line}" -> ${pick.pickTeam} ${pick.line}`,
      );
      return pick;
    }

    // Couldn't parse the pick part
    console.log(`⚠️ Could not parse pipe-delimited pick: "${pickPart}"`);
    return null;
  }

  /**
   * Parse a single line of text picks (legacy function - kept for fallback)
   */
  function parseTextLine(line, defaultSport, defaultGame) {
    const pick = {
      sport: defaultSport,
      segment: "Full Game",
      status: "pending",
      date: getTodayDate(),
    };

    // Check for segment markers first
    if (/\b1h\b/i.test(line)) {
      pick.segment = "1st Half";
      line = line.replace(/\b1h\b/i, "").trim();
    } else if (/\b2h\b/i.test(line)) {
      pick.segment = "2nd Half";
      line = line.replace(/\b2h\b/i, "").trim();
    } else if (/\b1q\b/i.test(line)) {
      pick.segment = "1st Quarter";
      line = line.replace(/\b1q\b/i, "").trim();
    }

    // Extract risk amount (at end: $50, $100, etc.)
    const riskMatch = line.match(/\$(\d+(?:\.\d+)?)\s*$/);
    if (riskMatch) {
      pick.risk = parseFloat(riskMatch[1]) * unitMultiplier;
      line = line.replace(/\$\d+(?:\.\d+)?\s*$/, "").trim();
    }

    // Now parse the bet itself
    // Pattern 1: "Team SPREAD ODDS" (e.g., "Spurs 2.5 -105")
    // Pattern 2: "Team ODDS" (e.g., "Spurs +118" = ML)
    // Pattern 3: "Team ML ODDS" (e.g., "Spurs ML +118")
    // Pattern 4: "Over/Under LINE ODDS" (e.g., "Over 220 -110")

    // FIRST: Check if line starts with Over/Under (game total without team context)
    // This must be checked BEFORE team extraction to avoid "Over" being captured as a team
    const standaloneTotal = line.match(
      /^(over|under|o|u)\s+(\d+\.?\d*)\s*([+-]\d{2,4})?/i,
    );
    if (standaloneTotal) {
      pick.pickType = "total";
      pick.pickDirection = /over|o/i.test(standaloneTotal[1])
        ? "Over"
        : "Under";
      pick.pickTeam = pick.pickDirection; // Set pickTeam to direction for display
      pick.line = standaloneTotal[2];
      if (standaloneTotal[3]) {
        pick.odds = standaloneTotal[3];
      }

      // Calculate win and return early
      if (pick.risk && pick.odds) {
        pick.win = calculateWin(pick.risk, pick.odds);
      }
      if (defaultGame) {
        pick.game = defaultGame;
      }
      return pick;
    }

    // Find the team name (at the start)
    const teamMatch = line.match(
      /^([A-Za-z][A-Za-z\s]*?)(?=\s+[\d+-]|\s+ML|\s+over|\s+under|\s*$)/i,
    );

    if (!teamMatch) {
      return null;
    }

    const teamName = teamMatch[1].trim();
    pick.pickTeam = resolveTeamName(teamName);

    // Remove team name from line
    let remainder = line.substring(teamMatch[0].length).trim();

    // Check for explicit ML
    if (/^ML\s*/i.test(remainder)) {
      pick.pickType = "moneyline";
      remainder = remainder.replace(/^ML\s*/i, "").trim();

      // Get odds
      const oddsMatch = remainder.match(/^([+-]\d{2,4})/);
      if (oddsMatch) {
        pick.odds = oddsMatch[1];
      }
    }
    // Check for team total (e.g., "Spurs over 110 -115")
    else if (/^(over|under|o|u)\s*/i.test(remainder)) {
      pick.pickType = "team-total";
      const totalMatch = remainder.match(
        /^(over|under|o|u)\s*(\d+\.?\d*)\s*([+-]\d{2,4})?/i,
      );
      if (totalMatch) {
        pick.pickDirection = /over|o/i.test(totalMatch[1]) ? "Over" : "Under";
        pick.line = totalMatch[2];
        if (totalMatch[3]) {
          pick.odds = totalMatch[3];
        }
      }
    }
    // Check for spread with odds: "2.5 -105" or moneyline odds only: "+118"
    else if (/^\d/.test(remainder) || /^[+-]\d/.test(remainder)) {
      // Determine if it's:
      // - Spread with odds: "2.5 -105" or "+3.5 -110"
      // - Spread only: "2.5" or "+3"
      // - Moneyline (odds only): "+118" or "-150"

      // Key insight: ML odds are typically 100+ (3+ digits after the sign)
      // Spreads are typically under 100 and often have decimals

      // Pattern: Check if it starts with +/- and has 3+ digits (100+) = likely ML odds
      const mlOddsMatch = remainder.match(/^([+-])(\d+)(?:\s|$)/);

      if (mlOddsMatch) {
        const sign = mlOddsMatch[1];
        const number = mlOddsMatch[2];
        const numValue = parseInt(number);

        // If number is 100 or higher, it's almost certainly ML odds
        // If it's a single or double digit number, it's a spread
        if (numValue >= 100) {
          pick.pickType = "moneyline";
          pick.odds = sign + number;
        } else {
          // It's a spread (like +3 or -7)
          pick.pickType = "spread";
          pick.line = sign + number;
          // Check for odds after the spread
          const afterSpread = remainder.substring(mlOddsMatch[0].length).trim();
          const oddsAfter = afterSpread.match(/^([+-]\d{2,4})/);
          if (oddsAfter) {
            pick.odds = oddsAfter[1];
          }
        }
      } else {
        // Doesn't start with +/-, so it's a spread starting with just a number (like "2.5 -105")
        pick.pickType = "spread";
        const spreadMatch = remainder.match(/^(\d+\.?\d*)\s*([+-]\d{2,4})?/);
        if (spreadMatch) {
          pick.line = "+" + spreadMatch[1]; // Assume positive spread
          if (spreadMatch[2]) {
            pick.odds = spreadMatch[2];
          }
        }
      }
    }

    // Calculate win amount if we have risk and odds
    if (pick.risk && pick.odds) {
      pick.win = calculateWin(pick.risk, pick.odds);
    }

    // Set game context if available
    if (defaultGame) {
      pick.game = defaultGame;
    }

    // Validate
    if (!pick.pickType) {
      return null;
    }

    return pick;
  }

  /**
   * Determine if a line should be skipped
   */
  function shouldSkipLine(line) {
    const lower = line.toLowerCase();

    // Skip empty or very short lines
    if (line.length < 3) return true;

    // Skip common header/context phrases
    const skipPatterns = [
      /^tonight['']?s?\s+game/i,
      /^today['']?s?\s+game/i,
      /^correction/i,
      /^note:/i,
      /^fyi/i,
      /^\d+k\s+is\s+the\s+unit/i,
      /^unit/i,
      /^\^+/, // Lines starting with ^
    ];

    return skipPatterns.some((p) => p.test(line));
  }

  /**
   * Extract context info from header lines
   */
  function updateContextFromLine(line, callback) {
    const lower = line.toLowerCase();
    const ctx = {};

    // Detect sport
    if (lower.includes("nba")) ctx.sport = "NBA";
    else if (lower.includes("nfl")) ctx.sport = "NFL";
    else if (lower.includes("ncaab") || lower.includes("ncaam"))
      ctx.sport = "NCAAB";
    else if (lower.includes("ncaaf")) ctx.sport = "NCAAF";
    else if (lower.includes("mlb")) ctx.sport = "MLB";
    else if (lower.includes("nhl")) ctx.sport = "NHL";

    // Detect game matchup
    const gameMatch = line.match(
      /([A-Za-z\s]+)\s*(?:vs\.?|@|\/)\s*([A-Za-z\s]+)/i,
    );
    if (gameMatch) {
      ctx.game = `${gameMatch[1].trim()} @ ${gameMatch[2].trim()}`;
    }

    callback(ctx);
  }

  /**
   * Resolve team alias to full name
   */
  function resolveTeamName(name) {
    const lower = name.toLowerCase().trim();
    return TEAM_ALIASES[lower] || name;
  }

  /**
   * Parse currency string to number
   */
  function parseCurrency(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[$,]/g, "");
    return parseFloat(cleaned) || 0;
  }

  /**
   * Parse date/time string
   */
  function parseDateTimeString(text) {
    // Format: "Dec 16, 2025 3:53 PM"
    const match = text.match(/(\w+\s+\d+,?\s+\d{4})\s+(\d+:\d+\s*[AP]M)/i);
    if (match) {
      return {
        date: match[1].trim(),
        time: match[2].trim(),
      };
    }
    return null;
  }

  /**
   * Parse game string to away/home teams
   */
  function parseGameString(text) {
    const match = text.match(/(.+?)\s*(?:\/|vs\.?|@)\s*(.+)/i);
    if (match) {
      return {
        away: match[1].trim(),
        home: match[2].trim(),
      };
    }
    return null;
  }

  /**
   * Calculate win amount from risk and odds
   */
  function calculateWin(risk, odds) {
    const oddsNum = parseInt(odds);
    if (oddsNum > 0) {
      // Positive odds: win = risk * (odds/100)
      return risk * (oddsNum / 100);
    } else {
      // Negative odds: win = risk / (|odds|/100)
      return risk / (Math.abs(oddsNum) / 100);
    }
  }

  /**
   * Get today's date in MM/DD/YYYY format
   */
  function getTodayDate() {
    const now = new Date();
    return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  }

  /**
   * Convert picks to display format for the dashboard
   */
  function picksToDisplayFormat(picks) {
    return picks.map((pick) => {
      // Build selection string
      let selection = "";
      if (pick.pickType === "spread") {
        selection = `${pick.pickTeam} ${pick.line}`;
      } else if (pick.pickType === "moneyline") {
        selection = `${pick.pickTeam} ML`;
      } else if (pick.pickType === "total") {
        selection = `${pick.pickDirection || pick.pickTeam} ${pick.line}`;
      } else if (pick.pickType === "team-total") {
        selection = `${pick.pickTeam} ${pick.pickDirection} ${pick.line}`;
      }

      if (pick.odds) {
        selection += ` (${pick.odds})`;
      }

      return {
        ...pick,
        selection,
        displaySegment: pick.segment !== "Full Game" ? pick.segment : "",
        displayRisk: pick.risk ? `$${pick.risk.toLocaleString()}` : "",
        displayWin: pick.win ? `$${Math.round(pick.win).toLocaleString()}` : "",
      };
    });
  }

  /**
   * Convert picks to CSV format
   */
  function picksToCSV(picks) {
    const headers = [
      "Date",
      "Time",
      "Sport",
      "Game",
      "Team",
      "Pick Type",
      "Line",
      "Odds",
      "Segment",
      "Risk",
      "To Win",
      "Status",
    ];
    const rows = picks.map((pick) => [
      pick.date || "",
      pick.time || "",
      pick.sport || "",
      pick.game || "",
      pick.pickTeam || "",
      pick.pickType || "",
      pick.line || "",
      pick.odds || "",
      pick.segment || "",
      pick.risk || "",
      pick.win ? Math.round(pick.win) : "",
      pick.status || "pending",
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  }

  /**
   * Set the unit multiplier for risk calculations
   */
  function setUnitMultiplier(multiplier) {
    unitMultiplier = multiplier;
  }

  // Export functions
  window.PickStandardizer = {
    standardize: standardizePicks,
    parseHTML: parseHTMLPicks,
    parseGameLines: parseSportsbookGameLines,
    parseText: parseTextPicks,
    parseBetHistory: parseBetHistory,
    loadTeamVariants: loadTeamVariants,
    toDisplayFormat: picksToDisplayFormat,
    toCSV: picksToCSV,
    setUnitMultiplier: setUnitMultiplier,
    resolveTeamName: resolveTeamName,

    // For testing
    _parseTextLine: parseTextLine,
    _parseLineAndOdds: parseLineAndOdds,
    _parseGamePanel: parseGamePanel,
    _isBetHistoryFormat: isBetHistoryFormat,
    _parseBetHistoryLeg: parseBetHistoryLeg,
  };

  console.log(
    "✅ PickStandardizer v3.1 loaded — 362 NCAAM teams + bet-history parser",
  );
})();
