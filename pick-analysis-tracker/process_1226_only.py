import pandas as pd
import re
from pathlib import Path

# Constants
BASE_STAKE = 50_000

# Load 12/26 picks
input_path = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\assets\misc_data\20251226_picks_preview.csv')
output_path = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\pick-analysis-tracker\output\normalized_1226_only.csv')

df = pd.read_csv(input_path)

# Rename columns
df = df.rename(columns={
    "Pick (Odds)": "Pick",
    "To Win": "ToWin",
    "Hit/Miss": "HitMiss"
})

# Extract odds from Pick column
def extract_odds(pick_text):
    if not isinstance(pick_text, str):
        return -110
    lower = pick_text.lower()
    if "even" in lower or "pk" in lower or "pick" in lower:
        return 100
    match = re.search(r"([-+]\d{3,4})", pick_text)
    if match:
        return int(match.group(1))
    return -110

# Calculate Risk/ToWin based on odds
def calc_stake(odds, existing_risk, existing_to_win):
    if existing_risk and existing_to_win:
        return existing_risk, existing_to_win, "explicit"
    
    if odds < 0:
        # Negative odds: to win 50k, risk more
        risk = abs(odds) * BASE_STAKE / 100
        return risk, BASE_STAKE, "rule-negative"
    else:
        # Positive odds: risk 50k, win more
        to_win = BASE_STAKE * odds / 100
        return BASE_STAKE, to_win, "rule-positive"

# Process each row
records = []
for _, row in df.iterrows():
    pick_text = row['Pick']
    odds = extract_odds(pick_text)
    
    existing_risk = row['Risk'] if pd.notna(row['Risk']) else None
    existing_to_win = row['ToWin'] if pd.notna(row['ToWin']) else None
    
    risk, to_win, stake_rule = calc_stake(odds, existing_risk, existing_to_win)
    
    records.append({
        "Date": row['Date'],
        "League": row['League'],
        "Matchup": row['Matchup'],
        "Segment": row['Segment'].upper() if pd.notna(row['Segment']) else "FG",
        "Pick": pick_text,
        "Odds": odds,
        "Risk": risk,
        "ToWin": to_win,
        "StakeRule": stake_rule,
        "HitMiss": None,
        "PnL": None
    })

df_normalized = pd.DataFrame(records)
df_normalized.to_csv(output_path, index=False)
print(f"Normalized {len(df_normalized)} rows -> {output_path}")
print(df_normalized[['League', 'Matchup', 'Segment', 'Pick', 'Odds', 'Risk', 'ToWin']].head())
