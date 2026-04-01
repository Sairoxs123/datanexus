from langchain_core.messages import BaseMessage
from typing import Dict, Literal, List
from ai_agent.utils.schemas import GeneratedQuery

class CanvasMessage(BaseMessage):
    content: Dict[Literal["columns", "rows"], List]

    canvas_type: Literal["table", "chart"] = "table"

    sql_data: GeneratedQuery

    type: Literal["canvas"] = "canvas"

    @classmethod
    def get_lc_namespace(cls):
        return ["ai_agent", "utils", "messages"]
