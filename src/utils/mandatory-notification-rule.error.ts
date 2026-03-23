/** Thrown when PATCH tries to disable a security-critical notification rule. */
export class MandatoryNotificationRuleError extends Error {
  readonly statusCode = 400;

  constructor() {
    super(
      "This notification is required for account security and cannot be disabled.",
    );
    this.name = "MandatoryNotificationRuleError";
  }
}
