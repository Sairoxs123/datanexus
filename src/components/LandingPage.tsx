import { useState, useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import api from "../utils/api";

function AnimatedTitle({ onComplete }: { onComplete: () => void }) {
  const letters = "DATANEXUS".split("");
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    const glowTimer = setTimeout(() => setShowGlow(true), letters.length * 100 + 600);
    const completeTimer = setTimeout(onComplete, letters.length * 100 + 1800);
    return () => { clearTimeout(glowTimer); clearTimeout(completeTimer); };
  }, [letters.length, onComplete]);

  return (
    <h1 className={`text-6xl sm:text-7xl md:text-8xl font-black tracking-wider select-none whitespace-nowrap transition-all duration-700 ${showGlow ? "title-glow" : ""}`}>
      {letters.map((char, i) => (
        <span key={i} className="letter" style={{ animationDelay: `${i * 100}ms`, color: i < 4 ? "#4f46e5" : "#0891b2" }}>
          {char}
        </span>
      ))}
    </h1>
  );
}

function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${4 + Math.random() * 3}s`,
      color: Math.random() > 0.5 ? "#60a5fa" : "#38bdf8",
      size: `${3 + Math.random() * 4}px`,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div key={p.id} className="particle" style={{ left: p.left, top: p.top, animationDelay: p.delay, animationDuration: p.duration, backgroundColor: p.color, width: p.size, height: p.size }} />
      ))}
    </div>
  );
}

export default function LandingPage({ onProjectCreated }: { onProjectCreated?: () => void }) {
  const [phase, setPhase] = useState<"intro" | "form">("intro");
  const [projectName, setProjectName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [showForm, setShowForm] = useState(false);
  const [projectCreated, setProjectCreated] = useState(false);

  function handleIntroComplete() {
    setPhase("form");
    setTimeout(() => setShowForm(true), 100);
  }

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
      setMessage(response.data.message || "Project created successfully!");
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
    if (!filePath) { setMessage("Please select a file"); setMessageType("error"); return; }
    setLoading(true);
    try {
      const response = await api.post("/ingest-data", { file_path: filePath });
      setMessage(response.data.message || "Data ingested successfully!");
      setMessageType("success");
      setFilePath("");
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to ingest data");
      setMessageType("error");
    } finally { setLoading(false); }
  }

  const fileName = filePath ? filePath.split("\\").pop()?.split("/").pop() : null;

  return (
    <main className="relative h-screen bg-bg flex items-center justify-center overflow-hidden">
      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.4]" style={{
        backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06)_0%,transparent_70%)]" />
      <Particles />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-lg">
        <AnimatedTitle onComplete={handleIntroComplete} />

        {phase === "form" && (
          <div className="w-full flex justify-center">
            <div className="h-px w-48 bg-linear-to-r from-transparent via-primary to-transparent line-reveal" />
          </div>
        )}

        {phase === "form" && (
          <p className="fade-up text-text-secondary text-base tracking-wide text-center" style={{ animationDelay: "0.2s" }}>
            Your intelligent data workspace
          </p>
        )}

        {showForm && (
          <>
            {!projectCreated ? (
              <form onSubmit={handleCreateProject} className="fade-up w-full flex flex-col gap-4" style={{ animationDelay: "0.5s" }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-muted font-semibold tracking-wider uppercase">Project Name</label>
                  <input
                    type="text" value={projectName}
                    onChange={(e) => setProjectName(e.currentTarget.value)}
                    placeholder="Enter your project name..."
                    disabled={loading}
                    className="input-glow w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border text-text placeholder-text-faint text-base outline-none focus:border-primary-light focus:ring-2 focus:ring-primary/20 transition-all duration-300 shadow-sm"
                  />
                </div>
                {message && (
                  <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${messageType === "success" ? "bg-success-light text-success" : "bg-error-light text-error"}`}>
                    {message}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="mt-1 w-full py-3 rounded-xl font-semibold text-white text-base bg-linear-to-r from-primary via-primary-light to-accent hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating...
                    </span>
                  ) : "Create Project"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleIngestData} className="fade-up w-full flex flex-col gap-4" style={{ animationDelay: "0.5s" }}>
                <div className="text-center mb-1">
                  <div className="flex items-center justify-center gap-1.5 text-success text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    Project Created
                  </div>
                  <p className="text-text-secondary text-sm mt-0.5">{projectName}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-muted font-semibold tracking-wider uppercase">Data File</label>
                  <button type="button" onClick={handleFileSelect} disabled={loading}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-border bg-bg-secondary hover:border-primary/30 hover:bg-primary-50/30 transition-all duration-200 group">
                    {fileName ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <span className="text-sm text-accent font-medium">{fileName}</span>
                        <span className="text-xs text-text-muted">Click to change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <svg className="w-6 h-6 text-text-faint group-hover:text-primary-light transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        <span className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">Select CSV, JSON, or Parquet file</span>
                      </div>
                    )}
                  </button>
                </div>
                {message && (
                  <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${messageType === "success" ? "bg-success-light text-success" : "bg-error-light text-error"}`}>
                    {message}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="mt-1 w-full py-3 rounded-xl font-semibold text-white text-base bg-linear-to-r from-primary via-primary-light to-accent hover:shadow-lg hover:shadow-primary/15 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Ingesting...
                    </span>
                  ) : "Ingest Data"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
