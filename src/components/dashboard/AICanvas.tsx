import { X, LayoutDashboard, Table2, Rows } from "lucide-react";
import VirtualDataTable from "./VirtualDataTable";

export interface CanvasData {
  rows: Record<string, unknown>[];
  columns: string[];
  sql_query?: string;
  sql_params?: CanvasChartSeedParams;
}

export interface CanvasChartSeedVariable {
  name: string;
  default: unknown;
  type?: string;
  description?: string;
}

export interface CanvasChartSeed {
  sql_query: string;
  sql_params?: CanvasChartSeedParams;
}

export type CanvasChartSeedParams = Record<string, unknown> | CanvasChartSeedVariable[];

interface AICanvasProps {
  data: CanvasData;
  onClose: () => void;
  onAddToDashboard: (seed: CanvasChartSeed) => void;
}

export default function AICanvas({ data, onClose, onAddToDashboard }: AICanvasProps) {
  const canAddToDashboard = Boolean(data.sql_query);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white fade-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Table2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-on-surface">Query Results</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Rows className="w-3 h-3 text-on-surface-variant" />
              <p className="text-xs text-on-surface-variant">
                {data.rows.length.toLocaleString()} rows · {data.columns.length} columns
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!data.sql_query) return;
              onAddToDashboard({ sql_query: data.sql_query, sql_params: data.sql_params });
            }}
            disabled={!canAddToDashboard}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Add to Dashboard
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
            title="Close canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <VirtualDataTable
          columns={data.columns}
          rows={data.rows}
          rowNumberOffset={0}
          emptyText="No data returned"
        />
      </div>
    </div>
  );
}
