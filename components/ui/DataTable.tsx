import Link from "next/link";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

/** Simple table; when `rowHref` is set, the first column links to the row's detail page. */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  rowHref,
  empty = "No records found.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  empty?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c, i) => (
                  <td key={c.key}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(row)} className="row-link">
                        {c.render(row)}
                      </Link>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
