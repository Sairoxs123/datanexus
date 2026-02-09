import duckdb

conn = duckdb.connect(database="./backend/my-db.duckdb", read_only=False)

# conn.execute("CREATE TABLE yellow_tripdata AS SELECT * FROM read_parquet('C:\\Users\\Sai20\\Desktop\\Sai Teja\\datanexus\\yellow_tripdata_2025-01.parquet')")

print(conn.execute("SELECT * FROM 'yellow_tripdata_2025_01'").df().to_dict())
