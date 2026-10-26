import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { CASE_STATUSES, RISK_LEVELS, listCases, type CaseSummary } from "@/lib/kyc-service";
import { getDemoUserIdFromCookies } from "@/lib/session";
import { RiskBadge, StatusBadge } from "./_components/badges";

const columns: Column<CaseSummary>[] = [
  { key: "id", header: "Case ID", render: (c) => c.id },
  { key: "customer", header: "Customer", render: (c) => c.customerName },
  { key: "risk", header: "Risk", render: (c) => <RiskBadge risk={c.riskLevel} /> },
  { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  { key: "reviewer", header: "Assigned reviewer", render: (c) => c.assignedReviewer?.name ?? <span className="muted">Unassigned</span> },
  { key: "created", header: "Created", render: (c) => formatDate(c.createdAt) },
  { key: "updated", header: "Last updated", render: (c) => formatDateTime(c.updatedAt) },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function KycQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = { q: str(sp.q), status: str(sp.status), risk: str(sp.risk) };

  let cases: CaseSummary[];
  try {
    cases = await listCases(await getDemoUserIdFromCookies(), filters);
  } catch (error) {
    return (
      <>
        <PageHeader title="KYC Review Queue" />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="KYC Review Queue" subtitle="Customer identity-verification cases awaiting review." />
      <form className="filters" method="get">
        <input className="input" type="search" name="q" placeholder="Search customer name" defaultValue={filters.q} />
        <select className="select" name="status" defaultValue={filters.status ?? ""}>
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <select className="select" name="risk" defaultValue={filters.risk ?? ""}>
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Apply
        </button>
        <Link className="btn" href="/kyc">
          Reset
        </Link>
      </form>
      <p className="muted small">{cases.length} case(s)</p>
      <DataTable columns={columns} rows={cases} rowHref={(c) => `/kyc/${c.id}`} empty="No cases match these filters." />
    </>
  );
}
