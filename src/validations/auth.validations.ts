import { z } from "zod";

// Login validation
export const loginSchema = z.object({
  body: z.object({
    email: z.email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

// Verify 2FA validation
export const verify2FASchema = z.object({
  body: z.object({
    email: z.email("Invalid email format"),
    code: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "2FA code must be 6 digits")
          .regex(/^\d+$/, "2FA code must contain only digits")
      ),
  }),
});

// Request password reset validation
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.email("Invalid email format"),
  }),
});

// Reset password validation
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  }),
});

// Change password validation
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  }),
});

// Resend 2FA validation
export const resend2FASchema = z.object({
  body: z.object({
    email: z.email("Invalid email format"),
  }),
});
