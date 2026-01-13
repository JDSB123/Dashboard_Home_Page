#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Download team logos from ESPN and upload to Azure Blob Storage
.DESCRIPTION
  Fetches all NFL/NBA/NCAA team logos and stores them in Azure Blob Storage
  Updates image references in code to use blob storage URLs
#>

param(
    [string]$StorageAccountName = "gbsvdashboard",
    [string]$ContainerName = "team-logos",
    [string]$ResourceGroup = "dashboard-gbsv-main-rg"
)

$ErrorActionPreference = "Stop"

# Team IDs mapping for ESPN CDN
$teams = @{
    # NFL
    "nfl/500/buf" = "Buffalo Bills"
    "nfl/500/jax" = "Jacksonville Jaguars"
    "nfl/500/mia" = "Miami Dolphins"
    "nfl/500/ne" = "New England Patriots"
    "nfl/500/tb" = "Tampa Bay Buccaneers"
    "nfl/500/bal" = "Baltimore Ravens"
    "nfl/500/pit" = "Pittsburgh Steelers"
    "nfl/500/wsh" = "Washington Commanders"
    "nfl/500/cle" = "Cleveland Browns"
    "nfl/500/dal" = "Dallas Cowboys"
    "nfl/500/phi" = "Philadelphia Eagles"
    "nfl/500/ari" = "Arizona Cardinals"
    "nfl/500/la" = "Los Angeles Rams"
    "nfl/500/sf" = "San Francisco 49ers"
    "nfl/500/sea" = "Seattle Seahawks"
    "nfl/500/chi" = "Chicago Bears"
    "nfl/500/det" = "Detroit Lions"
    "nfl/500/gb" = "Green Bay Packers"
    "nfl/500/min" = "Minnesota Vikings"
    "nfl/500/den" = "Denver Broncos"
    "nfl/500/kc" = "Kansas City Chiefs"
    "nfl/500/lv" = "Las Vegas Raiders"
    "nfl/500/chargers" = "Los Angeles Chargers"
    "nfl/500/ind" = "Indianapolis Colts"
    "nfl/500/hou" = "Houston Texans"
    "nfl/500/ten" = "Tennessee Titans"
    "nfl/500/nyg" = "New York Giants"
    "nfl/500/nyj" = "New York Jets"
    
    # NBA
    "nba/500/atl" = "Atlanta Hawks"
    "nba/500/bos" = "Boston Celtics"
    "nba/500/bkn" = "Brooklyn Nets"
    "nba/500/cha" = "Charlotte Hornets"
    "nba/500/chi" = "Chicago Bulls"
    "nba/500/cle" = "Cleveland Cavaliers"
    "nba/500/dal" = "Dallas Mavericks"
    "nba/500/den" = "Denver Nuggets"
    "nba/500/det" = "Detroit Pistons"
    "nba/500/gs" = "Golden State Warriors"
    "nba/500/hou" = "Houston Rockets"
    "nba/500/la" = "Los Angeles Lakers"
    "nba/500/lac" = "Los Angeles Clippers"
    "nba/500/mem" = "Memphis Grizzlies"
    "nba/500/mia" = "Miami Heat"
    "nba/500/mil" = "Milwaukee Bucks"
    "nba/500/min" = "Minnesota Timberwolves"
    "nba/500/no" = "New Orleans Pelicans"
    "nba/500/ny" = "New York Knicks"
    "nba/500/okc" = "Oklahoma City Thunder"
    "nba/500/orl" = "Orlando Magic"
    "nba/500/phi" = "Philadelphia 76ers"
    "nba/500/phx" = "Phoenix Suns"
    "nba/500/por" = "Portland Trail Blazers"
    "nba/500/sac" = "Sacramento Kings"
    "nba/500/sa" = "San Antonio Spurs"
    "nba/500/tor" = "Toronto Raptors"
    "nba/500/uta" = "Utah Jazz"
    "nba/500/wsh" = "Washington Wizards"
    
    # Leagues
    "leagues/500/nba" = "NBA League"
    "leagues/500/nfl" = "NFL League"
}

Write-Host "🏀 Team Logo Download and Azure Upload Script" -ForegroundColor Cyan
Write-Host "Storage Account: $StorageAccountName" -ForegroundColor Gray
Write-Host "Container: $ContainerName`n" -ForegroundColor Gray

