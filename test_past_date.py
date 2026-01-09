import requests

BASE_URL = "https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io"
test_date = "2025-12-01"  # Known date with games

url = f"{BASE_URL}/api/picks/{test_date}"
print(f"Fetching picks for {test_date}: {url}")
try:
    resp = requests.get(url, timeout=60)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Picks found: {data.get('total_picks', 0)}")
        if data.get('picks'):
            print("Sample pick:", data['picks'][0])
except Exception as e:
    print(f"Error: {e}")