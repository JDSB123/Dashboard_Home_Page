#!/usr/bin/env python3
"""
Generate a formatted, sortable, filterable Excel workbook from the master schedule CSV.
Matches the formatting style of the Bombay711 pick tracker.
"""

import csv
from datetime import datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

# Paths
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
CSV_PATH = OUTPUT_DIR / "master_schedule_all_leagues.csv"
XLSX_PATH = OUTPUT_DIR / "master_schedule_all_leagues.xlsx"

# Formatting constants
HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")  # Dark blue
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
DATA_FONT = Font(name="Calibri", size=10)
ALTERNATING_FILL = PatternFill(start_color="D6E3F8", end_color="D6E3F8", fill_type="solid")  # Light blue
CENTER_ALIGN = Alignment(horizontal="center", vertical="center")
LEFT_ALIGN = Alignment(horizontal="left", vertical="center")
THIN_BORDER = Border(
    left=Side(style="thin", color="B4B4B4"),
    right=Side(style="thin", color="B4B4B4"),
    top=Side(style="thin", color="B4B4B4"),
    bottom=Side(style="thin", color="B4B4B4")
)

# League colors for conditional formatting
LEAGUE_COLORS = {
    "NBA": PatternFill(start_color="FDE9D9", end_color="FDE9D9", fill_type="solid"),    # Light orange
    "NCAAM": PatternFill(start_color="EBF1DE", end_color="EBF1DE", fill_type="solid"),  # Light green
    "NFL": PatternFill(start_color="DCE6F1", end_color="DCE6F1", fill_type="solid"),    # Light blue
    "NCAAF": PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid"),  # Light red
}

# Column widths
COLUMN_WIDTHS = {
    "game_id": 12,
    "league": 10,
    "date": 12,
    "away_team": 12,
    "home_team": 12,
    "away_team_full": 25,
    "home_team_full": 25,
    "away_score": 12,
    "home_score": 12,
    "status": 10,
    "source": 10,
    "fetched_at": 20,
}


def load_csv_data():
    """Load data from CSV file."""
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader), reader.fieldnames


def create_formatted_excel():
    """Create formatted Excel workbook."""
    print("\n📊 Generating Formatted Excel Workbook\n")
    print("=" * 60)
    
    # Load data
    data, headers = load_csv_data()
    print(f"  ✅ Loaded {len(data)} rows from CSV")
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Master Schedule"
    
    # Freeze top row
    ws.freeze_panes = "A2"
    
    # Write headers
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = CENTER_ALIGN
        cell.border = THIN_BORDER
        
        # Set column width
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = COLUMN_WIDTHS.get(header, 15)
    
    # Write data rows
    for row_idx, row_data in enumerate(data, 2):
        league = row_data.get("league", "")
        
        for col_idx, header in enumerate(headers, 1):
            value = row_data.get(header, "")
            
            # Convert numeric fields
            if header in ("away_score", "home_score", "game_id"):
                try:
                    value = int(value) if value else ""
                except (ValueError, TypeError):
                    pass
            
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = DATA_FONT
            cell.border = THIN_BORDER
            
            # Alignment
            if header in ("away_score", "home_score", "game_id"):
                cell.alignment = CENTER_ALIGN
            elif header in ("date", "league", "status"):
                cell.alignment = CENTER_ALIGN
            else:
                cell.alignment = LEFT_ALIGN
            
            # League-based row coloring
            if league in LEAGUE_COLORS:
                cell.fill = LEAGUE_COLORS[league]
    
    # Add auto-filter (creates sortable/filterable columns)
    last_col = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_col}{len(data) + 1}"
    
    # Create table for better filtering experience
    table_ref = f"A1:{last_col}{len(data) + 1}"
    table = Table(displayName="MasterSchedule", ref=table_ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False
    )
    ws.add_table(table)
    
    # Add summary sheet
    ws_summary = wb.create_sheet(title="Summary")
    ws_summary.freeze_panes = "A2"
    
    # Summary headers
    summary_headers = ["League", "Games", "Final", "Scheduled", "Date Range"]
    for col_idx, header in enumerate(summary_headers, 1):
        cell = ws_summary.cell(row=1, column=col_idx, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = CENTER_ALIGN
        cell.border = THIN_BORDER
    
    # Calculate summary stats
    leagues = ["NBA", "NCAAM", "NFL", "NCAAF"]
    for row_idx, league in enumerate(leagues, 2):
        league_games = [g for g in data if g.get("league") == league]
        final_count = sum(1 for g in league_games if g.get("status") == "final")
        scheduled_count = sum(1 for g in league_games if g.get("status") == "scheduled")
        dates = [g.get("date", "") for g in league_games if g.get("date")]
        date_range = f"{min(dates)} to {max(dates)}" if dates else ""
        
        ws_summary.cell(row=row_idx, column=1, value=league).fill = LEAGUE_COLORS.get(league)
        ws_summary.cell(row=row_idx, column=2, value=len(league_games))
        ws_summary.cell(row=row_idx, column=3, value=final_count)
        ws_summary.cell(row=row_idx, column=4, value=scheduled_count)
        ws_summary.cell(row=row_idx, column=5, value=date_range)
        
        for col_idx in range(1, 6):
            ws_summary.cell(row=row_idx, column=col_idx).border = THIN_BORDER
            ws_summary.cell(row=row_idx, column=col_idx).alignment = CENTER_ALIGN
    
    # Set summary column widths
    ws_summary.column_dimensions["A"].width = 10
    ws_summary.column_dimensions["B"].width = 10
    ws_summary.column_dimensions["C"].width = 10
    ws_summary.column_dimensions["D"].width = 12
    ws_summary.column_dimensions["E"].width = 25
    
    # Total row
    total_row = len(leagues) + 2
    ws_summary.cell(row=total_row, column=1, value="TOTAL").font = Font(bold=True)
    ws_summary.cell(row=total_row, column=2, value=len(data)).font = Font(bold=True)
    ws_summary.cell(row=total_row, column=3, value=sum(1 for g in data if g.get("status") == "final")).font = Font(bold=True)
    
    # Add metadata sheet
    ws_meta = wb.create_sheet(title="Metadata")
    meta_info = [
        ("Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("Source", "fetch_completed_boxes.py"),
        ("Total Games", len(data)),
        ("Date Range", f"{min(g.get('date','') for g in data)} to {max(g.get('date','') for g in data)}"),
        ("Storage", "metricstrackersgbsv/master-schedules/"),
    ]
    for row_idx, (key, value) in enumerate(meta_info, 1):
        ws_meta.cell(row=row_idx, column=1, value=key).font = Font(bold=True)
        ws_meta.cell(row=row_idx, column=2, value=value)
    ws_meta.column_dimensions["A"].width = 15
    ws_meta.column_dimensions["B"].width = 40
    
    # Save
    wb.save(XLSX_PATH)
    
    print(f"\n💾 Saved: {XLSX_PATH}")
    print(f"   Size: {XLSX_PATH.stat().st_size / 1024:.1f} KB")
    print("\n✨ Features:")
    print("   • Frozen header row")
    print("   • Auto-filter on all columns (sortable/filterable)")
    print("   • League-based row coloring")
    print("   • Summary sheet with stats")
    print("   • Metadata sheet")
    
    return XLSX_PATH


if __name__ == "__main__":
    create_formatted_excel()
