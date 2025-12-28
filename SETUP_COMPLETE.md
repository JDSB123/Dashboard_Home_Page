# 📋 What You Have Now (Complete Setup)

## Files Created

✅ **QUICK_START.md** — Start here! Simple 3-step checklist  
✅ **SETUP_MODEL_REGISTRY.md** — Detailed guide with troubleshooting  
✅ **setup-model-registry.ps1** — Automated setup script (run once)  
✅ **MODEL_NOTIFY_TEMPLATE.yml** — Template for your model repos  

## Code Changes Made

✅ **azure-functions/ModelOrchestrator/index.js**  
   - Now reads endpoints from `modelregistry` table first
   - Falls back to env vars if table missing
   - Means: When you update the registry, jobs automatically use new endpoints

✅ **assets/js/features/model-endpoints-bootstrap.js** (NEW)  
   - Dashboard fetches fresh endpoints on page load
   - Means: Users always get the latest model URLs

✅ **weekly-lineup.html**  
   - Added bootstrap script to load endpoints before anything else
   - Means: Endpoints are hydrated before any league fetchers run

✅ **.github/workflows/model-update-notify.yml**  
   - Now auto-fetches Container App FQDN
   - Sends it to the registry on every model repo push
   - Means: No manual registry updates ever needed

---

## Next: Run the Setup (5 minutes)

### Step 1: Open PowerShell

```powershell
cd C:\Users\JB\green-bier-ventures\DASHBOARD_main
```

### Step 2: Run the script

```powershell
.\setup-model-registry.ps1
```

**You'll see prompts:**
- "Sign in to your Azure account?" → Say **yes** and authenticate
- Script auto-creates the table and seeds the endpoints

### Step 3: Commit & Push

```powershell
git add -A
git commit -m "feat: add model registry for perpetual endpoint sync"
git push origin main
```

---

## Then: Update Each Model Repo (One-Time)

For each of your 4 model repos (nba-gbsv-model, ncaam-gbsv-model, nfl-gbsv-model, ncaaf-gbsv-model):

1. Go to repo → **Settings → Secrets and variables → Actions**
2. Add 3 secrets (get values from your team or Azure Portal):
   - `ORCHESTRATOR_URL` = `https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api`
   - `ORCHESTRATOR_KEY` = *(your orchestrator function key)*
   - `AZURE_SUBSCRIPTION_ID` = *(your Azure subscription ID)*

3. Create file: `.github/workflows/notify-dashboard-on-deploy.yml`
4. Copy from [MODEL_NOTIFY_TEMPLATE.yml](MODEL_NOTIFY_TEMPLATE.yml)
5. Edit the 3 lines at the top (MODEL_TYPE, RG_NAME, APP_NAME) for that model
6. Commit & push

---

## 🎉 That's It!

From now on, whenever you:

```
Push to nba-gbsv-model repo
    ↓ GitHub Action runs
    ↓ Gets Container App's new URL
    ↓ Sends to dashboard registry
    ↓ Next user to visit dashboard → gets new URL
```

**Zero manual steps. Zero downtime. Zero re-deployments.**

---

## Questions?

- **Confused about a step?** → See [SETUP_MODEL_REGISTRY.md](SETUP_MODEL_REGISTRY.md)
- **Script didn't work?** → Check troubleshooting in [SETUP_MODEL_REGISTRY.md](SETUP_MODEL_REGISTRY.md)
- **Need to reset?** → Run setup-model-registry.ps1 again (it's idempotent)

---

## Architecture Diagram

```
Your Model Repos (NBA/NCAAM/NFL/NCAAF)
    ↓
GitHub Actions (notify-dashboard-on-deploy.yml)
    ↓ Gets new Container App FQDN
    ↓ Calls POST /registry/update
    ↓
Azure Functions Orchestrator
    ↓ Writes to modelregistry table
    ↓
Azure Table Storage (modelregistry)
    ├─ nba: https://...
    ├─ ncaam: https://...
    ├─ nfl: https://...
    └─ ncaaf: https://...
    ↓
Weekly Lineup Dashboard
    ↓ On page load, bootstrap fetches /registry
    ↓ Hydrates APP_CONFIG with latest URLs
    ↓ Pick fetchers use updated endpoints
    ↓
User sees live picks from latest models ✅
```

---

**Ready? Start with: `.\setup-model-registry.ps1`**
