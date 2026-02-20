import type { IRouter } from "express";
import { Router } from "express";
import { notificationController } from "../../controllers/NotificationController.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAnyRole } from "../../middleware/featureAuthorize.js";

const router: IRouter = Router();

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

// Admin routes (Executive/Manager only)
const managerOrAbove = requireAnyRole("Executive", "Manager");
router.get("/notifications-admin/rules", managerOrAbove, notificationController.getRules.bind(notificationController));
router.post("/notifications-admin/rules", managerOrAbove, notificationController.createRule.bind(notificationController));
router.patch("/notifications-admin/rules/:id", managerOrAbove, notificationController.updateRule.bind(notificationController));
router.get("/notifications-admin/:id/delivery-logs", managerOrAbove, notificationController.getDeliveryLogs.bind(notificationController));

// Internal trigger route (Executive/Manager only)
router.post("/notifications/trigger", managerOrAbove, notificationController.triggerNotification.bind(notificationController));

export default router;
