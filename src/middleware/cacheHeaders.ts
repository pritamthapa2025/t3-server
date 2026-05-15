import type { Request, Response, NextFunction } from "express";

/**
 * Adds HTTP cache-control headers to API list/summary endpoints.
 *
 * - GET list endpoints (e.g. /jobs, /bids, /financial/summary):
 *   `private, max-age=60, stale-while-revalidate=30` — browser caches for 60 s,
 *   serves stale for 30 s while revalidating. Matches the React Query staleTime
 *   of 60 s so both layers stay in sync.
 *
 * - All other mutating methods (POST/PUT/PATCH/DELETE):
 *   `no-store` — never cache write operations.
 *
 * Routes that serve truly static data (e.g. dropdown options, permission configs)
 * can override with longer TTLs by calling res.setHeader() after this middleware.
 */
export function cacheHeaders(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET") {
    // Short-lived, private cache — safe for authenticated API responses.
    // stale-while-revalidate allows the browser to serve the cached response
    // instantly while re-fetching in the background.
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
  } else {
    // Never cache mutation responses
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}
