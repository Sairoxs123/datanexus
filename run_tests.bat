@echo off
REM ============================================
REM  DataNexus Backend Test Suite Runner
REM  Usage: run_tests.bat [pytest-args]
REM  Examples:
REM    run_tests.bat                  -- run all tests
REM    run_tests.bat -k "test_router" -- run specific tests
REM    run_tests.bat --tb=long        -- verbose tracebacks
REM    run_tests.bat -x               -- stop on first failure
REM ============================================

echo.
echo  ====================================
echo   DataNexus Backend Test Suite
echo  ====================================
echo.

cd /d "%~dp0backend"

REM Use the venv Python if it exists, else fall back to system Python
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -m pytest %*
) else (
    python -m pytest %*
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  [PASS] All tests passed!
    echo.
) else (
    echo.
    echo  [FAIL] Some tests failed. See output above.
    echo.
)

pause
