# Azure Front Door Infrastructure

This folder contains the Infrastructure as Code (IaC) for deploying Azure Front Door to provide:

- **Global CDN edge caching** for the dashboard
- **Path-based routing** to multiple backend services
- **WAF protection** for API endpoints
- **Custom domain** with managed SSL certificates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        www.greenbiersportventures.com                    │
│                          (Azure Front Door)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
   ┌─────────┐              ┌─────────────┐             ┌─────────────┐
   │   /*    │              │   /api/*    │             │ /api/nba/*  │
   │Dashboard│              │Orchestrator │             │  NBA API    │
   └─────────┘              └─────────────┘             └─────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐           ┌───────────────┐
│ Static Web App│          │ Container App │           │ Container App │
│proud-cliff-...│          │gbsv-orchestra.│           │nba-gbsv-api..│
└───────────────┘          └───────────────┘           └───────────────┘
```

## Files

| File | Description |
|------|-------------|
| `main.bicep` | Main infrastructure template with Front Door, WAF, origins, and routes |
| `main.bicepparam` | Production parameters file |
| `custom-domain.bicep` | Custom domain configuration (run after main deployment) |
| `deploy-frontdoor.ps1` | PowerShell deployment script |

## Routing Rules

| Path Pattern | Backend | Description |
|--------------|---------|-------------|
| `/*` | Static Web App | Dashboard frontend (default catch-all) |
| `/api/*` | Orchestrator | API orchestrator (fallback for unmatched /api/ routes) |
| `/api/nba/*` | NBA Container App | NBA model predictions API |
| `/api/ncaam/*` | NCAAM Container App | NCAAM model predictions API |
| `/api/nfl/*` | NFL Container App | NFL model predictions API |
| `/api/ncaaf/*` | NCAAF Container App | NCAAF model predictions API |

## Deployment

### Prerequisites

- Azure CLI installed and logged in
- Bicep CLI (bundled with Azure CLI 2.20.0+)
- Appropriate Azure RBAC permissions

### Option 1: PowerShell Script (Local)

```powershell
cd infra
.\deploy-frontdoor.ps1 -Environment prod
```

### Option 2: GitHub Actions (CI/CD)

1. Go to **Actions** → **Deploy Azure Front Door Infrastructure**
2. Click **Run workflow**
3. Select environment and options
4. Monitor deployment progress

### Option 3: Azure CLI (Manual)

```bash
# Validate
az bicep build --file main.bicep

# Deploy
az deployment group create \
  --resource-group dashboard-gbsv-main-rg \
  --template-file main.bicep \
  --parameters main.bicepparam
```

## Custom Domain Setup

After deploying Front Door, configure your custom domain:

### 1. Get the Front Door endpoint hostname

```bash
az afd endpoint show \
  --profile-name gbsv-frontdoor-prod \
  --resource-group dashboard-gbsv-main-rg \
  --endpoint-name gbsv-endpoint-prod \
  --query hostName -o tsv
```

### 2. Update DNS

Remove the existing Static Web App custom domain:
```bash
az staticwebapp hostname delete \
  --name gbsv-dashboard \
  --hostname www.greenbiersportventures.com
```

Add a CNAME record in your DNS provider:
- **Name:** `www`
- **Type:** `CNAME`
- **Value:** `<endpoint-hostname>.z01.azurefd.net`

### 3. Add custom domain to Front Door

```bash
az afd custom-domain create \
  --profile-name gbsv-frontdoor-prod \
  --resource-group dashboard-gbsv-main-rg \
  --custom-domain-name www-greenbiersportventures-com \
  --host-name www.greenbiersportventures.com \
  --certificate-type ManagedCertificate
```

### 4. Associate custom domain with routes

```bash
az afd route update \
  --profile-name gbsv-frontdoor-prod \
  --resource-group dashboard-gbsv-main-rg \
  --endpoint-name gbsv-endpoint-prod \
  --route-name route-dashboard \
  --custom-domains www-greenbiersportventures-com
```

## WAF Policy

The deployment includes a Web Application Firewall (WAF) policy with:

- **Microsoft Default Rule Set 2.1** - OWASP core protection
- **Bot Manager Rule Set 1.0** - Bot detection and mitigation
- **Rate Limiting** - 1000 requests/minute per IP for `/api/*` paths

To disable WAF during deployment:
```powershell
.\deploy-frontdoor.ps1 -Environment prod -SkipWaf
```

## Estimated Costs

| SKU | Monthly Estimate | Features |
|-----|------------------|----------|
| Standard | ~$35/month | CDN, routing, basic WAF |
| Premium | ~$330/month | Advanced WAF, Private Link |

The deployment uses **Standard** SKU by default.

## Troubleshooting

### Routes not working

1. Check origin group health probes in Azure Portal
2. Verify Container Apps are running and accessible
3. Check WAF policy isn't blocking requests

### Custom domain validation failing

1. Ensure DNS CNAME record is correct
2. Wait for DNS propagation (up to 24 hours)
3. Check for conflicting TXT records

### 502 Bad Gateway

1. Verify origin hostnames are correct
2. Check Container App ingress is enabled
3. Review Front Door diagnostics in Azure Portal
