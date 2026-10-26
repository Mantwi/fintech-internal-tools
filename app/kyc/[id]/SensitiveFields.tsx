"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";

/**
 * Shows server-masked SSN/DOB. Compliance leads can request unmasked values;
 * the server checks the role and records an audit event before responding.
 */
export function SensitiveFields({
  caseId,
  maskedSsn,
  maskedDob,
  canReveal,
}: {
  caseId: string;
  maskedSsn: string;
  maskedDob: string;
  canReveal: boolean;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<{ ssn: string; dob: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setError(null);
    try {
      const data = await apiRequest<{ case: { ssn: string; dateOfBirth: string } }>(`/api/cases/${caseId}?reveal=1`);
      setRevealed({ ssn: data.case.ssn, dob: data.case.dateOfBirth });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reveal");
    }
  }

  return (
    <>
      <dt>Date of birth</dt>
      <dd className="mono">{revealed?.dob ?? maskedDob}</dd>
      <dt>Social Security number</dt>
      <dd className="mono">
        {revealed?.ssn ?? maskedSsn}
        {!revealed && canReveal && (
          <button type="button" className="btn btn-small" onClick={reveal}>
            Reveal SSN &amp; DOB (audited)
          </button>
        )}
        {revealed && (
          <button type="button" className="btn btn-small" onClick={() => setRevealed(null)}>
            Hide
          </button>
        )}
        {!canReveal && <span className="muted small"> Masked for your role</span>}
        {error && <span className="error-text small"> {error}</span>}
      </dd>
    </>
  );
}
