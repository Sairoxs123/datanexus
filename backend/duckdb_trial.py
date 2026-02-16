import duckdb

conn = duckdb.connect(database="./backend/Trial_Project/project.duckdb", read_only=False)

# conn.execute("CREATE TABLE yellow_tripdata AS SELECT * FROM read_parquet('C:\\Users\\Sai20\\Desktop\\Sai Teja\\datanexus\\yellow_tripdata_2025-01.parquet')")

'''# Option 1: Fetch all results
result = conn.execute("SHOW TABLES;").fetchall()
print(result)

# Option 2: Fetch as a formatted table
result = conn.execute("SHOW TABLES;").df()
print(result)'''

# Option 3: Fetch one row at a time
result = conn.execute("SELECT * FROM yellow_tripdata_2025_01").fetchall()
for row in result:
    print(row)
