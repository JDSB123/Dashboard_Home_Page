# Team Logo Ingestion - Deployment Checklist

**Use this checklist to verify successful deployment and configuration**

---

## 📋 Pre-Deployment

### Prerequisites Check

- [ ] Azure CLI installed: `az --version`
- [ ] PowerShell 7.0+: `pwsh --version`
- [ ] Azure credentials configured: `az login`
- [ ] Access to storage account `gbsvorchestratorstorage`
- [ ] Access to resource group `dashboard-gbsv-main-rg`
- [ ] Network access to ESPN CDN (for downloads)

### Directory Setup

- [ ] Location: `c:\Users\JB\green-bier-ventures\Dashboard_main_local`
- [ ] Scripts directory exists: `scripts/`
- [ ] `ingest-team-logos.ps1` present
- [ ] `configure-blob-storage.ps1` present
- [ ] `upload-logos.sh` present (optional, for Linux)

---

## 🔧 Configuration Phase

### Step 1: Configure Azure Blob Storage

```powershell
.\configure-blob-storage.ps1
```

**Verification:**

- [ ] Script executes without errors
- [ ] Output shows "✓ Container exists: team-logos"
- [ ] Output shows "✓ CORS Configuration applied"
- [ ] Output shows "✓ Configuration complete!"

### Step 2: Verify Container Exists

```powershell
az storage container exists `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --auth-mode login
```

**Expected Output:**

- [ ] `{"exists": true}`

### Step 3: Check Network Access

```powershell
$urls = @(
  "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
  "https://a.espncdn.com/i/teamlogos/nba/500/ny.png"
)
foreach ($url in $urls) {
  Invoke-WebRequest -Uri $url -Method Head
}
```

**Verification:**

- [ ] Both URLs return HTTP 200
- [ ] Network access to ESPN CDN confirmed

---

## 📥 Ingestion Phase

### Step 4: Run Logo Ingestion Pipeline

#### Option A: Full Ingestion (Recommended for First Run)

```powershell
.\ingest-team-logos.ps1
```

**During Execution:**

- [ ] Script downloads 60 logos from ESPN CDN
- [ ] Progress indicators show NFL teams (28)
- [ ] Progress indicators show NBA teams (30)
- [ ] Progress indicators show league logos (2)
- [ ] Upload section shows progress for each logo

**After Execution:**

- [ ] Output shows "✅ All logos successfully processed!" (or warnings if minor issues)
- [ ] Download count: ~58-60 ✓
- [ ] Upload count: ~58-60 ✓
- [ ] Failed count: 0-1 (acceptable)
- [ ] Deployment report saved: `team-logo-deployment-*.json`

#### Option B: Dry Run (Test Mode - No Uploads)

```powershell
.\ingest-team-logos.ps1 -DryRun
```

**Verification:**

- [ ] Script shows what WOULD be uploaded
- [ ] No actual uploads occur
- [ ] Test completes successfully

#### Option C: Skip Download (Use Cached Logos)

```powershell
.\ingest-team-logos.ps1 -SkipDownload
```

**Verification:**

- [ ] Script skips download phase
- [ ] Uses logos from previous run
- [ ] Uploads proceed normally

---

## ✅ Verification Phase

### Step 5: Verify Uploads

#### Count Uploaded Blobs

```powershell
$blobs = az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --output json | ConvertFrom-Json

$blobs.Count
```

**Expected Result:**

- [ ] Count shows 58+ blobs
- [ ] Expected range: 58-60 logos

#### List All Logos

```powershell
az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --output table
```

**Verification:**

- [ ] Table shows logo filenames
- [ ] Filenames follow pattern: `{league}-500-{teamId}.png`
- [ ] Examples visible: `nba-500-ny.png`, `nfl-500-dal.png`
- [ ] League logos present: `leagues-500-nba.png`, `leagues-500-nfl.png`

### Step 6: Test Sample Logo URLs

#### Option A: Test with PowerShell

```powershell
$testLogos = @(
  "nba-500-ny.png",
  "nfl-500-dal.png",
  "leagues-500-nba.png"
)

