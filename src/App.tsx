import { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import ProjectList from "./components/ProjectList";
import ProjectHome from "./components/ProjectHome";
import api from "./utils/api";

interface Project {
  id: number;
  name: string;
  created_at: string;
}

type Page = "landing" | "projects" | "dashboard";

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("landing");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<string[]>([]);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/");
      if (response.data?.projects) {
        const parsed = response.data.projects.map((p: string) => JSON.parse(p));
        setProjects(parsed);
        setCurrentPage(parsed.length > 0 ? "projects" : "landing");
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

  const openProject = async (project: Project) => {
    setSelectedProject(project);
    await api.post(`/select-current-project/${project.id}`);
    const response = await api.get("/project/sql/dashboard");
    const rawTables = response.data?.tables ?? [];
    const normalized = rawTables.map((t: unknown) =>
      Array.isArray(t) && t.length > 0 ? String(t[0]) : String(t)
    );
    setTables(normalized);
    setCurrentPage("dashboard");
  };

  useEffect(() => { fetchProjects(); }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-3 text-text-muted">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  switch (currentPage) {
    case "landing":
      return <LandingPage onProjectCreated={fetchProjects} />;
    case "projects":
      return (
        <ProjectList
          projects={projects}
          onSelectProject={openProject}
          onNewProject={() => setCurrentPage("landing")}
        />
      );
    case "dashboard":
      return (
        <ProjectHome
          projectName={selectedProject?.name ?? "Project"}
          tables={tables}
          onTablesChange={setTables}
          onBackToProjects={() => {
            setCurrentPage("projects");
            setSelectedProject(null);
            setTables([]);
          }}
        />
      );
  }
}

export default App;
