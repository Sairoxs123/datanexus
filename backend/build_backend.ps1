# build_backend.ps1
# Builds the FastAPI backend into a standalone .exe and copies it
# to the Tauri sidecar location for bundling.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = $ScriptDir
$ProjectRoot = Split-Path -Parent $BackendDir
$TauriBinDir = Join-Path (Join-Path $ProjectRoot "src-tauri") "bin"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DataNexus Backend Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Activate venv
$VenvActivate = Join-Path $BackendDir "venv\Scripts\Activate.ps1"
if (-Not (Test-Path $VenvActivate)) {
    Write-Host "[ERROR] Virtual environment not found at: $VenvActivate" -ForegroundColor Red
    exit 1
}
Write-Host "[1/4] Activating virtual environment..." -ForegroundColor Yellow
& $VenvActivate

# Step 2: Ensure PyInstaller is installed
Write-Host "[2/4] Checking PyInstaller installation..." -ForegroundColor Yellow
$PyInstallerCheck = pip show pyinstaller 2>$null
if (-Not $PyInstallerCheck) {
    Write-Host "  -> PyInstaller not found. Installing..." -ForegroundColor Yellow
    pip install pyinstaller
} else {
    Write-Host "  -> PyInstaller is installed." -ForegroundColor Green
}

# Step 3: Run PyInstaller
Write-Host "[3/4] Building backend.exe with PyInstaller..." -ForegroundColor Yellow
Write-Host "  -> This may take several minutes..." -ForegroundColor DarkGray
Push-Location $BackendDir
try {
    pyinstaller main.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] PyInstaller build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

# Step 4: Copy to Tauri sidecar directory
$SourceExe = Join-Path $BackendDir "dist\backend.exe"
if (-Not (Test-Path $SourceExe)) {
    Write-Host "[ERROR] Build output not found at: $SourceExe" -ForegroundColor Red
    exit 1
}

Write-Host "[4/4] Copying to Tauri sidecar directory..." -ForegroundColor Yellow

# Create bin directory if it doesn't exist
if (-Not (Test-Path $TauriBinDir)) {
    New-Item -ItemType Directory -Path $TauriBinDir -Force | Out-Null
}

# Tauri expects the sidecar named with the platform triple
$TargetExe = Join-Path $TauriBinDir "backend-x86_64-pc-windows-msvc.exe"
Copy-Item -Path $SourceExe -Destination $TargetExe -Force

$SizeMB = [math]::Round((Get-Item $TargetExe).Length / 1MB, 1)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output: $TargetExe" -ForegroundColor White
Write-Host "  Size:   $SizeMB MB" -ForegroundColor White
Write-Host ""
Write-Host "  Next step: Run 'pnpm tauri build' to create the MSI installer." -ForegroundColor Cyan
Write-Host ""
