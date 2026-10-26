// Server-side masking applied before data is serialized to any client.

export function maskSsn(ssn: string): string {
  const last4 = ssn.replace(/\D/g, "").slice(-4);
  return `***-**-${last4}`;
}

export function maskDateOfBirth(): string {
  return "****-**-**";
}
