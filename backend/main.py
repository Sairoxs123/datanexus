from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
import duckdb
from typing import Annotated
from sqlmodel import SQLModel, Field, Session, create_engine, select
from datetime import datetime
from contextlib import asynccontextmanager
import admin
from functools import wraps
import json
import uuid
from typing import Dict
import pathlib
import os

sqlite_url = "sqlite:///database.db"
connect_args = {"check_same_thread" : False}
engine = create_engine(sqlite_url, connect_args=connect_args)

selected_project = None

class Project(SQLModel, table=True):
    id : int | None = Field(default=None, primary_key=True)
    name : str
    created_at : datetime = Field(default_factory=datetime.now)

class DataIngestionRequest(BaseModel):
    file_path: str

class CreateProjectRequest(BaseModel):
    project_name: str

class SQLVariable(BaseModel):
    name: str
    default: str
    type: str
    description: str | None = None

class ValidateSQLRequest(BaseModel):
    query_str: str
    variables: List[SQLVariable] | None = None

class GraphConfig(BaseModel):
    x_axis: str
    y_axis: str
    agg_type: str
    is_raw_data: bool
    is_sampled: bool
    variables: List[SQLVariable] | None = None

class GraphLayout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    graph_type: str
    base_sql: str
    config: GraphConfig

class ProjectDashboardLayout(BaseModel):
    project_name: str
    widgets: List[GraphLayout] | None = None

class ProjectDataHandler: # handles the JSON file for a project that stores dashboard layout and other metadata
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.folder_path = project_name.replace(' ', '_')
        self.file_path = f"projects/{self.folder_path}/dashboard_layout.json"

    def create_new_project_file(self):
        layout = ProjectDashboardLayout(project_name=self.project_name)
        os.makedirs("projects/" + self.folder_path, exist_ok=True)
        path = pathlib.Path(self.file_path)
        if not path.exists():
            with open(self.file_path, "w") as f:
                json.dump(layout.dict(), f, indent=4)

    def load_layout(self) -> ProjectDashboardLayout:
        try:
            with open(self.file_path, "r") as f:
                data = json.load(f)
                return ProjectDashboardLayout(**data)
        except FileNotFoundError:
            return ProjectDashboardLayout(project_name=self.project_name)

    def save_layout(self, layout: GraphLayout):
        os.makedirs(self.folder_path, exist_ok=True)
        current_data: ProjectDashboardLayout = self.load_layout()
        with open(self.file_path, "w") as f:
            if current_data.widgets is None:
                current_data.widgets = [layout]
            else:
                # Check if widget with same ID already exists, if so replace it
                existing_widget = next((w for w in current_data.widgets if w.id == layout.id), None)
                if existing_widget:
                    current_data.widgets = [w if w.id != layout.id else layout for w in current_data.widgets]
                else:
                    current_data.widgets.append(layout)
            json.dump(current_data.dict(), f, indent=4)

sqlite_url = "sqlite:///database.db"
connect_args = {"check_same_thread" : False}
engine = create_engine(sqlite_url, connect_args=connect_args)

DEFAULT_CONFIG_PATH = "app_config.json"

def generate_chart_sql(graph: GraphLayout) -> str:
    y_axis = graph.config.y_axis
    x_axis = graph.config.x_axis
    agg_type = graph.config.agg_type
    base_sql = graph.base_sql
    graph_type = graph.graph_type

    agg_mapping = {
        "COUNT": f'COUNT("{y_axis}")',
        "COUNT_DISTINCT": f'COUNT(DISTINCT "{y_axis}")',
        "SUM": f'SUM("{y_axis}")',
        "AVG": f'AVG("{y_axis}")',
        "MIN": f'MIN("{y_axis}")',
        "MAX": f'MAX("{y_axis}")',
        "NONE": y_axis
    }

    sql_agg_function = agg_mapping.get(agg_type.upper(), f'COUNT("{y_axis}")')

    if agg_type.upper() == "NONE":
        final_sql = f"""
            SELECT "{x_axis}" AS x_value, {sql_agg_function} AS y_value
            FROM ({base_sql}) AS base_data
            LIMIT {graph_mapping_to_row_limits.get(graph_type, 500)}
        """
    else:
        final_sql = f"""
            SELECT "{x_axis}" AS x_value, {sql_agg_function} AS y_value
            FROM ({base_sql}) AS base_data
            GROUP BY "{x_axis}"
            ORDER BY y_value DESC
            LIMIT {graph_mapping_to_row_limits.get(graph_type, 500)}
        """

    return final_sql

