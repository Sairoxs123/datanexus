"""
HTML template rendering for the database admin UI.
Dark-themed, modern design inspired by Django admin.
"""


def _base_html(title: str, body: str) -> str:
    """Wrap body content in the base HTML shell with styles."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — DataNexus Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

        :root {{
            --bg-primary: #0f1117;
            --bg-secondary: #1a1d27;
            --bg-card: #1e2130;
            --bg-card-hover: #252840;
            --bg-input: #13151e;
            --border: #2a2d3e;
            --border-focus: #6366f1;
            --text-primary: #e2e8f0;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --accent: #6366f1;
            --accent-hover: #818cf8;
            --accent-soft: rgba(99, 102, 241, 0.12);
            --green: #22c55e;
            --green-soft: rgba(34, 197, 94, 0.12);
            --red: #ef4444;
            --red-soft: rgba(239, 68, 68, 0.12);
            --yellow: #eab308;
            --yellow-soft: rgba(234, 179, 8, 0.12);
            --radius: 12px;
            --radius-sm: 8px;
            --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        }}

        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }}

        /* --- Navbar --- */
        .navbar {{
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            padding: 0 2rem;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(12px);
        }}
        .navbar-brand {{
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: var(--text-primary);
            font-weight: 700;
            font-size: 1.1rem;
        }}
        .navbar-brand .logo {{
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent), #a855f7);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }}
        .navbar-links {{
            display: flex;
            gap: 0.5rem;
        }}
        .navbar-links a {{
            color: var(--text-secondary);
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }}
        .navbar-links a:hover, .navbar-links a.active {{
            color: var(--text-primary);
            background: var(--accent-soft);
        }}

        /* --- Layout --- */
        .container {{
            max-width: 1280px;
            margin: 0 auto;
            padding: 2rem;
        }}

        /* --- Page Header --- */
        .page-header {{
            margin-bottom: 2rem;
        }}
        .page-header h1 {{
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }}
        .page-header p {{
            color: var(--text-secondary);
            font-size: 0.9rem;
        }}
        .breadcrumb {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
            font-size: 0.85rem;
        }}
        .breadcrumb a {{
            color: var(--accent);
            text-decoration: none;
        }}
        .breadcrumb a:hover {{ text-decoration: underline; }}
        .breadcrumb span {{ color: var(--text-muted); }}

        /* --- Card Grid --- */
        .card-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.25rem;
        }}
        .card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.5rem;
            transition: all 0.25s ease;
            text-decoration: none;
            color: inherit;
            display: block;
            position: relative;
            overflow: hidden;
        }}
        .card::before {{
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent), #a855f7);
            opacity: 0;
            transition: opacity 0.25s;
        }}
        .card:hover {{
            background: var(--bg-card-hover);
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }}
        .card:hover::before {{ opacity: 1; }}
        .card-icon {{
            width: 44px;
            height: 44px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            margin-bottom: 1rem;
            background: var(--accent-soft);
        }}
        .card-title {{
            font-weight: 600;
            font-size: 1.05rem;
            margin-bottom: 0.25rem;
        }}
        .card-meta {{
            color: var(--text-secondary);
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 1rem;
        }}
        .card-meta .badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
        }}
        .badge-blue {{ background: var(--accent-soft); color: var(--accent-hover); }}
        .badge-green {{ background: var(--green-soft); color: var(--green); }}

        /* --- Data Table --- */
        .table-wrapper {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
        }}
        .table-toolbar {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border);
            gap: 1rem;
            flex-wrap: wrap;
        }}
        .search-box {{
            display: flex;
            align-items: center;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 0.5rem 0.75rem;
            gap: 0.5rem;
            flex: 1;
            max-width: 360px;
            transition: border-color 0.2s;
        }}
        .search-box:focus-within {{ border-color: var(--border-focus); }}
        .search-box input {{
            border: none;
            background: transparent;
            color: var(--text-primary);
            font-size: 0.875rem;
            outline: none;
            width: 100%;
            font-family: inherit;
        }}
        .search-box input::placeholder {{ color: var(--text-muted); }}

        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th, td {{
            text-align: left;
            padding: 0.75rem 1.25rem;
            border-bottom: 1px solid var(--border);
            font-size: 0.875rem;
            white-space: nowrap;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
        th {{
            background: var(--bg-secondary);
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: sticky;
            top: 0;
            cursor: pointer;
            user-select: none;
        }}
        th:hover {{ color: var(--text-primary); }}
        tr:hover td {{ background: rgba(99, 102, 241, 0.04); }}
        tr:last-child td {{ border-bottom: none; }}

        /* --- Pagination --- */
        .pagination {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-top: 1px solid var(--border);
            font-size: 0.85rem;
            color: var(--text-secondary);
        }}
        .pagination-btns {{
            display: flex;
            gap: 0.35rem;
        }}
        .pagination-btns a, .pagination-btns span {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 36px;
            height: 36px;
            border-radius: var(--radius-sm);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s;
        }}
        .pagination-btns a {{
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }}
        .pagination-btns a:hover {{
            color: var(--text-primary);
            border-color: var(--accent);
            background: var(--accent-soft);
        }}
        .pagination-btns .active {{
            background: var(--accent);
            color: #fff;
            border: 1px solid var(--accent);
        }}

        /* --- Buttons --- */
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.55rem 1.1rem;
            border-radius: var(--radius-sm);
            font-size: 0.85rem;
            font-weight: 500;
            text-decoration: none;
            border: none;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
        }}
        .btn-primary {{
            background: var(--accent);
            color: #fff;
        }}
        .btn-primary:hover {{ background: var(--accent-hover); }}
        .btn-secondary {{
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }}
        .btn-secondary:hover {{ border-color: var(--accent); background: var(--accent-soft); }}
        .btn-danger {{
            background: var(--red-soft);
            color: var(--red);
        }}
        .btn-danger:hover {{ background: var(--red); color: #fff; }}
        .btn-sm {{ padding: 0.35rem 0.75rem; font-size: 0.8rem; }}

        /* --- Forms --- */
        .form-group {{
            margin-bottom: 1.25rem;
        }}
        .form-group label {{
            display: block;
            font-weight: 500;
            font-size: 0.85rem;
            margin-bottom: 0.4rem;
            color: var(--text-secondary);
        }}
        .form-group input, .form-group textarea, .form-group select {{
            width: 100%;
            padding: 0.6rem 0.85rem;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            font-size: 0.9rem;
            font-family: inherit;
            transition: border-color 0.2s;
        }}
        .form-group input:focus, .form-group textarea:focus {{
            outline: none;
            border-color: var(--border-focus);
        }}
        .form-group textarea {{ resize: vertical; min-height: 80px; }}
        .form-group .hint {{
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.25rem;
        }}
        .form-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.75rem;
            max-width: 640px;
        }}
        .form-actions {{
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
            padding-top: 1.25rem;
            border-top: 1px solid var(--border);
        }}

        /* --- Toast --- */
        .toast {{
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 0.85rem 1.25rem;
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            font-weight: 500;
            z-index: 999;
            animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
            box-shadow: var(--shadow);
        }}
        .toast-success {{ background: var(--green); color: #fff; }}
        .toast-error {{ background: var(--red); color: #fff; }}
        @keyframes slideIn {{
            from {{ transform: translateY(20px); opacity: 0; }}
            to {{ transform: translateY(0); opacity: 1; }}
        }}
        @keyframes fadeOut {{
            to {{ opacity: 0; transform: translateY(10px); }}
        }}

        /* --- Empty State --- */
        .empty-state {{
            text-align: center;
            padding: 4rem 2rem;
            color: var(--text-muted);
        }}
        .empty-state .icon {{ font-size: 3rem; margin-bottom: 1rem; }}
        .empty-state p {{ font-size: 0.95rem; }}

        /* --- Responsive --- */
        @media (max-width: 768px) {{
            .container {{ padding: 1rem; }}
            .card-grid {{ grid-template-columns: 1fr; }}
            .table-toolbar {{ flex-direction: column; align-items: stretch; }}
            .search-box {{ max-width: none; }}
        }}
    </style>
</head>
<body>
    <nav class="navbar">
        <a href="/admin/" class="navbar-brand">
            <div class="logo">⚡</div>
            DataNexus Admin
        </a>
        <div class="navbar-links">
            <a href="/admin/" class="active">Dashboard</a>
            <a href="/docs" target="_blank">API Docs</a>
        </div>
    </nav>
    <div class="container">
        {body}
    </div>
</body>
</html>"""


