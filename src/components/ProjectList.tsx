import { useState } from "react";
import { Plus, FolderOpen, Calendar, ArrowRight, LayoutDashboard, Trash2 } from "lucide-react";
import api from "../utils/api";

interface Project {
  id: number;
  name: string;
  created_at: string;
}

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onProjectDeleted: () => void;
}

export default function ProjectList({ projects, onSelectProject, onNewProject, onProjectDeleted }: ProjectListProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeletingId(projectToDelete.id);
    try {
      await api.delete(`/project/${projectToDelete.id}`);
      onProjectDeleted();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project");
    } finally {
      setDeletingId(null);
      setProjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setProjectToDelete(null);
  };

  const handleSelect = async (project: Project) => {
    setLoadingId(project.id);
    try { await onSelectProject(project); }
    catch { /* handled upstream */ }
    finally { setLoadingId(null); }
  };

  return (
    <div className="h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-surface-container border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-on-surface tracking-tight">Projects</h1>
              <p className="text-sm text-on-surface-variant">Manage your data analytics workspaces</p>
            </div>
          </div>
          <button onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-container rounded-xl border border-outline-variant shadow-sm border-dashed">
              <FolderOpen className="w-12 h-12 text-outline mb-4" />
              <h3 className="text-lg font-medium text-on-surface mb-1">No projects found</h3>
              <p className="text-sm text-on-surface-variant mb-6">Create a new project to start analyzing data.</p>
              <button onClick={onNewProject}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary bg-primary-container hover:bg-primary-container/80 transition-colors">
                <Plus className="w-4 h-4" />
                Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project, i) => (
                <button key={project.id} onClick={() => handleSelect(project)} disabled={loadingId !== null}
                  className="fade-up group text-left bg-surface-container rounded-xl border border-outline-variant p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 disabled:opacity-50 flex flex-col h-full"
                  style={{ animationDelay: `${i * 50}ms` }}>

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteClick(e, project)}
                        disabled={deletingId === project.id}
                        title="Delete Project"
                        className="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-md transition-all disabled:opacity-50"
                      >
                        {deletingId === project.id ? (
                          <svg className="w-4 h-4 animate-spin text-error" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      {loadingId === project.id ? (
                        <div className="flex h-6 w-6 items-center justify-center">
                          <svg className="w-4 h-4 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </div>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-outline group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-on-surface mb-1 truncate">
                    {project.name}
                  </h3>

                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-outline-variant p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-on-surface mb-2">Delete Project</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Are you sure you want to delete "{projectToDelete.name}"? This action cannot be undone and will permanently delete all associated data and charts.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-lg bg-surface border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === projectToDelete.id}
                className="px-4 py-2 rounded-lg bg-error text-sm font-medium text-white hover:bg-error/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === projectToDelete.id ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