# Create temp directory
$tempDir = Join-Path $env:TEMP "team-logos-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Write-Host "📥 Downloading logos from ESPN CDN..." -ForegroundColor Yellow
    
    # Download all images
    $downloaded = 0
    $failed = @()
    
    foreach ($path in $teams.Keys) {
        $url = "https://a.espncdn.com/i/teamlogos/$path.png"
        $fileName = "$($path.Replace('/', '-')).png"
        $localPath = Join-Path $tempDir $fileName
        
        try {
            Invoke-WebRequest -Uri $url -OutFile $localPath -ErrorAction Stop
            $downloaded++
            Write-Host "  ✓ $fileName" -ForegroundColor Green
        } catch {
            $failed += $fileName
            Write-Host "  ✗ $fileName (failed)" -ForegroundColor Red
        }
        
        Start-Sleep -Milliseconds 100 # Rate limiting
    }
    
    Write-Host "`n✅ Downloaded $downloaded images" -ForegroundColor Green
    if ($failed.Count -gt 0) {
        Write-Host "⚠️  Failed: $($failed.Count) images" -ForegroundColor Yellow
    }
    
    # Check Azure storage account exists
    Write-Host "`n☁️  Connecting to Azure Storage..." -ForegroundColor Yellow
    $storageAccount = Get-AzStorageAccount -ResourceGroupName $ResourceGroup -Name $StorageAccountName -ErrorAction SilentlyContinue
    
    if (-not $storageAccount) {
        Write-Host "❌ Storage account not found: $StorageAccountName" -ForegroundColor Red
        throw "Storage account not found"
    }
    
    # Create container if it doesn't exist
    $ctx = $storageAccount.Context
    $container = Get-AzStorageContainer -Name $ContainerName -Context $ctx -ErrorAction SilentlyContinue
    
    if (-not $container) {
        Write-Host "  Creating container: $ContainerName" -ForegroundColor Cyan
        New-AzStorageContainer -Name $ContainerName -Context $ctx -Permission Blob | Out-Null
    }
    
    # Upload all images
    Write-Host "`n📤 Uploading to Azure Blob Storage..." -ForegroundColor Yellow
    $uploaded = 0
    $uploadFailed = @()
    
    Get-ChildItem -Path $tempDir -Filter "*.png" | ForEach-Object {
        try {
            Set-AzStorageBlobContent -File $_.FullName -Container $ContainerName -Blob $_.Name -Context $ctx -Force -ErrorAction Stop | Out-Null
            $uploaded++
            Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
        } catch {
            $uploadFailed += $_.Name
            Write-Host "  ✗ $($_.Name) (failed)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✅ Uploaded $uploaded images to Azure Blob Storage" -ForegroundColor Green
    if ($uploadFailed.Count -gt 0) {
        Write-Host "⚠️  Upload failed: $($uploadFailed.Count) images" -ForegroundColor Yellow
    }
    
    # Get storage URL
    $storageUrl = $storageAccount.PrimaryEndpoints.Blob.TrimEnd('/') + "/$ContainerName"
    Write-Host "`n📍 Blob Storage URL:" -ForegroundColor Cyan
    Write-Host "  $storageUrl`n" -ForegroundColor White
    
    # Create mapping for code updates
    Write-Host "🔗 Update code with these URLs:" -ForegroundColor Cyan
    Write-Host "  League logos:" -ForegroundColor Gray
    Write-Host "    NBA: $storageUrl/leagues-500-nba.png" -ForegroundColor Gray
    Write-Host "    NFL: $storageUrl/leagues-500-nfl.png" -ForegroundColor Gray
    
    # Update CSP policy
    Write-Host "`n🔒 Update Content-Security-Policy:" -ForegroundColor Cyan
    Write-Host "  Add to img-src:" -ForegroundColor Gray
    $storageDomain = $storageAccount.PrimaryEndpoints.Blob.Split('/')[2]
    Write-Host "    $storageDomain" -ForegroundColor Yellow
    
    Write-Host "`n✅ Complete! Images are now in Azure Blob Storage" -ForegroundColor Green
    
} finally {
    # Cleanup
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