foreach ($logo in $testLogos) {
  $url = "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/$logo"
  try {
    $response = Invoke-WebRequest -Uri $url -Method Head
    Write-Host "$logo : $($response.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Host "$logo : FAILED" -ForegroundColor Red
  }
}
```

**Expected:**

- [ ] All URLs return HTTP 200
- [ ] All test logos accessible

#### Option B: Test in Browser

```
https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png
https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nfl-500-dal.png
https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nba.png
```

**Verification:**

- [ ] URLs return actual image files
- [ ] Images display in browser
- [ ] No CORS errors in console
- [ ] HTTP 200 status

---

## 💻 Client-Side Integration Verification

### Step 7: Verify logo-loader.js Integration

#### In index.html

```powershell
Select-String "logo-loader.js" .\client\index.html
```

**Expected Output:**

- [ ] Line found: `<script src="assets/js/utils/logo-loader.js?v=1.0.0" defer></script>`

#### In weekly-lineup.html

```powershell
Select-String "logo-loader.js" .\client\weekly-lineup.html
```

**Expected Output:**

- [ ] Line found: `<script src="assets/js/utils/logo-loader.js?v=1.0.0"></script>`

### Step 8: Verify logo-mappings.json

```powershell
# Check file exists
Test-Path .\client\assets\data\logo-mappings.json

