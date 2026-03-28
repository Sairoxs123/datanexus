import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import api from "../utils/api";
import { Database, FolderOpen, Upload, ChevronRight } from "lucide-react";

export default function LandingPage({ onProjectCreated }: { onProjectCreated?: () => void }) {
  const [projectName, setProjectName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [projectCreated, setProjectCreated] = useState(false);

  async function handleFileSelect() {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Data Files", extensions: ["csv", "json", "parquet"] }] });
      if (selected) { setFilePath(selected as string); setMessage(""); }
    } catch { setMessage("Error selecting file"); setMessageType("error"); }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) { setMessage("Please enter a project name"); setMessageType("error"); return; }
    setLoading(true);
    try {
      const response = await api.post("/create-new-project", { project_name: projectName });
      setMessage(response.data.message || "Project created successfully.");
      setMessageType("success");
      setProjectCreated(true);
      if (onProjectCreated) onProjectCreated();
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to create project");
      setMessageType("error");
    } finally { setLoading(false); }
  }

  async function handleIngestData(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath) { setMessage("Select a file to upload"); setMessageType("error"); return; }
    setLoading(true);
    try {
      const response = await api.post("/ingest-data", { file_path: filePath });
      setMessage(response.data.message || "Data imported successfully.");
      setMessageType("success");
      setFilePath("");
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Import failed");
      setMessageType("error");
    } finally { setLoading(false); }
  }

  const fileName = filePath ? filePath.split("\\").pop()?.split("/").pop() : null;

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-8 fade-up">
        
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">DataNexus</h1>
            <p className="text-on-surface-variant mt-1">Data Analytics Dashboard</p>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl shadow-sm border border-outline-variant p-8">
          <h2 className="text-xl font-semibold text-on-surface mb-6">
            {projectCreated ? "Import Data" : "New Project"}
          </h2>

          {!projectCreated ? (
            <form onSubmit={handleCreateProject} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Project Name</label>
                <input
                  type="text" value={projectName}
                  onChange={(e) => setProjectName(e.currentTarget.value)}
                  placeholder="e.g. Q1 Sales Analysis"
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container-lowest border border-outline text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>
              
              {message && (
                <div className={`text-sm p-3 rounded-md border ${messageType === "success" ? "bg-success/10 border-success/20 text-success" : "bg-error/10 border-error/20 text-error"}`}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2 shadow-sm flex items-center justify-center gap-2">
                {loading ? "Creating..." : "Create Project"}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleIngestData} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Select Dataset (CSV, JSON, Parquet)</label>
                <button type="button" onClick={handleFileSelect} disabled={loading}
                  className="w-full py-8 text-center rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-highest/30 hover:bg-surface-container-highest transition-colors flex flex-col items-center gap-3">
                  <Upload className="w-6 h-6 text-on-surface-variant/60" />
                  {fileName ? (
                    <span className="text-sm font-medium text-primary">{fileName}</span>
                  ) : (
                    <span className="text-sm text-on-surface-variant">Click to browse files</span>
                  )}
                </button>
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md border ${messageType === "success" ? "bg-success/10 border-success/20 text-success" : "bg-error/10 border-error/20 text-error"}`}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2 shadow-sm flex items-center justify-center gap-2">
                {loading ? "Importing..." : "Import Data"}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
