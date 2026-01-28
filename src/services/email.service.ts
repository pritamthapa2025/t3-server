import * as brevo from "@getbrevo/brevo";
import dotenv from "dotenv";

dotenv.config();

// Helper function to get client URL
const getClientUrl = () => {
  return process.env.CLIENT_URL || "http://localhost:3000";
};

if (!process.env.BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not set in .env file");
}

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
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

export const sendPasswordResetOTP = async (email: string, otp: string) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.subject = "Password Reset OTP";
  sendSmtpEmail.htmlContent = `
    <p>You requested to reset your password.</p>
    <p>Your password reset OTP is: <strong>${otp}</strong></p>
    <p>This code is valid for 5 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  sendSmtpEmail.textContent = `
    You requested to reset your password.
    Your password reset OTP is: ${otp}
    This code is valid for 5 minutes.
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
    console.error("Error sending password reset OTP:", err.message);
    throw err;
  }
};

export const sendChangePasswordOTP = async (email: string, otp: string) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.subject = "Password Change Verification OTP";
  sendSmtpEmail.htmlContent = `
    <p>You requested to change your password.</p>
    <p>Your password change verification OTP is: <strong>${otp}</strong></p>
    <p>This code is valid for 5 minutes.</p>
    <p>If you didn't request this, please contact support immediately.</p>
  `;
  sendSmtpEmail.textContent = `
    You requested to change your password.
    Your password change verification OTP is: ${otp}
    This code is valid for 5 minutes.
    If you didn't request this, please contact support immediately.
  `;
  sendSmtpEmail.sender = {
    name: "Password Change Service",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  };
  sendSmtpEmail.to = [{ email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err: any) {
    console.error("Error sending password change OTP:", err.message);
    throw err;
  }
};

export const sendNewUserPasswordSetupEmail = async (
  email: string,
  fullName: string,
  setupToken: string,
) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  const setupLink = `${getClientUrl()}/auth/newpassword-creation?token=${setupToken}`;

  sendSmtpEmail.subject = "Welcome! Set up your password";
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">Welcome to our platform!</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>Your account has been created successfully. To get started, please set up your password by clicking the link below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${setupLink}" 
             style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Set Up Your Password
          </a>
        </div>
        
        <p><strong>Important:</strong></p>
        <ul>
          <li>This link is valid for <strong>24 hours</strong></li>
          <li>For security reasons, please set up your password as soon as possible</li>
          <li>If you didn't expect this email, please contact support immediately</li>
        </ul>
        
        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
          ${setupLink}
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 14px; color: #666; margin: 0;">
          Best regards,<br>
          The Support Team
        </p>
      </div>
    </div>
  `;
  sendSmtpEmail.textContent = `
    Welcome to our platform!

    Hello ${fullName},

    Your account has been created successfully. To get started, please set up your password using the link below:

    ${setupLink}

    Important:
    - This link is valid for 24 hours
    - For security reasons, please set up your password as soon as possible
    - If you didn't expect this email, please contact support immediately

    Best regards,
    The Support Team
  `;
  sendSmtpEmail.sender = {
    name: "Welcome Team",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  };
  sendSmtpEmail.to = [{ email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err: any) {
    console.error("Error sending new user password setup email:", err.message);
    throw err;
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  const resetLink = `${getClientUrl()}/reset-password?token=${resetToken}`;

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

export const sendInvoiceEmail = async (
  email: string,
  invoiceHtml: string,
  subject?: string,
  message?: string,
  pdfAttachment?: { content: Buffer; filename: string },
  cc?: string[],
  bcc?: string[],
) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.subject = subject || "Invoice from T3 Mechanical";
  sendSmtpEmail.htmlContent = message
    ? `<p>${message}</p><hr>${invoiceHtml}`
    : invoiceHtml;
  sendSmtpEmail.textContent =
    "Please view this email in HTML format to see your invoice.";
  sendSmtpEmail.sender = {
    name: "T3 Mechanical",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@example.com",
  };
  sendSmtpEmail.to = [{ email }];

  if (cc && cc.length > 0) {
    sendSmtpEmail.cc = cc.map((email) => ({ email }));
  }

  if (bcc && bcc.length > 0) {
    sendSmtpEmail.bcc = bcc.map((email) => ({ email }));
  }

  if (pdfAttachment) {
    sendSmtpEmail.attachment = [
      {
        content: pdfAttachment.content.toString("base64"),
        name: pdfAttachment.filename,
      },
    ];
  }

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (err: any) {
    console.error("Error sending invoice email:", err.message);
    throw err;
  }
};
