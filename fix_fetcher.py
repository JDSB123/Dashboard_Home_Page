# Read file
with open('client/assets/js/features/nba-picks-fetcher.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output_lines = []
skip_until_fallback = False
i = 0

while i < len(lines):
    line = lines[i]
    
    # Update header comments
    line = line.replace(
        'Azure Function App (primary) or Container App (fallback)',
        'Azure Container App directly'
    )
    line = line.replace(
        '* Primary: nba-picks-trigger Function App (/api/weekly-lineup/nba)',
        '* Endpoint: nba-gbsv-api Container App (/slate/{date}/executive)'
    )
    line = line.replace(
        '* Fallback: nba-gbsv-api Container App (/slate/{date}/executive)',
        '* Function App removed Jan 2026 - all endpoints now on Container App'
    )
    
    # Detect the start of function app try block
    if '// Try Function App first (primary source for Weekly Lineup)' in line:
        skip_until_fallback = True
        # Add the new simplified code
        output_lines.append('        // Fetch directly from Container App (Function App removed Jan 2026)\n')
        output_lines.append('        const containerUrl = `${getApiEndpoint()}/slate/${date}/executive`;\n')
        output_lines.append('        console.log(`[NBA-PICKS] Fetching from Container App: ${containerUrl}`);\n')
        i += 1
        continue
    
    # Skip lines until we hit the fallback section
    if skip_until_fallback:
        if '// Fallback to Container App' in line:
            skip_until_fallback = False
            # Skip the next 2 lines (old containerUrl and console.log)
            i += 3
            continue
        else:
            # Skip this line (part of function app try/catch)
            i += 1
            continue
    
    output_lines.append(line)
    i += 1

# Write file
with open('client/assets/js/features/nba-picks-fetcher.js', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print(f'Done! Wrote {len(output_lines)} lines')