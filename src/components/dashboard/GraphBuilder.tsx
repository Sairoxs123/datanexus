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
  Database,
  CheckCircle2,
  Settings2,
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
  { type: "bar", label: "Bar Chart", icon: BarChart3 },
  { type: "line", label: "Line Chart", icon: LineChart },
  { type: "area", label: "Area Chart", icon: AreaChart },
  { type: "pie", label: "Pie Chart", icon: PieChart },
];

const VAR_TYPES = ["text", "number", "date", "datetime"];

interface GraphBuilderProps {
  onBack: () => void;
}

export default function GraphBuilder({ onBack }: GraphBuilderProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [cleanedQuery, setCleanedQuery] = useState("");
  const [variables, setVariables] = useState<ExtractedVariable[]>([]);
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [rowLimitWarning, setRowLimitWarning] = useState<string | null>(null);

  // Chart config
  const [widgetName, setWidgetName] = useState("");
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [aggType, setAggType] = useState("COUNT");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.max(200, Math.min(ta.scrollHeight, 400)) + "px";
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
    setRowLimitWarning(null);

    const cleaned = query.trim().replace(/;+\s*$/, "");
    setCleanedQuery(cleaned);

    const vars = extractVariables();
    if (vars.length > 0) {
      setVariables(vars);
      setStep(2);
    } else {
      fetchSchema([], cleaned);
    }
  };

  const fetchSchema = async (vars: ExtractedVariable[], cleanedQueryStr?: string) => {
    setLoading(true);
    setError("");

    const queryToUse = cleanedQueryStr || query.trim().replace(/;+\s*$/, "");

    try {
      const payload = {
        query_str: queryToUse,
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
      const rows: number = response.data.row_count ?? 0;
      setRowCount(rows);
      setSchema(cols);

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
          "Failed to validate query."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueFromVariables = () => {
    const cleaned = cleanedQuery || query.trim().replace(/;+\s*$/, "");
    fetchSchema(variables, cleaned);
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

  const yAxisColumn = schema.find((c) => c.name === yAxis);
  const yAxisType = yAxisColumn?.type;

  const getAvailableAggFunctions = () => {
    if (yAxisType === "numeric") {
      return [
        { value: "NONE", label: "Raw Data" },
        { value: "COUNT", label: "Count" },
        { value: "COUNT_DISTINCT", label: "Count Distinct" },
        { value: "SUM", label: "Sum" },
        { value: "AVG", label: "Average" },
        { value: "MIN", label: "Minimum" },
        { value: "MAX", label: "Maximum" },
      ];
    } else {
      return [
        { value: "COUNT", label: "Count" },
        { value: "COUNT_DISTINCT", label: "Count Distinct" },
      ];
    }
  };

  const availableAggFunctions = getAvailableAggFunctions();

  useEffect(() => {
    const validAggTypes = availableAggFunctions.map((agg) => agg.value);
    if (!validAggTypes.includes(aggType)) {
      setAggType(validAggTypes[0]);
    }
  }, [yAxis, availableAggFunctions, aggType]);

  const graphRowLimits: { [key in ChartType]: number } = {
    pie: 20,
    bar: 500,
    line: 5000,
    area: 5000,
  };

  const handleChartTypeChange = (newType: ChartType) => {
    setChartType(newType);
    setRowLimitWarning(null);

    if (rowCount !== null && rowCount > graphRowLimits[newType]) {
      setRowLimitWarning(
        `Your query returns ${rowCount.toLocaleString()} rows, but a ${newType} chart is optimized for up to ${graphRowLimits[newType].toLocaleString()} rows. Data will be sampled.`
      );
    }
  };

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
        return "text-primary border-primary/30 bg-primary/5";
      case "temporal":
        return "text-tertiary border-tertiary/30 bg-tertiary/5";
      default:
        return "text-success border-success/30 bg-success/5";
    }
  };

  const handleCreateWidget = async () => {
    if (!xAxis || !yAxis) return;
    if (!widgetName.trim()) {
      setError("Please provide a name for the chart.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const graphLayout = {
        title: widgetName.trim(),
        graph_type: chartType,
        base_sql: cleanedQuery,
        config: {
          x_axis: xAxis,
          y_axis: yAxis,
          agg_type: aggType,
          is_raw_data: aggType === "NONE",
          is_sampled: rowCount !== null && rowCount > graphRowLimits[chartType],
          variables: variables.length > 0
            ? variables.map((v) => ({
                name: v.name,
                default: v.default,
                type: v.type,
              }))
            : null,
        },
      };

      await api.post("/save-graph-layout", graphLayout);
      onBack();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save chart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-dim overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 shrink-0 bg-surface border-b border-outline-variant">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-dim border border-outline-variant transition-colors bg-white shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
               <h1 className="text-xl font-bold text-on-surface tracking-tight">Create Chart</h1>
               <p className="text-sm font-medium text-on-surface-variant">Build a new visualization for your dashboard</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            {[
              { num: 1, label: "Query" },
              { num: 2, label: "Variables" },
              { num: 3, label: "Chart Options" },
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step > num
                        ? "bg-primary text-white"
                        : step === num
                        ? "bg-primary/10 text-primary border-2 border-primary"
                        : "bg-surface text-on-surface-variant border border-outline-variant"
                    }`}
                  >
                    {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
                  </div>
                  <span
                    className={`text-sm font-medium hidden md:block ${
                      step >= num ? "text-on-surface" : "text-on-surface-variant"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {num < 3 && (
                   <div className={`w-8 h-px hidden md:block ${step > num ? "bg-primary" : "bg-outline-variant"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* STEP 1: Query */}
          {step === 1 && (
            <div className="bg-surface rounded-xl border border-outline-variant p-8 shadow-sm fade-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                   <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-on-surface">Data Source</h3>
                   <p className="text-sm font-medium text-on-surface-variant">Write a SQL query to fetch data for your chart</p>
                </div>
              </div>
                 
              <div className="mb-6">
                 <textarea
                   ref={textareaRef}
                   value={query}
                   onChange={(e) => {
                     let value = e.target.value;
                     if (value.length > query.length && value.trim().endsWith(";")) {
                       value = value.replace(/;+\s*$/, "");
                     }
                     setQuery(value);
                   }}
                   onKeyDown={handleKeyDown}
                   placeholder="SELECT * FROM table_name..."
                   spellCheck={false}
                   className="w-full px-6 py-5 rounded-xl bg-surface-dim border border-outline focus:border-primary focus:ring-1 focus:ring-primary text-on-surface resize-none font-mono text-sm leading-relaxed outline-none transition-all"
                   style={{ minHeight: 200 }}
                 />
                 <div className="mt-2 text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Use $variable_name syntax to add dynamic filters
                 </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-error/10 border border-error/20 mb-6 text-error">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end pt-6 border-t border-outline-variant">
                <button
                  onClick={handleValidateQuery}
                  disabled={!query.trim() || loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                  {loading ? "Validating..." : "Validate & Continue"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Variables */}
          {step === 2 && (
            <div className="bg-surface rounded-xl border border-outline-variant p-8 shadow-sm fade-up">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                     <Variable className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-on-surface">Configure Variables</h3>
                     <p className="text-sm font-medium text-on-surface-variant">
                       We detected {variables.length} variable{variables.length !== 1 ? "s" : ""} in your query.
                     </p>
                  </div>
               </div>

               <div className="space-y-6 mb-8">
                 {variables.map((v, i) => (
                   <div key={v.name} className="p-6 rounded-xl border border-outline-variant bg-surface-dim">
                     <div className="flex items-center gap-3 mb-4">
                       <span className="px-3 py-1 rounded-md bg-white border border-outline-variant font-mono text-sm font-bold text-primary shadow-sm">
                         ${v.name}
                       </span>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                         <label className="block text-sm font-medium text-on-surface-variant mb-2">Data Type</label>
                         <select
                           value={v.type}
                           onChange={(e) => updateVariable(i, "type", e.target.value)}
                           className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                         >
                           {VAR_TYPES.map((t) => (
                             <option key={t} value={t}>{t}</option>
                           ))}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-on-surface-variant mb-2">Default Value</label>
                         <input
                           type={
                             v.type === "number" ? "number" : v.type === "date" ? "date" : v.type === "datetime" ? "datetime-local" : "text"
                           }
                           value={v.default}
                           onChange={(e) => updateVariable(i, "default", e.target.value)}
                           className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                         />
                       </div>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="flex items-center justify-between pt-6 border-t border-outline-variant">
                 <button
                   onClick={() => { setStep(1); setError(""); }}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-dim transition-colors"
                 >
                   Back to Query
                 </button>
                 <button
                   onClick={handleContinueFromVariables}
                   disabled={loading}
                   className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                 >
                   {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                   {loading ? "Validating..." : "Continue to Chart"}
                 </button>
               </div>
            </div>
          )}

          {/* STEP 3: Chart Configuration */}
          {step === 3 && (
            <div className="space-y-6 fade-up">
              
              {/* Schema Map */}
              <div className="bg-surface rounded-xl border border-outline-variant p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                       <Columns3 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-on-surface">Data Schema</h3>
                       <p className="text-sm font-medium text-on-surface-variant">The query returned {schema.length} columns and {rowCount?.toLocaleString()} rows.</p>
                    </div>
                 </div>
                 
                 <div className="rounded-lg border border-outline-variant overflow-hidden">
                   <table className="w-full text-left text-sm">
                     <thead>
                       <tr className="bg-surface-dim border-b border-outline-variant">
                         <th className="px-6 py-3 font-semibold text-on-surface-variant">Column Name</th>
                         <th className="px-6 py-3 font-semibold text-on-surface-variant">Data Type</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-outline-variant bg-white">
                       {schema.map((col) => (
                         <tr key={col.name}>
                           <td className="px-6 py-3 font-mono font-medium text-on-surface">{col.name}</td>
                           <td className="px-6 py-3">
                             <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${typeColor(col.type)}`}>
                               {col.type}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>

              {/* Chart Settings */}
              <div className="bg-surface rounded-xl border border-outline-variant p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                       <Settings2 className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-on-surface">Configure Visualization</h3>
                 </div>
                 
                 <div className="space-y-8">
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Widget Name</label>
                      <input
                        type="text"
                        value={widgetName}
                        onChange={(e) => { setWidgetName(e.target.value); if (error) setError(""); }}
                        placeholder="e.g. Sales by Month"
                        className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-white text-base font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-on-surface mb-2">X-Axis</label>
                        <select
                          value={xAxis}
                          onChange={(e) => setXAxis(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        >
                          {schema.map((col) => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-on-surface mb-2">Y-Axis</label>
                        <select
                          value={yAxis}
                          onChange={(e) => setYAxis(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        >
                          <option value="">-- Select a column --</option>
                          {schema.map((col) => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {yAxis && (
                      <div className="animate-in fade-in duration-300">
                        <label className="block text-sm font-semibold text-on-surface mb-3">
                          Aggregation Method
                        </label>
                        <div className="flex flex-wrap gap-2">
                           {availableAggFunctions.map((agg) => (
                              <button
                                key={agg.value}
                                onClick={() => setAggType(agg.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                  aggType === agg.value
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-on-surface-variant border-outline-variant hover:border-primary/50 hover:bg-surface-dim"
                                }`}
                              >
                                {agg.label}
                              </button>
                           ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-3">
                        Chart Type
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {CHART_TYPES.map(({ type, label, icon: Icon }) => (
                          <button
                            key={type}
                            onClick={() => handleChartTypeChange(type)}
                            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all ${
                              chartType === type
                                ? "bg-primary/5 text-primary border-primary ring-1 ring-primary"
                                : "bg-white text-on-surface-variant border-outline-variant hover:border-primary/50"
                            }`}
                          >
                            <Icon className={`w-8 h-8 ${chartType === type ? "text-primary" : ""}`} strokeWidth={1.5} />
                            <span className="text-sm font-medium">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>

                 {/* Errors and Warnings */}
                 <div className="mt-8 pt-8 border-t border-outline-variant space-y-4">
                    {rowLimitWarning && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{rowLimitWarning}</p>
                      </div>
                    )}

                    {error && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-error/10 border border-error/20 text-sm font-medium text-error">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                      </div>
                    )}
                 </div>

                 <div className="flex items-center justify-between mt-8">
                   <button
                     onClick={() => { setStep(variables.length > 0 ? 2 : 1); setError(""); }}
                     className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-dim transition-colors"
                   >
                     Back
                   </button>
                   <button
                     onClick={handleCreateWidget}
                     disabled={!widgetName.trim() || !xAxis || !yAxis || loading}
                     className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                   >
                     {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                     {loading ? "Saving..." : "Create Chart"}
                   </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
