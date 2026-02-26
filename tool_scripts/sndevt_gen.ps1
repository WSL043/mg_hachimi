ls *.mp3 | %{
    @"
"music.SOUND_NAME" =
{
    type = "csgo_music"
    use_hrtf = 0.0
    volume = 0.8
    vsnd_files = "sounds/songs/SOUND_NAME.vsnd"
}
"@.Replace("SOUND_NAME", [System.IO.Path]::GetFileNameWithoutExtension($_.Name))
}
