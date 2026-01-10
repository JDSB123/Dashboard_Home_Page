import pandas as pd
import re

PARSED_FILE = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_picks_from_12_28.csv'
ANALYSIS_FILE = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\analysis\telegram_analysis_2025-12-28.xlsx'

def normalize(text):
    if not isinstance(text, str): return ""
    # Remove spaces, lowercase
    return re.sub(r'[^a-zA-Z0-9]', '', text).lower()

def run_comparison():
    print(f"Reading Parsed: {PARSED_FILE}")
    parsed = pd.read_csv(PARSED_FILE)
    print(f"Reading Analysis: {ANALYSIS_FILE}")
    analysis = pd.read_excel(ANALYSIS_FILE)
    
    # Create simple signatures for comparison
    # Date + Pick
    # Note: Parsed 'Date' format typically 'YYYY-MM-DD'
    
    parsed_sigs = set()
    analysis_sigs = set()
    
    # Process Parsed
    for i, row in parsed.iterrows():
        d = str(row['Date'])
        # clean pick string: "Niners ML (-205)" -> "Niners ML" maybe? 
        # Actually analysis pick column usually has stripped odds.
        # Let's try to normalize by removing odds parens if present in parsed
        raw_pick = str(row['Pick'])
        
        # Parsed might have "Team -5 (-110)"
        # Analysis might have "Team -5"
        # Try to strip odds from parsed pick
        pick_clean = re.sub(r'\s*\([+-]?\d+\)', '', raw_pick)
        
        sig = f"{d}|{normalize(pick_clean)}"
        parsed_sigs.add(sig)
        
    # Process Analysis
    for i, row in analysis.iterrows():
        try:
            d = pd.to_datetime(row['Date']).strftime('%Y-%m-%d')
            p = str(row['Pick'])
            sig = f"{d}|{normalize(p)}"
            analysis_sigs.add(sig)
        except:
            pass
        
    # Compare
    in_parsed_not_analysis = parsed_sigs - analysis_sigs
    in_analysis_not_parsed = analysis_sigs - parsed_sigs
    
    print(f"\nTotal Parsed Signatures: {len(parsed_sigs)}")
    print(f"Total Analysis Signatures: {len(analysis_sigs)}")
    
    print(f"\n--- In Parsed (Fresh) but NOT in Analysis (12-28 Excel) ---")
    print(f"Count: {len(in_parsed_not_analysis)}")
    for s in list(in_parsed_not_analysis)[:20]:
        print(s)
    if len(in_parsed_not_analysis) > 20: print("...")
        
    print(f"\n--- In Analysis (12-28 Excel) but NOT in Parsed (Fresh) ---")
    print(f"Count: {len(in_analysis_not_parsed)}")
    for s in list(in_analysis_not_parsed)[:20]:
        print(s)
    if len(in_analysis_not_parsed) > 20: print("...")

if __name__ == "__main__":
    run_comparison()
