import json
import os
from pathlib import Path
from grade_picks import grade_file

# Update the CFB index with fresh data
cfb_scores_path = Path('output/cfb_1226_scores.json')
cfb_index_path = Path('output/cfb_2025_index.json')

# Load existing index
cfb_index = json.loads(cfb_index_path.read_text()) if cfb_index_path.exists() else {}

# Load fresh scores
cfb_scores = json.loads(cfb_scores_path.read_text())

print("Updating CFB index with 12/26 game results...")

# Update index with new scores
for game in cfb_scores:
    game_id = str(game['GlobalGameID'])
    cfb_index[game_id] = {
        'game_id': game['GlobalGameID'],
        'date_time': game['DateTime'],
        'away_team': game['AwayTeam'],
        'home_team': game['HomeTeam'],
        'away_score': game['AwayTeamScore'],
        'home_score': game['HomeTeamScore'],
        'status': game['Status'],
        'periods': game.get('Periods', [])
    }
    print(f"  ✓ {game['AwayTeam']} @ {game['HomeTeam']}: {game['AwayTeamScore']}-{game['HomeTeamScore']}")

# Save updated index
cfb_index_path.write_text(json.dumps(cfb_index, indent=2))
print(f"\nUpdated index saved to {cfb_index_path}")

# Now re-grade the picks with fresh data
print("\n" + "="*90)
print("RE-GRADING 12/26 PICKS WITH UPDATED RESULTS...")
print("="*90 + "\n")

input_path = Path('output/normalized_1226_only.csv')
output_path = Path('output/graded_1226_complete.csv')

grade_file(input_path, output_path)

print(f"\n{'='*90}")
print("✓ Grading complete! Results saved to {output_path}")
print(f"{'='*90}\n")
