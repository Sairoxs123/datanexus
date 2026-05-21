"""
Tests for the AI agent nodes — router, planner, and state logic.
Tests the routing logic without requiring an actual LLM (Ollama).
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_agent.utils.nodes import router_node, VALID_NODES, _preview_text
from ai_agent.utils.state import AppState
from ai_agent.utils.schemas import ExecutionPlan, GeneratedQuery, SQLVariable


# ────────────────────────── _preview_text helper ──────────────────────────

class TestPreviewText:
    def test_short_text_unchanged(self):
        assert _preview_text("hello") == "hello"

    def test_long_text_truncated(self):
        long = "x" * 200
        result = _preview_text(long, max_len=50)
        assert len(result) == 50
        assert result.endswith("...")

    def test_none_value(self):
        assert _preview_text(None) == ""

    def test_exact_max_len(self):
        text = "a" * 160
        assert _preview_text(text, max_len=160) == text


# ────────────────────────── router_node ───────────────────────────────────

class TestRouterNode:
    def test_routes_to_next_plan_step(self):
        state = {
            "messages": [],
            "plan": ["sql_agent", "executor_tool", "synthesizer_node"],
            "errors": "",
        }
        result = router_node(state)
        assert result == "sql_agent"

    def test_routes_to_end_when_plan_empty(self):
        state = {"messages": [], "plan": [], "errors": ""}
        result = router_node(state)
        assert result == "__end__"

    def test_routes_to_end_when_plan_missing(self):
        state = {"messages": [], "errors": ""}
        result = router_node(state)
        assert result == "__end__"

    def test_routes_to_sql_agent_on_error(self):
        state = {
            "messages": [],
            "plan": ["synthesizer_node"],
            "errors": "Column not found",
        }
        result = router_node(state)
        assert result == "sql_agent"

    def test_routes_to_end_on_invalid_node(self):
        state = {
            "messages": [],
            "plan": ["<think>some leaked token"],
            "errors": "",
        }
        result = router_node(state)
        assert result == "__end__"

    def test_all_valid_nodes_accepted(self):
        for node in VALID_NODES:
            state = {"messages": [], "plan": [node], "errors": ""}
            result = router_node(state)
            assert result == node


# ────────────────────────── Schema models ─────────────────────────────────

class TestAgentSchemas:
    def test_execution_plan(self):
        plan = ExecutionPlan(plan=["sql_agent", "executor_tool", "synthesizer_node"])
        assert len(plan.plan) == 3

    def test_execution_plan_empty(self):
        plan = ExecutionPlan(plan=[])
        assert plan.plan == []

    def test_generated_query(self):
        query = GeneratedQuery(
            sql_query="SELECT * FROM sales WHERE amount > $min",
            sql_params=[
                SQLVariable(name="min", default="100", type="DOUBLE"),
            ],
        )
        assert query.sql_query.startswith("SELECT")
        assert len(query.sql_params) == 1
        assert query.sql_params[0].name == "min"

    def test_sql_variable(self):
        v = SQLVariable(name="start_date", default="2025-01-01", type="DATE", description="Start")
        assert v.name == "start_date"
        assert v.description == "Start"


# ────────────────────────── CanvasMessage ─────────────────────────────────

class TestCanvasMessage:
    def test_canvas_message_creation(self):
        from ai_agent.utils.messages import CanvasMessage

        msg = CanvasMessage(
            content={"columns": ["a", "b"], "rows": [{"a": 1, "b": 2}]},
            sql_data=GeneratedQuery(
                sql_query="SELECT a, b FROM t",
                sql_params=[],
            ),
        )
        assert msg.type == "canvas"
        assert msg.canvas_type == "table"
        assert msg.content["columns"] == ["a", "b"]

    def test_canvas_message_namespace(self):
        from ai_agent.utils.messages import CanvasMessage
        assert CanvasMessage.get_lc_namespace() == ["ai_agent", "utils", "messages"]
