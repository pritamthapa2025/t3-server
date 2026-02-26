import rateLimit from "express-rate-limit";

const json429 = (retryAfter: number) => ({
  success: false,
  message: `Too many requests. Please try again after ${retryAfter} seconds.`,
});

/** Global fallback — applied to every route */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json(json429(retryAfter));
  },
});

/** /auth/login — slow down brute-force attacks */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again after ${retryAfter} seconds.`,
    });
  },
});

/** /auth/verify-2fa — 6-digit OTP brute-force protection */
export const verify2FALimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many 2FA attempts. Please try again after ${retryAfter} seconds.`,
    });
  },
});

/** /auth/resend-2fa — prevent OTP/email flooding */
export const resend2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many resend requests. Please try again after ${retryAfter} seconds.`,
    });
  },
});

/** /auth/request-password-reset — prevent email flooding */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many password reset requests. Please try again after ${retryAfter} seconds.`,
    });
  },
});

/** /auth/resend-password-reset-otp & /auth/resend-change-password-otp */
export const resendOTPLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many OTP resend requests. Please try again after ${retryAfter} seconds.`,
    });
  },
});

/** /auth/confirm-password-reset — OTP brute-force protection */
export const confirmResetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: `Too many attempts. Please try again after ${retryAfter} seconds.`,
    });
  },
});
