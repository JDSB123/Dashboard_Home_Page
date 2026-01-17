# Team Logo Ingestion & Deployment Guide

## Overview

This guide provides complete instructions for ingesting all NFL/NBA team logos into Azure Blob Storage and deploying them as static assets across the Dashboard application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  (Dashboard, Weekly-Lineup, Odds-Market, etc.)              │
└────────────────────────┬────────────────────────────────────┘
                         │ logo-loader.js
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Azure Blob Storage CDN                         │
│  https://gbsvorchestratorstorage.blob.core.windows.net      │
│           /team-logos/ [NFL, NBA, League logos]             │
└──────────────────────────────────────────────────────────────┘
                         ▲
                         │ Ingest Pipeline
┌──────────────────────────────────────────────────────────────┐
│            ESPN CDN (Source of Truth)                        │
│  https://a.espncdn.com/i/teamlogos/                         │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1. **logo-loader.js** - Client-side Logo Loading

**Location**: `client/assets/js/utils/logo-loader.js`

Features:

- Automatically constructs Azure Blob URLs
- Implements logo caching
- Provides fallback to ESPN CDN if needed
- Exposes `window.LogoLoader` global API

Usage:

```javascript
// Get team logo
const logoUrl = window.LogoLoader.getLogoUrl("nba", "ny");
// Returns: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png

// Get league logo
const leagueLogoUrl = window.LogoLoader.getLeagueLogoUrl("nfl");
// Returns: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nfl.png

// Preload multiple logos
window.LogoLoader.preloadLogos([
  { league: "nba", teamId: "ny" },
  { league: "nfl", teamId: "dal" },
]);

// Get statistics
console.log(window.LogoLoader.getStats());
```

### 2. **logo-mappings.json** - Team ID Reference

**Location**: `client/assets/data/logo-mappings.json`

Contains:

- Complete NFL team mappings (32 teams)
- Complete NBA team mappings (30 teams)
- Storage account URL reference
- Notes about the migration

### 3. **ingest-team-logos.ps1** - Ingestion Pipeline

**Location**: `scripts/ingest-team-logos.ps1`

Purpose:

- Downloads logos from ESPN CDN
- Uploads to Azure Blob Storage
- Validates uploads
- Generates deployment reports

## Deployment Steps

### Prerequisites

- Azure CLI installed and authenticated
- PowerShell 7.0+
- Access to `gbsvorchestratorstorage` storage account
- Access to `dashboard-gbsv-main-rg` resource group

### Step 1: Verify Container Exists

```powershell
az storage container exists `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --auth-mode login
```

Expected output:

```json
{
  "exists": true
}
```

### Step 2: Run Ingestion Pipeline

#### Full ingestion (download + upload):

```powershell
cd c:\Users\JB\green-bier-ventures\Dashboard_main_local\scripts
.\ingest-team-logos.ps1 `
  -StorageAccountName gbsvorchestratorstorage `
  -ContainerName team-logos `
  -ResourceGroup dashboard-gbsv-main-rg
```

#### With existing logos (skip download):

```powershell
.\ingest-team-logos.ps1 -SkipDownload
```

#### Dry run (preview without uploading):

```powershell
.\ingest-team-logos.ps1 -DryRun
```

### Step 3: Verify Uploads

```powershell
# List all blobs in container
az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --auth-mode login `
  --query "[].{name: name, size: properties.contentLength}" `
  -o table

# Expected output (~64 blobs):
# - 28 NFL team logos
# - 30 NBA team logos
# - 2 League logos (NFL, NBA)
# - Total: 60+ logos
```

### Step 4: Test Logo URLs

```powershell
# Test a specific logo
Invoke-WebRequest -Uri "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png" -Method Head
# Expected: StatusCode 200, Size > 0

# List sample logos
$logos = @(
  "nba-500-ny.png",
  "nfl-500-dal.png",
  "leagues-500-nba.png"
)

foreach ($logo in $logos) {
  $url = "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/$logo"
  $response = Invoke-WebRequest -Uri $url -Method Head
  Write-Host "$logo : $($response.StatusCode)"
}
```

### Step 5: Verify Client-Side Integration

#### In Browser Console:

```javascript
// Check LogoLoader is available
console.log(window.LogoLoader);

// Get sample logo URL
const url = window.LogoLoader.getLogoUrl("nba", "ny");
console.log(url);

// Verify stats
console.log(window.LogoLoader.getStats());
```

#### Expected Output:

```javascript
{
  cached: 0,
  storageUrl: "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos",
  fallbackUrl: "https://a.espncdn.com/i/teamlogos"
}
```

### Step 6: Test in Application

1. Open Dashboard: `https://www.greenbiersportventures.com/dashboard/`
2. Open Browser DevTools (F12)
3. Check Network tab for logo requests
4. Verify logos load from `gbsvorchestratorstorage.blob.core.windows.net`
5. Check Console for any `LogoLoader` warnings

## File Naming Convention

### Team Logos

**Format**: `{league}-500-{teamId}.png`

Examples:

- `nba-500-ny.png` - New York Knicks
- `nfl-500-dal.png` - Dallas Cowboys
- `nfl-500-buf.png` - Buffalo Bills
- `nba-500-gs.png` - Golden State Warriors

### League Logos

**Format**: `leagues-500-{league}.png`

