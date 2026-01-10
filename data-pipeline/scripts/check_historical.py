"""Check what's in graded_all_historical.csv."""
import pandas as pd

df = pd.read_csv('data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv')

print(f"Rows: {len(df)}")
print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
print(f"Columns: {df.columns.tolist()}")

print("\n=== BY DATE ===")
by_date = df.groupby('Date').size().sort_index()
for d, cnt in by_date.items():
    print(f"  {d}: {cnt}")

print("\n=== SAMPLE PICKS ===")
for i, r in df.head(5).iterrows():
    print(f"  [{r['Date']}] {r['Pick']}")
