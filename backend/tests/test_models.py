"""
Tests for Pydantic models, schemas, and data classes used across the project.
"""

import sys
import os
import uuid
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import (
    Project,
    ChatSession,
    DataIngestionRequest,
    CreateProjectRequest,
    SQLVariable,
    ValidateSQLRequest,
    GraphConfig,
    GraphLayout,
    DeleteWidgetRequest,
    ProjectDashboardLayout,
    ChatRequest,
    ExecuteCanvasQueryRequest,
)


# ────────────────────────── Project model ──────────────────────────────────

class TestProjectModel:
    def test_create_project(self):
        p = Project(name="My Project")
        assert p.name == "My Project"
        assert p.id is None  # Auto-generated on DB insert
        assert isinstance(p.created_at, datetime)

    def test_project_with_explicit_id(self):
        p = Project(id=42, name="Test")
        assert p.id == 42


# ────────────────────────── ChatSession model ─────────────────────────────

class TestChatSessionModel:
    def test_default_name(self):
        cs = ChatSession(id="abc-123", project_id=1)
        assert cs.name == "New Chat"
        assert isinstance(cs.created_at, datetime)
        assert isinstance(cs.last_message_time, datetime)

    def test_custom_name(self):
        cs = ChatSession(id="abc-456", project_id=1, name="Revenue Analysis")
        assert cs.name == "Revenue Analysis"


# ────────────────────────── Request / Response models ─────────────────────

class TestRequestModels:
    def test_data_ingestion_request(self):
        req = DataIngestionRequest(file_path="C:\\data\\test.csv")
        assert req.file_path == "C:\\data\\test.csv"

    def test_create_project_request(self):
        req = CreateProjectRequest(project_name="New Proj")
        assert req.project_name == "New Proj"

    def test_sql_variable(self):
        v = SQLVariable(name="start_date", default="2025-01-01", type="DATE")
        assert v.name == "start_date"
        assert v.description is None

    def test_sql_variable_with_description(self):
        v = SQLVariable(name="limit", default="100", type="INTEGER", description="Row limit")
        assert v.description == "Row limit"

    def test_validate_sql_request_no_vars(self):
        req = ValidateSQLRequest(query_str="SELECT 1")
        assert req.variables is None

    def test_validate_sql_request_with_vars(self):
        var = SQLVariable(name="x", default="5", type="INTEGER")
        req = ValidateSQLRequest(query_str="SELECT $x", variables=[var])
        assert len(req.variables) == 1

    def test_chat_request(self):
        req = ChatRequest(thread_id="abc", message="What is the average?")
        assert req.thread_id == "abc"

    def test_execute_canvas_query_request(self):
        req = ExecuteCanvasQueryRequest(
            sql_query="SELECT * FROM sales",
            sql_params=[{"name": "limit", "default": "10"}],
        )
        assert req.sql_query == "SELECT * FROM sales"
        assert len(req.sql_params) == 1


# ────────────────────────── Graph models ──────────────────────────────────

class TestGraphModels:
    def test_graph_config(self):
        gc = GraphConfig(
            x_axis="product",
            y_axis="revenue",
            agg_type="SUM",
            is_raw_data=False,
            is_sampled=False,
        )
        assert gc.agg_type == "SUM"

    def test_graph_layout_auto_id(self):
        gl = GraphLayout(
            title="Revenue",
            graph_type="bar",
            base_sql="SELECT * FROM t",
            config=GraphConfig(
                x_axis="a", y_axis="b", agg_type="COUNT",
                is_raw_data=False, is_sampled=False,
            ),
        )
        assert gl.id  # UUID string should be auto-generated
        assert gl.title == "Revenue"

    def test_graph_layout_with_explicit_id(self):
        gl = GraphLayout(
            id="custom-id-123",
            title="T",
            graph_type="pie",
            base_sql="SELECT 1",
            config=GraphConfig(
                x_axis="a", y_axis="b", agg_type="NONE",
                is_raw_data=True, is_sampled=False,
            ),
        )
        assert gl.id == "custom-id-123"

    def test_delete_widget_request(self):
        req = DeleteWidgetRequest(widget_id="w-1")
        assert req.widget_id == "w-1"


# ────────────────────────── Dashboard layout ──────────────────────────────

class TestDashboardLayout:
    def test_empty_layout(self):
        layout = ProjectDashboardLayout(project_name="P")
        assert layout.widgets is None

    def test_layout_with_widgets(self):
        gl = GraphLayout(
            title="T",
            graph_type="line",
            base_sql="SELECT 1",
            config=GraphConfig(
                x_axis="x", y_axis="y", agg_type="AVG",
                is_raw_data=False, is_sampled=False,
            ),
        )
        layout = ProjectDashboardLayout(project_name="P", widgets=[gl])
        assert len(layout.widgets) == 1

    def test_layout_serialization(self):
        layout = ProjectDashboardLayout(project_name="MyProj")
        d = layout.dict()
        assert d["project_name"] == "MyProj"
        assert d["widgets"] is None
