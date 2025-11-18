import * as brevo from "@getbrevo/brevo";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not set in .env file");
}

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export const send2FACode = async (email: string, code: string) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.subject = "Your 2FA Code";
  sendSmtpEmail.htmlContent = `<p>Your 2FA code is: <strong>${code}</strong></p>`;
  sendSmtpEmail.textContent = `Your 2FA code is: ${code}`;
  sendSmtpEmail.sender = {
    name: "2FA Service",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  };
  sendSmtpEmail.to = [{ email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err: any) {
    console.error("Error sending 2FA code:", err.message);
  }
};

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

  sendSmtpEmail.subject = "Password Reset Request";
  sendSmtpEmail.htmlContent = `
    <p>You requested to reset your password.</p>
    <p>Click the link below to reset your password (valid for 1 hour):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  sendSmtpEmail.textContent = `
    You requested to reset your password.
    Click the link below to reset your password (valid for 1 hour):
    ${resetLink}
    If you didn't request this, please ignore this email.
  `;
  sendSmtpEmail.sender = {
    name: "Password Reset Service",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  };
  sendSmtpEmail.to = [{ email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err: any) {
    console.error("Error sending password reset email:", err.message);
    throw err;
  }
};
