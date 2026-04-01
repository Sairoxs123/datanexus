from ai_agent.utils.models import analyst_llm, sql_generator_llm, synthesizer_llm, router_llm
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage, AnyMessage
from ai_agent.utils.state import AppState
from langgraph.graph import END
from langchain_core.runnables import RunnableConfig
from langchain_core.callbacks.manager import dispatch_custom_event
from ai_agent.utils.messages import CanvasMessage
import logging

logger = logging.getLogger(__name__)

VALID_NODES = {"sql_agent", "executor_tool", "analyst_agent", "synthesizer_node"}

def _preview_text(value, max_len: int = 160) -> str:
    text = str(value) if value is not None else ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."

def router_node(state: AppState) -> str:
    logger.info(
        "router_node: evaluating route | has_errors=%s | plan_length=%s",
        bool(state.get("errors")),
        len(state.get("plan", [])),
    )

    if state.get("errors"):
        logger.warning("router_node: previous step had errors, routing back to sql_agent")
        return "sql_agent"

    if not state.get("plan") or len(state["plan"]) == 0:
        logger.info("router_node: no plan steps remaining, routing to END")
        return END

    next_node = state["plan"][0]
    if next_node not in VALID_NODES:
        logger.warning("router_node: invalid node '%s' (likely a leaked thinking token), routing to END", next_node)
        return END

    logger.info("router_node: routing to next node '%s'", next_node)
    return next_node

def planner_node(state: AppState):
    logger.info("planner_node: started | message_count=%s", len(state.get("messages", [])))
    dispatch_custom_event("status", {"status": "Planning execution steps with LLM..."})
    latest_message = state["messages"][-1].content
    logger.info("planner_node: latest user message preview='%s'", _preview_text(latest_message))

    system_prompt = SystemMessage(content="""
        You are a Project Manager for a Data Analysis team.
        Your ONLY job is to create an Execution Plan (array of strings) based on the user's request.

        ALLOWED NODES:
        - 'sql_agent': Use if the question requires querying the database.
        - 'executor_tool': Always follow 'sql_agent' if you need to run the query.
        - 'analyst_agent': Use to explain data results or errors.
        - 'synthesizer_node': Always the final step to provide the friendly answer.

        RULES:
        1. DO NOT answer the user's question directly.
        2. DO NOT worry about whether the dates are in the future; assume the data exists in the table.
        3. Output ONLY the JSON plan.
    """)

    plan_result = router_llm.invoke([system_prompt, HumanMessage(content=latest_message)])
    logger.info("planner_node: raw plan result=%s", plan_result)

    invalid_steps = [step for step in plan_result.plan if step not in VALID_NODES]
    if invalid_steps:
        raise ValueError(f"Invalid plan steps generated: {invalid_steps}")

    logger.info("planner_node: generated plan=%s", plan_result.plan)
    return {"plan": plan_result.plan}

def sql_agent(state: AppState, config: RunnableConfig):
    logger.info("sql_agent: started")
    dispatch_custom_event("status", {"status": "Generating SQL query with LLM..."})

    schema = config["configurable"].get("table_schema", "No schema provided")

    prompt = f"""
    You are an expert DuckDB SQL Developer.

    CURRENT TABLE SCHEMA:
    {schema}

    USER QUESTION: {state["messages"][-1].content}

    CRITICAL RULES:
    1. Only use columns present in the schema above.
    2. Use $variable_name syntax for all values.
    3. Never wrap a variable in TIMESTAMP(), CAST(), DATE(), quotes, or any other SQL function. Write comparisons directly, for example: tpep_pickup_datetime BETWEEN $start_date AND $end_date.
    4. The sql_params defaults must be plain ISO 8601 strings for date or timestamp values.
    5. Return a GeneratedQuery object with 'sql_query' and 'sql_params'.
    """

    result = sql_generator_llm.invoke(prompt)
    logger.info(
        "sql_agent: generated SQL | sql_preview='%s' | param_keys=%s | defaults=%s",
        _preview_text(result.sql_query),
        [res.name for res in result.sql_params],
        {res.name: res.default for res in result.sql_params},
    )

    return {
        "sql_query": result.sql_query,
        "sql_params": result.sql_params,
        "errors": "",
        "plan" : state["plan"][1:] if len(state.get("plan", [])) > 1 else []
    }

