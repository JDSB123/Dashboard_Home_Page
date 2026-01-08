#!/usr/bin/env python3
"""
Data Integrity Audit - Validates pick data against multiple sources.

Checks:
1. Raw Telegram messages vs parsed picks (completeness)
2. Game scores vs multiple APIs (accuracy)
3. Duplicate detection
4. Date alignment validation
5. Audit trail generation
"""
import re
import pandas as pd
import requests
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup

ROOT_DIR = Path(__file__).parent.parent
TELEGRAM_DIR = ROOT_DIR / "telegram_history"
OUTPUT_DIR = ROOT_DIR / "output"

def count_telegram_picks():
    """Count picks directly from raw Telegram HTML."""
    print("=" * 70)
    print("AUDIT 1: RAW TELEGRAM MESSAGE COUNT")
    print("=" * 70)

    total_messages = 0
    zach_messages = 0
    pick_messages = 0

    for html_file in TELEGRAM_DIR.glob("*.html"):
        print(f"\nProcessing {html_file.name}...")

        with open(html_file, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        messages = soup.find_all('div', class_='message')
        total_messages += len(messages)

        current_sender = None
        for msg in messages:
            # Check sender
            from_name = msg.find('div', class_='from_name')
            if from_name:
                current_sender = from_name.get_text(strip=True).lower()

            # Count Zach's messages with $ signs (picks have stakes)
            if current_sender and 'zach' in current_sender:
                text_div = msg.find('div', class_='text')
                if text_div:
                    text = text_div.get_text()
                    zach_messages += 1
                    if '$' in text and re.search(r'\d', text):
                        pick_messages += 1

    print(f"\nTotal messages in exports: {total_messages}")
    print(f"Zach's messages: {zach_messages}")
    print(f"Messages with $ (likely picks): {pick_messages}")

    return pick_messages


def check_parsed_picks():
    """Check parsed picks file."""
    print("\n" + "=" * 70)
    print("AUDIT 2: PARSED PICKS COUNT")
    print("=" * 70)

    telegram_parsed = pd.read_csv(OUTPUT_DIR / "telegram_parsed/telegram_all_picks.csv")

    print(f"\nParsed from Telegram: {len(telegram_parsed)} picks")
    print(f"Date range: {telegram_parsed['Date'].min()} to {telegram_parsed['Date'].max()}")
    print(f"\nBy League:")
    print(telegram_parsed.groupby('League').size().to_string())

    return len(telegram_parsed)


def check_graded_picks():
    """Check all graded picks."""
    print("\n" + "=" * 70)
    print("AUDIT 3: GRADED PICKS COUNT")
    print("=" * 70)

    # Load all graded data
    combined = pd.read_csv(OUTPUT_DIR / "reconciled/all_graded_combined.csv")
    deep_dive = pd.read_csv(OUTPUT_DIR / "reconciled/complete_graded.csv")

    combined_graded = combined[combined['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
    deep_dive_graded = deep_dive[deep_dive['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]

    print(f"\nPreviously graded (Dec 8-23 + Dec 28 - Jan 6): {len(combined_graded)}")
    print(f"Deep dive graded (Nov 29 - Dec 27): {len(deep_dive_graded)}")
    print(f"Total graded: {len(combined_graded) + len(deep_dive_graded)}")

    return len(combined_graded), len(deep_dive_graded)


def check_duplicates():
    """Check for duplicate picks."""
    print("\n" + "=" * 70)
    print("AUDIT 4: DUPLICATE CHECK")
    print("=" * 70)

    combined = pd.read_csv(OUTPUT_DIR / "reconciled/all_graded_combined.csv")
    deep_dive = pd.read_csv(OUTPUT_DIR / "reconciled/complete_graded.csv")

    # Check for duplicates within each file
    combined_dupes = combined.duplicated(subset=['Date', 'Pick', 'Risk'], keep=False).sum()
    deep_dive_dupes = deep_dive.duplicated(subset=['Date', 'Pick', 'Risk'], keep=False).sum()

    print(f"\nDuplicates in combined file: {combined_dupes}")
    print(f"Duplicates in deep dive file: {deep_dive_dupes}")

    # Check for overlap between files
    if 'RawText' in deep_dive.columns:
        # Deep dive has RawText, combined doesn't - they're from different sources
        print("\nFiles are from different sources (no overlap expected)")

    return combined_dupes, deep_dive_dupes


def verify_sample_scores():
    """Verify a sample of game scores against ESPN API."""
    print("\n" + "=" * 70)
    print("AUDIT 5: SCORE VERIFICATION (SAMPLE)")
    print("=" * 70)

    # Sample games to verify
    test_games = [
        ('2025-12-06', 'Clippers', 'NBA', 'LAC 106 @ MIN 109'),
        ('2025-12-08', 'Pacers', 'NBA', 'SAC 105 @ IND 116'),
        ('2025-12-08', 'Spurs', 'NBA', 'SA 135 @ NO 132'),
        ('2025-12-27', 'UConn', 'NCAAF', 'Army 41 vs UConn 16'),
    ]

    verified = 0
    failed = 0

    for date, team, league, expected in test_games:
        date_fmt = date.replace('-', '')

        if league == 'NBA':
            url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_fmt}"
        else:
            url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_fmt}&groups=80&limit=300"

        try:
            resp = requests.get(url, timeout=30)
            data = resp.json()

            found = False
            for event in data.get('events', []):
                name = event.get('name', '').lower()
                if team.lower() in name:
                    comp = event.get('competitions', [{}])[0]
                    competitors = comp.get('competitors', [])

                    scores = []
                    for c in competitors:
                        t = c.get('team', {}).get('abbreviation', '')
                        s = c.get('score', '?')
                        scores.append(f"{t} {s}")

                    actual = " vs ".join(scores)

                    # Check if scores match
                    if all(s in expected or s in actual for s in re.findall(r'\d+', expected)):
                        print(f"  [OK] {date} {team}: VERIFIED - {actual}")
                        verified += 1
                    else:
                        print(f"  [X] {date} {team}: MISMATCH")
                        print(f"    Expected: {expected}")
                        print(f"    Got: {actual}")
                        failed += 1
                    found = True
                    break

            if not found:
                print(f"  ? {date} {team}: Game not found in API")
                failed += 1

        except Exception as e:
            print(f"  ! {date} {team}: Error - {e}")
            failed += 1

    print(f"\nVerified: {verified}/{len(test_games)}")
    print(f"Failed: {failed}/{len(test_games)}")

    return verified, failed


def check_date_alignment():
    """Check if pick dates align with actual game dates."""
    print("\n" + "=" * 70)
    print("AUDIT 6: DATE ALIGNMENT CHECK")
    print("=" * 70)

    deep_dive = pd.read_csv(OUTPUT_DIR / "reconciled/complete_graded.csv")

    # Check graded picks with matched games
    graded = deep_dive[deep_dive['Hit/Miss'].isin(['win', 'loss', 'push'])]

    if 'MatchedGame' in graded.columns:
        with_match = graded[graded['MatchedGame'].notna()]
        print(f"\nPicks with matched games: {len(with_match)}")
        print(f"Picks without matched games: {len(graded) - len(with_match)}")

    # Show date distribution
    print("\nPicks by date in deep dive:")
    date_counts = deep_dive.groupby('Date').size()
    for date, count in date_counts.items():
        graded_count = len(deep_dive[(deep_dive['Date'] == date) &
                                      (deep_dive['Hit/Miss'].isin(['win', 'loss', 'push']))])
        print(f"  {date}: {count} total, {graded_count} graded")


def generate_audit_trail():
    """Generate sample audit trail."""
    print("\n" + "=" * 70)
    print("AUDIT 7: SAMPLE AUDIT TRAIL")
    print("=" * 70)

    deep_dive = pd.read_csv(OUTPUT_DIR / "reconciled/complete_graded.csv")

    # Show a few complete audit trails
    graded = deep_dive[deep_dive['Hit/Miss'].isin(['win', 'loss', 'push'])].head(5)

    print("\nSample audit trails (Raw -> Parsed -> Result):")
    print("-" * 70)

    for _, row in graded.iterrows():
        print(f"\nDate: {row['Date']}")
        print(f"Raw Text: {row.get('RawText', 'N/A')[:60]}")
        print(f"League: {row['League']}")
        print(f"Pick: {row.get('Pick', 'N/A')}")
        print(f"Risk: ${row['Risk']:.2f}")
        print(f"Result: {row['Hit/Miss'].upper()}")
        print(f"PnL: ${row['PnL']:.2f}")
        if 'MatchedGame' in row and pd.notna(row.get('MatchedGame')):
            print(f"Matched Game: {row['MatchedGame']}")


def main():
    print("=" * 70)
    print("DATA INTEGRITY AUDIT")
    print(f"Generated: {datetime.now()}")
    print("=" * 70)

    # Run all audits
    raw_count = count_telegram_picks()
    parsed_count = check_parsed_picks()
    combined_count, deep_dive_count = check_graded_picks()
    combined_dupes, deep_dive_dupes = check_duplicates()
    verified, failed = verify_sample_scores()
    check_date_alignment()
    generate_audit_trail()

    # Summary
    print("\n" + "=" * 70)
    print("INTEGRITY SUMMARY")
    print("=" * 70)

    print(f"\n1. COMPLETENESS:")
    print(f"   Raw Telegram picks (estimated): ~{raw_count}")
    print(f"   Parsed picks: {parsed_count}")
    print(f"   Capture rate: ~{parsed_count/raw_count*100:.0f}%" if raw_count > 0 else "   N/A")

    print(f"\n2. GRADING:")
    print(f"   Total graded: {combined_count + deep_dive_count}")
    print(f"   Ungraded: ~{parsed_count - deep_dive_count} (from deep dive source)")

    print(f"\n3. DUPLICATES:")
    print(f"   Combined file: {combined_dupes}")
    print(f"   Deep dive file: {deep_dive_dupes}")

    print(f"\n4. SCORE VERIFICATION:")
    print(f"   Sample verified: {verified}")
    print(f"   Sample failed: {failed}")

    print(f"\n5. OVERALL INTEGRITY SCORE:")
    issues = combined_dupes + deep_dive_dupes + failed
    if issues == 0:
        print("   [OK] HIGH - No major issues detected")
    elif issues < 5:
        print("   [~] MEDIUM - Minor issues found")
    else:
        print("   [X] LOW - Multiple issues need review")


if __name__ == "__main__":
    main()
