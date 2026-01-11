import requests
import json
import os

API_KEY = os.environ.get('SDIO_KEY')
if not API_KEY:
    raise EnvironmentError("SDIO_KEY environment variable not set. Run: . .\scripts\load-secrets.ps1 -FromKeyVault")
DATE = '2025-12-28'

def fetch_nfl():
    url = f'https://api.sportsdata.io/v3/nfl/scores/json/ScoresByDate/{DATE}'
    print(f"Fetching NFL from {url}...")
    try:
        resp = requests.get(f"{url}?key={API_KEY}")
        if resp.status_code == 200:
            data = resp.json()
            path = f'output/box_scores/NFL_{DATE}_full.json'
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"Saved {len(data)} NFL games to {path}")
            return data
        else:
            print(f"NFL Fetch Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"NFL Exception: {e}")

def fetch_ncaam():
    # Try ScoresByDate first, usually GamesByDate has basic info, maybe insufficient for quarters
    # But CBB might be GamesByDate. Let's try GamesByDate first as it's common for CBB.
    url = f'https://api.sportsdata.io/v3/cbb/scores/json/GamesByDate/{DATE}'
    print(f"Fetching NCAAM from {url}...")
    try:
        resp = requests.get(f"{url}?key={API_KEY}")
        if resp.status_code == 200:
            data = resp.json()
            path = f'output/box_scores/NCAAM_{DATE}_full.json'
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"Saved {len(data)} NCAAM games to {path}")
            return data
        else:
            print(f"NCAAM Fetch Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"NCAAM Exception: {e}")

if __name__ == "__main__":
    if not os.path.exists('output/box_scores'):
        os.makedirs('output/box_scores')
    
    fetch_nfl()
    fetch_ncaam()
