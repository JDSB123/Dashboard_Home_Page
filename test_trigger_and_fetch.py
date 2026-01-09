import requests
import time

BASE_URL = "https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io"
test_date = "2025-12-01"

# Trigger
trigger_url = f"{BASE_URL}/trigger-picks?date={test_date}"
print(f"Triggering for {test_date}: {trigger_url}")
resp = requests.get(trigger_url, timeout=60)
print(f"Trigger Status: {resp.status_code}")
print(resp.text)

# Wait 10s
print("Waiting 10 seconds...")
time.sleep(10)

# Fetch
fetch_url = f"{BASE_URL}/api/picks/{test_date}"
print(f"Fetching: {fetch_url}")
resp = requests.get(fetch_url, timeout=60)
print(f"Fetch Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"Picks: {data.get('total_picks', 0)}")
    if data.get('picks'):
        print("Sample pick:", data['picks'][0])
else:
    print("Error fetching picks")