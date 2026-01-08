#!/usr/bin/env python3
"""
Parse Telegram HTML exports to extract all picks.
Extracts picks from Zach Campbell messages with format: team spread/total odds $stake
"""
import re
import os
import pandas as pd
from pathlib import Path
from datetime import datetime
from bs4 import BeautifulSoup
from collections import defaultdict

# Paths (repo-root relative)
# This file lives at `data-pipeline/scripts/`, so repo root is 3 levels up.
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TELEGRAM_DIR = ROOT_DIR / "telegram_history"
OUTPUT_DIR = ROOT_DIR / "output" / "telegram_parsed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# League detection patterns
LEAGUE_PATTERNS = {
    'NFL': r'\b(chiefs|bills|ravens|bengals|cowboys|eagles|49ers|niners|lions|packers|vikings|bears|saints|falcons|bucs|buccaneers|panthers|seahawks|rams|cardinals|broncos|chargers|raiders|dolphins|jets|patriots|pats|steelers|browns|texans|colts|jaguars|jags|titans|commanders|giants)\b',
    'NBA': r'\b(lakers|celtics|warriors|dubs|bucks|heat|suns|nuggets|grizz|grizzlies|kings|cavs|cavaliers|nets|knicks|sixers|76ers|raptors|bulls|hawks|hornets|magic|pistons|stones|pacers|wizards|wiz|clippers|clips|mavs|mavericks|rockets|spurs|jazz|blazers|wolves|timberwolves|thunder|okc|pelicans|pels|nop|phx|nyk|bkn|min|uta|sas|mil|chi|den|orl|ind|mia|cle|hou|atl|nba)\b',
    'NCAAF': r'\b(cfp|cfb|college football|bowl|playoff|tulane|penn st|penn state|wash st|washington st|uf|florida|gt|georgia tech|jmu|james madison|mich|michigan st|ohio st|osu|bama|alabama|georgia|uga|lsu|ole miss|auburn|tamu|texas am|oklahoma|ou|usc|ucla|oregon|utah|colorado|arizona st|asu|wash|washington|stanford|cal|berkeley|notre dame|nd|clemson|fsu|florida st|miami|nc state|ncsu|virginia|uva|pitt|louisville|wake|duke|unc|north carolina|syracuse|bc|boston college|army|navy|byu|fresno|fresno st|boise|boise st|smu|memphis|tulsa|ucf|usf|cincy|cincinnati|wvu|west virginia|tcu|kansas st|ksu|iowa st|isu|ok st|oklahoma st|texas tech|ttu|kk|kansas)\b',
    'NCAAM': r'\b(duke|kentucky|uk|kansas|ku|jayhawks|unc|tar heels|zags|gonzaga|ucla|bruins|nova|villanova|baylor|houston|cougars|purdue|boilermakers|tennessee|vols|arizona|wildcats|uconn|huskies|arkansas|razorbacks|auburn|tigers|creighton|bluejays|marquette|xavier|hoosiers|indiana|michigan|wolverines|msu|spartans|ohio state|buckeyes|hawkeyes|iowa|illini|illinois|badgers|wisconsin|terps|maryland|scarlet knights|rutgers|nittany|penn state|wildcats|northwestern|gophers|minnesota|huskers|nebraska|pilots|portland|golden flashes|kent|kent state|mean green|north texas|jaguars|south alabama|cougars|washington state|wsu|trojans|usc|bulldogs|fresno|cougars|byu|black knights|army|tigers|clemson|rebels|ole miss|longhorns|texas|ducks|oregon|fighting irish|notre dame|hurricanes|miami|seminoles|fsu|florida state|cavaliers|virginia|wolfpack|nc state|orange|syracuse|panthers|pitt|cardinals|louisville|demon deacons|wake forest|yellow jackets|georgia tech|eagles|boston college|mustangs|smu|cardinal|stanford|bears|cal|buffaloes|colorado|utes|utah|sun devils|arizona state|monarchs|odu|old dominion|ncaam|cbb)\b',
}

