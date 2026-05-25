from langchain_ollama import ChatOllama
import os
from ai_agent.utils.schemas import ExecutionPlan, GeneratedQuery

def get_safe_thread_count():
    logical_cores = os.cpu_count() or 4
    physical_cores = logical_cores // 2
    safe_threads = max(1, physical_cores - 1)
    return safe_threads

def get_selected_model():
    from paths import data_path
    import json
    settings_path = data_path("settings.json")
    model_name = "qwen3:4b"
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r") as f:
                settings = json.load(f)
                model_name = settings.get("selected_model", model_name)
        except:
            pass
    return model_name

def _make_llm(temperature: float, **kwargs):
    return ChatOllama(
        model=get_selected_model(),
        temperature=temperature,
        num_ctx=8192,
        num_thread=get_safe_thread_count(),
        extra_body={"think": False},
        **kwargs,
    )

def get_analyst_llm():
    return _make_llm(temperature=0.7)

def get_sql_generator_llm():
    return _make_llm(temperature=0.0).with_structured_output(GeneratedQuery)

def get_synthesizer_llm():
    return _make_llm(temperature=0.8)

def get_router_llm():
    return _make_llm(temperature=0.4).with_structured_output(ExecutionPlan)

