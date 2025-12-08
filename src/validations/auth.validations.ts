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
    email: z.email("Invalid email format"),
    otp: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .pipe(
        z
          .string()
          .length(6, "OTP must be 6 digits")
          .regex(/^\d+$/, "OTP must contain only digits")
      ),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
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
          .length(6, "OTP must be 6 digits")
          .regex(/^\d+$/, "OTP must contain only digits")
      ),
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

// Resend password reset OTP validation
export const resendPasswordResetOTPSchema = z.object({
  body: z.object({
    email: z.email("Invalid email format"),
  }),
});

// Resend change password OTP validation (for logged in users)
export const resendChangePasswordOTPSchema = z.object({
  body: z.object({}), // No body needed since user is authenticated
});

// Setup new password validation (for new users with token)
export const setupNewPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Setup token is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  }),
});
