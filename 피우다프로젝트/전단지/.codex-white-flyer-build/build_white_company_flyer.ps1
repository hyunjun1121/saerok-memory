$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = 'C:\project\saerok-memory'
$assetRoot = Join-Path $projectRoot '피우다프로젝트\일본인멘토_피드백\오가사_Haru_추출이미지'
$flyerRoot = Join-Path $projectRoot '피우다프로젝트\전단지'
$captureRoot = Join-Path $projectRoot '피우다프로젝트\application_assets\auto_screenshots\ko'
$buildRoot = Join-Path $flyerRoot '.codex-white-flyer-build'

$outputPptx = Join-Path $flyerRoot 'Haru_회사소개_전단지_화이트.pptx'
$outputPdf = Join-Path $flyerRoot 'Haru_회사소개_전단지_화이트.pdf'
$outputPng = Join-Path $flyerRoot 'Haru_회사소개_전단지_화이트.png'
$caregiverCrop = Join-Path $buildRoot 'caregiver_report_top_9x16.png'

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null

function Convert-HexToOfficeRgb([string]$hex) {
    $value = $hex.TrimStart('#')
    $r = [Convert]::ToInt32($value.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($value.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($value.Substring(4, 2), 16)
    return $r + (256 * $g) + (65536 * $b)
}

function Add-TextBox {
    param(
        $Slide,
        [string]$Text,
        [double]$X,
        [double]$Y,
        [double]$W,
        [double]$H,
        [double]$Size,
        [int]$Color,
        [bool]$Bold = $false,
        [int]$Align = 1,
        [int]$VAlign = 1,
        [string]$Font = 'Pretendard'
    )

    $shape = $Slide.Shapes.AddTextbox(1, $X, $Y, $W, $H)
    $shape.Line.Visible = 0
    $shape.Fill.Visible = 0
    $shape.TextFrame2.MarginLeft = 0
    $shape.TextFrame2.MarginRight = 0
    $shape.TextFrame2.MarginTop = 0
    $shape.TextFrame2.MarginBottom = 0
    $shape.TextFrame2.WordWrap = -1
    $shape.TextFrame2.AutoSize = 0
    $shape.TextFrame2.VerticalAnchor = $VAlign

    $range = $shape.TextFrame2.TextRange
    $range.Text = $Text
    $range.Font.Name = $Font
    $range.Font.NameFarEast = $Font
    $range.Font.Size = $Size
    $range.Font.Bold = if ($Bold) { -1 } else { 0 }
    $range.Font.Fill.ForeColor.RGB = $Color
    $range.ParagraphFormat.Alignment = $Align
    $range.ParagraphFormat.SpaceAfter = 0
    $range.ParagraphFormat.SpaceBefore = 0
    return $shape
}

function Add-Rule {
    param($Slide, [double]$X1, [double]$Y1, [double]$X2, [double]$Y2, [int]$Color, [double]$Weight = 0.75)
    $line = $Slide.Shapes.AddLine($X1, $Y1, $X2, $Y2)
    $line.Line.ForeColor.RGB = $Color
    $line.Line.Weight = $Weight
    return $line
}

function Add-Rect {
    param(
        $Slide,
        [double]$X,
        [double]$Y,
        [double]$W,
        [double]$H,
        [int]$FillColor,
        [int]$LineColor,
        [double]$LineWeight = 0,
        [bool]$Rounded = $false
    )

    $geometry = if ($Rounded) { 5 } else { 1 }
    $shape = $Slide.Shapes.AddShape($geometry, $X, $Y, $W, $H)
    $shape.Fill.Visible = -1
    $shape.Fill.Solid()
    $shape.Fill.ForeColor.RGB = $FillColor
    if ($LineWeight -gt 0) {
        $shape.Line.Visible = -1
        $shape.Line.ForeColor.RGB = $LineColor
        $shape.Line.Weight = $LineWeight
    } else {
        $shape.Line.Visible = 0
    }
    return $shape
}

function Add-PictureFit {
    param(
        $Slide,
        [string]$Path,
        [double]$X,
        [double]$Y,
        [double]$W,
        [double]$H,
        [string]$Mode = 'contain'
    )

    $picture = $Slide.Shapes.AddPicture($Path, 0, -1, 0, 0, -1, -1)
    $picture.LockAspectRatio = -1
    $sourceW = [double]$picture.Width
    $sourceH = [double]$picture.Height

    if ($Mode -eq 'cover') {
        $scale = [Math]::Max($W / $sourceW, $H / $sourceH)
    } else {
        $scale = [Math]::Min($W / $sourceW, $H / $sourceH)
    }

    $picture.Width = $sourceW * $scale
    $picture.Height = $sourceH * $scale
    $picture.Left = $X + (($W - $picture.Width) / 2)
    $picture.Top = $Y + (($H - $picture.Height) / 2)
    return $picture
}

function Export-TopCrop916 {
    param([string]$InputPath, [string]$OutputPath)
    $image = [System.Drawing.Image]::FromFile($InputPath)
    try {
        $cropHeight = [Math]::Min($image.Height, [int][Math]::Round($image.Width * 16 / 9))
        $bitmap = New-Object System.Drawing.Bitmap($image.Width, $cropHeight)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $sourceRect = New-Object System.Drawing.Rectangle(0, 0, $image.Width, $cropHeight)
                $destRect = New-Object System.Drawing.Rectangle(0, 0, $image.Width, $cropHeight)
                $graphics.DrawImage($image, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
            } finally {
                $graphics.Dispose()
            }
            $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $bitmap.Dispose()
        }
    } finally {
        $image.Dispose()
    }
}

$ink = Convert-HexToOfficeRgb '#1D2C29'
$teal = Convert-HexToOfficeRgb '#316E67'
$coral = Convert-HexToOfficeRgb '#F16F61'
$mint = Convert-HexToOfficeRgb '#F3F8F6'
$rule = Convert-HexToOfficeRgb '#D7E1DE'
$muted = Convert-HexToOfficeRgb '#687875'
$light = Convert-HexToOfficeRgb '#A7B3B0'
$white = Convert-HexToOfficeRgb '#FFFFFF'

$heroImage = Join-Path $assetRoot '개발계획서_04_한국어_어르신_탁상형기기사용_p05.jpg'
$haruLogo = Join-Path $assetRoot '발표자료_01_Haru_컬러로고.png'
$moneyImage = Join-Path $captureRoot '22_거스름돈_고르기.png'
$voiceImage = Join-Path $captureRoot '09_과일_이름_말하기.png'
$caregiverImage = Join-Path $assetRoot '발표자료_05_보호자앱_일상리포트_화면.jpg'
$weekdayImage = Join-Path $assetRoot '개발계획서_15_일본어_요일선택_화면_p24.jpg'

Export-TopCrop916 -InputPath $caregiverImage -OutputPath $caregiverCrop

$powerPoint = $null
$presentation = $null
try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Add($false)
    $presentation.PageSetup.SlideWidth = 595.28
    $presentation.PageSetup.SlideHeight = 841.89
    $slide = $presentation.Slides.Add(1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.Solid()
    $slide.Background.Fill.ForeColor.RGB = $white

    # Header
    Add-PictureFit -Slide $slide -Path $haruLogo -X 40.5 -Y 23 -W 106 -H 39 | Out-Null
    Add-TextBox -Slide $slide -Text 'AI 기반 어르신 맞춤 기억·인지 루틴' -X 357 -Y 36 -W 197 -H 14 -Size 8.8 -Color $teal -Bold $true -Align 3 | Out-Null
    Add-Rule -Slide $slide -X1 40.5 -Y1 66 -X2 554.5 -Y2 66 -Color $rule -Weight 0.8 | Out-Null

    # Hero copy
    Add-TextBox -Slide $slide -Text 'PERSONAL MEMORY ROUTINE' -X 40.5 -Y 78 -W 207 -H 12 -Size 7.5 -Color $coral -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text '오늘의 이야기가' -X 40.5 -Y 98 -W 207 -H 29 -Size 22.5 -Color $ink -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text '내일의 문항이 됩니다' -X 40.5 -Y 126 -W 217 -H 31 -Size 22.5 -Color $teal -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text "Haru는 말하고, 고르고, 기억하는 짧은 활동을`n개인의 기억과 응답에 맞춘 매일의 루틴으로 연결합니다." -X 40.5 -Y 164 -W 207 -H 40 -Size 9.3 -Color $muted | Out-Null

    $valueRows = @(
        @('01  쉬운 하루 루틴', '큰 글자·쉬운 선택·음성 입력'),
        @('02  개인 기억 기반', '남긴 이야기를 다음 활동에 반영'),
        @('03  함께 보는 기록', '가족·상담사와 참여 흐름 공유')
    )
    for ($i = 0; $i -lt $valueRows.Count; $i++) {
        $rowY = 217 + ($i * 22)
        Add-TextBox -Slide $slide -Text $valueRows[$i][0] -X 40.5 -Y $rowY -W 92 -H 12 -Size 8.5 -Color $teal -Bold $true | Out-Null
        Add-TextBox -Slide $slide -Text $valueRows[$i][1] -X 133 -Y $rowY -W 115 -H 12 -Size 7.5 -Color $ink | Out-Null
    }

    # Hero photo
    Add-Rect -Slide $slide -X 265.5 -Y 78 -W 289 -H 215 -FillColor $mint -LineColor $rule -LineWeight 0.75 -Rounded $true | Out-Null
    Add-PictureFit -Slide $slide -Path $heroImage -X 266.25 -Y 78.75 -W 287.5 -H 213.5 -Mode 'contain' | Out-Null

    # Process bridge
    Add-TextBox -Slide $slide -Text '말하기·선택   →   기록 축적   →   다음 문항 맞춤   →   가족·상담사 공유' -X 40.5 -Y 298 -W 514 -H 14 -Size 8.5 -Color $teal -Bold $true -Align 2 | Out-Null

    # Product gallery
    Add-TextBox -Slide $slide -Text 'PRODUCT EXPERIENCE' -X 40.5 -Y 316 -W 140 -H 11 -Size 7.2 -Color $coral -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text '한눈에 보는 Haru' -X 40.5 -Y 329 -W 160 -H 22 -Size 15.5 -Color $ink -Bold $true | Out-Null
    Add-Rule -Slide $slide -X1 205 -Y1 342.5 -X2 554.5 -Y2 342.5 -Color $rule -Weight 0.8 | Out-Null

    $screenXs = @(40.5, 175.5, 310.5, 445.5)
    $screenPaths = @($moneyImage, $voiceImage, $caregiverCrop, $weekdayImage)
    $screenLabels = @('생활 계산', '음성 말하기', '보호자 리포트', '요일 선택')
    for ($i = 0; $i -lt 4; $i++) {
        Add-Rect -Slide $slide -X $screenXs[$i] -Y 356 -W 109.5 -H 195 -FillColor $white -LineColor $rule -LineWeight 0.75 -Rounded $true | Out-Null
        Add-PictureFit -Slide $slide -Path $screenPaths[$i] -X ($screenXs[$i] + 0.8) -Y 356.8 -W 107.9 -H 193.4 -Mode 'contain' | Out-Null
        Add-TextBox -Slide $slide -Text $screenLabels[$i] -X $screenXs[$i] -Y 559 -W 109.5 -H 17 -Size 8.8 -Color $ink -Bold $true -Align 2 | Out-Null
    }

    # CTA and QR placeholders
    Add-Rule -Slide $slide -X1 40.5 -Y1 598 -X2 554.5 -Y2 598 -Color $rule -Weight 0.8 | Out-Null
    Add-Rect -Slide $slide -X 40.5 -Y 612 -W 514 -H 100 -FillColor $mint -LineColor $mint -Rounded $true | Out-Null
    Add-TextBox -Slide $slide -Text 'TRY HARU' -X 57 -Y 625 -W 110 -H 11 -Size 7.2 -Color $coral -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text 'Haru를 직접 체험해보세요' -X 57 -Y 641 -W 236 -H 24 -Size 15.5 -Color $teal -Bold $true | Out-Null
    Add-TextBox -Slide $slide -Text "한국어·일본어 데모와`n서비스 소개를 확인하세요." -X 57 -Y 672 -W 221 -H 29 -Size 8.5 -Color $muted | Out-Null

    $qrXs = @(340, 410, 480)
    $qrLabels = @('한국어 데모', '일본어 데모', '서비스 소개')
    for ($i = 0; $i -lt 3; $i++) {
        Add-Rect -Slide $slide -X $qrXs[$i] -Y 626 -W 46 -H 46 -FillColor $white -LineColor $rule -LineWeight 0.9 -Rounded $false | Out-Null
        Add-TextBox -Slide $slide -Text 'QR' -X $qrXs[$i] -Y 640 -W 46 -H 16 -Size 9.5 -Color $light -Bold $true -Align 2 -VAlign 3 | Out-Null
        Add-TextBox -Slide $slide -Text $qrLabels[$i] -X ($qrXs[$i] - 8) -Y 679 -W 62 -H 13 -Size 7.2 -Color $ink -Bold $true -Align 2 | Out-Null
    }

    Add-TextBox -Slide $slide -Text 'Haru의 기록은 일상 지원을 위한 참고 정보이며 의료적 판단을 대신하지 않습니다.' -X 40.5 -Y 719 -W 514 -H 10 -Size 6.2 -Color $muted -Align 2 | Out-Null

    # Partners footer
    Add-Rule -Slide $slide -X1 40.5 -Y1 739 -X2 554.5 -Y2 739 -Color $rule -Weight 0.8 | Out-Null
    Add-TextBox -Slide $slide -Text '함께하는 기관' -X 40.5 -Y 749 -W 100 -H 13 -Size 7.8 -Color $teal -Bold $true | Out-Null

    $logos = @(
        @{ Path = (Join-Path $flyerRoot '홋카이도대학교.png'); MaxW = 34; MaxH = 34 },
        @{ Path = (Join-Path $flyerRoot '분당차병원.svg'); MaxW = 74; MaxH = 22 },
        @{ Path = (Join-Path $flyerRoot '서울대.png'); MaxW = 35; MaxH = 35 },
        @{ Path = (Join-Path $flyerRoot '육군본부.png'); MaxW = 38; MaxH = 33 },
        @{ Path = (Join-Path $flyerRoot '육사.png'); MaxW = 35; MaxH = 35 },
        @{ Path = (Join-Path $flyerRoot '카이스트.jfif'); MaxW = 37; MaxH = 37 }
    )
    $cellX = @(40.5, 126.2, 211.9, 297.6, 383.3, 469.0)
    for ($i = 0; $i -lt $logos.Count; $i++) {
        Add-PictureFit -Slide $slide -Path $logos[$i].Path -X $cellX[$i] -Y 770 -W 85.5 -H 38 -Mode 'contain' | Out-Null
    }

    Add-TextBox -Slide $slide -Text 'Haru  |  Daily memory & cognitive routine' -X 40.5 -Y 819 -W 514 -H 10 -Size 6.4 -Color $light -Align 3 | Out-Null

    if (Test-Path -LiteralPath $outputPptx) { Remove-Item -LiteralPath $outputPptx -Force }
    if (Test-Path -LiteralPath $outputPdf) { Remove-Item -LiteralPath $outputPdf -Force }
    if (Test-Path -LiteralPath $outputPng) { Remove-Item -LiteralPath $outputPng -Force }

    $presentation.SaveAs($outputPptx, 24)
    $presentation.SaveAs($outputPdf, 32)
    $slide.Export($outputPng, 'PNG', 1588, 2246)

    Write-Output $outputPptx
    Write-Output $outputPdf
    Write-Output $outputPng
} finally {
    if ($presentation) {
        $presentation.Close()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
    }
    if ($powerPoint) {
        $powerPoint.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
