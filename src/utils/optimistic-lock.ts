/**
 * Optimistic locking helpers (Option A — updatedAt timestamp check).
 *
 * Pattern:
 *   1. The client receives `updatedAt` with every GET response.
 *   2. The client echoes `updatedAt` back in every PUT/PATCH body.
 *   3. Before writing, the service compares the client's timestamp against
 *      the current DB value.  A mismatch → "stale" → 409 to the client.
 *
 * Only applies when the client actually supplies `updatedAt`.  Omitting it
 * disables the check (backwards-compatible for internal service-to-service calls).
 */

/** Sentinel value returned by update functions when a stale-data conflict is detected. */
export const STALE_DATA = "STALE_DATA" as const;
export type StaleData = typeof STALE_DATA;

/**
 * Returns true when the client's copy of `updatedAt` no longer matches the
 * value stored in the database — indicating that another writer modified the
 * record after the client fetched it.
 *
 * A 1 ms tolerance absorbs sub-millisecond rounding differences that can
 * appear when JavaScript Date objects travel through JSON / DB round-trips.
 *
 * Returns false (no conflict) when `clientUpdatedAt` is absent, so callers
 * that do not supply the field are unaffected.
 */
export function isStale(
  dbUpdatedAt: Date | string | null | undefined,
  clientUpdatedAt: string | Date | null | undefined,
): boolean {
  if (!clientUpdatedAt || !dbUpdatedAt) return false;
  return (
    Math.abs(
      new Date(dbUpdatedAt).getTime() - new Date(clientUpdatedAt).getTime(),
    ) > 1
  );
}

/** Standard 409 response body for stale-data conflicts. */
export const staleDataResponse = {
  success: false as const,
  code: "STALE_DATA" as const,
  message:
    "This record was modified by another user since you last loaded it. Please refresh and try again.",
};
