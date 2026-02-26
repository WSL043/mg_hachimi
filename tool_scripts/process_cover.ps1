# thanks to deepseek

$template = @"
// THIS FILE IS AUTO-GENERATED

Layer0
{
	shader "csgo_simple_3layer_parallax.vfx"

	//---- Ambient Occlusion ----
	TextureAmbientOcclusion "materials/default/default_ao.tga"

	//---- Color ----
	g_vColorTint "[1.000000 1.000000 1.000000 0.000000]"
	g_vTexCoordScrollSpeed "[0.000 0.000]"
	TextureColor "materials/default/default_color.tga"

	//---- Fog ----
	g_bFogEnabled "1"

	//---- Layer 0 ----
	TextureLayer0Mask "[0.000000 0.000000 0.000000 0.000000]"

	//---- Layer 1 ----
	g_flLayer1EmissiveLevel "0.596"
	g_flLayer1Offset "-100.000"
	g_vLayer1EmissiveTint "[1.000000 1.000000 1.000000 0.000000]"
	TextureLayer1Color "materials/covers/IMAGE_NAME"
	TextureLayer1Mask "[1.000000 1.000000 1.000000 0.000000]"

	//---- Layer 2 ----
	g_flLayer2EmissiveLevel "0.000"
	g_flLayer2Offset "-1000.000"
	g_vLayer2EmissiveTint "[1.000000 1.000000 1.000000 0.000000]"
	TextureLayer2Color "[0.000000 0.000000 0.000000 0.000000]"

	//---- Lighting ----
	g_flMetalness "0.000"
	TextureRoughness "materials/default/default_rough.tga"

	//---- Normal Map ----
	TextureNormal "materials/default/default_normal.tga"

	//---- Texture Address Mode ----
	g_nTextureAddressModeU "3" // Wrap
	g_nTextureAddressModeV "3" // Wrap

	UnusedVariables
	{
		"g_bUseSecondaryUvForAmbientOcclusion" "1"
		"g_bUseSecondaryUvForLayer1" "0"
		"g_bUseSecondaryUvForLayer2" "1"
		"TextureMetalness" ""
	}


	VariableState
	{
		"Ambient Occlusion"
		{
		}
		"Color"
		{
		}
		"Fog"
		{
		}
		"Layer 0"
		{
		}
		"Layer 1"
		{
		}
		"Layer 2"
		{
		}
		"Lighting"
		{
			"Roughness" 0
			"Metalness" 0
		}
		"Normal Map"
		{
		}
		"Texture Address Mode"
		{
		}
	}
}
"@

# 加载 System.Drawing 程序集
Add-Type -AssemblyName System.Drawing

# 获取所有图片文件（可根据需要增减扩展名）
$imageFiles = Get-ChildItem @("*.jpg", "*.jpeg", "*.png")
mkdir output

foreach ($file in $imageFiles) {
    Write-Host "处理文件: $($file.FullName)"
    
    try {
        # 加载原始图片
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        
        # ----- 第一步：缩放宽度到 1024，高度按比例 -----
        $newWidth = 1024
        $newHeight = [int]($img.Height * $newWidth / $img.Width)
        
        $step1Bmp = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
        $graph1 = [System.Drawing.Graphics]::FromImage($step1Bmp)
        $graph1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graph1.DrawImage($img, 0, 0, $newWidth, $newHeight)
        $graph1.Dispose()
        
        # ----- 第二步：扩展高度到 768，黑色背景，原图居中 -----
        $canvasHeight = 768
        $step2Bmp = New-Object System.Drawing.Bitmap($newWidth, $canvasHeight)
        $graph2 = [System.Drawing.Graphics]::FromImage($step2Bmp)
        $graph2.Clear([System.Drawing.Color]::Black)   # 填充黑色背景
        # 计算垂直居中位置
        $yOffset = [math]::Max(0, ($canvasHeight - $newHeight) / 2)
        $graph2.DrawImage($step1Bmp, 0, $yOffset, $newWidth, $newHeight)
        $graph2.Dispose()
        $step1Bmp.Dispose()
        
        # ----- 第三步：拉伸到 1024x1024 -----
        $finalBmp = New-Object System.Drawing.Bitmap(1024, 1024)
        $graph3 = [System.Drawing.Graphics]::FromImage($finalBmp)
        $graph3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graph3.DrawImage($step2Bmp, 0, 0, 1024, 1024)
        $graph3.Dispose()
        $step2Bmp.Dispose()
        
        # ----- 保存结果 -----
        # 构造输出文件名：原文件名 + 后缀 + 原扩展名（GIF 转为 PNG）
        $ext = $file.Extension.ToLower()
        $outputName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + $ext
        $outputPath = [System.IO.Path]::Combine($file.DirectoryName, "output", $outputName)
        
        # 根据扩展名选择保存格式
        $format = switch ($ext) {
            ".jpg"  { [System.Drawing.Imaging.ImageFormat]::Jpeg }
            ".jpeg" { [System.Drawing.Imaging.ImageFormat]::Jpeg }
            ".png"  { [System.Drawing.Imaging.ImageFormat]::Png }
            default { [System.Drawing.Imaging.ImageFormat]::Png }
        }
        $finalBmp.Save($outputPath, $format)
        $finalBmp.Dispose()
        $img.Dispose()

        $vmatPath = [System.IO.Path]::Combine($file.DirectoryName, "output", [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".vmat")
        $template.Replace("IMAGE_NAME", $outputName) > $vmatPath

        Write-Host "已保存: $outputPath"
    }
    catch {
        Write-Warning "处理文件 $($file.Name) 时出错: $($_.Exception.Message)"
        # 确保资源释放
        if ($img) { $img.Dispose() }
        if ($step1Bmp) { $step1Bmp.Dispose() }
        if ($step2Bmp) { $step2Bmp.Dispose() }
        if ($finalBmp) { $finalBmp.Dispose() }
    }
}

Write-Host "所有图片处理完成！"
