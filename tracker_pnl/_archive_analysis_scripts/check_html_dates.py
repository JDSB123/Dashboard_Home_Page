from bs4 import BeautifulSoup
import os

html_files = [
    "telegram_text_history_data/messages.html",
    "telegram_text_history_data/messages2.html"
]

for html_file in html_files:
    if os.path.exists(html_file):
        print(f"Checking {html_file}:")
        with open(html_file, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        messages = soup.find_all('div', class_='message')
        for i in range(min(5, len(messages))):
            date_div = messages[i].find('div', class_='date')
            if date_div:
                print(f"  Message {i} Title: {date_div.get('title')}")