def render_dashboard(tables: list[dict]) -> str:
    """
    Render the admin dashboard.
    tables: list of {name, row_count, column_count}
    """
    if not tables:
        cards = """
        <div class="empty-state">
            <div class="icon">📭</div>
            <p>No tables found in the database.</p>
        </div>"""
    else:
        cards_html = ""
        for t in tables:
            cards_html += f"""
            <a href="/admin/table/{t['name']}" class="card">
                <div class="card-icon">🗃️</div>
                <div class="card-title">{t['name']}</div>
                <div class="card-meta">
                    <span class="badge badge-blue">{t['row_count']} rows</span>
                    <span class="badge badge-green">{t['column_count']} columns</span>
                </div>
            </a>"""
        cards = f'<div class="card-grid">{cards_html}</div>'

    body = f"""
    <div class="page-header">
        <h1>Dashboard</h1>
        <p>Browse and manage your database tables</p>
    </div>
    {cards}
    """
    return _base_html("Dashboard", body)


def render_table_view(
    table_name: str,
    columns: list[dict],
    rows: list[dict],
    page: int,
    total_pages: int,
    total_rows: int,
    per_page: int,
    search: str = "",
    sort_col: str = "",
    sort_dir: str = "asc",
    pk_col: str | None = None,
) -> str:
    """Render the table list view with pagination, search, and sorting."""
    # Table header
    ths = ""
    for col in columns:
        col_name = col["name"]
        new_dir = "desc" if sort_col == col_name and sort_dir == "asc" else "asc"
        arrow = ""
        if sort_col == col_name:
            arrow = " ↑" if sort_dir == "asc" else " ↓"
        ths += f'<th onclick="sortBy(\'{col_name}\', \'{new_dir}\')">{col_name}{arrow}</th>'
    ths += "<th>Actions</th>"

    # Table rows
    trs = ""
    if not rows:
        trs = f'<tr><td colspan="{len(columns) + 1}" style="text-align:center; padding:2rem; color:var(--text-muted)">No records found</td></tr>'
    else:
        for row in rows:
            tds = ""
            row_pk = ""
            for col in columns:
                val = row.get(col["name"], "")
                if val is None:
                    val = '<span style="color:var(--text-muted)">NULL</span>'
                else:
                    val = str(val)
                    if len(val) > 80:
                        val = val[:80] + "…"
                    # Escape HTML
                    val = val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                tds += f"<td>{val}</td>"
                if col["name"] == pk_col:
                    row_pk = row.get(col["name"], "")
            actions = ""
            if pk_col and row_pk != "":
                actions = f'''
                <a href="/admin/table/{table_name}/{row_pk}" class="btn btn-secondary btn-sm">Edit</a>
                <button onclick="deleteRow('{table_name}', '{row_pk}')" class="btn btn-danger btn-sm">Delete</button>'''
            tds += f"<td style='white-space:nowrap'>{actions}</td>"
            trs += f"<tr>{tds}</tr>"

    # Pagination
    pagination_info = f"Showing {(page - 1) * per_page + 1}–{min(page * per_page, total_rows)} of {total_rows}"
    page_btns = ""
    for p in range(1, total_pages + 1):
        if p == page:
            page_btns += f'<span class="active">{p}</span>'
        else:
            url = f"/admin/table/{table_name}?page={p}&per_page={per_page}"
            if search:
                url += f"&search={search}"
            if sort_col:
                url += f"&sort={sort_col}&dir={sort_dir}"
            page_btns += f'<a href="{url}">{p}</a>'

    body = f"""
    <div class="breadcrumb">
        <a href="/admin/">Dashboard</a>
        <span>›</span>
        <span>{table_name}</span>
    </div>
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
            <h1>{table_name}</h1>
            <p>{total_rows} record{"s" if total_rows != 1 else ""} · {len(columns)} columns</p>
        </div>
        <a href="/admin/table/{table_name}/new" class="btn btn-primary">+ Add Record</a>
    </div>

    <div class="table-wrapper">
        <div class="table-toolbar">
            <div class="search-box">
                <span>🔍</span>
                <input type="text" id="searchInput" placeholder="Search records…" value="{search}"
                       onkeydown="if(event.key==='Enter')doSearch()">
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted)">Page {page} of {total_pages}</div>
        </div>
        <div style="overflow-x:auto">
            <table>
                <thead><tr>{ths}</tr></thead>
                <tbody>{trs}</tbody>
            </table>
        </div>
        <div class="pagination">
            <div>{pagination_info}</div>
            <div class="pagination-btns">{page_btns}</div>
        </div>
    </div>

    <script>
        function sortBy(col, dir) {{
            const url = new URL(window.location);
            url.searchParams.set('sort', col);
            url.searchParams.set('dir', dir);
            window.location = url;
        }}
        function doSearch() {{
            const val = document.getElementById('searchInput').value;
            const url = new URL(window.location);
            url.searchParams.set('search', val);
            url.searchParams.set('page', '1');
            window.location = url;
        }}
        async function deleteRow(table, pk) {{
            if (!confirm('Are you sure you want to delete this record?')) return;
            const res = await fetch('/admin/api/table/' + table + '/' + pk, {{ method: 'DELETE' }});
            if (res.ok) {{
                showToast('Record deleted', 'success');
                setTimeout(() => location.reload(), 500);
            }} else {{
                const data = await res.json();
                showToast(data.detail || 'Error deleting record', 'error');
            }}
        }}
        function showToast(msg, type) {{
            const t = document.createElement('div');
            t.className = 'toast toast-' + type;
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3200);
        }}
    </script>
    """
    return _base_html(table_name, body)


