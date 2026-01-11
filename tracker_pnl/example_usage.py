"""
Example usage of the Sports Betting Tracker system.
"""

from src.pick_parser import PickParser
from src.pick_tracker import PickTracker
from src.box_score_matcher import BoxScoreMatcher
from src.result_evaluator import ResultEvaluator
from src.excel_exporter import ExcelExporter

def example_parse_text():
    """Example: Parse picks from text."""
    parser = PickParser()
    
    # Example conversation text
    text = """
    Bills @ Patriots 1st Half Under 24 (-110) NFL
    Bears +7.5 -110 NFL
    Lakers -5.5 NBA -110
    """
    
    picks = parser.parse_text_conversation(text, "2025-12-14")
    print(f"Parsed {len(picks)} picks")
    for pick in picks:
        print(f"  - {pick.matchup}: {pick.pick_description} ({pick.league})")
    
    return picks


def example_create_tracker():
    """Example: Create and use a tracker."""
    tracker = PickTracker()
    
    parser = PickParser()
    picks = example_parse_text()
    
    tracker.add_picks(picks)
    
    print(f"\nTracker has {len(tracker.picks)} picks")
    print(f"Pending: {len(tracker.get_pending_picks())}")
    
    return tracker


def example_match_box_scores(tracker):
    """Example: Match picks with box scores."""
    matcher = BoxScoreMatcher()
    evaluator = ResultEvaluator(matcher)
    
    for pick in tracker.picks:
        matched = matcher.update_pick_with_box_score(pick)
        if matched:
            print(f"Matched: {pick.matchup} -> {pick.final_score}")
            
            # Evaluate result
            status = evaluator.evaluate_pick(pick)
            print(f"  Status: {status}, P&L: {pick.format_pnl()}")
        else:
            print(f"No match found for: {pick.matchup}")


def example_export_excel(tracker):
    """Example: Export tracker to Excel."""
    exporter = ExcelExporter()
    output_path = "tracker_output/example_tracker.xlsx"
    
    exporter.export_tracker_to_excel(tracker, output_path)
    print(f"Exported tracker to {output_path}")


if __name__ == '__main__':
    print("=== Example Usage ===")
    
    # Parse picks
    picks = example_parse_text()
    
    # Create tracker
    tracker = example_create_tracker()
    
    # Match with box scores (if available)
    # example_match_box_scores(tracker)
    
    # Export to Excel
    example_export_excel(tracker)
    
    print("\nDone!")
