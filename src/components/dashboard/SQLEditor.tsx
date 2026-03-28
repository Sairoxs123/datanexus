import { useState, useRef, useEffect } from "react";
import { Play, Loader2, AlertCircle, Clock, CheckCircle2, Terminal } from "lucide-react";
import api from "../../utils/api";
import VirtualDataTable from "./VirtualDataTable";

export default function SQLEditor() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Record<string, unknown>> | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.max(160, Math.min(ta.scrollHeight, 400)) + "px";
    }
  }, [query]);

  const executeQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults(null);
    setColumns([]);
    setExecutionTime(null);

    const start = performance.now();
    try {
      const response = await api.post("/execute-sql", null, {
        params: { query_str: query.trim() },
      });
      const elapsed = performance.now() - start;
      setExecutionTime(elapsed);

      const data = response.data.results ?? [];
      setResults(data);
      if (data.length > 0) {
        setColumns(Object.keys(data[0]));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || "Query execution failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Editor Region */}
      <div className="px-6 py-5 shrink-0 bg-surface-dim border-b border-outline-variant">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-white border border-outline-variant flex items-center justify-center shadow-sm text-on-surface-variant">
                <Terminal className="w-4 h-4" />
             </div>
             <div>
                <h3 className="text-base font-bold text-on-surface tracking-tight">SQL Editor</h3>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-on-surface-variant">Cmd/Ctrl + Enter to run</span>
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" fill="currentColor" />
              )}
              Run Query
            </button>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-outline shadow-sm bg-white">
           <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="-- Type your SQL query here. Press Cmd + Enter to run."
            spellCheck={false}
            className="w-full px-4 py-4 bg-transparent text-on-surface placeholder-on-surface-variant/50 resize-none font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20"
            style={{ minHeight: 160 }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-2 flex items-center gap-6 shrink-0 bg-surface border-b border-outline-variant text-sm">
         {(executionTime !== null || error) ? (
           <div className="flex items-center gap-4">
             {error ? (
                <div className="flex items-center gap-1.5 text-error font-medium">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-success font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Success
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <Clock className="w-4 h-4" />
                    {executionTime! < 1000
                      ? `${Math.round(executionTime!)}ms`
                      : `${(executionTime! / 1000).toFixed(2)}s`}
                  </div>
                  {results && (
                    <div className="text-on-surface-variant">
                      {results.length.toLocaleString()} rows returned
                    </div>
                  )}
                </>
              )}
           </div>
         ) : (
           <div className="text-on-surface-variant italic">Ready</div>
         )}
      </div>

      {/* Results View */}
      <div className="flex-1 min-h-0 relative bg-white">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
            <span className="text-sm font-medium text-on-surface">Executing query...</span>
          </div>
        ) : results === null && !error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-on-surface-variant opacity-60">
              <Terminal className="w-10 h-10 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">Run a query to view results</p>
            </div>
          </div>
        ) : results && results.length > 0 ? (
          <VirtualDataTable
            columns={columns}
            rows={results}
            rowNumberOffset={0}
            emptyText="No rows returned"
          />
        ) : results && results.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant">
            <p className="text-sm font-medium">Query executed successfully but returned 0 rows.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
