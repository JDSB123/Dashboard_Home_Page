#!/usr/bin/env python3
"""
Review the audited picks spreadsheet provided by user.
"""
import pandas as pd
from pathlib import Path

# Load the Excel file
excel_path = r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"

# Check if file exists
if Path(excel_path).exists():
    print(f"✓ Found: {excel_path}\n")
    
    # Load all sheets
    xls = pd.ExcelFile(excel_path)
    print(f"Sheet names: {xls.sheet_names}\n")
    
    # Load each sheet and show summary
    for sheet in xls.sheet_names:
        df = pd.read_excel(excel_path, sheet_name=sheet)
        print(f"{'='*70}")
        print(f"Sheet: {sheet}")
        print(f"{'='*70}")
        print(f"Shape: {df.shape}")
        print(f"Columns: {list(df.columns)}\n")
        print(df.head(15).to_string())
        print(f"\n... ({len(df)} total rows)\n")
else:
    print(f"✗ File not found: {excel_path}")
