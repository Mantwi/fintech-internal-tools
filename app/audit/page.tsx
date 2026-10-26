import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAuditEvents, type AuditEventView } from "@/lib/audit";
import { formatDateTime, humanize } from "@/lib/format";
import { getDemoUserIdFromCookies } from "@/lib/session";

const columns: Column<AuditEventView>[] = [
  { key: "time", header: "Timestamp", render: (e) => formatDateTime(e.createdAt) },
  { key: "actor", header: "Actor", render: (e) => `${e.actor.name} (${humanize(e.actor.role)})` },
  { key: "action", header: "Action", render: (e) => humanize(e.action) },
  {
    key: "case",
    header: "Case",
    render: (e) => (e.resourceType === "KycCase" ? <Link href={`/kyc/${e.resourceId}`}>{e.resourceId}</Link> : e.resourceId),
  },
  {
    key: "changes",
    header: "Details",
    render: (e) => <code className="small">{e.changes ? JSON.stringify(e.changes) : "—"}</code>,
  },
];

export default async function AuditPage() {
  let events: AuditEventView[];
  try {
    events = await listAuditEvents(await getDemoUserIdFromCookies());
  } catch (error) {
    return (
      <>
        <PageHeader title="Audit Log" />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only record of case changes and unmasked PII views (most recent 200). Visible to compliance leads and admins."
      />
      <DataTable columns={columns} rows={events} empty="No audit events yet. Perform an action on a case to create one." />
    </>
  );
}
