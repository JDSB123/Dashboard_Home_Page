"""
Comprehensive analyzer for Telegram message history to extract betting picks.

This script analyzes Telegram HTML export files and:
1. Parses picks using the existing parser
2. Shows statistics and examples
3. Identifies patterns that might need improvement
4. Creates a summary report
"""

import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.pick_parser import PickParser
from bs4 import BeautifulSoup


def analyze_telegram_html(html_file_path: str):
    """Analyze Telegram HTML file and extract betting picks."""
    
    parser = PickParser()
    html_file = Path(html_file_path)
    
    print(f"=" * 80)
    print(f"Analyzing Telegram HTML File: {html_file.name}")
    print(f"=" * 80)
    print(f"File exists: {html_file.exists()}")
    print(f"File size: {html_file.stat().st_size / 1024:.1f} KB\n")
    
    # Read HTML
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Parse HTML structure
    soup = BeautifulSoup(html_content, 'lxml')
    messages = soup.find_all('div', class_='message default clearfix')
    print(f"Total messages found: {len(messages)}\n")
    
    # Parse picks
    print("Parsing picks...")
    picks = parser.parse_html_conversation(html_content)
    
    print(f"\n{'=' * 80}")
    print(f"PARSER RESULTS")
    print(f"{'=' * 80}\n")
    print(f"Total picks found: {len(picks)}\n")
    
    if not picks:
        print("WARNING: No picks found! The parser may need improvements.\n")
        return
    
    # Statistics
    picks_by_league = defaultdict(int)
    picks_by_date = defaultdict(int)
    picks_with_odds = 0
    picks_with_matchup = 0
    picks_without_league = 0
    
    for pick in picks:
        if pick.league:
            picks_by_league[pick.league] += 1
        else:
            picks_without_league += 1
        
        if pick.date:
            picks_by_date[pick.date] += 1
        
        if pick.odds:
            picks_with_odds += 1
        
        if pick.matchup:
            picks_with_matchup += 1
    
    print(f"Statistics:")
    print(f"  - Picks with league: {len(picks) - picks_without_league} ({100*(len(picks)-picks_without_league)/len(picks):.1f}%)")
    print(f"  - Picks with odds: {picks_with_odds} ({100*picks_with_odds/len(picks):.1f}%)")
    print(f"  - Picks with matchup: {picks_with_matchup} ({100*picks_with_matchup/len(picks):.1f}%)")
    print()
    
    if picks_by_league:
        print(f"Picks by League:")
        for league, count in sorted(picks_by_league.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {league}: {count}")
        print()
    
    if picks_by_date:
        print(f"Picks by Date:")
        for date, count in sorted(picks_by_date.items()):
            print(f"  - {date}: {count}")
        print()
    
    # Sample picks
    print(f"{'=' * 80}")
    print(f"SAMPLE PICKS (first 30)")
    print(f"{'=' * 80}\n")
    
    for i, pick in enumerate(picks[:30], 1):
        print(f"{i}. Date: {pick.date or 'N/A'}")
        print(f"   League: {pick.league or 'N/A'}")
        print(f"   Matchup: {pick.matchup or 'N/A'}")
        print(f"   Segment: {pick.segment or 'N/A'}")
        print(f"   Pick: {pick.pick_description or 'N/A'}")
        print(f"   Odds: {pick.odds or 'N/A'}")
        if pick.source_text:
            print(f"   Source: {pick.source_text[:100]}")
        print()
    
    # Identify issues
    print(f"{'=' * 80}")
    print(f"PARSER ANALYSIS")
    print(f"{'=' * 80}\n")
    
    issues = []
    
    if picks_without_league > len(picks) * 0.3:
        issues.append(f"WARNING: {picks_without_league} picks ({100*picks_without_league/len(picks):.1f}%) missing league information")
    
    if picks_with_odds < len(picks) * 0.5:
        issues.append(f"WARNING: Only {picks_with_odds} picks ({100*picks_with_odds/len(picks):.1f}%) have odds - many picks may be missing odds")
    
    if picks_with_matchup < len(picks) * 0.3:
        issues.append(f"WARNING: Only {picks_with_matchup} picks ({100*picks_with_matchup/len(picks):.1f}%) have matchup information")
    
    if issues:
        print("Issues found:")
        for issue in issues:
            print(f"  {issue}")
        print()
    else:
        print("OK: Parser is extracting most fields successfully!\n")
    
    # Recommendations
    print(f"{'=' * 80}")
    print(f"RECOMMENDATIONS")
    print(f"{'=' * 80}\n")
    
    recommendations = []
    
    if picks_without_league > 0:
        recommendations.append("• Consider improving league extraction from context or team names")
    
    if picks_with_odds < len(picks) * 0.7:
        recommendations.append("• Many picks lack odds - messages may use abbreviated formats or missing odds")
        recommendations.append("• Some messages may only show P&L (in summary format) without odds")
    
    if picks_with_matchup < len(picks) * 0.5:
        recommendations.append("• Consider improving matchup extraction - many picks are team-only")
    
    if recommendations:
        for rec in recommendations:
            print(rec)
    else:
        print("OK: Parser appears to be working well!")
    
    print()
    
    return picks


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze Telegram HTML files for betting picks')
    parser.add_argument('--input', '-i', type=str, 
                       default='telegram_text_history_data/messages.html',
                       help='Path to Telegram HTML file')
    parser.add_argument('--output', '-o', type=str,
                       help='Optional: Save parsed picks to JSON file')
    
    args = parser.parse_args()
    
    picks = analyze_telegram_html(args.input)
    
    if args.output and picks:
        import json
        output_file = Path(args.output)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        picks_data = []
        for pick in picks:
            picks_data.append({
                'date': pick.date,
                'league': pick.league,
                'matchup': pick.matchup,
                'segment': pick.segment,
                'pick_description': pick.pick_description,
                'odds': pick.odds,
                'source_text': pick.source_text,
            })
        
        with open(output_file, 'w') as f:
            json.dump(picks_data, f, indent=2)
        
        print(f"\nOK: Saved {len(picks)} picks to {output_file}")


if __name__ == '__main__':
    main()
