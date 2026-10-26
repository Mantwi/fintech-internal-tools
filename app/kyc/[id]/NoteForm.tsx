"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";

export function NoteForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/cases/${caseId}/notes`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack-sm note-form">
      <textarea
        className="input"
        rows={3}
        placeholder="Add a reviewer note…"
        value={body}
        maxLength={2000}
        onChange={(e) => setBody(e.target.value)}
      />
      <div>
        <button className="btn btn-primary" type="submit" disabled={saving || !body.trim()}>
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
    </form>
  );
}
