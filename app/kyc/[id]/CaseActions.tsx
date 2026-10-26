"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { CaseAction } from "@/lib/kyc-service";

const BUTTONS: { action: CaseAction; body: string; label: string; className: string }[] = [
  { action: "CLAIM", body: "claim", label: "Claim case", className: "btn-primary" },
  { action: "APPROVE", body: "approve", label: "Approve", className: "btn-success" },
  { action: "REJECT", body: "reject", label: "Reject", className: "btn-danger" },
  { action: "ESCALATE", body: "escalate", label: "Escalate to compliance", className: "btn-warning" },
];

/**
 * Buttons are shown according to `allowed` (computed server-side) for usability.
 * "Show all" exposes every button so reviewers can see the server reject
 * actions the current identity is not permitted to take.
 */
export function CaseActions({ caseId, allowed }: { caseId: string; allowed: CaseAction[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function run(action: string, label: string) {
    setBusy(action);
    setMessage(null);
    try {
      await apiRequest(`/api/cases/${caseId}/actions`, { method: "POST", body: JSON.stringify({ action }) });
      setMessage({ kind: "success", text: `${label}: done` });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Action failed" });
    } finally {
      setBusy(null);
    }
  }

  const visible = BUTTONS.filter((b) => showAll || allowed.includes(b.action));

  return (
    <div className="stack-sm">
      {visible.length === 0 ? (
        <p className="muted">No actions available to you for this case.</p>
      ) : (
        <div className="actions">
          {visible.map((b) => (
            <button
              key={b.action}
              className={`btn ${b.className}`}
              disabled={busy !== null}
              onClick={() => run(b.body, b.label)}
            >
              {busy === b.body ? "Working…" : b.label}
            </button>
          ))}
        </div>
      )}
      {message && <div className={`alert alert-${message.kind}`}>{message.text}</div>}
      <label className="small muted checkbox">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all actions
        (demonstrate server-side enforcement)
      </label>
    </div>
  );
}
