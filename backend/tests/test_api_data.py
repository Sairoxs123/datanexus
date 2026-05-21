"""
Tests for data ingestion, SQL execution, and table browsing API endpoints.
"""

import csv
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestProjectDashboard:
    def test_get_dashboard_tables(self, test_client):
        resp = test_client.get("/project/sql/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "tables" in data
        # We seeded a 'sales' table in conftest
        table_names = [t[0] if isinstance(t, list) else t for t in data["tables"]]
        assert "sales" in table_names

    def test_get_dashboard_layout(self, test_client):
        resp = test_client.get("/project/dashboard-layout")
        assert resp.status_code == 200
        data = resp.json()
        assert "project_name" in data
        assert "widgets" in data


class TestTableData:
    def test_get_table_data(self, test_client):
        resp = test_client.get("/sql/get-selected-table-data", params={"table_name": "sales"})
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert len(data["rows"]) == 5  # 5 rows in seed data

    def test_get_table_data_with_offset(self, test_client):
        resp = test_client.get(
            "/sql/get-selected-table-data",
            params={"table_name": "sales", "offset": 2, "limit": 2},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert len(data["rows"]) == 2

    def test_get_table_data_first_page_includes_count(self, test_client):
        resp = test_client.get(
            "/sql/get-selected-table-data",
            params={"table_name": "sales", "offset": 0},
        )
        data = resp.json()
        assert "row_count" in data
        # row_count is [[5]]
        assert data["row_count"][0][0] == 5


class TestExecuteSQL:
    def test_execute_valid_sql(self, test_client):
        resp = test_client.post(
            "/execute-sql",
            params={"query_str": "SELECT COUNT(*) as cnt FROM sales"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert data["results"][0]["cnt"] == 5

    def test_execute_invalid_sql(self, test_client):
        resp = test_client.post(
            "/execute-sql",
            params={"query_str": "SELECT * FROM nonexistent_table"},
        )
        # Should still return a response (error wrapped by DuckDB)
        assert resp.status_code == 500 or "error" in resp.text.lower()


class TestFetchQueryFormat:
    def test_valid_query_format(self, test_client):
        resp = test_client.post(
            "/fetch-query-format",
            json={"query_str": "SELECT id, product, amount FROM sales", "variables": None},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "valid"
        assert len(data["schema"]) == 3
        assert data["row_count"] == 5

    def test_query_format_column_types(self, test_client):
        resp = test_client.post(
            "/fetch-query-format",
            json={"query_str": "SELECT id, product, amount, sale_date FROM sales", "variables": None},
        )
        data = resp.json()
        schema = {col["name"]: col["type"] for col in data["schema"]}
        assert schema["id"] == "numeric"
        assert schema["product"] == "categorical"
        assert schema["amount"] == "numeric"
        assert schema["sale_date"] == "temporal"

    def test_invalid_query_format(self, test_client):
        resp = test_client.post(
            "/fetch-query-format",
            json={"query_str": "SELECT * FROM ghost_table", "variables": None},
        )
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_query_format_with_variables(self, test_client):
        resp = test_client.post(
            "/fetch-query-format",
            json={
                "query_str": "SELECT * FROM sales WHERE amount > $min_amount",
                "variables": [
                    {"name": "min_amount", "default": "30", "type": "DOUBLE"},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "valid"
        # Only Widget B (2 rows) and Gadget C (1 row) have amount > 30
        assert data["row_count"] == 3


class TestDataIngestion:
    def test_ingest_csv(self, test_client, tmp_dir):
        csv_path = os.path.join(tmp_dir, "test_data.csv")
        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "score"])
            writer.writerow(["Alice", "95"])
            writer.writerow(["Bob", "87"])

        resp = test_client.post("/ingest-data", json={"file_path": csv_path})
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "test_data" in data["message"]

    def test_ingest_unsupported_format(self, test_client):
        resp = test_client.post("/ingest-data", json={"file_path": "C:\\data\\file.xlsx"})
        assert resp.status_code == 200
        data = resp.json()
        assert "error" in data
        assert "unsupported" in data["error"].lower()
