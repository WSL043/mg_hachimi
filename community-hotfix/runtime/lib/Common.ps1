Set-StrictMode -Version 3.0

$script:HotfixAddonName = 'mg_hachimi_community_fix'
$script:WorkshopItemId = '3500104891'
$script:HotfixMarkerName = '.mg-hachimi-community-hotfix.json'
$script:FeedbackUrl = 'https://github.com/WSL043/mg_hachimi/issues'
$script:HotfixTranscriptStarted = $false

function Get-HotfixDataRoot {
    $localData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if ([string]::IsNullOrWhiteSpace($localData)) {
        $localData = [System.IO.Path]::GetTempPath()
    }
    return (Join-Path $localData 'mg_hachimi_community_fix')
}

function Get-HotfixLogRoot {
    return (Join-Path (Get-HotfixDataRoot) 'logs')
}

function Get-HotfixStatePath {
    return (Join-Path (Get-HotfixDataRoot) ('state\{0}.json' -f $script:WorkshopItemId))
}

function Get-HotfixBackupRoot {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$SourceFiles
    )

    $directoryRecord = @($SourceFiles | Where-Object { [string]$_.path -like '*_dir.vpk' })
    if ($directoryRecord.Count -ne 1) {
        throw 'Package source file list does not contain exactly one directory VPK.'
    }
    $hashPrefix = ([string]$directoryRecord[0].sha256).Substring(0, 16).ToUpperInvariant()
    return (Join-Path (Get-HotfixDataRoot) ('backups\{0}\original-{1}' -f $script:WorkshopItemId, $hashPrefix))
}

function Start-HotfixLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Operation
    )

    try {
        $logRoot = Get-HotfixLogRoot
        New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
        $safeOperation = [regex]::Replace($Operation, '[^A-Za-z0-9_-]', '_')
        $logName = '{0}-{1}.log' -f ([DateTime]::Now.ToString('yyyyMMdd-HHmmss')), $safeOperation
        $logPath = Join-Path $logRoot $logName
        Start-Transcript -LiteralPath $logPath -Force | Out-Null
        $script:HotfixTranscriptStarted = $true
        Write-Host "Log file: $logPath"
        return $logPath
    }
    catch {
        Write-Warning ('Could not start log: ' + $_.Exception.Message)
        return $null
    }
}

function Stop-HotfixLog {
    if (-not $script:HotfixTranscriptStarted) {
        return
    }
    try {
        Stop-Transcript | Out-Null
    }
    catch {
        # Do not hide the original operation result if transcript shutdown fails.
    }
    $script:HotfixTranscriptStarted = $false
}

function Add-UniquePath {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.List[string]]$List,

        [AllowNull()]
        [AllowEmptyString()]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)
    }
    catch {
        return
    }

    foreach ($existing in $List) {
        if ([string]::Equals($existing, $fullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            return
        }
    }

    $List.Add($fullPath)
}

