import { useState } from "react";
import { Plus, FolderOpen, Calendar, Database } from "lucide-react";

interface Project {
  id: number;
  name: string;
  created_at: string;
}

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
}

export default function ProjectList({ projects, onSelectProject, onNewProject }: ProjectListProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleSelect = async (project: Project) => {
    setLoadingId(project.id);
    try { await onSelectProject(project); }
    catch { /* handled upstream */ }
    finally { setLoadingId(null); }
  };

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-bg-secondary border-b border-border">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text tracking-tight">DataNexus</h1>
              <p className="text-xs text-text-muted">Your projects</p>
            </div>
          </div>
          <button onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark active:scale-[0.98] transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <button key={project.id} onClick={() => handleSelect(project)} disabled={loadingId !== null}
                className="slide-in-up text-left bg-bg-secondary rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 group disabled:opacity-50"
                style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                    <FolderOpen className="w-5 h-5 text-primary" />
                  </div>
                  {loadingId === project.id && (
                    <svg className="w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors mb-1 truncate">
                  {project.name}
                </h3>
                <div className="flex items-center gap-1.5 text-text-muted text-xs">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
