import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

hist = pd.read_csv(ROOT / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv')
hist['Date'] = pd.to_datetime(hist['Date'])

dec26 = hist[hist['Date'] == '2025-12-26']
dec27 = hist[hist['Date'] == '2025-12-27']

print('=== Dec 26 in Historical ===')
print(f'Count: {len(dec26)}')
print(f'Total PnL: ${dec26["PnL"].sum():,.0f}')

print()
print('=== Dec 27 in Historical ===')  
print(f'Count: {len(dec27)}')
print(f'Total PnL: ${dec27["PnL"].sum():,.0f}')

miss = pd.read_csv(ROOT / 'output/reconciled/missing_picks_graded.csv')
miss['Date'] = pd.to_datetime(miss['Date'])

dec26m = miss[miss['Date'] == '2025-12-26']
dec27m = miss[miss['Date'] == '2025-12-27']

print()
print('=== Dec 26 in Missing Graded ===')
print(f'Count: {len(dec26m)}')
print(f'Total PnL: ${dec26m["PnL"].sum():,.0f}')

print()
print('=== Dec 27 in Missing Graded ===')
print(f'Count: {len(dec27m)}')
print(f'Total PnL: ${dec27m["PnL"].sum():,.0f}')

# Audit check
audit = pd.read_excel(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')
audit['Date'] = pd.to_datetime(audit['Date'])
audit = audit[audit['Matchup'] != 'ALL']

dec26a = audit[audit['Date'] == '2025-12-26']
dec27a = audit[audit['Date'] == '2025-12-27']

print()
print('=== Dec 26 in AUDIT ===')
print(f'Count: {len(dec26a)}')
print(f'Total PnL: ${dec26a["PnL"].sum():,.0f}')

print()
print('=== Dec 27 in AUDIT ===')
print(f'Count: {len(dec27a)}')
print(f'Total PnL: ${dec27a["PnL"].sum():,.0f}')
