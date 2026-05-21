"""
Tests for project CRUD API endpoints.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestIndexEndpoint:
    def test_index_returns_projects(self, test_client):
        resp = test_client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "projects" in data

    def test_index_empty_initially(self, test_client):
        resp = test_client.get("/")
        # May be None or empty list
        data = resp.json()
        projects = data.get("projects")
        assert projects is None or len(projects) == 0


class TestCreateProject:
    def test_create_project_success(self, test_client):
        resp = test_client.post(
            "/create-new-project",
            json={"project_name": "Alpha Project"},
        )
        assert resp.status_code == 201
        assert "created" in resp.json()["message"].lower() or "Project" in resp.json().get("message", "")

    def test_create_duplicate_project(self, test_client):
        test_client.post("/create-new-project", json={"project_name": "DuplicateTest"})
        resp = test_client.post("/create-new-project", json={"project_name": "DuplicateTest"})
        assert resp.status_code == 409

    def test_create_project_appears_in_list(self, test_client):
        test_client.post("/create-new-project", json={"project_name": "ListTest"})
        resp = test_client.get("/")
        data = resp.json()
        assert data["projects"] is not None
        names = [json.loads(p)["name"] for p in data["projects"]]
        assert "ListTest" in names


class TestSelectProject:
    def test_select_valid_project(self, test_client):
        # Create a project first
        test_client.post("/create-new-project", json={"project_name": "SelectMe"})
        resp = test_client.get("/")
        projects = [json.loads(p) for p in resp.json()["projects"]]
        pid = projects[0]["id"]

        resp = test_client.post(f"/select-current-project/{pid}")
        assert resp.status_code == 200

    def test_select_invalid_project(self, test_client):
        resp = test_client.post("/select-current-project/99999")
        assert resp.status_code == 404
