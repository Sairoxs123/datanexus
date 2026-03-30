import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Play,
  Loader2,
  AlertCircle,
  Code2,
  Settings,
  RefreshCw,
  Trash2,
} from "lucide-react";
import GraphWidgetRenderer, {
  type ChartPoint,
  type GraphLayout,
  type WidgetCardData,
} from "./GraphWidgetRenderer";
import api from "../../utils/api";

interface GraphDetailViewProps {
  layout: GraphLayout;
  onBack: () => void;
  onWidgetDeleted?: () => void;
}

interface SQLVariable {
  name: string;
  default: string;
  type: string;
  description?: string;
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

export default function GraphDetailView({ layout, onBack, onWidgetDeleted }: GraphDetailViewProps) {
  const [widget, setWidget] = useState<WidgetCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isEditingVariables, setIsEditingVariables] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize variables from layout
  useEffect(() => {
    if (layout.config.variables) {
      const initialVars: Record<string, string> = {};
      layout.config.variables.forEach((variable: SQLVariable) => {
        initialVars[variable.name] = variable.default;
      });
      setVariables(initialVars);
    }
  }, [layout]);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create a modified layout with current variable values
      const modifiedLayout = {
        ...layout,
        config: {
          ...layout.config,
          variables: layout.config.variables?.map((variable: SQLVariable) => ({
            ...variable,
            default: variables[variable.name] || variable.default,
          })),
        },
      };

      const response = await api.post<{ results?: unknown[]; error?: string }>(
        "/execute-chart-sql",
        modifiedLayout
      );

      if (response.data.error) {
        setWidget({
          layout,
          points: [],
          error: response.data.error,
        });
      } else {
        setWidget({
          layout,
          points: toChartPoints(response.data.results ?? []),
        });
      }
    } catch (err) {
      console.error("Failed to execute query:", err);
      setError("Failed to execute query. Please try again.");
      setWidget({
        layout,
        points: [],
        error: "Failed to execute query.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    executeQuery();
  }, []);

  const handleVariableChange = (varName: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [varName]: value,
    }));
  };

  const handleExecuteWithNewVariables = () => {
    setIsEditingVariables(false);
    executeQuery();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await api.post("/delete-graph-widget", { widget_id: layout.id });
      if (onWidgetDeleted) {
        onWidgetDeleted();
      }
      onBack();
    } catch (err) {
      console.error("Failed to delete widget:", err);
      setError("Failed to delete widget. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const formatSQL = (sql: string) => {
    // Basic SQL formatting for display
    return sql
      .replace(/\s+/g, ' ')
      .replace(/,\s*/g, ',\n  ')
      .replace(/\s+FROM\s+/g, '\nFROM ')
      .replace(/\s+WHERE\s+/g, '\nWHERE ')
      .replace(/\s+GROUP BY\s+/g, '\nGROUP BY ')
      .replace(/\s+ORDER BY\s+/g, '\nORDER BY ')
      .replace(/\s+LIMIT\s+/g, '\nLIMIT ')
      .trim();
  };

  return (
    <div className="h-screen flex flex-col bg-surface-dim overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 shrink-0 bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="group flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <div className="w-px h-6 bg-outline-variant" />
            <div>
              <h1 className="text-xl font-bold text-on-surface tracking-tight">{layout.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  {layout.graph_type} Chart
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditingVariables(!isEditingVariables)}
              className="px-4 py-2 rounded-lg bg-surface border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2 shadow-sm"
            >
              <Settings className="w-4 h-4" />
              {isEditingVariables ? "Hide Variables" : "Edit Variables"}
            </button>
            <button
              onClick={executeQuery}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-error text-sm font-medium text-white hover:bg-error/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Chart Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Chart Widget */}
              <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
                <div className="h-[400px]">
                  {widget ? (
                    <GraphWidgetRenderer widget={widget} height="h-full" />
                  ) : loading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="flex items-center gap-3 text-on-surface-variant">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Loading chart...</span>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="flex items-center gap-3 text-error">
                        <AlertCircle className="w-6 h-6" />
                        <span>{error}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* SQL Query Display */}
              <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Code2 className="w-5 h-5 text-on-surface-variant" />
                  <h3 className="text-lg font-semibold text-on-surface">Generated SQL Query</h3>
                </div>
                <div className="bg-surface-container-highest rounded-lg p-4 font-mono text-sm text-on-surface border border-outline-variant">
                  <pre className="whitespace-pre-wrap overflow-x-auto">
                    {formatSQL(layout.base_sql)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Configuration Section */}
            <div className="space-y-6">
              {/* Chart Configuration */}
              <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-on-surface mb-4">Chart Configuration</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-on-surface-variant">Chart Type</span>
                    <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                      {layout.graph_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-on-surface-variant">X-Axis</span>
                    <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                      {layout.config.x_axis}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-on-surface-variant">Y-Axis</span>
                    <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                      {layout.config.y_axis}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-on-surface-variant">Aggregation</span>
                    <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                      {layout.config.agg_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Variables Editor */}
              {layout.config.variables && layout.config.variables.length > 0 && (
                <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Query Variables</h3>
                  {isEditingVariables ? (
                    <div className="space-y-4">
                      {layout.config.variables.map((variable: SQLVariable) => (
                        <div key={variable.name} className="space-y-2">
                          <label className="block text-sm font-medium text-on-surface-variant">
                            {variable.name}
                            {variable.description && (
                              <span className="text-xs opacity-75 ml-2">({variable.description})</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={variables[variable.name] || variable.default}
                            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                            className="w-full px-3 py-2 bg-surface-container-highest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder={variable.default}
                          />
                          <div className="text-xs text-on-surface-variant">
                            Type: {variable.type} | Default: {variable.default}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleExecuteWithNewVariables}
                        disabled={loading}
                        className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Execute with New Variables
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {layout.config.variables.map((variable: SQLVariable) => (
                        <div key={variable.name} className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-medium text-on-surface">{variable.name}</div>
                            {variable.description && (
                              <div className="text-xs text-on-surface-variant">{variable.description}</div>
                            )}
                          </div>
                          <div className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                            {variables[variable.name] || variable.default}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Data Summary */}
              {widget && !widget.error && (
                <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Data Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-on-surface-variant">Data Points</span>
                      <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                        {widget.points.length}
                      </span>
                    </div>
                    {widget.points.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-on-surface-variant">Min Y Value</span>
                          <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                            {Math.min(...widget.points.map(p => p.y)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-on-surface-variant">Max Y Value</span>
                          <span className="text-sm font-mono bg-surface-container-highest px-2 py-1 rounded">
                            {Math.max(...widget.points.map(p => p.y)).toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-error text-sm font-medium text-white hover:bg-error/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
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
