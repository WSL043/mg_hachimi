[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ChartJson,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Charter,

    [Parameter(Mandatory = $true)]
    [string]$SoundEvent,

    [Parameter(Mandatory = $true)]
    [string]$Cover,

    [string]$Bv = '',
    [string]$SourceIssue = '',
    [string]$Submitter = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-SafeValue {
    param([string]$Label, [string]$Value)

    if ($Value -match '[\r\n"]') {
        throw "$Label contains a character that cannot be written safely to a CS2 cfg command."
    }
}

function Format-ChartNumber {
    param([double]$Value)

    return $Value.ToString('0.####', [Globalization.CultureInfo]::InvariantCulture)
}

foreach ($pair in @(
    @('Name', $Name),
    @('Charter', $Charter),
    @('SoundEvent', $SoundEvent),
    @('Cover', $Cover),
    @('Bv', $Bv),
    @('SourceIssue', $SourceIssue),
    @('Submitter', $Submitter)
)) {
    Assert-SafeValue -Label $pair[0] -Value $pair[1]
}

$chartPath = [IO.Path]::GetFullPath($ChartJson)
if (-not (Test-Path -LiteralPath $chartPath -PathType Leaf)) {
    throw "Chart JSON does not exist: $chartPath"
}

$chart = Get-Content -LiteralPath $chartPath -Raw -Encoding UTF8 | ConvertFrom-Json
$timepoints = @($chart.timepoints)
$notes = @($chart.notes)
$slides = @($chart.slides)

if ($timepoints.Count -ne 1) {
    throw "This converter currently requires exactly one timepoint; found $($timepoints.Count)."
}
if ($slides.Count -ne 0) {
    throw "Slide notes are not supported by mg_hachimi; found $($slides.Count)."
}

$timepoint = $timepoints[0]
$startTime = [double]$timepoint.time
$bpm = [double]$timepoint.bpm
$beatsPerBar = [double]$timepoint.bpb
if ($bpm -le 0 -or $beatsPerBar -le 0) {
    throw 'The chart BPM and beats-per-bar must both be positive.'
}

$lines = [Collections.Generic.List[string]]::new()
if ($SourceIssue) {
    $lines.Add("// Source: $SourceIssue")
}
if ($Submitter) {
    $lines.Add("// Submitted by: $Submitter")
}
$lines.Add('ent_fire pulseent ScrIns "Begin"')
$lines.Add("ent_fire pulseent ScrIns `"SetName|$Name`"")
$lines.Add("ent_fire pulseent ScrIns `"SetCharter|$Charter`"")
if ($Bv) {
    $lines.Add("ent_fire pulseent ScrIns `"SetBV|$Bv`"")
}
$lines.Add("ent_fire pulseent ScrIns `"SetSoundEvent|$SoundEvent`"")
$lines.Add("ent_fire pulseent ScrIns `"SetCover|$Cover`"")

$nextBar = $startTime + (60.0 / $bpm * $beatsPerBar)
$barLines = '[' + (Format-ChartNumber $startTime) + ',' + (Format-ChartNumber $nextBar) + ']'
$lines.Add("ent_fire pulseent ScrIns `"SetBarLines|$barLines`"")

$convertedNotes = foreach ($note in $notes) {
    $lane = [int]$note.lane
    if ($lane -lt 0 -or $lane -gt 6) {
        throw "Lane $lane is outside the supported 0..6 range."
    }

    [pscustomobject]@{
        Lane = $lane
        Time = $startTime + ([double]$note.offset * 60.0 / ($bpm * 48.0))
    }
}

foreach ($note in @($convertedNotes | Sort-Object Time, Lane)) {
    $noteData = '[' + $note.Lane + ',' + (Format-ChartNumber $note.Time) + ']'
    $lines.Add("ent_fire pulseent ScrIns `"AddNote|$noteData`"")
}

$lines.Add('ent_fire pulseent ScrIns "End"')
$lines.Add('ent_fire pulseent ScrIns "Next"')

$destination = [IO.Path]::GetFullPath($OutputPath)
$destinationParent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $destinationParent -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $destinationParent)
}

[IO.File]::WriteAllLines($destination, $lines, [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($notes.Count) notes to $destination"