async def executor_tool(state: AppState, config: RunnableConfig):
    logger.info("executor_tool: started")
    dispatch_custom_event("status", {"status": "Executing SQL query..."})
    try:
        conn = config["configurable"]["conn"]
        sql_query = state["sql_query"]
        sql_params = state.get("sql_params", {})
        sql_params_dict = {res.name: res.default for res in sql_params}
        logger.info(
            "executor_tool: executing SQL | sql_preview='%s' | param_keys=%s | params=%s",
            _preview_text(sql_query),
            sql_params_dict.keys(),
            sql_params_dict,
        )
        results_df = conn.execute(sql_query, sql_params_dict).df()
        data_json = results_df.to_json(orient="records")
        import json
        data_array = json.loads(data_json)
        logger.info(
            "executor_tool: query succeeded | rows=%s | columns=%s",
            len(results_df),
            list(results_df.columns),
        )

        render_event = dispatch_custom_event("render_canvas_table", {"columns": list(results_df.columns), "rows": data_array, "sql_query": sql_query, "sql_params": sql_params_dict})
        if render_event is not None:
            logger.info("executor_tool: waiting for render event to complete")
        else:
            logger.warning("executor_tool: no render event returned from dispatch")
        if render_event is not None and hasattr(render_event, "__await__"):
            await render_event

        canvas_message = CanvasMessage(content={"columns": list(results_df.columns), "rows": data_array}, sql_data={"sql_query": sql_query, "sql_params": sql_params})

        return {"messages": [canvas_message],  "db_results": data_json[:5], "errors": "", "plan": state["plan"][1:] if len(state.get("plan", [])) > 1 else []}

    except Exception as e:
        logger.exception("executor_tool: query failed with exception")
        return {"db_results": [], "errors": str(e)}

def analyst_node(state: AppState, config: RunnableConfig):
    logger.info(
        "analyst_node: started | has_db_results=%s | has_errors=%s",
        bool(state.get("db_results")),
        bool(state.get("errors")),
    )
    dispatch_custom_event("status", {"status": "Analyzing SQL results with LLM..."})

    schema = config["configurable"].get("table_schema", "No schema provided")

    system_prompt = SystemMessage(content=f"""
        You are a Senior Data Analyst. Your job is to interpret the results of a SQL query.

        CONTEXT:
        - Database Schema: {schema}

        INSTRUCTIONS:
        1. Keep the response short, clear, and direct.
        2. If errors exist, explain the issue in plain language and, if useful, mention a simple fix.
        3. If results exist, summarize the main finding only. Do not add extra caveats or commentary about placeholder variables, date parameters, or query mechanics.
        4. If results are empty, say that no rows matched the query and keep it brief.

        Be precise and avoid unnecessary explanation.
    """)

    human_msg = HumanMessage(content=f"""
        User's Original Question: {state["messages"][-1].content}
        SQL Query Executed: {state.get("sql_query", "None")}
        SQL Results (JSON): {state.get("db_results", [])}
        Execution Errors: {state.get("errors", "None")}
    """)

    insights = analyst_llm.invoke([system_prompt, human_msg])
    logger.info("analyst_node: generated analysis | preview='%s'", _preview_text(insights.content))
    return {"analysis": insights.content, "plan": state["plan"][1:] if len(state.get("plan", [])) > 1 else []}

async def synthesizer_node(state: AppState):
    logger.info("synthesizer_node: started")
    event = dispatch_custom_event("status", {"status": "Synthesizing final answer with LLM..."})
    if event is not None and hasattr(event, "__await__"):
        await event

    prompt = f"""
    You are the final voice of the DataNexus AI.
    Write a concise final answer based on the Analyst's insights.

    USER QUESTION: {state["messages"][-1].content}
    ANALYST INSIGHTS: {state.get("analysis", "No insights available.")}

    Keep it short and natural. Do not mention placeholder variables, query execution details, or suggest follow-up questions unless the user clearly needs one.
    """

    final_answer = await synthesizer_llm.ainvoke(prompt)
    logger.info("synthesizer_node: completed | answer_preview='%s'", _preview_text(final_answer))
    return {"messages": [AIMessage(content=final_answer.content)], "plan": state["plan"][1:] if len(state.get("plan", [])) > 1 else []}
