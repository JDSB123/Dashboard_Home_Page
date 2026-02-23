import logging

import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)

# Missing picks from Dec 28 through Jan 6 extracted from telegram
# Format: Date, League, Matchup, Segment, Pick (Odds), Risk
picks_data = []

# Dec 28 picks
picks_data.extend([
    ("2025-12-28", "NCAAF", "CFP - Arizona vs Opponent", "FG", "Over 53 (-111)", 55000),
    ("2025-12-28", "NFL", "Panthers vs Opponent", "FG", "Panthers +7 (-112)", 50000),
    ("2025-12-28", "NBA", "Raptors vs Opponent", "FG", "Raptors +4.5 (-110)", 50000),
    ("2025-12-28", "NFL", "Steelers vs Chiefs", "FG", "Steelers -3 (-111)", 55000),
    ("2025-12-28", "NCAAM", "Old Dominion vs Opponent", "FG", "ODU +14.5 (-110)", 25000),
    ("2025-12-28", "NFL", "Bills vs Opponent", "FG", "Over 45 (-111)", 55000),
    ("2025-12-28", "NFL", "49ers vs Bears", "1H", "49ers -3 (-112)", 50000),
    ("2025-12-28", "NFL", "49ers vs Bears", "1H", "Under 25.5 (-107)", 50000),
    ("2025-12-28", "NFL", "49ers vs Bears", "FG", "49ers ML (-205)", 50000),
    ("2025-12-28", "NFL", "49ers vs Bears", "FG", "49ers -3 (-135)", 67500),
    ("2025-12-28", "NFL", "49ers vs Bears", "FG", "Under 52 (-119)", 59500),
    ("2025-12-28", "NBA", "Kings vs Opponent", "1Q", "Kings ML (+220)", 10000),
    ("2025-12-28", "NFL", "49ers vs Bears", "2H", "49ers ML (+100)", 50000),
    ("2025-12-28", "NFL", "49ers vs Bears", "2H", "49ers +0.5 (-125)", 62500),
    ("2025-12-28", "NFL", "49ers vs Bears", "2H", "49ers TTO o14 (-120)", 20000),
    ("2025-12-28", "NFL", "49ers vs Bears", "2H", "Bears TTO u13.5 (+105)", 20000),
    ("2025-12-28", "NFL", "49ers vs Bears", "2H", "Under 27 (-107)", 50000),
])