# Check content
$mappings = Get-Content .\client\assets\data\logo-mappings.json | ConvertFrom-Json
$mappings.logoMappings.nba.PSObject.Properties.Count  # Should be ~30
$mappings.logoMappings.nfl.PSObject.Properties.Count  # Should be ~28
```

**Expected:**

- [ ] File exists and is valid JSON
- [ ] NBA teams count: ~30
- [ ] NFL teams count: ~28
- [ ] Storage URL present in mappings

---

## 🌐 Dashboard Verification

### Step 9: Test in Live Dashboard

#### Open Dashboard

```
https://www.greenbiersportventures.com/dashboard/
```

**In Browser Console (F12 → Console):**

#### Test 1: Logo Loader Available

```javascript
console.log(window.LogoLoader);
```

**Expected:**

- [ ] Object logged with methods: `getLogoUrl`, `getLeagueLogoUrl`, `preloadLogos`, `getStats`

#### Test 2: Get Sample Logo URL

```javascript
window.LogoLoader.getLogoUrl("nba", "ny");
```

**Expected Output:**

- [ ] `"https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png"`

#### Test 3: Get Statistics

```javascript
window.LogoLoader.getStats();
```

**Expected Output:**

- [ ] Object with: `cached`, `storageUrl`, `fallbackUrl`

#### Test 4: Check Network Requests

1. Open DevTools → Network tab
2. Filter by "team-logos"
3. Reload page or click on game with team logos

**Expected:**

- [ ] Network requests to `gbsvorchestratorstorage.blob.core.windows.net`
- [ ] Status code: 200
- [ ] Image content loads

#### Test 5: Visual Verification

- [ ] Team logos display correctly in game cards
- [ ] Logos match team names
- [ ] No broken image icons
- [ ] No console errors related to logos

### Step 10: Check CSP Headers

**In Browser Console:**

```javascript
console.log(document.currentScript ? document.currentScript : "N/A");
// Check for CSP warnings in console
```

**In DevTools:**

- [ ] Open Network tab
- [ ] Click any request
- [ ] Check Response Headers
- [ ] Look for `Content-Security-Policy`
- [ ] Should include: `blob.core.windows.net`

---

## 📊 Deployment Report

### Step 11: Review Deployment Report

```powershell
# Find latest report
Get-ChildItem -Filter "team-logo-deployment-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# View contents
$report = Get-Content (Get-ChildItem -Filter "team-logo-deployment-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName | ConvertFrom-Json
$report | Format-List
```

**Verification Checklist:**

- [ ] `Downloaded`: 58-60
- [ ] `Uploaded`: 58-60
- [ ] `Failed`: 0-1 (acceptable)
- [ ] `BlobStorageUrl`: Correct account and container
- [ ] `Timestamp`: Recent (within last hour)

---

## 🔒 Security Verification

### Step 12: Verify Security Configuration

#### Public Access Level

```powershell
az storage container show `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --query "properties.publicAccess" `
  --auth-mode login
```

**Expected:**

- [ ] Output: `"Blob"` (blob-level public access)

#### CORS Configuration

```powershell
# Note: CORS setup via CLI is complex; verify in Portal if needed
```

**In Azure Portal:**

- [ ] Go to: Storage Account → Blob service → CORS
- [ ] Verify: Methods include `GET, HEAD, OPTIONS`
- [ ] Verify: Allowed domains configured

#### Storage Firewall

```powershell
az storage account show `
  --name gbsvorchestratorstorage `
  --resource-group dashboard-gbsv-main-rg `
  --query "networkRuleSet.defaultAction"
```

**Expected:**

- [ ] Output: `"Allow"` (public internet access allowed)

---

## 📈 Performance Verification

### Step 13: Test Performance

#### Logo Download Speed

```powershell
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$response = Invoke-WebRequest -Uri "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png"
$stopwatch.Stop()
$stopwatch.ElapsedMilliseconds
```

**Expected:**

- [ ] Download time: 50-200ms
- [ ] Content length: > 10KB (typical logo size)

#### Storage Account Capacity

```powershell
$blobs = az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --output json | ConvertFrom-Json

$totalBytes = ($blobs | Measure-Object -Property "properties.contentLength" -Sum).Sum
$totalMB = [math]::Round($totalBytes / 1MB, 2)
Write-Host "Total size: $totalMB MB"
```

**Expected:**

- [ ] Total size: 5-15 MB
- [ ] Well under quota

---

## 🎯 Post-Deployment

### Step 14: Documentation Review

- [ ] [TEAM_LOGO_QUICK_START.md](./TEAM_LOGO_QUICK_START.md) - Available and readable
- [ ] [TEAM_LOGO_INGESTION_GUIDE.md](./TEAM_LOGO_INGESTION_GUIDE.md) - Complete
- [ ] [TEAM_LOGO_DEPLOYMENT_REPORT.md](./TEAM_LOGO_DEPLOYMENT_REPORT.md) - Generated
- [ ] [TEAM_LOGO_README.md](./TEAM_LOGO_README.md) - Published
- [ ] Deployment scripts have help: `Get-Help .\ingest-team-logos.ps1 -Full`

### Step 15: Notify Team

- [ ] Update deployment status in team communication
- [ ] Share quick-start guide with developers
- [ ] Share troubleshooting guide with support
- [ ] Document any environment-specific configurations

### Step 16: Schedule Follow-Up

- [ ] Monitor storage usage weekly
- [ ] Review logs monthly
- [ ] Plan CDN setup (if not done)
- [ ] Schedule yearly review

---

## 🆘 Troubleshooting During Deployment

### Issue: Script Not Found

```powershell
# Verify location
cd c:\Users\JB\green-bier-ventures\Dashboard_main_local\scripts
Get-ChildItem *.ps1
```

### Issue: Authentication Failed

```powershell
# Re-authenticate
az login
az account set --subscription <subscription-id>
```

### Issue: Container Not Found

```powershell
# Create container
az storage container create `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --public-access blob `
  --auth-mode login
```

### Issue: Download Failed

```powershell
# Check ESPN CDN access
Invoke-WebRequest -Uri "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png" -Method Head

# If failed, retry with:
.\ingest-team-logos.ps1 -SkipDownload
```

### Issue: Upload Permissions Denied

```powershell
# Check RBAC role
az role assignment list `
  --assignee $(az account show --query user.name -o tsv) `
  --scope /subscriptions/{subId}/resourceGroups/dashboard-gbsv-main-rg

# Need: Storage Blob Data Contributor or higher
```

---

## ✅ Final Checklist

### Before Going Live

- [ ] All 60 logos uploaded (or 58+ if 1-2 failures acceptable)
- [ ] Logo URLs tested and return 200 OK
- [ ] Dashboard tested and logos display correctly
- [ ] `window.LogoLoader` API working in console
- [ ] No errors in browser console
- [ ] Security configuration reviewed
- [ ] Documentation complete and accessible
- [ ] Team notified of changes
- [ ] Monitoring configured

### Sign-Off

- [ ] Deployment Date: ******\_\_\_******
- [ ] Verified By: ******\_\_\_******
- [ ] Environment: ☐ Dev ☐ Staging ☐ Production
- [ ] Status: ☐ Complete ☐ Partial ☐ Rollback Needed

---

## 📞 Support Contacts

- **Documentation**: See [TEAM_LOGO_README.md](./TEAM_LOGO_README.md)
- **Quick Help**: See [TEAM_LOGO_QUICK_START.md](./TEAM_LOGO_QUICK_START.md)
- **Full Guide**: See [TEAM_LOGO_INGESTION_GUIDE.md](./TEAM_LOGO_INGESTION_GUIDE.md)
- **Script Help**: `Get-Help .\ingest-team-logos.ps1 -Full`

---

**Last Updated**: 2026-01-12
**Version**: 1.0
**Status**: Ready for Production Deployment
