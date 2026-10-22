# Pack dist-itch/ into frog-in-one-itch.zip for itch.io (npm run zip:itch).
# Compress-Archive in Windows PowerShell stores paths with backslashes
# (assets\index.js), which itch.io treats as file names rather than folders,
# so the page loads without its CSS and script. Writing the entries
# ourselves keeps them as assets/index.js.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$source = (Resolve-Path "dist-itch").Path
$zipPath = Join-Path (Get-Location) "frog-in-one-itch.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
try {
    Get-ChildItem $source -Recurse -File | ForEach-Object {
        $entry = $_.FullName.Substring($source.Length + 1).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry) | Out-Null
    }
} finally {
    $zip.Dispose()
}
Write-Host "Packed $zipPath"