# Segment patterns
SEGMENT_MAP = {
    '1h': '1H', '1st half': '1H', 'first half': '1H',
    '2h': '2H', '2nd half': '2H', 'second half': '2H',
    '1q': '1Q', '1st quarter': '1Q', 'first quarter': '1Q',
    '2q': '2Q', '3q': '3Q', '4q': '4Q',
    'fg': 'FG', 'full game': 'FG', 'game': 'FG',
}


def detect_league(text: str) -> str:
    """Detect league from pick text."""
    text_lower = text.lower()

    # Check for explicit CFP/CFB mentions first
    if re.search(r'\b(cfp|cfb|bowl|playoff)\b', text_lower):
        return 'NCAAF'

    for league, pattern in LEAGUE_PATTERNS.items():
        if re.search(pattern, text_lower):
            return league

    return 'UNKNOWN'


def detect_segment(text: str) -> str:
    """Detect game segment from pick text."""
    text_lower = text.lower()

    for pattern, segment in SEGMENT_MAP.items():
        if pattern in text_lower:
            return segment

    return 'FG'  # Default to full game


def parse_pick_line(text: str, date: str) -> list:
    """
    Parse a pick line into structured data.
    Examples:
    - "portland 7 -110 $50" -> spread pick
    - "Kent u161 $33" -> under total
    - "north texas o135.5 -110 $33" -> over total
    - "Army -8 -110 $50" -> spread
    - "Mavs -3 -111 $50" -> spread
    """
    picks = []

    # Split on <br> for multiple picks in one message
    lines = re.split(r'<br>|<br/>|<br />', text)

    # Context within a single Telegram message (used for "teamless" totals that
    # follow a team line, e.g. "Fresno -1 -110 $50<br>Over 20 -112 $50").
    last_team: str | None = None

    segment_patterns = sorted(SEGMENT_MAP.keys(), key=len, reverse=True)

    def _strip_segment_tokens(s: str) -> str:
        out = s
        for pat in segment_patterns:
            out = re.sub(rf'\b{re.escape(pat)}\b', ' ', out, flags=re.IGNORECASE)
        out = re.sub(r'\s+', ' ', out).strip()
        return out

    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue

        # Skip obvious non-pick messages that contain $ amounts (e.g., payments).
        # We require some betting-like token beyond the stake.
        line_lower = line.lower()
        has_betting_signal = (
            bool(re.search(r'([+-]\d{2,4})\b', line))  # odds
            or bool(re.search(r'\b(?:over|under)\s*\d', line_lower))
            or bool(re.search(r'\b[ou]\s*\d', line_lower))
            or 'ml' in line_lower
            or bool(re.search(r'\b[+-]\d+\.?\d*\b', line))  # spreads
        )
        if not has_betting_signal:
            continue

        # Extract stake ($XX or $XX,XXX)
        stake_match = re.search(r'\$(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)', line)
        if not stake_match:
            continue  # No stake = not a confirmed pick

        stake = float(stake_match.group(1).replace(',', ''))

        # Extract odds (-XXX or +XXX). Prefer odds adjacent to the stake to avoid
        # grabbing trailing result markers like "-55".
        odds = '-110'  # Default odds
        odds_matches = list(re.finditer(r'([+-]\d{2,4})\s*\$\d', line))
        if odds_matches:
            odds = odds_matches[-1].group(1)
        else:
            odds_matches = list(re.finditer(r'\$\d+(?:,?\d{3})*(?:\.\d{2})?\s*([+-]\d{2,4})', line))
            if odds_matches:
                odds = odds_matches[-1].group(1)
            else:
                odds_tokens = re.findall(r'([+-]\d{2,4})\b', line)
                if odds_tokens:
                    odds = odds_tokens[-1]
        # Guardrail: American odds should be at least +/-100 (avoid bad parses like "-12").
        try:
            if abs(int(odds)) < 100:
                odds = '-110'
        except Exception:
            odds = '-110'

        # Detect league and segment
        league = detect_league(line)
        segment = detect_segment(line)

        # Remove segment tokens before attempting to parse team/pick tokens.
        line_no_seg = _strip_segment_tokens(line)

        # Handle totals with no team specified (e.g., "U137.5 -110 $50", "2h u17 -108 $50", "Over 20 -112 $50")
        total_word_match = re.match(r'^\s*(over|under)\s*(\d+\.?\d*)\b', line_no_seg, re.IGNORECASE)
        total_ou_match = re.match(r'^\s*([ou])\s*(\d+\.?\d*)\b', line_no_seg, re.IGNORECASE)
        if total_word_match or total_ou_match:
            if total_word_match:
                ou_word = total_word_match.group(1).lower()
                total = total_word_match.group(2)
                pick_type = f"{'Over' if ou_word == 'over' else 'Under'} {total}"
            else:
                ou = total_ou_match.group(1).lower()
                total = total_ou_match.group(2)
                pick_type = f"{'Over' if ou == 'o' else 'Under'} {total}"

            pick_str = f"{pick_type} ({odds})"
            inferred_team = last_team or ''
            picks.append({
                'Date': date,
                'League': league,
                'Matchup': inferred_team,  # Will be enriched later (fallback to last team in message)
                'Segment': segment,
                'Pick': pick_str,
                'Odds': odds,
                'Risk': stake,
                'ToWin': calculate_to_win(stake, odds),
                'RawText': line,
            })
            continue

        # Extract team + pick token (spread/total/ml).
        # Important: Avoid consuming "o/u" when it's directly attached to a number
        # (e.g., "Pels o228.5" should parse as team="Pels", token="o228.5").
        pick_match = re.search(
            r'([A-Za-z]+(?:\s+(?![ou]\d)[A-Za-z]+){0,3})\s*'  # Team (1-4 words)
            r'([ou]\d+\.?\d*|[+-]?\d+\.?\d*|ml)\b',       # Total, spread, or ML
            line_no_seg, re.IGNORECASE
        )

        if pick_match:
            team_raw = pick_match.group(1).strip()
            pick_value = pick_match.group(2).lower().strip()

            # Normalize team display (keep original-ish casing for readability)
            team = team_raw.title()
            last_team = team

            # Determine pick type
            if pick_value.startswith('o'):
                pick_type = f"Over {pick_value[1:]}"
            elif pick_value.startswith('u'):
                pick_type = f"Under {pick_value[1:]}"
            elif pick_value == 'ml':
                pick_type = f"{team} ML"
            else:
                # Spread vs. moneyline: if the numeric token looks like American odds
                # and matches the extracted odds, treat as moneyline.
                try:
                    pv = float(pick_value)
                    if abs(int(pv)) >= 100 and str(int(pv)) == str(int(odds)):
                        pick_type = f"{team} ML"
                    else:
                        pick_type = f"{team} {pick_value}"
                except Exception:
                    pick_type = f"{team} {pick_value}"

            pick_str = f"{pick_type} ({odds})"

            picks.append({
                'Date': date,
                'League': league,
                'Matchup': team,  # Will be enriched later
                'Segment': segment,
                'Pick': pick_str,
                'Odds': odds,
                'Risk': stake,
                'ToWin': calculate_to_win(stake, odds),
                'RawText': line,
            })
            continue

        # Fallback: totals found anywhere in the line (rare formatting variants).
        total_only_match = re.search(r'\b([ou])\s*(\d+\.?\d*)\b', line_no_seg, re.IGNORECASE)
        if total_only_match:
            ou = total_only_match.group(1).lower()
            total = total_only_match.group(2)
            pick_type = f"{'Over' if ou == 'o' else 'Under'} {total}"
            pick_str = f"{pick_type} ({odds})"
            picks.append({
                'Date': date,
                'League': league,
                'Matchup': last_team or '',  # Unknown / not specified; fall back to last team in message
                'Segment': segment,
                'Pick': pick_str,
                'Odds': odds,
                'Risk': stake,
                'ToWin': calculate_to_win(stake, odds),
                'RawText': line,
            })

    return picks


