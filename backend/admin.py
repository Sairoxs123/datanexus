"""
Database Admin — FastAPI router for browsing/editing database.db.
Mounts at /admin and provides both HTML pages and JSON API endpoints.
"""

import math
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import inspect, text

from admin_templates import render_dashboard, render_table_view, render_row_detail

# Lazy import — engine is set by main.py
_engine = None


def init(engine):
    """Called from main.py to inject the SQLAlchemy engine."""
    global _engine
    _engine = engine


router = APIRouter(prefix="/admin")


# ──────────────────────────── Helpers ────────────────────────────


def _get_engine():
    if _engine is None:
        raise HTTPException(500, "Database engine not initialized")
    return _engine


def _get_table_info(table_name: str):
    """Return columns list and primary key column name for a table."""
    eng = _get_engine()
    insp = inspect(eng)
    if table_name not in insp.get_table_names():
        raise HTTPException(404, f"Table '{table_name}' not found")
    columns = insp.get_columns(table_name)
    pk_cols = insp.get_pk_constraint(table_name).get("constrained_columns", [])
    pk_col = pk_cols[0] if pk_cols else None
    return columns, pk_col


# ──────────────────────── HTML Page Routes ───────────────────────


@router.get("/", response_class=HTMLResponse)
def admin_dashboard():
    """Dashboard — list all tables with row counts."""
    eng = _get_engine()
    insp = inspect(eng)
    tables = []
    with eng.connect() as conn:
        for name in insp.get_table_names():
            cols = insp.get_columns(name)
            row_count = conn.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
            tables.append({
                "name": name,
                "row_count": row_count,
                "column_count": len(cols),
            })
    return HTMLResponse(render_dashboard(tables))


@router.get("/table/{table_name}", response_class=HTMLResponse)
def admin_table_view(
    table_name: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: str = Query(""),
    sort: str = Query(""),
    dir: str = Query("asc"),
):
    """Table view — paginated rows with search and sorting."""
    eng = _get_engine()
    columns, pk_col = _get_table_info(table_name)
    col_names = [c["name"] for c in columns]

    with eng.connect() as conn:
        # Build WHERE clause for search
        where = ""
        params = {}
        if search:
            conditions = []
            for i, cn in enumerate(col_names):
                param_key = f"s{i}"
                conditions.append(f'CAST("{cn}" AS TEXT) LIKE :{param_key}')
                params[param_key] = f"%{search}%"
            where = "WHERE " + " OR ".join(conditions)

        # Count
        total_rows = conn.execute(
            text(f'SELECT COUNT(*) FROM "{table_name}" {where}'), params
        ).scalar()
        total_pages = max(1, math.ceil(total_rows / per_page))
        page = min(page, total_pages)

        # Order
        order = ""
        if sort and sort in col_names:
            direction = "DESC" if dir == "desc" else "ASC"
            order = f'ORDER BY "{sort}" {direction}'

        # Fetch rows
        offset = (page - 1) * per_page
        rows_raw = conn.execute(
            text(f'SELECT * FROM "{table_name}" {where} {order} LIMIT :lim OFFSET :off'),
            {**params, "lim": per_page, "off": offset},
        ).mappings().all()
        rows = [dict(r) for r in rows_raw]

    col_dicts = [{"name": c["name"], "type": str(c["type"])} for c in columns]
    html = render_table_view(
        table_name, col_dicts, rows, page, total_pages, total_rows, per_page,
        search=search, sort_col=sort, sort_dir=dir, pk_col=pk_col,
    )
    return HTMLResponse(html)


@router.get("/table/{table_name}/new", response_class=HTMLResponse)
def admin_row_new(table_name: str):
    """New record form."""
    columns, pk_col = _get_table_info(table_name)
    col_dicts = [{"name": c["name"], "type": str(c["type"])} for c in columns]
    html = render_row_detail(table_name, col_dicts, row=None, pk_col=pk_col, is_new=True)
    return HTMLResponse(html)


@router.get("/table/{table_name}/{row_id}", response_class=HTMLResponse)
def admin_row_detail(table_name: str, row_id: str):
    """Edit form for an existing record."""
    eng = _get_engine()
    columns, pk_col = _get_table_info(table_name)
    if not pk_col:
        raise HTTPException(400, "Table has no primary key")

    with eng.connect() as conn:
        result = conn.execute(
            text(f'SELECT * FROM "{table_name}" WHERE "{pk_col}" = :pk'),
            {"pk": row_id},
        ).mappings().first()
    if not result:
        raise HTTPException(404, "Record not found")

    col_dicts = [{"name": c["name"], "type": str(c["type"])} for c in columns]
    html = render_row_detail(table_name, col_dicts, row=dict(result), pk_col=pk_col, is_new=False)
    return HTMLResponse(html)


# ──────────────────────── JSON API Routes ────────────────────────


@router.post("/api/table/{table_name}")
async def api_create_row(table_name: str, request: Request):
    """Create a new record."""
    eng = _get_engine()
    columns, pk_col = _get_table_info(table_name)
    col_names = [c["name"] for c in columns]
    body = await request.json()

    # Filter to valid columns, skip empty PK for auto-increment
    data = {}
    for k, v in body.items():
        if k in col_names:
            if k == pk_col and v == "":
                continue
            data[k] = v if v != "" else None

    if not data:
        raise HTTPException(400, "No valid fields provided")

    cols_str = ", ".join(f'"{k}"' for k in data)
    vals_str = ", ".join(f":{k}" for k in data)

    with eng.connect() as conn:
        conn.execute(text(f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({vals_str})'), data)
        conn.commit()

    return JSONResponse({"message": "Record created"})


@router.put("/api/table/{table_name}/{row_id}")
async def api_update_row(table_name: str, row_id: str, request: Request):
    """Update an existing record."""
    eng = _get_engine()
    columns, pk_col = _get_table_info(table_name)
    if not pk_col:
        raise HTTPException(400, "Table has no primary key")
    col_names = [c["name"] for c in columns]
    body = await request.json()

    sets = []
    data = {"pk": row_id}
    for k, v in body.items():
        if k in col_names and k != pk_col:
            sets.append(f'"{k}" = :{k}')
            data[k] = v if v != "" else None

    if not sets:
        raise HTTPException(400, "No valid fields to update")

    set_str = ", ".join(sets)
    with eng.connect() as conn:
        conn.execute(
            text(f'UPDATE "{table_name}" SET {set_str} WHERE "{pk_col}" = :pk'), data
        )
        conn.commit()

    return JSONResponse({"message": "Record updated"})


@router.delete("/api/table/{table_name}/{row_id}")
def api_delete_row(table_name: str, row_id: str):
    """Delete a record."""
    eng = _get_engine()
    _, pk_col = _get_table_info(table_name)
    if not pk_col:
        raise HTTPException(400, "Table has no primary key")

    with eng.connect() as conn:
        result = conn.execute(
            text(f'DELETE FROM "{table_name}" WHERE "{pk_col}" = :pk'), {"pk": row_id}
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(404, "Record not found")

    return JSONResponse({"message": "Record deleted"})
