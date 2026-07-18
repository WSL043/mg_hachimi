[CmdletBinding()]
param(
    [string]$GameRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')

$hotfixLogPath = Start-HotfixLog -Operation 'diagnostics'
$diagnosticError = $null
$bundlePath = $null

try {
    Write-Host ''
    Write-Host 'mg_hachimi community hotfix diagnostics'
    Write-Host ('Collected at:       ' + [DateTime]::Now.ToString('o'))
    Write-Host ('Package directory: ' + $PSScriptRoot)

    $versionPath = Join-Path $PSScriptRoot 'VERSION'
    if (Test-Path -LiteralPath $versionPath -PathType Leaf) {
        Write-Host ('Package version:   ' + ([System.IO.File]::ReadAllText($versionPath).Trim()))
    }
    else {
        Write-Host 'Package version:   VERSION file missing'
    }

    Write-Host ('PowerShell:         ' + $PSVersionTable.PSVersion.ToString())
    Write-Host ('Process bitness:    ' + ([IntPtr]::Size * 8) + '-bit')
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        Write-Host ('Windows:            ' + $os.Caption + ' ' + $os.Version + ' build ' + $os.BuildNumber)
    }
    catch {
        Write-Host ('Windows:            unavailable (' + $_.Exception.Message + ')')
    }

    $manifestPath = Join-Path $PSScriptRoot 'payload\manifest.json'
    $basePayloadRoot = Join-Path $PSScriptRoot 'payload\base'
    $songPackRoot = Join-Path $PSScriptRoot 'payload\song-packs\preview'
    $songManifestPath = Join-Path $songPackRoot 'pack.json'
    $vpkHelperSource = Join-Path $PSScriptRoot 'tools\VpkMerge.cs'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest is missing: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    Test-PayloadFiles -PayloadRoot $basePayloadRoot -Files @($manifest.baseFiles)
    Write-Host 'Payload integrity:   OK'

    $songPack = $null
    if (Test-Path -LiteralPath $songManifestPath -PathType Leaf) {
        $songPack = Get-Content -LiteralPath $songManifestPath -Raw | ConvertFrom-Json
        Test-PayloadFiles -PayloadRoot (Join-Path $songPackRoot 'files') -Files @($songPack.files)
        Write-Host ('Song pack package:  {0} {1} | {2} files | integrity OK' -f [string]$songPack.id, [string]$songPack.version, @($songPack.files).Count)
    }
    else {
        Write-Host 'Song pack package:  not included'
    }

    if (-not ('MgHachimiHotfix.VpkMerger' -as [type])) {
        Add-Type -Path $vpkHelperSource
    }
    Write-Host 'VPK helper compile:  OK'

    $environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
    Write-Host ''
    Write-Host ('Game root:          ' + $environment.GameRoot)
    Write-Host ('CS2 executable:     ' + $environment.Cs2Exe)
    Write-Host ('Addon root:         ' + $environment.AddonsRoot)
    Write-Host ('Workshop root:      ' + $environment.WorkshopRoot)
    Write-Host ('Steam executable:   ' + [string]$environment.SteamExe)

    $runningCs2 = @(Get-Process -Name 'cs2' -ErrorAction SilentlyContinue)
    if ($runningCs2.Count -gt 0) {
        Write-Host ('CS2 process:        running (PID ' + (($runningCs2.Id | Sort-Object) -join ', ') + ')')
    }
    else {
        Write-Host 'CS2 process:        not running'
    }

    try {
        $gameDrive = (Get-Item -LiteralPath $environment.GameRoot).PSDrive
        Write-Host ('Game drive free:    {0:N0} bytes' -f $gameDrive.Free)
    }
    catch {
        Write-Host ('Game drive free:    unavailable (' + $_.Exception.Message + ')')
    }

    Write-Host ''
    Write-Host 'Workshop VPK files:'
    if (Test-Path -LiteralPath $environment.WorkshopRoot -PathType Container) {
        $workshopVpks = @(Get-ChildItem -LiteralPath $environment.WorkshopRoot -File -Filter '*.vpk' | Sort-Object Name)
        foreach ($workshopVpk in $workshopVpks) {
            $hash = (Get-FileHash -LiteralPath $workshopVpk.FullName -Algorithm SHA256).Hash
            Write-Host ('  {0} | {1:N0} bytes | SHA256 {2}' -f $workshopVpk.Name, $workshopVpk.Length, $hash)
        }
        if ($workshopVpks.Count -eq 0) {
            Write-Host '  none found'
        }
    }
    else {
        Write-Host '  Workshop item directory is missing'
    }

    $target = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
    Write-Host ''
    Write-Host ('Installed addon:    ' + $target)
    if (Test-Path -LiteralPath $target -PathType Container) {
        $installedFiles = @(Get-ChildItem -LiteralPath $target -Recurse -File -ErrorAction Stop)
        Write-Host ('Installed files:    {0} files, {1:N0} bytes' -f $installedFiles.Count, (($installedFiles | Measure-Object Length -Sum).Sum))

        $markerPath = Join-Path $target $script:HotfixMarkerName
        $marker = $null
        if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
            $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
            Write-Host ('Marker version:     ' + [string]$marker.packageVersion)
            Write-Host ('Marker edition:     ' + [string]$marker.edition)
            Write-Host ('Marker mode:        ' + [string]$marker.installMode)
            Write-Host ('Installed at UTC:   ' + [string]$marker.installedAtUtc)
            if ($marker.songPack) {
                Write-Host ('Marker song pack:  ' + [string]$marker.songPack.id + ' ' + [string]$marker.songPack.version)
            }
            else {
                Write-Host 'Marker song pack:  none'
            }
        }
        else {
            Write-Host 'Marker:              missing'
        }

        foreach ($entry in @($manifest.baseFiles)) {
            $installedPayloadPath = Join-Path $target ([string]$entry.path)
            if (Test-Path -LiteralPath $installedPayloadPath -PathType Leaf) {
                $installedHash = (Get-FileHash -LiteralPath $installedPayloadPath -Algorithm SHA256).Hash
                $hashState = if ([string]::Equals($installedHash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) { 'OK' } else { 'MISMATCH' }
                Write-Host ('Installed payload: {0} | {1} | SHA256 {2}' -f [string]$entry.path, $hashState, $installedHash)
            }
            else {
                Write-Host ('Installed payload: {0} | MISSING' -f [string]$entry.path)
            }
        }

        if ($marker -and [string]$marker.edition -eq 'FixPlusSongs') {
            if (-not $songPack) {
                throw 'Installed edition is FixPlusSongs, but the package song manifest is missing.'
            }

            $songPackMismatchCount = 0
            foreach ($entry in @($songPack.files)) {
                $installedSongPath = Join-Path $target ([string]$entry.path)
                if (Test-Path -LiteralPath $installedSongPath -PathType Leaf) {
                    $installedSongHash = (Get-FileHash -LiteralPath $installedSongPath -Algorithm SHA256).Hash
                    if (-not [string]::Equals($installedSongHash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) {
                        $songPackMismatchCount++
                        Write-Host ('Installed song file: {0} | MISMATCH | SHA256 {1}' -f [string]$entry.path, $installedSongHash)
                    }
                }
                else {
                    $songPackMismatchCount++
                    Write-Host ('Installed song file: {0} | MISSING' -f [string]$entry.path)
                }
            }

            if ($songPackMismatchCount -eq 0) {
                Write-Host ('Installed song pack: {0} {1} | {2} files | integrity OK' -f [string]$songPack.id, [string]$songPack.version, @($songPack.files).Count)
            }
            else {
                Write-Host ('Installed song pack: {0} problem(s)' -f $songPackMismatchCount)
            }
        }

        $unexpectedRootVpks = @($installedFiles | Where-Object { $_.DirectoryName -eq $target -and $_.Extension -eq '.vpk' })
        if ($unexpectedRootVpks.Count -gt 0) {
            Write-Host ('Unexpected root VPK: ' + (($unexpectedRootVpks.Name | Sort-Object) -join ', '))
        }
        else {
            Write-Host 'Unexpected root VPK: none'
        }
    }
    else {
        Write-Host 'Installed state:    not installed'
    }
}
catch {
    $diagnosticError = $_
    Write-Host ''
    Write-Host ('DIAGNOSTIC ERROR: ' + $_.Exception.Message) -ForegroundColor Red
}
finally {
    Stop-HotfixLog
}

if ($hotfixLogPath) {
    $logRoot = Get-HotfixLogRoot
    $bundlePath = Join-Path $logRoot ('diagnostics-bundle-{0}.zip' -f [DateTime]::Now.ToString('yyyyMMdd-HHmmss'))
    try {
        $logsToBundle = @(Get-ChildItem -LiteralPath $logRoot -File -Filter '*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 8)
        if ($logsToBundle.Count -gt 0) {
            Compress-Archive -LiteralPath @($logsToBundle.FullName) -DestinationPath $bundlePath -Force
        }
        else {
            $bundlePath = $null
        }
    }
    catch {
        Write-Warning ('Could not create diagnostics ZIP: ' + $_.Exception.Message)
        $bundlePath = $null
    }
}

Write-Host ''
Write-Host "Report problems at: $($script:FeedbackUrl)"
if ($bundlePath) {
    Write-Host "Attach this ZIP:    $bundlePath"
}
elseif ($hotfixLogPath) {
    Write-Host "Attach this log:    $hotfixLogPath"
}

if ($diagnosticError) {
    throw $diagnosticError
}
