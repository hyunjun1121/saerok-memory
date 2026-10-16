$ErrorActionPreference = 'Stop'

$pptx = 'C:\project\saerok-memory\피우다프로젝트\일본인멘토_피드백\피우다중간발표_오가사_Haru.pptx'
$outDir = 'C:\project\saerok-memory\.codex_tmp\pptx_audit_mentor_deck_20260816\renders'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Get-ShapeTexts {
    param($Shape)

    $items = [System.Collections.Generic.List[string]]::new()
    try {
        if ($Shape.Type -eq 6) {
            for ($i = 1; $i -le $Shape.GroupItems.Count; $i++) {
                foreach ($text in (Get-ShapeTexts -Shape $Shape.GroupItems.Item($i))) {
                    if ($text) { $items.Add($text) }
                }
            }
        }
        else {
            try {
                if ($Shape.HasTextFrame -and $Shape.TextFrame.HasText) {
                    $text = [string]$Shape.TextFrame.TextRange.Text
                    if (-not [string]::IsNullOrWhiteSpace($text)) { $items.Add($text.Trim()) }
                }
            }
            catch {}

            try {
                if ($Shape.HasTable) {
                    for ($row = 1; $row -le $Shape.Table.Rows.Count; $row++) {
                        for ($column = 1; $column -le $Shape.Table.Columns.Count; $column++) {
                            $text = [string]$Shape.Table.Cell($row, $column).Shape.TextFrame.TextRange.Text
                            if (-not [string]::IsNullOrWhiteSpace($text)) { $items.Add($text.Trim()) }
                        }
                    }
                }
            }
            catch {}
        }
    }
    catch {}

    return $items
}

$app = New-Object -ComObject PowerPoint.Application
$presentation = $null

try {
    $presentation = $app.Presentations.Open($pptx, $true, $false, $false)
    $presentation.Export($outDir, 'PNG', 1600, 900)

    $slides = [System.Collections.Generic.List[object]]::new()
    for ($slideNumber = 1; $slideNumber -le $presentation.Slides.Count; $slideNumber++) {
        $slide = $presentation.Slides.Item($slideNumber)
        $texts = [System.Collections.Generic.List[string]]::new()
        $altTexts = [System.Collections.Generic.List[string]]::new()

        for ($shapeNumber = 1; $shapeNumber -le $slide.Shapes.Count; $shapeNumber++) {
            $shape = $slide.Shapes.Item($shapeNumber)
            foreach ($text in (Get-ShapeTexts -Shape $shape)) {
                if ($text) { $texts.Add($text) }
            }

            try {
                $altText = [string]$shape.AlternativeText
                if (-not [string]::IsNullOrWhiteSpace($altText)) { $altTexts.Add($altText.Trim()) }
            }
            catch {}
        }

        $notes = [System.Collections.Generic.List[string]]::new()
        try {
            for ($shapeNumber = 1; $shapeNumber -le $slide.NotesPage.Shapes.Count; $shapeNumber++) {
                $shape = $slide.NotesPage.Shapes.Item($shapeNumber)
                foreach ($text in (Get-ShapeTexts -Shape $shape)) {
                    if ($text -and $text -notmatch '^\d+$') { $notes.Add($text) }
                }
            }
        }
        catch {}

        $slides.Add([pscustomobject]@{
                slide      = $slideNumber
                slideId    = $slide.SlideID
                name       = [string]$slide.Name
                hidden     = [bool]$slide.SlideShowTransition.Hidden
                texts      = @($texts)
                altTexts   = @($altTexts)
                notes      = @($notes)
                shapeCount = $slide.Shapes.Count
            })
    }

    $result = [pscustomobject]@{
        source     = $pptx
        slideCount = $presentation.Slides.Count
        width      = $presentation.PageSetup.SlideWidth
        height     = $presentation.PageSetup.SlideHeight
        slides     = @($slides)
    }

    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outDir 'deck-content.json') -Encoding utf8
}
finally {
    if ($presentation) { $presentation.Close() }
    $app.Quit()
    if ($presentation) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app)
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
