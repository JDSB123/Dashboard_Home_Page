#!/usr/bin/env python3
"""Compare telegram parsed data with existing graded data."""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent

# Load all data sources
telegram = pd.read_csv(ROOT_DIR / 'output/telegram_parsed/telegram_all_picks.csv')
historical = pd.read_csv(ROOT_DIR / 'pick-analysis-tracker/output/graded_all_historical.csv')
recent = pd.read_csv(ROOT_DIR / 'output/graded/picks_dec28_jan6_graded.csv')

print('=== DATA SOURCE COMPARISON ===')
print()
print('TELEGRAM PARSED:')
print(f'  Total picks: {len(telegram)}')
print(f'  Date range: {telegram["Date"].min()} to {telegram["Date"].max()}')
print()
print('HISTORICAL GRADED (Dec 8-26):')
print(f'  Total picks: {len(historical)}')
print(f'  Date range: {historical["Date"].min()} to {historical["Date"].max()}')
print()
print('RECENT GRADED (Dec 28 - Jan 6):')
print(f'  Total picks: {len(recent)}')
print(f'  Date range: {recent["Date"].min()} to {recent["Date"].max()}')
print()

# Compare by date
print('=== PICKS BY DATE COMPARISON ===')
print()
tg_dates = telegram.groupby('Date').size()
hist_dates = historical.groupby('Date').size()
recent_dates = recent.groupby('Date').size()

all_dates = sorted(set(tg_dates.index) | set(hist_dates.index) | set(recent_dates.index))

print(f'{"Date":<12} {"Telegram":<10} {"Historical":<12} {"Recent":<10} {"Diff"}')
print('-' * 55)
total_missing = 0
dates_with_issues = []
for d in all_dates:
    tg = tg_dates.get(d, 0)
    h = hist_dates.get(d, 0)
    r = recent_dates.get(d, 0)
    existing = h + r
    diff = tg - existing
    if diff != 0:
        total_missing += abs(diff)
        dates_with_issues.append((d, tg, existing, diff))
    flag = '!!' if diff != 0 else 'OK'
    print(f'{d:<12} {tg:<10} {h:<12} {r:<10} {diff:+d} {flag}')

print('-' * 55)
print(f'Total discrepancy: {total_missing} picks across {len(dates_with_issues)} dates')
print()

# Summary of issues
if dates_with_issues:
    print('=== DATES WITH DISCREPANCIES ===')
    for d, tg, existing, diff in dates_with_issues:
        if diff > 0:
            print(f'  {d}: Telegram has {diff} MORE picks than graded')
        else:
            print(f'  {d}: Telegram has {abs(diff)} FEWER picks than graded')
