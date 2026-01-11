"""
Tracker Evaluator - Evaluate picks directly from the tracker Excel file
"""

import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from src.box_score_database import BoxScoreDatabase
from src.team_registry import team_registry


@dataclass
class TrackerPick:
    """Pick from tracker."""
    date: str
    league: str
    matchup: Optional[str]
    segment: str
    pick_description: str
    odds: Optional[str]
    risk: Optional[Decimal]
    to_win: Optional[Decimal]
    existing_result: Optional[str]  # Existing Hit/Miss from tracker
    
    # Evaluation results
    game_id: Optional[str] = None
    final_score: Optional[str] = None
    half_score: Optional[str] = None
    actual_total: Optional[int] = None
    evaluated_result: Optional[str] = None
    pnl: Optional[Decimal] = None


class TrackerEvaluator:
    """Evaluate picks from tracker using box score database."""
    
    # Team name mappings (short names to normalized)
    TEAM_ABBR_MAP = {
        # NBA
        "nets": ("Brooklyn Nets", "BKN"), "brooklyn": ("Brooklyn Nets", "BKN"), "brooklyn nets": ("Brooklyn Nets", "BKN"),
        "mavs": ("Dallas Mavericks", "DAL"), "mavericks": ("Dallas Mavericks", "DAL"), "dallas": ("Dallas Mavericks", "DAL"), "dallas mavericks": ("Dallas Mavericks", "DAL"),
        "celtics": ("Boston Celtics", "BOS"), "boston": ("Boston Celtics", "BOS"), "boston celtics": ("Boston Celtics", "BOS"),
        "heat": ("Miami Heat", "MIA"), "miami heat": ("Miami Heat", "MIA"),
        "lakers": ("Los Angeles Lakers", "LAL"), "los angeles lakers": ("Los Angeles Lakers", "LAL"),
        "clippers": ("Los Angeles Clippers", "LAC"), "los angeles clippers": ("Los Angeles Clippers", "LAC"),
        "warriors": ("Golden State Warriors", "GS"), "golden state": ("Golden State Warriors", "GS"), "golden state warriors": ("Golden State Warriors", "GS"),
        "knicks": ("New York Knicks", "NY"), "new york knicks": ("New York Knicks", "NY"),
        "magic": ("Orlando Magic", "ORL"), "orlando": ("Orlando Magic", "ORL"), "orlando magic": ("Orlando Magic", "ORL"),
        "spurs": ("San Antonio Spurs", "SA"), "san antonio": ("San Antonio Spurs", "SA"), "san antonio spurs": ("San Antonio Spurs", "SA"),
        "thunder": ("Oklahoma City Thunder", "OKC"), "okc": ("Oklahoma City Thunder", "OKC"), "oklahoma city thunder": ("Oklahoma City Thunder", "OKC"),
        "pistons": ("Detroit Pistons", "DET"), "detroit pistons": ("Detroit Pistons", "DET"),
        "hawks": ("Atlanta Hawks", "ATL"), "atlanta": ("Atlanta Hawks", "ATL"), "atlanta hawks": ("Atlanta Hawks", "ATL"),
        "hornets": ("Charlotte Hornets", "CHA"), "charlotte": ("Charlotte Hornets", "CHA"), "charlotte hornets": ("Charlotte Hornets", "CHA"),
        "timberwolves": ("Minnesota Timberwolves", "MIN"), "wolves": ("Minnesota Timberwolves", "MIN"), "minnesota": ("Minnesota Timberwolves", "MIN"), "minnesota timberwolves": ("Minnesota Timberwolves", "MIN"),
        "jazz": ("Utah Jazz", "UTAH"), "utah": ("Utah Jazz", "UTAH"), "utah jazz": ("Utah Jazz", "UTAH"),
        "grizzlies": ("Memphis Grizzlies", "MEM"), "memphis": ("Memphis Grizzlies", "MEM"), "memphis grizzlies": ("Memphis Grizzlies", "MEM"),
        "bulls": ("Chicago Bulls", "CHI"), "chicago bulls": ("Chicago Bulls", "CHI"),
        "cavaliers": ("Cleveland Cavaliers", "CLE"), "cavs": ("Cleveland Cavaliers", "CLE"), "cleveland": ("Cleveland Cavaliers", "CLE"), "cleveland cavaliers": ("Cleveland Cavaliers", "CLE"),
        "raptors": ("Toronto Raptors", "TOR"), "toronto": ("Toronto Raptors", "TOR"), "toronto raptors": ("Toronto Raptors", "TOR"),
        "wizards": ("Washington Wizards", "WAS"), "washington": ("Washington Wizards", "WAS"), "washington wizards": ("Washington Wizards", "WAS"),
        "pelicans": ("New Orleans Pelicans", "NO"), "new orleans": ("New Orleans Pelicans", "NO"), "new orleans pelicans": ("New Orleans Pelicans", "NO"),
        "rockets": ("Houston Rockets", "HOU"), "houston": ("Houston Rockets", "HOU"), "houston rockets": ("Houston Rockets", "HOU"),
        "nuggets": ("Denver Nuggets", "DEN"), "denver": ("Denver Nuggets", "DEN"), "denver nuggets": ("Denver Nuggets", "DEN"),
        "suns": ("Phoenix Suns", "PHX"), "phoenix": ("Phoenix Suns", "PHX"), "phoenix suns": ("Phoenix Suns", "PHX"),
        "blazers": ("Portland Trail Blazers", "POR"), "portland": ("Portland Trail Blazers", "POR"), "portland trail blazers": ("Portland Trail Blazers", "POR"),
        "kings": ("Sacramento Kings", "SAC"), "sacramento": ("Sacramento Kings", "SAC"), "sacramento kings": ("Sacramento Kings", "SAC"),
        "pacers": ("Indiana Pacers", "IND"), "indiana": ("Indiana Pacers", "IND"), "indiana pacers": ("Indiana Pacers", "IND"),
        "bucks": ("Milwaukee Bucks", "MIL"), "milwaukee": ("Milwaukee Bucks", "MIL"), "milwaukee bucks": ("Milwaukee Bucks", "MIL"),
        "76ers": ("Philadelphia 76ers", "PHI"), "sixers": ("Philadelphia 76ers", "PHI"), "philadelphia 76ers": ("Philadelphia 76ers", "PHI"),
        
        # NFL
        "chiefs": ("Kansas City Chiefs", "KC"), "kansas city chiefs": ("Kansas City Chiefs", "KC"),
        "bills": ("Buffalo Bills", "BUF"), "buffalo bills": ("Buffalo Bills", "BUF"),
        "ravens": ("Baltimore Ravens", "BAL"), "baltimore ravens": ("Baltimore Ravens", "BAL"),
        "eagles": ("Philadelphia Eagles", "PHI"), "philadelphia eagles": ("Philadelphia Eagles", "PHI"),
        "lions": ("Detroit Lions", "DET"), "detroit lions": ("Detroit Lions", "DET"), "detroit": ("Detroit Lions", "DET"),
        "cowboys": ("Dallas Cowboys", "DAL"), "dallas cowboys": ("Dallas Cowboys", "DAL"),
        "49ers": ("San Francisco 49ers", "SF"), "san francisco 49ers": ("San Francisco 49ers", "SF"),
        "packers": ("Green Bay Packers", "GB"), "green bay packers": ("Green Bay Packers", "GB"),
        "vikings": ("Minnesota Vikings", "MIN"), "minnesota vikings": ("Minnesota Vikings", "MIN"),
        "bengals": ("Cincinnati Bengals", "CIN"), "cincinnati bengals": ("Cincinnati Bengals", "CIN"),
        "steelers": ("Pittsburgh Steelers", "PIT"), "pittsburgh steelers": ("Pittsburgh Steelers", "PIT"),
        "chargers": ("Los Angeles Chargers", "LAC"), "los angeles chargers": ("Los Angeles Chargers", "LAC"),
        "broncos": ("Denver Broncos", "DEN"), "denver broncos": ("Denver Broncos", "DEN"),
        "seahawks": ("Seattle Seahawks", "SEA"), "seattle seahawks": ("Seattle Seahawks", "SEA"),
        "bears": ("Chicago Bears", "CHI"), "chicago bears": ("Chicago Bears", "CHI"), "chicago": ("Chicago Bears", "CHI"),
        "texans": ("Houston Texans", "HOU"), "houston texans": ("Houston Texans", "HOU"),
        "colts": ("Indianapolis Colts", "IND"), "indianapolis colts": ("Indianapolis Colts", "IND"),
        "titans": ("Tennessee Titans", "TEN"), "tennessee titans": ("Tennessee Titans", "TEN"),
        "jaguars": ("Jacksonville Jaguars", "JAX"), "jacksonville jaguars": ("Jacksonville Jaguars", "JAX"),
        "browns": ("Cleveland Browns", "CLE"), "cleveland browns": ("Cleveland Browns", "CLE"),
        "raiders": ("Las Vegas Raiders", "LV"), "las vegas raiders": ("Las Vegas Raiders", "LV"),
        "saints": ("New Orleans Saints", "NO"), "new orleans saints": ("New Orleans Saints", "NO"),
        "falcons": ("Atlanta Falcons", "ATL"), "atlanta falcons": ("Atlanta Falcons", "ATL"),
        "panthers": ("Carolina Panthers", "CAR"), "carolina panthers": ("Carolina Panthers", "CAR"),
        "bucs": ("Tampa Bay Buccaneers", "TB"), "buccaneers": ("Tampa Bay Buccaneers", "TB"), "tampa bay buccaneers": ("Tampa Bay Buccaneers", "TB"),
        "cardinals": ("Arizona Cardinals", "ARI"), "arizona cardinals": ("Arizona Cardinals", "ARI"),
        "rams": ("Los Angeles Rams", "LAR"), "los angeles rams": ("Los Angeles Rams", "LAR"),
        "giants": ("New York Giants", "NYG"), "new york giants": ("New York Giants", "NYG"),
        "jets": ("New York Jets", "NYJ"), "new york jets": ("New York Jets", "NYJ"),
        "patriots": ("New England Patriots", "NE"), "new england patriots": ("New England Patriots", "NE"),
        "dolphins": ("Miami Dolphins", "MIA"), "miami dolphins": ("Miami Dolphins", "MIA"), "miami": ("Miami Dolphins", "MIA"),
        "commanders": ("Washington Commanders", "WAS"), "washington commanders": ("Washington Commanders", "WAS"),
        
        # NCAAF
        "army": ("Army", "ARMY"), "army black knights": ("Army", "ARMY"),
        "navy": ("Navy", "NAVY"), "navy midshipmen": ("Navy", "NAVY"),
        "army/navy": ("Army vs Navy", "ARMY"),
        
        # NCAAM
        "cal baptist": ("California Baptist", "CBU"), "california baptist": ("California Baptist", "CBU"),
        "uc riverside": ("UC Riverside", "UCR"),
        "smu": ("SMU", "SMU"), "southern methodist": ("SMU", "SMU"),
        "lsu": ("LSU", "LSU"), "louisiana state": ("LSU", "LSU"),
        "ohio state": ("Ohio State", "OSU"), "ohio st": ("Ohio State", "OSU"),
        "alabama": ("Alabama", "ALA"), "bama": ("Alabama", "ALA"),
        "texas": ("Texas", "TEX"), "texas longhorns": ("Texas", "TEX"),
        "uconn": ("UConn", "CONN"), "connecticut": ("UConn", "CONN"),
        "gonzaga": ("Gonzaga", "GONZ"),
        "duke": ("Duke", "DUKE"),
        "kentucky": ("Kentucky", "UK"),
        "kansas": ("Kansas", "KU"),
        "auburn": ("Auburn", "AUB"),
        "tennessee": ("Tennessee", "TENN"),
        "purdue": ("Purdue", "PUR"),
        "houston": ("Houston", "HOU"),
        "iowa": ("Iowa", "IOWA"),
        "memphis": ("Memphis", "MEM"),
        "louisville": ("Louisville", "LOU"),
        "pepperdine": ("Pepperdine", "PEPP"),
        "sd state": ("South Dakota State", "SDST"), "south dakota state": ("South Dakota State", "SDST"), "south dakota st": ("South Dakota State", "SDST"), "sdsu": ("South Dakota State", "SDST"),
        "san diego state": ("San Diego State", "SDSU"), "san diego st": ("San Diego State", "SDSU"),
        "unlv": ("UNLV", "UNLV"),
        "wvu": ("West Virginia", "WVU"), "west virginia": ("West Virginia", "WVU"),
        "byu": ("BYU", "BYU"), "brigham young": ("BYU", "BYU"),
        "arizona": ("Arizona", "ARIZ"),
        "ucla": ("UCLA", "UCLA"),
        "usc": ("USC", "USC"),
        "oregon": ("Oregon", "ORE"),
        "michigan": ("Michigan", "MICH"),
        "michigan state": ("Michigan State", "MSU"), "msu": ("Michigan State", "MSU"),
        "wisconsin": ("Wisconsin", "WIS"),
        "illinois": ("Illinois", "ILL"),
        "northwestern": ("Northwestern", "NW"),
        "nc state": ("NC State", "NCST"), "north carolina state": ("NC State", "NCST"),
        "unc": ("North Carolina", "UNC"), "north carolina": ("North Carolina", "UNC"),
        "clemson": ("Clemson", "CLEM"),
        "florida": ("Florida", "FLA"),
        "florida state": ("Florida State", "FSU"),
        "georgia": ("Georgia", "UGA"),
        "penn state": ("Penn State", "PSU"),
        "ole miss": ("Ole Miss", "MISS"),
        "miss state": ("Mississippi State", "MSST"), "mississippi state": ("Mississippi State", "MSST"),
        "arkansas": ("Arkansas", "ARK"),
        "missouri": ("Missouri", "MIZ"),
        "south carolina": ("South Carolina", "SC"),
        "vanderbilt": ("Vanderbilt", "VAN"),
        "stanford": ("Stanford", "STAN"),
        "colorado": ("Colorado", "COL"),
        "utah state": ("Utah State", "USU"),
        "boise state": ("Boise State", "BSU"),
        "fresno state": ("Fresno State", "FRES"),
        "eastern washington": ("Eastern Washington", "EWU"),
        "saint marys": ("Saint Mary's", "SMC"), "st marys": ("Saint Mary's", "SMC"),
        "chattanooga": ("Chattanooga", "CHAT"),
        "tennessee state": ("Tennessee State", "TNST"),
        "wiz": ("Washington Wizards", "WAS"),
        "umkc": ("UMKC", "UMKC"), "kansas city": ("UMKC", "UMKC"),
        "wyoming": ("Wyoming", "WYO"),
        "jackrabbits": ("South Dakota State", "SDSU"),
        "navy": ("Navy", "NAVY"), "midshipmen": ("Navy", "NAVY"),
        
        # NFL Abbreviations
        "gb": ("Green Bay Packers", "GB"),
        "phi": ("Philadelphia Eagles", "PHI"),
        "chi": ("Chicago Bears", "CHI"),
        "was": ("Washington Commanders", "WAS"),
        "mia": ("Miami Dolphins", "MIA"),
        "pit": ("Pittsburgh Steelers", "PIT"),
        "jax": ("Jacksonville Jaguars", "JAX"),
        "ari": ("Arizona Cardinals", "ARI"),
        "bal": ("Baltimore Ravens", "BAL"),
        "sf": ("San Francisco 49ers", "SF"),
        
        # NCAAF
        "fiu": ("Florida International", "FLINT"), "florida international": ("Florida International", "FLINT"),
        
        # NBA
        "nop": ("New Orleans Pelicans", "NO"),
    }
    
    def __init__(self, db_path: str = "box_scores.db"):
        self.db = BoxScoreDatabase(db_path)
        self.team_registry = team_registry
    
    def load_tracker(self, tracker_path: str, sheet_name: str) -> pd.DataFrame:
        """Load tracker Excel file."""
        df = pd.read_excel(tracker_path, sheet_name=sheet_name)
        
        # Normalize column names
        df.columns = [c.strip() for c in df.columns]
        
        # Parse dates
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        
        return df
    
    def evaluate_tracker(
        self,
        tracker_path: str,
        sheet_name: str = "Master Schedule",
        date_range: Tuple[str, str] = None
    ) -> List[TrackerPick]:
        """Evaluate all picks from tracker."""
        df = self.load_tracker(tracker_path, sheet_name)
        
        # Filter by date if specified
        if date_range:
            start = pd.Timestamp(date_range[0])
            end = pd.Timestamp(date_range[1])
            df = df[(df['Date'] >= start) & (df['Date'] <= end)]
        
        # Skip header/summary rows
        df = df[df['League'].notna() & (df['League'] != 'ALL')]
        
        print(f"Processing {len(df)} picks...")
        
        picks = []
        evaluated = 0
        
        for _, row in df.iterrows():
            pick = self._process_row(row)
            if pick:
                picks.append(pick)
                if pick.evaluated_result and pick.evaluated_result != "Pending":
                    evaluated += 1
        
        print(f"  Evaluated: {evaluated}/{len(picks)}")
        return picks
    
    def _process_row(self, row: pd.Series) -> Optional[TrackerPick]:
        """Process a single tracker row."""
        try:
            date = row['Date']
            if pd.isna(date):
                return None
            
            date_str = date.strftime("%Y-%m-%d") if hasattr(date, 'strftime') else str(date)[:10]
            league = str(row.get('League', '')).strip().upper()
            
            if not league or league == 'ALL':
                return None
            
            pick_odds = str(row.get('Pick (Odds)', '') or row.get('Pick', '')).strip()
            if not pick_odds or pick_odds.upper() == 'ALL':
                return None
            
            # Parse segment
            segment = str(row.get('Segment', 'FG')).strip().upper()
            if segment not in ['1H', '2H', 'FG', '1Q', '2Q', '3Q', '4Q']:
                # Maybe segment is in pick description
                if '1h' in pick_odds.lower():
                    segment = '1H'
                elif '2h' in pick_odds.lower():
                    segment = '2H'
                else:
                    segment = 'FG'
            
            # Extract odds from pick description
            odds = None
            odds_match = re.search(r'\(([-+]?\d+)\)', pick_odds)
            if odds_match:
                odds = odds_match.group(1)
            
            # Get existing result
            existing = str(row.get('Hit/Miss', '') or row.get('Hit/Miss/Push', '') or '').strip()
            
            # Get risk/to_win
            risk = None
            to_win = None
            try:
                risk_val = row.get('Risk')
                if risk_val and not pd.isna(risk_val):
                    risk = Decimal(str(risk_val).replace(',', '').replace('$', ''))
            except:
                pass
            try:
                to_win_val = row.get('To Win')
                if to_win_val and not pd.isna(to_win_val):
                    to_win = Decimal(str(to_win_val).replace(',', '').replace('$', ''))
            except:
                pass
            
            pick = TrackerPick(
                date=date_str,
                league=league,
                matchup=str(row.get('Matchup', '') or '').strip() or None,
                segment=segment,
                pick_description=pick_odds,
                odds=odds,
                risk=risk or Decimal("50000"),
                to_win=to_win or Decimal("50000"),
                existing_result=existing if existing else None
            )
            
            # Evaluate against box scores
            self._evaluate_pick(pick)
            
            return pick
            
        except Exception as e:
            print(f"Error processing row: {e}")
            return None
    
    def _evaluate_pick(self, pick: TrackerPick):
        """Evaluate a pick against box scores."""
        # Find matching game
        game = self._find_game(pick)
        if not game:
            pick.evaluated_result = "Pending"
            return
        
        pick.game_id = str(game.get('game_id', ''))
        pick.final_score = self._format_score(game)
        pick.half_score = self._format_half_score(game, "H1")
        
        # Determine result
        pick_desc = pick.pick_description.lower()
        
        # Get scores based on segment
        league = pick.league or game.get("league", "")
        if pick.segment == "1H":
            scores = self._get_half_scores(game, "H1", league)
        elif pick.segment == "2H":
            scores = self._get_half_scores(game, "H2", league)
        else:
            scores = {"home": game.get("home_score", 0), "away": game.get("away_score", 0)}
        
        if not scores:
            pick.evaluated_result = "Pending"
            return
        
        total = scores["home"] + scores["away"]
        pick.actual_total = total
        
        # Parse pick type
        is_over = "over" in pick_desc or re.search(r'\bo\d', pick_desc)  # "o219" format
        is_under = "under" in pick_desc or re.search(r'\bu\d', pick_desc)  # "u219" format
        is_ml = "ml" in pick_desc
        
        # Extract line value (including sign for spreads)
        # For spreads like "Team -5" or "Team +3.5", capture the sign
        line_match = re.search(r'([+-]?\d+\.?\d*)', pick.pick_description, re.I)
        if not line_match and not is_ml:
            pick.evaluated_result = "Pending"
            return
        
        try:
            line = float(line_match.group(1)) if line_match else 0
        except:
            if not is_ml:
                pick.evaluated_result = "Pending"
                return
            line = 0
        
        if is_over and not is_ml:
            if total > line:
                pick.evaluated_result = "Hit"
            elif total < line:
                pick.evaluated_result = "Miss"
            else:
                pick.evaluated_result = "Push"
        elif is_under and not is_ml:
            if total < line:
                pick.evaluated_result = "Hit"
            elif total > line:
                pick.evaluated_result = "Miss"
            else:
                pick.evaluated_result = "Push"
        elif is_ml:
            # Moneyline bet - just need to find winner
            pick.evaluated_result = self._evaluate_spread(pick, game, scores, 0)  # 0 spread = straight up
        else:
            # Spread bet
            pick.evaluated_result = self._evaluate_spread(pick, game, scores, line)
        
        # Calculate P&L
        if pick.evaluated_result == "Hit":
            pick.pnl = pick.to_win if pick.to_win else Decimal("50000")
        elif pick.evaluated_result == "Miss":
            pick.pnl = -(pick.risk if pick.risk else Decimal("50000"))
        elif pick.evaluated_result == "Push":
            pick.pnl = Decimal(0)
        else:
            pick.pnl = None
    
    def _evaluate_spread(self, pick: TrackerPick, game: Dict, scores: Dict, line: float) -> str:
        """Evaluate spread bet."""
        pick_desc = pick.pick_description.lower()
        
        # Extract team from pick - handle multiple formats
        team_name = None
        
        # Format: "Team ML" or "Team ML +200"
        ml_match = re.match(r'^([A-Za-z][A-Za-z\s&\'.,-]+?)\s+ml\b', pick_desc, re.I)
        if ml_match:
            team_name = ml_match.group(1).strip()
        
        # Format: "Team +3.5" or "Team -7"
        if not team_name:
            spread_match = re.match(r'^([A-Za-z][A-Za-z\s&\'.,-]+?)(?:\s+[+-]?\d)', pick_desc)
            if spread_match:
                team_name = spread_match.group(1).strip()
        
        # Try matchup if still no team
        if not team_name and pick.matchup:
            for sep in [" @ ", " vs "]:
                if sep in pick.matchup:
                    team_name = pick.matchup.split(sep)[0].strip().lower()
                    break
        
        if not team_name:
            return "Pending"
        
        # Find which side of game this team is
        home_team = (game.get("home_team_full") or game.get("home_team", "")).lower()
        away_team = (game.get("away_team_full") or game.get("away_team", "")).lower()
        home_abbr = game.get("home_team", "").lower()
        away_abbr = game.get("away_team", "").lower()
        
        is_home = False
        is_away = False
        
        # Check mappings
        team_lower = team_name.lower()
        if team_lower in self.TEAM_ABBR_MAP:
            _, abbr = self.TEAM_ABBR_MAP[team_lower]
            if abbr.lower() == home_abbr:
                is_home = True
            elif abbr.lower() == away_abbr:
                is_away = True
        
        if not is_home and not is_away:
            # Try substring match
            if team_lower in home_team or home_team in team_lower:
                is_home = True
            elif team_lower in away_team or away_team in team_lower:
                is_away = True
            elif team_lower in home_abbr:
                is_home = True
            elif team_lower in away_abbr:
                is_away = True
        
        if not is_home and not is_away:
            return "Pending"
        
        home_score = scores["home"]
        away_score = scores["away"]
        
        # Check for ML (moneyline)
        if "ml" in pick_desc:
            if is_home:
                return "Hit" if home_score > away_score else "Miss"
            else:
                return "Hit" if away_score > home_score else "Miss"
        
        # Spread evaluation
        if is_home:
            adjusted = home_score + line
            if adjusted > away_score:
                return "Hit"
            elif adjusted < away_score:
                return "Miss"
            else:
                return "Push"
        else:
            adjusted = away_score + line
            if adjusted > home_score:
                return "Hit"
            elif adjusted < home_score:
                return "Miss"
            else:
                return "Push"
    
    def _find_game(self, pick: TrackerPick) -> Optional[Dict]:
        """Find matching game for pick using matchup and/or pick description."""
        games = self.db.get_games_by_date(pick.date, pick.league)
        if not games:
            return None
        
        # Build list of team names to search
        team_candidates = []
        
        # 1. Use matchup if available (most reliable)
        if pick.matchup:
            # Parse "Team1 @ Team2" or "Team1 vs Team2" format
            matchup = pick.matchup
            for sep in [" @ ", " vs ", " v "]:
                if sep in matchup:
                    parts = matchup.split(sep)
                    for part in parts:
                        team_candidates.append(part.strip().lower())
                    break
        
        # 2. Extract team from pick description
        pick_desc = pick.pick_description.lower()
        team_text = re.sub(r'\b(over|under)\b', '', pick_desc, flags=re.I)
        team_text = re.sub(r'[-+]?\d+\.?\d*', '', team_text)
        team_text = re.sub(r'\(.*?\)', '', team_text)
        team_text = re.sub(r'\b(ml|pk|fg|1h|2h|tt)\b', '', team_text, flags=re.I)
        team_text = team_text.strip()
        
        if team_text:
            team_candidates.append(team_text)
        
        if not team_candidates:
            return None
        
        # Find best matching game
        best_game = None
        best_score = 0
        
        for game in games:
            home_team = (game.get("home_team_full") or game.get("home_team", "")).lower()
            away_team = (game.get("away_team_full") or game.get("away_team", "")).lower()
            home_abbr = game.get("home_team", "").lower()
            away_abbr = game.get("away_team", "").lower()
            
            game_score = 0
            
            for candidate in team_candidates:
                score = 0
                
                # Check direct mapping
                if candidate in self.TEAM_ABBR_MAP:
                    _, abbr = self.TEAM_ABBR_MAP[candidate]
                    if abbr.lower() == home_abbr or abbr.lower() == away_abbr:
                        score = 100
                
                if score == 0:
                    # Exact substring match
                    all_teams = [home_team, away_team, home_abbr, away_abbr]
                    for t in all_teams:
                        if candidate == t:
                            score = max(score, 100)
                        elif candidate in t or t in candidate:
                            score = max(score, 90)
                        elif any(word in t for word in candidate.split() if len(word) > 2):
                            score = max(score, 70)
                
                game_score = max(game_score, score)
            
            if game_score > best_score:
                best_score = game_score
                best_game = game
        
        return best_game if best_score >= 50 else None
    
    def _get_half_scores(self, game: Dict, half: str, league: str = None) -> Optional[Dict]:
        """Get scores for a half.
        
        IMPORTANT: For betting, 2nd half INCLUDES overtime!
        
        Data format varies by league:
        - NBA: H1=Q1, H2=Q2, OT1, OT2, etc. (quarters stored as halves)
        - NCAAM/NCAAF: H1=actual 1st half, H2=actual 2nd half
        - NFL: Quarter scores only (Q1, Q2, Q3, Q4)
        
        For 2H bets: 2H = Final - 1H (includes OT)
        """
        half_scores = game.get("half_scores", {})
        quarter_scores = game.get("quarter_scores", {})
        league = league or game.get("league", "")
        
        # Check if this is a college game (actual halves) or pro game (quarters as halves)
        is_college = league in ["NCAAM", "NCAAF"]
        is_nba = league == "NBA"
        
        h1 = half_scores.get("H1", {})
        h2 = half_scores.get("H2", {})
        
        if is_college:
            # College games: H1 and H2 are actual half scores
            if half == "H1":
                if h1:
                    return h1
            elif half == "H2":
                # 2H = Final - 1H (includes any OT)
                if h1:
                    return {
                        "home": game.get("home_score", 0) - h1.get("home", 0),
                        "away": game.get("away_score", 0) - h1.get("away", 0)
                    }
            
        elif is_nba:
            # NBA: H1=Q1, H2=Q2, OT1, OT2, etc.
            # 1H = Q1 + Q2 (stored as H1 + H2 in our data)
            # 2H = Final - 1H (includes Q3, Q4, and any OT)
            
            if half == "H1":
                # First half = H1 + H2 (which is Q1 + Q2)
                if h1 and h2:
                    return {
                        "home": h1.get("home", 0) + h2.get("home", 0),
                        "away": h1.get("away", 0) + h2.get("away", 0)
                    }
                    
            elif half == "H2":
                # 2H = Final - 1H (includes OT for betting purposes)
                if h1 and h2:
                    first_half_home = h1.get("home", 0) + h2.get("home", 0)
                    first_half_away = h1.get("away", 0) + h2.get("away", 0)
                    
                    return {
                        "home": game.get("home_score", 0) - first_half_home,
                        "away": game.get("away_score", 0) - first_half_away
                    }
        
        # Fallback: Try quarters (for NFL or if half_scores empty)
        if half == "H1":
            q1 = quarter_scores.get("Q1", {})
            q2 = quarter_scores.get("Q2", {})
            if q1 and q2:
                return {
                    "home": q1.get("home", 0) + q2.get("home", 0),
                    "away": q1.get("away", 0) + q2.get("away", 0)
                }
        elif half == "H2":
            # 2H from quarters = Final - (Q1+Q2)
            q1 = quarter_scores.get("Q1", {})
            q2 = quarter_scores.get("Q2", {})
            if q1 and q2:
                first_half_home = q1.get("home", 0) + q2.get("home", 0)
                first_half_away = q1.get("away", 0) + q2.get("away", 0)
                return {
                    "home": game.get("home_score", 0) - first_half_home,
                    "away": game.get("away_score", 0) - first_half_away
                }
        
        return None
    
    def _format_score(self, game: Dict) -> str:
        """Format final score."""
        away = game.get("away_team_full") or game.get("away_team", "Away")
        home = game.get("home_team_full") or game.get("home_team", "Home")
        return f"{away} {game.get('away_score', 0)} - {home} {game.get('home_score', 0)}"
    
    def _format_half_score(self, game: Dict, half: str) -> Optional[str]:
        """Format half score."""
        half_scores = game.get("half_scores", {})
        if half not in half_scores:
            return None
        h = half_scores[half]
        away = game.get("away_team_full") or game.get("away_team", "Away")
        home = game.get("home_team_full") or game.get("home_team", "Home")
        return f"{away} {h.get('away', 0)} - {home} {h.get('home', 0)}"
    
    def export_results(self, picks: List[TrackerPick], output_path: str):
        """Export results to Excel."""
        data = []
        for p in picks:
            data.append({
                "Date": p.date,
                "League": p.league,
                "Segment": p.segment,
                "Pick": p.pick_description,
                "Final Score": p.final_score or "",
                "1H Score": p.half_score or "",
                "Actual Total": p.actual_total,
                "Existing Result": p.existing_result or "",
                "Evaluated Result": p.evaluated_result or "Pending",
                "Match": "✓" if p.existing_result == p.evaluated_result else "✗" if p.existing_result and p.evaluated_result else "",
                "P&L": float(p.pnl) if p.pnl else 0
            })
        
        df = pd.DataFrame(data)
        
        # Summary
        total = len(picks)
        evaluated = sum(1 for p in picks if p.evaluated_result and p.evaluated_result != "Pending")
        hits = sum(1 for p in picks if p.evaluated_result == "Hit")
        misses = sum(1 for p in picks if p.evaluated_result == "Miss")
        pushes = sum(1 for p in picks if p.evaluated_result == "Push")
        total_pnl = sum(p.pnl for p in picks if p.pnl is not None)
        
        # Accuracy check
        matches = sum(1 for p in picks if p.existing_result and p.evaluated_result == p.existing_result)
        with_existing = sum(1 for p in picks if p.existing_result and p.evaluated_result and p.evaluated_result != "Pending")
        
        summary_data = [{
            "Metric": "Total Picks",
            "Value": total
        }, {
            "Metric": "Evaluated",
            "Value": f"{evaluated} ({evaluated/total*100:.1f}%)"
        }, {
            "Metric": "Hits",
            "Value": hits
        }, {
            "Metric": "Misses",
            "Value": misses
        }, {
            "Metric": "Pushes",
            "Value": pushes
        }, {
            "Metric": "Win Rate",
            "Value": f"{hits/(hits+misses)*100:.1f}%" if hits+misses > 0 else "N/A"
        }, {
            "Metric": "Total P&L",
            "Value": f"${float(total_pnl):,.2f}"
        }, {
            "Metric": "Accuracy vs Tracker",
            "Value": f"{matches}/{with_existing} ({matches/with_existing*100:.1f}%)" if with_existing > 0 else "N/A"
        }]
        
        summary_df = pd.DataFrame(summary_data)
        
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Results", index=False)
            summary_df.to_excel(writer, sheet_name="Summary", index=False)
        
        print(f"\nExported to {output_path}")
        print(f"  Total: {total}, Evaluated: {evaluated}")
        print(f"  Hits: {hits}, Misses: {misses}, Pushes: {pushes}")
        print(f"  Win Rate: {hits/(hits+misses)*100:.1f}%" if hits+misses > 0 else "  Win Rate: N/A")
        print(f"  P&L: ${float(total_pnl):,.2f}")
        if with_existing > 0:
            print(f"  Accuracy vs Tracker: {matches}/{with_existing} ({matches/with_existing*100:.1f}%)")


def run_tracker_evaluation(
    tracker_path: str = r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx",
    sheet_name: str = "Master Schedule",
    date_range: Tuple[str, str] = ("2025-12-12", "2025-12-27"),
    output_path: str = "tracker_evaluation.xlsx"
):
    """Run tracker evaluation."""
    evaluator = TrackerEvaluator()
    picks = evaluator.evaluate_tracker(tracker_path, sheet_name, date_range)
    evaluator.export_results(picks, output_path)
    return picks


if __name__ == "__main__":
    run_tracker_evaluation()