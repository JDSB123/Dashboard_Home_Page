import pandas as pd
from pathlib import Path

print("="*90)
print("GRADING ALL HISTORICAL PICKS")
print("="*90)

# Use the existing grade_file function from grade_picks.py
import sys
sys.path.insert(0, str(Path(__file__).parent))
from grade_picks import grade_file

input_path = Path('output/normalized_all_historical.csv')
output_path = Path('output/graded_all_historical.csv')

print(f"\nProcessing {input_path}...")
print(f"This will take a few minutes as we fetch game results from APIs...\n")

# Grade all the picks
grade_file(input_path, output_path)

print(f"\n{'='*90}")
print(f"✓ GRADING COMPLETE!")
print(f"✓ Results saved to {output_path}")
print(f"{'='*90}\n")
