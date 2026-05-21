"""
Tests for graph/chart layout and execution endpoints.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestSaveGraphLayout:
    def test_save_graph_layout(self, test_client, sample_graph_layout):
        resp = test_client.post("/save-graph-layout", json=sample_graph_layout)
        assert resp.status_code == 200
        assert "saved" in resp.json()["message"].lower()

    def test_saved_layout_appears_in_dashboard(self, test_client, sample_graph_layout):
        test_client.post("/save-graph-layout", json=sample_graph_layout)

        resp = test_client.get("/project/dashboard-layout")
        data = resp.json()
        assert data["widgets"] is not None
        assert len(data["widgets"]) >= 1
        widget_ids = [w["id"] for w in data["widgets"]]
        assert sample_graph_layout["id"] in widget_ids


class TestExecuteChartSQL:
    def test_execute_bar_chart_sql(self, test_client, sample_graph_layout):
        resp = test_client.post("/execute-chart-sql", json=sample_graph_layout)
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) > 0
        # Each result should have x_value and y_value
        assert "x_value" in data["results"][0]
        assert "y_value" in data["results"][0]

    def test_execute_pie_chart_sql(self, test_client, sample_graph_layout):
        sample_graph_layout["graph_type"] = "pie"
        sample_graph_layout["config"]["agg_type"] = "COUNT"
        resp = test_client.post("/execute-chart-sql", json=sample_graph_layout)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) > 0

    def test_execute_chart_no_aggregation(self, test_client, sample_graph_layout):
        sample_graph_layout["config"]["agg_type"] = "NONE"
        resp = test_client.post("/execute-chart-sql", json=sample_graph_layout)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) > 0

    def test_execute_chart_with_variables(self, test_client, sample_graph_layout):
        sample_graph_layout["config"]["variables"] = [
            {"name": "min_amount", "default": "30", "type": "DOUBLE", "description": None},
        ]
        sample_graph_layout["base_sql"] = "SELECT * FROM sales WHERE amount > $min_amount"
        resp = test_client.post("/execute-chart-sql", json=sample_graph_layout)
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data


class TestDeleteGraphWidget:
    def test_delete_widget(self, test_client, sample_graph_layout):
        # Save first
        test_client.post("/save-graph-layout", json=sample_graph_layout)

        # Delete
        resp = test_client.post(
            "/delete-graph-widget",
            json={"widget_id": sample_graph_layout["id"]},
        )
        assert resp.status_code == 200

        # Verify removed
        layout_resp = test_client.get("/project/dashboard-layout")
        widgets = layout_resp.json().get("widgets") or []
        widget_ids = [w["id"] for w in widgets]
        assert sample_graph_layout["id"] not in widget_ids
