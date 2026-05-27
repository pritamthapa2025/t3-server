/**
 * Shared helpers for the HttpOnly access_token cookie (Fix 5 - Phase A).
 *
 * Phase A: cookie is set alongside the JSON token so both cookie and
 * Authorization: Bearer work in authenticate(). localStorage / Bearer
 * fallback remains in place until Phase C.
 */
import type { Request, Response } from "express";

const COOKIE_NAME = "access_token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // SameSite=Strict is safe when frontend and API share the same site/domain.
  // Change to "none" (+ secure:true) only if they are on different domains.
  sameSite: "strict" as const,
  maxAge: 12 * 60 * 60 * 1000, // 12 hours — matches JWT exp
  path: "/",
};

/** Set the HttpOnly access_token cookie on a successful auth response. */
export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

/** Clear the HttpOnly access_token cookie on logout.
 *  Passes the same attributes used during setAccessTokenCookie so all browsers
 *  (especially Chrome/Firefox Secure-cookie enforcement) honour the deletion. */
export function clearAccessTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  });
}

/**
 * Extract the JWT from the request — cookie takes priority; falls back to
 * Authorization: Bearer header so existing clients keep working (Phase A).
 */
export function getAccessTokenFromRequest(req: Request): string | null {
  // 1. HttpOnly cookie (preferred)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken.trim();
  }

  // 2. Authorization: Bearer <token> header (backward compat)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  return null;
}
