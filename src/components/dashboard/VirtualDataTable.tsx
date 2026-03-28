import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table2 } from "lucide-react";

interface VirtualDataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowNumberOffset?: number;
  emptyText?: string;
}

const ROW_NUM_WIDTH = 64;
const COL_WIDTH = 180;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 44;

export default function VirtualDataTable({
  columns,
  rows,
  rowNumberOffset = 0,
  emptyText = "No data found.",
}: VirtualDataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const gridTemplate = useMemo(
    () => `${ROW_NUM_WIDTH}px ${columns.map(() => `${COL_WIDTH}px`).join(" ")}`,
    [columns]
  );

  const totalWidth = useMemo(
    () => ROW_NUM_WIDTH + columns.length * COL_WIDTH,
    [columns]
  );

  const cellBase =
    "px-4 flex items-center text-sm text-on-surface border-r border-outline-variant last:border-r-0 tracking-tight whitespace-nowrap overflow-hidden";
  const headerCellBase =
    "px-4 flex items-center text-xs font-semibold text-on-surface-variant border-r border-outline-variant last:border-r-0";

  if (rows.length === 0) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-surface">
        <div className="w-16 h-16 rounded-full bg-surface-dim flex items-center justify-center mb-4">
          <Table2 className="w-8 h-8 text-outline" />
        </div>
        <p className="text-sm font-medium text-on-surface-variant">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden bg-surface">
      <div ref={parentRef} className="h-full overflow-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 bg-surface-dim border-b border-outline-variant shadow-sm"
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              height: HEADER_HEIGHT,
            }}
          >
            <div className={headerCellBase + " justify-center text-outline"}>
              #
            </div>
            {columns.map((col) => (
              <div
                key={col}
                className={headerCellBase + " truncate"}
                title={col}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div
            className="relative"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  className={`absolute hover:bg-surface-container-highest transition-colors border-b border-outline-variant/50 ${
                    virtualRow.index % 2 === 0 ? "bg-white" : "bg-surface-dim/30"
                  }`}
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    width: totalWidth,
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  {/* Row Number */}
                  <div className="px-3 flex items-center justify-center text-xs text-on-surface-variant/50 border-r border-outline-variant">
                    {rowNumberOffset + virtualRow.index + 1}
                  </div>
                  
                  {/* Cells */}
                  {columns.map((col) => {
                    const value = row[col];
                    const isNull = value == null;
                    return (
                      <div
                        key={col}
                        className={cellBase + " truncate"}
                        title={isNull ? "null" : String(value)}
                      >
                        {isNull ? (
                          <span className="text-on-surface-variant/40 italic">null</span>
                        ) : (
                          <span className="truncate">
                            {String(value)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
