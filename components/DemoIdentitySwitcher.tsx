"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { humanize } from "@/lib/format";

type DemoUser = { id: string; name: string; role: string };

export function DemoIdentitySwitcher({ users, currentUserId }: { users: DemoUser[]; currentUserId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onChange(userId: string) {
    setPending(true);
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="identity">
      <label htmlFor="demo-identity" className="identity-label">
        Demo Identity: <span>Authentication Simulated</span>
      </label>
      <select
        id="demo-identity"
        className="select"
        value={currentUserId ?? ""}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Choose a demo user…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {humanize(u.role)}
          </option>
        ))}
      </select>
    </div>
  );
}
