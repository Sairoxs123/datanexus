import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database } from "lucide-react";

interface VirtualDataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowNumberOffset?: number;
  emptyText?: string;
}

const ROW_NUM_WIDTH = 56;
const COL_WIDTH = 160;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 44;

export default function VirtualDataTable({
  columns,
  rows,
  rowNumberOffset = 0,
  emptyText = "No data available",
}: VirtualDataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  // Fixed pixel widths — header and rows always share the same template
  const gridTemplate = useMemo(
    () => `${ROW_NUM_WIDTH}px ${columns.map(() => `${COL_WIDTH}px`).join(" ")}`,
    [columns]
  );

  // Total table width used to size rows absolutely to prevent column squishing
  const totalWidth = useMemo(
    () => ROW_NUM_WIDTH + columns.length * COL_WIDTH,
    [columns]
  );

  const cellBase =
    "px-3 flex items-center justify-center text-sm text-text overflow-hidden";
  const headerCellBase =
    "px-3 flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-text-secondary";

  if (rows.length === 0) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-bg-secondary">
        <Database className="w-16 h-16 text-text-faint mb-4" strokeWidth={1.5} />
        <p className="text-text-muted text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden bg-bg-secondary">
      {/*
        Single scroll container — both axes scroll here.
        Header sits inside with position: sticky; top: 0 so it:
          - scrolls horizontally WITH the data
          - stays pinned to the top while scrolling vertically
      */}
      <div ref={parentRef} className="h-full overflow-auto">
        {/* Min-width wrapper so the scroll container knows the true content width */}
        <div style={{ minWidth: totalWidth }}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 bg-bg-tertiary border-b border-border"
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              height: HEADER_HEIGHT,
            }}
          >
            <div className={headerCellBase + " text-text-muted"}>#</div>
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

          {/* Virtualized rows */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  className="absolute hover:bg-bg-hover transition-colors border-b border-border-light"
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    width: totalWidth,
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  {/* Row number */}
                  <div className={cellBase + " text-text-muted font-mono text-xs"}>
                    {rowNumberOffset + virtualRow.index + 1}
                  </div>
                  {/* Data cells */}
                  {columns.map((col) => {
                    const value = row[col];
                    return (
                      <div
                        key={col}
                        className={cellBase + " truncate"}
                        title={value == null ? "" : String(value)}
                      >
                        {value == null ? (
                          <span className="text-text-faint italic text-xs">NULL</span>
                        ) : (
                          String(value)
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