# Dec 29 picks
picks_data.extend([
    ("2025-12-29", "NCAAM", "Towson vs Opponent", "FG", "Towson +2.5 (-115)", 57500),
    ("2025-12-29", "NCAAM", "Towson vs Opponent", "2H", "Towson -2 (-110)", 25000),
    ("2025-12-29", "NCAAM", "Towson vs Opponent", "2H", "Under 81 (-110)", 25000),
    ("2025-12-29", "NBA", "Hornets vs Opponent", "FG", "Hornets +3 (-110)", 50000),
    ("2025-12-29", "NBA", "Hornets vs Opponent", "FG", "Hornets ML (+123)", 50000),
    ("2025-12-29", "NBA", "Hornets vs Opponent", "1H", "Under 117 (-115)", 25000),
    ("2025-12-29", "NBA", "Wizards vs Opponent", "FG", "Wizards +10.5 (-115)", 50000),
    ("2025-12-29", "NBA", "Wizards vs Opponent", "FG", "Under 233 (-118)", 50000),
    ("2025-12-29", "NBA", "Wizards vs Opponent", "1H", "Wizards +6.5 (-121)", 25000),
    ("2025-12-29", "NCAAF", "UF vs Opponent", "FG", "UF -14 (-111)", 25000),
    ("2025-12-29", "NBA", "Nets vs Opponent", "FG", "Nets +6.5 (-118)", 50000),
    ("2025-12-29", "NBA", "Nets vs Opponent", "1H", "Nets +3 (-111)", 25000),
    ("2025-12-29", "NBA", "Nets vs Opponent", "1H", "Over 109.5 (-112)", 25000),
    ("2025-12-29", "NBA", "Nuggets vs Opponent", "FG", "Under 244 (-118)", 50000),
    ("2025-12-29", "NBA", "Nuggets vs Opponent", "1H", "Under 119 (-105)", 25000),
    ("2025-12-29", "NBA", "Raptors vs Opponent", "FG", "Raptors +1.5 (-110)", 50000),
    ("2025-12-29", "NBA", "Raptors vs Opponent", "FG", "Over 220.5 (-111)", 50000),
    ("2025-12-29", "NBA", "Raptors vs Opponent", "FG", "Raptors ML (+102)", 50000),
    ("2025-12-29", "NBA", "Hawks vs Opponent", "FG", "Hawks +17 (-111)", 50000),
    ("2025-12-29", "NBA", "Hawks vs Opponent", "1H", "Hawks +10 (-105)", 25000),
    ("2025-12-29", "NBA", "Hawks vs Opponent", "1H", "Over 120 (-110)", 25000),
    ("2025-12-29", "NBA", "Bulls vs Opponent", "FG", "Bulls +6.5 (-118)", 50000),
    ("2025-12-29", "NBA", "Bulls vs Opponent", "FG", "Under 243.5 (-115)", 50000),
    ("2025-12-29", "NBA", "Bulls vs Opponent", "1H", "Bulls +3 (-111)", 25000),
    ("2025-12-29", "NBA", "Spurs vs Opponent", "FG", "Spurs -3 (-108)", 50000),
    ("2025-12-29", "NBA", "Spurs vs Opponent", "FG", "Spurs ML (-148)", 50000),
    ("2025-12-29", "NBA", "Spurs vs Opponent", "1H", "Spurs -1.5 (-112)", 25000),
    ("2025-12-29", "NBA", "Pelicans vs Opponent", "FG", "Pelicans +8 (-110)", 50000),
    ("2025-12-29", "NBA", "Pelicans vs Opponent", "FG", "Under 247 (-118)", 50000),
    ("2025-12-29", "NBA", "Pelicans vs Opponent", "1H", "Pelicans +4.5 (-110)", 25000),
    ("2025-12-29", "NBA", "Pelicans vs Opponent", "1H", "Under 127 (-119)", 25000),
    ("2025-12-29", "NCAAM", "Detroit vs Opponent", "FG", "Over 76 (-111)", 25000),
    ("2025-12-29", "NCAAM", "Youngstown St vs Opponent", "FG", "YSU -8.5 (-117)", 25000),
    ("2025-12-29", "NFL", "Falcons vs Commanders", "FG", "Falcons +7.5 (-130)", 65000),
    ("2025-12-29", "NFL", "Falcons vs Commanders", "FG", "Under 49 (-111)", 55000),
    ("2025-12-29", "NFL", "Falcons vs Commanders", "1H", "Falcons +4 (-122)", 61000),
    ("2025-12-29", "NFL", "Falcons vs Commanders", "1H", "Under 24.5 (-129)", 64500),
    ("2025-12-29", "NBA", "Bulls vs Opponent", "2H", "Bulls +2.5 (-115)", 25000),
])

# Dec 30 picks
picks_data.extend([
    ("2025-12-30", "NCAAF", "Tennessee vs Ohio State", "FG", "Under 62 (-112)", 56000),
    ("2025-12-30", "NCAAF", "TCU vs Opponent", "FG", "TCU +4.5 (-118)", 59000),
    ("2025-12-30", "NBA", "Jazz vs Opponent", "2H", "Jazz +8.5 (-110)", 55000),
    ("2025-12-30", "NBA", "Jazz vs Opponent", "2H", "Jazz ML (+300)", 50000),
    ("2025-12-30", "NBA", "Jazz vs Opponent", "2H", "Over 54.5 (-135)", 67500),
    ("2025-12-30", "NBA", "Pistons vs Lakers", "FG", "Under 233 (-110)", 55000),
    ("2025-12-30", "NBA", "Pistons vs Lakers", "1H", "Pistons ML (-120)", 60000),
    ("2025-12-30", "NBA", "Kings vs Clippers", "FG", "Over 218.5 (-110)", 55000),
    ("2025-12-30", "NCAAM", "Oregon State vs Opponent", "2H", "Oregon St +2 (-113)", 56500),
    ("2025-12-30", "NCAAM", "Loyola Marymount vs Opponent", "2H", "LMU -4 (-104)", 52000),
])