function Get-SteamInstallRoots {
    $roots = New-Object 'System.Collections.Generic.List[string]'

    foreach ($registryPath in @(
        'HKCU:\Software\Valve\Steam',
        'HKLM:\SOFTWARE\Valve\Steam',
        'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam'
    )) {
        try {
            $properties = Get-ItemProperty -LiteralPath $registryPath -ErrorAction Stop
            Add-UniquePath -List $roots -Path $properties.SteamPath
            Add-UniquePath -List $roots -Path $properties.InstallPath
        }
        catch {
            # Steam may not be registered in both locations.
        }
    }

    Add-UniquePath -List $roots -Path 'C:\Program Files (x86)\Steam'
    Add-UniquePath -List $roots -Path 'C:\Program Files\Steam'
    Add-UniquePath -List $roots -Path 'D:\Steam'

    $libraryRoots = New-Object 'System.Collections.Generic.List[string]'
    foreach ($steamRoot in @($roots)) {
        Add-UniquePath -List $libraryRoots -Path $steamRoot
        $libraryFile = Join-Path $steamRoot 'steamapps\libraryfolders.vdf'
        if (-not (Test-Path -LiteralPath $libraryFile -PathType Leaf)) {
            continue
        }

        try {
            $libraryText = [System.IO.File]::ReadAllText($libraryFile)
            foreach ($match in [regex]::Matches($libraryText, '"path"\s+"([^"]+)"')) {
                $libraryPath = $match.Groups[1].Value.Replace('\\', '\')
                Add-UniquePath -List $libraryRoots -Path $libraryPath
            }
        }
        catch {
            # Keep the roots already discovered if libraryfolders.vdf is unreadable.
        }
    }

    return @($libraryRoots)
}

function Resolve-HotfixEnvironment {
    param(
        [AllowNull()]
        [AllowEmptyString()]
        [string]$GameRoot
    )

    $gameCandidates = New-Object 'System.Collections.Generic.List[string]'
    Add-UniquePath -List $gameCandidates -Path $GameRoot

    try {
        $cs2Process = @([System.Diagnostics.Process]::GetProcessesByName('cs2')) | Select-Object -First 1
        if ($cs2Process -and $cs2Process.Path) {
            $runningGameRoot = $cs2Process.Path
            for ($i = 0; $i -lt 4; $i++) {
                $runningGameRoot = Split-Path -Parent $runningGameRoot
            }
            Add-UniquePath -List $gameCandidates -Path $runningGameRoot
        }
    }
    catch {
        # CS2 does not have to be running, and its path may be unavailable.
    }

    $steamRoots = @(Get-SteamInstallRoots)
    foreach ($steamRoot in $steamRoots) {
        Add-UniquePath -List $gameCandidates -Path (Join-Path $steamRoot 'steamapps\common\Counter-Strike Global Offensive')
    }

    foreach ($candidate in @($gameCandidates)) {
        $cs2Exe = Join-Path $candidate 'game\bin\win64\cs2.exe'
        $addonsRoot = Join-Path $candidate 'game\csgo_addons'
        if (-not (Test-Path -LiteralPath $cs2Exe -PathType Leaf)) {
            continue
        }
        if (-not (Test-Path -LiteralPath $addonsRoot -PathType Container)) {
            continue
        }

        $commonRoot = Split-Path -Parent $candidate
        $steamAppsRoot = Split-Path -Parent $commonRoot
        $workshopCandidates = New-Object 'System.Collections.Generic.List[string]'
        Add-UniquePath -List $workshopCandidates -Path (Join-Path $steamAppsRoot ('workshop\content\730\' + $script:WorkshopItemId))
        foreach ($steamRoot in $steamRoots) {
            Add-UniquePath -List $workshopCandidates -Path (Join-Path $steamRoot ('steamapps\workshop\content\730\' + $script:WorkshopItemId))
        }

        $workshopRoot = $null
        foreach ($workshopCandidate in @($workshopCandidates)) {
            $directoryVpk = Join-Path $workshopCandidate ($script:WorkshopItemId + '_dir.vpk')
            if (Test-Path -LiteralPath $directoryVpk -PathType Leaf) {
                $workshopRoot = $workshopCandidate
                break
            }
        }
        if (-not $workshopRoot) {
            $workshopRoot = $workshopCandidates[0]
        }
        $steamExe = Join-Path (Split-Path -Parent $steamAppsRoot) 'steam.exe'
        if (-not (Test-Path -LiteralPath $steamExe -PathType Leaf)) {
            $steamExe = $null
            foreach ($steamRoot in $steamRoots) {
                $candidateSteamExe = Join-Path $steamRoot 'steam.exe'
                if (Test-Path -LiteralPath $candidateSteamExe -PathType Leaf) {
                    $steamExe = $candidateSteamExe
                    break
                }
            }
        }

        return [pscustomobject]@{
            GameRoot = [System.IO.Path]::GetFullPath($candidate)
            Cs2Exe = [System.IO.Path]::GetFullPath($cs2Exe)
            AddonsRoot = [System.IO.Path]::GetFullPath($addonsRoot)
            WorkshopRoot = [System.IO.Path]::GetFullPath($workshopRoot)
            SteamExe = $steamExe
        }
    }

    throw 'CS2 installation was not found. Re-run with -GameRoot "X:\...\Counter-Strike Global Offensive".'
}

function Assert-DirectChildPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Parent,

        [Parameter(Mandatory = $true)]
        [string]$Child
    )

    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\')
    $childFull = [System.IO.Path]::GetFullPath($Child).TrimEnd('\')
    $childParent = [System.IO.Path]::GetDirectoryName($childFull).TrimEnd('\')

    if (-not [string]::Equals($parentFull, $childParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path rejected: $childFull is not a direct child of $parentFull"
    }

    return $childFull
}

function Write-Utf8Json {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $json = $Value | ConvertTo-Json -Depth 10
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8)
}

function Get-DirectFilePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$RecordedPath
    )

    if ([string]::IsNullOrWhiteSpace($RecordedPath) -or [System.IO.Path]::GetFileName($RecordedPath) -ne $RecordedPath) {
        throw "Unsafe direct file path rejected: $RecordedPath"
    }
    return (Join-Path ([System.IO.Path]::GetFullPath($Root)) $RecordedPath)
}

function Test-RecordedFileSet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [object[]]$Files
    )

    foreach ($entry in $Files) {
        $path = Get-DirectFilePath -Root $Root -RecordedPath ([string]$entry.path)
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            return $false
        }
        $file = Get-Item -LiteralPath $path
        if ($file.Length -ne [int64]$entry.length) {
            return $false
        }
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        if (-not [string]::Equals($hash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }
    return $true
}

function Copy-RecordedFileSet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$DestinationRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$Files
    )

    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    foreach ($entry in $Files) {
        $sourcePath = Get-DirectFilePath -Root $SourceRoot -RecordedPath ([string]$entry.path)
        $destinationPath = Get-DirectFilePath -Root $DestinationRoot -RecordedPath ([string]$entry.path)
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Source file is missing: $sourcePath"
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }
    if (-not (Test-RecordedFileSet -Root $DestinationRoot -Files $Files)) {
        throw "Copied file-set verification failed: $DestinationRoot"
    }
}

