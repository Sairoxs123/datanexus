from typing import TypedDict, Annotated, Union
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from ai_agent.utils.schemas import SQLVariable
from typing import List
from ai_agent.utils.messages import CanvasMessage

CustomMessage = Union[AnyMessage, CanvasMessage]

class AppState(TypedDict):
    messages: Annotated[list[CustomMessage], add_messages]
    plan: list[str]

    sql_query: str
    sql_params: List[SQLVariable] | None

    db_results: list
    errors: str
    analysis: str
