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
    Write-Host ('Package directory:  ' + $PSScriptRoot)

    $versionPath = Join-Path $PSScriptRoot 'VERSION'
    $packageVersion = if (Test-Path -LiteralPath $versionPath -PathType Leaf) { [System.IO.File]::ReadAllText($versionPath).Trim() } else { 'VERSION file missing' }
    Write-Host ('Package version:    ' + $packageVersion)
    Write-Host ('PowerShell:          ' + $PSVersionTable.PSVersion.ToString())
    Write-Host ('Process bitness:     ' + ([IntPtr]::Size * 8) + '-bit')
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        Write-Host ('Windows:             ' + $os.Caption + ' ' + $os.Version + ' build ' + $os.BuildNumber)
    }
    catch {
        Write-Host ('Windows:             unavailable (' + $_.Exception.Message + ')')
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
    Write-Host 'Base payload:        integrity OK'

    if (Test-Path -LiteralPath $songManifestPath -PathType Leaf) {
        $songPack = Get-Content -LiteralPath $songManifestPath -Raw | ConvertFrom-Json
        Test-PayloadFiles -PayloadRoot (Join-Path $songPackRoot 'files') -Files @($songPack.files)
        Write-Host ('Song pack:           {0} {1} | {2} files | integrity OK' -f [string]$songPack.id, [string]$songPack.version, @($songPack.files).Count)
    }
    else {
        Write-Host 'Song pack:           not included'
    }

    if (-not ('MgHachimiHotfix.VpkMerger' -as [type])) {
        Add-Type -Path $vpkHelperSource
    }
    Write-Host 'VPK patch helper:    compile OK'

    $environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
    Write-Host ''
    Write-Host ('Game root:           ' + $environment.GameRoot)
    Write-Host ('CS2 executable:      ' + $environment.Cs2Exe)
    Write-Host ('Workshop root:       ' + $environment.WorkshopRoot)
    Write-Host ('Steam executable:    ' + [string]$environment.SteamExe)

    $runningCs2 = @(Get-CimInstance Win32_Process -Filter "Name='cs2.exe'" -ErrorAction Ignore)
    if ($runningCs2.Count -gt 0) {
        foreach ($process in $runningCs2) {
            Write-Host ('CS2 process:         PID {0} | {1}' -f $process.ProcessId, $process.CommandLine)
        }
    }
    else {
        Write-Host 'CS2 process:         not running'
    }

    try {
        $gameDrive = (Get-Item -LiteralPath $environment.GameRoot).PSDrive
        Write-Host ('Game drive free:     {0:N0} bytes' -f $gameDrive.Free)
    }
    catch {
        Write-Host ('Game drive free:     unavailable (' + $_.Exception.Message + ')')
    }

    $sourceFiles = @($manifest.sourceWorkshopFiles)
    $workshopState = 'UNKNOWN OR UPDATED'
    if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $sourceFiles) {
        $workshopState = 'ORIGINAL FILES (supported baseline)'
    }
    else {
        foreach ($candidateEdition in @('FixOnly', 'FixPlusSongs')) {
            $candidateFiles = @($manifest.patchedWorkshopFiles.PSObject.Properties[$candidateEdition].Value)
            if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $candidateFiles) {
                $workshopState = 'PATCHED ' + $candidateEdition
                break
            }
        }
        if ($workshopState -eq 'UNKNOWN OR UPDATED' -and $manifest.PSObject.Properties['legacyPatchedWorkshopFiles']) {
            foreach ($legacyPatch in @($manifest.legacyPatchedWorkshopFiles)) {
                if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files @($legacyPatch.files)) {
                    $workshopState = 'SUPPORTED PREVIOUS PATCH'
                    break
                }
            }
        }
    }
    Write-Host ('Workshop state:      ' + $workshopState)

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

        $leftovers = @(Get-ChildItem -LiteralPath $environment.WorkshopRoot -File | Where-Object { $_.Name -like '*.community-hotfix-*' } | Sort-Object Name)
        if ($leftovers.Count -gt 0) {
            Write-Host ('Temporary leftovers: ' + (($leftovers.Name) -join ', '))
        }
        else {
            Write-Host 'Temporary leftovers: none'
        }
    }
    else {
        Write-Host '  Workshop item directory is missing'
    }

    $statePath = Get-HotfixStatePath
    Write-Host ''
    Write-Host ('State file:          ' + $statePath)
    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        Write-Host ('State version:       ' + [string]$state.packageVersion)
        Write-Host ('State edition:       ' + [string]$state.edition)
        Write-Host ('State install mode:  ' + [string]$state.installMode)
        Write-Host ('Installed at UTC:    ' + [string]$state.installedAtUtc)
        if ($state.songPack) {
            Write-Host ('State song pack:    ' + [string]$state.songPack.id + ' ' + [string]$state.songPack.version)
        }
        else {
            Write-Host 'State song pack:     none'
        }
    }
    else {
        Write-Host 'State:               not installed'
    }

    $backupRoot = Get-HotfixBackupRoot -SourceFiles $sourceFiles
    Write-Host ('Backup root:         ' + $backupRoot)
    if (Test-RecordedFileSet -Root $backupRoot -Files $sourceFiles) {
        Write-Host 'Backup integrity:    OK'
    }
    else {
        Write-Host 'Backup integrity:    MISSING OR INVALID'
    }

    $legacyTarget = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
    if (Test-Path -LiteralPath $legacyTarget -PathType Container) {
        Write-Host ('Legacy addon:        PRESENT at ' + $legacyTarget)
    }
    else {
        Write-Host 'Legacy addon:        not present'
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
