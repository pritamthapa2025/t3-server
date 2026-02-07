import type { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service.js";
import { logger } from "../utils/logger.js";
import type { NotificationFilters } from "../types/notification.types.js";

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * GET /api/v1/org/notifications
   * Get user's notifications (paginated)
   */
  async getNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string;
      const priority = req.query.priority as string;
      const read = req.query.read === "true" ? true : req.query.read === "false" ? false : undefined;
      const type = req.query.type as string;

      const filters: NotificationFilters = {};
      if (category) filters.category = category as any;
      if (priority) filters.priority = priority as any;
      if (read !== undefined) filters.read = read;
      if (type) filters.type = type;

      const notifications = await notificationService.getUserNotifications(
        userId,
        page,
        limit,
        filters
      );

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      logger.error("Error getting notifications:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/unread-count
   * Get unread notification count
   */
  async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error("Error getting unread count:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/stats
   * Get notification statistics
   */
  async getStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const stats = await notificationService.getNotificationStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error getting notification stats:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/:id
   * Get specific notification
   */
  async getNotificationById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
        return;
      }

      const notification = await notificationService.getNotificationById(
        id,
        userId
      );

      if (!notification) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      logger.error("Error getting notification by ID:", error);
      next(error);
    }
  }

  /**
   * PATCH /api/v1/org/notifications/:id/read
   * Mark notification as read
   */
  async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
        return;
      }

      await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      next(error);
    }
  }

  /**
   * PATCH /api/v1/org/notifications/mark-all-read
   * Mark all notifications as read
   */
  async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
      next(error);
    }
  }

  /**
   * DELETE /api/v1/org/notifications/:id
   * Delete notification
   */
  async deleteNotification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
        return;
      }

      await notificationService.deleteNotification(id, userId);

      res.json({
        success: true,
        message: "Notification deleted",
      });
    } catch (error) {
      logger.error("Error deleting notification:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/preferences
   * Get user's notification preferences
   */
  async getPreferences(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const preferences = await notificationService.getPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error("Error getting notification preferences:", error);
      next(error);
    }
  }

  /**
   * PUT /api/v1/org/notifications/preferences
   * Update user's notification preferences
   */
  async updatePreferences(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      await notificationService.updatePreferences(userId, req.body);

      res.json({
        success: true,
        message: "Notification preferences updated",
      });
    } catch (error) {
      logger.error("Error updating notification preferences:", error);
      next(error);
    }
  }

  /**
   * POST /api/v1/org/notifications/trigger (Internal/Admin only)
   * Trigger a notification event manually
   */
  async triggerNotification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role check here
      // For now, allow authenticated users to trigger notifications

      const { createdCount, reason } = await notificationService.triggerNotification(req.body);

      const hintByReason: Record<string, string> = {
        no_rule:
          "No notification rule for this event type. Run: pnpm run seed:notification-rules",
        conditions_not_met: "Rule conditions were not met for this event data.",
        no_recipients:
          "No recipients resolved. Check that the user ID exists in auth.users (e.g. assignedTechnicianId).",
      };

      res.json({
        success: true,
        message: "Notification event triggered",
        data: {
          createdCount,
          ...(reason && { reason }),
          ...(createdCount === 0 && reason && { hint: hintByReason[reason] }),
        },
      });
    } catch (error) {
      logger.error("Error triggering notification:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/rules (Admin only)
   * Get all notification rules
   */
  async getRules(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role check here

      const rules = await notificationService.getAllRules();

      res.json({
        success: true,
        data: rules,
      });
    } catch (error) {
      logger.error("Error getting notification rules:", error);
      next(error);
    }
  }

  /**
   * POST /api/v1/org/notifications/rules (Admin only)
   * Create notification rule
   */
  async createRule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role check here

      const rule = await notificationService.createRule(req.body);

      res.json({
        success: true,
        data: rule,
        message: "Notification rule created",
      });
    } catch (error) {
      logger.error("Error creating notification rule:", error);
      next(error);
    }
  }

  /**
   * PATCH /api/v1/org/notifications/rules/:id (Admin only)
   * Update notification rule
   */
  async updateRule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role check here
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Rule ID is required",
        });
        return;
      }

      await notificationService.updateRule(id, req.body);

      res.json({
        success: true,
        message: "Notification rule updated",
      });
    } catch (error) {
      logger.error("Error updating notification rule:", error);
      next(error);
    }
  }

  /**
   * GET /api/v1/org/notifications/:id/delivery-logs (Admin only)
   * Get delivery logs for notification
   */
  async getDeliveryLogs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role check here
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
        return;
      }

      const logs = await notificationService.getDeliveryLogs(id);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error("Error getting delivery logs:", error);
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
