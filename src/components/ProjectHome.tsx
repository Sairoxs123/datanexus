import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Database,
  Table2,
  ArrowRight,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  BarChart3,
  Trash2,
  Sparkles,
} from "lucide-react";
import Dashboard from "./dashboard/Dashboard";
import GraphBuilder from "./dashboard/GraphBuilder";
import GraphDetailView from "./dashboard/GraphDetailView";
import GraphWidgetRenderer, {
  type ChartPoint,
  type GraphLayout,
  type WidgetCardData,
} from "./dashboard/GraphWidgetRenderer";
import AIChatPanel from "./dashboard/AIChatPanel";
import AICanvas, { type CanvasData } from "./dashboard/AICanvas";
import api from "../utils/api";

interface ProjectHomeProps {
  projectName: string;
  tables: string[];
  onTablesChange: (tables: string[]) => void;
  onBackToProjects: () => void;
}

type View = "home" | "sql-dashboard" | "graph-builder" | "graph-detail";

interface DashboardLayoutResponse {
  project_name: string;
  widgets?: GraphLayout[];
}

function toChartPoints(raw: unknown[]): ChartPoint[] {
  return raw
    .map((row) => {
      const obj = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
      const xValue = obj?.x_value;
      const yValue = obj?.y_value;

      if (xValue === undefined || yValue === undefined) {
        return null;
      }

      const parsedY = typeof yValue === "number" ? yValue : Number(yValue);
      if (!Number.isFinite(parsedY)) {
        return null;
      }

      return {
        x: String(xValue),
        y: parsedY,
      };
    })
    .filter((point): point is ChartPoint => point !== null);
}

