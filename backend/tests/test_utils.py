"""
Tests for utility functions and helpers in main.py.
"""

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import (
    generate_chart_sql,
    save_active_project,
    load_active_project,
    _truncate_log_value,
    GraphLayout,
    GraphConfig,
    SQLVariable,
)


# ────────────────────────── _truncate_log_value ───────────────────────────

class TestTruncateLogValue:
    def test_short_string_unchanged(self):
        assert _truncate_log_value("hello") == "hello"

    def test_long_string_truncated(self):
        long_str = "x" * 2000
        result = _truncate_log_value(long_str, limit=100)
        assert len(result) < 2000
        assert "truncated" in result

    def test_dict_value(self):
        d = {"key": "value", "num": 42}
        result = _truncate_log_value(d)
        assert "key" in result
        assert "value" in result

    def test_exact_limit(self):
        text = "a" * 1200
        result = _truncate_log_value(text, limit=1200)
        assert result == text  # Not truncated


# ────────────────────────── generate_chart_sql ────────────────────────────

class TestGenerateChartSQL:
    def _make_layout(self, agg_type="SUM", graph_type="bar", x="product", y="amount"):
        return GraphLayout(
            id="test-id",
            title="Test",
            graph_type=graph_type,
            base_sql="SELECT * FROM sales",
            config=GraphConfig(
                x_axis=x, y_axis=y, agg_type=agg_type,
                is_raw_data=False, is_sampled=False,
            ),
        )

    def test_sum_aggregation(self):
        sql = generate_chart_sql(self._make_layout("SUM"))
        assert 'SUM("amount")' in sql
        assert "GROUP BY" in sql

    def test_count_aggregation(self):
        sql = generate_chart_sql(self._make_layout("COUNT"))
        assert 'COUNT("amount")' in sql

    def test_count_distinct_aggregation(self):
        sql = generate_chart_sql(self._make_layout("COUNT_DISTINCT"))
        assert 'COUNT(DISTINCT "amount")' in sql

    def test_avg_aggregation(self):
        sql = generate_chart_sql(self._make_layout("AVG"))
        assert 'AVG("amount")' in sql

    def test_min_aggregation(self):
        sql = generate_chart_sql(self._make_layout("MIN"))
        assert 'MIN("amount")' in sql

    def test_max_aggregation(self):
        sql = generate_chart_sql(self._make_layout("MAX"))
        assert 'MAX("amount")' in sql

    def test_none_aggregation_no_group_by(self):
        sql = generate_chart_sql(self._make_layout("NONE"))
        assert "GROUP BY" not in sql
        assert "LIMIT" in sql

    def test_order_by_in_aggregated_query(self):
        sql = generate_chart_sql(self._make_layout("SUM"))
        assert "ORDER BY y_value DESC" in sql

    def test_pie_chart_row_limit(self):
        sql = generate_chart_sql(self._make_layout("COUNT", graph_type="pie"))
        assert "LIMIT 20" in sql

    def test_bar_chart_row_limit(self):
        sql = generate_chart_sql(self._make_layout("COUNT", graph_type="bar"))
        assert "LIMIT 500" in sql

    def test_scatter_chart_row_limit(self):
        sql = generate_chart_sql(self._make_layout("NONE", graph_type="scatter"))
        assert "LIMIT 5000" in sql

    def test_line_chart_row_limit(self):
        sql = generate_chart_sql(self._make_layout("AVG", graph_type="line"))
        assert "LIMIT 5000" in sql

    def test_unknown_graph_type_default_limit(self):
        sql = generate_chart_sql(self._make_layout("SUM", graph_type="heatmap"))
        assert "LIMIT 500" in sql

    def test_sql_contains_base_query(self):
        sql = generate_chart_sql(self._make_layout("SUM"))
        assert "SELECT * FROM sales" in sql


# ────────────────────────── Active project persistence ────────────────────

