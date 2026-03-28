import { useState } from "react";
import {
  Database,
  Table2,
  Plus,
  ChevronLeft,
  RefreshCw,
  Terminal,
  LayoutGrid,
  Settings,
  Activity,
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
      <div className="w-16 h-full bg-surface-container border-r border-outline-variant flex flex-col items-center py-6 gap-6 shrink-0 transition-all duration-300">
        <button onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          title="Expand sidebar">
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
        
        <div className="w-8 h-px bg-outline-variant" />
        
        <nav className="flex flex-col gap-3">
          <button onClick={() => onTabChange("data")}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === "data" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            }`} title="Tables">
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button onClick={() => onTabChange("sql")}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === "sql" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            }`} title="SQL Editor">
            <Terminal className="w-5 h-5" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button onClick={onIngestData}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
            title="Import Data">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-surface-container border-r border-outline-variant flex flex-col shrink-0 transition-all duration-300">
      {/* Sidebar Header */}
      <div className="px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBackToProjects}
            className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Projects
          </button>
          <button onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
            title="Collapse sidebar">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-on-surface truncate">{projectName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className="w-1.5 h-1.5 rounded-full bg-success" />
               <p className="text-xs text-on-surface-variant">Connected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selectors */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container-highest rounded-lg border border-outline-variant">
          <button onClick={() => onTabChange("data")}
            className={`flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === "data" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}>
            <LayoutGrid className="w-4 h-4" />
            Tables
          </button>
          <button onClick={() => onTabChange("sql")}
            className={`flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === "sql" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}>
            <Terminal className="w-4 h-4" />
            SQL Editor
          </button>
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Data Tables</span>
          <button onClick={onRefresh} disabled={loading}
            className="w-6 h-6 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            title="Refresh tables">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {tables.length === 0 ? (
          <div className="px-2 py-8 text-center rounded-lg border border-dashed border-outline-variant mt-2">
            <Table2 className="w-8 h-8 text-outline mx-auto mb-2" strokeWidth={1} />
            <p className="text-sm font-medium text-on-surface-variant">No tables found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 mt-2">
            {tables.map((table) => (
              <button key={table} onClick={() => onSelectTable(table)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                  selectedTable === table
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                }`}>
                <Table2 className={`w-4 h-4 ${selectedTable === table ? "text-primary" : "text-on-surface-variant/60"}`} />
                <span className="text-sm truncate">{table}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lower Command Access */}
      <div className="p-5 border-t border-outline-variant">
        <button onClick={onIngestData}
          className="w-full py-2.5 rounded-lg bg-surface border border-outline-variant hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 shadow-sm text-sm font-medium text-on-surface">
          <Plus className="w-4 h-4" />
          Import Data
        </button>
        
        <div className="flex items-center justify-center gap-6 mt-5">
           <Settings className="w-4 h-4 text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors" />
           <Activity className="w-4 h-4 text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors" />
        </div>
      </div>
    </div>
  );
}
