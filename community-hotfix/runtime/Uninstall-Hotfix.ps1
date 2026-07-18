[CmdletBinding()]
param(
    [string]$GameRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$hotfixLogPath = Start-HotfixLog -Operation 'uninstall'

try {
    $manifestPath = Join-Path $PSScriptRoot 'payload\manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest is missing: $manifestPath"
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $sourceFiles = @($manifest.sourceWorkshopFiles)

    $environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
    if (@([System.Diagnostics.Process]::GetProcessesByName('cs2')).Count -gt 0) {
        throw 'CS2 is running. Close it before restoring the original Workshop files.'
    }

    $statePath = Get-HotfixStatePath
    $state = $null
    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ([string]$state.addonName -ne $script:HotfixAddonName -or [string]$state.workshopItemId -ne $script:WorkshopItemId) {
            throw "Refusing to use an invalid hotfix state file: $statePath"
        }
    }

    $backupRoot = if ($state -and $state.backupRoot) { [string]$state.backupRoot } else { Get-HotfixBackupRoot -SourceFiles $sourceFiles }
    if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $sourceFiles) {
        Write-Host 'The Workshop item already matches the supported original files.'
    }
    else {
        $matchedPatchedEdition = $null
        foreach ($candidateEdition in @('FixOnly', 'FixPlusSongs')) {
            $candidateFiles = @($manifest.patchedWorkshopFiles.PSObject.Properties[$candidateEdition].Value)
            if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $candidateFiles) {
                $matchedPatchedEdition = $candidateEdition
                break
            }
        }
        $matchedLegacyPatch = $null
        if (-not $matchedPatchedEdition -and $manifest.PSObject.Properties['legacyPatchedWorkshopFiles']) {
            foreach ($legacyPatch in @($manifest.legacyPatchedWorkshopFiles)) {
                if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files @($legacyPatch.files)) {
                    $matchedLegacyPatch = [string]$legacyPatch.id
                    break
                }
            }
        }
        if (-not $matchedPatchedEdition -and -not $matchedLegacyPatch) {
            throw 'The Workshop item no longer matches this hotfix or its supported original files. It may have been updated by Steam; no files were overwritten.'
        }
        if (-not (Test-RecordedFileSet -Root $backupRoot -Files $sourceFiles)) {
            throw "Verified rollback backup is missing or corrupt: $backupRoot"
        }

        Write-Host "Restoring the original Workshop files from: $backupRoot"
        Set-RecordedFileSet -SourceRoot $backupRoot -DestinationRoot $environment.WorkshopRoot -Files $sourceFiles
        if ($matchedPatchedEdition) {
            Write-Host "Restored from edition: $matchedPatchedEdition"
        }
        else {
            Write-Host 'Restored from a supported previous patch.'
        }
    }

    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
        Remove-Item -LiteralPath $statePath -Force
    }

    $legacyTarget = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
    if (Test-Path -LiteralPath $legacyTarget -PathType Container) {
        $legacyMarkerPath = Join-Path $legacyTarget $script:HotfixMarkerName
        if (-not (Test-Path -LiteralPath $legacyMarkerPath -PathType Leaf)) {
            throw "Refusing to remove an unrecognized legacy addon directory: $legacyTarget"
        }
        $legacyMarker = Get-Content -LiteralPath $legacyMarkerPath -Raw | ConvertFrom-Json
        if ([string]$legacyMarker.addonName -ne $script:HotfixAddonName -or [string]$legacyMarker.workshopItemId -ne $script:WorkshopItemId) {
            throw "Refusing to remove a legacy addon with an invalid marker: $legacyTarget"
        }
        Remove-Item -LiteralPath $legacyTarget -Recurse -Force
        Write-Host "Removed obsolete standalone addon: $legacyTarget"
    }

    Write-Host ''
    Write-Host 'Hotfix removed. The subscribed Workshop item is back on the verified original files.'
    Write-Host "Backup retained for safety: $backupRoot"
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