class TestActiveProjectPersistence:
    def test_save_and_load(self, tmp_dir):
        config_path = os.path.join(tmp_dir, "config.json")

        # Patch the global config path for save/load
        import main
        original_path = main.DEFAULT_CONFIG_PATH
        main.DEFAULT_CONFIG_PATH = config_path

        try:
            save_active_project(42)
            result = load_active_project()
            assert result == 42
        finally:
            main.DEFAULT_CONFIG_PATH = original_path

    def test_load_missing_config_returns_none(self, tmp_dir):
        import main
        original_path = main.DEFAULT_CONFIG_PATH
        main.DEFAULT_CONFIG_PATH = os.path.join(tmp_dir, "nonexistent.json")

        try:
            result = load_active_project()
            assert result is None
        finally:
            main.DEFAULT_CONFIG_PATH = original_path

    def test_load_corrupt_config_returns_none(self, tmp_dir):
        config_path = os.path.join(tmp_dir, "corrupt.json")
        with open(config_path, "w") as f:
            f.write("{invalid json!!")

        import main
        original_path = main.DEFAULT_CONFIG_PATH
        main.DEFAULT_CONFIG_PATH = config_path

        try:
            result = load_active_project()
            assert result is None
        finally:
            main.DEFAULT_CONFIG_PATH = original_path


# ────────────────────────── Admin template rendering ──────────────────────

class TestAdminTemplateRendering:
    def test_render_dashboard_empty(self):
        from admin_templates import render_dashboard
        html = render_dashboard([])
        assert "No tables found" in html
        assert "DataNexus Admin" in html

    def test_render_dashboard_with_tables(self):
        from admin_templates import render_dashboard
        tables = [
            {"name": "users", "row_count": 100, "column_count": 5},
            {"name": "orders", "row_count": 50, "column_count": 3},
        ]
        html = render_dashboard(tables)
        assert "users" in html
        assert "orders" in html
        assert "100 rows" in html

    def test_render_table_view(self):
        from admin_templates import render_table_view
        cols = [{"name": "id", "type": "INTEGER"}, {"name": "name", "type": "VARCHAR"}]
        rows = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        html = render_table_view(
            "users", cols, rows,
            page=1, total_pages=1, total_rows=2,
            per_page=25, pk_col="id",
        )
        assert "Alice" in html
        assert "Bob" in html
        assert "users" in html

    def test_render_table_view_empty(self):
        from admin_templates import render_table_view
        cols = [{"name": "id", "type": "INTEGER"}]
        html = render_table_view(
            "empty_table", cols, [],
            page=1, total_pages=1, total_rows=0,
            per_page=25, pk_col="id",
        )
        assert "No records found" in html

    def test_render_row_detail_new(self):
        from admin_templates import render_row_detail
        cols = [{"name": "id", "type": "INTEGER"}, {"name": "name", "type": "VARCHAR"}]
        html = render_row_detail("users", cols, row=None, pk_col="id", is_new=True)
        assert "New" in html
        assert "Create" in html

    def test_render_row_detail_edit(self):
        from admin_templates import render_row_detail
        cols = [{"name": "id", "type": "INTEGER"}, {"name": "name", "type": "VARCHAR"}]
        row = {"id": 1, "name": "Alice"}
        html = render_row_detail("users", cols, row=row, pk_col="id", is_new=False)
        assert "Edit" in html
        assert "Alice" in html
        assert "Save Changes" in html

    def test_render_row_none_value_handling(self):
        from admin_templates import render_table_view
        cols = [{"name": "id", "type": "INTEGER"}, {"name": "bio", "type": "TEXT"}]
        rows = [{"id": 1, "bio": None}]
        html = render_table_view(
            "users", cols, rows,
            page=1, total_pages=1, total_rows=1,
            per_page=25, pk_col="id",
        )
        assert "NULL" in html

    def test_render_long_value_truncation(self):
        from admin_templates import render_table_view
        cols = [{"name": "id", "type": "INTEGER"}, {"name": "bio", "type": "TEXT"}]
        rows = [{"id": 1, "bio": "x" * 200}]
        html = render_table_view(
            "users", cols, rows,
            page=1, total_pages=1, total_rows=1,
            per_page=25, pk_col="id",
        )
        assert "…" in html  # Truncation indicator