def render_row_detail(
    table_name: str,
    columns: list[dict],
    row: dict | None,
    pk_col: str | None = None,
    is_new: bool = False,
) -> str:
    """Render the row detail / edit / create form."""
    title = f"New {table_name}" if is_new else f"Edit {table_name}"
    row_pk = row.get(pk_col, "") if row and pk_col else ""

    fields = ""
    for col in columns:
        col_name = col["name"]
        col_type = col.get("type", "TEXT").upper()
        value = ""
        if row and col_name in row:
            value = row[col_name] if row[col_name] is not None else ""

        # Auto-generated PK hint
        hint = ""
        disabled = ""
        if col_name == pk_col and not is_new:
            disabled = "readonly"
            hint = '<div class="hint">Primary key — read only</div>'
        elif col_name == pk_col and is_new:
            hint = '<div class="hint">Primary key — leave blank for auto-increment</div>'

        input_type = "text"
        if "INT" in col_type:
            input_type = "number"
        elif "DATETIME" in col_type or "TIMESTAMP" in col_type:
            input_type = "datetime-local"
        elif "DATE" in col_type:
            input_type = "date"
        elif "BOOL" in col_type:
            input_type = "text"

        # Escape value for HTML attribute
        val_escaped = str(value).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

        fields += f"""
        <div class="form-group">
            <label for="field_{col_name}">{col_name} <span style="color:var(--text-muted); font-weight:400; font-size:0.75rem;">({col_type})</span></label>
            <input type="{input_type}" id="field_{col_name}" name="{col_name}" value="{val_escaped}" {disabled}>
            {hint}
        </div>"""

    delete_btn = ""
    if not is_new and pk_col:
        delete_btn = f'<button type="button" onclick="deleteAndGoBack(\'{table_name}\', \'{row_pk}\')" class="btn btn-danger" style="margin-left:auto">Delete</button>'

    body = f"""
    <div class="breadcrumb">
        <a href="/admin/">Dashboard</a>
        <span>›</span>
        <a href="/admin/table/{table_name}">{table_name}</a>
        <span>›</span>
        <span>{"New" if is_new else row_pk}</span>
    </div>
    <div class="page-header">
        <h1>{title}</h1>
    </div>

    <div class="form-card">
        <form id="rowForm">
            {fields}
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">{"Create" if is_new else "Save Changes"}</button>
                <a href="/admin/table/{table_name}" class="btn btn-secondary">Cancel</a>
                {delete_btn}
            </div>
        </form>
    </div>

    <script>
        document.getElementById('rowForm').addEventListener('submit', async function(e) {{
            e.preventDefault();
            const data = {{}};
            const inputs = this.querySelectorAll('input, textarea, select');
            inputs.forEach(inp => {{
                if (!inp.readOnly) data[inp.name] = inp.value;
            }});

            const isNew = {'true' if is_new else 'false'};
            let url, method;
            if (isNew) {{
                url = '/admin/api/table/{table_name}';
                method = 'POST';
            }} else {{
                url = '/admin/api/table/{table_name}/{row_pk}';
                method = 'PUT';
            }}

            const res = await fetch(url, {{
                method,
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify(data)
            }});

            if (res.ok) {{
                showToast(isNew ? 'Record created' : 'Record updated', 'success');
                setTimeout(() => window.location.href = '/admin/table/{table_name}', 600);
            }} else {{
                const err = await res.json();
                showToast(err.detail || 'Error saving record', 'error');
            }}
        }});

        async function deleteAndGoBack(table, pk) {{
            if (!confirm('Are you sure you want to delete this record?')) return;
            const res = await fetch('/admin/api/table/' + table + '/' + pk, {{ method: 'DELETE' }});
            if (res.ok) {{
                window.location.href = '/admin/table/' + table;
            }} else {{
                const data = await res.json();
                showToast(data.detail || 'Error deleting record', 'error');
            }}
        }}

        function showToast(msg, type) {{
            const t = document.createElement('div');
            t.className = 'toast toast-' + type;
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3200);
        }}
    </script>
    """
    return _base_html(title, body)
