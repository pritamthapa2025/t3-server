import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "../utils/logger.js";

let client: BrevoClient | null = null;

export function getBrevoClient(): BrevoClient | null {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!client) {
    client = new BrevoClient({ apiKey });
  }
  return client;
}

export type BrevoTransactionalEmail = {
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string };
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  attachment?: Array<{ name: string; content: string }>;
};

export async function sendTransactionalEmail(
  email: BrevoTransactionalEmail,
): Promise<string | undefined> {
  const brevo = getBrevoClient();
  if (!brevo) {
    logger.warn("BREVO_API_KEY not set - email sending disabled");
    return undefined;
  }

  const response = await brevo.transactionalEmails.sendTransacEmail({
    subject: email.subject,
    htmlContent: email.htmlContent,
    sender: email.sender,
    to: email.to,
    ...(email.cc?.length ? { cc: email.cc } : {}),
    ...(email.bcc?.length ? { bcc: email.bcc } : {}),
    ...(email.attachment?.length ? { attachment: email.attachment } : {}),
  });

  return response.messageId;
}
