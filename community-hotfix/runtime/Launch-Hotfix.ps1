[CmdletBinding()]
param(
    [string]$GameRoot,

    [ValidateSet('PerfectWorld', 'Worldwide')]
    [string]$Region,

    [switch]$NoAutoMap,

    [switch]$NoAutoRepair
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$hotfixLogPath = Start-HotfixLog -Operation 'launch'

try {
    if ([string]::IsNullOrWhiteSpace($Region)) {
        Write-Host ''
        Write-Host 'Choose CS2 service region:'
        Write-Host '  [1] Perfect World / China'
        Write-Host '  [2] Worldwide / Steam'
        $choice = Read-Host 'Choose 1 or 2'
        switch ($choice) {
            '1' { $Region = 'PerfectWorld' }
            '2' { $Region = 'Worldwide' }
            default { throw 'Invalid region choice.' }
        }
    }

    $manifestPath = Join-Path $PSScriptRoot 'payload\manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest is missing: $manifestPath"
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

    $environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
    if (-not $environment.SteamExe -or -not (Test-Path -LiteralPath $environment.SteamExe -PathType Leaf)) {
        throw 'steam.exe was not found.'
    }
    if (@([System.Diagnostics.Process]::GetProcessesByName('cs2')).Count -gt 0) {
        throw 'CS2 is already running. Close it before using the hotfix launcher.'
    }

    $statePath = Get-HotfixStatePath
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
        throw 'The direct Workshop hotfix is not installed. Run Install.cmd first.'
    }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ([string]$state.addonName -ne $script:HotfixAddonName -or [string]$state.workshopItemId -ne $script:WorkshopItemId) {
        throw "Hotfix state file is invalid: $statePath"
    }

    $edition = [string]$state.edition
    if ($edition -notin @('FixOnly', 'FixPlusSongs')) {
        throw "Unsupported installed edition: $edition"
    }
    $installedFiles = @($manifest.patchedWorkshopFiles.PSObject.Properties[$edition].Value)
    if (-not (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $installedFiles)) {
        $sourceFiles = @($manifest.sourceWorkshopFiles)
        $sourceFilesPresent = Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $sourceFiles
        $legacyPatchPresent = $false
        if (-not $sourceFilesPresent -and $manifest.PSObject.Properties['legacyPatchedWorkshopFiles']) {
            foreach ($legacyPatch in @($manifest.legacyPatchedWorkshopFiles)) {
                if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files @($legacyPatch.files)) {
                    $legacyPatchPresent = $true
                    break
                }
            }
        }
        if (-not $sourceFilesPresent -and -not $legacyPatchPresent) {
            throw 'Workshop files changed to an unknown version. Run Diagnostics.cmd; the launcher will not overwrite them.'
        }
        if ($NoAutoRepair) {
            throw 'The installed files need a supported hotfix reapply. Run Install.cmd.'
        }

        if ($legacyPatchPresent) {
            Write-Host "Recognized a supported previous patch. Updating edition $edition..."
        }
        else {
            Write-Host "Steam restored the supported original Workshop files. Reapplying edition $edition..."
        }
        & (Join-Path $PSScriptRoot 'Install-Hotfix.ps1') -Edition $edition -GameRoot $environment.GameRoot -NonInteractive
        if (-not (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $installedFiles)) {
            throw 'Automatic hotfix reapply did not produce the expected Workshop files.'
        }
    }

    $arguments = @('-applaunch', '730')
    if ($Region -eq 'PerfectWorld') {
        $arguments += '-perfectworld'
    }
    else {
        $arguments += '-worldwide'
    }
    $arguments += '-novid'
    if (-not $NoAutoMap) {
        $arguments += @('+map_workshop', $script:WorkshopItemId, 'mg_hachimi')
    }

    Start-Process -FilePath $environment.SteamExe -ArgumentList $arguments
    Write-Host "CS2 launch requested through Steam ($Region, normal game mode)."
    Write-Host 'The launcher verified the installed Workshop patch; it did not rewrite files unnecessarily.'
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
