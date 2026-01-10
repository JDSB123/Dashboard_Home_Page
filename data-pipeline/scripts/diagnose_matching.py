#!/usr/bin/env python3
"""Diagnose game matching issues."""

import pandas as pd

# Load schedule
sched = pd.read_csv('c:/Users/JB/green-bier-ventures/DASHBOARD_main/data-pipeline/output/master_schedule_all_leagues.csv')

print("=== SCHEDULE OVERVIEW ===")
print("Leagues:", sched['league'].unique())
print()

for league in ['NFL', 'NBA', 'NCAAF', 'NCAAM']:
    l_sched = sched[sched['league'] == league]
    print(f"{league}:")
    print(f"  Games: {len(l_sched)}")
    print(f"  Dates: {l_sched['date'].min()} to {l_sched['date'].max()}")
    all_dates = sorted(l_sched['date'].unique())
    print(f"  Last 10 dates: {all_dates[-10:]}")
    print()

# Check specific dates
print("=== NFL GAMES AROUND NOV 28-30 ===")
nfl = sched[sched['league'] == 'NFL']
print(sorted(nfl['date'].unique())[:20])
print()

# Check sample team names
print("=== SAMPLE TEAM NAMES ===")
print("NFL teams:", sched[sched['league']=='NFL']['home_team'].unique()[:10])
print()
print("NBA teams:", sched[sched['league']=='NBA']['home_team'].unique()[:10])
print()

# Check if there's a Steelers game
print("=== STEELERS/PITTSBURGH GAMES ===")
steelers = sched[(sched['home_team'].str.contains('Steel|Pitt', case=False, na=False)) | 
                 (sched['away_team'].str.contains('Steel|Pitt', case=False, na=False))]
print(steelers[['date','league','away_team','home_team']].head(10))
