"""
Tests for ProjectDataHandler — JSON-based dashboard layout persistence.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import ProjectDataHandler, GraphLayout, GraphConfig, ProjectDashboardLayout


class TestProjectDataHandlerInit:
    def test_folder_path_replaces_spaces(self):
        handler = ProjectDataHandler(project_name="My Cool Project")
        assert handler.folder_path == "My_Cool_Project"

    def test_file_path_format(self):
        handler = ProjectDataHandler(project_name="Analytics")
        assert handler.file_path == "projects/Analytics/dashboard_layout.json"


class TestCreateNewProjectFile:
    def test_creates_file(self, tmp_dir):
        handler = ProjectDataHandler(project_name="Test")
        handler.file_path = os.path.join(tmp_dir, "layout.json")
        os.makedirs(os.path.dirname(handler.file_path), exist_ok=True)
        handler.create_new_project_file()

        assert os.path.exists(handler.file_path)
        with open(handler.file_path) as f:
            data = json.load(f)
        assert data["project_name"] == "Test"
        assert data["widgets"] is None

    def test_does_not_overwrite_existing(self, tmp_dir):
        handler = ProjectDataHandler(project_name="Test")
        handler.file_path = os.path.join(tmp_dir, "layout.json")
        os.makedirs(os.path.dirname(handler.file_path), exist_ok=True)

        # Write existing content
        with open(handler.file_path, "w") as f:
            json.dump({"project_name": "Test", "widgets": [{"id": "existing"}]}, f)

        handler.create_new_project_file()

        with open(handler.file_path) as f:
            data = json.load(f)
        # Should NOT overwrite — original data preserved
        assert data["widgets"] == [{"id": "existing"}]


class TestLoadLayout:
    def test_load_existing_layout(self, project_data_handler):
        layout = project_data_handler.load_layout()
        assert isinstance(layout, ProjectDashboardLayout)
        assert layout.project_name == "TestProject"

    def test_load_missing_file_returns_empty(self, tmp_dir):
        handler = ProjectDataHandler(project_name="MissingProject")
        handler.file_path = os.path.join(tmp_dir, "nonexistent.json")

        layout = handler.load_layout()
        assert layout.project_name == "MissingProject"
        assert layout.widgets is None


class TestSaveLayout:
    def _make_graph(self, widget_id="w-1", title="Widget 1"):
        return GraphLayout(
            id=widget_id,
            title=title,
            graph_type="bar",
            base_sql="SELECT * FROM t",
            config=GraphConfig(
                x_axis="x", y_axis="y", agg_type="SUM",
                is_raw_data=False, is_sampled=False,
            ),
        )

    def test_save_first_widget(self, project_data_handler):
        widget = self._make_graph()
        project_data_handler.save_layout(widget)

        layout = project_data_handler.load_layout()
        assert len(layout.widgets) == 1
        assert layout.widgets[0].id == "w-1"

    def test_save_multiple_widgets(self, project_data_handler):
        project_data_handler.save_layout(self._make_graph("w-1", "First"))
        project_data_handler.save_layout(self._make_graph("w-2", "Second"))

        layout = project_data_handler.load_layout()
        assert len(layout.widgets) == 2

    def test_save_overwrites_same_id(self, project_data_handler):
        project_data_handler.save_layout(self._make_graph("w-1", "Original"))
        project_data_handler.save_layout(self._make_graph("w-1", "Updated"))

        layout = project_data_handler.load_layout()
        assert len(layout.widgets) == 1
        assert layout.widgets[0].title == "Updated"


class TestDeleteWidget:
    def test_delete_existing_widget(self, project_data_handler):
        widget = GraphLayout(
            id="delete-me",
            title="To Delete",
            graph_type="pie",
            base_sql="SELECT 1",
            config=GraphConfig(
                x_axis="x", y_axis="y", agg_type="COUNT",
                is_raw_data=False, is_sampled=False,
            ),
        )
        project_data_handler.save_layout(widget)
        assert len(project_data_handler.load_layout().widgets) == 1

        project_data_handler.delete_widget("delete-me")
        assert len(project_data_handler.load_layout().widgets) == 0

    def test_delete_nonexistent_widget_is_noop(self, project_data_handler):
        widget = GraphLayout(
            id="keep-me",
            title="Keeper",
            graph_type="line",
            base_sql="SELECT 1",
            config=GraphConfig(
                x_axis="x", y_axis="y", agg_type="AVG",
                is_raw_data=False, is_sampled=False,
            ),
        )
        project_data_handler.save_layout(widget)

        project_data_handler.delete_widget("nonexistent-id")
        assert len(project_data_handler.load_layout().widgets) == 1
