import requests
from datetime import datetime

today = datetime.now().strftime("%Y-%m-%d")
url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={today.replace('-', '')}"
try:
    resp = requests.get(url, timeout=10)
    data = resp.json()
    events = data.get('events', [])
    print(f"Found {len(events)} NCAAM games on {today}")
    if events:
        print("Sample game:", events[0]['name'])
except Exception as e:
    print(f"Error: {e}")