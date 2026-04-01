from fastapi import FastAPI, Depends, BackgroundTasks
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
from fastapi.responses import StreamingResponse
import pathlib
import os
from ai_agent import init_agent, get_agent, close_agent
from langchain_core.messages import HumanMessage, AIMessage
from ai_agent.utils import synthesizer_llm
from ai_agent.utils.messages import CanvasMessage
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

sqlite_url = "sqlite:///database.db"
connect_args = {"check_same_thread" : False}
engine = create_engine(sqlite_url, connect_args=connect_args)

selected_project = None

class Project(SQLModel, table=True):
    id : int | None = Field(default=None, primary_key=True)
    name : str
    created_at : datetime = Field(default_factory=datetime.now)

class ChatSession(SQLModel, table=True):
    id: str = Field(primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    name: str = Field(default="New Chat")
    created_at: datetime = Field(default_factory=datetime.now)
    last_message_time: datetime = Field(default_factory=datetime.now)

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

class DeleteWidgetRequest(BaseModel):
    widget_id: str

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

    def delete_widget(self, widget_id: str):
        os.makedirs(self.folder_path, exist_ok=True)
        current_data: ProjectDashboardLayout = self.load_layout()
        with open(self.file_path, "w") as f:
            current_data.widgets = [w for w in current_data.widgets if w.id != widget_id]
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
    logger.info(f"Initializing connection for project: {project.name}")
    folder_path = project.name.replace(" ", "_")
    project_data_handler = ProjectDataHandler(project_name=project.name)
    conn = duckdb.connect(f"projects/{folder_path}/project.duckdb", read_only=False)
    selected_project = project.name
    logger.info(f"Project connection established for: {project.name}")

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
            logger.warning("Attempted to run a function requiring a project, but no project is selected.")
            return JSONResponse({"error" : "Project not selected."}, status_code=401)
        return func(*args, **kwargs)
    return wrapper

@asynccontextmanager
async def lifespan(app : FastAPI):
    logger.info("Starting up application...")
    SQLModel.metadata.create_all(engine)

    # Try to restore last session
    last_project_id = load_active_project()
    if last_project_id:
        logger.info(f"Checking last active project session: {last_project_id}")
        with Session(engine) as session:
            project = session.exec(select(Project).where(Project.id == last_project_id)).first()
            if project:
                initialize_project_connection(project)
                logger.info(f"Restored session for project: {project.name}")

    logger.info("Initializing AI agent...")
    await init_agent()
    logger.info("Application startup complete.")

    yield

    logger.info("Shutting down application...")
    await close_agent()
    logger.info("Application shutdown complete.")

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
    logger.info(f"Attempting to create new project: {request.project_name}")
    # Check if project already exists
    existing = session.exec(select(Project).where(Project.name == request.project_name)).first()
    if existing:
        logger.warning(f"Project creation failed, name already exists: {request.project_name}")
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

    logger.info(f"Successfully created project: {request.project_name}")
    return JSONResponse({"message": "Project created."}, status_code=201)

@app.post("/ingest-data")
@require_project
def ingest_data(request: DataIngestionRequest):
    logger.info(f"Ingesting data from {request.file_path}")
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

@app.post("/execute-chart-sql")
@require_project
def execute_chart_sql(graph: GraphLayout):
    global conn
    sql = generate_chart_sql(graph)
    variables = {var.name: var.default for var in graph.config.variables} if graph.config.variables else {}
    df = conn.execute(sql, variables).df()
    results = json.loads(df.to_json(orient='records'))
    return JSONResponse({"results" : results})

@app.post("/delete-graph-widget")
@require_project
def delete_graph_widget(request: DeleteWidgetRequest):
    global project_data_handler
    project_data_handler.delete_widget(request.widget_id)
    return JSONResponse({"message": "Graph widget deleted successfully."})

async def generate_chat_name(thread_id: str, first_message: str, session: Session):
    prompt = f"Summarize this into a 3-word title: {first_message}. Output ONLY the title."

    title = await synthesizer_llm.ainvoke(prompt)
    title = title.content.strip().replace('"', '')

    logger.info(f"Generated chat title: '{title}' for thread_id: {thread_id} based on first message: '{first_message}'")

    db_session = session
    chat = db_session.get(ChatSession, thread_id)
    if chat:
        chat.name = title
        db_session.add(chat)
        db_session.commit()
        db_session.refresh(chat)

@app.post("/create-ai-chat")
@require_project
def create_ai_chat(message: str, background_tasks: BackgroundTasks, session: SessionDep):
    project = session.exec(select(Project).where(Project.name == selected_project)).first()

    thread_id = str(uuid.uuid4())

    new_chat = ChatSession(id=thread_id, project_id=project.id, name="New Chat")
    session.add(new_chat)
    session.commit()

    background_tasks.add_task(generate_chat_name, thread_id, message, session)

    return JSONResponse({"thread_id": thread_id})

class ChatRequest(BaseModel):
    thread_id: str
    message: str

@app.post("/send-ai-message")
@require_project
async def send_ai_message(request: ChatRequest, session: SessionDep):
    global conn
    schema_info = conn.execute("DESCRIBE;").df().to_string()

    config = {
        "configurable" : {
            "thread_id" : request.thread_id,
            "conn": conn,
            "table_schema": schema_info
        }
    }

    new_input = {"messages": [HumanMessage(content=request.message)]}

    chat = session.get(ChatSession, request.thread_id)
    chat.last_message_time = datetime.now()
    session.add(chat)
    session.commit()

    async def event_generator():
        name_sent = False

        async for event in get_agent().astream_events(new_input, config=config, version="v2"):
            if not name_sent:
                if chat and chat.name != "New Chat":
                    yield f"data: {json.dumps({'type': 'chat_name_update', 'data': chat.name})}\n\n"
                    name_sent = True

            if event["event"] == "on_chat_model_stream" and event["metadata"].get("langgraph_node") == "synthesizer_node":
                chunk = event["data"]["chunk"].content
                if chunk:
                    yield f"data: {json.dumps({'type': 'text', 'data': chunk})}\n\n"

            elif event["event"] == "on_custom_event":
                if event["name"] == "render_canvas_table":
                    canvas_payload = event["data"]
                    yield f"data: {json.dumps({'type': 'canvas_table', 'data': canvas_payload})}\n\n"

                elif event["name"] == "status":
                    yield f"data: {json.dumps({'type': 'status', 'data': event['data']['status']})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/get-chat-sessions")
