# 🚀 Quick Start: Model Registry Setup

Follow these steps **in order**. Takes ~5 minutes.

---

## ✅ Step 1: Run the Setup Script

Open **PowerShell** in this folder and run:

```powershell
.\setup-model-registry.ps1
```

**What you'll see:**

```
🚀 Model Registry Setup
[1/5] Checking Azure CLI...
✅ Azure CLI found
[2/5] Checking Azure login...
✅ Logged in as: your.email@example.com
[3/5] Finding storage account...
✅ Using storage account: gbsvmodel12345
[4/5] Creating/verifying modelregistry table...
✅ Table created
[5/5] Seeding endpoints...
  ✅ nba: https://nba-gbsv-api...
  ✅ ncaam: https://ncaam-stable-prediction...
  ✅ nfl: https://nfl-api...
  ✅ ncaaf: https://ncaaf-v5-prod...

✅ Model Registry Setup Complete!
```

**If it fails:** Check [SETUP_MODEL_REGISTRY.md](SETUP_MODEL_REGISTRY.md) troubleshooting section.

---

## ✅ Step 2: Commit & Push

This repo's code is already updated. Push it:

```powershell
git add -A
git commit -m "feat: add model registry for perpetual endpoint sync"
git push origin main
```

---

## ✅ Step 3: Update Your Model Repos (One-Time Per Model)

Each model repo (nba-gbsv-model, ncaam-gbsv-model, etc.) needs a notification workflow.

**For EACH model repo**, do this once:

### A. Add GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these 3:
| Name | Value |
|------|-------|
| `ORCHESTRATOR_URL` | `https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api` |
| `ORCHESTRATOR_KEY` | _(ask your team or check Azure Portal)_ |
| `AZURE_SUBSCRIPTION_ID` | _(Your Azure subscription ID)_ |

### B. Add Workflow File

Create file: `.github/workflows/notify-dashboard-on-deploy.yml`

**Copy & paste** the content from [docs/templates/MODEL_NOTIFY_TEMPLATE.yml](templates/MODEL_NOTIFY_TEMPLATE.yml)

Then **edit line 24** to match your model:

```yaml
# For NBA model repo:
MODEL_TYPE="nba"
RG_NAME="nba-gbsv-model-rg"
APP_NAME="nba-gbsv-api"

# For NCAAM model repo:
MODEL_TYPE="ncaam"
RG_NAME="ncaam-gbsv-model-rg"
APP_NAME="ncaam-stable-prediction"

# For NFL model repo:
MODEL_TYPE="nfl"
RG_NAME="nfl-gbsv-model-rg"
APP_NAME="nfl-api"

# For NCAAF model repo:
MODEL_TYPE="ncaaf"
RG_NAME="ncaaf-gbsv-model-rg"
APP_NAME="ncaaf-v5-prod"
```

Commit and push that file.

---

## ✅ Done!

**From now on:**

1. You push code to a model repo (e.g., nba-gbsv-model)
2. GitHub Action auto-detects, builds, deploys to Container Apps
3. GitHub Action fetches the **new URL** from the Container App
4. GitHub Action updates the dashboard registry
5. Users visit the dashboard → auto-gets the **new URL** 🎉

**No more manual endpoint updates needed!**

---

## 🧪 Test It

1. Open the weekly lineup dashboard
2. Check browser console (F12 → Console)
3. Look for: `[MODEL-ENDPOINTS] Hydrating endpoints from registry...`
4. Open **Azure Portal → Storage Account → Tables → modelregistry**
5. Verify 4 rows exist (nba, ncaam, nfl, ncaaf)

---

## ❓ Questions?

See [SETUP_MODEL_REGISTRY.md](SETUP_MODEL_REGISTRY.md) for detailed explanations & troubleshooting.
