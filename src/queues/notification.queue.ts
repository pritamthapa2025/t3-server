import Bull from "bull";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { NotificationEmailService } from "../services/notification-email.service.js";
import { NotificationSMSService } from "../services/notification-sms.service.js";
import { logger } from "../utils/logger.js";
import type { NotificationJob } from "../types/notification.types.js";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { notificationDeliveryLog } from "../drizzle/schema/notifications.schema.js";
import { eq } from "drizzle-orm";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create notification queue
export const notificationQueue = new Bull<NotificationJob>("notifications", REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: false, // Keep failed jobs for debugging
  },
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // Per minute
  },
});

// Initialize services
const repository = new NotificationRepository();
const emailService = new NotificationEmailService();
const smsService = new NotificationSMSService();

/**
 * Process notification jobs
 */
notificationQueue.process(async (job) => {
  const { userId, notificationId, channels, data } = job.data;

  logger.info(
    `Processing notification ${notificationId} for user ${userId} (Job ID: ${job.id})`
  );

  try {
    // Get user details (email and phone)
    const [user] = await db
      .select({
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      logger.warn(`User ${userId} not found. Skipping notification delivery.`);
      return { success: false, reason: "User not found" };
    }

    // Get user preferences
    const preferences = await repository.getPreferences(userId);
    const categoryPreferences = preferences[data.category as keyof typeof preferences];

    if (!categoryPreferences) {
      logger.warn(
        `No preferences found for category ${data.category}. Using defaults.`
      );
    }

    const results: { channel: string; success: boolean; error?: string }[] = [];

    // Send via each enabled channel
    for (const channel of channels) {
      // Check if user has this channel enabled for this category
      const isEnabled =
        categoryPreferences?.[channel as "email" | "sms" | "inApp"] !== false;

      if (!isEnabled) {
        logger.info(
          `Channel ${channel} disabled for user ${userId} in category ${data.category}`
        );
        continue;
      }

      // Create delivery log entry
      const [deliveryLog] = await db
        .insert(notificationDeliveryLog)
        .values({
          notificationId,
          userId,
          channel,
          status: "pending",
        })
        .returning();

      if (!deliveryLog) {
        logger.error(`Failed to create delivery log for channel ${channel}`);
        continue;
      }

      try {
        if (channel === "email" && user.email) {
          logger.debug(`Sending email to ${user.email}`);
          const emailResult = await emailService.sendNotificationEmail(
            user.email,
            user.fullName || "User",
            data
          );

          if (emailResult.success) {
            await repository.updateDeliveryStatus(
              deliveryLog.id,
              "sent",
              emailResult.messageId
            );
            results.push({ channel: "email", success: true });
            logger.info(`✅ Email sent successfully to ${user.email}`);
          } else {
            await repository.updateDeliveryStatus(
              deliveryLog.id,
              "failed",
              undefined,
              emailResult.error
            );
            results.push({
              channel: "email",
              success: false,
              ...(emailResult.error ? { error: emailResult.error } : {}),
            });
            logger.error(`❌ Email failed for ${user.email}: ${emailResult.error}`);
          }
        } else if (channel === "email" && !user.email) {
          logger.warn(`User ${userId} has no email address`);
          await repository.updateDeliveryStatus(
            deliveryLog.id,
            "failed",
            undefined,
            "No email address"
          );
        }

        if (channel === "sms" && user.phone) {
          logger.debug(`Sending SMS to ${user.phone}`);
          const smsResult = await smsService.sendNotificationSMS(
            user.phone,
            user.fullName || "User",
            data
          );

          if (smsResult.success) {
            await repository.updateDeliveryStatus(
              deliveryLog.id,
              "sent",
              smsResult.messageId
            );
            results.push({ channel: "sms", success: true });
            logger.info(`✅ SMS sent successfully to ${user.phone}`);
          } else {
            await repository.updateDeliveryStatus(
              deliveryLog.id,
              "failed",
              undefined,
              smsResult.error
            );
            results.push({
              channel: "sms",
              success: false,
              ...(smsResult.error ? { error: smsResult.error } : {}),
            });
            logger.error(`❌ SMS failed for ${user.phone}: ${smsResult.error}`);
          }
        } else if (channel === "sms" && !user.phone) {
          logger.warn(`User ${userId} has no phone number`);
          await repository.updateDeliveryStatus(
            deliveryLog.id,
            "failed",
            undefined,
            "No phone number"
          );
        }

        // Push notifications are handled via Socket.IO (no delivery log needed)
        if (channel === "push") {
          results.push({ channel: "push", success: true });
          logger.debug(`Push notification handled via Socket.IO`);
        }
      } catch (channelError: any) {
        logger.error(`Error delivering via ${channel}:`, channelError);
        await repository.updateDeliveryStatus(
          deliveryLog.id,
          "failed",
          undefined,
          channelError.message
        );
        results.push({
          channel,
          success: false,
          error: channelError.message,
        });
      }
    }

    logger.info(
      `Notification ${notificationId} processed. Results: ${JSON.stringify(results)}`
    );

    return { success: true, results };
  } catch (error: any) {
    logger.error(
      `Failed to process notification ${notificationId} for user ${userId}:`,
      error
    );
    throw error; // Will trigger retry
  }
});

/**
 * Queue event handlers
 */
notificationQueue.on("completed", (job, _result) => {
  logger.info(`✅ Job ${job.id} completed successfully`);
});

notificationQueue.on("failed", (job, err) => {
  logger.error(
    `❌ Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`
  );
});

notificationQueue.on("stalled", (job) => {
  logger.warn(`⚠️ Job ${job?.id} stalled`);
});

notificationQueue.on("error", (error) => {
  logger.error("❌ Queue error:", error);
});

/**
 * Add notification job to queue
 */
export async function queueNotification(
  job: NotificationJob
): Promise<Bull.Job<NotificationJob>> {
  logger.debug(`Queueing notification ${job.notificationId} for user ${job.userId}`);

  const queuedJob = await notificationQueue.add(job, {
    priority: job.data.priority === "high" ? 1 : job.data.priority === "medium" ? 2 : 3,
    jobId: `notification-${job.notificationId}`, // Prevent duplicates
  });

  logger.info(`Notification ${job.notificationId} queued (Job ID: ${queuedJob.id})`);
  return queuedJob;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clear completed jobs
 */
export async function clearCompletedJobs(): Promise<void> {
  await notificationQueue.clean(7 * 24 * 3600 * 1000, "completed"); // 7 days
  logger.info("Cleared completed notification jobs");
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(): Promise<number> {
  const failedJobs = await notificationQueue.getFailed();
  let retried = 0;

  for (const job of failedJobs) {
    await job.retry();
    retried++;
  }

  logger.info(`Retried ${retried} failed notification jobs`);
  return retried;
}

/**
 * Pause queue
 */
export async function pauseQueue(): Promise<void> {
  await notificationQueue.pause();
  logger.info("Notification queue paused");
}

/**
 * Resume queue
 */
export async function resumeQueue(): Promise<void> {
  await notificationQueue.resume();
  logger.info("Notification queue resumed");
}

/**
 * Graceful shutdown
 */
export async function closeQueue(): Promise<void> {
  await notificationQueue.close();
  logger.info("Notification queue closed");
}

// Graceful shutdown on process termination
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Closing notification queue...");
  await closeQueue();
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Closing notification queue...");
  await closeQueue();
});

logger.info("✅ Notification queue initialized");
