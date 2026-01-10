"""Compare pick text between telegram and final to understand matching issues."""
import pandas as pd

tg = pd.read_csv('output/telegram_parsed/telegram_all_picks.csv')
final = pd.read_csv('output/reconciled/final_tracker_complete.csv')

# Filter to Dec 13
tg['DateNorm'] = pd.to_datetime(tg['Date'])
final['DateNorm'] = pd.to_datetime(final['Date'])

tg_dec13 = tg[tg['DateNorm'].dt.date.astype(str) == '2025-12-13']
final_dec13 = final[final['DateNorm'].dt.date.astype(str) == '2025-12-13']

print(f"Telegram Dec 13: {len(tg_dec13)} picks")
print(f"Final Dec 13: {len(final_dec13)} picks")
print()
print("=== TELEGRAM DEC 13 (first 10) ===")
for i, r in tg_dec13.head(10).iterrows():
    print(f"  TG: Pick=[{r['Pick']}] Odds=[{r['Odds']}] Risk=[{r['Risk']}]")

print()
print("=== FINAL DEC 13 (first 10) ===")
for i, r in final_dec13.head(10).iterrows():
    print(f"  FN: Pick=[{r['Pick']}] Odds=[{r['Odds']}] Risk=[{r['Risk']}]")

# Now check for exact matches
print("\n" + "="*80)
print("MATCHING ANALYSIS")
print("="*80)

tg_picks = set()
for i, r in tg_dec13.iterrows():
    key = (str(r['Pick']).strip().lower(), str(r['Odds']).strip(), str(r['Risk']).strip())
    tg_picks.add(key)

final_picks = set()
for i, r in final_dec13.iterrows():
    key = (str(r['Pick']).strip().lower(), str(r['Odds']).strip(), str(r['Risk']).strip())
    final_picks.add(key)

print(f"\nUnique telegram pick keys: {len(tg_picks)}")
print(f"Unique final pick keys: {len(final_picks)}")
print(f"Intersection: {len(tg_picks & final_picks)}")
print(f"In telegram but NOT in final: {len(tg_picks - final_picks)}")
print(f"In final but NOT in telegram: {len(final_picks - tg_picks)}")

print("\n--- In FINAL but NOT in TELEGRAM (from audit?) ---")
for p in list(final_picks - tg_picks)[:10]:
    print(f"  {p}")