Examples:

- `leagues-500-nba.png` - NBA Logo
- `leagues-500-nfl.png` - NFL Logo

## Team ID Reference

### NFL Teams (28 teams)

```
AFC East:     buf, mia, ne, nyj
AFC North:    bal, pit, cle, wsh (AFCS)
AFC South:    hou, ind, ten, jax
AFC West:     den, kc, lv, lac, ari (AFCW west outliers)

NFC East:     dal, phi, nyg, wsh
NFC North:    chi, det, gb, min
NFC South:    atl, no, tb, car (cha)
NFC West:     sf, sea, la, ari
```

### NBA Teams (30 teams)

```
Eastern Conference:
  Atlantic:    bos, bkn, ny, phi, tor
  Central:     chi, cle, det, ind, mil
  Southeast:   atl, cha, mia, orl, wsh

Western Conference:
  Northwest:   den, min, por, okc, uta
  Pacific:     gs, lal, lac, phx, sac
  Southwest:   dal, hou, mem, no, sa
```

## Blob Storage Configuration

### Container Properties

- **Name**: `team-logos`
- **Public Access Level**: Blob (allows public read access)
- **Storage Account**: `gbsvorchestratorstorage`
- **Region**: East US
- **Tier**: Standard (LRS - Locally Redundant Storage)
- **URL**: `https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/`

### Security & CORS

- **Public Access**: Read-only (blob level)
- **CORS Enabled**: Yes (for dashboard domain)
- **CSP Header**: Updated to allow `blob.core.windows.net`

#### CSP Configuration (in headers):

```
img-src 'self' data: https://gbsvorchestratorstorage.blob.core.windows.net
```

## Troubleshooting

### Container Not Found

```powershell
# Create container if missing
az storage container create `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --public-access blob `
  --auth-mode login
```

### Logo Not Loading in Browser

1. Check Network tab for 404 or 403 errors
2. Verify blob URL is correct (spelling, case-sensitive)
3. Check CSP headers in DevTools > Network > Response Headers
4. Ensure blob is public (public access level)

### Azure CLI Authentication Issues

```powershell
# Login to Azure
az login

# Verify subscription
az account show

# Set default subscription if needed
az account set --subscription <subscription-id>
```

### Upload Failed - Permission Denied

```powershell
# Verify RBAC role
az role assignment list --assignee $(az account show --query user.name -o tsv) --scope /subscriptions/{subscriptionId}/resourceGroups/dashboard-gbsv-main-rg
# Should have: Storage Blob Data Contributor or higher
```

## Maintenance

### Regular Uploads

If new logos are needed:

```powershell
.\ingest-team-logos.ps1 -SkipDownload
```

### Batch Delete (if cleanup needed)

```powershell
az storage blob delete-batch `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --auth-mode login
```

### Monitor Storage Costs

```powershell
# Check container size
$blobs = az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --auth-mode login `
  --query "[].properties.contentLength" `
  -o json | ConvertFrom-Json

$totalBytes = ($blobs | Measure-Object -Sum).Sum
$totalGB = [math]::Round($totalBytes / 1GB, 3)
Write-Host "Total size: $totalGB GB"
```

## Performance Optimization

### CDN Configuration (Optional)

To further optimize performance, set up Azure CDN:

```powershell
# Create CDN profile
az cdn profile create `
  --resource-group dashboard-gbsv-main-rg `
  --name gbsv-logo-cdn `
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create `
  --profile-name gbsv-logo-cdn `
  --resource-group dashboard-gbsv-main-rg `
  --name gbsv-logos `
  --origin gbsvorchestratorstorage.blob.core.windows.net/team-logos
```

### Caching Headers

Logos are immutable, so they can be cached aggressively:

```
Cache-Control: public, max-age=31536000, immutable
```

## Deployment Checklist

- [ ] Container `team-logos` created in `gbsvorchestratorstorage`
- [ ] `ingest-team-logos.ps1` script created and tested
- [ ] `logo-loader.js` integrated in `index.html` and `weekly-lineup.html`
- [ ] `logo-mappings.json` available in `client/assets/data/`
- [ ] All logos (62) downloaded and uploaded to Azure
- [ ] Blob URLs verified in browser (200 OK)
- [ ] Client-side `window.LogoLoader` API tested in console
- [ ] Logos rendering correctly in dashboard
- [ ] CSP headers allowing Azure Blob Storage domain
- [ ] Deployment report generated and archived
- [ ] Documentation complete and versioned

## Support & References

### Related Files

- [AZURE_BLOB_LOGOS.md](./AZURE_BLOB_LOGOS.md) - Legacy migration docs
- [logo-loader.js](../../client/assets/js/utils/logo-loader.js) - Client loader code
- [logo-mappings.json](../../client/assets/data/logo-mappings.json) - Team mappings
- [ingest-team-logos.ps1](../../scripts/ingest-team-logos.ps1) - Ingestion script

### External Resources

- [Azure Blob Storage Docs](https://learn.microsoft.com/en-us/azure/storage/blobs/)
- [Azure CDN](https://learn.microsoft.com/en-us/azure/cdn/)
- [Azure CLI Storage Commands](https://learn.microsoft.com/en-us/cli/azure/storage/)

---

Last Updated: 2026-01-12
Version: 1.0
Status: Complete