def save_active_project(project_id: int):
    with open(DEFAULT_CONFIG_PATH, "w") as f:
        json.dump({"last_project_id": project_id}, f)

def load_active_project():
    if os.path.exists(DEFAULT_CONFIG_PATH):
        try:
            with open(DEFAULT_CONFIG_PATH, "r") as f:
                data = json.load(f)
                return data.get("last_project_id")
        except:
            pass
    return None

def initialize_project_connection(project: Project):
    global conn, selected_project, project_data_handler
    folder_path = project.name.replace(" ", "_")
    project_data_handler = ProjectDataHandler(project_name=project.name)
    conn = duckdb.connect(f"projects/{folder_path}/project.duckdb", read_only=False)
    selected_project = project.name

def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

conn = None
project_data_handler = None

def require_project(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        global conn, project_data_handler
        if not conn or not project_data_handler:
            return JSONResponse({"error" : "Project not selected."}, status_code=401)
        return func(*args, **kwargs)
    return wrapper

@asynccontextmanager
async def lifespan(app : FastAPI):
    SQLModel.metadata.create_all(engine)

    # Try to restore last session
    last_project_id = load_active_project()
    if last_project_id:
        with Session(engine) as session:
            project = session.exec(select(Project).where(Project.id == last_project_id)).first()
            if project:
                initialize_project_connection(project)
                print(f"Restored session for project: {project.name}")

    yield

app = FastAPI(lifespan=lifespan)

# Mount admin database visualizer
admin.init(engine)
app.include_router(admin.router)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def index(session: SessionDep):
    projects = session.exec(select(Project)).all()
    projects_json = []
    for i in projects:
        projects_json.append(i.json())
    return JSONResponse({"projects" : projects_json if projects_json else None})

@app.post("/create-new-project")
def create_new_project(request: CreateProjectRequest, session: SessionDep):
    # Check if project already exists
    existing = session.exec(select(Project).where(Project.name == request.project_name)).first()
    if existing:
        return JSONResponse({"error": "Project name already exists."}, status_code=409)

    # Create new project
    project = Project(name=request.project_name)
    session.add(project)
    session.commit()
    session.refresh(project)

    global project_data_handler
    project_data_handler = ProjectDataHandler(project_name=project.name)

    # Initialize connection and persistent storage handlers
    project_data_handler.create_new_project_file()
    initialize_project_connection(project)

    # Save as active session
    save_active_project(project.id)

    return JSONResponse({"message": "Project created."}, status_code=201)

@app.post("/ingest-data")
@require_project
def ingest_data(request: DataIngestionRequest):

    global conn
    file_path = request.file_path
    file_chunks = file_path.split("\\")
    file = file_chunks[-1]
    file_name = file.split(".")[0]
    file_extension = file.split(".")[1]

    if file_extension not in ["csv", "json", "parquet"]:
        return {"error": "Unsupported file format. Please upload a CSV, JSON, or Parquet file."}

    # Sanitize table name by replacing invalid characters with underscores
    table_name = file_name.replace("-", "_").replace(" ", "_").replace(".", "_")

    try:
        if file_extension == "csv":
            conn.execute(f"CREATE TABLE \"{table_name}\" AS SELECT * FROM read_csv('{file_path}')")
        elif file_extension == "json":
            conn.execute(f"CREATE TABLE \"{table_name}\" AS SELECT * FROM read_json('{file_path}')")
        elif file_extension == "parquet":
            conn.execute(f"CREATE TABLE \"{table_name}\" AS SELECT * FROM read_parquet('{file_path}')")

        return {"message": f"Data ingested successfully into table '{table_name}'."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/select-current-project/{project_id}")
def select_current_project(project_id: int, session: SessionDep):
    project = session.exec(select(Project).where(Project.id == project_id)).first()
    if not project:
        return JSONResponse({"error" : "Invalid project ID"}, status_code=404)

    save_active_project(project.id)
    initialize_project_connection(project)

    return JSONResponse({"message" : "Project selected successfully"})

@app.get("/project/dashboard-layout")
@require_project
def get_dashboard_layout():
    global project_data_handler
    layout = project_data_handler.load_layout()
    return JSONResponse(layout.dict())

@app.post("/execute-chart-sql")
@require_project
def execute_chart_sql(graph: GraphLayout):
    global conn
    sql = generate_chart_sql(graph)
    print(graph.json())
    variables = {var.name: var.default for var in graph.config.variables} if graph.config.variables else {}
    print("Generated SQL for graph:", sql)
    print("With variables:", variables)
    df = conn.execute(sql, variables).df()
    results = json.loads(df.to_json(orient='records'))
    return JSONResponse({"results" : results})

@app.get("/project/sql/dashboard")
@require_project
def get_project_dashboard():
    global conn
    tables = conn.execute("SHOW TABLES;").fetchall()
    return JSONResponse({"tables" : tables})

@app.get("/sql/get-selected-table-data")
@require_project
def gettabledata(table_name : str, offset : int = 0, limit : int = 100):
    global conn
    df = conn.execute(f"SELECT * FROM {table_name} LIMIT {limit} OFFSET {offset};").df()
    rows = json.loads(df.to_json(orient='records'))

    if offset == 0:
        row_count = conn.execute(f"SELECT COUNT(*) from {table_name};").fetchall()
        return JSONResponse({"rows" : rows, "row_count" : row_count})

    return JSONResponse({"rows" : rows})

@app.post("/execute-sql")
@require_project
def execute_sql(query_str: str):
    global conn
    df = conn.execute(query_str).df()
    results = json.loads(df.to_json(orient='records'))

    return JSONResponse({"results" : results})

@app.post("/fetch-query-format")
@require_project
def fetch_query_format(request: ValidateSQLRequest):
    global conn
    try:

        params = {var.name: var.default for var in request.variables} if request.variables else {}

        dry_run_query = f"SELECT * FROM ({request.query_str})"

        print("Dry run query:", dry_run_query)
        print("With params:", params)

        result = conn.execute(dry_run_query, params)

        schema = []
        for col in result.description:
            col_name = col[0]
            col_type = str(col[1])

            if col_type in ["BIGINT", "INTEGER", "DOUBLE", "FLOAT"]:
                ui_type = "numeric"
            elif col_type in ["DATE", "TIMESTAMP"]:
                ui_type = "temporal"
            else:
                ui_type = "categorical"

            schema.append({"name": col_name, "type": ui_type})

        # Get actual row count
        count_query = f"SELECT COUNT(*) as row_count FROM ({request.query_str})"
        count_result = conn.execute(count_query, params).fetchone()
        actual_row_count = count_result[0] if count_result else 0

        return JSONResponse({"status": "valid", "schema": schema, "row_count": actual_row_count})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

graph_mapping_to_row_limits = {
    "pie": 20,
    "bar": 500,
    "scatter": 5000,
    "line": 5000
}

@app.post("/save-graph-layout")
@require_project
def save_graph_layout(request: GraphLayout):
    global project_data_handler
    print("Saving graph layout:", request)
    project_data_handler.save_layout(request)
    return JSONResponse({"message": "Graph layout saved successfully."})
