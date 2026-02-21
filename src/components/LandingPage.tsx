import { useState, useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import api from "../utils/api";

function AnimatedTitle({ onComplete }: { onComplete: () => void }) {
  const letters = "DATANEXUS".split("");
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    const glowTimer = setTimeout(() => setShowGlow(true), letters.length * 100 + 600);
    const completeTimer = setTimeout(onComplete, letters.length * 100 + 1800);
    return () => {
      clearTimeout(glowTimer);
      clearTimeout(completeTimer);
    };
  }, [letters.length, onComplete]);

  return (
    <h1
      className={`text-6xl sm:text-7xl md:text-8xl font-black tracking-wider select-none whitespace-nowrap transition-all duration-700 ${showGlow ? "title-glow" : ""}`}
    >
      {letters.map((char, i) => (
        <span
          key={i}
          className="letter"
          style={{
            animationDelay: `${i * 100}ms`,
            color: i < 4 ? "#818cf8" : "#22d3ee",
          }}
        >
          {char}
        </span>
      ))}
    </h1>
  );
}

function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 4}s`,
        duration: `${3 + Math.random() * 3}s`,
        color: Math.random() > 0.5 ? "#818cf8" : "#22d3ee",
        size: `${2 + Math.random() * 3}px`,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
          }}
        />
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
    } catch {
      setMessage("Error selecting file");
      setMessageType("error");
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();

    if (!projectName.trim()) {
      setMessage("Please enter a project name");
      setMessageType("error");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/create-new-project", {
        project_name: projectName,
      });

      setMessage(response.data.message || "Project created successfully!");
      setMessageType("success");
      setProjectCreated(true);
      if (onProjectCreated) onProjectCreated();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to create project";
      setMessage(errorMsg);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleIngestData(e: React.FormEvent) {
    e.preventDefault();

    if (!filePath) {
      setMessage("Please select a file");
      setMessageType("error");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/ingest-data", {
        file_path: filePath,
      });

      setMessage(response.data.message || "Data ingested successfully!");
      setMessageType("success");
      setFilePath("");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to ingest data";
      setMessage(errorMsg);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-surface flex items-center justify-center overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />

      <Particles />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-xl">
        {/* Title */}
        <AnimatedTitle onComplete={handleIntroComplete} />

        {/* Divider line */}
        {phase === "form" && (
          <div className="w-full flex justify-center">
            <div className="h-px w-48 bg-linear-to-r from-transparent via-primary-light to-transparent line-reveal" />
          </div>
        )}

        {/* Subtitle */}
        {phase === "form" && (
          <p
            className="fade-up text-slate-400 text-lg tracking-wide text-center"
            style={{ animationDelay: "0.2s" }}
          >
            Your intelligent data workspace
          </p>
        )}

        {/* Form */}
        {showForm && (
          <>
            {!projectCreated && (
              <form
                onSubmit={handleCreateProject}
                className="fade-up w-full flex flex-col gap-5"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-slate-400 font-medium tracking-wide uppercase">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.currentTarget.value)}
                    placeholder="Enter your project name..."
                    disabled={loading}
                    className="input-glow w-full px-5 py-3.5 rounded-xl bg-surface-light border border-surface-lighter text-white placeholder-slate-500 text-lg outline-none focus:border-primary-light focus:ring-2 focus:ring-primary/20 transition-all duration-300"
                  />
                </div>

                {message && (
                  <div
                    className={`fade-up px-4 py-3 rounded-lg text-sm font-medium ${
                      messageType === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="shimmer-btn mt-2 w-full py-3.5 rounded-xl font-semibold text-white text-lg bg-linear-to-r from-primary via-primary-light to-accent hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create Project"
                  )}
                </button>
              </form>
            )}

            {projectCreated && (
              <form
                onSubmit={handleIngestData}
                className="fade-up w-full flex flex-col gap-5"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="text-center mb-4">
                  <p className="text-emerald-400 text-sm font-medium">✓ Project Created</p>
                  <p className="text-slate-400 mt-1">{projectName}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-slate-400 font-medium tracking-wide uppercase">
                    Data File
                  </label>
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    disabled={loading}
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-dashed border-surface-lighter bg-surface-light/50 text-slate-400 hover:border-primary-light hover:text-primary-light hover:bg-surface-light transition-all duration-300 text-left"
                  >
                    {filePath ? (
                      <span className="text-accent-light truncate block">
                        {filePath.split("\\").pop()}
                      </span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Select CSV, JSON, or Parquet file
                      </span>
                    )}
                  </button>
                </div>

                {message && (
                  <div
                    className={`fade-up px-4 py-3 rounded-lg text-sm font-medium ${
                      messageType === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="shimmer-btn mt-2 w-full py-3.5 rounded-xl font-semibold text-white text-lg bg-linear-to-r from-primary via-primary-light to-accent hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Ingesting...
                    </span>
                  ) : (
                    "Ingest Data"
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
