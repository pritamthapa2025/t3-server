import { Router } from "express";
import { notificationController } from "../../controllers/NotificationController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// User notification routes
router.get("/notifications", notificationController.getNotifications.bind(notificationController));
router.get("/notifications/unread-count", notificationController.getUnreadCount.bind(notificationController));
router.get("/notifications/stats", notificationController.getStats.bind(notificationController));
router.get("/notifications/preferences", notificationController.getPreferences.bind(notificationController));
router.put("/notifications/preferences", notificationController.updatePreferences.bind(notificationController));
router.get("/notifications/:id", notificationController.getNotificationById.bind(notificationController));
router.patch("/notifications/:id/read", notificationController.markAsRead.bind(notificationController));
router.patch("/notifications/mark-all-read", notificationController.markAllAsRead.bind(notificationController));
router.delete("/notifications/:id", notificationController.deleteNotification.bind(notificationController));

// Admin routes (TODO: Add admin role middleware)
router.get("/notifications-admin/rules", notificationController.getRules.bind(notificationController));
router.post("/notifications-admin/rules", notificationController.createRule.bind(notificationController));
router.patch("/notifications-admin/rules/:id", notificationController.updateRule.bind(notificationController));
router.get("/notifications-admin/:id/delivery-logs", notificationController.getDeliveryLogs.bind(notificationController));

// Internal trigger route (TODO: Add proper authorization)
router.post("/notifications/trigger", notificationController.triggerNotification.bind(notificationController));

export default router;
