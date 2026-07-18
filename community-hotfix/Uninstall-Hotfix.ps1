[CmdletBinding()]
param(
    [string]$GameRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$hotfixLogPath = Start-HotfixLog -Operation 'uninstall'

try {

$environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
$target = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)

if (-not (Test-Path -LiteralPath $target -PathType Container)) {
    Write-Host 'The community hotfix is not installed.'
    exit 0
}

$markerPath = Join-Path $target $script:HotfixMarkerName
if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "Refusing to remove an unrecognized addon directory: $target"
}

$marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
if ([string]$marker.addonName -ne $script:HotfixAddonName -or [string]$marker.workshopItemId -ne $script:WorkshopItemId) {
    throw "Refusing to remove addon with an invalid marker: $target"
}

[void](Assert-DirectChildPath -Parent $environment.AddonsRoot -Child $target)
Remove-Item -LiteralPath $target -Recurse -Force

Write-Host ''
Write-Host "Removed: $target"
Write-Host 'The original Workshop item was not modified and remains installed.'
Write-Host 'Launch the map normally from Steam Workshop to return to the author version.'
}
catch {
    Write-Host ''
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host "Report this at: $($script:FeedbackUrl)"
    if ($hotfixLogPath) {
        Write-Host "Attach this log: $hotfixLogPath"
    }
    throw
}
finally {
    Stop-HotfixLog
    if ($hotfixLogPath) {
        Write-Host "Saved log: $hotfixLogPath"
    }
}
