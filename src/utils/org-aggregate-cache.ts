/**
 * Optional short TTL cache for org-wide aggregate endpoints (KPIs).
 * Disabled when ORG_AGGREGATE_CACHE_TTL_MS is unset or 0 (default).
 * Stale reads are acceptable only for dashboards; do not use for auth or mutations.
 */
const ORG_AGGREGATE_CACHE_TTL_MS = parseInt(
  process.env.ORG_AGGREGATE_CACHE_TTL_MS || "0",
  10,
);

const store = new Map<string, { expiresAt: number; data: unknown }>();

export async function cachedOrgAggregate<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (ORG_AGGREGATE_CACHE_TTL_MS <= 0) {
    return fn();
  }
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.data as T;
  }
  const data = await fn();
  store.set(key, {
    expiresAt: now + ORG_AGGREGATE_CACHE_TTL_MS,
    data,
  });
  return data;
}
