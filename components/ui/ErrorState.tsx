import { AppError } from "@/lib/errors";

/** Renders known AppErrors (401/403/404) as a friendly panel; rethrows anything else. */
export function ErrorState({ error }: { error: unknown }) {
  if (!(error instanceof AppError)) throw error;
  const title =
    error.status === 401 ? "Select a demo identity" : error.status === 403 ? "Access denied" : error.status === 404 ? "Not found" : "Request failed";
  return (
    <div className={`alert ${error.status === 401 ? "alert-info" : "alert-error"}`}>
      <strong>{title}</strong>
      <p>{error.status === 401 ? "Use the Demo Identity switcher in the header to choose a user." : error.message}</p>
    </div>
  );
}
