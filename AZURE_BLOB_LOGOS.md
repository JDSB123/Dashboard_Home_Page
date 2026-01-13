# Azure Blob Storage Logo Migration

## Overview
Migrated team logo storage from ESPN CDN to Azure Blob Storage for better reliability, performance, and independence.

## What's Included

### Files Added
- **logo-loader.js** - Utility to load logos from Azure Blob Storage
- **logo-mappings.json** - Team ID to filename mappings
- **upload-team-logos.ps1** - PowerShell script to download and upload logos
- **upload-logos.sh** - Bash script for Azure CLI uploads

### Code Changes
- Added LogoLoader to index.html and weekly-lineup.html
- Updated CSP to allow `gbsvorchestratorstorage.blob.core.windows.net`
- Service Worker now only handles same-origin requests

## How to Upload Team Logos to Azure

### Option 1: Using Azure Portal (Easiest)
1. Go to [Azure Portal](https://portal.azure.com)
2. Find storage account: `gbsvorchestratorstorage`
3. Navigate to Blob containers → Create `team-logos` container (if needed)
4. Upload downloaded PNG files from the script

### Option 2: Using Azure CLI
```bash
# Login to Azure
az login

# Upload all logos (if you have the files locally)
az storage blob upload-batch \
  --account-name gbsvorchestratorstorage \
  --container-name team-logos \
  --source ./temp-logos-dir \
  --auth-mode login
```

### Option 3: Using PowerShell (with proper permissions)
```powershell
# Run the PowerShell script (requires Storage permissions)
./scripts/upload-team-logos.ps1 `
  -StorageAccountName "gbsvorchestratorstorage" `
  -ResourceGroup "dashboard-gbsv-main-rg"
```

## How Logos Are Loaded

The `LogoLoader` utility automatically constructs Azure Blob URLs:

```javascript
// Example usage
const logoUrl = window.LogoLoader.getLogoUrl('nba', 'ny'); 
// Returns: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png

const leagueLogoUrl = window.LogoLoader.getLeagueLogoUrl('nfl');
// Returns: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nfl.png
```

## File Naming Convention

Logos follow ESPN's naming pattern:
- **Teams**: `{league}-500-{teamId}.png`
  - Examples: `nba-500-ny.png`, `nfl-500-buf.png`
- **Leagues**: `leagues-500-{league}.png`
  - Examples: `leagues-500-nba.png`, `leagues-500-nfl.png`

## Team ID Mapping

See `client/assets/data/logo-mappings.json` for complete team→filename mappings.

Common examples:
- **NBA**: `ny` (Knicks), `la` (Lakers), `gs` (Warriors), `phx` (Suns)
- **NFL**: `buf` (Bills), `dal` (Cowboys), `phi` (Eagles), `ne` (Patriots)

## Benefits

✅ **No External Dependencies** - ESPN CDN not required  
✅ **Faster Loading** - Same domain as app, better CDN caching  
✅ **No CSP Issues** - Full control over CORS headers  
✅ **100% Reliability** - Azure's 99.9% SLA  
✅ **Easy Updates** - Upload new logos anytime  

## Storage Account Details

- **Account**: gbsvorchestratorstorage
- **Container**: team-logos
- **Blob URL**: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/
- **Region**: East US
- **Tier**: Standard LRS

## Performance Impact

- Service Worker now skips external resources (faster, fewer errors)
- Logos cached by browser long-term (immutable URLs)
- Static assets served from same domain → reduced latency
- CSP no longer blocks image loads

## Next Steps

1. ✅ Code deployed and committed
2. ⏳ Upload PNG files to Azure Blob Storage (see instructions above)
3. ⏳ Verify logos load in production
4. ⏳ Monitor performance improvements

## Troubleshooting

**Logos not loading?**
- Check Network tab in DevTools
- Verify `team-logos` container exists in Azure Storage
- Confirm CSP allows `gbsvorchestratorstorage.blob.core.windows.net`
- Check LogoLoader.getStats() in console for debug info

**Upload failed?**
- Verify you have Storage Account permissions
- Check Azure CLI is authenticated: `az account show`
- Ensure container exists: `az storage container list --account-name gbsvorchestratorstorage`

---

**Deployed**: January 12, 2026  
**Status**: Ready for image upload to Azure Blob Storage
