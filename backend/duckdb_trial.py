import duckdb

conn = duckdb.connect(database="./backend/Trial_Project/project.duckdb", read_only=False)

# conn.execute("CREATE TABLE yellow_tripdata AS SELECT * FROM read_parquet('C:\\Users\\Sai20\\Desktop\\Sai Teja\\datanexus\\yellow_tripdata_2025-01.parquet')")

'''# Option 1: Fetch all results
result = conn.execute("SHOW TABLES;").fetchall()
print(result)

# Option 2: Fetch as a formatted table
result = conn.execute("SHOW TABLES;").df()
print(result)'''

# conn.execute("CREATE TABLE BLAHBLAH (name varchar)")

# Option 3: Fetch one row at a time
result = conn.execute("""
            SELECT "passenger_count" AS x_value, COUNT("avg_distance") AS y_value
            FROM (SELECT * FROM (SELECT
    passenger_count,
    COUNT(*) as total_trips,
    AVG(trip_distance) as avg_distance,
    AVG(total_amount) as avg_revenue
FROM
    yellow_tripdata_2025_01
WHERE
    tpep_pickup_datetime >= $start_date
    AND tpep_pickup_datetime <= $end_date
    AND trip_distance > $min_distance
GROUP BY
    passenger_count
ORDER BY
    passenger_count ASC)) AS base_data
            GROUP BY "passenger_count"
            ORDER BY y_value DESC
            LIMIT 500
""", {'start_date': '2025-01-01T00:00', 'end_date': '2026-03-26T18:02', 'min_distance': '0'}).fetchall()
for conn in result:
    print(conn)