# Dec 31 picks
picks_data.extend([
    ("2025-12-31", "NCAAM", "Vanderbilt vs Opponent", "FG", "Under 47 (-111)", 55500),
    ("2025-12-31", "NCAAM", "Vanderbilt vs Opponent", "FG", "Vandy -3 (-115)", 57500),
    ("2025-12-31", "NCAAM", "Vanderbilt vs Opponent", "1H", "Vandy -2 (-115)", 57500),
    ("2025-12-31", "NBA", "Hornets vs Warriors", "FG", "Under 234 (-111)", 55500),
    ("2025-12-31", "NBA", "Hornets vs Warriors", "1H", "Hornets +4 (-115)", 28750),
    ("2025-12-31", "NBA", "Hornets vs Warriors", "1H", "Hornets ML (+170)", 25000),
    ("2025-12-31", "NBA", "Suns vs Opponent", "1H", "Suns +3.5 (-117)", 29250),
    ("2025-12-31", "NBA", "Suns vs Opponent", "1H", "Under 120 (-111)", 27750),
    ("2025-12-31", "NBA", "Suns vs Opponent", "FG", "Under 232.5 (-111)", 55500),
    ("2025-12-31", "NCAAM", "Miami vs Opponent", "FG", "Under 40.5 (-110)", 55000),
    ("2025-12-31", "NCAAM", "Miami vs Opponent", "1H", "Under 20 (-105)", 52500),
    ("2025-12-31", "NCAAM", "Denver vs UMKC", "FG", "Under 157 (-117)", 58500),
    ("2025-12-31", "NCAAM", "George Washington vs Opponent", "FG", "GW -2.5 (-108)", 54000),
    ("2025-12-31", "NCAAM", "Marshall vs Opponent", "FG", "Marshall -13 (-115)", 57500),
    ("2025-12-31", "NCAAM", "Xavier vs Opponent", "FG", "Xavier +12 (-118)", 59000),
    ("2025-12-31", "NCAAM", "DePaul vs Opponent", "FG", "Over 139 (-110)", 55000),
    ("2025-12-31", "NBA", "Suns vs Opponent", "2H", "Suns ML (-115)", 28750),
    ("2025-12-31", "NBA", "Suns vs Opponent", "2H", "Over 113.5 (-111)", 27750),
    ("2025-12-31", "NCAAF", "Texas vs Opponent", "2H", "Texas -3 (-111)", 55500),
    ("2025-12-31", "NCAAF", "Texas vs Opponent", "2H", "Texas ML (-165)", 82500),
    ("2025-12-31", "NCAAF", "Texas vs Opponent", "2H", "Over 27 (-103)", 51500),
    ("2025-12-31", "NCAAF", "Utah vs Opponent", "2H", "Utah -7 (-120)", 60000),
    ("2025-12-31", "NCAAF", "Utah vs Opponent", "2H", "Over 27 (-111)", 55500),
    ("2025-12-31", "NBA", "Spurs vs Opponent", "FG", "Spurs -3 (-130)", 65000),
    ("2025-12-31", "NBA", "Spurs vs Opponent", "1H", "Spurs -1.5 (-111)", 27750),
    ("2025-12-31", "NBA", "Blazers vs Opponent", "1H", "Over 119 (-112)", 28000),
    ("2025-12-31", "NBA", "Pelicans vs Opponent", "1H", "Under 127.5 (-112)", 28000),
    ("2025-12-31", "NBA", "Blazers vs Opponent", "1H", "Portland +9.5 (-110)", 27500),
    ("2025-12-31", "NBA", "Nuggets vs Opponent", "1H", "Nuggets +3.5 (-107)", 26750),
    ("2025-12-31", "NBA", "Nuggets vs Opponent", "1H", "Nuggets ML (+169)", 25000),
    ("2025-12-31", "NBA", "Nuggets vs Opponent", "FG", "Nuggets +6.5 (-100)", 50000),
    ("2025-12-31", "NBA", "Wizards vs Bucks", "FG", "Under 235 (-111)", 55500),
    ("2025-12-31", "NBA", "Heat vs Opponent", "FG", "Heat +8 (-121)", 60500),
    ("2025-12-31", "NBA", "Heat vs Opponent", "1H", "Heat +4.5 (-120)", 60000),
])

