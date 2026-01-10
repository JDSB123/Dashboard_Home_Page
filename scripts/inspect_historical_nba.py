import pandas as pd
import os
import glob

# Path to the downloaded dataset (using the path from the previous output)
# Note: In a real script we might want to dynamically find this or set a fixed cache path
# For now, I'll use the path printed in the previous step
DEFAULT_DATASET_PATH = r"C:\Users\JB\.cache\kagglehub\datasets\eoinamoore\historical-nba-data-and-player-box-scores\versions\330"

def inspect_data():
    dataset_path = DEFAULT_DATASET_PATH
    if not os.path.exists(dataset_path):
        print(f"Path not found: {dataset_path}")
        # Try to find it dynamically if version changed
        base_path = r"C:\Users\JB\.cache\kagglehub\datasets\eoinamoore\historical-nba-data-and-player-box-scores\versions"
        versions = glob.glob(os.path.join(base_path, "*"))
        if versions:
            dataset_path = versions[-1] # Take last
            print(f"Using found path: {dataset_path}")
        else:
            return

    print("\nInspecting 'Games_Schedule_25_26' or similar...")
    # Analyzing file names from previous output:
    # LeagueSchedule24_25.csv, LeagueSchedule25_26.csv, Games.csv
    
    files = {
        'Games': 'Games.csv',
        'Schedule25': 'LeagueSchedule24_25.csv',
        'Schedule26': 'LeagueSchedule25_26.csv'
    }
    
    for name, filename in files.items():
        path = os.path.join(dataset_path, filename)
        if os.path.exists(path):
            print(f"\n--- {name} ({filename}) ---")
            try:
                df = pd.read_csv(path)
                print(f"Rows: {len(df)}")
                # Check for date column
                date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
                if date_cols:
                    # Sort by date
                    # Handle multiple formats if needed, usually pandas is smart
                    df[date_cols[0]] = pd.to_datetime(df[date_cols[0]])
                    df = df.sort_values(by=date_cols[0], ascending=False)
                    print(f"Date Range: {df[date_cols[0]].min()} to {df[date_cols[0]].max()}")
                    print("Recent Entries:")
                    print(df[[date_cols[0]] + [c for c in df.columns if c != date_cols[0]][:4]].head().to_string())
                else:
                    print(df.head().to_string())
            except Exception as e:
                print(f"Error reading {filename}: {e}")

if __name__ == "__main__":
    inspect_data()
