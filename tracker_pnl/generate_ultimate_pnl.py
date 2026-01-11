"""
ULTIMATE P&L REPORT - Maximum Accuracy & Completion
Uses tracker_evaluator logic + enhanced matching for comprehensive results.
"""

import pandas as pd
import re
import sqlite3
import json
from decimal import Decimal
from typing import Dict, Optional, List
from datetime import datetime
import numpy as np

# Import tracker evaluator for its matching logic
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from src.tracker_evaluator import TrackerEvaluator, TrackerPick
from src.box_score_database import BoxScoreDatabase


class UltimatePnlEvaluator:
    """Ultimate P&L evaluator with maximum accuracy."""
    
    def __init__(self):
        self.db = BoxScoreDatabase("box_scores.db")
        self.tracker_eval = TrackerEvaluator()
        # Use the comprehensive team mapping from tracker_evaluator
        self.TEAM_ABBR_MAP = self.tracker_eval.TEAM_ABBR_MAP
    
    def find_game_ultimate(self, date: str, league: str, pick_desc: str, matchup: str = None) -> Optional[Dict]:
        """Ultimate game finding with all matching strategies."""
        games = self.db.get_games_by_date(date, league)
        if not games:
            return None
        
        # Load half/quarter scores for all games
        conn = sqlite3.connect("box_scores.db")
        cursor = conn.cursor()
        
        for game in games:
            game_id = game.get("game_id")
            if not game_id:
                continue
            
            # Load quarter scores
            cursor.execute("""
                SELECT quarter, home_score, away_score FROM quarter_scores
                WHERE game_id = ? AND league = ?
            """, (game_id, league))
            quarter_scores = {}
            for qrow in cursor.fetchall():
                quarter_scores[qrow[0]] = {"home": qrow[1], "away": qrow[2]}
            game["quarter_scores"] = quarter_scores
            
            # Load half scores
            cursor.execute("""
                SELECT half, home_score, away_score FROM half_scores
                WHERE game_id = ? AND league = ?
            """, (game_id, league))
            half_scores = {}
            for hrow in cursor.fetchall():
                half_scores[hrow[0]] = {"home": hrow[1], "away": hrow[2]}
            game["half_scores"] = half_scores
        
        conn.close()
        
        # Build team candidates from multiple sources
        team_candidates = []
        
        # 1. Use matchup if available
        if matchup and not pd.isna(matchup):
            matchup_str = str(matchup).strip()
            if matchup_str:
                for sep in [" @ ", " vs ", " v ", " at "]:
                    if sep in matchup_str:
                        parts = [p.strip().lower() for p in matchup_str.split(sep)]
                        team_candidates.extend(parts)
                        break
        
        # 2. Extract team from pick description
        pick_lower = pick_desc.lower()
        
        # Remove common betting terms
        team_text = re.sub(r'\b(over|under|o|u)\s*\d+\.?\d*\b', '', pick_lower)
        team_text = re.sub(r'[-+]?\d+\.?\d*', '', team_text)
        team_text = re.sub(r'\(.*?\)', '', team_text)
        team_text = re.sub(r'\b(ml|pk|fg|1h|2h|tt|moneyline)\b', '', team_text, flags=re.I)
        team_text = team_text.strip()
        
        if team_text and len(team_text) > 2:
            team_candidates.append(team_text)
        
        # 3. Try to extract team name before spread/total
        # Pattern: "Team Name +3.5" or "Team Name Over 220"
        team_match = re.match(r'^([A-Za-z][A-Za-z\s&\'.,-]+?)(?:\s+[+-]?\d|over|under|ml)', pick_lower)
        if team_match:
            team_name = team_match.group(1).strip()
            if len(team_name) > 2:
                team_candidates.append(team_name)
        
        # 4. For Over/Under without team, try to infer from context
        if not team_candidates and ("over" in pick_lower or "under" in pick_lower):
            # If only one game, use it
            if len(games) == 1:
                return games[0]
            # Otherwise, we'll need to match differently
        
        if not team_candidates:
            # Last resort: if only one game, return it
            if len(games) == 1:
                return games[0]
            return None
        
        # Score each game
        best_game = None
        best_score = 0
        
        for game in games:
            home_team = (game.get("home_team_full") or game.get("home_team", "")).lower()
            away_team = (game.get("away_team_full") or game.get("away_team", "")).lower()
            home_abbr = (game.get("home_team") or "").lower()
            away_abbr = (game.get("away_team") or "").lower()
            
            game_score = 0
            
            for candidate in team_candidates:
                score = 0
                
                # Check TEAM_ABBR_MAP first
                if candidate in self.TEAM_ABBR_MAP:
                    _, abbr = self.TEAM_ABBR_MAP[candidate]
                    if abbr.lower() == home_abbr or abbr.lower() == away_abbr:
                        score = 100
                
                if score == 0:
                    # Exact match
                    all_teams = [home_team, away_team, home_abbr, away_abbr]
                    for t in all_teams:
                        if not t:
                            continue
                        if candidate == t:
                            score = max(score, 100)
                        elif candidate in t or t in candidate:
                            score = max(score, 90)
                        elif any(word in t for word in candidate.split() if len(word) > 2):
                            score = max(score, 70)
                        # Check individual words
                        candidate_words = [w for w in candidate.split() if len(w) > 2]
                        team_words = [w for w in t.split() if len(w) > 2]
                        if candidate_words and team_words:
                            overlap = len(set(candidate_words) & set(team_words))
                            if overlap > 0:
                                score = max(score, 60 + overlap * 10)
                
                game_score = max(game_score, score)
            
            if game_score > best_score:
                best_score = game_score
                best_game = game
        
        return best_game if best_score >= 50 else (games[0] if len(games) == 1 else None)
    
    def get_half_scores_ultimate(self, game: Dict, half: str, league: str) -> Optional[Dict]:
        """Get half scores using tracker_evaluator logic."""
        return self.tracker_eval._get_half_scores(game, half, league)
    
    def evaluate_pick_ultimate(self, pick_desc: str, segment: str, game: Dict, league: str, matchup: str = None) -> str:
        """Evaluate pick using tracker_evaluator logic."""
        if not game:
            return "No Game"
        
        # Handle NaN matchup
        matchup_str = None
        if matchup and not pd.isna(matchup):
            matchup_str = str(matchup).strip()
            if not matchup_str or matchup_str.lower() == 'nan':
                matchup_str = None
        
        # Create a TrackerPick for evaluation
        pick = TrackerPick(
            date=game.get("date", ""),
            league=league,
            matchup=matchup_str,
            segment=segment,
            pick_description=pick_desc,
            odds=None,
            risk=Decimal("100"),
            to_win=Decimal("90"),
            existing_result=None
        )
        
        # Manually evaluate instead of calling _evaluate_pick (which calls _find_game again)
        # We already have the game, so use _evaluate_spread logic directly
        pick_desc_lower = pick_desc.lower()
        
        # Get scores based on segment
        # Normalize segment format
        if segment in ["1H", "H1"]:
            scores = self.tracker_eval._get_half_scores(game, "H1", league)
        elif segment in ["2H", "H2"]:
            scores = self.tracker_eval._get_half_scores(game, "H2", league)
        else:
            scores = {"home": game.get("home_score", 0) or 0, "away": game.get("away_score", 0) or 0}
        
        if not scores:
            return "No Half Data"
        
        total = scores["home"] + scores["away"]
        
        # Parse pick type
        is_over = "over" in pick_desc_lower or re.search(r'\bo\d', pick_desc_lower)
        is_under = "under" in pick_desc_lower or re.search(r'\bu\d', pick_desc_lower)
        is_ml = "ml" in pick_desc_lower
        
        # Extract line value
        line_match = re.search(r'([+-]?\d+\.?\d*)', pick_desc, re.I)
        if not line_match and not is_ml:
            return "Pending"
        
        try:
            line = float(line_match.group(1)) if line_match else 0
        except:
            if not is_ml:
                return "Pending"
            line = 0
        
        if is_over and not is_ml:
            if total > line:
                return "Hit"
            elif total < line:
                return "Miss"
            else:
                return "Push"
        elif is_under and not is_ml:
            if total < line:
                return "Hit"
            elif total > line:
                return "Miss"
            else:
                return "Push"
        elif is_ml:
            # Moneyline - use _evaluate_spread with 0 spread
            return self.tracker_eval._evaluate_spread(pick, game, scores, 0)
        else:
            # Spread bet
            return self.tracker_eval._evaluate_spread(pick, game, scores, line)
    
    def process_telegram_picks(self, picks_df: pd.DataFrame) -> pd.DataFrame:
        """Process all Telegram picks with ultimate matching."""
        results = []
        
        for idx, row in picks_df.iterrows():
            date = row.get("date")
            league = row.get("league")
            segment = row.get("segment", "FG")
            pick_desc = str(row.get("pick", ""))
            matchup = row.get("matchup")
            
            result_row = {
                "date": date,
                "league": league,
                "segment": segment,
                "matchup": matchup,
                "pick": pick_desc,
                "odds": row.get("odds"),
                "final_score": None,
                "half_score": None,
                "result": "Pending",
                "pnl": None
            }
            
            # Skip if no date/league
            if pd.isna(date) or pd.isna(league):
                result_row["result"] = "No Date/League"
                results.append(result_row)
                continue
            
            date_str = str(date)[:10]
            
            # Find game with ultimate matching
            game = self.find_game_ultimate(date_str, league, pick_desc, matchup)
            
            if not game:
                result_row["result"] = "No Game Found"
                results.append(result_row)
                continue
            
            # Get scores
            result_row["final_score"] = f"{game.get('away_score', 0)}-{game.get('home_score', 0)}"
            
            # Get half scores if needed
            if segment in ["1H", "H1", "2H", "H2"]:
                # Normalize segment format for tracker_evaluator (expects "H1" or "H2")
                half_key = "H1" if segment in ["1H", "H1"] else "H2"
                half_scores = self.get_half_scores_ultimate(game, half_key, league)
                if half_scores:
                    result_row["half_score"] = f"{half_scores.get('away', 0)}-{half_scores.get('home', 0)}"
                else:
                    result_row["result"] = "No Half Data"
                    results.append(result_row)
                    continue
            
            # Evaluate pick
            result = self.evaluate_pick_ultimate(pick_desc, segment, game, league, matchup)
            result_row["result"] = result
            
            # Calculate P&L (use odds if available, otherwise default)
            odds_str = row.get("odds")
            if result == "Hit":
                if odds_str:
                    try:
                        odds = int(str(odds_str).replace("+", ""))
                        if odds > 0:
                            result_row["pnl"] = 100 * (odds / 100)
                        else:
                            result_row["pnl"] = 100 * (100 / abs(odds))
                    except:
                        result_row["pnl"] = 90  # Default -110
                else:
                    result_row["pnl"] = 90
            elif result == "Miss":
                result_row["pnl"] = -100
            elif result == "Push":
                result_row["pnl"] = 0
            else:
                result_row["pnl"] = None
            
            results.append(result_row)
        
        return pd.DataFrame(results)