# Jan 1 picks
picks_data.extend([
    ("2026-01-01", "NCAAF", "Oregon vs Ohio State", "1H", "Over 24 (-115)", 57500),
    ("2026-01-01", "NCAAF", "Oregon vs Ohio State", "FG", "Over 51 (-110)", 55000),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "1H", "Tech -1.5 (-110)", 55000),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "FG", "Tech -0.5 (+105)", 50000),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "FG", "Tech ML (-125)", 62500),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "2H", "TT ML", 50000),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "2H", "TT -2.5", 50000),
    ("2026-01-01", "NCAAF", "Texas Tech vs Arkansas", "2H", "Over 22", 50000),
    ("2026-01-01", "NCAAF", "Utah vs Opponent", "FG", "Utah +2.5", 50000),
    ("2026-01-01", "NCAAF", "Georgia vs Ole Miss", "1H", "Over 26.5 (-110)", 55000),
    ("2026-01-01", "NCAAF", "Georgia vs Ole Miss", "FG", "Over 53.5 (-110)", 55000),
    ("2026-01-01", "NCAAF", "Alabama vs Michigan", "1H", "Bama ML (+195)", 50000),
    ("2026-01-01", "NCAAF", "Alabama vs Michigan", "1H", "Bama +4", 50000),
    ("2026-01-01", "NCAAF", "Alabama vs Michigan", "FG", "Bama +7.5", 50000),
    ("2026-01-01", "NCAAM", "Cal Poly SLO vs Opponent", "FG", "Cal Poly +8.5", 50000),
    ("2026-01-01", "NCAAM", "UNCG vs Opponent", "FG", "UNCG +2", 50000),
    ("2026-01-01", "NCAAM", "Lindenwood vs Opponent", "FG", "Lindenwood -7.5", 50000),
    ("2026-01-01", "NCAAM", "Montana vs Opponent", "FG", "Montana -5", 50000),
    ("2026-01-01", "NBA", "Nets vs Raptors", "FG", "Nets +12 (-110)", 50000),
    ("2026-01-01", "NBA", "Nets vs Raptors", "FG", "Over 216.5 (-110)", 50000),
    ("2026-01-01", "NBA", "Nets vs Raptors", "1H", "Nets +7 (-110)", 25000),
    ("2026-01-01", "NBA", "Nets vs Raptors", "1H", "Over 105.5 (-110)", 25000),
    ("2026-01-01", "NBA", "Heat vs Pistons", "FG", "Under 236.5 (-110)", 50000),
    ("2026-01-01", "NBA", "76ers vs Mavs", "1H", "Over 118.5 (-110)", 25000),
    ("2026-01-01", "NBA", "Celtics vs Kings", "1H", "Under 117.5 (-110)", 25000),
    ("2026-01-01", "NBA", "Celtics vs Kings", "FG", "Under 229 (-110)", 50000),
    ("2026-01-01", "NBA", "Jazz vs Clippers", "1H", "Over 112.5 (-110)", 25000),
    ("2026-01-01", "NCAAF", "Alabama vs Michigan", "2H", "Bama +3", 50000),
    ("2026-01-01", "NCAAF", "Alabama vs Michigan", "2H", "Over 22.5", 50000),
    ("2026-01-01", "NCAAF", "Georgia vs Ole Miss", "2H", "UGA -2 (-105)", 52500),
    ("2026-01-01", "NCAAF", "Georgia vs Ole Miss", "2H", "UGA ML (-130)", 65000),
    ("2026-01-01", "NCAAF", "Georgia vs Ole Miss", "2H", "Over 27 (-104)", 52000),
])

