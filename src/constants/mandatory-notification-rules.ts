/**
 * Org notification rules that must stay enabled (account security / access).
 * Keep in sync with frontend `mandatory` handling for admin rules UI.
 */
export const MANDATORY_NOTIFICATION_EVENT_TYPES = [
  "2fa_code",
  "password_reset_request",
  "password_setup_link",
  "new_account_created",
  "account_locked",
] as const;

export type MandatoryNotificationEventType =
  (typeof MANDATORY_NOTIFICATION_EVENT_TYPES)[number];

const MANDATORY_SET = new Set<string>(MANDATORY_NOTIFICATION_EVENT_TYPES);

export function isMandatoryNotificationEventType(
  eventType: string,
): eventType is MandatoryNotificationEventType {
  return MANDATORY_SET.has(eventType);
}
