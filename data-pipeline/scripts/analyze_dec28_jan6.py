#!/usr/bin/env python3
"""
Analyze and grade picks for Dec 28 - Jan 6 only.
Telegram is the source of truth.
"""
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup
import re
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

def load_raw_telegram():
    """Load raw telegram messages from HTML files."""
    html_files = list((ROOT_DIR / 'telegram_history').glob('*.html'))
    print(f"Found {len(html_files)} HTML files")
    
    all_messages = []
    for hf in html_files:
        soup = BeautifulSoup(hf.read_text(encoding='utf-8'), 'html.parser')
        msgs = soup.find_all('div', class_='message')
        for m in msgs:
            date_elem = m.find('div', class_='date')
            if date_elem:
                date_str = date_elem.get('title', '')
                text_elem = m.find('div', class_='text')
                text = text_elem.get_text(strip=True) if text_elem else ''
                all_messages.append({'date': date_str, 'text': text})
    
    df = pd.DataFrame(all_messages)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    return df

def main():
    print("=" * 60)
    print("ANALYZING DEC 28 - JAN 6 PICKS")
    print("=" * 60)
    
    # Load raw telegram
    raw = load_raw_telegram()
    
    # Remove timezone info for comparison
    raw['date'] = raw['date'].dt.tz_localize(None)
    
    # Filter to Dec 28 - Jan 6
    start = pd.to_datetime('2025-12-28')
    end = pd.to_datetime('2026-01-07')  # Include Jan 6
    filtered = raw[(raw['date'] >= start) & (raw['date'] < end)]
    
    print(f"\nTotal messages Dec 28 - Jan 6: {len(filtered)}")
    print("\nMessages by date:")
    print(filtered.groupby(filtered['date'].dt.strftime('%Y-%m-%d')).size())
    
    # Show all messages with $ (betting messages)
    print("\n" + "=" * 60)
    print("ALL BETTING MESSAGES (with $)")
    print("=" * 60)
    
    for date in sorted(filtered['date'].dt.strftime('%Y-%m-%d').unique()):
        day_msgs = filtered[filtered['date'].dt.strftime('%Y-%m-%d') == date]
        betting_msgs = day_msgs[day_msgs['text'].str.contains(r'\$', regex=True, na=False)]
        
        print(f"\n--- {date} ({len(betting_msgs)} betting messages) ---")
        for _, row in betting_msgs.iterrows():
            print(f"  {row['text'][:150]}...")
    
    # Also show JB batch messages
    print("\n" + "=" * 60)
    print("JB BATCH MESSAGES")
    print("=" * 60)
    
    jb_pattern = re.compile(r'^\d+\s+JB\s+', re.IGNORECASE)
    for date in sorted(filtered['date'].dt.strftime('%Y-%m-%d').unique()):
        day_msgs = filtered[filtered['date'].dt.strftime('%Y-%m-%d') == date]
        jb_msgs = day_msgs[day_msgs['text'].apply(lambda x: bool(jb_pattern.match(str(x))))]
        
        if len(jb_msgs) > 0:
            print(f"\n--- {date} ({len(jb_msgs)} JB messages) ---")
            for _, row in jb_msgs.iterrows():
                print(f"  {row['text'][:200]}")

if __name__ == "__main__":
    main()