# Jan 2 picks
picks_data.extend([
    ("2026-01-02", "NCAAF", "Navy vs Cincinnati", "FG", "Navy -7.5 (-106)", 53000),
    ("2026-01-02", "NCAAF", "Navy vs Cincinnati", "FG", "Over 58 (-111)", 55500),
    ("2026-01-02", "NCAAF", "Navy vs Cincinnati", "1H", "Over 28.5 (-115)", 57500),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "FG", "Warriors +13.5 (-110)", 55000),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "FG", "Over 226 (-111)", 55500),
    ("2026-01-02", "NBA", "Lakers vs Opponent", "FG", "Under 240.5 (-111)", 55500),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "1H", "Over 110.5 (-112)", 28000),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "1H", "Warriors +7.5 (-110)", 27500),
    ("2026-01-02", "NCAAM", "SMU vs Arizona", "2H", "SMU o24.5 (-115)", 57500),
    ("2026-01-02", "NCAAM", "SMU vs Arizona", "2H", "Arizona TTO o13.5 (-105)", 21000),
    ("2026-01-02", "NCAAM", "SMU vs Arizona", "2H", "SMU TTO o13.5 (-140)", 28000),
    ("2026-01-02", "NCAAM", "Miss State vs Opponent", "2H", "Miss St ML (-155)", 77500),
    ("2026-01-02", "NCAAM", "Miss State vs Opponent", "2H", "Miss St -2.5 (-115)", 57500),
    ("2026-01-02", "NCAAM", "Miss State vs Opponent", "2H", "Over 24.5 (-115)", 57500),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "2H", "Over 116 (-111)", 27750),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "2H", "Warriors +4 (-110)", 27500),
    ("2026-01-02", "NBA", "Warriors vs Opponent", "2H", "Warriors ML (+170)", 25000),
])

# Jan 3 picks
picks_data.extend([
    ("2026-01-03", "NFL", "Bucs vs Saints", "1H", "Under 21 (-125)", 62500),
    ("2026-01-03", "NFL", "Bucs vs Saints", "1H", "Bucs ML (-169)", 84500),
    ("2026-01-03", "NFL", "Bucs vs Saints", "FG", "Bucs ML (-160)", 80000),
    ("2026-01-03", "NFL", "Bucs vs Saints", "FG", "Bucs -3 (-110)", 55000),
    ("2026-01-03", "NFL", "Bucs vs Saints", "1H", "Bucs -2.5 (-120)", 60000),
    ("2026-01-03", "NBA", "Heat vs Timberwolves", "FG", "Heat +2.5 (-110)", 55000),
    ("2026-01-03", "NBA", "Heat vs Timberwolves", "1H", "Heat +1.5 (-111)", 27750),
    ("2026-01-03", "NBA", "Heat vs Timberwolves", "1H", "Heat ML (+110)", 25000),
    ("2026-01-03", "NBA", "Hawks vs Raptors", "1H", "Hawks +2.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Hawks vs Raptors", "1H", "Under 118.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Knicks vs 76ers", "FG", "Knicks -2.5 (-110)", 55000),
    ("2026-01-03", "NBA", "Knicks vs 76ers", "FG", "Under 233.5 (-110)", 55000),
    ("2026-01-03", "NBA", "Knicks vs 76ers", "1H", "Over 120.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Hornets vs Bulls", "1H", "Hornets +0.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Hornets vs Bulls", "FG", "Under 240 (-110)", 55000),
    ("2026-01-03", "NBA", "Blazers vs Spurs", "FG", "Under 235.25 (-110)", 55000),
    ("2026-01-03", "NBA", "Blazers vs Spurs", "1H", "Blazers +4.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Blazers vs Spurs", "1H", "Over 121 (-110)", 27500),
    ("2026-01-03", "NBA", "Mavs vs Rockets", "FG", "Mavs +8 (-110)", 55000),
    ("2026-01-03", "NBA", "Mavs vs Rockets", "1H", "Rockets -4.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Mavs vs Rockets", "1H", "Over 110.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Jazz vs Warriors", "FG", "Jazz +10.5 (-110)", 55000),
    ("2026-01-03", "NBA", "Jazz vs Warriors", "FG", "Under 244.5 (-110)", 55000),
    ("2026-01-03", "NBA", "Jazz vs Warriors", "1H", "Jazz +6.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Jazz vs Warriors", "1H", "Over 118.75 (-110)", 27500),
    ("2026-01-03", "NBA", "Clippers vs Celtics", "1H", "Clippers -0.5 (-110)", 27500),
    ("2026-01-03", "NBA", "Clippers vs Celtics", "1H", "Over 113.75 (-110)", 27500),
])

