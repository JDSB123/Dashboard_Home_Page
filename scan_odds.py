import pathlib
f = pathlib.Path(r'c:\Users\JDSB\dev\green_bier_sport_ventures\Dashboard_Home_Page\client\odds-market.html')
lines = f.read_text(encoding='utf-8').splitlines()
print(f'Total lines: {len(lines)}')
markers = ['sportsbooks-trigger','Odds Comparison Board','</main','</nav>',
           '</ul>','data-tile-id','dashboard-topline','main-dashboard-layout',
           'brand-header','<main']
for i, line in enumerate(lines):
    if any(m in line for m in markers):
        print(f'  L{i+1}: {line.rstrip()[:100]}')
