import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Basecards, Table2 } from "lucide-react";
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
      const dataResp = await api.get("/sql/get-selected-table-data", {
        params: { table_name: table, offset: pageOffset, limit },
      });

      const rowsData: Array<Record<string, unknown>> = dataResp.data.rows ?? [];

      if (rowsData.length > 0) {
        setColumns(Object.keys(rowsData[0]));
      } else {
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
      setError(err.response?.data?.error || "Failed to fetch table data");
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
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <Table2 className="w-5 h-5" />
          <span className="text-sm font-medium">Select a table from the sidebar</span>
        </div>
      </div>
    );
  }

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-on-surface truncate pr-2 border-r border-outline-variant">{tableName}</h2>
          
          {rowCount > 0 && (
            <span className="text-sm font-medium text-on-surface-variant">
              {rowCount.toLocaleString()} rows
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Page Size */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface-variant">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              disabled={loading}
              className="text-sm font-medium px-2 py-1.5 rounded-md border border-outline-variant bg-surface text-on-surface hover:border-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50 cursor-pointer outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-outline-variant" />

          {/* Navigation */}
          <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-on-surface pr-1">
               {currentPage} of {totalPages}
             </span>
             
             <div className="flex gap-1">
                <button
                  onClick={handlePrev}
                  disabled={offset === 0 || loading}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface hover:bg-surface-dim transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={offset + pageSize >= rowCount || loading}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface hover:bg-surface-dim transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-50">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
            <span className="text-sm font-medium text-on-surface">Loading data...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/20 rounded-lg text-error max-w-md">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm mb-1">Error Loading Data</h3>
                <p className="text-sm text-error/80">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <VirtualDataTable
            columns={columns}
            rows={rows}
            rowNumberOffset={offset}
            emptyText="No rows found"
          />
        )}
      </div>
    </div>
  );
}
