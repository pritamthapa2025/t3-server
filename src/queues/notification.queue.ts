/**
 * Notification queue — Bull/Redis removed.
 * Email/SMS delivery is now handled directly in notification.service.ts
 * using Promise.allSettled for parallel per-recipient delivery.
 *
 * This file is kept as a stub so any remaining imports compile without error.
 */

import { logger } from "../utils/logger.js";

/** No-op: delivery is handled inline in NotificationService.deliverToRecipient */
export async function queueNotification(_job: unknown): Promise<void> {
  // intentional no-op
}

/** No-op: no queue to close */
export async function closeQueue(): Promise<void> {
  logger.info("Notification queue: nothing to close (Bull removed)");
}

/** Returns zeroed stats (queue no longer exists) */
export async function getQueueStats() {
  return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 };
}

/** No-op */
export async function clearCompletedJobs(): Promise<void> {}

/** No-op */
export async function retryFailedJobs(): Promise<number> {
  return 0;
}

/** No-op */
export async function pauseQueue(): Promise<void> {}

/** No-op */
export async function resumeQueue(): Promise<void> {}

logger.info("✅ Notification delivery: direct async mode (no queue)");
