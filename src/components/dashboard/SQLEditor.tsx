import { useState, useRef, useEffect } from "react";
import { Play, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
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
      ta.style.height = Math.max(120, Math.min(ta.scrollHeight, 300)) + "px";
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
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
    // Tab to indent
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-secondary">
      {/* Editor area */}
      <div className="px-6 py-4 border-b border-border shrink-0 bg-bg-secondary">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text">SQL Query</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Ctrl+Enter to execute</span>
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="btn btn-primary"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" fill="currentColor" />
              )}
              Execute
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM my_table LIMIT 10;"
          spellCheck={false}
          className="w-full px-4 py-3 rounded-lg bg-bg border border-border text-text placeholder-text-faint resize-none font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Status bar */}
      {(executionTime !== null || error) && (
        <div className="px-6 py-2.5 border-b border-border bg-bg-tertiary flex items-center gap-4 shrink-0">
          {error ? (
            <div className="flex items-center gap-2 text-error text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-success text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Success
              </div>
              <div className="flex items-center gap-1.5 text-text-muted text-sm">
                <Clock className="w-3.5 h-3.5" />
                {executionTime! < 1000
                  ? `${Math.round(executionTime!)}ms`
                  : `${(executionTime! / 1000).toFixed(2)}s`}
              </div>
              {results && (
                <span className="text-text-muted text-sm">
                  {results.length} row{results.length !== 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-text-muted">Executing query...</span>
          </div>
        </div>
      ) : results === null && !error ? (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <div className="text-center">
            <Play className="w-16 h-16 text-text-faint mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-text-muted">Write a query and press Execute</p>
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
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <p className="text-text-muted">Query returned no results</p>
        </div>
      ) : null}
    </div>
  );
}