# Jan 4 picks
picks_data.extend([
    ("2026-01-04", "NFL", "Cowboys vs Giants", "FG", "Under 50.5 (-117)", 58500),
    ("2026-01-04", "NFL", "Cardinals vs Rams", "FG", "Over 48 (-110)", 55000),
    ("2026-01-04", "NFL", "Titans vs Jaguars", "FG", "Over 46 (-110)", 55000),
    ("2026-01-04", "NFL", "Colts vs Texans", "FG", "Under 37.5 (-105)", 52500),
    ("2026-01-04", "NFL", "Packers vs Opponent", "FG", "Packers +13 (-110)", 55000),
    ("2026-01-04", "NFL", "Raiders vs Opponent", "FG", "Raiders +4 (-110)", 55000),
    ("2026-01-04", "NFL", "Jaguars vs Titans", "FG", "Jaguars -13 (-108)", 54000),
    ("2026-01-04", "NFL", "Giants vs Cowboys", "FG", "Giants +3 (-100)", 50000),
    ("2026-01-04", "NFL", "Saints vs Opponent", "FG", "Saints +4 (-115)", 57500),
    ("2026-01-04", "NFL", "Cardinals vs Rams", "FG", "Cardinals +14 (-107)", 53500),
    ("2026-01-04", "NFL", "Jets vs Opponent", "FG", "Jets +12.5 (-110)", 55000),
    ("2026-01-04", "NFL", "Bengals vs Opponent", "FG", "Bengals -10 (-102)", 51000),
    ("2026-01-04", "NBA", "Pistons vs Opponent", "FG", "Under 237 (-111)", 55500),
    ("2026-01-04", "NBA", "Pistons vs Opponent", "1H", "Under 121.5 (-110)", 27500),
    ("2026-01-04", "NFL", "Lions vs Opponent", "FG", "Lions ML (+155)", 50000),
    ("2026-01-04", "NFL", "Commanders vs Opponent", "FG", "Commanders +3 (-102)", 51000),
    ("2026-01-04", "NFL", "Lions vs Opponent", "FG", "Lions +3.5 (-122)", 61000),
    ("2026-01-04", "NBA", "Wizards vs Opponent", "2H", "Wizards +1.5 (-110)", 27500),
    ("2026-01-04", "NBA", "Wizards vs Opponent", "2H", "Under 121.5 (-110)", 27500),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "FG", "Steelers +4.5 (-112)", 56000),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "FG", "Under 42 (-115)", 57500),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "1H", "Under 21 (-118)", 59000),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "FG", "Steelers ML (+200)", 50000),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "1H", "Steelers +3 (-107)", 53500),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "2H", "Steelers ML", 50000),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "2H", "Steelers TTO", 50000),
    ("2026-01-04", "NFL", "Steelers vs Ravens", "2H", "Over 20", 50000),
])

