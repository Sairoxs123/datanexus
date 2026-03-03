import { useState } from "react";
import {
  Database,
  Table2,
  Plus,
  ChevronLeft,
  RefreshCw,
  Terminal,
  LayoutGrid,
} from "lucide-react";

interface SidebarProps {
  projectName: string;
  tables: string[];
  selectedTable: string | null;
  activeTab: "data" | "sql";
  onSelectTable: (table: string) => void;
  onTabChange: (tab: "data" | "sql") => void;
  onRefresh: () => void;
  onIngestData: () => void;
  onBackToProjects: () => void;
  loading: boolean;
}

export default function Sidebar({
  projectName,
  tables,
  selectedTable,
  activeTab,
  onSelectTable,
  onTabChange,
  onRefresh,
  onIngestData,
  onBackToProjects,
  loading,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-14 h-full bg-bg-secondary border-r border-border flex flex-col items-center py-4 gap-3 shrink-0">
        <button onClick={() => setCollapsed(false)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg transition-all"
          title="Expand sidebar">
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
        <div className="w-8 h-px bg-border" />
        <button onClick={() => onTabChange("data")}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            activeTab === "data" ? "bg-primary-50 text-primary" : "text-text-muted hover:text-text hover:bg-bg"
          }`} title="Data view">
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button onClick={() => onTabChange("sql")}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            activeTab === "sql" ? "bg-primary-50 text-primary" : "text-text-muted hover:text-text hover:bg-bg"
          }`} title="SQL editor">
          <Terminal className="w-4 h-4" />
        </button>
        <div className="w-8 h-px bg-border" />
        {tables.map((table) => (
          <button key={table} onClick={() => onSelectTable(table)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              selectedTable === table ? "bg-primary-50 text-primary" : "text-text-muted hover:text-text hover:bg-bg"
            }`} title={table}>
            <Table2 className="w-4 h-4" />
          </button>
        ))}
        <div className="mt-auto flex flex-col gap-2">
          <button onClick={onIngestData}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-primary hover:bg-bg transition-all"
            title="Import data">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-bg-secondary border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBackToProjects}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors font-medium">
            <ChevronLeft className="w-3.5 h-3.5" />
            Projects
          </button>
          <button onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-hover transition-all"
            title="Collapse sidebar">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text truncate">{projectName}</h2>
            <p className="text-xs text-text-muted">DuckDB Database</p>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1 p-1 bg-bg-tertiary rounded-lg">
          <button onClick={() => onTabChange("data")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              activeTab === "data" ? "bg-bg-secondary text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}>
            <LayoutGrid className="w-4 h-4" />
            Data
          </button>
          <button onClick={() => onTabChange("sql")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              activeTab === "sql" ? "bg-bg-secondary text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}>
            <Terminal className="w-4 h-4" />
            SQL
          </button>
        </div>
      </div>

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Tables</span>
          <button onClick={onRefresh} disabled={loading}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-hover transition-all disabled:opacity-40"
            title="Refresh tables">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {tables.length === 0 ? (
          <div className="px-1 py-8 text-center">
            <Table2 className="w-12 h-12 text-text-faint mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-text-muted font-medium">No tables yet</p>
            <p className="text-xs text-text-faint mt-1">Import data to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {tables.map((table) => (
              <button key={table} onClick={() => onSelectTable(table)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  selectedTable === table
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text"
                }`}>
                <Table2 className="w-4 h-4 shrink-0" />
                <span className="text-sm truncate">{table}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t border-border">
        <button onClick={onIngestData}
          className="btn btn-primary w-full">
          <Plus className="w-4 h-4" />
          Import Data
        </button>
      </div>
    </div>
  );
}