function Set-RecordedFileSet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$DestinationRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$Files
    )

    $token = [guid]::NewGuid().ToString('N')
    $pending = New-Object 'System.Collections.Generic.List[object]'
    $swapped = New-Object 'System.Collections.Generic.List[object]'

    try {
        foreach ($entry in $Files) {
            $name = [string]$entry.path
            $sourcePath = Get-DirectFilePath -Root $SourceRoot -RecordedPath $name
            $destinationPath = Get-DirectFilePath -Root $DestinationRoot -RecordedPath $name
            if (-not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
                throw "Workshop file is missing: $destinationPath"
            }

            $destinationFile = Get-Item -LiteralPath $destinationPath
            if ($destinationFile.Length -eq [int64]$entry.length) {
                $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash
                if ([string]::Equals($destinationHash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) {
                    continue
                }
            }

            $temporaryPath = $destinationPath + '.community-hotfix-new-' + $token
            $swapPath = $destinationPath + '.community-hotfix-old-' + $token
            Copy-Item -LiteralPath $sourcePath -Destination $temporaryPath
            $temporaryFile = Get-Item -LiteralPath $temporaryPath
            $temporaryHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
            if ($temporaryFile.Length -ne [int64]$entry.length -or -not [string]::Equals($temporaryHash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Staged file verification failed: $name"
            }
            $pending.Add([pscustomobject]@{ Name = $name; TemporaryPath = $temporaryPath; DestinationPath = $destinationPath; SwapPath = $swapPath })
        }

        foreach ($item in $pending) {
            [System.IO.File]::Replace($item.TemporaryPath, $item.DestinationPath, $item.SwapPath)
            $swapped.Add($item)
        }

        if (-not (Test-RecordedFileSet -Root $DestinationRoot -Files $Files)) {
            throw 'Installed Workshop file-set verification failed.'
        }

        foreach ($item in $swapped) {
            if (Test-Path -LiteralPath $item.SwapPath -PathType Leaf) {
                Remove-Item -LiteralPath $item.SwapPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        for ($index = $swapped.Count - 1; $index -ge 0; $index--) {
            $item = $swapped[$index]
            try {
                if (Test-Path -LiteralPath $item.SwapPath -PathType Leaf) {
                    $failedPath = $item.DestinationPath + '.community-hotfix-failed-' + $token
                    [System.IO.File]::Replace($item.SwapPath, $item.DestinationPath, $failedPath)
                    if (Test-Path -LiteralPath $failedPath -PathType Leaf) {
                        Remove-Item -LiteralPath $failedPath -Force
                    }
                }
            }
            catch {
                # Preserve the original error. Diagnostics will report any leftover swap files.
            }
        }
        foreach ($item in $pending) {
            if (Test-Path -LiteralPath $item.TemporaryPath -PathType Leaf) {
                Remove-Item -LiteralPath $item.TemporaryPath -Force
            }
        }
        throw
    }
}

function Get-FileRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$RecordedName
    )

    $file = Get-Item -LiteralPath $Path -ErrorAction Stop
    $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
    return [pscustomobject]@{
        name = $RecordedName
        length = $file.Length
        sha256 = $hash.Hash
        lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('o')
    }
}

function Copy-DirectoryContents {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Payload directory is missing: $Source"
    }

    foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
        Copy-Item -LiteralPath $item.FullName -Destination $Destination -Recurse -Force
    }
}

function Test-PayloadFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PayloadRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$Files
    )

    $payloadRootFull = [System.IO.Path]::GetFullPath($PayloadRoot).TrimEnd('\')
    foreach ($entry in $Files) {
        $relativePath = [string]$entry.path
        $candidate = [System.IO.Path]::GetFullPath((Join-Path $payloadRootFull $relativePath))
        if (-not $candidate.StartsWith($payloadRootFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe payload path rejected: $relativePath"
        }
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "Payload file is missing: $relativePath"
        }

        $file = Get-Item -LiteralPath $candidate
        if ([int64]$entry.length -ne $file.Length) {
            throw "Payload length mismatch: $relativePath"
        }

        $actualHash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
        if (-not [string]::Equals([string]$entry.sha256, $actualHash, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Payload hash mismatch: $relativePath"
        }
    }
}
