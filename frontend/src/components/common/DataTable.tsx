import { ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

interface Column<T extends Row> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends Row> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends Row>({
  columns,
  data,
  emptyMessage = 'No data found',
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className={`px-4 py-3 font-medium text-slate-600 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render ? col.render(row) : String(row[col.key as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
