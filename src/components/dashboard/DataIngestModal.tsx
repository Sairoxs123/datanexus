import { useState } from "react";
import { X, Upload, FileJson, Loader2, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import api from "../../utils/api";

interface DataIngestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function DataIngestModal({ onClose, onSuccess }: DataIngestModalProps) {
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  async function handleFileSelect() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Data", extensions: ["csv", "json", "parquet"] }],
      });
      if (selected) { setFilePath(selected as string); setMessage(""); }
    } catch {
      setMessage("Failed to open file selector"); setMessageType("error");
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath) { setMessage("Please select a file to import"); setMessageType("error"); return; }
    setLoading(true);
    try {
      await api.post("/ingest-data", { file_path: filePath });
      setMessage("Data imported successfully."); setMessageType("success");
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Import failed"); setMessageType("error");
    } finally { setLoading(false); }
  }

  const fileName = filePath ? filePath.split(/[\\\\/]/).pop() : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={handleIngest} 
        className="w-full max-w-[500px] mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Import Data</h2>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">Upload a dataset to this project</p>
            </div>
          </div>
          <button type="button" onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-dim transition-colors">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-on-surface-variant mb-6 font-medium">
            Select a dataset to load into your project's database. Supported formats: <span className="font-semibold text-on-surface">CSV</span>, <span className="font-semibold text-on-surface">JSON</span>, and <span className="font-semibold text-on-surface">Parquet</span>.
          </p>

          <button type="button" onClick={handleFileSelect} disabled={loading} 
            className="group w-full h-[160px] bg-surface-dim border-2 border-dashed border-outline hover:border-primary rounded-xl flex flex-col items-center justify-center p-6 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20">
            {fileName ? (
              <div className="text-center">
                 <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <FileJson className="w-6 h-6 text-primary" />
                 </div>
                 <span className="block text-sm font-semibold text-on-surface truncate max-w-[300px]">{fileName}</span>
                 <span className="block text-xs font-medium text-primary mt-1">Click to select a different file</span>
              </div>
            ) : (
              <div className="text-center">
                 <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-outline-variant mx-auto mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                 </div>
                 <span className="block text-sm font-semibold text-on-surface">Click to upload</span>
                 <span className="block text-xs text-on-surface-variant mt-1">or drag and drop a file here</span>
              </div>
            )}
          </button>

          {message && (
            <div className={`mt-6 flex items-start gap-3 p-4 rounded-lg border ${ 
              messageType === "success" 
                ? "bg-success/10 text-success border-success/20" 
                : "bg-error/10 text-error border-error/20" 
            }`}>
              {messageType === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-5 bg-surface-dim border-t border-outline-variant flex justify-end gap-3">
          <button type="button" onClick={onClose} 
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading || !filePath} 
            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Importing..." : "Import Data"}
          </button>
        </div>
      </form>
    </div>
  );
}
