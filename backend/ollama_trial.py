from langchain_ollama import ChatOllama
from ai_agent.utils.schemas import ExecutionPlan

def _make_llm(temperature: float, **kwargs):
    """Returns a ChatOllama with Qwen 3 thinking disabled.
    `think` must be a root-level Ollama API body param, not an option."""
    return ChatOllama(
        model="qwen:4b",
        temperature=temperature,
        num_ctx=8192,
        **kwargs,
    )

router_llm = _make_llm(temperature=0.0).with_structured_output(ExecutionPlan)
resp = router_llm.invoke("""
yellow_tripdata_2025_01 has the following schema:
('VendorID', 'INTEGER', 'YES', None, None, None)
('tpep_pickup_datetime', 'TIMESTAMP', 'YES', None, None, None)
('tpep_dropoff_datetime', 'TIMESTAMP', 'YES', None, None, None)
('passenger_count', 'BIGINT', 'YES', None, None, None)
('trip_distance', 'DOUBLE', 'YES', None, None, None)
('RatecodeID', 'BIGINT', 'YES', None, None, None)
('store_and_fwd_flag', 'VARCHAR', 'YES', None, None, None)
('PULocationID', 'INTEGER', 'YES', None, None, None)
('DOLocationID', 'INTEGER', 'YES', None, None, None)
('payment_type', 'BIGINT', 'YES', None, None, None)
('fare_amount', 'DOUBLE', 'YES', None, None, None)
('extra', 'DOUBLE', 'YES', None, None, None)
('mta_tax', 'DOUBLE', 'YES', None, None, None)
('tip_amount', 'DOUBLE', 'YES', None, None, None)
('tolls_amount', 'DOUBLE', 'YES', None, None, None)
('improvement_surcharge', 'DOUBLE', 'YES', None, None, None)
('total_amount', 'DOUBLE', 'YES', None, None, None)
('congestion_surcharge', 'DOUBLE', 'YES', None, None, None)
('Airport_fee', 'DOUBLE', 'YES', None, None, None)
('cbd_congestion_fee', 'DOUBLE', 'YES', None, None, None)

what is the average passenger count in the first month of 2025
""")

print(resp)
