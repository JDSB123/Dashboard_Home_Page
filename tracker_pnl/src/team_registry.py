"""
Comprehensive team registry for all major sports leagues.
Provides canonical team names, IDs, and extensive alias mappings.
"""

from typing import Dict, List, Optional, Set, Tuple


class TeamRegistry:
    """Central registry for team identification and normalization."""
    
    def __init__(self):
        self._init_nfl_teams()
        self._init_nba_teams()
        self._init_ncaaf_teams()
        self._init_ncaam_teams()
        self._build_reverse_mappings()
    
    def _init_nfl_teams(self):
        """Initialize NFL team data with extensive aliases."""
        self.nfl_teams = {
            "Arizona Cardinals": {
                "id": "ARI",
                "aliases": ["cardinals", "arizona", "ari", "az", "cards", "az cardinals"],
                "city": "Arizona",
                "mascot": "Cardinals"
            },
            "Atlanta Falcons": {
                "id": "ATL",
                "aliases": ["falcons", "atlanta", "atl", "dirty birds"],
                "city": "Atlanta",
                "mascot": "Falcons"
            },
            "Baltimore Ravens": {
                "id": "BAL",
                "aliases": ["ravens", "baltimore", "bal", "bmore"],
                "city": "Baltimore",
                "mascot": "Ravens"
            },
            "Buffalo Bills": {
                "id": "BUF",
                "aliases": ["bills", "buffalo", "buf"],
                "city": "Buffalo",
                "mascot": "Bills"
            },
            "Carolina Panthers": {
                "id": "CAR",
                "aliases": ["panthers", "carolina", "car"],
                "city": "Carolina",
                "mascot": "Panthers"
            },
            "Chicago Bears": {
                "id": "CHI",
                "aliases": ["bears", "chicago", "chi", "da bears"],
                "city": "Chicago",
                "mascot": "Bears"
            },
            "Cincinnati Bengals": {
                "id": "CIN",
                "aliases": ["bengals", "cincinnati", "cin", "cincy"],
                "city": "Cincinnati",
                "mascot": "Bengals"
            },
            "Cleveland Browns": {
                "id": "CLE",
                "aliases": ["browns", "cleveland", "cle"],
                "city": "Cleveland",
                "mascot": "Browns"
            },
            "Dallas Cowboys": {
                "id": "DAL",
                "aliases": ["cowboys", "dallas", "dal", "boys"],
                "city": "Dallas",
                "mascot": "Cowboys"
            },
            "Denver Broncos": {
                "id": "DEN",
                "aliases": ["broncos", "denver", "den"],
                "city": "Denver",
                "mascot": "Broncos"
            },
            "Detroit Lions": {
                "id": "DET",
                "aliases": ["lions", "detroit", "det"],
                "city": "Detroit",
                "mascot": "Lions"
            },
            "Green Bay Packers": {
                "id": "GB",
                "aliases": ["packers", "green bay", "gb", "pack"],
                "city": "Green Bay",
                "mascot": "Packers"
            },
            "Houston Texans": {
                "id": "HOU",
                "aliases": ["texans", "houston", "hou"],
                "city": "Houston",
                "mascot": "Texans"
            },
            "Indianapolis Colts": {
                "id": "IND",
                "aliases": ["colts", "indianapolis", "ind", "indy"],
                "city": "Indianapolis",
                "mascot": "Colts"
            },
            "Jacksonville Jaguars": {
                "id": "JAX",
                "aliases": ["jaguars", "jacksonville", "jax", "jags"],
                "city": "Jacksonville",
                "mascot": "Jaguars"
            },
            "Kansas City Chiefs": {
                "id": "KC",
                "aliases": ["chiefs", "kansas city", "kc", "kansas"],
                "city": "Kansas City",
                "mascot": "Chiefs"
            },
            "Las Vegas Raiders": {
                "id": "LV",
                "aliases": ["raiders", "las vegas", "lv", "vegas", "oak", "oakland"],
                "city": "Las Vegas",
                "mascot": "Raiders"
            },
            "Los Angeles Chargers": {
                "id": "LAC",
                "aliases": ["chargers", "la chargers", "lac", "bolts"],
                "city": "Los Angeles",
                "mascot": "Chargers"
            },
            "Los Angeles Rams": {
                "id": "LAR",
                "aliases": ["rams", "la rams", "lar", "los angeles rams"],
                "city": "Los Angeles",
                "mascot": "Rams"
            },
            "Miami Dolphins": {
                "id": "MIA",
                "aliases": ["dolphins", "miami", "mia", "fins"],
                "city": "Miami",
                "mascot": "Dolphins"
            },
            "Minnesota Vikings": {
                "id": "MIN",
                "aliases": ["vikings", "minnesota", "min", "vikes"],
                "city": "Minnesota",
                "mascot": "Vikings"
            },
            "New England Patriots": {
                "id": "NE",
                "aliases": ["patriots", "new england", "ne", "pats"],
                "city": "New England",
                "mascot": "Patriots"
            },
            "New Orleans Saints": {
                "id": "NO",
                "aliases": ["saints", "new orleans", "no", "nola"],
                "city": "New Orleans",
                "mascot": "Saints"
            },
            "New York Giants": {
                "id": "NYG",
                "aliases": ["giants", "ny giants", "nyg", "g-men", "gmen"],
                "city": "New York",
                "mascot": "Giants"
            },
            "New York Jets": {
                "id": "NYJ",
                "aliases": ["jets", "ny jets", "nyj"],
                "city": "New York",
                "mascot": "Jets"
            },
            "Philadelphia Eagles": {
                "id": "PHI",
                "aliases": ["eagles", "philadelphia", "phi", "philly"],
                "city": "Philadelphia",
                "mascot": "Eagles"
            },
            "Pittsburgh Steelers": {
                "id": "PIT",
                "aliases": ["steelers", "pittsburgh", "pit", "pitt"],
                "city": "Pittsburgh",
                "mascot": "Steelers"
            },
            "San Francisco 49ers": {
                "id": "SF",
                "aliases": ["49ers", "niners", "san francisco", "sf", "san fran"],
                "city": "San Francisco",
                "mascot": "49ers"
            },
            "Seattle Seahawks": {
                "id": "SEA",
                "aliases": ["seahawks", "seattle", "sea", "hawks"],
                "city": "Seattle",
                "mascot": "Seahawks"
            },
            "Tampa Bay Buccaneers": {
                "id": "TB",
                "aliases": ["buccaneers", "bucs", "tampa bay", "tb", "tampa"],
                "city": "Tampa Bay",
                "mascot": "Buccaneers"
            },
            "Tennessee Titans": {
                "id": "TEN",
                "aliases": ["titans", "tennessee", "ten"],
                "city": "Tennessee",
                "mascot": "Titans"
            },
            "Washington Commanders": {
                "id": "WAS",
                "aliases": ["commanders", "washington", "was", "dc", "commies"],
                "city": "Washington",
                "mascot": "Commanders"
            }
        }
    
    def _init_nba_teams(self):
        """Initialize NBA team data with extensive aliases."""
        self.nba_teams = {
            "Atlanta Hawks": {
                "id": "ATL",
                "aliases": ["hawks", "atlanta", "atl"],
                "city": "Atlanta",
                "mascot": "Hawks"
            },
            "Boston Celtics": {
                "id": "BOS",
                "aliases": ["celtics", "boston", "bos", "celts", "cs"],
                "city": "Boston",
                "mascot": "Celtics"
            },
            "Brooklyn Nets": {
                "id": "BKN",
                "aliases": ["nets", "brooklyn", "bkn", "bk"],
                "city": "Brooklyn",
                "mascot": "Nets"
            },
            "Charlotte Hornets": {
                "id": "CHA",
                "aliases": ["hornets", "charlotte", "cha"],
                "city": "Charlotte",
                "mascot": "Hornets"
            },
            "Chicago Bulls": {
                "id": "CHI",
                "aliases": ["bulls", "chicago", "chi"],
                "city": "Chicago",
                "mascot": "Bulls"
            },
            "Cleveland Cavaliers": {
                "id": "CLE",
                "aliases": ["cavaliers", "cavs", "cleveland", "cle"],
                "city": "Cleveland",
                "mascot": "Cavaliers"
            },
            "Dallas Mavericks": {
                "id": "DAL",
                "aliases": ["mavericks", "mavs", "dallas", "dal"],
                "city": "Dallas",
                "mascot": "Mavericks"
            },
            "Denver Nuggets": {
                "id": "DEN",
                "aliases": ["nuggets", "denver", "den", "nugs"],
                "city": "Denver",
                "mascot": "Nuggets"
            },
            "Detroit Pistons": {
                "id": "DET",
                "aliases": ["pistons", "detroit", "det"],
                "city": "Detroit",
                "mascot": "Pistons"
            },
            "Golden State Warriors": {
                "id": "GSW",
                "aliases": ["warriors", "golden state", "gsw", "gs", "dubs"],
                "city": "Golden State",
                "mascot": "Warriors"
            },
            "Houston Rockets": {
                "id": "HOU",
                "aliases": ["rockets", "houston", "hou"],
                "city": "Houston",
                "mascot": "Rockets"
            },
            "Indiana Pacers": {
                "id": "IND",
                "aliases": ["pacers", "indiana", "ind", "indy"],
                "city": "Indiana",
                "mascot": "Pacers"
            },
            "LA Clippers": {
                "id": "LAC",
                "aliases": ["clippers", "la clippers", "lac", "clips"],
                "city": "LA",
                "mascot": "Clippers"
            },
            "Los Angeles Lakers": {
                "id": "LAL",
                "aliases": ["lakers", "la lakers", "lal", "los angeles lakers"],
                "city": "Los Angeles",
                "mascot": "Lakers"
            },
            "Memphis Grizzlies": {
                "id": "MEM",
                "aliases": ["grizzlies", "memphis", "mem", "grizz"],
                "city": "Memphis",
                "mascot": "Grizzlies"
            },
            "Miami Heat": {
                "id": "MIA",
                "aliases": ["heat", "miami", "mia"],
                "city": "Miami",
                "mascot": "Heat"
            },
            "Milwaukee Bucks": {
                "id": "MIL",
                "aliases": ["bucks", "milwaukee", "mil"],
                "city": "Milwaukee",
                "mascot": "Bucks"
            },
            "Minnesota Timberwolves": {
                "id": "MIN",
                "aliases": ["timberwolves", "wolves", "minnesota", "min", "twolves"],
                "city": "Minnesota",
                "mascot": "Timberwolves"
            },
            "New Orleans Pelicans": {
                "id": "NOP",
                "aliases": ["pelicans", "new orleans", "nop", "pels", "nola"],
                "city": "New Orleans",
                "mascot": "Pelicans"
            },
            "New York Knicks": {
                "id": "NYK",
                "aliases": ["knicks", "new york", "nyk", "ny knicks"],
                "city": "New York",
                "mascot": "Knicks"
            },
            "Oklahoma City Thunder": {
                "id": "OKC",
                "aliases": ["thunder", "oklahoma city", "okc", "oklahoma"],
                "city": "Oklahoma City",
                "mascot": "Thunder"
            },
            "Orlando Magic": {
                "id": "ORL",
                "aliases": ["magic", "orlando", "orl"],
                "city": "Orlando",
                "mascot": "Magic"
            },
            "Philadelphia 76ers": {
                "id": "PHI",
                "aliases": ["76ers", "sixers", "philadelphia", "phi", "philly"],
                "city": "Philadelphia",
                "mascot": "76ers"
            },
            "Phoenix Suns": {
                "id": "PHX",
                "aliases": ["suns", "phoenix", "phx"],
                "city": "Phoenix",
                "mascot": "Suns"
            },
            "Portland Trail Blazers": {
                "id": "POR",
                "aliases": ["trail blazers", "blazers", "portland", "por", "rip city"],
                "city": "Portland",
                "mascot": "Trail Blazers"
            },
            "Sacramento Kings": {
                "id": "SAC",
                "aliases": ["kings", "sacramento", "sac"],
                "city": "Sacramento",
                "mascot": "Kings"
            },
            "San Antonio Spurs": {
                "id": "SAS",
                "aliases": ["spurs", "san antonio", "sas", "sa"],
                "city": "San Antonio",
                "mascot": "Spurs"
            },
            "Toronto Raptors": {
                "id": "TOR",
                "aliases": ["raptors", "toronto", "tor", "raps"],
                "city": "Toronto",
                "mascot": "Raptors"
            },
            "Utah Jazz": {
                "id": "UTA",
                "aliases": ["jazz", "utah", "uta"],
                "city": "Utah",
                "mascot": "Jazz"
            },
            "Washington Wizards": {
                "id": "WAS",
                "aliases": ["wizards", "washington", "was", "dc", "wiz"],
                "city": "Washington",
                "mascot": "Wizards"
            }
        }
    
    def _init_ncaaf_teams(self):
        """Initialize major college football teams with extensive aliases."""
        self.ncaaf_teams = {
            # Major programs and common references
            "Alabama": {
                "id": "BAMA",
                "aliases": ["alabama", "bama", "crimson tide", "tide", "ala"],
                "conference": "SEC"
            },
            "Ohio State": {
                "id": "OSU",
                "aliases": ["ohio state", "osu", "buckeyes", "bucks", "ohio st", "oh state", "oh st"],
                "conference": "Big Ten"
            },
            "Michigan": {
                "id": "MICH",
                "aliases": ["michigan", "mich", "wolverines", "um"],
                "conference": "Big Ten"
            },
            "Georgia": {
                "id": "UGA",
                "aliases": ["georgia", "uga", "bulldogs", "dawgs"],
                "conference": "SEC"
            },
            "Notre Dame": {
                "id": "ND",
                "aliases": ["notre dame", "nd", "fighting irish", "irish"],
                "conference": "Independent"
            },
            "Texas": {
                "id": "TEX",
                "aliases": ["texas", "tex", "longhorns", "horns", "ut"],
                "conference": "SEC"
            },
            "Texas A&M": {
                "id": "TAMU",
                "aliases": ["texas a&m", "texas a and m", "a&m", "a and m", "aggies", "tamu"],
                "conference": "SEC"
            },
            "LSU": {
                "id": "LSU",
                "aliases": ["lsu", "louisiana state", "tigers"],
                "conference": "SEC"
            },
            "Florida": {
                "id": "FLA",
                "aliases": ["florida", "fla", "gators", "uf"],
                "conference": "SEC"
            },
            "Florida State": {
                "id": "FSU",
                "aliases": ["florida state", "florida st", "fsu", "seminoles", "noles"],
                "conference": "ACC"
            },
            "Miami": {
                "id": "MIA",
                "aliases": ["miami", "hurricanes", "canes", "the u", "miami fl"],
                "conference": "ACC"
            },
            "Clemson": {
                "id": "CLEM",
                "aliases": ["clemson", "clem", "tigers"],
                "conference": "ACC"
            },
            "Oklahoma": {
                "id": "OU",
                "aliases": ["oklahoma", "ou", "sooners"],
                "conference": "SEC"
            },
            "USC": {
                "id": "USC",
                "aliases": ["usc", "southern cal", "trojans"],
                "conference": "Big Ten"
            },
            "Oregon": {
                "id": "ORE",
                "aliases": ["oregon", "ore", "ducks"],
                "conference": "Big Ten"
            },
            "Penn State": {
                "id": "PSU",
                "aliases": ["penn state", "penn st", "psu", "nittany lions"],
                "conference": "Big Ten"
            },
            "Tennessee": {
                "id": "TENN",
                "aliases": ["tennessee", "tenn", "volunteers", "vols"],
                "conference": "SEC"
            },
            "Auburn": {
                "id": "AUB",
                "aliases": ["auburn", "aub", "tigers", "war eagle"],
                "conference": "SEC"
            },
            "Wisconsin": {
                "id": "WIS",
                "aliases": ["wisconsin", "wis", "wisc", "badgers"],
                "conference": "Big Ten"
            },
            "Iowa": {
                "id": "IOWA",
                "aliases": ["iowa", "hawkeyes"],
                "conference": "Big Ten"
            },
            "Michigan State": {
                "id": "MSU",
                "aliases": ["michigan state", "michigan st", "msu", "spartans", "mich st"],
                "conference": "Big Ten"
            },
            "UCLA": {
                "id": "UCLA",
                "aliases": ["ucla", "bruins"],
                "conference": "Big Ten"
            },
            "Georgia Tech": {
                "id": "GT",
                "aliases": ["georgia tech", "gt", "tech", "yellow jackets", "ga tech"],
                "conference": "ACC"
            },
            "Virginia Tech": {
                "id": "VT",
                "aliases": ["virginia tech", "vt", "va tech", "hokies"],
                "conference": "ACC"
            },
            "Air Force": {
                "id": "AFA",
                "aliases": ["air force", "afa", "usafa", "falcons"],
                "conference": "Mountain West"
            },
            "Army": {
                "id": "ARMY",
                "aliases": ["army", "black knights", "west point"],
                "conference": "Independent"
            },
            "Navy": {
                "id": "NAVY",
                "aliases": ["navy", "midshipmen", "mids"],
                "conference": "American"
            },
            "Boise State": {
                "id": "BSU",
                "aliases": ["boise state", "boise st", "bsu", "broncos"],
                "conference": "Mountain West"
            },
            "TCU": {
                "id": "TCU",
                "aliases": ["tcu", "texas christian", "horned frogs", "frogs"],
                "conference": "Big 12"
            },
            "Utah": {
                "id": "UTAH",
                "aliases": ["utah", "utes"],
                "conference": "Big 12"
            },
            "Oklahoma State": {
                "id": "OKST",
                "aliases": ["oklahoma state", "oklahoma st", "ok state", "okst", "osu", "cowboys", "pokes"],
                "conference": "Big 12"
            },
            "Texas Tech": {
                "id": "TTU",
                "aliases": ["texas tech", "ttu", "tech", "red raiders"],
                "conference": "Big 12"
            },
            "West Virginia": {
                "id": "WVU",
                "aliases": ["west virginia", "wvu", "mountaineers"],
                "conference": "Big 12"
            },
            "Kansas": {
                "id": "KU",
                "aliases": ["kansas", "ku", "jayhawks"],
                "conference": "Big 12"
            },
            "Kansas State": {
                "id": "KSU",
                "aliases": ["kansas state", "kansas st", "k-state", "ksu", "wildcats"],
                "conference": "Big 12"
            },
            "Iowa State": {
                "id": "ISU",
                "aliases": ["iowa state", "iowa st", "isu", "cyclones"],
                "conference": "Big 12"
            },
            "Baylor": {
                "id": "BAY",
                "aliases": ["baylor", "bay", "bears"],
                "conference": "Big 12"
            },
            "Washington": {
                "id": "WASH",
                "aliases": ["washington", "wash", "uw", "huskies"],
                "conference": "Big Ten"
            },
            "Washington State": {
                "id": "WSU",
                "aliases": ["washington state", "washington st", "wsu", "wazzu", "cougars", "cougs"],
                "conference": "Pac-12"
            },
            "Colorado": {
                "id": "COLO",
                "aliases": ["colorado", "colo", "cu", "buffaloes", "buffs"],
                "conference": "Big 12"
            },
            "Arizona": {
                "id": "ARIZ",
                "aliases": ["arizona", "ariz", "wildcats", "zona"],
                "conference": "Big 12"
            },
            "Arizona State": {
                "id": "ASU",
                "aliases": ["arizona state", "arizona st", "asu", "sun devils"],
                "conference": "Big 12"
            },
            "Stanford": {
                "id": "STAN",
                "aliases": ["stanford", "stan", "cardinal"],
                "conference": "ACC"
            },
            "California": {
                "id": "CAL",
                "aliases": ["california", "cal", "golden bears", "berkeley"],
                "conference": "ACC"
            },
            "North Carolina": {
                "id": "UNC",
                "aliases": ["north carolina", "unc", "tar heels", "carolina"],
                "conference": "ACC"
            },
            "NC State": {
                "id": "NCST",
                "aliases": ["nc state", "ncsu", "north carolina state", "wolfpack"],
                "conference": "ACC"
            },
            "Duke": {
                "id": "DUKE",
                "aliases": ["duke", "blue devils"],
                "conference": "ACC"
            },
            "Wake Forest": {
                "id": "WAKE",
                "aliases": ["wake forest", "wake", "demon deacons"],
                "conference": "ACC"
            },
            "Louisville": {
                "id": "LOU",
                "aliases": ["louisville", "lou", "cardinals", "cards"],
                "conference": "ACC"
            },
            "Pitt": {
                "id": "PITT",
                "aliases": ["pitt", "pittsburgh", "panthers"],
                "conference": "ACC"
            },
            "Syracuse": {
                "id": "SYR",
                "aliases": ["syracuse", "syr", "orange", "cuse"],
                "conference": "ACC"
            },
            "Boston College": {
                "id": "BC",
                "aliases": ["boston college", "bc", "eagles"],
                "conference": "ACC"
            },
            "Virginia": {
                "id": "UVA",
                "aliases": ["virginia", "uva", "cavaliers", "hoos"],
                "conference": "ACC"
            },
            "Arkansas": {
                "id": "ARK",
                "aliases": ["arkansas", "ark", "razorbacks", "hogs"],
                "conference": "SEC"
            },
            "Mississippi": {
                "id": "MISS",
                "aliases": ["ole miss", "mississippi", "miss", "rebels"],
                "conference": "SEC"
            },
            "Mississippi State": {
                "id": "MSST",
                "aliases": ["mississippi state", "mississippi st", "miss state", "msst", "msu", "bulldogs"],
                "conference": "SEC"
            },
            "Kentucky": {
                "id": "UK",
                "aliases": ["kentucky", "uk", "wildcats"],
                "conference": "SEC"
            },
            "Missouri": {
                "id": "MIZ",
                "aliases": ["missouri", "mizzou", "miz", "tigers"],
                "conference": "SEC"
            },
            "South Carolina": {
                "id": "SCAR",
                "aliases": ["south carolina", "scar", "gamecocks", "cocks"],
                "conference": "SEC"
            },
            "Vanderbilt": {
                "id": "VAN",
                "aliases": ["vanderbilt", "vandy", "van", "commodores"],
                "conference": "SEC"
            }
        }
    
    def _init_ncaam_teams(self):
        """Initialize major college basketball teams (inherits most from NCAAF)."""
        # Start with football teams (most overlap)
        self.ncaam_teams = dict(self.ncaaf_teams)
        
        # Add basketball-only schools and additional aliases
        additional_teams = {
            "Gonzaga": {
                "id": "GONZ",
                "aliases": ["gonzaga", "gonz", "zags", "bulldogs"],
                "conference": "WCC"
            },
            "Villanova": {
                "id": "NOVA",
                "aliases": ["villanova", "nova", "wildcats"],
                "conference": "Big East"
            },
            "Georgetown": {
                "id": "GTWN",
                "aliases": ["georgetown", "hoyas", "gtown"],
                "conference": "Big East"
            },
            "Marquette": {
                "id": "MARQ",
                "aliases": ["marquette", "marq", "golden eagles"],
                "conference": "Big East"
            },
            "Creighton": {
                "id": "CREI",
                "aliases": ["creighton", "bluejays", "jays"],
                "conference": "Big East"
            },
            "Xavier": {
                "id": "XAV",
                "aliases": ["xavier", "musketeers"],
                "conference": "Big East"
            },
            "Butler": {
                "id": "BUT",
                "aliases": ["butler", "bulldogs"],
                "conference": "Big East"
            },
            "Seton Hall": {
                "id": "HALL",
                "aliases": ["seton hall", "hall", "pirates"],
                "conference": "Big East"
            },
            "Providence": {
                "id": "PROV",
                "aliases": ["providence", "prov", "friars"],
                "conference": "Big East"
            },
            "St. John's": {
                "id": "STJ",
                "aliases": ["st johns", "st. john's", "johnnies", "red storm"],
                "conference": "Big East"
            },
            "DePaul": {
                "id": "DEP",
                "aliases": ["depaul", "blue demons"],
                "conference": "Big East"
            },
            "Memphis": {
                "id": "MEM",
                "aliases": ["memphis", "tigers"],
                "conference": "AAC"
            },
            "Cincinnati": {
                "id": "CINC",
                "aliases": ["cincinnati", "cincy", "bearcats"],
                "conference": "Big 12"
            },
            "Houston": {
                "id": "HOU",
                "aliases": ["houston", "cougars", "coogs"],
                "conference": "Big 12"
            },
            "Wichita State": {
                "id": "WICH",
                "aliases": ["wichita state", "wichita st", "shockers"],
                "conference": "AAC"
            },
            "Saint Mary's": {
                "id": "SMC",
                "aliases": ["saint marys", "st marys", "st. mary's", "gaels"],
                "conference": "WCC"
            },
            "San Diego State": {
                "id": "SDSU",
                "aliases": ["san diego state", "san diego st", "sdsu", "aztecs"],
                "conference": "Mountain West"
            },
            "UNLV": {
                "id": "UNLV",
                "aliases": ["unlv", "rebels", "runnin rebels"],
                "conference": "Mountain West"
            },
            "Nevada": {
                "id": "NEV",
                "aliases": ["nevada", "wolf pack", "unr"],
                "conference": "Mountain West"
            },
            "New Mexico": {
                "id": "UNM",
                "aliases": ["new mexico", "lobos", "unm"],
                "conference": "Mountain West"
            },
            "Utah State": {
                "id": "USU",
                "aliases": ["utah state", "utah st", "usu", "aggies"],
                "conference": "Mountain West"
            },
            "Dayton": {
                "id": "DAY",
                "aliases": ["dayton", "flyers"],
                "conference": "A-10"
            },
            "VCU": {
                "id": "VCU",
                "aliases": ["vcu", "virginia commonwealth", "rams"],
                "conference": "A-10"
            },
            "Richmond": {
                "id": "RICH",
                "aliases": ["richmond", "spiders"],
                "conference": "A-10"
            },
            "Rhode Island": {
                "id": "URI",
                "aliases": ["rhode island", "uri", "rams"],
                "conference": "A-10"
            },
            "Saint Louis": {
                "id": "SLU",
                "aliases": ["saint louis", "st louis", "slu", "billikens"],
                "conference": "A-10"
            },
            "Davidson": {
                "id": "DAV",
                "aliases": ["davidson", "wildcats"],
                "conference": "A-10"
            },
            "Murray State": {
                "id": "MURR",
                "aliases": ["murray state", "murray st", "racers"],
                "conference": "MVC"
            },
            "Loyola Chicago": {
                "id": "LYIL",
                "aliases": ["loyola chicago", "loyola", "ramblers"],
                "conference": "A-10"
            }
        }
        
        self.ncaam_teams.update(additional_teams)
    
    def _build_reverse_mappings(self):
        """Build reverse lookup dictionaries for quick access."""
        self.all_aliases = {}  # alias -> (canonical_name, league)
        self.team_by_id = {}   # id -> (canonical_name, league)
        
        # Process each league
        for league, teams in [
            ("NFL", self.nfl_teams),
            ("NBA", self.nba_teams),
            ("NCAAF", self.ncaaf_teams),
            ("NCAAM", self.ncaam_teams)
        ]:
            for canonical_name, data in teams.items():
                # Map by ID
                team_id = data["id"]
                if team_id not in self.team_by_id:
                    self.team_by_id[team_id] = []
                self.team_by_id[team_id].append((canonical_name, league))
                
                # Map all aliases
                for alias in data.get("aliases", []):
                    alias_lower = alias.lower().strip()
                    if alias_lower not in self.all_aliases:
                        self.all_aliases[alias_lower] = []
                    self.all_aliases[alias_lower].append((canonical_name, league))
                
                # Also map the canonical name itself
                canonical_lower = canonical_name.lower().strip()
                if canonical_lower not in self.all_aliases:
                    self.all_aliases[canonical_lower] = []
                self.all_aliases[canonical_lower].append((canonical_name, league))
    
    def normalize_team(self, team_text: str, league_hint: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
        """
        Normalize a team name to its canonical form.
        
        Args:
            team_text: Raw team text (could be abbreviation, city, mascot, etc.)
            league_hint: Optional league hint to disambiguate (NFL, NBA, NCAAF, NCAAM)
        
        Returns:
            Tuple of (canonical_team_name, inferred_league) or (None, None) if not found
        """
        if not team_text:
            return None, None
        
        # Clean and lowercase
        team_lower = team_text.lower().strip()
        
        # Direct alias lookup
        if team_lower in self.all_aliases:
            matches = self.all_aliases[team_lower]
            
            # If we have a league hint, prefer that league
            if league_hint:
                league_upper = league_hint.upper()
                for canonical, league in matches:
                    if league == league_upper:
                        return canonical, league
            
            # Return first match if no hint or no match with hint
            if matches:
                return matches[0]
        
        # Try partial matching for common patterns
        # Check if it ends with common mascot-only references
        mascot_patterns = [
            "tide", "buckeyes", "wolverines", "bulldogs", "irish", "longhorns", "aggies",
            "tigers", "gators", "seminoles", "hurricanes", "sooners", "trojans", "ducks",
            "volunteers", "badgers", "hawkeyes", "spartans", "bruins", "falcons",
            "bears", "bengals", "bills", "browns", "cowboys", "lions", "packers", "chiefs",
            "raiders", "dolphins", "patriots", "saints", "giants", "jets", "eagles",
            "steelers", "49ers", "niners", "seahawks", "buccaneers", "titans", "commanders",
            "hawks", "celtics", "nets", "hornets", "bulls", "cavaliers", "mavericks",
            "nuggets", "pistons", "warriors", "rockets", "pacers", "clippers", "lakers",
            "grizzlies", "heat", "bucks", "timberwolves", "pelicans", "knicks", "thunder",
            "magic", "76ers", "sixers", "suns", "trail blazers", "blazers", "kings", "spurs",
            "raptors", "jazz", "wizards"
        ]
        
        for pattern in mascot_patterns:
            if pattern in team_lower:
                # Search for teams with this mascot
                for alias, matches in self.all_aliases.items():
                    if pattern in alias:
                        if league_hint:
                            league_upper = league_hint.upper()
                            for canonical, league in matches:
                                if league == league_upper:
                                    return canonical, league
                        elif matches:
                            return matches[0]
        
        return None, None
    
    def get_team_id(self, team_text: str, league_hint: Optional[str] = None) -> Optional[str]:
        """Get the team ID for a given team text."""
        canonical, league = self.normalize_team(team_text, league_hint)
        if not canonical or not league:
            return None
        
        # Get the team data from the appropriate league
        if league == "NFL" and canonical in self.nfl_teams:
            return self.nfl_teams[canonical]["id"]
        elif league == "NBA" and canonical in self.nba_teams:
            return self.nba_teams[canonical]["id"]
        elif league == "NCAAF" and canonical in self.ncaaf_teams:
            return self.ncaaf_teams[canonical]["id"]
        elif league == "NCAAM" and canonical in self.ncaam_teams:
            return self.ncaam_teams[canonical]["id"]
        
        return None
    
    def get_all_aliases_for_team(self, team_text: str) -> List[str]:
        """Get all known aliases for a team."""
        canonical, league = self.normalize_team(team_text)
        if not canonical or not league:
            return []
        
        # Get the team data from the appropriate league
        team_data = None
        if league == "NFL" and canonical in self.nfl_teams:
            team_data = self.nfl_teams[canonical]
        elif league == "NBA" and canonical in self.nba_teams:
            team_data = self.nba_teams[canonical]
        elif league == "NCAAF" and canonical in self.ncaaf_teams:
            team_data = self.ncaaf_teams[canonical]
        elif league == "NCAAM" and canonical in self.ncaam_teams:
            team_data = self.ncaam_teams[canonical]
        
        if team_data:
            return team_data.get("aliases", [])
        return []


# Singleton instance
team_registry = TeamRegistry()