import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime, humanize } from "@/lib/format";
import { getCase, type CaseDetail } from "@/lib/kyc-service";
import { getDemoUserIdFromCookies } from "@/lib/session";
import { RiskBadge, StatusBadge } from "../_components/badges";
import { CaseActions } from "./CaseActions";
import { NoteForm } from "./NoteForm";
import { SensitiveFields } from "./SensitiveFields";

function describeChanges(changes: CaseDetail["history"][number]["changes"]): string {
  if (!changes) return "";
  return Object.entries(changes)
    .map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) return `${key}: ${value.from ?? "—"} → ${value.to ?? "—"}`;
      return `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`;
    })
    .join(" · ");
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = await getDemoUserIdFromCookies();
  let kycCase: CaseDetail;
  try {
    kycCase = await getCase(viewerId, id);
  } catch (error) {
    return (
      <>
        <PageHeader title={`Case ${id}`} />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <p className="breadcrumb">
        <Link href="/kyc">← Back to queue</Link>
      </p>
      <PageHeader title={kycCase.customerName} subtitle={`Case ${kycCase.id}`}>
        <RiskBadge risk={kycCase.riskLevel} />
        <StatusBadge status={kycCase.status} />
      </PageHeader>

      <div className="grid">
        <div className="stack">
          <Card title="Customer">
            <dl className="details">
              <dt>Customer name</dt>
              <dd>{kycCase.customerName}</dd>
              <SensitiveFields
                key={viewerId}
                caseId={kycCase.id}
                maskedSsn={kycCase.ssn}
                maskedDob={kycCase.dateOfBirth}
                canReveal={kycCase.canRevealPii}
              />
              <dt>Document type</dt>
              <dd>{humanize(kycCase.documentType)}</dd>
            </dl>
          </Card>

          <Card title="Review">
            <dl className="details">
              <dt>Risk level</dt>
              <dd>
                <RiskBadge risk={kycCase.riskLevel} />
              </dd>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={kycCase.status} />
              </dd>
              <dt>Assigned reviewer</dt>
              <dd>{kycCase.assignedReviewer?.name ?? <span className="muted">Unassigned</span>}</dd>
              {kycCase.escalatedBy && (
                <>
                  <dt>Escalated by</dt>
                  <dd>{kycCase.escalatedBy.name}</dd>
                </>
              )}
              <dt>Created</dt>
              <dd>{formatDateTime(kycCase.createdAt)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDateTime(kycCase.updatedAt)}</dd>
            </dl>
          </Card>

          <Card title="Review notes">
            {kycCase.allowedActions.includes("ADD_NOTE") && <NoteForm key={viewerId} caseId={kycCase.id} />}
            {kycCase.notes.length === 0 ? (
              <p className="muted">No notes yet.</p>
            ) : (
              <ul className="notes">
                {kycCase.notes.map((n) => (
                  <li key={n.id}>
                    <p>{n.body}</p>
                    <span className="muted small">
                      {n.author.name} · {formatDateTime(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Actions">
            <CaseActions key={viewerId} caseId={kycCase.id} allowed={kycCase.allowedActions} />
          </Card>
          <Card title="Case history">
            {kycCase.history.length === 0 ? (
              <p className="muted">No recorded activity yet.</p>
            ) : (
              <ul className="timeline">
                {kycCase.history.map((e) => (
                  <li key={e.id}>
                    <strong>{humanize(e.action)}</strong>
                    <span className="small">
                      {e.actor.name} ({humanize(e.actor.role)}) · {formatDateTime(e.createdAt)}
                    </span>
                    {e.changes && <span className="muted small">{describeChanges(e.changes)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
