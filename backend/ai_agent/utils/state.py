from typing import TypedDict, Annotated
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AppState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    plan: list[str]

    sql_query: str
    sql_params: dict

    db_results: list
    errors: str

    analysis: str