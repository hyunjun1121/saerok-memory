param(
    [Parameter(Mandatory = $true)]
    [string]$InputDirectory
)

$resolvedDirectory = (Resolve-Path -LiteralPath $InputDirectory).Path
$hwp = New-Object -ComObject HWPFrame.HwpObject

try {
    $null = $hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule')
    try {
        $hwp.XHwpWindows.Item(0).Visible = $false
    }
    catch {
        # Headless conversion remains available when no window collection is exposed.
    }

    Get-ChildItem -LiteralPath $resolvedDirectory -Filter '*.hwpx' |
        Sort-Object Name |
        ForEach-Object {
            $inputPath = $_.FullName
            $hwpPath = [System.IO.Path]::ChangeExtension($inputPath, '.hwp')
            $pdfPath = [System.IO.Path]::ChangeExtension($inputPath, '.pdf')

            $opened = $hwp.Open($inputPath, 'HWPX', 'forceopen:true')
            if (-not $opened) {
                throw "한컴오피스에서 열지 못함: $inputPath"
            }

            $savedHwp = $hwp.SaveAs($hwpPath, 'HWP', 'lock:false')
            if (-not $savedHwp) {
                throw "HWP 변환 실패: $inputPath"
            }

            $savedPdf = $hwp.SaveAs($pdfPath, 'PDF', '')
            if (-not $savedPdf) {
                throw "PDF 변환 실패: $inputPath"
            }

            $hwp.Clear(1)
            [PSCustomObject]@{
                Source = $_.Name
                Hwp = [System.IO.Path]::GetFileName($hwpPath)
                Pdf = [System.IO.Path]::GetFileName($pdfPath)
            }
        }
}
finally {
    try { $hwp.Quit() } catch {}
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($hwp) | Out-Null
}
