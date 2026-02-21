from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import duckdb
from typing import Annotated
from sqlmodel import SQLModel, Field, Session, create_engine, select
from datetime import datetime
from contextlib import asynccontextmanager
import admin
from functools import wraps

sqlite_url = "sqlite:///database.db"
connect_args = {"check_same_thread" : False}
engine = create_engine(sqlite_url, connect_args=connect_args)

class Project(SQLModel, table=True):
    id : int | None = Field(default=0, primary_key=True)
    name : str
    created_at : datetime = Field(default_factory=datetime.now)

class DataIngestionRequest(BaseModel):
    file_path: str

class CreateProjectRequest(BaseModel):
    project_name: str

def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

# conn = duckdb.connect(database="my-db.duckdb", read_only=False)
conn = None

def require_project(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        global conn
        if not conn:
            return JSONResponse({"error" : "Project not selected."}, status_code=401)
        return func(*args, **kwargs)
    return wrapper

@asynccontextmanager
async def lifespan(app : FastAPI):
    SQLModel.metadata.create_all(engine)
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

    # Create project folder and duckdb connection
    import os
    folder_path = request.project_name.replace(" ", "_")
    os.makedirs(folder_path, exist_ok=True)

    global conn
    conn = duckdb.connect(database=f"{folder_path}/project.duckdb", read_only=False)

    # Create dashboard layout file
    with open(f"{folder_path}/dashboard_layout.json", "w") as f:
        f.write("{}")

    return JSONResponse({"message": "Project created."}, status_code=201)

@app.post("/ingest-data")
@require_project
def ingest_data(request: DataIngestionRequest):

    global conn
    file_path = request.file_path
    print(file_path)
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

    folder_path = project.name.replace(" ", "_")
    global conn
    conn = duckdb.connect(f"{folder_path}/project.duckdb", read_only=False)

    return JSONResponse({"message" : "Project selected successfully"})

@app.get("/project/dashboard")
@require_project
def get_project_dashboard():
    global conn
    tables = conn.execute("SHOW TABLES;").fetchall()
    return JSONResponse({"tables" : tables})

@app.post("/execute-sql")
@require_project
def execute_sql(query_str: str, session: SessionDep):
    global conn
    data = conn.execute(query_str).fetchall()
    columns = [desc[0] for desc in conn.description]
    results = [dict(zip(columns, row)) for row in data]

    return JSONResponse({"results" : results})