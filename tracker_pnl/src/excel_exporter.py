"""
Excel Exporter Module
Exports picks to Excel format matching the desired output structure.
"""

import pandas as pd
from typing import List, Optional
from pathlib import Path

from .pick_tracker import Pick, PickTracker


class ExcelExporter:
    """Exports picks to Excel format."""
    
    def __init__(self):
        """Initialize Excel exporter."""
        self.columns = [
            "Date & Time (CST)",
            "Date",
            "League",
            "Matchup (Away @ Home)",
            "Segment",
            "Pick (Odds)",
            "Risk ($)",
            "To Win ($)",
            "Final Score",
            "1H Score",
            "Hit/Miss/Push"
        ]
    
    def export_tracker_to_excel(self, tracker: PickTracker, output_path: str, 
                                 sheet_name: str = "Picks"):
        """
        Export PickTracker to Excel file.
        
        Args:
            tracker: PickTracker instance
            output_path: Path to output Excel file
            sheet_name: Name of the Excel sheet
        """
        # Convert picks to list of dictionaries
        data = tracker.to_dataframe_dict()
        
        if not data:
            # Create empty DataFrame with columns
            df = pd.DataFrame(columns=self.columns)
        else:
            # Create DataFrame
            df = pd.DataFrame(data)
            
            # Ensure all columns are present
            for col in self.columns:
                if col not in df.columns:
                    df[col] = ""
            
            # Reorder columns
            df = df[self.columns]
            
            # Sort by date (most recent first)
            if "Date" in df.columns:
                df['Date_Sort'] = pd.to_datetime(df['Date'], errors='coerce')
                df = df.sort_values('Date_Sort', ascending=False)
                df = df.drop('Date_Sort', axis=1)
        
        # Write to Excel
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            
            # Format worksheet
            worksheet = writer.sheets[sheet_name]
            
            # Auto-adjust column widths
            for idx, col in enumerate(self.columns, 1):
                column_letter = self._get_column_letter(idx)
                max_length = max(
                    df[col].astype(str).map(len).max() if len(df) > 0 else 0,
                    len(col)
                )
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
    
    def export_picks_to_excel(self, picks: List[Pick], output_path: str,
                              sheet_name: str = "Picks"):
        """
        Export list of picks to Excel file.
        
        Args:
            picks: List of Pick objects
            output_path: Path to output Excel file
            sheet_name: Name of the Excel sheet
        """
        tracker = PickTracker()
        tracker.add_picks(picks)
        self.export_tracker_to_excel(tracker, output_path, sheet_name)
    
    def _get_column_letter(self, n: int) -> str:
        """Convert column number to Excel column letter."""
        result = ""
        while n > 0:
            n -= 1
            result = chr(65 + (n % 26)) + result
            n //= 26
        return result
    
    def update_excel_file(self, excel_path: str, tracker: PickTracker,
                          sheet_name: str = "Picks"):
        """
        Update existing Excel file with new picks.
        
        Args:
            excel_path: Path to existing Excel file
            tracker: PickTracker with new picks
            sheet_name: Name of the Excel sheet
        """
        # Load existing data if file exists
        existing_picks = []
        if Path(excel_path).exists():
            try:
                existing_df = pd.read_excel(excel_path, sheet_name=sheet_name)
                # Convert back to Pick objects (simplified - would need full conversion logic)
                # For now, just overwrite
                pass
            except:
                pass
        
        # Export with new data
        self.export_tracker_to_excel(tracker, excel_path, sheet_name)
