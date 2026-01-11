"""
Advanced alignment engine for matching parsed picks with tracker data.
Uses multiple scoring factors and fuzzy matching for high accuracy.
"""

import difflib
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from src.team_registry import team_registry


class AlignmentEngine:
    """Engine for aligning parsed picks with tracker rows."""
    
    def __init__(self):
        self.team_registry = team_registry
        self.alignment_cache = {}
    
    def align_datasets(
        self, 
        telegram_df: pd.DataFrame, 
        tracker_df: pd.DataFrame,
        date_tolerance_days: int = 1
    ) -> pd.DataFrame:
        """
        Align two datasets of picks using advanced matching.
        
        Args:
            telegram_df: DataFrame with parsed Telegram picks
            tracker_df: DataFrame with tracker data
            date_tolerance_days: Number of days tolerance for date matching
        
        Returns:
            DataFrame with alignment results
        """
        results = []
        
        # Process each tracker row
        for idx, tracker_row in tracker_df.iterrows():
            best_match, best_score = self._find_best_match(
                tracker_row, telegram_df, date_tolerance_days
            )
            
            result = {
                "tracker_index": idx,
                "tracker_date": tracker_row.get("Date"),
                "tracker_team": tracker_row.get("Team"),
                "tracker_pick": tracker_row.get("Pick"),
                "tracker_league": tracker_row.get("Sport"),
                "match_score": best_score,
                "matched": best_score > 0.6  # Threshold for good match
            }
            
            if best_match is not None:
                result.update({
                    "telegram_index": best_match.name,
                    "telegram_date": best_match.get("date"),
                    "telegram_matchup": best_match.get("matchup"),
                    "telegram_pick": best_match.get("pick_description"),
                    "telegram_league": best_match.get("league")
                })
            
            results.append(result)
        
        return pd.DataFrame(results)
    
    def _find_best_match(
        self, 
        tracker_row: pd.Series, 
        telegram_df: pd.DataFrame,
        date_tolerance_days: int
    ) -> Tuple[Optional[pd.Series], float]:
        """Find the best matching Telegram pick for a tracker row."""
        best_match = None
        best_score = 0.0
        
        # Get tracker data
        tracker_date = pd.to_datetime(tracker_row.get("Date"))
        tracker_team = str(tracker_row.get("Team", ""))
        tracker_pick = str(tracker_row.get("Pick", ""))
        tracker_league = str(tracker_row.get("Sport", ""))
        tracker_odds = tracker_row.get("Odds")
        tracker_segment = str(tracker_row.get("Segment", "FG"))
        
        # Filter candidates by date
        if tracker_date and not pd.isna(tracker_date):
            date_min = tracker_date - pd.Timedelta(days=date_tolerance_days)
            date_max = tracker_date + pd.Timedelta(days=date_tolerance_days)
            
            # Convert telegram dates for comparison
            telegram_dates = pd.to_datetime(telegram_df["date"], errors="coerce")
            date_mask = (telegram_dates >= date_min) & (telegram_dates <= date_max)
            candidates = telegram_df[date_mask]
        else:
            candidates = telegram_df
        
        # Score each candidate
        for idx, telegram_row in candidates.iterrows():
            score = self._calculate_match_score(
                tracker_row, telegram_row,
                tracker_date, tracker_team, tracker_pick, 
                tracker_league, tracker_odds, tracker_segment
            )
            
            if score > best_score:
                best_score = score
                best_match = telegram_row
        
        return best_match, best_score
    
    def _calculate_match_score(
        self,
        tracker_row: pd.Series,
        telegram_row: pd.Series,
        tracker_date, tracker_team, tracker_pick,
        tracker_league, tracker_odds, tracker_segment
    ) -> float:
        """Calculate match score between tracker and telegram rows."""
        score = 0.0
        max_score = 0.0
        
        # 1. Date similarity (20%)
        max_score += 0.2
        telegram_date = pd.to_datetime(telegram_row.get("date"), errors="coerce")
        if tracker_date and telegram_date and not pd.isna(tracker_date) and not pd.isna(telegram_date):
            days_diff = abs((tracker_date - telegram_date).days)
            if days_diff == 0:
                score += 0.2
            elif days_diff == 1:
                score += 0.1
            elif days_diff == 2:
                score += 0.05
        
        # 2. Team matching (30%)
        max_score += 0.3
        telegram_matchup = str(telegram_row.get("matchup", ""))
        # Extract team from pick description or matchup
        telegram_pick_desc = str(telegram_row.get("pick_description", ""))
        telegram_team = self._extract_team_from_pick(telegram_pick_desc, telegram_matchup)
        team_score = self._calculate_team_similarity(tracker_team, telegram_team, tracker_league)
        score += team_score * 0.3
        
        # 3. Pick/Spread matching (25%)
        max_score += 0.25
        telegram_pick = telegram_pick_desc
        pick_score = self._calculate_pick_similarity(tracker_pick, telegram_pick)
        score += pick_score * 0.25
        
        # 4. League matching (10%)
        max_score += 0.1
        telegram_league = str(telegram_row.get("league", ""))
        if self._normalize_league(tracker_league) == self._normalize_league(telegram_league):
            score += 0.1
        
        # 5. Odds similarity (10%)
        max_score += 0.1
        telegram_odds = telegram_row.get("odds")
        if tracker_odds and telegram_odds:
            try:
                odds_diff = abs(float(tracker_odds) - float(telegram_odds))
                if odds_diff <= 5:
                    score += 0.1
                elif odds_diff <= 10:
                    score += 0.07
                elif odds_diff <= 20:
                    score += 0.04
            except:
                pass
        
        # 6. Segment matching (5%)
        max_score += 0.05
        telegram_segment = str(telegram_row.get("segment", "FG"))
        if self._normalize_segment(tracker_segment) == self._normalize_segment(telegram_segment):
            score += 0.05
        
        # Normalize score
        if max_score > 0:
            return score / max_score
        return 0.0
    
    def _extract_team_from_pick(self, pick_desc: str, matchup: str) -> str:
        """Extract team name from pick description or matchup."""
        # Try to extract from pick description first
        if pick_desc:
            # Remove spread, total, ML indicators
            pick_clean = re.sub(r'([-+]?\d+\.?\d*|over|under|o|u|ml|ML)', '', pick_desc, flags=re.IGNORECASE)
            pick_clean = pick_clean.strip()
            if pick_clean:
                return pick_clean
        
        # Try to get from matchup (take first team)
        if matchup:
            if " vs " in matchup:
                return matchup.split(" vs ")[0].strip()
            elif " @ " in matchup:
                return matchup.split(" @ ")[0].strip()
        
        return ""
    
    def _calculate_team_similarity(self, team1: str, team2: str, league_hint: Optional[str] = None) -> float:
        """Calculate similarity between two team names."""
        if not team1 or not team2:
            return 0.0
        
        # Try to normalize both teams
        norm1, league1 = self.team_registry.normalize_team(team1, league_hint)
        norm2, league2 = self.team_registry.normalize_team(team2, league_hint)
        
        # If both normalize to same canonical name, perfect match
        if norm1 and norm2 and norm1 == norm2:
            return 1.0
        
        # Check if one is alias of the other
        aliases1 = self.team_registry.get_all_aliases_for_team(team1)
        aliases2 = self.team_registry.get_all_aliases_for_team(team2)
        
        team1_lower = team1.lower().strip()
        team2_lower = team2.lower().strip()
        
        if team1_lower in [a.lower() for a in aliases2]:
            return 0.9
        if team2_lower in [a.lower() for a in aliases1]:
            return 0.9
        
        # Fuzzy match on normalized or original
        if norm1 and norm2:
            return difflib.SequenceMatcher(None, norm1.lower(), norm2.lower()).ratio()
        
        # Token-based matching
        tokens1 = set(self._tokenize(team1))
        tokens2 = set(self._tokenize(team2))
        
        if tokens1 and tokens2:
            intersection = tokens1 & tokens2
            union = tokens1 | tokens2
            jaccard = len(intersection) / len(union) if union else 0
            return jaccard * 0.8  # Slightly lower score for token match
        
        # Fall back to simple fuzzy matching
        return difflib.SequenceMatcher(None, team1_lower, team2_lower).ratio() * 0.7
    
    def _calculate_pick_similarity(self, pick1: str, pick2: str) -> float:
        """Calculate similarity between two pick descriptions."""
        if not pick1 or not pick2:
            return 0.0
        
        pick1_lower = pick1.lower().strip()
        pick2_lower = pick2.lower().strip()
        
        # Extract key components
        spread1, total1, ml1 = self._extract_pick_components(pick1_lower)
        spread2, total2, ml2 = self._extract_pick_components(pick2_lower)
        
        # Compare components
        if spread1 and spread2:
            try:
                diff = abs(float(spread1) - float(spread2))
                if diff == 0:
                    return 1.0
                elif diff <= 0.5:
                    return 0.9
                elif diff <= 1.0:
                    return 0.7
                elif diff <= 2.0:
                    return 0.5
                else:
                    return 0.2
            except:
                pass
        
        if total1 and total2:
            # Check if both are over or under
            over1 = "over" in pick1_lower or "o" in pick1_lower
            over2 = "over" in pick2_lower or "o" in pick2_lower
            under1 = "under" in pick1_lower or "u" in pick1_lower
            under2 = "under" in pick2_lower or "u" in pick2_lower
            
            if (over1 and over2) or (under1 and under2):
                try:
                    diff = abs(float(total1) - float(total2))
                    if diff == 0:
                        return 1.0
                    elif diff <= 0.5:
                        return 0.9
                    elif diff <= 1.0:
                        return 0.7
                    elif diff <= 2.0:
                        return 0.5
                    else:
                        return 0.2
                except:
                    pass
        
        if ml1 and ml2:
            return 1.0  # Both are moneyline
        
        # Fallback to fuzzy matching
        return difflib.SequenceMatcher(None, pick1_lower, pick2_lower).ratio() * 0.6
    
    def _extract_pick_components(self, pick_text: str) -> Tuple[Optional[str], Optional[str], bool]:
        """Extract spread, total, and ML from pick text."""
        spread = None
        total = None
        is_ml = False
        
        # Check for moneyline
        if "ml" in pick_text or "moneyline" in pick_text:
            is_ml = True
        
        # Extract spread
        spread_match = re.search(r'([-+]?\d+\.?\d*)', pick_text)
        if spread_match and not any(word in pick_text for word in ["over", "under", "o", "u"]):
            spread = spread_match.group(1)
        
        # Extract total
        total_match = re.search(r'(?:over|under|o|u)\s*(\d+\.?\d*)', pick_text)
        if total_match:
            total = total_match.group(1)
        
        return spread, total, is_ml
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for comparison."""
        # Remove special characters and split
        text = re.sub(r'[^\w\s]', ' ', text.lower())
        tokens = text.split()
        # Remove common words
        stopwords = {"the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for"}
        return [t for t in tokens if t not in stopwords and len(t) > 1]
    
    def _normalize_league(self, league: str) -> str:
        """Normalize league name."""
        if not league:
            return ""
        
        league_upper = league.upper().strip()
        league_map = {
            "NFL": "NFL", "NATIONAL FOOTBALL": "NFL",
            "NBA": "NBA", "NATIONAL BASKETBALL": "NBA",
            "NCAAF": "NCAAF", "CFB": "NCAAF", "COLLEGE FOOTBALL": "NCAAF",
            "NCAAM": "NCAAM", "CBB": "NCAAM", "COLLEGE BASKETBALL": "NCAAM", "NCAAB": "NCAAM"
        }
        
        for key, value in league_map.items():
            if key in league_upper:
                return value
        
        return league_upper
    
    def _normalize_segment(self, segment: str) -> str:
        """Normalize segment."""
        if not segment:
            return "FG"
        
        segment_map = {
            "1H": "1H", "FH": "1H", "FIRST HALF": "1H",
            "2H": "2H", "SH": "2H", "SECOND HALF": "2H",
            "FG": "FG", "FULL": "FG", "GAME": "FG",
            "1Q": "1Q", "2Q": "2Q", "3Q": "3Q", "4Q": "4Q"
        }
        
        segment_upper = segment.upper().strip()
        for key, value in segment_map.items():
            if key in segment_upper:
                return value
        
        return segment_upper


def generate_alignment_report(alignment_df: pd.DataFrame) -> str:
    """Generate a detailed alignment report."""
    report = []
    
    # Overall statistics
    total_tracker = len(alignment_df)
    matched = alignment_df[alignment_df["matched"]].copy()
    unmatched = alignment_df[~alignment_df["matched"]].copy()
    
    report.append("=" * 80)
    report.append("ALIGNMENT REPORT")
    report.append("=" * 80)
    report.append(f"\nTotal tracker rows: {total_tracker}")
    report.append(f"Matched: {len(matched)} ({len(matched)/total_tracker*100:.1f}%)")
    report.append(f"Unmatched: {len(unmatched)} ({len(unmatched)/total_tracker*100:.1f}%)")
    
    # Score distribution
    report.append("\nMatch Score Distribution:")
    score_bins = [0.9, 0.8, 0.7, 0.6, 0.5, 0.0]
    for i in range(len(score_bins) - 1):
        upper = score_bins[i]
        lower = score_bins[i + 1]
        count = len(alignment_df[(alignment_df["match_score"] <= upper) & 
                                 (alignment_df["match_score"] > lower)])
        if count > 0:
            report.append(f"  {lower:.1f} - {upper:.1f}: {count} rows")
    
    # Perfect matches
    perfect = alignment_df[alignment_df["match_score"] >= 0.9]
    if len(perfect) > 0:
        report.append(f"\nPerfect matches (>= 0.9 score): {len(perfect)}")
        
        # Show a few examples
        report.append("\nExample perfect matches:")
        for idx, row in perfect.head(3).iterrows():
            report.append(f"  Tracker: {row['tracker_team']} {row['tracker_pick']}")
            report.append(f"  Telegram: {row.get('telegram_matchup', '')} - {row['telegram_pick']}")
            report.append(f"  Score: {row['match_score']:.3f}\n")
    
    # Problem areas
    if len(unmatched) > 0:
        report.append("\nUnmatched tracker rows (examples):")
        for idx, row in unmatched.head(5).iterrows():
            report.append(f"  Date: {row['tracker_date']}")
            report.append(f"  Team: {row['tracker_team']}")
            report.append(f"  Pick: {row['tracker_pick']}")
            report.append(f"  League: {row['tracker_league']}\n")
    
    # League breakdown
    report.append("\nMatching by League:")
    for league in alignment_df["tracker_league"].dropna().unique():
        league_df = alignment_df[alignment_df["tracker_league"] == league]
        league_matched = league_df[league_df["matched"]]
        report.append(f"  {league}: {len(league_matched)}/{len(league_df)} "
                     f"({len(league_matched)/len(league_df)*100:.1f}%)")
    
    return "\n".join(report)