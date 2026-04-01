from langchain_ollama import ChatOllama
import os
from ai_agent.utils.schemas import ExecutionPlan, GeneratedQuery

def get_safe_thread_count():
    logical_cores = os.cpu_count() or 4
    physical_cores = logical_cores // 2
    safe_threads = max(1, physical_cores - 1)
    return safe_threads

def _make_llm(temperature: float, **kwargs):
    """Returns a ChatOllama with Qwen 3 thinking disabled.
    `think` must be a root-level Ollama API body param, not an option."""
    return ChatOllama(
        model="gemma3:4b",
        temperature=temperature,
        num_ctx=8192,
        num_thread=get_safe_thread_count(),
        extra_body={"think": False},
        **kwargs,
    )

analyst_llm = _make_llm(temperature=0.7)
sql_generator_llm = _make_llm(temperature=0.0).with_structured_output(GeneratedQuery)
synthesizer_llm = _make_llm(temperature=0.8)
router_llm = _make_llm(temperature=0.4).with_structured_output(ExecutionPlan)