def calculate_to_win(stake: float, odds: str) -> float:
    """Calculate potential winnings based on American odds."""
    try:
        odds_num = int(odds)
        if odds_num > 0:
            return stake * (odds_num / 100)
        else:
            return stake * (100 / abs(odds_num))
    except:
        return stake  # Default 1:1


def parse_telegram_html(filepath: Path) -> list:
    """Parse a Telegram HTML export file and extract all picks."""
    print(f"Parsing {filepath.name}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    picks = []
    current_date = None

    # Find all messages
    messages = soup.find_all('div', class_='message')

    for msg in messages:
        # Check for date service message
        if 'service' in msg.get('class', []):
            date_div = msg.find('div', class_='body')
            if date_div:
                date_text = date_div.get_text(strip=True)
                try:
                    # Parse "14 December 2025" format
                    dt = datetime.strptime(date_text, "%d %B %Y")
                    current_date = dt.strftime("%Y-%m-%d")
                except:
                    pass
            continue

        # Get message date from title attribute
        date_div = msg.find('div', class_='date')
        if date_div and date_div.get('title'):
            try:
                # Parse "14.12.2025 15:01:28 UTC-06:00" format
                date_str = date_div['title'].split()[0]
                dt = datetime.strptime(date_str, "%d.%m.%Y")
                current_date = dt.strftime("%Y-%m-%d")
            except:
                pass

        if not current_date:
            continue

        # Get sender name
        from_name = msg.find('div', class_='from_name')
        sender = from_name.get_text(strip=True) if from_name else None

        # Only process Zach Campbell messages (the confirmed bets)
        # Also check for "ZC" initials in joined messages
        is_zach = False
        if sender and 'zach' in sender.lower():
            is_zach = True
        elif 'joined' in msg.get('class', []):
            # Check previous sibling for Zach
            prev = msg.find_previous_sibling('div', class_='message')
            if prev:
                prev_name = prev.find('div', class_='from_name')
                if prev_name and 'zach' in prev_name.get_text(strip=True).lower():
                    is_zach = True

        if not is_zach:
            continue

        # Get message text
        text_div = msg.find('div', class_='text')
        if not text_div:
            continue

        text = str(text_div)  # Keep HTML for <br> parsing
        text = re.sub(r'<div[^>]*>|</div>', '', text)  # Remove div tags

        # Parse picks from this message
        msg_picks = parse_pick_line(text, current_date)
        picks.extend(msg_picks)

    print(f"  Found {len(picks)} picks")
    return picks


def main():
    """Main function to parse all Telegram exports."""
    all_picks = []

    # Find all HTML files in telegram_history
    html_files = list(TELEGRAM_DIR.glob("*.html"))

    if not html_files:
        print(f"No HTML files found in {TELEGRAM_DIR}")
        return

    print(f"Found {len(html_files)} HTML files to parse")
    print()

    for filepath in sorted(html_files):
        picks = parse_telegram_html(filepath)
        all_picks.extend(picks)

    if not all_picks:
        print("No picks found!")
        return

    # Create DataFrame
    df = pd.DataFrame(all_picks)

    # Sort by date
    df = df.sort_values('Date')

    # Summary stats
    print()
    print("=" * 50)
    print("TELEGRAM EXPORT SUMMARY")
    print("=" * 50)
    print(f"Total picks extracted: {len(df)}")
    print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
    print()
    print("Picks by date:")
    print(df.groupby('Date').size().to_string())
    print()
    print("Picks by league:")
    print(df.groupby('League').size().to_string())
    print()

    # Save outputs
    csv_path = OUTPUT_DIR / "telegram_all_picks.csv"
    df.to_csv(csv_path, index=False)
    print(f"Saved to {csv_path}")

    # Save Excel
    xlsx_path = OUTPUT_DIR / "telegram_all_picks.xlsx"
    df.to_excel(xlsx_path, index=False)
    print(f"Saved to {xlsx_path}")

    return df


if __name__ == "__main__":
    main()
