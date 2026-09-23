#Requires -Version 5.1
<#
.SYNOPSIS
  Build Fun-Walk coursework as Word (.docx) via Pandoc.
.USAGE
  cd coursework
  .\build.ps1
#>

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$BuildDir = Join-Path $PSScriptRoot "build"
$OutDocx  = Join-Path $BuildDir "fun-walk-coursework.docx"
$FlatTex  = Join-Path $BuildDir "flat.tex"

function Resolve-Pandoc {
    $cmd = Get-Command pandoc -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Pandoc\pandoc.exe"),
        (Join-Path ${env:ProgramFiles} "Pandoc\pandoc.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Pandoc\pandoc.exe")
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }

    return $null
}

$Pandoc = Resolve-Pandoc

function Write-Step([string]$Message, [string]$Color = "White") {
    Write-Host $Message -ForegroundColor $Color
}

function Expand-LatexInputs {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$BaseDir
    )

    $fullPath = Join-Path $BaseDir $RelativePath
    if (-not (Test-Path $fullPath)) {
        if (-not $RelativePath.EndsWith(".tex")) {
            $fullPath = Join-Path $BaseDir ($RelativePath + ".tex")
        }
        if (-not (Test-Path $fullPath)) {
            throw "Input file not found: $RelativePath"
        }
    }

    $content = Get-Content -LiteralPath $fullPath -Raw -Encoding UTF8
    $pattern = '\\input\{([^}]+)\}'

    while ($content -match $pattern) {
        $content = [regex]::Replace($content, $pattern, {
            param($match)
            $subPath = $match.Groups[1].Value.Trim()
            Expand-LatexInputs -RelativePath $subPath -BaseDir $BaseDir
        })
    }

    return $content
}

function Prepare-PandocTex {
    param([Parameter(Mandatory = $true)][string]$Content)

    $Content = $Content -replace '\\usepackage\{gost\}\s*', ''
    $Content = $Content -replace '\\addbibresource\{[^}]+\}\s*', ''
    $Content = $Content -replace '\\printbibliography[^\n]*\n', ''
    $Content = $Content -replace '\\usepackage(\[[^\]]*\])?\{fontspec\}\s*', ''
    $Content = $Content -replace '\\usepackage(\[[^\]]*\])?\{polyglossia\}\s*', ''
    $Content = $Content -replace '\\setmainfont\{[^}]+\}(\[[^\]]*\])?\s*', ''
    $Content = $Content -replace '\\setsansfont\{[^}]+\}\s*', ''
    $Content = $Content -replace '\\setmonofont\{[^}]+\}(\[[^\]]*\])?\s*', ''
    $Content = $Content -replace '\\setdefaultlanguage\{[^}]+\}\s*', ''
    $Content = $Content -replace '\\setotherlanguage\{[^}]+\}\s*', ''
    $Content = $Content -replace '\\usepackage(\[[^\]]*\])?\{biblatex\}\s*', ''

    return $Content
}

Write-Step "========================================" "Cyan"
Write-Step " Fun-Walk: build coursework (DOCX only)" "Cyan"
Write-Step "========================================" "Cyan"
Write-Host ""

if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

if (-not $Pandoc) {
    Write-Step "[ERROR] pandoc not found." "Red"
    Write-Step "        Install: winget install JohnMacFarlane.Pandoc" "Yellow"
    Write-Step "        Then restart the terminal (or log out/in)." "Yellow"
    exit 1
}

Write-Step "[1/2] Flattening LaTeX inputs..." "Yellow"

try {
    if (Get-Command latexpand -ErrorAction SilentlyContinue) {
        $flat = & latexpand main.tex --encoding=utf8 | Out-String
        $flat = Prepare-PandocTex -Content $flat
        $flat | Out-File -LiteralPath $FlatTex -Encoding utf8
    } else {
        $flat = Expand-LatexInputs -RelativePath "main.tex" -BaseDir $PSScriptRoot
        $flat = Prepare-PandocTex -Content $flat
        $flat | Out-File -LiteralPath $FlatTex -Encoding utf8
    }
    Write-Step "[OK] flat.tex ready" "Green"
} catch {
    Write-Step "[ERROR] Failed to flatten main.tex: $($_.Exception.Message)" "Red"
    exit 1
}

Write-Step "[2/2] Building DOCX (Pandoc)..." "Yellow"

$pandocArgs = @(
    $FlatTex,
    "-o", $OutDocx,
    "--from=latex",
    "--resource-path=.;chapters;appendices",
    "--bibliography=bibliography.bib",
    "--citeproc",
    "--metadata", "lang=ru-RU",
    "--metadata", "title=Fun-Walk - coursework"
)

& $Pandoc @pandocArgs
if ($LASTEXITCODE -ne 0) {
    Write-Step "[ERROR] pandoc failed with exit code $LASTEXITCODE" "Red"
    exit $LASTEXITCODE
}

if (-not (Test-Path $OutDocx)) {
    Write-Step "[ERROR] DOCX was not created." "Red"
    exit 1
}

Write-Step "[OK] DOCX: $OutDocx" "Green"
Write-Host ""
Write-Step "Done." "Cyan"
