import { useState } from "react";
import {
  ChevronLeft,
  Database,
  BarChart3,
  Table2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Dashboard from "./dashboard/Dashboard";
import GraphBuilder from "./dashboard/GraphBuilder";

interface ProjectHomeProps {
  projectName: string;
  tables: string[];
  onTablesChange: (tables: string[]) => void;
  onBackToProjects: () => void;
}

type View = "home" | "sql-dashboard" | "graph-builder";

export default function ProjectHome({
  projectName,
  tables,
  onTablesChange,
  onBackToProjects,
}: ProjectHomeProps) {
  const [view, setView] = useState<View>("home");

  if (view === "sql-dashboard") {
    return (
      <Dashboard
        projectName={projectName}
        tables={tables}
        onTablesChange={onTablesChange}
        onBackToProjects={() => setView("home")}
      />
    );
  }

  if (view === "graph-builder") {
    return <GraphBuilder onBack={() => setView("home")} />;
  }

  // Home view
  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* Top bar */}
      <header className="px-8 py-5 bg-bg-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Projects
          </button>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-primary" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text">{projectName}</h1>
              <p className="text-xs text-text-muted">Project Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">
          {/* Welcome section */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-text mb-2">
              Welcome to {projectName}
            </h2>
            <p className="text-text-muted">
              Your graph widgets will appear here. Use the tools below to manage data or create visualizations.
            </p>
          </div>

          {/* Placeholder for future widgets */}
          <div className="rounded-2xl border-2 border-dashed border-border p-12 mb-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-text-faint" strokeWidth={1.5} />
            </div>
            <p className="text-text-muted font-medium mb-1">
              No graph widgets yet
            </p>
            <p className="text-sm text-text-faint">
              Create your first graph widget to start visualizing your data
            </p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => setView("sql-dashboard")}
              className="group p-6 rounded-2xl bg-bg-secondary border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Table2 className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-base font-semibold text-text mb-1">
                SQL Dashboard
              </h3>
              <p className="text-sm text-text-muted mb-4">
                Browse tables, import data, and run SQL queries against your DuckDB database.
              </p>
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                Open
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>

            <button
              onClick={() => setView("graph-builder")}
              className="group p-6 rounded-2xl bg-bg-secondary border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-text mb-1">
                Create Graph
              </h3>
              <p className="text-sm text-text-muted mb-4">
                Write a parameterized query and build a chart widget to visualize the results.
              </p>
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                Get started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
