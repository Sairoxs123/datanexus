# ============================================
#  DataNexus Backend Test Suite Runner
#  Usage: .\run_tests.ps1 [pytest-args]
#  Examples:
#    .\run_tests.ps1                  # run all tests
#    .\run_tests.ps1 -k "test_router" # run specific tests
#    .\run_tests.ps1 --tb=long        # verbose tracebacks
#    .\run_tests.ps1 -x               # stop on first failure
# ============================================

Write-Host ""
Write-Host "  ====================================" -ForegroundColor Cyan
Write-Host "   DataNexus Backend Test Suite" -ForegroundColor Cyan
Write-Host "  ====================================" -ForegroundColor Cyan
Write-Host ""

Push-Location "$PSScriptRoot\backend"

try {
    # Prefer the venv Python where project deps are installed
    $venvPython = "venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        & $venvPython -m pytest @args
    } else {
        python -m pytest @args
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  [PASS] All tests passed!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "  [FAIL] Some tests failed. See output above." -ForegroundColor Red
        Write-Host ""
    }
} finally {
    Pop-Location
}
