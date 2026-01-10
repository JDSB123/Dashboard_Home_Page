#!/usr/bin/env python3
"""Deep analysis of telegram messages to understand pick patterns."""

from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
import pandas as pd
import re

TELEGRAM_DIR = Path(__file__).parent.parent.parent / 'telegram_history'
OUTPUT_DIR = Path(__file__).parent.parent.parent / 'output' / 'telegram_parsed'

def load_all_messages():
    """Load all messages from telegram HTML files."""
    html_files = list(TELEGRAM_DIR.glob('*.html'))
    all_msgs = []
    
    for fp in sorted(html_files):
        with open(fp, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        current_date = None
        for msg in soup.find_all('div', class_='message'):
            # Check for date service message
            if 'service' in msg.get('class', []):
                date_div = msg.find('div', class_='body')
                if date_div:
                    date_text = date_div.get_text(strip=True)
                    try:
                        dt = datetime.strptime(date_text, '%d %B %Y')
                        current_date = dt.strftime('%Y-%m-%d')
                    except:
                        pass
                continue
            
            from_name = msg.find('div', class_='from_name')
            sender = from_name.get_text(strip=True) if from_name else ''
            
            date_div = msg.find('div', class_='date')
            date_title = date_div.get('title', '') if date_div else ''
            msg_date = current_date or (date_title[:10] if date_title else '')
            
            # Extract time from title
            msg_time = ''
            if date_title:
                try:
                    msg_time = date_title.split()[1] if len(date_title.split()) > 1 else ''
                except:
                    pass
            
            text_div = msg.find('div', class_='text')
            text = text_div.get_text(separator=' ', strip=True) if text_div else ''
            
            if text.strip():
                all_msgs.append({
                    'sender': sender,
                    'date': msg_date,
                    'time': msg_time,
                    'text': text
                })
    
    return all_msgs


def main():
    print("Loading all telegram messages...")
    all_msgs = load_all_messages()
    print(f"Total messages: {len(all_msgs)}")
    
    # Find Zach's messages
    zach_msgs = [m for m in all_msgs if 'zach' in m['sender'].lower()]
    print(f"Zach messages: {len(zach_msgs)}")
    
    print("\n" + "="*80)
    print("ZACH BATCH PICK MESSAGES (starting with 'JB ')")
    print("="*80)
    
    jb_msgs = [m for m in zach_msgs if m['text'].startswith('JB ')]
    for m in jb_msgs:
        print(f"\n[{m['date']}] {m['time']}")
        print(m['text'])
        print("-" * 60)
    
    print(f"\nTotal JB batch messages: {len(jb_msgs)}")
    
    print("\n" + "="*80)
    print("OTHER ZACH MESSAGES WITH $ AMOUNTS (potential picks)")
    print("="*80)
    
    dollar_msgs = [m for m in zach_msgs if '$' in m['text'] and not m['text'].startswith('JB ')]
    for m in dollar_msgs[:40]:
        print(f"\n[{m['date']}] {m['time']}")
        print(m['text'][:300])
        print("-" * 40)
    
    print(f"\nTotal $ messages (non-JB): {len(dollar_msgs)}")
    
    print("\n" + "="*80)
    print("MESSAGES WITH SPREAD/OVER/UNDER PATTERNS")
    print("="*80)
    
    pick_pattern = re.compile(r'\b(under|over|u\d|o\d|[+-]\d{1,2}\.?\d?\s|spread|ml)\b', re.I)
    pick_msgs = [m for m in zach_msgs if pick_pattern.search(m['text']) and not m['text'].startswith('JB ') and '$' not in m['text']]
    for m in pick_msgs[:30]:
        print(f"\n[{m['date']}] {m['time']}")
        print(m['text'][:300])
        print("-" * 40)
    
    print(f"\nTotal pick pattern messages: {len(pick_msgs)}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--compare':
        # Compare mode: analyze current parsed output
        print("=== ANALYZING CURRENT PARSED OUTPUT ===")
        parsed_df = pd.read_csv(OUTPUT_DIR / 'telegram_all_picks.csv')
        print(f"Total picks: {len(parsed_df)}")
        print(f"Date range: {parsed_df['Date'].min()} to {parsed_df['Date'].max()}")
        print()
        print("Picks by date:")
        print(parsed_df.groupby('Date').size().to_string())
        print()
        print("Sample picks from Dec 7-9 (JB batch message days):")
        dec_picks = parsed_df[parsed_df['Date'].isin(['2025-12-07', '2025-12-08', '2025-12-09'])]
        print(dec_picks[['Date', 'Matchup', 'Segment', 'Pick', 'Risk']].head(40).to_string())
    else:
        main()
