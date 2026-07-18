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
$vpkHelperSource = Join-Path $PSScriptRoot 'tools\VpkMerge.cs'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Package manifest is missing: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([string]$manifest.addonName -ne $script:HotfixAddonName) {
    throw 'Package manifest addon name is invalid.'
}
if ([string]$manifest.workshopItemId -ne $script:WorkshopItemId) {
    throw 'Package manifest Workshop item ID is invalid.'
}
Test-PayloadFiles -PayloadRoot $basePayloadRoot -Files @($manifest.baseFiles)
if (-not (Test-Path -LiteralPath $vpkHelperSource -PathType Leaf)) {
    throw "VPK extraction helper is missing: $vpkHelperSource"
}

$songPack = $null
$songPackRoot = Join-Path $PSScriptRoot 'payload\song-packs\preview'
if ($Edition -eq 'FixPlusSongs') {
    $songManifestPath = Join-Path $songPackRoot 'pack.json'
    if (-not (Test-Path -LiteralPath $songManifestPath -PathType Leaf)) {
        throw 'The preview song pack is not included in this build yet. Use FixOnly.'
    }
    $songPack = Get-Content -LiteralPath $songManifestPath -Raw | ConvertFrom-Json
    Test-PayloadFiles -PayloadRoot (Join-Path $songPackRoot 'files') -Files @($songPack.files)
}

$environment = Resolve-HotfixEnvironment -GameRoot $GameRoot
if (-not (Test-Path -LiteralPath $environment.WorkshopRoot -PathType Container)) {
    throw "Workshop item $($script:WorkshopItemId) is not installed at $($environment.WorkshopRoot). Subscribe and let Steam finish downloading it first."
}

$dirVpks = @(Get-ChildItem -LiteralPath $environment.WorkshopRoot -File | Where-Object { $_.Name -match '_dir\.vpk$' })
if ($dirVpks.Count -ne 1) {
    throw "Expected exactly one Workshop directory VPK, found $($dirVpks.Count)."
}

$sourcePrefix = $dirVpks[0].BaseName -replace '_dir$', ''
$chunkVpks = @(Get-ChildItem -LiteralPath $environment.WorkshopRoot -File | Where-Object { $_.Name -match ('^' + [regex]::Escape($sourcePrefix) + '_\d{3}\.vpk$') } | Sort-Object Name)
if ($chunkVpks.Count -lt 1) {
    throw 'Workshop VPK chunks were not found.'
}

$target = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $script:HotfixAddonName)
$stageName = $script:HotfixAddonName + '.__staging_' + [guid]::NewGuid().ToString('N')
$stage = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $stageName)
$backup = $null
$workshopRecords = New-Object 'System.Collections.Generic.List[object]'

try {
    New-Item -ItemType Directory -Path $stage -Force | Out-Null

    $directoryRecord = Get-FileRecord -Path $dirVpks[0].FullName -RecordedName $dirVpks[0].Name
    $workshopRecords.Add($directoryRecord)

    foreach ($chunk in $chunkVpks) {
        $workshopRecords.Add((Get-FileRecord -Path $chunk.FullName -RecordedName $chunk.Name))
    }

    if (-not ('MgHachimiHotfix.VpkMerger' -as [type])) {
        Add-Type -Path $vpkHelperSource
    }
    Write-Host 'Extracting local Workshop VPK files into the standalone addon...'
    $extractResult = [MgHachimiHotfix.VpkMerger]::Extract($dirVpks[0].FullName, $environment.WorkshopRoot, $sourcePrefix, $stage)
    Write-Host ("Extracted {0} files ({1:N0} bytes)." -f $extractResult.EntryCount, $extractResult.DataBytes)

    Copy-DirectoryContents -Source $basePayloadRoot -Destination $stage
    if ($songPack) {
        Copy-DirectoryContents -Source (Join-Path $songPackRoot 'files') -Destination $stage
    }

    $addonInfo = @'
"AddonInfo"
{
    "IsTemplate" "0"
    "IsPlayable" "1"
}
'@
    $addonInfo += [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $stage 'addoninfo.txt'), $addonInfo, [System.Text.Encoding]::ASCII)

    $marker = [ordered]@{
        schemaVersion = 1
        addonName = $script:HotfixAddonName
        packageVersion = [string]$manifest.packageVersion
        edition = $Edition
        workshopItemId = $script:WorkshopItemId
        installedAtUtc = [DateTime]::UtcNow.ToString('o')
        installMode = 'loose-extract'
        workshopRoot = $environment.WorkshopRoot
        workshopFiles = $workshopRecords.ToArray()
        songPack = if ($songPack) { [ordered]@{ id = [string]$songPack.id; version = [string]$songPack.version } } else { $null }
    }
    Write-Utf8Json -Value $marker -Path (Join-Path $stage $script:HotfixMarkerName)

    if (Test-Path -LiteralPath $target) {
        $existingMarkerPath = Join-Path $target $script:HotfixMarkerName
        if (-not (Test-Path -LiteralPath $existingMarkerPath -PathType Leaf)) {
            throw "Refusing to replace unrecognized addon directory: $target"
        }
        $existingMarker = Get-Content -LiteralPath $existingMarkerPath -Raw | ConvertFrom-Json
        if ([string]$existingMarker.addonName -ne $script:HotfixAddonName) {
            throw "Refusing to replace addon with an invalid marker: $target"
        }

        $backupName = $script:HotfixAddonName + '.__backup_' + [guid]::NewGuid().ToString('N')
        $backup = Assert-DirectChildPath -Parent $environment.AddonsRoot -Child (Join-Path $environment.AddonsRoot $backupName)
        Move-Item -LiteralPath $target -Destination $backup
    }

    try {
        Move-Item -LiteralPath $stage -Destination $target
    }
    catch {
        if ($backup -and (Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $target)) {
            Move-Item -LiteralPath $backup -Destination $target
            $backup = $null
        }
        throw
    }

    if ($backup -and (Test-Path -LiteralPath $backup)) {
        [void](Assert-DirectChildPath -Parent $environment.AddonsRoot -Child $backup)
        Remove-Item -LiteralPath $backup -Recurse -Force
        $backup = $null
    }

    Write-Host ''
    Write-Host "Installed: $target"
    Write-Host "Edition:   $Edition"
    Write-Host 'Workshop files were copied read-only and were not modified.'
    Write-Host 'Run Launch.cmd to start the fixed map.'
}
finally {
    if (Test-Path -LiteralPath $stage) {
        [void](Assert-DirectChildPath -Parent $environment.AddonsRoot -Child $stage)
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}
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
