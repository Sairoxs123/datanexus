import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Table2 } from "lucide-react";
import api from "../../utils/api";
import VirtualDataTable from "./VirtualDataTable";

interface TableViewerProps {
  tableName: string | null;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 300, 400, 500];

export default function TableViewer({ tableName }: TableViewerProps) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTableData = useCallback(async (table: string, pageOffset: number, limit: number) => {
    setLoading(true);
    setError("");
    try {
      // Get actual data (pandas returns array of objects with orient='records')
      const dataResp = await api.get("/sql/get-selected-table-data", {
        params: { table_name: table, offset: pageOffset, limit },
      });

      const rowsData: Array<Record<string, unknown>> = dataResp.data.rows ?? [];

      // Extract column names from first row if available
      if (rowsData.length > 0) {
        setColumns(Object.keys(rowsData[0]));
      } else {
        // If no rows, get columns from DESCRIBE
        const descResp = await api.post("/execute-sql", null, {
          params: { query_str: `DESCRIBE ${table}` },
        });
        const colNames: string[] = descResp.data.results?.map((r: any) => String(r.column_name)) ?? [];
        setColumns(colNames);
      }

      setRows(rowsData);

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
      fetchTableData(tableName, 0, pageSize);
    }
  }, [tableName, fetchTableData, pageSize]);

  const handlePrev = () => {
    if (!tableName || offset === 0) return;
    const newOffset = Math.max(0, offset - pageSize);
    setOffset(newOffset);
    fetchTableData(tableName, newOffset, pageSize);
  };

  const handleNext = () => {
    if (!tableName || offset + pageSize >= rowCount) return;
    const newOffset = offset + pageSize;
    setOffset(newOffset);
    fetchTableData(tableName, newOffset, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setOffset(0);
    if (tableName) {
      fetchTableData(tableName, 0, newSize);
    }
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

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-bg-secondary shrink-0">
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

        {/* Pagination & Controls */}
        <div className="flex items-center gap-4">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              disabled={loading}
              className="text-sm px-2.5 py-1.5 rounded-md border border-border bg-bg-secondary text-text font-medium hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-40 cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Pagination */}
          {rowCount > pageSize && (
            <>
              <div className="w-px h-5 bg-border" />
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
                    disabled={offset + pageSize >= rowCount || loading}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-text hover:bg-bg-hover border border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
