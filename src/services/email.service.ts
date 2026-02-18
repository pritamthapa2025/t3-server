import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from "@getbrevo/brevo";
import { logger } from "../utils/logger.js";

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@example.com";
const senderName = process.env.BREVO_SENDER_NAME || "T3 Mechanical";

/** Shared base styles for transactional emails */
const emailStyles = `
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #F7F7F7; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
  .header { background: #46931f; color: #fff; padding: 24px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
  .content { padding: 36px 32px; }
  .code-box { background: #F0F9EB; border: 2px dashed #46931f; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; font-family: monospace; }
  .note { font-size: 14px; color: #666; margin-top: 20px; }
  .button { display: inline-block; padding: 14px 32px; background: #46931f; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0; }
  .fallback { font-size: 12px; color: #888; margin-top: 16px; word-break: break-all; }
  .footer { background: #F7F7F7; padding: 20px 32px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #E2E8F0; }
`;

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

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>T3 Mechanical</h1></div>
    <div class="content">
      <p style="font-size: 16px;">Hi,</p>
      <p>You requested a verification code to sign in to your T3 Mechanical account. Use the code below:</p>
      <div class="code-box">
        <span class="code">${code}</span>
      </div>
      <p class="note"><strong>This code expires in 10 minutes.</strong> Do not share it with anyone. If you did not request this code, you can ignore this email.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from T3 Mechanical. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = `Your T3 Mechanical verification code: ${code}`;
  sendSmtpEmail.htmlContent = htmlContent;
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

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>T3 Mechanical</h1></div>
    <div class="content">
      <p style="font-size: 16px;">Hi,</p>
      <p>You requested to reset your password for your T3 Mechanical account. Use this verification code to proceed:</p>
      <div class="code-box">
        <span class="code">${otp}</span>
      </div>
      <p class="note"><strong>This code expires in 10 minutes.</strong> If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from T3 Mechanical. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Reset your T3 Mechanical password";
  sendSmtpEmail.htmlContent = htmlContent;
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

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>T3 Mechanical</h1></div>
    <div class="content">
      <p style="font-size: 16px;">Hi,</p>
      <p>You requested to change your T3 Mechanical password. Enter this verification code to complete the change:</p>
      <div class="code-box">
        <span class="code">${otp}</span>
      </div>
      <p class="note"><strong>This code expires in 10 minutes.</strong> Do not share it with anyone. If you did not request a password change, please secure your account and contact support.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from T3 Mechanical. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Confirm your password change – T3 Mechanical";
  sendSmtpEmail.htmlContent = htmlContent;
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

  const setupUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const link = `${setupUrl}/set-password?token=${encodeURIComponent(setupToken)}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>T3 Mechanical</h1></div>
    <div class="content">
      <p style="font-size: 16px;">Hi ${fullName},</p>
      <p>Your T3 Mechanical account has been created. To get started, set your password by clicking the button below:</p>
      <div style="text-align: center;">
        <a href="${link}" class="button">Set up your password</a>
      </div>
      <p class="fallback">If the button doesn't work, copy and paste this link into your browser:<br>${link}</p>
      <p class="note"><strong>This link expires in 24 hours.</strong> If you did not expect this email, please contact your administrator.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from T3 Mechanical. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = "Welcome to T3 Mechanical – set up your account";
  sendSmtpEmail.htmlContent = htmlContent;
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

/**
 * Send quote (bid) email with optional PDF attachment
 */
export async function sendQuoteEmail(
  toEmail: string,
  subject: string,
  messageBody?: string,
  pdfAttachment?: InvoiceEmailAttachment,
  cc?: string[],
  bcc?: string[],
): Promise<void> {
  const api = getTransactionalApi();
  if (!api) return;

  const htmlContent =
    messageBody ||
    "<p>Please find your quote attached. Contact us if you have any questions.</p>";

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
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
