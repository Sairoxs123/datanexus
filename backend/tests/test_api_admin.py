"""
Tests for the /admin database browser routes (HTML + JSON API).

NOTE: These tests exercise the admin module's raw SQL interface, which is
distinct from the main project API. Admin routes use raw SQL via SQLAlchemy's
text() and don't go through SQLModel defaults, so we must supply all required
fields (like `created_at`) explicitly in inserts.
"""

import json
import os
import sys
from datetime import datetime

import pytest
from sqlmodel import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import Project


class TestAdminDashboard:
    def test_admin_dashboard_page(self, test_client):
        resp = test_client.get("/admin/")
        assert resp.status_code == 200
        assert "DataNexus Admin" in resp.text

    def test_admin_dashboard_shows_tables(self, test_client):
        resp = test_client.get("/admin/")
        assert resp.status_code == 200
        assert "project" in resp.text.lower() or "Dashboard" in resp.text


class TestAdminTableView:
    def test_view_project_table_exists(self, test_client):
        """The project table should be browsable even when empty."""
        resp = test_client.get("/admin/table/project")
        assert resp.status_code == 200
        assert "project" in resp.text.lower()

    def test_view_project_table_with_data(self, test_client):
        """After creating a project through the main API, it appears in admin."""
        test_client.post("/create-new-project", json={"project_name": "AdminViewTest"})
        resp = test_client.get("/admin/table/project")
        assert resp.status_code == 200
        assert "AdminViewTest" in resp.text

    def test_view_table_with_pagination(self, test_client):
        for i in range(15):
            test_client.post("/create-new-project", json={"project_name": f"PagProj_{i}"})

        resp = test_client.get("/admin/table/project?page=1&per_page=10")
        assert resp.status_code == 200
        assert "Page 1" in resp.text

    def test_view_table_with_search(self, test_client):
        test_client.post("/create-new-project", json={"project_name": "SearchableProject"})
        resp = test_client.get("/admin/table/project?search=Searchable")
        assert resp.status_code == 200
        assert "SearchableProject" in resp.text

    def test_view_nonexistent_table(self, test_client):
        resp = test_client.get("/admin/table/ghost_table")
        assert resp.status_code == 404


class TestAdminCRUDAPI:
    def test_create_row_with_all_fields(self, test_client):
        """Admin raw insert must include all non-nullable fields."""
        now = datetime.now().isoformat()
        resp = test_client.post(
            "/admin/api/table/project",
            json={"name": "AdminCreated", "created_at": now},
        )
        assert resp.status_code == 200
        assert "created" in resp.json()["message"].lower()

    def test_create_row_missing_required_field(self, test_client):
        """Insert without `created_at` should fail (NOT NULL constraint)."""
        resp = test_client.post(
            "/admin/api/table/project",
            json={"name": "MissingTimestamp"},
        )
        # Should be a 500 due to the integrity error
        assert resp.status_code == 500 or resp.status_code == 400

    def test_create_row_empty_body(self, test_client):
        resp = test_client.post("/admin/api/table/project", json={})
        assert resp.status_code == 400

    def test_update_row(self, test_client):
        # Create via main API (has created_at default)
        test_client.post("/create-new-project", json={"project_name": "ToUpdate"})
        resp = test_client.get("/")
        projects = [json.loads(p) for p in resp.json()["projects"]]
        pid = [p["id"] for p in projects if p["name"] == "ToUpdate"][0]

        resp = test_client.put(
            f"/admin/api/table/project/{pid}",
            json={"name": "Updated Name"},
        )
        assert resp.status_code == 200

    def test_delete_row(self, test_client):
        test_client.post("/create-new-project", json={"project_name": "ToDelete"})
        resp = test_client.get("/")
        projects = [json.loads(p) for p in resp.json()["projects"]]
        pid = [p["id"] for p in projects if p["name"] == "ToDelete"][0]

        resp = test_client.delete(f"/admin/api/table/project/{pid}")
        assert resp.status_code == 200

    def test_delete_nonexistent_row(self, test_client):
        resp = test_client.delete("/admin/api/table/project/99999")
        assert resp.status_code == 404

    def test_row_detail_page(self, test_client):
        test_client.post("/create-new-project", json={"project_name": "DetailProject"})
        resp = test_client.get("/")
        projects = [json.loads(p) for p in resp.json()["projects"]]
        pid = [p["id"] for p in projects if p["name"] == "DetailProject"][0]

        resp = test_client.get(f"/admin/table/project/{pid}")
        assert resp.status_code == 200
        assert "DetailProject" in resp.text

    def test_new_row_form(self, test_client):
        resp = test_client.get("/admin/table/project/new")
        assert resp.status_code == 200
        assert "New" in resp.text
