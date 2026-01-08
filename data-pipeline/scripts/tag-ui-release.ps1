param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') {
    throw "Version must look like semver (e.g. 33.2.0 or 33.2.0-rc.1). Got: $Version"
}

$tag = "ui-v$Version"

git fetch origin --tags | Out-Null

$existing = git tag --list $tag
if ($existing) {
    throw "Tag already exists: $tag"
}

git tag -a $tag -m "UI release $tag"
git push origin $tag

Write-Host "Pushed tag: $tag" -ForegroundColor Green

