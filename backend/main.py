from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def index():
    return {"message": "Hello, World!"}

@app.post("/ingest-data")
def ingest_data(file_path : str):
    file_chunks = file_path.split(chr(92) * 2)
    file = file_chunks[-1]
    file_name = file.split(".")[0]
    file_extension = file.split(".")[1]

    if file_extension not in ["csv", "json", "parquet"]:
        return {"error": "Unsupported file format. Please upload a CSV, JSON, or Parquet file."}

    return file_path