import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

function App() {
  const [projectName, setProjectName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  async function handleFileSelect() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Data Files",
            extensions: ["csv", "json", "parquet"],
          },
        ],
      });

      if (selected) {
        setFilePath(selected as string);
        setMessage("");
      }
    } catch (error) {
      setMessage("Error selecting file");
      setMessageType("error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!projectName.trim()) {
      setMessage("Please enter a project name");
      setMessageType("error");
      return;
    }

    if (!filePath) {
      setMessage("Please select a file");
      setMessageType("error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/ingest-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file_path: filePath }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setMessageType("success");
        setProjectName("");
        setFilePath("");
      } else {
        setMessage(data.error || "An error occurred");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Failed to connect to server");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>DataNexus - Data Ingestion</h1>

      <form className="ingest-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.currentTarget.value)}
            placeholder="Enter project name..."
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="file-input">Data File</label>
          <div className="file-input-wrapper">
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={loading}
              className="file-button"
            >
              Select File
            </button>
            {filePath && <span className="file-path">{filePath}</span>}
          </div>
          <p className="file-hint">Supported formats: CSV, JSON, Parquet</p>
        </div>

        {message && (
          <div className={`message message-${messageType}`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? "Ingesting..." : "Ingest Data"}
        </button>
      </form>
    </main>
  );
}

export default App;
