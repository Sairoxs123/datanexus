"""
Shared fixtures for the DataNexus test suite.

Provides:
- Isolated test database (SQLite + DuckDB)
- FastAPI TestClient with mocked AI agent
- ProjectDataHandler instances in a temp directory
- Clean state between tests
"""

import json
import os
import shutil
import sys
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import duckdb
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

# ---------------------------------------------------------------------------
# Make sure `backend/` is on sys.path so imports work like they do at runtime
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


# ────────────────────────── Database fixtures ──────────────────────────────

@pytest.fixture()
def tmp_dir():
    """Provide a fresh temp directory, cleaned up after each test."""
    d = tempfile.mkdtemp(prefix="datanexus_test_")
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture()
def sqlite_engine(tmp_dir):
    """In-memory (file-backed in tmp) SQLite engine for SQLModel tables."""
    db_path = os.path.join(tmp_dir, "test.db")
    url = f"sqlite:///{db_path}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def sqlite_session(sqlite_engine):
    """A SQLModel Session bound to the test engine."""
    with Session(sqlite_engine) as session:
        yield session


@pytest.fixture()
def duckdb_conn(tmp_dir):
    """A fresh DuckDB connection with a sample table for query tests."""
    db_path = os.path.join(tmp_dir, "project.duckdb")
    conn = duckdb.connect(db_path)
    # Seed with a small sample table
    conn.execute("""
        CREATE TABLE sales (
            id INTEGER,
            product VARCHAR,
            amount DOUBLE,
            quantity INTEGER,
            sale_date DATE
        )
    """)
    conn.execute("""
        INSERT INTO sales VALUES
        (1, 'Widget A', 29.99, 10, '2025-01-15'),
        (2, 'Widget B', 49.99, 5,  '2025-02-20'),
        (3, 'Widget A', 29.99, 3,  '2025-03-10'),
        (4, 'Gadget C', 99.99, 1,  '2025-03-15'),
        (5, 'Widget B', 49.99, 8,  '2025-04-01')
    """)
    yield conn
    conn.close()


# ────────────────────────── App / Client fixtures ──────────────────────────

def _mock_agent():
    """Return a mock that satisfies get_agent() without starting Ollama."""
    agent = MagicMock()
    agent.astream_events = AsyncMock(return_value=iter([]))
    agent.aget_state = AsyncMock(return_value=MagicMock(values={"messages": []}))
    agent.delete_state = MagicMock()
    return agent


@pytest.fixture()
def test_client(tmp_dir, sqlite_engine, duckdb_conn):
    """
    A FastAPI TestClient with:
    - Isolated SQLite DB for metadata
    - Isolated DuckDB for project data
    - Mocked AI agent (no Ollama required)
    """
    # Patch the config path so we write to tmp
    config_path = os.path.join(tmp_dir, "app_config.json")
    projects_dir = os.path.join(tmp_dir, "projects")
    os.makedirs(projects_dir, exist_ok=True)

    # Save a reference to the real admin.init before patching
    import admin as admin_mod
    real_admin_init = admin_mod.init

    with (
        patch("main.engine", sqlite_engine),
        patch("main.DEFAULT_CONFIG_PATH", config_path),
        patch("main.init_agent", new_callable=AsyncMock),
        patch("main.close_agent", new_callable=AsyncMock),
        patch("main.get_agent", return_value=_mock_agent()),
        patch("admin.init"),  # Prevent main.py module-level call with prod engine
    ):
        # Re-import to pick up patches
        import importlib
        import main as main_mod

        # Override engine + session dependency
        main_mod.engine = sqlite_engine
        SQLModel.metadata.create_all(sqlite_engine)

        def override_session():
            with Session(sqlite_engine) as session:
                yield session

        main_mod.app.dependency_overrides[main_mod.get_session] = override_session

        # Set up admin with the REAL init function and test engine
        real_admin_init(sqlite_engine)

        # Inject DuckDB conn + project handler
        main_mod.conn = duckdb_conn
        main_mod.selected_project = "TestProject"

        from main import ProjectDataHandler
        handler = ProjectDataHandler(project_name="TestProject")
        handler.file_path = os.path.join(tmp_dir, "dashboard_layout.json")
        os.makedirs(os.path.dirname(handler.file_path), exist_ok=True)
        handler.create_new_project_file()
        main_mod.project_data_handler = handler

        client = TestClient(main_mod.app, raise_server_exceptions=False)
        yield client

        # Cleanup overrides
        main_mod.app.dependency_overrides.clear()


# ────────────────────── Helpers for tests ──────────────────────────────────

@pytest.fixture()
def project_data_handler(tmp_dir):
    """A ProjectDataHandler writing to a temp directory."""
    from main import ProjectDataHandler, ProjectDashboardLayout

    handler = ProjectDataHandler(project_name="TestProject")
    handler.file_path = os.path.join(tmp_dir, "dashboard_layout.json")
    handler.folder_path = tmp_dir
    # Write the initial layout JSON directly to avoid the `projects/` prefix
    # in create_new_project_file which breaks with absolute temp paths.
    layout = ProjectDashboardLayout(project_name="TestProject")
    with open(handler.file_path, "w") as f:
        json.dump(layout.dict(), f, indent=4)
    return handler


@pytest.fixture()
def sample_graph_layout():
    """Return a dict representing a valid GraphLayout for API requests."""
    return {
        "id": "test-widget-001",
        "title": "Sales by Product",
        "graph_type": "bar",
        "base_sql": "SELECT * FROM sales",
        "config": {
            "x_axis": "product",
            "y_axis": "amount",
            "agg_type": "SUM",
            "is_raw_data": False,
            "is_sampled": False,
            "variables": None,
        },
    }
