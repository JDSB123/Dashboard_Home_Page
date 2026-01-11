"""
Improved alignment engine for matching Telegram picks with tracker data.
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

import pandas as pd

from src.team_registry import team_registry


def normalize_for_comparison(text: str) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    # Lowercase, remove special chars except +/-
    text = str(text).lower()
    text = re.sub(r'[^\w\s+\-.]', '', text)
    return text.strip()


def extract_spread(pick_text: str) -> Optional[float]:
    """Extract numeric spread from pick text."""
    if not pick_text:
        return None
    match = re.search(r'([-+]?\d+\.?\d*)', str(pick_text))
    if match:
        try:
            return float(match.group(1))
        except:
            pass
    return None


def extract_team_from_pick(pick_text: str) -> str:
    """Extract team name from pick description."""
    if not pick_text:
        return ""
    # Remove spread, odds, over/under indicators
    clean = re.sub(r'([-+]?\d+\.?\d*)', '', str(pick_text))
    clean = re.sub(r'\b(over|under|ml|pk)\b', '', clean, flags=re.I)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def extract_team_from_matchup(matchup_text: str) -> Tuple[str, str]:
    """Extract teams from matchup string."""
    if not matchup_text:
        return "", ""
    
    matchup = str(matchup_text)
    
    # Format: "Team1 @ Team2" or "Team1 vs Team2"
    if "@" in matchup:
        parts = matchup.split("@")
    elif " vs " in matchup.lower():
        parts = re.split(r'\s+vs\.?\s+', matchup, flags=re.I)
    else:
        return matchup.strip(), ""
    
    if len(parts) >= 2:
        return parts[0].strip(), parts[1].strip()
    return matchup.strip(), ""


def is_over_under(pick_text: str) -> Tuple[bool, Optional[str]]:
    """Check if pick is over/under and return type."""
    if not pick_text:
        return False, None
    text_lower = str(pick_text).lower()
    if "over" in text_lower or text_lower.startswith("o"):
        return True, "over"
    if "under" in text_lower or text_lower.startswith("u"):
        return True, "under"
    return False, None


def normalize_segment(segment: str) -> str:
    """Normalize segment string."""
    if not segment:
        return "FG"
    segment = str(segment).upper().strip()
    mappings = {
        "FH": "1H", "FIRST HALF": "1H", "1ST HALF": "1H",
        "SH": "2H", "SECOND HALF": "2H", "2ND HALF": "2H",
        "FULL": "FG", "FULL GAME": "FG", "GAME": "FG",
    }
    return mappings.get(segment, segment)


def calculate_match_score(tracker_row: pd.Series, telegram_row: pd.Series) -> float:
    """Calculate match score between tracker and telegram rows."""
    score = 0.0
    
    # 1. Date matching (25%)
    tracker_date = pd.to_datetime(tracker_row.get("Date"), errors="coerce")
    telegram_date = pd.to_datetime(telegram_row.get("date"), errors="coerce")
    
    if pd.notna(tracker_date) and pd.notna(telegram_date):
        days_diff = abs((tracker_date - telegram_date).days)
        if days_diff == 0:
            score += 0.25
        elif days_diff == 1:
            score += 0.15
    
    # 2. Pick type matching - Over/Under vs Spread (20%)
    tracker_pick = str(tracker_row.get("Pick (Odds)", ""))
    telegram_pick = str(telegram_row.get("pick_description", ""))
    
    tracker_is_ou, tracker_ou_type = is_over_under(tracker_pick)
    telegram_is_ou, telegram_ou_type = is_over_under(telegram_pick)
    
    if tracker_is_ou == telegram_is_ou:
        score += 0.1
        if tracker_is_ou and tracker_ou_type == telegram_ou_type:
            score += 0.1
    
    # 3. Spread/Total matching (25%)
    tracker_spread = extract_spread(tracker_pick)
    telegram_spread = extract_spread(telegram_pick)
    
    if tracker_spread is not None and telegram_spread is not None:
        diff = abs(tracker_spread - telegram_spread)
        if diff == 0:
            score += 0.25
        elif diff <= 0.5:
            score += 0.20
        elif diff <= 1.0:
            score += 0.15
        elif diff <= 2.0:
            score += 0.10
        elif diff <= 3.0:
            score += 0.05
    
    # 4. Team matching (20%)
    tracker_matchup = str(tracker_row.get("Matchup", ""))
    tracker_team = extract_team_from_pick(tracker_pick)
    telegram_team = extract_team_from_pick(telegram_pick)
    
    # Try to match team names
    team1, team2 = extract_team_from_matchup(tracker_matchup)
    
    # Check if telegram team matches either team in matchup
    telegram_team_norm = normalize_for_comparison(telegram_team)
    team1_norm = normalize_for_comparison(team1)
    team2_norm = normalize_for_comparison(team2)
    tracker_team_norm = normalize_for_comparison(tracker_team)
    
    # Use team registry for normalization
    tg_canonical, _ = team_registry.normalize_team(telegram_team)
    t1_canonical, _ = team_registry.normalize_team(team1)
    t2_canonical, _ = team_registry.normalize_team(team2)
    
    if tg_canonical:
        if tg_canonical == t1_canonical or tg_canonical == t2_canonical:
            score += 0.20
        elif tg_canonical.lower() in team1.lower() or tg_canonical.lower() in team2.lower():
            score += 0.15
    elif telegram_team_norm:
        # Fuzzy match
        sim1 = SequenceMatcher(None, telegram_team_norm, team1_norm).ratio()
        sim2 = SequenceMatcher(None, telegram_team_norm, team2_norm).ratio()
        sim3 = SequenceMatcher(None, telegram_team_norm, tracker_team_norm).ratio()
        best_sim = max(sim1, sim2, sim3)
        score += 0.20 * best_sim
    
    # 5. Segment matching (10%)
    tracker_segment = normalize_segment(tracker_row.get("Segment", ""))
    telegram_segment = normalize_segment(telegram_row.get("segment", ""))
    
    if tracker_segment == telegram_segment:
        score += 0.10
    elif (tracker_segment in ["1H", "2H"] and telegram_segment in ["1H", "2H"]):
        score += 0.05  # At least both are half bets
    
    return score


def align_picks(tracker_df: pd.DataFrame, telegram_df: pd.DataFrame,
                score_threshold: float = 0.5) -> pd.DataFrame:
    """Align tracker picks with Telegram picks."""
    results = []
    
    for idx, tracker_row in tracker_df.iterrows():
        # Get tracker date
        tracker_date = pd.to_datetime(tracker_row.get("Date"), errors="coerce")
        
        # Filter telegram picks by date (same day +/- 1)
        if pd.notna(tracker_date):
            telegram_df_copy = telegram_df.copy()
            telegram_df_copy["date"] = pd.to_datetime(telegram_df_copy["date"], errors="coerce")
            
            date_mask = (
                (telegram_df_copy["date"] >= tracker_date - pd.Timedelta(days=1)) &
                (telegram_df_copy["date"] <= tracker_date + pd.Timedelta(days=1))
            )
            candidates = telegram_df_copy[date_mask]
        else:
            candidates = telegram_df
        
        best_score = 0.0
        best_match = None
        best_idx = None
        
        for tg_idx, telegram_row in candidates.iterrows():
            score = calculate_match_score(tracker_row, telegram_row)
            if score > best_score:
                best_score = score
                best_match = telegram_row
                best_idx = tg_idx
        
        result = {
            "tracker_idx": idx,
            "tracker_date": tracker_row.get("Date"),
            "tracker_league": tracker_row.get("League"),
            "tracker_matchup": tracker_row.get("Matchup"),
            "tracker_pick": tracker_row.get("Pick (Odds)"),
            "tracker_segment": tracker_row.get("Segment"),
            "match_score": best_score,
            "matched": best_score >= score_threshold
        }
        
        if best_match is not None:
            result.update({
                "telegram_idx": best_idx,
                "telegram_date": best_match.get("date"),
                "telegram_pick": best_match.get("pick_description"),
                "telegram_segment": best_match.get("segment"),
                "telegram_league": best_match.get("league")
            })
        
        results.append(result)
    
    return pd.DataFrame(results)


def generate_detailed_report(alignment_df: pd.DataFrame) -> str:
    """Generate detailed alignment report."""
    report = []
    
    total = len(alignment_df)
    matched = alignment_df[alignment_df["matched"]].copy()
    
    report.append("=" * 80)
    report.append("ALIGNMENT REPORT")
    report.append("=" * 80)
    report.append(f"\nTotal tracker rows: {total}")
    report.append(f"Matched (score >= 0.5): {len(matched)} ({len(matched)/total*100:.1f}%)")
    
    # Score distribution
    report.append("\nScore distribution:")
    for threshold in [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]:
        count = len(alignment_df[alignment_df["match_score"] >= threshold])
        report.append(f"  >= {threshold}: {count}")
    
    # High quality matches
    high_quality = alignment_df[alignment_df["match_score"] >= 0.7]
    if len(high_quality) > 0:
        report.append(f"\nHigh quality matches (>= 0.7): {len(high_quality)}")
        report.append("\nExamples:")
        for _, row in high_quality.head(5).iterrows():
            report.append(f"  TRACKER: {row['tracker_matchup'][:30]} | {row['tracker_pick']} | {row['tracker_segment']}")
            report.append(f"  TELEGRAM: {row.get('telegram_pick', 'N/A')} | {row.get('telegram_segment', 'N/A')}")
            report.append(f"  Score: {row['match_score']:.2f}")
            report.append("")
    
    # Unmatched examples
    unmatched = alignment_df[~alignment_df["matched"]]
    if len(unmatched) > 0:
        report.append(f"\nUnmatched rows: {len(unmatched)}")
        report.append("\nUnmatched examples (lowest scores):")
        for _, row in unmatched.nsmallest(5, "match_score").iterrows():
            report.append(f"  {row['tracker_matchup'][:30]} | {row['tracker_pick']} | Score: {row['match_score']:.2f}")
    
    # By league
    report.append("\n\nBy League:")
    for league in alignment_df["tracker_league"].dropna().unique():
        league_df = alignment_df[alignment_df["tracker_league"] == league]
        league_matched = len(league_df[league_df["matched"]])
        report.append(f"  {league}: {league_matched}/{len(league_df)} ({league_matched/len(league_df)*100:.1f}%)")
    
    return "\n".join(report)