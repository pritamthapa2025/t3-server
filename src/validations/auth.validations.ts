import { z } from "zod";

// Login validation
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address (e.g., john@example.com)")
      .trim()
      .toLowerCase(),
    password: z.string().min(1, "Password is required and cannot be empty"),
  }),
});

// Verify 2FA validation
export const verify2FASchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
    code: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "2FA code must be exactly 6 digits")
          .regex(/^\d+$/, "2FA code must contain only numbers (0-9)")
      ),
    rememberDevice: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
  }),
});

// Request password reset validation
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required to reset password")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
  }),
});

// Reset password validation
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
    otp: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "OTP code must be exactly 6 digits")
          .regex(/^\d+$/, "OTP code must contain only numbers (0-9)")
      ),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter (A-Z), one lowercase letter (a-z), and one number (0-9)"
      ),
  }),
});

// Request change password validation (for logged in users)
export const requestChangePasswordSchema = z.object({
  body: z.object({}), // No body needed since user is authenticated
});

// Change password validation (with OTP)
export const changePasswordSchema = z.object({
  body: z.object({
    otp: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "OTP code must be exactly 6 digits")
          .regex(/^\d+$/, "OTP code must contain only numbers (0-9)")
      ),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter (A-Z), one lowercase letter (a-z), and one number (0-9)"
      ),
  }),
});

// Resend 2FA validation
export const resend2FASchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
  }),
});

// Resend password reset OTP validation
export const resendPasswordResetOTPSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
  }),
});

// Resend change password OTP validation (for logged in users)
export const resendChangePasswordOTPSchema = z.object({
  body: z.object({}), // No body needed since user is authenticated
});

// Verify reset token validation (first step of password reset)
export const verifyResetTokenSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase(),
    otp: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "OTP code must be exactly 6 digits")
          .regex(/^\d+$/, "OTP code must contain only numbers (0-9)")
      ),
  }),
});

// Confirm password reset validation (second step of password reset)
export const confirmPasswordResetSchema = z.object({
  body: z.object({
    verificationToken: z
      .string()
      .min(1, "Verification token is required and cannot be empty"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter (A-Z), one lowercase letter (a-z), and one number (0-9)"
      ),
  }),
});

// Setup new password validation (for new users with token)
export const setupNewPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Setup token is required and cannot be empty"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter (A-Z), one lowercase letter (a-z), and one number (0-9)"
      ),
  }),
});
