"""
Process picks from Telegram messages (from images).
Extracts unique picks, avoids duplicates, and adds to tracker.
"""

import sys
from pathlib import Path
from datetime import datetime
from decimal import Decimal
from typing import List, Set, Tuple
import re

sys.path.insert(0, str(Path(__file__).parent))

from src.pick_tracker import Pick, PickTracker
from src.telegram_parser_v3 import TelegramParserV3
from src.excel_exporter import ExcelExporter
from src.team_registry import team_registry

def normalize_pick_key(pick: Pick) -> Tuple:
    """Create a normalized key for duplicate detection."""
    # Normalize pick description (remove odds if present)
    desc = pick.pick_description or ""
    desc_normalized = re.sub(r'\s*\([-+]?\d+\)', '', desc).strip().lower()
    
    # Normalize segment
    segment = (pick.segment or "FG").strip().upper()
    if segment in ["1H", "H1", "FIRST HALF"]:
        segment = "1H"
    elif segment in ["2H", "H2", "SECOND HALF"]:
        segment = "2H"
    elif segment in ["FG", "FULL GAME", "GAME"]:
        segment = "FG"
    
    return (
        pick.date or "",
        pick.league or "",
        desc_normalized,
        segment
    )

def parse_and_deduplicate(messages: List[dict]) -> List[Pick]:
    """Parse messages and return deduplicated picks."""
    parser = TelegramParserV3()
    
    # Parse each message individually to track source
    all_picks_with_source = []
    
    for msg in messages:
        text = msg['text']
        timestamp = msg.get('timestamp')
        date_str = msg['date']
        
        # Create HTML for single message
        if timestamp:
            dt_str = timestamp
        else:
            dt_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        
        html_content = f'''<html><body>
        <div class="message">
            <div class="body">
                <div class="text">{text}</div>
            </div>
            <div class="date" title="{dt_str} UTC-06:00"></div>
        </div>
        </body></html>'''
        
        # Parse picks from this message
        picks = parser.parse_html(html_content, default_date=date_str)
        
        # Store picks with source text
        for pick in picks:
            if not pick.source_text:
                pick.source_text = text
            all_picks_with_source.append(pick)
    
    # Deduplicate: prefer picks with complete info (odds, amounts)
    seen = {}
    deduplicated = []
    
    for pick in all_picks_with_source:
        key = normalize_pick_key(pick)
        
        if key not in seen:
            seen[key] = pick
            deduplicated.append(pick)
        else:
            # Prefer pick with more complete info
            existing = seen[key]
            existing_score = (1 if existing.odds else 0)
            new_score = (1 if pick.odds else 0)
            
            # Also check if source has dollar amount
            if existing.source_text:
                existing_score += (1 if '$' in existing.source_text else 0)
            if pick.source_text:
                new_score += (1 if '$' in pick.source_text else 0)
            
            if new_score > existing_score:
                # Replace with better pick
                idx = deduplicated.index(existing)
                deduplicated[idx] = pick
                seen[key] = pick
    
    return deduplicated

