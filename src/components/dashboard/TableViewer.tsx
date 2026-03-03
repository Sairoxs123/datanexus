import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Table2 } from "lucide-react";
import api from "../../utils/api";
import VirtualDataTable from "./VirtualDataTable";

interface TableViewerProps {
  tableName: string | null;
}

export default function TableViewer({ tableName }: TableViewerProps) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PAGE_SIZE = 100;

  const fetchTableData = useCallback(async (table: string, pageOffset: number) => {
    setLoading(true);
    setError("");
    try {
      // First get column names via DESCRIBE
      const descResp = await api.post("/execute-sql", null, {
        params: { query_str: `DESCRIBE ${table}` },
      });
      const colNames: string[] = descResp.data.results?.map((r: any) => String(r.column_name)) ?? [];
      setColumns(colNames);

      // Then get actual data
      const dataResp = await api.get("/sql/get-selected-table-data", {
        params: { table_name: table, offset: pageOffset },
      });

      const rawRows: unknown[][] = dataResp.data.rows ?? [];
      const mappedRows = rawRows.map((row) => {
        const record: Record<string, unknown> = {};
        colNames.forEach((col, index) => {
          record[col] = row[index];
        });
        return record;
      });

      setRows(mappedRows);
      if (pageOffset === 0 && dataResp.data.row_count) {
        const count = Array.isArray(dataResp.data.row_count[0])
          ? dataResp.data.row_count[0][0]
          : dataResp.data.row_count[0];
        setRowCount(Number(count));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load table data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tableName) {
      setOffset(0);
      setRows([]);
      setColumns([]);
      setRowCount(0);
      fetchTableData(tableName, 0);
    }
  }, [tableName, fetchTableData]);

  const handlePrev = () => {
    if (!tableName || offset === 0) return;
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    fetchTableData(tableName, newOffset);
  };

  const handleNext = () => {
    if (!tableName || offset + PAGE_SIZE >= rowCount) return;
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchTableData(tableName, newOffset);
  };

  if (!tableName) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-secondary">
        <div className="text-center">
          <Table2 className="w-16 h-16 text-text-faint mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-text-muted">Select a table to view its data</p>
        </div>
      </div>
    );
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Table2 className="w-5 h-5 text-primary" strokeWidth={2} />
            <h2 className="text-base font-semibold text-text">{tableName}</h2>
          </div>
          {rowCount > 0 && (
            <span className="text-xs text-text-muted bg-bg-tertiary px-2.5 py-1 rounded-md border border-border-light font-medium">
              {rowCount.toLocaleString()} rows
            </span>
          )}
        </div>

        {/* Pagination */}
        {rowCount > PAGE_SIZE && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handlePrev}
                disabled={offset === 0 || loading}
                className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-text hover:bg-bg-hover border border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                disabled={offset + PAGE_SIZE >= rowCount || loading}
                className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-text hover:bg-bg-hover border border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-text-muted">Loading data...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <div className="flex items-center gap-3 px-4 py-3 bg-error-light border border-error/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-error shrink-0" />
            <span className="text-error text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary">
          <p className="text-text-muted">No data in this table</p>
        </div>
      ) : (
        <VirtualDataTable
          columns={columns}
          rows={rows}
          rowNumberOffset={offset}
          emptyText="No rows in this table"
        />
      )}
    </div>
  );
}
