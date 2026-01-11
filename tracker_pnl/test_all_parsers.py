"""
Test and compare all parser versions.
"""

import sys
from pathlib import Path

import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.pick_parser import PickParser
from src.contextual_pick_parser import ContextualPickParser
from src.enhanced_contextual_parser import EnhancedContextualPickParser
from src.telegram_parser_v3 import TelegramParserV3
from src.alignment_engine import AlignmentEngine, generate_alignment_report


def test_parser(parser, parser_name: str, html_content: str) -> pd.DataFrame:
    """Test a single parser and return results."""
    print(f"\n{'='*60}")
    print(f"Testing: {parser_name}")
    print('='*60)
    
    try:
        if hasattr(parser, 'parse_html_conversation'):
            picks = parser.parse_html_conversation(html_content, default_date="2025-12-20")
        elif hasattr(parser, 'parse_html'):
            picks = parser.parse_html(html_content, default_date="2025-12-20")
        else:
            print(f"Parser {parser_name} doesn't have expected methods")
            return pd.DataFrame()
        
        print(f"Total picks: {len(picks)}")
        
        if picks:
            # Convert to DataFrame
            df = pd.DataFrame([{
                "date": pick.date,
                "matchup": pick.matchup,
                "pick_description": pick.pick_description,
                "segment": pick.segment,
                "odds": pick.odds,
                "league": pick.league
            } for pick in picks])
            
            # Statistics
            print(f"Picks with odds: {df['odds'].notna().sum()}")
            print(f"Picks with league: {df['league'].notna().sum()}")
            print(f"Picks with matchup: {df['matchup'].notna().sum()}")
            
            # League breakdown
            print("\nLeague distribution:")
            league_counts = df["league"].value_counts(dropna=False)
            for league, count in league_counts.head(5).items():
                league_str = league if league else "Unknown"
                print(f"  {league_str}: {count}")
            
            return df
        
    except Exception as e:
        print(f"ERROR in {parser_name}: {e}")
        import traceback
        traceback.print_exc()
    
    return pd.DataFrame()


def run_alignment(telegram_df: pd.DataFrame, parser_name: str):
    """Run alignment for a parser's results."""
    if telegram_df.empty:
        print(f"\nNo picks to align for {parser_name}")
        return
    
    print(f"\n--- Alignment for {parser_name} ---")
    
    # Load tracker data
    tracker_path = Path(
        r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents"
        r"\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"
    )
    
    if not tracker_path.exists():
        print(f"ERROR: Tracker file not found")
        return
    
    try:
        # Load tracker
        tracker_df = pd.read_excel(tracker_path, sheet_name="audited 12.15 thru 12.27")
        tracker_df["Date"] = pd.to_datetime(tracker_df["Date"], errors="coerce")
        
        # Filter dates
        start_date = pd.Timestamp("2025-12-12")
        end_date = pd.Timestamp("2025-12-27")
        tracker_df = tracker_df[(tracker_df["Date"] >= start_date) & 
                                (tracker_df["Date"] <= end_date)].copy()
        
        # Filter out invalid rows
        tracker_df = tracker_df[
            (tracker_df["League"] != "ALL") & 
            (tracker_df["Pick (Odds)"] != "ALL")
        ].copy()
        
        # Parse Pick (Odds) column
        def parse_pick_odds(pick_text):
            if pd.isna(pick_text) or pick_text == "ALL":
                return pick_text, None
            import re
            match = re.search(r'\(([-+]?\d+)\)', str(pick_text))
            if match:
                odds = match.group(1)
                pick = str(pick_text).replace(f"({odds})", "").strip()
                return pick, odds
            return pick_text, None
        
        tracker_df[["Pick_Clean", "Odds_Extracted"]] = tracker_df["Pick (Odds)"].apply(
            lambda x: pd.Series(parse_pick_odds(x))
        )
        
        # Rename columns
        tracker_df.rename(columns={
            "Pick_Clean": "Pick",
            "Matchup": "Team",
            "League": "Sport",
            "Hit/Miss": "Status",
            "Segment": "Segment",
            "Odds_Extracted": "Odds"
        }, inplace=True)
        
        # Filter Telegram picks
        telegram_df["date"] = pd.to_datetime(telegram_df["date"], errors="coerce")
        telegram_filtered = telegram_df[
            (telegram_df["date"] >= start_date) & 
            (telegram_df["date"] <= end_date)
        ].copy()
        
        # Run alignment
        engine = AlignmentEngine()
        alignment_df = engine.align_datasets(telegram_filtered, tracker_df, date_tolerance_days=1)
        
        # Summary stats
        matched = alignment_df[alignment_df["matched"]]
        print(f"Matched: {len(matched)}/{len(tracker_df)} ({len(matched)/len(tracker_df)*100:.1f}%)")
        
        # Score distribution
        high_quality = alignment_df[alignment_df["match_score"] >= 0.8]
        medium_quality = alignment_df[(alignment_df["match_score"] >= 0.6) & (alignment_df["match_score"] < 0.8)]
        print(f"High quality matches (>0.8): {len(high_quality)}")
        print(f"Medium quality matches (0.6-0.8): {len(medium_quality)}")
        
    except Exception as e:
        print(f"ERROR in alignment: {e}")


def main():
    """Test all parsers."""
    # Load HTML
    html_path = Path("telegram_text_history_data/messages.html")
    if not html_path.exists():
        print(f"ERROR: {html_path} not found")
        return
    
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Test each parser
    parsers = [
        (PickParser(), "Original PickParser"),
        (ContextualPickParser(), "Contextual Parser v1"),
        (EnhancedContextualPickParser(), "Enhanced Contextual Parser v2"),
        (TelegramParserV3(), "Telegram Parser v3 (Optimized)")
    ]
    
    results = {}
    for parser, name in parsers:
        df = test_parser(parser, name, html_content)
        results[name] = df
    
    # Compare results
    print("\n" + "="*80)
    print("COMPARISON SUMMARY")
    print("="*80)
    
    for name, df in results.items():
        print(f"\n{name}:")
        print(f"  Total picks: {len(df)}")
        print(f"  With odds: {df['odds'].notna().sum() if not df.empty else 0}")
        print(f"  With league: {df['league'].notna().sum() if not df.empty else 0}")
        print(f"  With matchup: {df['matchup'].notna().sum() if not df.empty else 0}")
    
    # Run alignment for best parser
    print("\n" + "="*80)
    print("ALIGNMENT TESTING")
    print("="*80)
    
    best_parser_name = "Telegram Parser v3 (Optimized)"
    if best_parser_name in results and not results[best_parser_name].empty:
        run_alignment(results[best_parser_name], best_parser_name)
    
    # Also test Enhanced parser
    enhanced_name = "Enhanced Contextual Parser v2"
    if enhanced_name in results and not results[enhanced_name].empty:
        run_alignment(results[enhanced_name], enhanced_name)


if __name__ == "__main__":
    main()