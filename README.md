# DataNexus

DataNexus is a Windows desktop analytics app for working with local datasets. It combines a Tauri + React frontend with a FastAPI backend, DuckDB project databases, SQLite metadata storage, and an Ollama-powered AI assistant for exploring data with natural language.

The app can create projects, import CSV/JSON/Parquet files, inspect tables, run SQL, build chart widgets, and use a local LLM to generate analysis and SQL-backed data canvases.

## Windows Installer

If you only want to use the app, download the MSI from the GitHub release page and run it:

```text
datanexus_0.1.0_x64_en-US.msi
```

The app still requires Ollama and the `gemma3:4b` model to be installed locally before the AI assistant will work.

## Requirements

- Windows 10/11
- Ollama with the `gemma3:4b` model
- Node.js 20.19+ or 22.12+
- pnpm
- Python 3.11+ recommended
- Rust stable with the MSVC toolchain
- Visual Studio 2022 Build Tools with C++ build tools
- WebView2 Runtime, usually already present on modern Windows

## Ollama Setup

Install Ollama for Windows, then pull the model used by DataNexus:

```powershell
ollama pull gemma3:4b
```

Make sure Ollama is running before starting DataNexus:

```powershell
ollama serve
```

The backend uses `gemma3:4b` in [backend/ai_agent/utils/models.py](backend/ai_agent/utils/models.py). If you change the model there, every developer and user must pull the same replacement model.

## Project Structure

```text
backend/              FastAPI API, DuckDB/SQLite storage, LangGraph AI agent
backend/tests/        Pytest backend test suite
src/                  React + TypeScript frontend
src-tauri/            Tauri desktop shell and Windows bundle config
src-tauri/bin/        Generated backend sidecar location, ignored by git
run_tests.ps1         Windows PowerShell test runner
run_tests.bat         Windows batch test runner
```

## Data Storage

In development, backend data is written relative to the backend working directory.

In the packaged Windows app, runtime data is stored under:

```text
%APPDATA%\datanexus
```

Important generated files include:

- `database.db` for app metadata and projects
- `agent_checkpoint.db` for AI chat checkpoints
- `projects/<project_name>/project.duckdb` for imported project data
- `projects/<project_name>/dashboard_layout.json` for saved chart widgets
- `logs/backend.log` for backend logs

These files are local runtime data and should not be committed.

## Install Dependencies

Install frontend/Tauri dependencies:

```powershell
pnpm install
```

Create and populate the backend virtual environment:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

The backend requirements include a spaCy model downloaded from GitHub, so dependency installation needs internet access.

## Run in Development

Start the desktop app:

```powershell
pnpm run dev
```

In Tauri development mode, the Rust shell starts the backend with:

```powershell
cd backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload
```

The frontend runs on `http://localhost:1420`, and the API listens on `http://localhost:8000`.

You can also run the frontend and backend separately:

```powershell
pnpm run dev:frontend
pnpm run dev:backend
```

## Run Tests

The backend test suite uses pytest and mocks the AI agent, so the core tests do not need to call Ollama.

Run all backend tests with the PowerShell helper:

```powershell
.\run_tests.ps1
```

Pass pytest arguments through the helper:

```powershell
.\run_tests.ps1 -k "chat"
.\run_tests.ps1 -x
.\run_tests.ps1 --tb=long
```

Or use the npm scripts:

```powershell
pnpm test
pnpm run test:backend
pnpm run test:quick
```

From inside `backend/`, the direct command is:

```powershell
.\venv\Scripts\python.exe -m pytest
```

## Build the App

Build the React frontend only:

```powershell
pnpm run build
```

Build the Python backend into the Tauri sidecar:

```powershell
pnpm run build:backend
```

This runs [backend/build_backend.ps1](backend/build_backend.ps1), creates `backend/dist/backend.exe`, and copies it to:

```text
src-tauri/bin/backend-x86_64-pc-windows-msvc.exe
```

Build the full Windows desktop app and installer:

```powershell
pnpm run build:all
```

The MSI installer is generated at:

```text
src-tauri/target/release/bundle/msi/datanexus_0.1.0_x64_en-US.msi
```

Upload that MSI to the GitHub release. Do not commit generated build outputs such as `dist/`, `backend/dist/`, `backend/build/`, `src-tauri/bin/`, or `src-tauri/target/`.

## Main Scripts

```text
pnpm run dev            Start Tauri development app
pnpm run dev:frontend   Start Vite only
pnpm run dev:backend    Start FastAPI backend only
pnpm run build          Type-check and build frontend
pnpm run build:backend  Build Python backend sidecar with PyInstaller
pnpm run build:all      Build backend sidecar and Tauri installer
pnpm test               Run backend pytest suite
pnpm run test:backend   Run backend tests with verbose output
pnpm run test:quick     Stop backend tests on first failure
```

## Supported Data Files

DataNexus can ingest:

- CSV
- JSON
- Parquet

Each imported file is loaded into the active project's DuckDB database as a table. File names are converted into SQL-safe table names by replacing spaces, hyphens, and dots with underscores.

## AI Assistant Notes

The AI assistant is fully local through Ollama. It uses LangGraph and LangChain Ollama to:

- route user requests
- plan analysis steps
- generate SQL
- execute SQL against the active DuckDB project
- stream analysis back to the frontend
- render data canvases that can become dashboard charts

Chat history is stored locally in `agent_checkpoint.db`.

## Troubleshooting

If the AI assistant does not respond, confirm Ollama is running and the model is available:

```powershell
ollama list
ollama pull gemma3:4b
```

If `pnpm run dev` opens the app but data calls fail, check that the backend is listening on `http://localhost:8000`.

If `pnpm run build:backend` fails, confirm `backend/venv` exists and has all requirements installed.

If the Tauri build fails on Windows, confirm Rust is installed with the MSVC toolchain and Visual Studio C++ Build Tools are available.