# Jan 5 picks
picks_data.extend([
    ("2026-01-05", "NBA", "Knicks vs Pistons", "FG", "Under 233 (-110)", 55000),
    ("2026-01-05", "NBA", "Knicks vs Pistons", "1H", "Over 119 (-110)", 27500),
    ("2026-01-05", "NBA", "Knicks vs Pistons", "1H", "Pistons spread", 25000),
])

# Jan 6 picks
picks_data.extend([
    ("2026-01-06", "NBA", "Magic vs Wizards", "1H", "Wizards +3.5 (-110)", 27500),
    ("2026-01-06", "NBA", "Cavaliers vs Pacers", "1H", "Pacers +3.5 (-111)", 27750),
    ("2026-01-06", "NBA", "Cavaliers vs Pacers", "FG", "Pacers +6.5 (-110)", 55000),
    ("2026-01-06", "NBA", "Magic vs Wizards", "FG", "Wizards +7.5 (-113)", 56500),
    ("2026-01-06", "NBA", "Cavaliers vs Pacers", "FG", "Under 236.5 (-111)", 55500),
    ("2026-01-06", "NBA", "Cavaliers vs Pacers", "1H", "Over 115.5 (-110)", 27500),
    ("2026-01-06", "NBA", "Mavs vs Kings", "FG", "Mavs -5 (-110)", 55000),
    ("2026-01-06", "NBA", "Mavs vs Kings", "FG", "Under 232.5 (-106)", 53000),
    ("2026-01-06", "NBA", "Mavs vs Kings", "1H", "Mavs ML (-163)", 40750),
    ("2026-01-06", "NBA", "Mavs vs Kings", "1H", "Under 120 (-118)", 29500),
    ("2026-01-06", "NBA", "Spurs vs Grizzlies", "2H", "Grizzlies +1", 25000),
    ("2026-01-06", "NBA", "Heat vs Timberwolves", "2H", "Under 115.5", 25000),
    ("2026-01-06", "NBA", "Lakers vs Pelicans", "2H", "Under 118.5", 25000),
])

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')

logger.info(f"Total picks for Dec 28 - Jan 6: {len(picks_data)}")
logger.info(f"Dec 28: {len([p for p in picks_data if p[0] == '2025-12-28'])}")
logger.info(f"Dec 29: {len([p for p in picks_data if p[0] == '2025-12-29'])}")
logger.info(f"Dec 30: {len([p for p in picks_data if p[0] == '2025-12-30'])}")
logger.info(f"Dec 31: {len([p for p in picks_data if p[0] == '2025-12-31'])}")
logger.info(f"Jan 1: {len([p for p in picks_data if p[0] == '2026-01-01'])}")
logger.info(f"Jan 2: {len([p for p in picks_data if p[0] == '2026-01-02'])}")
logger.info(f"Jan 3: {len([p for p in picks_data if p[0] == '2026-01-03'])}")
logger.info(f"Jan 4: {len([p for p in picks_data if p[0] == '2026-01-04'])}")
logger.info(f"Jan 5: {len([p for p in picks_data if p[0] == '2026-01-05'])}")
logger.info(f"Jan 6: {len([p for p in picks_data if p[0] == '2026-01-06'])}")

# Create DataFrame
df = pd.DataFrame(picks_data, columns=['Date', 'League', 'Matchup', 'Segment', 'Pick (Odds)', 'Risk'])
df['To Win'] = ''
df['Hit/Miss'] = ''
df['PnL'] = ''

# Save to CSV for review
output_path = r'C:\Users\JB\green-bier-ventures\DASHBOARD_main\picks_dec28_jan6_draft.csv'
df.to_csv(output_path, index=False)
logger.info(f"Saved draft tracker to {output_path}")