def main():
    """Process picks from images."""
    
    # Extract messages from image descriptions
    # December 28, 2024 - NFL picks (11:55 AM - 11:59 AM)
    messages = [
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:55:00',
            'text': 'nfl\nmiami +6\narizona over 53\ncleveland under 35.5\nnyj +13.5\njax over 47.5\nlv under 41\ngients -3'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:57:00',
            'text': 'az o53 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'miami 6 -120 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'clevaland u34.5 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'nyj 13.5 -120 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'jax o48 -121 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'lv u40 -110 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:58:00',
            'text': 'giants -3 -115 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:59:00',
            'text': 'panthers plus 7'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 11:59:00',
            'text': 'panthers 7 -112 $50'
        },
        # December 28 - NBA picks (12:04 PM - 12:24 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:04:00',
            'text': 'TOR / FG Spread / TOR +4.5\nGSW @ TOR / 1H Total / OVER 108.5\nPHI / FG Spread / PHI +15.5 🔥🔥🔥\nPHI / 1H Spread / PHI +8.75\nPOR / FG Spread / POR +7.0\nPOR / 1H Spread / POR +3.5\nBOS @ POR / 1H Total / UNDER 117.5\nWAS / FG Spread / WAS +7.5\nMEM @ WAS / FG Total / UNDER 240.0\nWAS / 1H Spread / WAS +4.5\nSAC / FG Spread / SAC +13.0\nSAC / 1H Spread / SAC +7.5\nSAC @ LAL / 1H Total / UNDER 119.5'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:22:00',
            'text': 'Toronto 4.5 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:22:00',
            'text': '-111'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:22:00',
            'text': 'Tor o108.5 -115 $35'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:22:00',
            'text': 'Philly 15.5 -119 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'Philly 8.5 -111 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'portland 7 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'portland 3.5 -111 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'portland u117.5 -111 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'washington 7.5 -106 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:23:00',
            'text': 'was 4.5 -115 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:24:00',
            'text': 'sac 13 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:24:00',
            'text': 'sac 7.5 -115 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:24:00',
            'text': 'sac u119.5 -120 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 12:24:00',
            'text': 'mem u240 -110 $25'
        },
        # December 28 - NFL 2H picks (1:26 PM - 1:27 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:26:00',
            'text': 'steelers -3 2h\nbuccs -6.5 2h\njags -6 2h\ncolts 09.5 2h\njags/colts over 2h'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:26:00',
            'text': 'steelers -3 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:27:00',
            'text': 'bucs -6.5 -115 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:27:00',
            'text': 'jags -6 -105 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:27:00',
            'text': 'jags o24 -117 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 13:27:00',
            'text': 'colts o9.5 -135 $20'
        },
        # December 28 - NCAAM picks (3:08 PM - 3:24 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:08:00',
            'text': 'ncaam below\n$25k each..\nOld Dominion @ Maryland | FG | Old Dominion +15\nLe Moyne @ Boston College | FG | Boston College -1\nWashington @ Portland | FG | Portland +4\nSan Francisco @ Seattle | FG | OVER 145.5\nNorfolk State @ Louisiana | FG | Norfolk State +5\nPepperdine @ Gonzaga | FG | Pepperdine +29\nColumbia @ Florida | FG | Columbia -4.5\nSaint Mary\'s @ Loyola Marymount | FG | Loyola Marymount +9.5\nCharleston @ Richmond | FG | Richmond -11.5\nSanta Clara @ Oregon | FG | Oregon +6\nWashington @ Portland | 1H | OVER 72.5\nSan Francisco @ Seattle | 1H | OVER 68\nLe Moyne @ Boston College | 1H | OVER 69.5\nSanta Clara @ Oregon | 1H | OVER 71\nPacific @ San Diego | 1H | OVER 71'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:23:00',
            'text': 'old dom 14.5 -110 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:23:00',
            'text': 'portland 3.5 -110 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:24:00',
            'text': 'seattle 145.5 -110 $25 over'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:24:00',
            'text': 'pepperdine 29 -110 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:24:00',
            'text': 'portland o72.5 -111 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:24:00',
            'text': 'seattle o68 -111 $25'
        },
        # December 28 - NFL Eagles @ Bills (3:24 PM - 3:27 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:24:00',
            'text': 'nfl; eagles at bills. bills fg -3; bills/eagoe fg over 44.5 bills ml 1h; bill -2.5 1h. bills 010 tto 1h'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:27:00',
            'text': 'oregon st 1h o71 -111 $25, oregon st 6 -111 $25, pacific 1h o71 -111 $25, loyola 9.5 -104 $25'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:25:00',
            'text': 'bills -3 -115 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:25:00',
            'text': 'bills o45 -111 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:25:00',
            'text': 'bills -155 1h $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 15:25:00',
            'text': 'bills -2.5 -115 $50'
        },
        # December 28 - NFL 49ers picks (7:05 PM - 7:18 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:05:00',
            'text': 'Hammering 49s'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:06:00',
            'text': '1H. 49s; ML; under Fg 49s ML; -3 (buy down?); under 52'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:07:00',
            'text': 'Niners -3 -112 $50 1h\nNiners u25.5 -107 $50 1h\nNiners -205 $50\nNiners -3 -135 $50\nNiners u52 -119 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:10:00',
            'text': '-185 $50'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:13:00',
            'text': 'Kings ML q1 and 1H'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:18:00',
            'text': 'kings 220 $10 1q'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 19:18:00',
            'text': 'kings +315 1h ml'
        },
        # December 28 - NFL 2H 49ers (9:05 PM - 9:07 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 21:05:00',
            'text': '2h 49 hammer.\n49ML/-.5/TTO 14 49/ TTU Beats U14// 2h u27'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 21:07:00',
            'text': 'Niners +100 $50\nNiners +0.5 -125 $50\nNiners o14 -120 $20\nBears u13.5 +105 $20\n2h u27 -107 $50'
        },
        # December 28 - NFL Bills 2H (5:01 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 17:01:00',
            'text': 'bill 2h -6\nand over 21'
        },
        # December 28 - NCAAM Portland 2H (4:52 PM - 4:53 PM)
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 16:52:00',
            'text': 'ncaam portland 2h pk'
        },
        {
            'date': '2024-12-28',
            'timestamp': '28.12.2024 16:53:00',
            'text': '-111 $25 in'
        },
    ]
    
    print(f"Processing {len(messages)} messages...")
    
    # Parse and deduplicate
    picks = parse_and_deduplicate(messages)
    
    print(f"\nParsed {len(picks)} unique picks")
    
    # Create tracker and add picks
    tracker = PickTracker()
    tracker.add_picks(picks)
    
    # Extract risk amounts from source text
    for pick in tracker.picks:
        if pick.source_text:
            # Extract dollar amount from source text
            amount_match = re.search(r'\$(\d+)', pick.source_text)
            if amount_match:
                amount = Decimal(amount_match.group(1))
                pick.risk_amount = amount
                
                # Calculate to_win based on odds if available
                if pick.odds:
                    try:
                        # For risk_amount, we have the actual risk
                        # Calculate to_win based on odds
                        odds_value = int(re.search(r'([+-]?\d+)', pick.odds).group(1))
                        if odds_value < 0:
                            # Negative odds: risk $X to win $X * (100 / abs(odds))
                            pick.to_win_amount = amount * Decimal(100) / Decimal(abs(odds_value))
                        else:
                            # Positive odds: risk $X to win $X * (odds / 100)
                            pick.to_win_amount = amount * Decimal(odds_value) / Decimal(100)
                    except Exception as e:
                        pass
    
    # Export to Excel
    output_file = "image_picks_tracker.xlsx"
    exporter = ExcelExporter()
    exporter.export_tracker_to_excel(tracker, output_file)
    
    print(f"\nExported {len(tracker.picks)} picks to {output_file}")
    
    # Print summary
    print("\n=== Summary ===")
    print(f"Total Picks: {len(tracker.picks)}")
    
    by_league = {}
    for pick in tracker.picks:
        league = pick.league or "Unknown"
        by_league[league] = by_league.get(league, 0) + 1
    
    for league, count in sorted(by_league.items()):
        print(f"  {league}: {count}")

if __name__ == "__main__":
    main()
