import pandas as pd
from pathlib import Path

FILE_PATH = Path(__file__).parent / "20251222_bombay711_tracker_consolidated.xlsx"

if not FILE_PATH.exists():
    raise FileNotFoundError(f"Excel file not found at: {FILE_PATH}")

# Load first sheet
xl = pd.ExcelFile(FILE_PATH)
print("Sheets:", xl.sheet_names)

# Read the first sheet by default
sheet_name = xl.sheet_names[0]
df = xl.parse(sheet_name)

print("Columns:", list(df.columns))
print("Sample rows (top 10):")
print(df.head(10).to_string(index=False))

# Save a lightweight preview for review
preview_path = Path(__file__).parent / "20251222_picks_preview.csv"
df.head(25).to_csv(preview_path, index=False)
print(f"Preview saved to: {preview_path}")