@require_project
def get_chat_sessions(session: SessionDep):
    project = session.exec(select(Project).where(Project.name == selected_project)).first()
    if not project:
        return JSONResponse([], status_code=200)
    chats = session.exec(
        select(ChatSession)
        .where(ChatSession.project_id == project.id)
        .order_by(ChatSession.last_message_time.desc())
    ).all()
    return JSONResponse([{"id": c.id, "name": c.name, "last_message_at": c.last_message_time.isoformat()} for c in chats])

@app.get("/get-chat-messages/{thread_id}")
@require_project
async def get_chat_messages(thread_id: str):
    """Read message history directly from LangGraph's checkpointer — no duplicate storage."""
    config = {"configurable": {"thread_id": thread_id, "conn": conn}}
    try:
        state = await get_agent().aget_state(config)
        messages = state.values.get("messages", [])
    except Exception:
        return JSONResponse([])

    result = []
    for m in messages:
        if isinstance(m, HumanMessage):
            content = m.content if isinstance(m.content, str) else str(m.content)
            result.append({"role": "user", "content": content})
        elif isinstance(m, AIMessage):
            content = m.content if isinstance(m.content, str) else ""
            if content:
                result.append({"role": "assistant", "content": content})
        elif isinstance(m, CanvasMessage):
            result.append({"role": "canvas", "sql_query": m.sql_data.sql_query, "sql_params": [var.model_dump_json() for var in m.sql_data.sql_params]})
    return JSONResponse(result)

class ExecuteCanvasQueryRequest(BaseModel):
    sql_query: str
    sql_params: list[dict]

@app.post("/execute-canvas-query")
@require_project
def execute_canvas_query(request: ExecuteCanvasQueryRequest):
    global conn
    params = {p["name"]: p["default"] for p in request.sql_params} if request.sql_params else {}
    df = conn.execute(request.sql_query, params).df()
    results = json.loads(df.to_json(orient='records'))
    return JSONResponse({"results": results})

@app.post("/delete-chat-session/{thread_id}")
@require_project
def delete_chat_session(thread_id: str, session: SessionDep):
    chat = session.get(ChatSession, thread_id)
    if chat:
        session.delete(chat)
        session.commit()
    config = {"configurable": {"thread_id": thread_id, "conn": conn}}
    try:
        get_agent().delete_state(config)
    except Exception:
        pass
    return JSONResponse({"message": "Chat session deleted"})

@app.post("/rename-chat-session/{thread_id}")
@require_project
def rename_chat_session(thread_id: str, new_name: str, session: SessionDep):
    chat = session.get(ChatSession, thread_id)
    if chat:
        chat.name = new_name
        session.add(chat)
        session.commit()
        return JSONResponse({"message": "Chat session renamed"})
    else:
        return JSONResponse({"error": "Chat session not found"}, status_code=404)
