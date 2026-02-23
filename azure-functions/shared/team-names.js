/**
 * Canonical team name mapping for pick-to-game matching.
 * Ported from tracker_pnl/grade_picks.py _TEAM_MAP.
 */

const TEAM_MAP = new Map();

function add(canonical, ...aliases) {
  TEAM_MAP.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) {
    TEAM_MAP.set(alias.toLowerCase(), canonical);
  }
}

// ── NBA (30 teams) ──
add("Atlanta Hawks", "hawks", "atlanta");
add("Boston Celtics", "celtics", "boston");
add("Brooklyn Nets", "nets", "brooklyn", "brooklyn nets");
add("Charlotte Hornets", "hornets", "charlotte", "charlotta", "char");
add("Chicago Bulls", "bulls");
add("Cleveland Cavaliers", "cavaliers", "cavs", "cleveland");
add("Dallas Mavericks", "mavericks", "mavs", "dallas");
add("Denver Nuggets", "nuggets");
add("Detroit Pistons", "pistons");
add("Golden State Warriors", "warriors", "golden state", "gsw");
add("Houston Rockets", "rockets", "hou");
add("Indiana Pacers", "pacers", "indiana");
add("Los Angeles Lakers", "lakers", "la lakers", "laker");
add("Los Angeles Clippers", "clippers", "la clippers", "clipper");
add("Memphis Grizzlies", "grizzlies", "memphis grizzlies");
add("Miami Heat", "heat");
add("Milwaukee Bucks", "bucks", "milwaukee", "milw");
add("Minnesota Timberwolves", "timberwolves", "wolves", "minnesota timberwolves");
add("New Orleans Pelicans", "pelicans", "new orleans pelicans");
add("New York Knicks", "knicks", "new york knicks");
add("Oklahoma City Thunder", "thunder", "okc");
add("Orlando Magic", "magic", "orlando");
add("Philadelphia 76ers", "76ers", "sixers");
add("Phoenix Suns", "suns", "phoenix");
add("Portland Trail Blazers", "trail blazers", "blazers", "portland");
add("Sacramento Kings", "kings", "sacramento");
add("San Antonio Spurs", "spurs", "san antonio");
add("Toronto Raptors", "raptors", "toronto");
add("Utah Jazz", "jazz", "utah");
add("Washington Wizards", "wizards");

// ── NFL (32 teams) ──
add("Philadelphia Eagles", "eagles");
add("Kansas City Chiefs", "chiefs");
add("Buffalo Bills", "bills");
add("Baltimore Ravens", "ravens");
add("Detroit Lions", "lions");
add("Dallas Cowboys", "cowboys");
add("San Francisco 49ers", "49ers", "niners");
add("Green Bay Packers", "packers", "green bay");
add("Minnesota Vikings", "vikings");
add("Cincinnati Bengals", "bengals");
add("Pittsburgh Steelers", "steelers");
add("Los Angeles Chargers", "chargers");
add("Denver Broncos", "broncos");
add("Seattle Seahawks", "seahawks");
add("Chicago Bears", "bears");
add("Houston Texans", "texans");
add("Indianapolis Colts", "colts");
add("Tennessee Titans", "titans");
add("Jacksonville Jaguars", "jaguars", "jags", "jgs");
add("Cleveland Browns", "browns");
add("Las Vegas Raiders", "raiders");
add("New Orleans Saints", "saints");
add("Atlanta Falcons", "falcons");
add("Carolina Panthers", "panthers");
add("Tampa Bay Buccaneers", "buccaneers", "bucs");
add("Arizona Cardinals", "cardinals");
add("Los Angeles Rams", "rams");
add("New York Giants", "giants");
add("New York Jets", "jets");
add("New England Patriots", "patriots");
add("Miami Dolphins", "dolphins");
add("Washington Commanders", "commanders");

// ── NCAAF common ──
add("Army", "army black knights");
add("Navy", "navy midshipmen", "midshipmen");
add("Ohio State", "ohio st", "buckeyes");
add("Alabama", "bama", "crimson tide");
add("Texas", "longhorns");
add("Georgia", "bulldogs");
add("Penn State", "penn st", "nittany lions");
add("Clemson", "tigers");
add("Florida", "gators");
add("Florida State", "seminoles", "fsu");
add("Michigan", "wolverines");
add("Michigan State", "spartans", "msu");
add("Oregon", "ducks");
add("USC", "trojans");
add("UCLA", "bruins");
add("Boise State", "boise st");
add("Notre Dame", "fighting irish");
add("Colorado", "buffaloes", "buffs");
add("Iowa", "hawkeyes");
add("Wisconsin", "badgers");
add("Ole Miss", "rebels");
add("Auburn", "war eagle");
add("LSU", "louisiana state", "lsu tigers");
add("Tennessee", "vols", "volunteers");
add("South Carolina", "gamecocks");
add("Missouri", "mizzou");
add("Arizona State", "sun devils", "asu");
add("SMU", "southern methodist", "mustangs");
add("BYU", "brigham young", "cougars");
add("Louisville", "cardinals");
add("Tulane", "green wave");
add("Memphis", "memphis tigers");
add("UNLV", "rebels");
add("Texas Tech", "red raiders");
add("Nebraska", "cornhuskers", "huskers");
add("Purdue", "boilermakers");
add("Illinois", "fighting illini");
add("Northwestern", "wildcats");
add("NC State", "nc state wolfpack", "north carolina state");
add("North Carolina", "tar heels", "unc");
add("Stanford", "cardinal", "stanf");
add("Utah State", "aggies");
add("Fresno State", "fresno st", "fresno state bulldogs");
add("West Virginia", "mountaineers", "wvu");
add("Kansas", "jayhawks");
add("Kentucky", "wildcats");
add("Texas A&M", "texas a&m aggies", "tamu");

