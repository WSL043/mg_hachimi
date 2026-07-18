[CmdletBinding()]
param(
    [ValidateSet('FixOnly', 'FixPlusSongs')]
    [string]$Edition,

    [string]$GameRoot,

    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$hotfixLogPath = Start-HotfixLog -Operation 'install'
$stage = $null

try {
    if ([string]::IsNullOrWhiteSpace($Edition)) {
        if ($NonInteractive) {
            $Edition = 'FixOnly'
        }
        else {
            Write-Host ''
            Write-Host 'mg_hachimi community hotfix'
            Write-Host '  [1] Fix only (recommended)'
            Write-Host '  [2] Fix + preview song pack'
            $choice = Read-Host 'Choose 1 or 2'
            switch ($choice) {
                '1' { $Edition = 'FixOnly' }
                '2' { $Edition = 'FixPlusSongs' }
                default { throw 'Invalid choice.' }
            }
        }
    }

    $manifestPath = Join-Path $PSScriptRoot 'payload\manifest.json'
    $basePayloadRoot = Join-Path $PSScriptRoot 'payload\base'
    $songPackRoot = Join-Path $PSScriptRoot 'payload\song-packs\preview'
    $vpkHelperSource = Join-Path $PSScriptRoot 'tools\VpkMerge.cs'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest is missing: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ([int]$manifest.schemaVersion -ne 2) {
        throw 'Unsupported package manifest schema.'
    }
    if ([string]$manifest.addonName -ne $script:HotfixAddonName -or [string]$manifest.workshopItemId -ne $script:WorkshopItemId) {
        throw 'Package manifest identity is invalid.'
    }
    Test-PayloadFiles -PayloadRoot $basePayloadRoot -Files @($manifest.baseFiles)
    if (-not (Test-Path -LiteralPath $vpkHelperSource -PathType Leaf)) {
        throw "VPK patch helper is missing: $vpkHelperSource"
    }

    $songPack = $null
    if ($Edition -eq 'FixPlusSongs') {
        $songManifestPath = Join-Path $songPackRoot 'pack.json'
        if (-not (Test-Path -LiteralPath $songManifestPath -PathType Leaf)) {
            throw 'The preview song pack is not included in this build. Use FixOnly.'
        }
        $songPack = Get-Content -LiteralPath $songManifestPath -Raw | ConvertFrom-Json
        Test-PayloadFiles -PayloadRoot (Join-Path $songPackRoot 'files') -Files @($songPack.files)
    }

    $environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
    if (@([System.Diagnostics.Process]::GetProcessesByName('cs2')).Count -gt 0) {
        throw 'CS2 is running. Close it before installing or changing the hotfix.'
    }
    if (-not (Test-Path -LiteralPath $environment.WorkshopRoot -PathType Container)) {
        throw "Workshop item $($script:WorkshopItemId) is not installed at $($environment.WorkshopRoot). Subscribe and let Steam finish downloading it first."
    }

    $sourceFiles = @($manifest.sourceWorkshopFiles)
    $patchedFiles = @($manifest.patchedWorkshopFiles.PSObject.Properties[$Edition].Value)
    if ($sourceFiles.Count -lt 2 -or $patchedFiles.Count -ne $sourceFiles.Count) {
        throw "Package Workshop file list is invalid for edition $Edition."
    }

    $backupRoot = Get-HotfixBackupRoot -SourceFiles $sourceFiles
    $currentEdition = $null
    $alreadyApplied = $false
    if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $sourceFiles) {
        if (Test-Path -LiteralPath $backupRoot -PathType Container) {
            if (-not (Test-RecordedFileSet -Root $backupRoot -Files $sourceFiles)) {
                Write-Host 'Rebuilding the incomplete author-version backup...'
                Copy-RecordedFileSet -SourceRoot $environment.WorkshopRoot -DestinationRoot $backupRoot -Files $sourceFiles
            }
        }
        else {
            Write-Host 'Backing up the original Workshop VPK files...'
            Copy-RecordedFileSet -SourceRoot $environment.WorkshopRoot -DestinationRoot $backupRoot -Files $sourceFiles
        }
    }
    else {
        foreach ($candidateEdition in @('FixOnly', 'FixPlusSongs')) {
            $candidateFiles = @($manifest.patchedWorkshopFiles.PSObject.Properties[$candidateEdition].Value)
            if (Test-RecordedFileSet -Root $environment.WorkshopRoot -Files $candidateFiles) {
                $currentEdition = $candidateEdition
                break
            }
        }
        if (-not $currentEdition) {
            throw 'The Workshop VPK files do not match the supported author version or this hotfix. Run Diagnostics.cmd before changing anything.'
        }
        if (-not (Test-RecordedFileSet -Root $backupRoot -Files $sourceFiles)) {
            throw "The map is already patched, but its verified author-version backup is missing: $backupRoot"
        }
        $alreadyApplied = ($currentEdition -eq $Edition)
    }

    $backupManifest = [ordered]@{
        schemaVersion = 1
        workshopItemId = $script:WorkshopItemId
        sourceWorkshopRoot = $environment.WorkshopRoot
        packageVersion = [string]$manifest.packageVersion
        verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
        files = $sourceFiles
    }
    Write-Utf8Json -Value $backupManifest -Path (Join-Path $backupRoot 'backup.json')

    if ($alreadyApplied) {
        Write-Host "Edition $Edition is already applied; Workshop files will not be rebuilt or rewritten."
    }
    else {
        $overlayFiles = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($entry in @($manifest.baseFiles)) {
            $overlayFiles.Add([string]$entry.path, (Join-Path $basePayloadRoot ([string]$entry.path)))
        }
        if ($songPack) {
            $songFilesRoot = Join-Path $songPackRoot 'files'
            foreach ($entry in @($songPack.files)) {
                $overlayFiles[[string]$entry.path] = Join-Path $songFilesRoot ([string]$entry.path)
            }
        }

        if (-not ('MgHachimiHotfix.VpkMerger' -as [type])) {
            Add-Type -Path $vpkHelperSource
        }

        $workshopParent = Split-Path -Parent $environment.WorkshopRoot
        $stageName = $script:WorkshopItemId + '.__community_hotfix_stage_' + [guid]::NewGuid().ToString('N')
        $stage = Assert-DirectChildPath -Parent $workshopParent -Child (Join-Path $workshopParent $stageName)
        New-Item -ItemType Directory -Path $stage | Out-Null

        $prefix = [string]$manifest.workshopPrefix
        $directoryVpk = Join-Path $backupRoot ($prefix + '_dir.vpk')
        Write-Host ("Building the {0} Workshop patch from the verified author backup..." -f $Edition)
        $patchResult = [MgHachimiHotfix.VpkMerger]::CreatePatchedSplit($directoryVpk, $backupRoot, $prefix, $overlayFiles, $stage, $prefix)
        if (-not (Test-RecordedFileSet -Root $stage -Files $patchedFiles)) {
            throw 'Built Workshop patch does not match the package manifest.'
        }
        Write-Host ("Built {0} entries: {1} replaced, {2} added, {3:N0} bytes appended." -f $patchResult.PatchedEntryCount, $patchResult.ReplacedEntryCount, $patchResult.AddedEntryCount, $patchResult.AppendedBytes)

        Set-RecordedFileSet -SourceRoot $stage -DestinationRoot $environment.WorkshopRoot -Files $patchedFiles
    }

    $statePath = Get-HotfixStatePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $statePath) -Force | Out-Null
    $state = [ordered]@{
        schemaVersion = 2
        addonName = $script:HotfixAddonName
        packageVersion = [string]$manifest.packageVersion
        edition = $Edition
        workshopItemId = $script:WorkshopItemId
        installedAtUtc = [DateTime]::UtcNow.ToString('o')
        installMode = 'direct-workshop-vpk-patch'
        workshopRoot = $environment.WorkshopRoot
        backupRoot = $backupRoot
        sourceWorkshopFiles = $sourceFiles
        installedWorkshopFiles = $patchedFiles
        songPack = if ($songPack) { [ordered]@{ id = [string]$songPack.id; version = [string]$songPack.version } } else { $null }
    }
    Write-Utf8Json -Value $state -Path $statePath

    $legacyTarget = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
    if (Test-Path -LiteralPath $legacyTarget -PathType Container) {
        $legacyMarkerPath = Join-Path $legacyTarget $script:HotfixMarkerName
        if (Test-Path -LiteralPath $legacyMarkerPath -PathType Leaf) {
            $legacyMarker = Get-Content -LiteralPath $legacyMarkerPath -Raw | ConvertFrom-Json
            if ([string]$legacyMarker.addonName -eq $script:HotfixAddonName -and [string]$legacyMarker.workshopItemId -eq $script:WorkshopItemId) {
                Remove-Item -LiteralPath $legacyTarget -Recurse -Force
                Write-Host 'Removed the obsolete standalone-addon test installation.'
            }
        }
    }

    Write-Host ''
    Write-Host "Applied directly to Workshop item: $($environment.WorkshopRoot)"
    Write-Host "Edition:   $Edition"
    Write-Host "Backup:    $backupRoot"
    Write-Host 'The patch stays installed across normal launches. Launch.cmd only reapplies it if Steam restores the supported author version.'
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
    if ($stage -and (Test-Path -LiteralPath $stage -PathType Container)) {
        $workshopParent = Split-Path -Parent $stage
        [void](Assert-DirectChildPath -Parent $workshopParent -Child $stage)
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
    Stop-HotfixLog
    if ($hotfixLogPath) {
        Write-Host "Saved log: $hotfixLogPath"
    }
}
