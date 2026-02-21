import { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import api from "./utils/api";

interface Project {
  id: number;
  name: string;
  created_at: string;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<"landing" | "projects" | "dashboard">("landing");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const fetchProjects = async () => {
    try {
      const response = await api.get("/");
      if (response.data && response.data.projects) {
        const parsedProjects = response.data.projects.map((p: string) => JSON.parse(p));
        setProjects(parsedProjects);
        if (parsedProjects.length > 0) {
          setCurrentPage("projects");
        } else {
          setCurrentPage("landing");
        }
      } else {
        setProjects([]);
        setCurrentPage("landing");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async (project: Project) => {
    setDashboardLoading(true);
    setDashboardError("");
    setSelectedProject(project);
    try {
      await api.post(`/select-current-project/${project.id}`);
      const response = await api.get("/project/dashboard");
      const rawTables = response.data?.tables ?? [];
      const normalizedTables = rawTables.map((table: unknown) => {
        if (Array.isArray(table) && table.length > 0) {
          return String(table[0]);
        }
        return String(table);
      });
      setTables(normalizedTables);
      setCurrentPage("dashboard");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to load project dashboard";
      setDashboardError(errorMsg);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {currentPage === "landing" && <LandingPage onProjectCreated={fetchProjects} />}

      {currentPage === "projects" && (
        <div className="min-h-screen bg-gray-900 text-white p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-300">
                Your Projects
              </h1>
              <button
                onClick={() => {
                  setProjects([]);
                  setCurrentPage("landing");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                New Project
              </button>
            </div>

            {dashboardError && (
              <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                {dashboardError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => loadDashboard(project)}
                  disabled={dashboardLoading}
                  className="text-left bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </p>
                  {dashboardLoading && selectedProject?.id === project.id && (
                    <p className="mt-3 text-sm text-blue-300">Opening dashboard...</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentPage === "dashboard" && (
        <div className="min-h-screen bg-gray-900 text-white p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col gap-2 mb-8">
              <button
                onClick={() => {
                  setCurrentPage("projects");
                  setDashboardError("");
                }}
                className="self-start text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                ← Back to projects
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-300">
                    {selectedProject?.name || "Project Dashboard"}
                  </h1>
                  <p className="text-gray-400 text-sm mt-2">Tables in DuckDB</p>
                </div>
                <button
                  onClick={() => selectedProject && loadDashboard(selectedProject)}
                  disabled={dashboardLoading || !selectedProject}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Refresh
                </button>
              </div>
            </div>

            {dashboardError && (
              <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                {dashboardError}
              </div>
            )}

            {dashboardLoading ? (
              <div className="text-blue-300 animate-pulse">Loading tables...</div>
            ) : tables.length === 0 ? (
              <div className="text-gray-400">No tables found yet. Ingest data to get started.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tables.map((table) => (
                  <div
                    key={table}
                    className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all"
                  >
                    <p className="text-lg font-semibold text-blue-200">{table}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;

