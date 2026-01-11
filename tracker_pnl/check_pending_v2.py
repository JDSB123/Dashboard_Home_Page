import pandas as pd

df = pd.read_excel("enhanced_pnl_report.xlsx", sheet_name="Picks")
pending = df[df["result"] == "Pending"]

print(f"Total Pending: {len(pending)}")
print("\nSample pending picks:")
for _, row in pending.head(30).iterrows():
    print(f"  {row['date']} | {row['league']:6} | {row['segment']:3} | {row['pick'][:40]}")
