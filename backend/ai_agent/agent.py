from langgraph.graph import StateGraph
from langgraph.checkpoint.sqlite import SqliteSaver
from ai_agent.utils import AppState, router_node, planner_node, sql_agent, executor_tool, analyst_node

checkpoint_saver = SqliteSaver("agent_checkpoint.db")

workflow = StateGraph(AppState)
workflow.add_node("router", router_node)
workflow.add_node("planner", planner_node)
workflow.add_node("sql_agent", sql_agent)
workflow.add_node("executor_tool", executor_tool)
workflow.add_node("analyst_agent", analyst_node)

workflow.set_start("planner")

workflow.add_edge("sql_agent", "executor_tool")

workflow.add_conditional_edges("router", {
    "sql_agent": "sql_agent",
    "executor_tool": "executor_tool",
    "analyst_agent": "analyst_agent",
})

agent = workflow.compile(checkpointer_saver=checkpoint_saver)
