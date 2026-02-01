import pyarrow.parquet as pq


def parquet_to_csv(parquet_file_path, csv_file_path):
    """
    Read a parquet file, convert it to CSV, and write to a CSV file.

    Args:
        parquet_file_path: Path to the input parquet file
        csv_file_path: Path to the output CSV file
    """
    # Read the parquet file
    table = pq.read_table(parquet_file_path)

    # Convert to pandas DataFrame for easier CSV conversion
    df = table.to_pandas()

    # Write to CSV without the pandas index
    df.to_csv(csv_file_path, index=False)

    print(f"Successfully converted {parquet_file_path} to {csv_file_path}")
    print(f"Total records: {len(df)}")

# Example usage
if __name__ == "__main__":
    # Replace with your actual file paths
    input_parquet = "yellow_tripdata_2025-01.parquet"
    output_csv = "output.csv"

    parquet_to_csv(input_parquet, output_csv)