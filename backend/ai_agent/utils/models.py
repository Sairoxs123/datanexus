from langchain_ollama import ChatOllama
import os
from schemas import ExecutionPlan

def get_safe_thread_count():
    logical_cores = os.cpu_count() or 4
    physical_cores = logical_cores // 2
    safe_threads = max(1, physical_cores - 1)
    return safe_threads

analyst_llm = ChatOllama(model="qwen3:4b", temperature=0.7, num_ctx=8192, n=get_safe_thread_count())
sql_generator_llm = ChatOllama(model="qwen3:4b", temperature=0.0, num_ctx=8192, n=get_safe_thread_count())
synthesizer_llm = ChatOllama(model="qwen3:4b", temperature=0.8, num_ctx=8192, n=get_safe_thread_count())
router_llm = ChatOllama(model="qwen3:4b", temperature=0.4, num_ctx=8192, n=get_safe_thread_count()).with_structured_output(ExecutionPlan)