def main():
    print("="*80)
    print("ULTIMATE P&L REPORT: 12/11/2025 - 1/6/2026")
    print("Maximum Accuracy & Completion")
    print("="*80)
    
    # Load Telegram picks
    print("\nLoading Telegram picks...")
    df = pd.read_excel("pnl_report_12_11_to_01_06.xlsx", sheet_name="Picks")
    print(f"  Loaded {len(df)} picks")
    
    # Initialize evaluator
    evaluator = UltimatePnlEvaluator()
    
    # Process all picks
    print("\nEvaluating picks with ultimate matching...")
    results_df = evaluator.process_telegram_picks(df)
    
    # Statistics
    hits = len(results_df[results_df["result"] == "Hit"])
    misses = len(results_df[results_df["result"] == "Miss"])
    pushes = len(results_df[results_df["result"] == "Push"])
    evaluated = hits + misses + pushes
    
    no_game = len(results_df[results_df["result"] == "No Game Found"])
    no_half = len(results_df[results_df["result"] == "No Half Data"])
    no_date = len(results_df[results_df["result"] == "No Date/League"])
    pending = len(results_df[results_df["result"] == "Pending"])
    
    total_pnl = results_df["pnl"].dropna().sum()
    win_rate = (hits / (hits + misses) * 100) if hits + misses > 0 else 0
    
    # Print comprehensive summary
    print(f"\n{'='*80}")
    print("COMPREHENSIVE SUMMARY")
    print(f"{'='*80}")
    print(f"Total Picks:           {len(results_df)}")
    print(f"  [OK] Evaluated:        {evaluated} ({evaluated/len(results_df)*100:.1f}%)")
    print(f"     Hits:            {hits}")
    print(f"     Misses:          {misses}")
    print(f"     Pushes:           {pushes}")
    print(f"  [WARN] Not Evaluated:   {len(results_df) - evaluated} ({(len(results_df)-evaluated)/len(results_df)*100:.1f}%)")
    print(f"     No Game Found:    {no_game}")
    print(f"     No Half Data:     {no_half}")
    print(f"     No Date/League:   {no_date}")
    print(f"     Pending:          {pending}")
    
    print(f"\nWin Rate: {win_rate:.1f}%")
    print(f"Total P&L: ${total_pnl:,.2f}")
    
    # By League
    print(f"\n{'='*80}")
    print("BY LEAGUE")
    print(f"{'='*80}")
    for league in ["NFL", "NBA", "NCAAF", "NCAAM"]:
        league_df = results_df[results_df["league"] == league]
        l_hits = len(league_df[league_df["result"] == "Hit"])
        l_misses = len(league_df[league_df["result"] == "Miss"])
        l_pushes = len(league_df[league_df["result"] == "Push"])
        l_eval = l_hits + l_misses + l_pushes
        l_pnl = league_df["pnl"].dropna().sum()
        l_total = len(league_df)
        
        if l_hits + l_misses > 0:
            l_wr = l_hits / (l_hits + l_misses) * 100
            print(f"  {league:6} | {l_eval:3}/{l_total:3} ({l_eval/l_total*100:5.1f}%) | {l_hits:3}W-{l_misses:3}L-{l_pushes:1}P | {l_wr:5.1f}% | ${l_pnl:+,.0f}")
        else:
            print(f"  {league:6} | {l_eval:3}/{l_total:3} ({l_eval/l_total*100:5.1f}%) | No evaluated picks")
    
    # By Segment
    print(f"\n{'='*80}")
    print("BY SEGMENT")
    print(f"{'='*80}")
    for segment in ["FG", "1H", "2H"]:
        seg_df = results_df[results_df["segment"] == segment]
        s_hits = len(seg_df[seg_df["result"] == "Hit"])
        s_misses = len(seg_df[seg_df["result"] == "Miss"])
        s_pushes = len(seg_df[seg_df["result"] == "Push"])
        s_eval = s_hits + s_misses + s_pushes
        s_pnl = seg_df["pnl"].dropna().sum()
        s_total = len(seg_df)
        
        if s_hits + s_misses > 0:
            s_wr = s_hits / (s_hits + s_misses) * 100
            print(f"  {segment:6} | {s_eval:3}/{s_total:3} ({s_eval/s_total*100:5.1f}%) | {s_hits:3}W-{s_misses:3}L-{s_pushes:1}P | {s_wr:5.1f}% | ${s_pnl:+,.0f}")
    
    # Export
    output_file = "ultimate_pnl_report.xlsx"
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        results_df.to_excel(writer, sheet_name="All Picks", index=False)
        
        # Summary sheet
        summary_data = [
            ["Period", "12/11/2025 - 1/6/2026"],
            ["Total Picks", len(results_df)],
            ["Evaluated", evaluated],
            ["Evaluation Rate", f"{evaluated/len(results_df)*100:.1f}%"],
            ["Hits", hits],
            ["Misses", misses],
            ["Pushes", pushes],
            ["Win Rate", f"{win_rate:.1f}%"],
            ["Total P&L", f"${total_pnl:,.2f}"],
            ["", ""],
            ["Not Evaluated Breakdown", ""],
            ["No Game Found", no_game],
            ["No Half Data", no_half],
            ["No Date/League", no_date],
            ["Pending", pending]
        ]
        summary_df = pd.DataFrame(summary_data, columns=["Metric", "Value"])
        summary_df.to_excel(writer, sheet_name="Summary", index=False)
        
        # By League breakdown
        league_summary = []
        for league in ["NFL", "NBA", "NCAAF", "NCAAM"]:
            league_df = results_df[results_df["league"] == league]
            l_hits = len(league_df[league_df["result"] == "Hit"])
            l_misses = len(league_df[league_df["result"] == "Miss"])
            l_pushes = len(league_df[league_df["result"] == "Push"])
            l_eval = l_hits + l_misses + l_pushes
            l_pnl = league_df["pnl"].dropna().sum()
            l_wr = (l_hits / (l_hits + l_misses) * 100) if l_hits + l_misses > 0 else 0
            league_summary.append({
                "League": league,
                "Total": len(league_df),
                "Evaluated": l_eval,
                "Eval Rate": f"{l_eval/len(league_df)*100:.1f}%" if len(league_df) > 0 else "0%",
                "Hits": l_hits,
                "Misses": l_misses,
                "Pushes": l_pushes,
                "Win Rate": f"{l_wr:.1f}%",
                "P&L": f"${l_pnl:,.2f}"
            })
        league_df_summary = pd.DataFrame(league_summary)
        league_df_summary.to_excel(writer, sheet_name="By League", index=False)
    
    print(f"\n{'='*80}")
    print(f"[SUCCESS] Exported to: {output_file}")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
