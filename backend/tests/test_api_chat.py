"""
Tests for AI chat session endpoints.
"""

import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestChatSessions:
    def _ensure_project_exists(self, client):
        """
        Create a project named 'TestProject' so that create_ai_chat can look it up
        via the global `selected_project` variable (set to 'TestProject' in conftest).
        """
        client.post("/create-new-project", json={"project_name": "TestProject"})

    def test_get_chat_sessions_empty(self, test_client):
        resp = test_client.get("/get-chat-sessions")
        assert resp.status_code == 200

    def test_create_ai_chat(self, test_client):
        self._ensure_project_exists(test_client)

        with patch("main.synthesizer_llm") as mock_llm:
            mock_llm.ainvoke = AsyncMock(
                return_value=MagicMock(content="Test Title")
            )
            resp = test_client.post(
                "/create-ai-chat",
                params={"message": "What is the average sales amount?"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "thread_id" in data
        assert len(data["thread_id"]) > 0

    def test_get_chat_messages_empty_thread(self, test_client):
        resp = test_client.get("/get-chat-messages/nonexistent-thread")
        assert resp.status_code == 200

    def test_delete_chat_session(self, test_client):
        self._ensure_project_exists(test_client)

        # Create a chat first
        with patch("main.synthesizer_llm") as mock_llm:
            mock_llm.ainvoke = AsyncMock(
                return_value=MagicMock(content="Test Title")
            )
            create_resp = test_client.post(
                "/create-ai-chat",
                params={"message": "test message"},
            )
        thread_id = create_resp.json()["thread_id"]

        # Delete it
        resp = test_client.post(f"/delete-chat-session/{thread_id}")
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    def test_rename_chat_session(self, test_client):
        self._ensure_project_exists(test_client)

        # Create
        with patch("main.synthesizer_llm") as mock_llm:
            mock_llm.ainvoke = AsyncMock(
                return_value=MagicMock(content="Test Title")
            )
            create_resp = test_client.post(
                "/create-ai-chat",
                params={"message": "rename test"},
            )
        thread_id = create_resp.json()["thread_id"]

        # Rename
        resp = test_client.post(
            f"/rename-chat-session/{thread_id}",
            params={"new_name": "Renamed Chat"},
        )
        assert resp.status_code == 200
        assert "renamed" in resp.json()["message"].lower()

    def test_rename_nonexistent_session(self, test_client):
        resp = test_client.post(
            "/rename-chat-session/ghost-thread",
            params={"new_name": "Nobody"},
        )
        assert resp.status_code == 404


class TestExecuteCanvasQuery:
    def test_execute_canvas_query(self, test_client):
        resp = test_client.post(
            "/execute-canvas-query",
            json={
                "sql_query": "SELECT product, SUM(amount) as total FROM sales GROUP BY product",
                "sql_params": [],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) > 0

    def test_execute_canvas_query_with_params(self, test_client):
        resp = test_client.post(
            "/execute-canvas-query",
            json={
                "sql_query": "SELECT * FROM sales WHERE quantity > $min_qty",
                "sql_params": [{"name": "min_qty", "default": "4"}],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
