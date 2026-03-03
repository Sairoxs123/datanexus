import { useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database } from "lucide-react";

interface VirtualDataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowNumberOffset?: number;
  emptyText?: string;
  maxBodyHeight?: number;
}

type TableRow = Record<string, unknown>;

const columnHelper = createColumnHelper<TableRow>();

export default function VirtualDataTable({
  columns,
  rows,
  rowNumberOffset = 0,
  emptyText = "No data available",
  maxBodyHeight = 560,
}: VirtualDataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const tableColumns = useMemo(() => {
    const rowNumberCol = columnHelper.display({
      id: "__row",
      header: "#",
      cell: ({ row }) => (
        <span className="text-text-muted font-mono text-xs">
          {rowNumberOffset + row.index + 1}
        </span>
      ),
      size: 60,
    });

    const dataColumns = columns.map((key) =>
      columnHelper.accessor((originalRow) => originalRow[key], {
        id: key,
        header: key,
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined) {
            return <span className="text-text-faint italic text-xs">NULL</span>;
          }
          return <span className="text-text">{String(value)}</span>;
        },
      })
    );

    return [rowNumberCol, ...dataColumns];
  }, [columns, rowNumberOffset]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-secondary">
        <Database className="w-16 h-16 text-text-faint mb-4" strokeWidth={1.5} />
        <p className="text-text-muted text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 min-h-0 overflow-auto bg-bg-secondary"
      style={{ maxHeight: maxBodyHeight }}
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border"
                  style={{ width: header.id === "__row" ? 60 : undefined }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody
          className="bg-bg-secondary"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            return (
              <tr
                key={row.id}
                className="absolute left-0 right-0 hover:bg-bg-hover transition-colors border-b border-border-light"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                  width: "100%",
                  display: "table",
                  tableLayout: "fixed",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2.5 text-sm"
                    style={{ width: cell.column.id === "__row" ? 60 : undefined }}
                    title={String(cell.getValue() ?? "")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