// ── NCAAM common ──
add("Gonzaga", "gonzaga bulldogs", "gonz");
add("Duke", "blue devils");
add("UConn", "connecticut", "huskies");
add("Pepperdine", "pepperdine waves", "waves", "pepp");
add("South Dakota State", "sd state", "south dakota st", "jackrabbits");
add("San Diego State", "san diego st", "sdsu", "aztecs");
add("Arizona", "wildcats");
add("Marquette", "golden eagles", "marq");
add("Villanova", "wildcats");
add("Creighton", "bluejays");
add("Xavier", "musketeers");
add("Dayton", "flyers");
add("St. John's", "st johns", "saint johns", "red storm");
add("Providence", "friars");
add("Seton Hall", "pirates", "seton");
add("Butler", "bulldogs");
add("DePaul", "blue demons");
add("Georgetown", "hoyas");
add("Cal Baptist", "california baptist", "lancers");
add("UC Riverside", "highlanders");
add("UMKC", "kansas city roos");
add("Wyoming", "cowboys");
add("Chattanooga", "mocs");
add("Tennessee State", "tn state");
add("Eastern Washington", "ewu");
add("Saint Mary's", "st marys", "saint marys", "gaels");
add("San Jose State", "spartans");
add("Florida Atlantic", "fau", "florida atlantic owls");
add("Florida International", "fiu", "fiu panthers");
add("Northern Kentucky", "nky", "northern kentucky norse");
add("Southern Miss", "s miss", "southern mississippi");
add("Norfolk State", "norfolk", "norfolk state spartans");
add("Old Dominion", "old dom", "old dominion monarchs");
add("Oregon State", "oregon st", "oregon state beavers");
add("Manhattan", "manhattan jaspers");
add("Towson", "towson tigers");
add("Youngstown State", "youngstown", "ysu");
add("Siena", "siena saints");
add("Santa Clara", "santa clara broncos");
add("UC Irvine", "irvine", "uc irvine anteaters", "uci");
add("UC Santa Barbara", "ucsb", "uc santa barbara gauchos");
add("Loyola Chicago", "loyola chicago ramblers");
add("Northern Iowa", "northern iowa panthers", "uni");
add("Harvard", "harvard crimson");
add("Brown", "brown bears");
add("Rider", "rider broncs");
add("Nevada", "nevada wolf pack");
add("Dartmouth", "dart", "dartmouth big green");
add("Weber State", "wst", "weber state wildcats");
add("UW-Milwaukee", "uw-mil", "milwaukee panthers");
add("Mississippi", "ole miss", "mississippi rebels");
add("North Dakota", "north dakota fighting hawks");

// ── NHL (32 teams) ──
add("Anaheim Ducks", "ducks", "anaheim");
add("Arizona Coyotes", "coyotes");
add("Boston Bruins", "bruins");
add("Buffalo Sabres", "sabres");
add("Calgary Flames", "flames", "calgary");
add("Carolina Hurricanes", "hurricanes", "canes");
add("Chicago Blackhawks", "blackhawks");
add("Colorado Avalanche", "avalanche", "avs");
add("Columbus Blue Jackets", "blue jackets", "columbus");
add("Dallas Stars", "stars");
add("Detroit Red Wings", "red wings");
add("Edmonton Oilers", "oilers", "edmonton");
add("Florida Panthers", "florida panthers");
add("Los Angeles Kings", "la kings");
add("Minnesota Wild", "wild");
add("Montreal Canadiens", "canadiens", "habs", "montreal");
add("Nashville Predators", "predators", "preds");
add("New Jersey Devils", "devils");
add("New York Islanders", "islanders");
add("New York Rangers", "rangers");
add("Ottawa Senators", "senators", "sens");
add("Philadelphia Flyers", "flyers");
add("Pittsburgh Penguins", "penguins", "pens");
add("San Jose Sharks", "sharks");
add("Seattle Kraken", "kraken");
add("St. Louis Blues", "blues", "st louis");
add("Tampa Bay Lightning", "lightning", "bolts");
add("Toronto Maple Leafs", "maple leafs", "leafs");
add("Utah Hockey Club", "utah hc");
add("Vancouver Canucks", "canucks", "vancouver");
add("Vegas Golden Knights", "golden knights", "vgk", "vegas");
add("Washington Capitals", "capitals", "caps");
add("Winnipeg Jets", "winnipeg jets");

/**
 * Resolve a team name to its canonical form.
 * @param {string} name - Raw team name
 * @returns {string} Canonical name or original if not found
 */
function resolveTeam(name) {
  if (!name) return "";
  const cleaned = name.trim();
  return TEAM_MAP.get(cleaned.toLowerCase()) || cleaned;
}

/**
 * Score how well two team names match (0-100).
 * @param {string} canonical - Resolved team name
 * @param {string} apiTeamName - Name from the score API
 * @returns {number} Match confidence (0-100)
 */
function teamMatchesScore(canonical, apiTeamName) {
  if (!canonical || !apiTeamName) return 0;
  const c = canonical.toLowerCase();
  const a = apiTeamName.toLowerCase();

  // Exact match
  if (c === a) return 100;

  // Substring match (one contains the other)
  if (c.includes(a) || a.includes(c)) return 90;

  // Word overlap matching
  const cWords = c.split(/\s+/).filter((w) => w.length > 2);
  const aWords = new Set(a.split(/\s+/));
  const matching = cWords.filter((w) => aWords.has(w));
  if (matching.length > 0) return 70 + matching.length * 5;

  return 0;
}

module.exports = { TEAM_MAP, add, resolveTeam, teamMatchesScore };
