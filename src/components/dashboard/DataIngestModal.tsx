import { useState } from "react";
import { X, Upload, FileJson, Loader2 } from "lucide-react";
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
      setMessage("Error selecting file"); setMessageType("error");
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath) { setMessage("Please select a file"); setMessageType("error"); return; }
    setLoading(true);
    try {
      await api.post("/ingest-data", { file_path: filePath });
      setMessage("Data ingested successfully!"); setMessageType("success");
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Failed to ingest data"); setMessageType("error");
    } finally { setLoading(false); }
  }

  const fileName = filePath ? filePath.split(/[\\\\/]/).pop() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
      <form onSubmit={handleIngest} className="w-[420px] bg-bg-secondary rounded-xl shadow-[0_16px_40px_rgb(0,0,0,0.08)] border border-border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg">
          <h2 className="text-[14px] font-semibold text-text flex items-center gap-2">
            <Upload className="w-4 h-4 text-text-secondary" /> Import Data
          </h2>
          <button type="button" onClick={onClose} className="text-text-tertiary hover:text-text hover:bg-border p-1 rounded-md transition-colors">
             <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[13px] text-text-secondary mb-5">
            Select a dataset to attach to your project.
          </p>

          <button type="button" onClick={handleFileSelect} disabled={loading} className="w-full h-[120px] border border-dashed border-border-light rounded-lg flex flex-col items-center justify-center p-4 hover:bg-bg-tertiary hover:border-border transition-colors group focus-ring">
            {fileName ? (
              <>
                 <FileJson className="w-6 h-6 text-accent mb-2" />
                 <span className="text-[13px] font-medium text-text">{fileName}</span>
                 <span className="text-[12px] text-text-tertiary mt-1">Click to browse again</span>
              </>
            ) : (
              <>
                 <Upload className="w-6 h-6 text-text-tertiary group-hover:text-text-secondary mb-2 transition-colors" />
                 <span className="text-[13px] font-medium text-text">Choose file</span>
                 <span className="text-[12px] text-text-tertiary mt-1">CSV, JSON, or Parquet</span>
              </>
            )}
          </button>

          {message && (
            <div className={`mt-4 px-3 py-2.5 rounded-md text-[13px] font-medium border ${ messageType === "success" ? "bg-success-bg text-success border-success/20" : "bg-error-bg text-error border-error/20" }`}>
              {message}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border bg-bg flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-[13px] font-medium text-text-secondary hover:text-text hover:bg-border transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading || !filePath} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium bg-primary text-white hover:bg-primary-dark shadow-sm disabled:opacity-50 transition-colors focus-ring">
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</> : "Import file"}
          </button>
        </div>
      </form>
    </div>
  );
}
