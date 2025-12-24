# Green Bier Sport Ventures — Dashboard (Static Front-End)

This repo is a **static HTML/CSS/JS dashboard** hosted on **Azure Static Web Apps**.

## Entry pages

- `index.html` → redirects to `weekly-lineup.html`
- `weekly-lineup.html` → Weekly Lineup page
- `dashboard.html` → Dashboard / Active Picks page (uses API)
- `odds-market.html` → Odds Market page

## Runtime configuration

Production runtime config is injected via:

- `config.production.js` (sets `window.APP_CONFIG`)

Key setting:

- `window.APP_CONFIG.API_BASE_URL` (e.g. `https://green-bier-picks-api.azurewebsites.net/api`)

## Azure Static Web Apps

`staticwebapp.config.json` controls:
- routes/rewrites
- navigation fallback
- global security headers / CSP

Deploy the repository root as the app artifact (there is **no build step** required in this repo).

## Local dev

Any static server works. Examples:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`.

## Production notes

- **Don’t ship third-party API keys to the browser** via `window.APP_CONFIG`. If a key is required, proxy through a server/API layer (Azure Functions/App Service/Container App).
- Ensure your API (configured in `API_BASE_URL`) has **CORS** enabled for your production domain.


