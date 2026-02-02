import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from "@getbrevo/brevo";
import { logger } from "../utils/logger.js";

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@example.com";
const senderName = process.env.BREVO_SENDER_NAME || "T3 Server";

function getTransactionalApi(): TransactionalEmailsApi | null {
  if (!apiKey) {
    logger.warn("BREVO_API_KEY not set - email sending disabled");
    return null;
  }
  const api = new TransactionalEmailsApi();
  api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
  return api;
}

/**
 * Send 2FA verification code to user email
 */
export async function send2FACode(email: string, code: string): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Your verification code";
  sendSmtpEmail.htmlContent = `
    <p>Your verification code is: <strong>${code}</strong></p>
    <p>This code expires in 10 minutes. Do not share it with anyone.</p>
  `;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];

  await api.sendTransacEmail(sendSmtpEmail);
}

/**
 * Send password reset OTP to user email
 */
export async function sendPasswordResetOTP(
  email: string,
  otp: string,
): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Password reset code";
  sendSmtpEmail.htmlContent = `
    <p>Your password reset code is: <strong>${otp}</strong></p>
    <p>This code expires in 10 minutes. If you did not request a reset, ignore this email.</p>
  `;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];

  await api.sendTransacEmail(sendSmtpEmail);
}

/**
 * Send change password OTP to user email (e.g. when changing password from account settings)
 */
export async function sendChangePasswordOTP(
  email: string,
  otp: string,
): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Confirm password change";
  sendSmtpEmail.htmlContent = `
    <p>Your verification code to change password is: <strong>${otp}</strong></p>
    <p>This code expires in 10 minutes. Do not share it with anyone.</p>
  `;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];

  await api.sendTransacEmail(sendSmtpEmail);
}

/**
 * Send new user password setup email (invite link with token)
 */
export async function sendNewUserPasswordSetupEmail(
  email: string,
  fullName: string,
  setupToken: string,
): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const setupUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const link = `${setupUrl}/set-password?token=${encodeURIComponent(setupToken)}`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Set up your password";
  sendSmtpEmail.htmlContent = `
    <p>Hi ${fullName},</p>
    <p>Your account has been created. Please set your password by clicking the link below:</p>
    <p><a href="${link}">Set your password</a></p>
    <p>This link expires in 24 hours. If you did not request this, please ignore this email.</p>
  `;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];

  await api.sendTransacEmail(sendSmtpEmail);
}

export type InvoiceEmailAttachment = {
  content: Buffer;
  filename: string;
};

/**
 * Send invoice email (HTML body and optional PDF attachment)
 */
export async function sendInvoiceEmail(
  toEmail: string,
  htmlContent: string,
  subject: string,
  messageBody?: string,
  pdfAttachment?: InvoiceEmailAttachment,
  cc?: string[],
  bcc?: string[],
): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = messageBody
    ? `${messageBody}<br/><br/>${htmlContent}`
    : htmlContent;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: toEmail }];
  if (cc?.length) sendSmtpEmail.cc = cc.map((email) => ({ email }));
  if (bcc?.length) sendSmtpEmail.bcc = bcc.map((email) => ({ email }));
  if (pdfAttachment) {
    sendSmtpEmail.attachment = [
      {
        name: pdfAttachment.filename,
        content: pdfAttachment.content.toString("base64"),
      },
    ];
  }

  await api.sendTransacEmail(sendSmtpEmail);
}
