# Team Logo Ingestion - Quick Start Guide

## 🚀 5-Minute Setup

### Prerequisites

- Azure CLI installed: `az --version`
- Authenticated: `az login`
- PowerShell 7.0+: `pwsh --version`
- Location: `cd <repo-root>\scripts`

### Command 1️⃣: Configure Azure Blob Storage

```powershell
.\configure-blob-storage.ps1
```

**What it does:**

- ✓ Verifies `team-logos` container exists
- ✓ Configures CORS for dashboard domains
- ✓ Verifies network settings
- ✓ (Optional) Creates CDN endpoint

**Expected Output:**

```
✓ Container exists: team-logos
✓ CORS Configuration applied
✓ Container access level: Public (Blob)
✓ Configuration complete!
```

### Command 2️⃣: Download & Upload Logos

```powershell
.\ingest-team-logos.ps1
```

**What it does:**

- 📥 Downloads 60+ team logos from ESPN CDN
- 📤 Uploads them to Azure Blob Storage
- ✓ Validates all uploads
- 📊 Generates deployment report

**Expected Output:**

```
🏟️  NFL Teams (28):
   [1/28] Downloading Buffalo Bills... ✓
   [2/28] Downloading Jacksonville Jaguars... ✓
   ...

🏟️  NBA Teams (30):
   [1/30] Downloading Atlanta Hawks... ✓
   ...

✅ All logos successfully processed!
📋 Deployment Report saved: team-logo-deployment-20260112-123456.json
```

### Command 3️⃣: Verify in Application

```javascript
// Open browser console (F12)
console.log(window.LogoLoader.getLogoUrl("nba", "ny"));
// Output: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png
```

---

## 🔍 Verification Checklist

### 1. Container Exists

```powershell
az storage container exists `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --auth-mode login
```

Expected: `{"exists": true}`

### 2. Logos Uploaded

```powershell
az storage blob list `
  --account-name gbsvorchestratorstorage `
  --container-name team-logos `
  --auth-mode login `
  -o table
```

Expected: ~60 blobs listed

### 3. Test Logo URL

```powershell
Invoke-WebRequest -Uri "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/nba-500-ny.png" -Method Head
```

Expected: StatusCode: 200

### 4. Client-Side Integration

```javascript
// In browser console at dashboard
window.LogoLoader.getStats();
// Should output: {cached: 0, storageUrl: "https://...", fallbackUrl: "https://..."}
```

### 5. Logo Rendering

- Open Dashboard: https://www.greenbiersportventures.com/dashboard/
- Look for team logos in any game cards
- Check DevTools Network tab: logos should be from `gbsvorchestratorstorage.blob.core.windows.net`

---

## 📋 Advanced Options

### Dry Run (Preview without uploading)

```powershell
.\ingest-team-logos.ps1 -DryRun
```

### Skip Download (use cached logos)

```powershell
.\ingest-team-logos.ps1 -SkipDownload
```

### Create CDN Endpoint

```powershell
.\configure-blob-storage.ps1 -CreateCDN
```

### Troubleshooting

**Q: "Container not found"**

```powershell
# Manually create it
az storage container create `
  --account-name gbsvorchestratorstorage `
  --name team-logos `
  --public-access blob `
  --auth-mode login
```

**Q: "Permission denied"**

```powershell
# Check your RBAC role
az account show
# You need: Storage Blob Data Contributor
```

**Q: "Logo not loading in dashboard"**

```javascript
// Check in browser console
window.LogoLoader.AZURE_BLOB_URL;
// Should be: https://gbsvorchestratorstorage.blob.core.windows.net/team-logos
```

---

## 📊 File Structure

```
scripts/
├── configure-blob-storage.ps1    ← Run this FIRST
├── ingest-team-logos.ps1         ← Run this SECOND
└── upload-logos.sh               ← Alternative (Bash)

client/
├── assets/
│   ├── js/utils/
│   │   └── logo-loader.js        ← Client-side logo loading
│   └── data/
│       └── logo-mappings.json    ← Team ID reference
├── index.html                    ← logo-loader.js included
└── weekly-lineup.html            ← logo-loader.js included

docs/
└── TEAM_LOGO_INGESTION_GUIDE.md  ← Full documentation
```

---

## 🎯 Success Criteria

- [ ] Container `team-logos` exists and is public
- [ ] 60+ logos uploaded to Azure Blob Storage
- [ ] Logos accessible via HTTP GET (200 OK)
- [ ] `window.LogoLoader` available in browser
- [ ] Team logos rendering in dashboard
- [ ] Network tab shows blob storage URLs
- [ ] No CSP console errors

---

## 📚 Related Documentation

- **Full Guide**: [TEAM_LOGO_INGESTION_GUIDE.md](./TEAM_LOGO_INGESTION_GUIDE.md)
- **Legacy Docs**: [AZURE_BLOB_LOGOS.md](./AZURE_BLOB_LOGOS.md)
- **Client Code**: [logo-loader.js](../../client/assets/js/utils/logo-loader.js)
- **Mappings**: [logo-mappings.json](../../client/assets/data/logo-mappings.json)

---

## 🆘 Support

For detailed troubleshooting and advanced configurations, see [TEAM_LOGO_INGESTION_GUIDE.md](./TEAM_LOGO_INGESTION_GUIDE.md)

**Contact**: See ../../QUICK_START.md for general support

---

**Last Updated**: 2026-01-12
**Status**: ✅ Ready for Production
