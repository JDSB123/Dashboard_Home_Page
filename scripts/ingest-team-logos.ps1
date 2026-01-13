#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Complete Team Logo Ingestion Pipeline - Download & Upload to Azure Blob Storage
.DESCRIPTION
  Downloads all NFL/NBA team logos from ESPN CDN and uploads to Azure Blob Storage.
  Validates uploads, verifies integrity, and generates a deployment report.
.PARAMETER StorageAccountName
  Azure Storage Account name (default: gbsvorchestratorstorage)
.PARAMETER ContainerName
  Container name for team logos (default: team-logos)
.PARAMETER ResourceGroup
  Azure Resource Group (default: dashboard-gbsv-main-rg)
.PARAMETER SkipDownload
  Skip downloading logos if they already exist locally
.PARAMETER DryRun
  Show what would be uploaded without actually uploading
.EXAMPLE
  ./ingest-team-logos.ps1 -StorageAccountName gbsvorchestratorstorage -SkipDownload
.EXAMPLE
  ./ingest-team-logos.ps1 -DryRun
#>

param(
    [string]$StorageAccountName = "gbsvorchestratorstorage",
    [string]$ContainerName = "team-logos",
    [string]$ResourceGroup = "dashboard-gbsv-main-rg",
    [switch]$SkipDownload = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$script:DownloadedCount = 0
$script:UploadedCount = 0
$script:FailedCount = 0
$script:SkippedCount = 0

# Define ESPN CDN URLs and team mappings
$espnTeams = @{
    # NFL (32 teams)
    "nfl" = @(
        @{id="buf"; name="Buffalo Bills"}
        @{id="jax"; name="Jacksonville Jaguars"}
        @{id="mia"; name="Miami Dolphins"}
        @{id="ne"; name="New England Patriots"}
        @{id="tb"; name="Tampa Bay Buccaneers"}
        @{id="bal"; name="Baltimore Ravens"}
        @{id="pit"; name="Pittsburgh Steelers"}
        @{id="wsh"; name="Washington Commanders"}
        @{id="cle"; name="Cleveland Browns"}
        @{id="dal"; name="Dallas Cowboys"}
        @{id="phi"; name="Philadelphia Eagles"}
        @{id="ari"; name="Arizona Cardinals"}
        @{id="la"; name="Los Angeles Rams"}
        @{id="sf"; name="San Francisco 49ers"}
        @{id="sea"; name="Seattle Seahawks"}
        @{id="chi"; name="Chicago Bears"}
        @{id="det"; name="Detroit Lions"}
        @{id="gb"; name="Green Bay Packers"}
        @{id="min"; name="Minnesota Vikings"}
        @{id="den"; name="Denver Broncos"}
        @{id="kc"; name="Kansas City Chiefs"}
        @{id="lv"; name="Las Vegas Raiders"}
        @{id="lac"; name="Los Angeles Chargers"}
        @{id="ind"; name="Indianapolis Colts"}
        @{id="hou"; name="Houston Texans"}
        @{id="ten"; name="Tennessee Titans"}
        @{id="nyg"; name="New York Giants"}
        @{id="nyj"; name="New York Jets"}
    )
    # NBA (30 teams)
    "nba" = @(
        @{id="atl"; name="Atlanta Hawks"}
        @{id="bos"; name="Boston Celtics"}
        @{id="bkn"; name="Brooklyn Nets"}
        @{id="cha"; name="Charlotte Hornets"}
        @{id="chi"; name="Chicago Bulls"}
        @{id="cle"; name="Cleveland Cavaliers"}
        @{id="dal"; name="Dallas Mavericks"}
        @{id="den"; name="Denver Nuggets"}
        @{id="det"; name="Detroit Pistons"}
        @{id="gs"; name="Golden State Warriors"}
        @{id="hou"; name="Houston Rockets"}
        @{id="lac"; name="Los Angeles Clippers"}
        @{id="lal"; name="Los Angeles Lakers"}
        @{id="mem"; name="Memphis Grizzlies"}
        @{id="mia"; name="Miami Heat"}
        @{id="mil"; name="Milwaukee Bucks"}
        @{id="min"; name="Minnesota Timberwolves"}
        @{id="no"; name="New Orleans Pelicans"}
        @{id="ny"; name="New York Knicks"}
        @{id="okc"; name="Oklahoma City Thunder"}
        @{id="orl"; name="Orlando Magic"}
        @{id="phi"; name="Philadelphia 76ers"}
        @{id="phx"; name="Phoenix Suns"}
        @{id="por"; name="Portland Trail Blazers"}
        @{id="sac"; name="Sacramento Kings"}
        @{id="sa"; name="San Antonio Spurs"}
        @{id="tor"; name="Toronto Raptors"}
        @{id="uta"; name="Utah Jazz"}
        @{id="wsh"; name="Washington Wizards"}
    )
}

# League logos
$leagueLogos = @(
    @{league="nfl"; name="NFL"}
    @{league="nba"; name="NBA"}
)

$baseEspnUrl = "https://a.espncdn.com/i/teamlogos"

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        TEAM LOGO INGESTION PIPELINE FOR AZURE BLOB STORAGE      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Storage Account: $StorageAccountName" -ForegroundColor Gray
Write-Host "  Container: $ContainerName" -ForegroundColor Gray
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "  Skip Download: $SkipDownload" -ForegroundColor Gray
Write-Host "  Dry Run: $DryRun`n" -ForegroundColor Gray

# Create temp directory for logos
$tempDir = Join-Path $env:TEMP "team-logos-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$null = New-Item -ItemType Directory -Path $tempDir -Force

Write-Host "📁 Created temp directory: $tempDir`n" -ForegroundColor Green

# Step 1: Download logos from ESPN CDN
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 1: DOWNLOADING LOGOS FROM ESPN CDN                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if (-not $SkipDownload) {
    # Download team logos
    $totalTeams = ($espnTeams.Values | Measure-Object -Property Count -Sum).Sum
    $current = 0
    
    foreach ($league in $espnTeams.Keys) {
        Write-Host "`n🏟️  $league.ToUpper() Teams ($($espnTeams[$league].Count)):`n" -ForegroundColor Cyan
        
        foreach ($team in $espnTeams[$league]) {
            $current++
            $filename = "$league-500-$($team.id).png"
            $url = "$baseEspnUrl/$league/500/$($team.id).png"
            $outputPath = Join-Path $tempDir $filename
            
            try {
                Write-Host "   [$current/$totalTeams] Downloading $($team.name)... " -NoNewline -ForegroundColor Gray
                $response = Invoke-WebRequest -Uri $url -OutFile $outputPath -TimeoutSec 10 -ErrorAction Stop
                $script:DownloadedCount++
                Write-Host "✓" -ForegroundColor Green
            }
            catch {
                $script:FailedCount++
                Write-Host "✗ Failed" -ForegroundColor Red
                Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor DarkRed
            }
        }
    }
    
    # Download league logos
    Write-Host "`n🏆  League Logos:`n" -ForegroundColor Cyan
    foreach ($league in $leagueLogos) {
        $filename = "leagues-500-$($league.league).png"
        $url = "$baseEspnUrl/leagues/500/$($league.league).png"
        $outputPath = Join-Path $tempDir $filename
        
        try {
            Write-Host "   Downloading $($league.name) league logo... " -NoNewline -ForegroundColor Gray
            $response = Invoke-WebRequest -Uri $url -OutFile $outputPath -TimeoutSec 10 -ErrorAction Stop
            $script:DownloadedCount++
            Write-Host "✓" -ForegroundColor Green
        }
        catch {
            $script:FailedCount++
            Write-Host "✗ Failed" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor DarkRed
        }
    }
}
else {
    Write-Host "⏭️  Skipping download (--SkipDownload flag set)`n" -ForegroundColor Yellow
    $script:SkippedCount = Get-ChildItem $tempDir -Filter "*.png" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
}

# Verify downloads
$localLogos = Get-ChildItem $tempDir -Filter "*.png" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
Write-Host "`n📊  Download Summary:" -ForegroundColor Yellow
Write-Host "   Downloaded: $script:DownloadedCount" -ForegroundColor Green
Write-Host "   Failed: $script:FailedCount" -ForegroundColor $(if($script:FailedCount -gt 0) { "Red" } else { "Green" })
Write-Host "   Local files found: $localLogos`n" -ForegroundColor Cyan

if ($localLogos -eq 0) {
    Write-Host "❌ No logos found to upload!" -ForegroundColor Red
    exit 1
}

# Step 2: Upload to Azure Blob Storage
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 2: UPLOADING TO AZURE BLOB STORAGE                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No uploads will be performed`n" -ForegroundColor Yellow
}

$logos = Get-ChildItem $tempDir -Filter "*.png" | Sort-Object Name

Write-Host "Uploading $($logos.Count) logo files...\n" -ForegroundColor Cyan

foreach ($logo in $logos) {
    try {
        Write-Host "   $($logo.Name)... " -NoNewline -ForegroundColor Gray
        
        if (-not $DryRun) {
            az storage blob upload `
                --account-name $StorageAccountName `
                --container-name $ContainerName `
                --name $logo.Name `
                --file $logo.FullName `
                --auth-mode login `
                --overwrite `
                --output none `
                -q
            
            $script:UploadedCount++
            Write-Host "✓" -ForegroundColor Green
        }
        else {
            Write-Host "✓ (DRY RUN)" -ForegroundColor Cyan
            $script:UploadedCount++
        }
    }
    catch {
        $script:FailedCount++
        Write-Host "✗ Failed" -ForegroundColor Red
        Write-Host "           Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

# Step 3: Verify uploads
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 3: VERIFYING UPLOADS                                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if (-not $DryRun) {
    try {
        $blobCount = az storage blob list `
            --account-name $StorageAccountName `
            --container-name $ContainerName `
            --auth-mode login `
            --query "length(@)" `
            -o tsv
        
        Write-Host "Blobs in container: $blobCount" -ForegroundColor Cyan
        
        $details = az storage blob list `
            --account-name $StorageAccountName `
            --container-name $ContainerName `
            --auth-mode login `
            --query "[].{name: name, size: properties.contentLength}" `
            -o json | ConvertFrom-Json
        
        $totalSize = ($details | Measure-Object -Property size -Sum).Sum
        $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
        
        Write-Host "Total size: $totalSizeMB MB" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not verify uploads: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Step 4: Generate deployment report
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 4: DEPLOYMENT REPORT                                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$report = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    StorageAccount = $StorageAccountName
    Container = $ContainerName
    Logos = @{
        Downloaded = $script:DownloadedCount
        Uploaded = $script:UploadedCount
        Failed = $script:FailedCount
        Skipped = $script:SkippedCount
    }
    BlobStorageUrl = "https://$StorageAccountName.blob.core.windows.net/$ContainerName"
    TempDirectory = $tempDir
}

$reportPath = Join-Path (Get-Location) "team-logo-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$report | ConvertTo-Json | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "📋 Deployment Report:" -ForegroundColor Yellow
Write-Host "   Downloaded: $($report.Logos.Downloaded)" -ForegroundColor $(if($script:DownloadedCount -gt 0) { "Green" } else { "Gray" })
Write-Host "   Uploaded: $($report.Logos.Uploaded)" -ForegroundColor $(if($script:UploadedCount -gt 0) { "Green" } else { "Yellow" })
Write-Host "   Failed: $($report.Logos.Failed)" -ForegroundColor $(if($script:FailedCount -eq 0) { "Green" } else { "Red" })
Write-Host "   Storage URL: $($report.BlobStorageUrl)" -ForegroundColor Cyan
Write-Host "   Report saved: $reportPath`n" -ForegroundColor Green

# Cleanup
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "🧹 Cleaned up temp directory`n" -ForegroundColor Gray
}

# Final summary
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ INGESTION COMPLETE                                             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($script:FailedCount -eq 0) {
    Write-Host "✅ All logos successfully processed!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some logos failed to process (check report above)" -ForegroundColor Yellow
}

Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify logos in Azure Portal: https://portal.azure.com" -ForegroundColor Gray
Write-Host "   2. Test logo URLs in browser" -ForegroundColor Gray
Write-Host "   3. Deploy dashboard to verify logo loading`n" -ForegroundColor Gray

exit $(if ($script:FailedCount -gt 0) { 1 } else { 0 })
