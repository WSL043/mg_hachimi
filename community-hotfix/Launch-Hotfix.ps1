[CmdletBinding()]
param(
    [string]$GameRoot,
    [switch]$NoAutoMap
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$hotfixLogPath = Start-HotfixLog -Operation 'launch'

try {

$environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
$target = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
$markerPath = Join-Path $target $script:HotfixMarkerName
if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw 'The community hotfix is not installed. Run Install.cmd first.'
}
if (-not $environment.SteamExe -or -not (Test-Path -LiteralPath $environment.SteamExe -PathType Leaf)) {
    throw 'steam.exe was not found.'
}
if (Get-Process -Name 'cs2' -ErrorAction SilentlyContinue) {
    throw 'CS2 is already running. Close it, then run Launch.cmd again so the addon can be mounted.'
}

$arguments = @('-applaunch', '730', '-tools', '-addon', $script:HotfixAddonName, '-insecure', '-novid')
if (-not $NoAutoMap) {
    $arguments += @('+map', 'maps/mg_hachimi')
}

Start-Process -FilePath $environment.SteamExe -ArgumentList $arguments
Write-Host 'CS2 launch requested through Steam.'
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
