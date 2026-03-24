import { useState, useRef, useEffect } from "react";
import {
  Play,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Variable,
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  Columns3,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import api from "../../utils/api";

interface ExtractedVariable {
  name: string;
  type: string;
  default: string;
}

interface ColumnSchema {
  name: string;
  type: "numeric" | "temporal" | "categorical";
}

type ChartType = "bar" | "line" | "area" | "pie";

const CHART_TYPES: { type: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { type: "bar", label: "Bar", icon: BarChart3 },
  { type: "line", label: "Line", icon: LineChart },
  { type: "area", label: "Area", icon: AreaChart },
  { type: "pie", label: "Pie", icon: PieChart },
];

const VAR_TYPES = ["text", "number", "date"];

interface GraphBuilderProps {
  onBack: () => void;
}

export default function GraphBuilder({ onBack }: GraphBuilderProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [variables, setVariables] = useState<ExtractedVariable[]>([]);
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chart config
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.max(160, Math.min(ta.scrollHeight, 360)) + "px";
    }
  }, [query]);

  const extractVariables = () => {
    const regex = /\$(\w+)/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(query)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches).map((name) => ({
      name,
      type: "text",
      default: "",
    }));
  };

  const handleValidateQuery = () => {
    if (!query.trim()) return;
    setError("");

    const vars = extractVariables();
    if (vars.length > 0) {
      setVariables(vars);
      setStep(2);
    } else {
      // No variables, go straight to fetching schema
      fetchSchema([]);
    }
  };

  const fetchSchema = async (vars: ExtractedVariable[]) => {
    setLoading(true);
    setError("");

    try {
      const payload = {
        query_str: query.trim(),
        variables: vars.length > 0
          ? vars.map((v) => ({
              name: v.name,
              type: v.type,
              default: v.default,
            }))
          : null,
      };

      const response = await api.post("/fetch-query-format", payload);

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      const cols: ColumnSchema[] = response.data.schema ?? [];
      setSchema(cols);

      // Auto-select defaults
      if (cols.length > 0) {
        setXAxis(cols[0].name);
        const firstNumeric = cols.find((c) => c.type === "numeric");
        setYAxis(firstNumeric?.name ?? "");
      }

      setStep(3);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to validate query"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueFromVariables = () => {
    fetchSchema(variables);
  };

  const updateVariable = (
    index: number,
    field: "type" | "default",
    value: string
  ) => {
    setVariables((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const numericColumns = schema.filter((c) => c.type === "numeric");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleValidateQuery();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      setQuery(query.substring(0, start) + "  " + query.substring(end));
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      }, 0);
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "numeric":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "temporal":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-hover transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-text">
              Create Graph Widget
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Write a query, configure variables, and pick your chart
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-3 mt-5">
          {[
            { num: 1, label: "Query" },
            { num: 2, label: "Variables" },
            { num: 3, label: "Chart Setup" },
          ].map(({ num, label }, i) => (
            <div key={num} className="flex items-center gap-3">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${
                    step >= num ? "bg-primary" : "bg-border"
                  } transition-colors`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step > num
                      ? "bg-primary text-white"
                      : step === num
                      ? "bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "bg-bg-tertiary text-text-faint"
                  }`}
                >
                  {step > num ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    num
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    step >= num ? "text-text" : "text-text-faint"
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* STEP 1: Query Input */}
          {step === 1 && (
            <div className="animate-in fade-in">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-text mb-2">
                  SQL Query
                </label>
                <p className="text-sm text-text-muted mb-4">
                  Use <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs font-mono text-primary">$variable_name</code> syntax for dynamic parameters.
                </p>
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`SELECT category, SUM(amount) as total\nFROM transactions\nWHERE date > $start_date\nGROUP BY category`}
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border text-text placeholder-text-faint resize-none font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  style={{ minHeight: 160 }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-error-light border border-error/20 mb-6">
                  <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  Ctrl+Enter to validate
                </span>
                <button
                  onClick={handleValidateQuery}
                  disabled={!query.trim() || loading}
                  className="btn btn-primary"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Validate Query
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Variable Configuration */}
          {step === 2 && (
            <div className="animate-in fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Variable className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text">
                    Configure Variables
                  </h3>
                  <p className="text-sm text-text-muted">
                    {variables.length} variable
                    {variables.length !== 1 ? "s" : ""} detected in your query
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {variables.map((v, i) => (
                  <div
                    key={v.name}
                    className="p-4 rounded-xl bg-bg-secondary border border-border hover:border-border-dark transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <code className="px-2 py-1 bg-primary/8 text-primary rounded-md text-sm font-mono font-medium">
                        ${v.name}
                      </code>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">
                          Type
                        </label>
                        <select
                          value={v.type}
                          onChange={(e) =>
                            updateVariable(i, "type", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                        >
                          {VAR_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">
                          Default Value
                        </label>
                        <input
                          type={v.type === "number" ? "number" : v.type === "date" ? "date" : "text"}
                          value={v.default}
                          onChange={(e) =>
                            updateVariable(i, "default", e.target.value)
                          }
                          placeholder={
                            v.type === "number"
                              ? "0"
                              : v.type === "date"
                              ? "2025-01-01"
                              : "value"
                          }
                          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-error-light border border-error/20 mb-6">
                  <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setStep(1);
                    setError("");
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Query
                </button>
                <button
                  onClick={handleContinueFromVariables}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Columns3 className="w-4 h-4" />
                  )}
                  Fetch Schema
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Chart Configuration */}
          {step === 3 && (
            <div className="animate-in fade-in">
              {/* Column schema table */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                  Columns Returned
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-tertiary">
                        <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">
                          Column
                        </th>
                        <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.map((col, i) => (
                        <tr
                          key={col.name}
                          className={
                            i % 2 === 0 ? "bg-bg-secondary" : "bg-bg"
                          }
                        >
                          <td className="px-4 py-2.5 font-mono text-text">
                            {col.name}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${typeColor(
                                col.type
                              )}`}
                            >
                              {col.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Axis selection */}
              <div className="grid grid-cols-2 gap-5 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-text mb-2">
                    X Axis
                  </label>
                  <select
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    {schema.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-2">
                    Y Axis
                    <span className="text-xs font-normal text-text-muted ml-2">
                      (numeric only)
                    </span>
                  </label>
                  <select
                    value={yAxis}
                    onChange={(e) => setYAxis(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    {numericColumns.length === 0 ? (
                      <option value="">No numeric columns</option>
                    ) : (
                      numericColumns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Chart type picker */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-text mb-3">
                  Chart Type
                </label>
                <div className="flex gap-2">
                  {CHART_TYPES.map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        chartType === type
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : "bg-bg-secondary text-text-muted border-border hover:border-border-dark hover:text-text"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setStep(variables.length > 0 ? 2 : 1);
                    setError("");
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {variables.length > 0 ? "Back to Variables" : "Back to Query"}
                </button>
                <button
                  disabled={!xAxis || !yAxis}
                  className="btn btn-primary"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Widget
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
