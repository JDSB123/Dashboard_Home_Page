"""
Test the enhanced parsing and alignment system.
"""

import sys
from pathlib import Path

import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.enhanced_contextual_parser import EnhancedContextualPickParser
from src.alignment_engine import AlignmentEngine, generate_alignment_report
from src.team_registry import team_registry


def test_team_registry():
    """Test the team registry functionality."""
    print("=" * 80)
    print("TESTING TEAM REGISTRY")
    print("=" * 80)
    
    test_cases = [
        ("bears", None),
        ("chi", "NFL"),
        ("a and m", "NCAAF"),
        ("lakers", "NBA"),
        ("duke", "NCAAM"),
        ("ohio state", None),
        ("osu", "NCAAF"),
        ("cowboys", None),
        ("bama", None),
        ("michigan st", None)
    ]
    
    for team_text, league_hint in test_cases:
        normalized, inferred_league = team_registry.normalize_team(team_text, league_hint)
        team_id = team_registry.get_team_id(team_text, league_hint)
        print(f"'{team_text}' (hint: {league_hint}) -> '{normalized}' ({inferred_league}) [ID: {team_id}]")
    
    print()


def test_enhanced_parser():
    """Test the enhanced contextual parser."""
    print("=" * 80)
    print("TESTING ENHANCED PARSER")
    print("=" * 80)
    
    # Load and parse Telegram HTML
    html_path = Path("telegram_text_history_data/messages.html")
    if not html_path.exists():
        print(f"ERROR: {html_path} not found")
        return None
    
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    parser = EnhancedContextualPickParser()
    picks = parser.parse_html_conversation(html_content, default_date="2025-12-20")
    
    print(f"Total picks parsed: {len(picks)}")
    
    # Convert to DataFrame for analysis
    if picks:
        df = pd.DataFrame([{
            "date": pick.date,
            "matchup": pick.matchup,
            "pick_description": pick.pick_description,
            "segment": pick.segment,
            "odds": pick.odds,
            "league": pick.league,
            "status": pick.status
        } for pick in picks])
        
        # Statistics
        print(f"\nPicks with odds: {df['odds'].notna().sum()}")
        print(f"Picks with league: {df['league'].notna().sum()}")
        print(f"Picks with matchup: {df['matchup'].notna().sum()}")
        
        # League breakdown
        print("\nLeague distribution:")
        league_counts = df["league"].value_counts(dropna=False)
        for league, count in league_counts.items():
            league_str = league if league else "Unknown"
            print(f"  {league_str}: {count}")
        
        # Sample picks
        print("\nSample picks (first 5 with league):")
        sample = df[df["league"].notna()].head(5)
        for idx, row in sample.iterrows():
            print(f"  {row['pick_description']} ({row['league']}) - Odds: {row['odds']}")
        
        return df
    
    return None


def test_alignment(telegram_df: pd.DataFrame):
    """Test the alignment engine."""
    print("\n" + "=" * 80)
    print("TESTING ALIGNMENT ENGINE")
    print("=" * 80)
    
    # Load tracker data
    tracker_path = Path(
        r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents"
        r"\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"
    )
    
    if not tracker_path.exists():
        print(f"ERROR: Tracker file not found at {tracker_path}")
        return
    
    try:
        # Load tracker data
        tracker_df = pd.read_excel(tracker_path, sheet_name="audited 12.15 thru 12.27")
        
        # Convert date columns
        tracker_df["Date"] = pd.to_datetime(tracker_df["Date"], errors="coerce")
        
        # Filter date range
        start_date = pd.Timestamp("2025-12-12")
        end_date = pd.Timestamp("2025-12-27")
        tracker_df = tracker_df[(tracker_df["Date"] >= start_date) & 
                                 (tracker_df["Date"] <= end_date)].copy()
        
        # Filter out invalid rows (where League is "ALL" or Pick is "ALL")
        tracker_df = tracker_df[
            (tracker_df["League"] != "ALL") & 
            (tracker_df["Pick (Odds)"] != "ALL")
        ].copy()
        
        # Parse the Pick (Odds) column to separate pick and odds
        def parse_pick_odds(pick_text):
            if pd.isna(pick_text) or pick_text == "ALL":
                return pick_text, None
            # Extract odds from parentheses if present
            import re
            match = re.search(r'\(([-+]?\d+)\)', str(pick_text))
            if match:
                odds = match.group(1)
                pick = str(pick_text).replace(f"({odds})", "").strip()
                return pick, odds
            return pick_text, None
        
        # Apply parsing
        tracker_df[["Pick_Clean", "Odds_Extracted"]] = tracker_df["Pick (Odds)"].apply(
            lambda x: pd.Series(parse_pick_odds(x))
        )
        
        # Rename columns for consistency based on actual Excel columns
        # ['Date', 'League', 'Matchup', 'Segment', 'Pick (Odds)', 'Risk', 'To Win', 'Hit/Miss', 'PnL']
        tracker_df.rename(columns={
            "Pick_Clean": "Pick",
            "Matchup": "Team",
            "League": "Sport",
            "Hit/Miss": "Status",
            "Segment": "Segment",
            "Odds_Extracted": "Odds"
        }, inplace=True)
        
        print(f"Loaded {len(tracker_df)} tracker rows in date range")
        
        # Filter Telegram picks to same date range
        if "date" in telegram_df.columns:
            telegram_df["date"] = pd.to_datetime(telegram_df["date"], errors="coerce")
            telegram_filtered = telegram_df[
                (telegram_df["date"] >= start_date) & 
                (telegram_df["date"] <= end_date)
            ].copy()
        else:
            telegram_filtered = telegram_df.copy()
        
        print(f"Filtered to {len(telegram_filtered)} Telegram picks in date range")
        
        # Run alignment
        engine = AlignmentEngine()
        alignment_df = engine.align_datasets(telegram_filtered, tracker_df, date_tolerance_days=1)
        
        # Generate report
        report = generate_alignment_report(alignment_df)
        print(report)
        
        # Save results
        output_path = Path("alignment_results.xlsx")
        with pd.ExcelWriter(output_path) as writer:
            alignment_df.to_excel(writer, sheet_name="Alignment", index=False)
            telegram_filtered.to_excel(writer, sheet_name="Telegram Picks", index=False)
            tracker_df.to_excel(writer, sheet_name="Tracker Data", index=False)
        
        print(f"\nResults saved to {output_path}")
        
    except Exception as e:
        print(f"ERROR loading tracker data: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Run all tests."""
    # Test team registry
    test_team_registry()
    
    # Test enhanced parser
    telegram_df = test_enhanced_parser()
    
    # Test alignment if we have Telegram data
    if telegram_df is not None and len(telegram_df) > 0:
        test_alignment(telegram_df)
    else:
        print("\nNo Telegram picks to align")


if __name__ == "__main__":
    main()