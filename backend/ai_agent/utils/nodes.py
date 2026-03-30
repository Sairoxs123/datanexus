from models import analyst_llm, sql_generator_llm, synthesizer_llm, router_llm
from langchain_core.messages import AIMessage
from state import AppState
from langgraph.graph import END
from langchain_core.runnables import RunnableConfig

def router_node(state: AppState) -> str:
    if state.get("errors"):
        return "sql_agent"

    if not state.get("plan") or len(state["plan"]) == 0:
        return END

    next_node = state["plan"].pop(0)
    return next_node

def planner_node(state: AppState):
    latest_message = state["messages"][-1].content

    plan_result = router_llm.invoke(latest_message)
    return {"plan": plan_result.plan}

def sql_agent(state: AppState):
    prompt = f"""
    Write a DuckDB SQL query to answer the user's latest question.
    User Question: {state["messages"][-1].content}

    CRITICAL RULE: Never hardcode dates, thresholds, or text filters.
    Always use $variables in the SQL and provide the values in the sql_params dictionary.
    """

    result = sql_generator_llm.invoke(prompt)

    return {
        "sql_query": result.sql_query,
        "sql_params": result.sql_params,
    }

def executor_tool(state: AppState, config: RunnableConfig):
    try:
        conn = config["configurable"]["conn"]
        sql_query = state["sql_query"]
        sql_params = state.get("sql_params", {})

        results_df = conn.execute(sql_query, sql_params).df()
        data_json = results_df.to_json(orient="records")

        return {"db_results": data_json, "errors": ""}

    except Exception as e:
        return {"db_results": [], "errors": str(e)}

def analyst_node(state: AppState):
    prompt = f"""
    Analyze the SQL query results and provide insights to answer the user's question.
    User Question: {state["messages"][-1].content}
    SQL Results: {state.get("db_results", "No results")}

    If there are errors from executing the SQL, analyze the error message and suggest how to fix the SQL query.
    Errors: {state.get("errors", "No errors")}
    """

    insights = analyst_llm.invoke(prompt)
    return {"analysis": insights.content}

def synthesizer_node(state: AppState):
    prompt = f"""
    Synthesize a final answer to the user's question based on the SQL results and analyst insights.
    User Question: {state["messages"][-1].content}
    SQL Results: {state.get("db_results", "No results")}
    Analyst Insights: {state.get("analysis", "No insights")}

    Provide a concise and informative answer to the user's question.
    """

    final_answer = synthesizer_llm.invoke(prompt)
    return {"final_answer": AIMessage(content=final_answer)}