export default function ProjectHome({
  projectName,
  tables,
  onTablesChange,
  onBackToProjects,
}: ProjectHomeProps) {
  const [view, setView] = useState<View>("home");
  const [widgets, setWidgets] = useState<WidgetCardData[]>([]);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [selectedGraphLayout, setSelectedGraphLayout] = useState<GraphLayout | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [widgetToDelete, setWidgetToDelete] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);

  useEffect(() => {
    if (view !== "home") {
      return;
    }

    const getLayout = async () => {
      setLoadingLayout(true);
      setLayoutError(null);

      try {
        const layoutRes = await api.get<DashboardLayoutResponse>("/project/dashboard-layout");
        const layoutWidgets = layoutRes.data.widgets ?? [];

        if (layoutWidgets.length === 0) {
          setWidgets([]);
          return;
        }

        const results = await Promise.allSettled(
          layoutWidgets.map(async (layout) => {
            const chartRes = await api.post<{ results?: unknown[]; error?: string }>(
              "/execute-chart-sql",
              layout
            );

            if (chartRes.data.error) {
              return {
                layout,
                points: [],
                error: chartRes.data.error,
              } satisfies WidgetCardData;
            }

            return {
              layout,
              points: toChartPoints(chartRes.data.results ?? []),
            } satisfies WidgetCardData;
          })
        );

        const parsedWidgets: WidgetCardData[] = results.map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          }

          return {
            layout: layoutWidgets[index],
            points: [],
            error: "Failed to load chart results for this widget.",
          };
        });

        setWidgets(parsedWidgets);
      } catch (error) {
        console.error("Failed to load dashboard layout:", error);
        setLayoutError("Failed to load dashboard widgets.");
      } finally {
        setLoadingLayout(false);
      }
    };

    getLayout();
  }, [view, projectName]);

  const widgetSummary = useMemo(() => {
    const successCount = widgets.filter((w) => !w.error && w.points.length > 0).length;
    return `${successCount}/${widgets.length} charts active`;
  }, [widgets]);

  const handleGraphClick = (layout: GraphLayout) => {
    setSelectedGraphLayout(layout);
    setView("graph-detail");
  };

  const handleDeleteClick = (widgetId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setWidgetToDelete(widgetId);
  };

  const handleConfirmDelete = async () => {
    if (!widgetToDelete) return;

    setDeletingWidgetId(widgetToDelete);
    try {
      await api.post("/delete-graph-widget", { widget_id: widgetToDelete });
      // Refresh the widgets list
      const getLayout = async () => {
        setLoadingLayout(true);
        setLayoutError(null);

        try {
          const layoutRes = await api.get<DashboardLayoutResponse>("/project/dashboard-layout");
          const layoutWidgets = layoutRes.data.widgets ?? [];

          if (layoutWidgets.length === 0) {
            setWidgets([]);
            return;
          }

          const results = await Promise.allSettled(
            layoutWidgets.map(async (layout) => {
              const chartRes = await api.post<{ results?: unknown[]; error?: string }>(
                "/execute-chart-sql",
                layout
              );

              if (chartRes.data.error) {
                return {
                  layout,
                  points: [],
                  error: chartRes.data.error,
                } satisfies WidgetCardData;
              }

              return {
                layout,
                points: toChartPoints(chartRes.data.results ?? []),
              } satisfies WidgetCardData;
            })
          );

          const parsedWidgets: WidgetCardData[] = results.map((result, index) => {
            if (result.status === "fulfilled") {
              return result.value;
            }

            return {
              layout: layoutWidgets[index],
              points: [],
              error: "Failed to load chart results for this widget.",
            };
          });

          setWidgets(parsedWidgets);
        } catch (error) {
          console.error("Failed to load dashboard layout:", error);
          setLayoutError("Failed to load dashboard widgets.");
        } finally {
          setLoadingLayout(false);
        }
      };

      await getLayout();
    } catch (err) {
      console.error("Failed to delete widget:", err);
      setLayoutError("Failed to delete widget. Please try again.");
    } finally {
      setDeletingWidgetId(null);
      setWidgetToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setWidgetToDelete(null);
  };

  const handleWidgetDeleted = () => {
    // This will be called when a widget is deleted from the detail view
    // Refresh the widgets list by triggering the useEffect
    setView("home");
  };

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

  if (view === "graph-detail" && selectedGraphLayout) {
    return (
      <GraphDetailView
        layout={selectedGraphLayout}
        onBack={() => setView("home")}
        onWidgetDeleted={handleWidgetDeleted}
      />
    );
  }

  // Home view
  return (
    <div className="h-screen flex flex-col bg-surface-dim overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 shrink-0 bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <button
              onClick={onBackToProjects}
              className="group flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Projects
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">{projectName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-on-surface-variant">Project Dashboard</span>
                  <span className="text-on-surface-variant/30">•</span>
                  <span className="text-xs font-medium text-success">{widgetSummary}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setView("sql-dashboard")}
              className="px-4 py-2 rounded-lg bg-surface border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2 shadow-sm">
              <Table2 className="w-4 h-4 text-on-surface-variant" />
              Data Studio
            </button>
            <button onClick={() => setView("graph-builder")}
              className="px-4 py-2 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
              <BarChart3 className="w-4 h-4" />
              New Chart
            </button>
            <button
              onClick={() => setAiPanelOpen((o) => !o)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${
                aiPanelOpen
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-highest"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Assistant
            </button>
          </div>
        </div>
      </header>

      {/* Content area: main canvas + optional AI panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {canvasData ? (
            <AICanvas
              data={canvasData}
              onClose={() => setCanvasData(null)}
              onAddToDashboard={() => { /* placeholder – backend to be wired later */ }}
            />
          ) : (
            <div className="h-full overflow-y-auto p-8">
              <div className="max-w-7xl mx-auto">

                {loadingLayout && (
                  <div className="bg-surface rounded-xl border border-outline-variant p-20 flex flex-col items-center justify-center text-center shadow-sm">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-on-surface-variant">Loading dashboard...</p>
                  </div>
                )}

                {!loadingLayout && layoutError && (
                  <div className="bg-error/10 border border-error/20 rounded-xl p-8 flex items-start gap-3 text-error shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Failed to load dashboard</h3>
                      <p className="text-sm opacity-90">{layoutError}</p>
                    </div>
                  </div>
                )}

                {!loadingLayout && !layoutError && widgets.length === 0 && (
                  <div className="bg-surface rounded-xl border border-outline-variant border-dashed p-16 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center mb-5">
                      <LayoutDashboard className="w-8 h-8 text-outline" />
                    </div>
                    <h3 className="text-xl font-semibold text-on-surface mb-2">No Charts Found</h3>
                    <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                      Create your first chart to start visualizing your data on this dashboard.
                    </p>
                    <button
                      onClick={() => setView("graph-builder")}
                      className="mt-6 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                      Create First Chart <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {!loadingLayout && !layoutError && widgets.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {widgets.map((widget, i) => (
                      <article
                        key={widget.layout.id}
                        className="fade-up bg-surface rounded-xl border border-outline-variant p-6 h-full flex flex-col shadow-sm hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                        style={{ animationDelay: `${i * 50}ms` }}
                        onClick={() => handleGraphClick(widget.layout)}
                      >
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{widget.layout.graph_type} Chart</div>
                            <h3 className="text-lg font-semibold text-on-surface group-hover:text-primary transition-colors">{widget.layout.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <BarChart3 className="w-5 h-5 text-primary" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(widget.layout.id, e)}
                              disabled={deletingWidgetId === widget.layout.id}
                              className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg bg-error/10 text-error hover:bg-error/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete widget"
                            >
                              {deletingWidgetId === widget.layout.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-h-[300px] relative">
                          <div className="absolute inset-0">
                            <GraphWidgetRenderer widget={widget} height="h-full" />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* AI panel */}
        {aiPanelOpen && (
          <AIChatPanel
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            onCanvasData={(data) => setCanvasData(data)}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {widgetToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-outline-variant p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-on-surface mb-2">Delete Graph Widget</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Are you sure you want to delete this graph widget? This action cannot be undone.
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
                disabled={deletingWidgetId === widgetToDelete}
                className="px-4 py-2 rounded-lg bg-error text-sm font-medium text-white hover:bg-error/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingWidgetId === widgetToDelete ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
