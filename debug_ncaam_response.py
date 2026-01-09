import requests
import json
from datetime import datetime

# The active endpoint
BASE_URL = "https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io"

def fetch_picks(date_str):
    url = f"{BASE_URL}/api/picks/{date_str}"
    print(f"Fetching from: {url}")
    try:
        resp = requests.get(url, timeout=60)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            try:
                data = resp.json()
                print("Response JSON keys:", data.keys())
                if 'picks' in data:
                    print(f"Number of picks: {len(data['picks'])}")
                    if len(data['picks']) > 0:
                         print("First pick sample:", json.dumps(data['picks'][0], indent=2))
                else:
                    print("No 'picks' key in response.")
                    print("Full response:", json.dumps(data, indent=2))
            except json.JSONDecodeError:
                print("Response is not JSON")
                print(resp.text[:500])
        else:
            print("Response text:", resp.text[:500])
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 30)

today = datetime.now().strftime("%Y-%m-%d")
print(f"Testing for Today: {today}")
fetch_picks(today)

print("Testing for 'today' literal:")
fetch_picks("today")

def trigger_picks():
    url = f"{BASE_URL}/trigger-picks"
    print(f"Triggering generation: {url}")
    try:
        resp = requests.get(url, timeout=60)
        print(f"Trigger Status: {resp.status_code}")
        print(f"Trigger Response: {resp.text}")
    except Exception as e:
         print(f"Trigger Error: {e}")

print("-" * 30)
trigger_picks()
import time
print("Waiting 10s...")
time.sleep(10)
print("Fetching 'today' again...")
fetch_picks("today")
