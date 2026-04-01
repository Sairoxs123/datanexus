from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from ai_agent.utils import AppState, router_node, planner_node, sql_agent, executor_tool, analyst_node, synthesizer_node
import aiosqlite

workflow = StateGraph(AppState)
workflow.add_node("router", router_node)
workflow.add_node("planner", planner_node)
workflow.add_node("sql_agent", sql_agent)
workflow.add_node("executor_tool", executor_tool)
workflow.add_node("analyst_agent", analyst_node)
workflow.add_node("synthesizer_node", synthesizer_node)

workflow.set_entry_point("planner")

workflow.add_conditional_edges("planner", router_node)
workflow.add_conditional_edges("sql_agent", router_node)
workflow.add_conditional_edges("executor_tool", router_node)
workflow.add_conditional_edges("analyst_agent", router_node)
workflow.add_conditional_edges("synthesizer_node", router_node)

agent = None
db_conn = None

async def init_agent():
    global agent, db_conn
    db_conn = await aiosqlite.connect("agent_checkpoint.db")
    serializer = JsonPlusSerializer()
    if isinstance(serializer._allowed_msgpack_modules, bool):
        serializer._allowed_msgpack_modules = set()
    serializer._allowed_msgpack_modules.update([
        ("ai_agent.utils.messages", "CanvasMessage"),
        ("ai_agent.utils.schemas", "SQLVariable"),
        ("ai_agent.utils.schemas", "GeneratedQuery"),
    ])
    checkpoint_saver = AsyncSqliteSaver(db_conn, serde=serializer)
    agent = workflow.compile(checkpointer=checkpoint_saver).with_config({"recursion_limit": 5})

async def close_agent():
    global db_conn
    if db_conn:
        await db_conn.close()
        db_conn = None

def get_agent():
    if agent is None:
        raise RuntimeError("Agent not initialized. Call init_agent() first.")
    return agent
