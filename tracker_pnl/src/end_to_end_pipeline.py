"""
End-to-End Pick Processing Pipeline
Parses Telegram picks → Matches with box scores → Evaluates results → Exports to Excel
"""

import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from src.pick_tracker import Pick
from src.robust_telegram_parser import RobustTelegramParser
from src.box_score_database import BoxScoreDatabase
from src.team_registry import team_registry


@dataclass
class EvaluatedPick:
    """Pick with evaluation results."""
    # Original pick data
    date_time_cst: Optional[datetime] = None
    date: Optional[str] = None
    league: Optional[str] = None
    matchup: Optional[str] = None
    segment: Optional[str] = None
    pick_description: Optional[str] = None
    odds: Optional[str] = None
    
    # Calculated amounts
    risk_amount: Optional[Decimal] = None
    to_win_amount: Optional[Decimal] = None
    
    # Game data
    game_id: Optional[str] = None
    final_score: Optional[str] = None
    first_half_score: Optional[str] = None
    segment_score: Optional[int] = None
    
    # Evaluation
    status: str = "Pending"  # Hit, Miss, Push, Pending
    pnl: Optional[Decimal] = None
    
    BASE_UNIT = Decimal("50000.00")


class EndToEndPipeline:
    """Complete pick processing pipeline."""
    
    def __init__(self, db_path: str = "box_scores.db"):
        self.parser = RobustTelegramParser()
        self.db = BoxScoreDatabase(db_path)
        self.team_registry = team_registry
        
    def process_telegram_files(
        self,
        html_files: List[str],
        date_range: Tuple[str, str] = None,
        base_unit: Decimal = Decimal("50000.00")
    ) -> List[EvaluatedPick]:
        """
        Process Telegram HTML files end-to-end.
        
        Args:
            html_files: List of HTML file paths
            date_range: Optional (start_date, end_date) tuple
            base_unit: Base betting unit
            
        Returns:
            List of evaluated picks
        """
        # Step 1: Parse Telegram picks
        print("Step 1: Parsing Telegram messages...")
        raw_picks = self.parser.parse_files(html_files, date_range)
        print(f"  Parsed {len(raw_picks)} picks")
        
        # Step 2: Convert and evaluate
        print("\nStep 2: Matching with box scores and evaluating...")
        evaluated_picks = []
        
        for pick in raw_picks:
            eval_pick = self._evaluate_pick(pick, base_unit)
            evaluated_picks.append(eval_pick)
        
        # Summary
        hits = sum(1 for p in evaluated_picks if p.status == "Hit")
        misses = sum(1 for p in evaluated_picks if p.status == "Miss")
        pushes = sum(1 for p in evaluated_picks if p.status == "Push")
        pending = sum(1 for p in evaluated_picks if p.status == "Pending")
        
        print(f"\nResults:")
        print(f"  Hits: {hits}")
        print(f"  Misses: {misses}")
        print(f"  Pushes: {pushes}")
        print(f"  Pending: {pending}")
        
        # P&L
        total_pnl = sum(p.pnl for p in evaluated_picks if p.pnl is not None)
        print(f"\nTotal P&L: ${total_pnl:,.2f}")
        
        return evaluated_picks
    
    def _evaluate_pick(self, pick: Pick, base_unit: Decimal) -> EvaluatedPick:
        """Evaluate a single pick against box scores."""
        eval_pick = EvaluatedPick(
            date_time_cst=pick.date_time_cst,
            date=pick.date,
            league=pick.league,
            matchup=pick.matchup,
            segment=pick.segment or "FG",
            pick_description=pick.pick_description,
            odds=pick.odds
        )
        
        # Calculate bet amounts
        eval_pick.risk_amount, eval_pick.to_win_amount = self._calculate_bet_amounts(
            pick.odds, base_unit
        )
        
        # Find matching game
        game = self._find_matching_game(pick)
        if not game:
            eval_pick.status = "Pending"
            return eval_pick
        
        eval_pick.game_id = game.get("game_id")
        eval_pick.final_score = self._format_score(game)
        eval_pick.first_half_score = self._format_half_score(game, "H1")
        
        # Evaluate result
        eval_pick.status = self._determine_result(pick, game)
        
        # Calculate P&L
        if eval_pick.status == "Hit":
            eval_pick.pnl = eval_pick.to_win_amount
        elif eval_pick.status == "Miss":
            eval_pick.pnl = -eval_pick.risk_amount if eval_pick.risk_amount else Decimal(0)
        elif eval_pick.status == "Push":
            eval_pick.pnl = Decimal(0)
        
        return eval_pick
    
    def _calculate_bet_amounts(
        self, odds_str: Optional[str], base_unit: Decimal
    ) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        """Calculate risk and to_win amounts from odds."""
        if not odds_str:
            return base_unit, base_unit  # Default to even money
        
        try:
            odds = int(odds_str)
        except:
            return base_unit, base_unit
        
        if odds < 0:
            # Favorite: bet to WIN base_unit
            risk = base_unit * (abs(odds) / Decimal(100))
            to_win = base_unit
        else:
            # Underdog: bet to RISK base_unit
            risk = base_unit
            to_win = base_unit * (odds / Decimal(100))
        
        return risk, to_win
    
    def _find_matching_game(self, pick: Pick) -> Optional[Dict]:
        """Find matching game in box score database using multiple strategies."""
        if not pick.date or not pick.league:
            return None
        
        # Get games for date and league
        games = self.db.get_games_by_date(pick.date, pick.league)
        if not games:
            return None
        
        pick_desc = pick.pick_description or ""
        
        # Strategy 1: Extract team from pick description
        pick_team = self._extract_team_from_pick(pick_desc)
        
        # Strategy 2: Use matchup if available
        matchup_teams = []
        if pick.matchup:
            for sep in [" vs ", " @ ", "/"]:
                if sep in pick.matchup:
                    parts = pick.matchup.split(sep)
                    matchup_teams.extend([p.strip() for p in parts if p.strip()])
                    break
        
        # Strategy 3: For pure O/U, try to use matchup context
        is_pure_ou = ("over" in pick_desc.lower() or "under" in pick_desc.lower()) and not pick_team
        
        # Build list of candidate team names to search
        candidate_teams = []
        if pick_team:
            candidate_teams.append(pick_team)
        candidate_teams.extend(matchup_teams)
        
        # If still no candidates and pure O/U, we'll try fuzzy matching later
        
        # Find matching game using all candidates
        best_match = None
        best_score = 0
        
        for game in games:
            home_team = game.get("home_team_full") or game.get("home_team", "")
            away_team = game.get("away_team_full") or game.get("away_team", "")
            home_abbr = game.get("home_team", "")
            away_abbr = game.get("away_team", "")
            
            # Normalize game teams
            home_norm, _ = self.team_registry.normalize_team(home_team, pick.league)
            away_norm, _ = self.team_registry.normalize_team(away_team, pick.league)
            
            game_score = 0
            
            for candidate in candidate_teams:
                if not candidate:
                    continue
                    
                # Normalize candidate
                cand_norm, _ = self.team_registry.normalize_team(candidate, pick.league)
                cand_norm = cand_norm or candidate
                cand_lower = cand_norm.lower()
                cand_orig = candidate.lower()
                
                # Check against all representations of game teams
                team_strs = [
                    (home_norm or home_team).lower(),
                    (away_norm or away_team).lower(),
                    home_team.lower(),
                    away_team.lower(),
                    home_abbr.lower(),
                    away_abbr.lower()
                ]
                
                for team_str in team_strs:
                    # Exact match
                    if cand_lower == team_str:
                        game_score = max(game_score, 100)
                    # Substring match (normalized)
                    elif cand_lower in team_str or team_str in cand_lower:
                        game_score = max(game_score, 80)
                    # Substring match (original)
                    elif cand_orig in team_str or team_str in cand_orig:
                        game_score = max(game_score, 70)
                    else:
                        # Token overlap
                        cand_tokens = set(cand_lower.split())
                        team_tokens = set(team_str.split())
                        overlap = cand_tokens & team_tokens
                        if overlap:
                            game_score = max(game_score, 40 + len(overlap) * 10)
            
            # Also check common abbreviation mappings
            if game_score < 50:
                abbr_map = {
                    "brooklyn": "bkn", "nets": "bkn",
                    "dallas": "dal", "mavs": "dal", "mavericks": "dal",
                    "boston": "bos", "celtics": "bos",
                    "miami": "mia", "heat": "mia",
                    "lakers": "lal", "los angeles lakers": "lal",
                    "clippers": "lac", "los angeles clippers": "lac",
                    "warriors": "gs", "golden state": "gs",
                    "knicks": "ny", "new york": "ny",
                    "orlando": "orl", "magic": "orl",
                    "spurs": "sa", "san antonio": "sa",
                    "oklahoma": "okc", "thunder": "okc",
                    "detroit": "det", "pistons": "det",
                    "atlanta": "atl", "hawks": "atl",
                    "charlotte": "cha", "hornets": "cha",
                    "minnesota": "min", "timberwolves": "min",
                    "utah": "utah", "jazz": "utah",
                    "memphis": "mem", "grizzlies": "mem",
                    "chicago": "chi", "bulls": "chi",
                }
                
                for candidate in candidate_teams:
                    if not candidate:
                        continue
                    cand_lower = candidate.lower()
                    
                    for name, abbr in abbr_map.items():
                        if name in cand_lower:
                            if abbr == home_abbr.lower() or abbr == away_abbr.lower():
                                game_score = max(game_score, 90)
            
            if game_score > best_score:
                best_score = game_score
                best_match = game
        
        return best_match if best_score >= 40 else None
    
    def _extract_team_from_pick(self, pick_desc: str) -> Optional[str]:
        """Extract team name from pick description."""
        if not pick_desc:
            return None
        
        # Remove Over/Under, spread, odds
        clean = re.sub(r'\b(over|under)\b', '', pick_desc, flags=re.I)
        clean = re.sub(r'[-+]?\d+\.?\d*', '', clean)
        clean = re.sub(r'\b(ml|pk)\b', '', clean, flags=re.I)
        clean = clean.strip()
        
        return clean if clean else None
    
    def _determine_result(self, pick: Pick, game: Dict) -> str:
        """Determine Hit/Miss/Push for a pick."""
        pick_desc = (pick.pick_description or "").lower()
        segment = (pick.segment or "FG").upper()
        
        # Get relevant score
        if segment in ["1H", "FH"]:
            score = self._get_half_total(game, "H1")
        elif segment in ["2H", "SH"]:
            score = self._get_half_total(game, "H2")
        elif segment in ["1Q"]:
            score = self._get_quarter_total(game, "Q1")
        elif segment in ["2Q"]:
            score = self._get_quarter_total(game, "Q2")
        elif segment in ["3Q"]:
            score = self._get_quarter_total(game, "Q3")
        elif segment in ["4Q"]:
            score = self._get_quarter_total(game, "Q4")
        else:
            # Full game
            score = game.get("home_score", 0) + game.get("away_score", 0)
        
        if score is None:
            return "Pending"
        
        # Check pick type
        is_over = "over" in pick_desc
        is_under = "under" in pick_desc
        
        # Extract line value
        line_match = re.search(r'([-+]?\d+\.?\d*)', pick.pick_description or "")
        if not line_match:
            return "Pending"
        
        try:
            line = float(line_match.group(1))
        except:
            return "Pending"
        
        if is_over:
            if score > line:
                return "Hit"
            elif score < line:
                return "Miss"
            else:
                return "Push"
        
        elif is_under:
            if score < line:
                return "Hit"
            elif score > line:
                return "Miss"
            else:
                return "Push"
        
        else:
            # Spread bet - need to determine team and their performance
            team_name = self._extract_team_from_pick(pick.pick_description or "")
            if not team_name:
                return "Pending"
            
            # Determine if pick is for home or away team
            home_team = (game.get("home_team_full") or game.get("home_team", "")).lower()
            away_team = (game.get("away_team_full") or game.get("away_team", "")).lower()
            team_name_lower = team_name.lower()
            
            is_home = team_name_lower in home_team or home_team in team_name_lower
            is_away = team_name_lower in away_team or away_team in team_name_lower
            
            # Get scores based on segment
            if segment in ["1H", "FH"]:
                scores = self._get_half_scores(game, "H1")
            elif segment in ["2H", "SH"]:
                scores = self._get_half_scores(game, "H2")
            else:
                scores = {"home": game.get("home_score", 0), "away": game.get("away_score", 0)}
            
            if not scores:
                return "Pending"
            
            home_score = scores.get("home", 0)
            away_score = scores.get("away", 0)
            
            # Check if ML (moneyline) - typically large numbers
            if "ml" in pick_desc or abs(line) > 50:
                if is_home:
                    return "Hit" if home_score > away_score else "Miss"
                elif is_away:
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
            elif is_away:
                adjusted = away_score + line
                if adjusted > home_score:
                    return "Hit"
                elif adjusted < home_score:
                    return "Miss"
                else:
                    return "Push"
        
        return "Pending"
    
    def _get_half_total(self, game: Dict, half: str) -> Optional[int]:
        """Get total score for a half."""
        half_scores = game.get("half_scores", {})
        if half in half_scores:
            h = half_scores[half]
            return h.get("home", 0) + h.get("away", 0)
        return None
    
    def _get_half_scores(self, game: Dict, half: str) -> Optional[Dict]:
        """Get home/away scores for a half."""
        half_scores = game.get("half_scores", {})
        return half_scores.get(half)
    
    def _get_quarter_total(self, game: Dict, quarter: str) -> Optional[int]:
        """Get total score for a quarter."""
        quarter_scores = game.get("quarter_scores", {})
        if quarter in quarter_scores:
            q = quarter_scores[quarter]
            return q.get("home", 0) + q.get("away", 0)
        return None
    
    def _format_score(self, game: Dict) -> str:
        """Format final score string."""
        away = game.get("away_team_full") or game.get("away_team", "Away")
        home = game.get("home_team_full") or game.get("home_team", "Home")
        away_score = game.get("away_score", 0)
        home_score = game.get("home_score", 0)
        return f"{away} {away_score} - {home} {home_score}"
    
    def _format_half_score(self, game: Dict, half: str) -> Optional[str]:
        """Format half score string."""
        half_scores = game.get("half_scores", {})
        if half not in half_scores:
            return None
        
        h = half_scores[half]
        away = game.get("away_team_full") or game.get("away_team", "Away")
        home = game.get("home_team_full") or game.get("home_team", "Home")
        return f"{away} {h.get('away', 0)} - {home} {h.get('home', 0)}"
    
    def export_to_excel(
        self,
        picks: List[EvaluatedPick],
        output_path: str,
        include_summary: bool = True
    ):
        """Export evaluated picks to Excel."""
        print(f"\nExporting to {output_path}...")
        
        # Convert to DataFrame
        data = []
        for p in picks:
            data.append({
                "Date & Time (CST)": p.date_time_cst.strftime("%m/%d/%Y %H:%M") if p.date_time_cst else "",
                "Date": p.date or "",
                "League": p.league or "",
                "Matchup": p.matchup or "",
                "Segment": p.segment or "FG",
                "Pick (Odds)": f"{p.pick_description} ({p.odds})" if p.odds else p.pick_description or "",
                "Risk ($)": float(p.risk_amount) if p.risk_amount else 0,
                "To Win ($)": float(p.to_win_amount) if p.to_win_amount else 0,
                "Final Score": p.final_score or "",
                "1H Score": p.first_half_score or "",
                "Hit/Miss/Push": p.status,
                "P&L ($)": float(p.pnl) if p.pnl else 0
            })
        
        df = pd.DataFrame(data)
        
        # Sort by date
        df["Date_Sort"] = pd.to_datetime(df["Date"], errors="coerce")
        df = df.sort_values("Date_Sort", ascending=True)
        df = df.drop("Date_Sort", axis=1)
        
        # Create summary
        if include_summary:
            summary = self._create_summary(picks)
            
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                df.to_excel(writer, sheet_name="Picks", index=False)
                summary.to_excel(writer, sheet_name="Summary", index=False)
        else:
            df.to_excel(output_path, index=False)
        
        print(f"  Exported {len(picks)} picks")
    
    def _create_summary(self, picks: List[EvaluatedPick]) -> pd.DataFrame:
        """Create summary statistics DataFrame."""
        summary_data = []
        
        # Overall
        total = len(picks)
        hits = sum(1 for p in picks if p.status == "Hit")
        misses = sum(1 for p in picks if p.status == "Miss")
        pushes = sum(1 for p in picks if p.status == "Push")
        pending = sum(1 for p in picks if p.status == "Pending")
        total_pnl = sum(p.pnl for p in picks if p.pnl is not None)
        
        summary_data.append({
            "Category": "Overall",
            "Total Picks": total,
            "Hits": hits,
            "Misses": misses,
            "Pushes": pushes,
            "Pending": pending,
            "Win Rate": f"{hits/(hits+misses)*100:.1f}%" if (hits+misses) > 0 else "N/A",
            "Total P&L": float(total_pnl)
        })
        
        # By League
        leagues = set(p.league for p in picks if p.league)
        for league in sorted(leagues):
            league_picks = [p for p in picks if p.league == league]
            l_hits = sum(1 for p in league_picks if p.status == "Hit")
            l_misses = sum(1 for p in league_picks if p.status == "Miss")
            l_pushes = sum(1 for p in league_picks if p.status == "Push")
            l_pending = sum(1 for p in league_picks if p.status == "Pending")
            l_pnl = sum(p.pnl for p in league_picks if p.pnl is not None)
            
            summary_data.append({
                "Category": f"League: {league}",
                "Total Picks": len(league_picks),
                "Hits": l_hits,
                "Misses": l_misses,
                "Pushes": l_pushes,
                "Pending": l_pending,
                "Win Rate": f"{l_hits/(l_hits+l_misses)*100:.1f}%" if (l_hits+l_misses) > 0 else "N/A",
                "Total P&L": float(l_pnl)
            })
        
        # By Segment
        segments = set(p.segment for p in picks if p.segment)
        for segment in sorted(segments):
            seg_picks = [p for p in picks if p.segment == segment]
            s_hits = sum(1 for p in seg_picks if p.status == "Hit")
            s_misses = sum(1 for p in seg_picks if p.status == "Miss")
            s_pushes = sum(1 for p in seg_picks if p.status == "Push")
            s_pending = sum(1 for p in seg_picks if p.status == "Pending")
            s_pnl = sum(p.pnl for p in seg_picks if p.pnl is not None)
            
            summary_data.append({
                "Category": f"Segment: {segment}",
                "Total Picks": len(seg_picks),
                "Hits": s_hits,
                "Misses": s_misses,
                "Pushes": s_pushes,
                "Pending": s_pending,
                "Win Rate": f"{s_hits/(s_hits+s_misses)*100:.1f}%" if (s_hits+s_misses) > 0 else "N/A",
                "Total P&L": float(s_pnl)
            })
        
        return pd.DataFrame(summary_data)


def run_pipeline(
    telegram_files: List[str] = None,
    date_range: Tuple[str, str] = None,
    output_excel: str = "pick_results.xlsx",
    base_unit: Decimal = Decimal("50000.00")
):
    """Run the complete end-to-end pipeline."""
    if telegram_files is None:
        telegram_files = [
            "telegram_text_history_data/messages.html",
            "telegram_text_history_data/messages2.html"
        ]
    
    pipeline = EndToEndPipeline()
    
    # Process picks
    picks = pipeline.process_telegram_files(
        telegram_files,
        date_range=date_range,
        base_unit=base_unit
    )
    
    # Export results
    pipeline.export_to_excel(picks, output_excel)
    
    return picks


if __name__ == "__main__":
    # Default run
    run_pipeline(
        date_range=("2025-12-12", "2025-12-27"),
        output_excel="pick_results.xlsx"
    )