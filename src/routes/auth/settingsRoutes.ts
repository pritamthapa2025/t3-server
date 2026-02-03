import { Router } from "express";
import * as SettingsController from "../../controllers/SettingsController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  updateCompanySettingsSchema,
  updateAnnouncementSettingsSchema,
  updateLaborRateTemplateSchema,
  bulkUpdateLaborRatesSchema,
  updateVehicleTravelDefaultsSchema,
  createTravelOriginSchema,
  updateTravelOriginSchema,
  updateOperatingExpenseDefaultsSchema,
  updateJobSettingsSchema,
  updateInvoiceSettingsSchema,
  updateTaxSettingsSchema,
  updateInventorySettingsSchema,
  updateNotificationSettingsSchema,
  updateUserNotificationPreferencesSchema,
} from "../../validations/settings.validations.js";

const router = Router();

/**
 * ============================================================================
 * SETTINGS ROUTES - /api/auth/settings/*
 * ============================================================================
 * System-wide settings management (auth schema, not org)
 */

// ===== GENERAL / COMPANY SETTINGS =====
router.get("/general", authenticate, SettingsController.getCompanySettings);
router.put(
  "/general",
  authenticate,
  validate(updateCompanySettingsSchema),
  SettingsController.updateCompanySettings,
);

// ===== ANNOUNCEMENTS =====
router.get(
  "/announcements",
  authenticate,
  SettingsController.getAnnouncementSettings,
);
router.put(
  "/announcements",
  authenticate,
  validate(updateAnnouncementSettingsSchema),
  SettingsController.updateAnnouncementSettings,
);

// ===== LABOR RATES =====
router.get("/labor-rates", authenticate, SettingsController.getLaborRates);
router.get(
  "/labor-rates/:positionId",
  authenticate,
  SettingsController.getLaborRateByPosition,
);
router.put(
  "/labor-rates/:positionId",
  authenticate,
  validate(updateLaborRateTemplateSchema),
  SettingsController.upsertLaborRate,
);
router.post(
  "/labor-rates/bulk-apply",
  authenticate,
  validate(bulkUpdateLaborRatesSchema),
  SettingsController.bulkApplyLaborRates,
);

// ===== VEHICLE & TRAVEL =====
router.get(
  "/vehicle-travel",
  authenticate,
  SettingsController.getVehicleTravelDefaults,
);
router.put(
  "/vehicle-travel",
  authenticate,
  validate(updateVehicleTravelDefaultsSchema),
  SettingsController.updateVehicleTravelDefaults,
);

// ===== TRAVEL ORIGINS =====
router.get(
  "/travel-origins",
  authenticate,
  SettingsController.getTravelOrigins,
);
router.get(
  "/travel-origins/:id",
  authenticate,
  SettingsController.getTravelOriginById,
);
router.post(
  "/travel-origins",
  authenticate,
  validate(createTravelOriginSchema),
  SettingsController.createTravelOrigin,
);
router.put(
  "/travel-origins/:id",
  authenticate,
  validate(updateTravelOriginSchema),
  SettingsController.updateTravelOrigin,
);
router.delete(
  "/travel-origins/:id",
  authenticate,
  SettingsController.deleteTravelOrigin,
);
router.patch(
  "/travel-origins/:id/set-default",
  authenticate,
  SettingsController.setDefaultTravelOrigin,
);

// ===== FINANCIAL / OPERATING EXPENSES =====
router.get(
  "/financial",
  authenticate,
  SettingsController.getOperatingExpenseDefaults,
);
router.put(
  "/financial",
  authenticate,
  validate(updateOperatingExpenseDefaultsSchema),
  SettingsController.updateOperatingExpenseDefaults,
);

// ===== JOBS SETTINGS =====
router.get("/jobs", authenticate, SettingsController.getJobSettings);
router.put(
  "/jobs",
  authenticate,
  validate(updateJobSettingsSchema),
  SettingsController.updateJobSettings,
);

// ===== INVOICING SETTINGS =====
router.get("/invoicing", authenticate, SettingsController.getInvoiceSettings);
router.put(
  "/invoicing",
  authenticate,
  validate(updateInvoiceSettingsSchema),
  SettingsController.updateInvoiceSettings,
);

// ===== TAX SETTINGS =====
router.get("/tax", authenticate, SettingsController.getTaxSettings);
router.put(
  "/tax",
  authenticate,
  validate(updateTaxSettingsSchema),
  SettingsController.updateTaxSettings,
);

// ===== INVENTORY SETTINGS =====
router.get("/inventory", authenticate, SettingsController.getInventorySettings);
router.put(
  "/inventory",
  authenticate,
  validate(updateInventorySettingsSchema),
  SettingsController.updateInventorySettings,
);

// ===== NOTIFICATION SETTINGS (System-wide) =====
router.get(
  "/notifications",
  authenticate,
  SettingsController.getNotificationSettings,
);
router.put(
  "/notifications",
  authenticate,
  validate(updateNotificationSettingsSchema),
  SettingsController.updateNotificationSettings,
);

// ===== USER NOTIFICATION PREFERENCES (Per-user) =====
router.get(
  "/notifications/preferences",
  authenticate,
  SettingsController.getUserNotificationPreferences,
);
router.put(
  "/notifications/preferences",
  authenticate,
  validate(updateUserNotificationPreferencesSchema),
  SettingsController.updateUserNotificationPreferences,
);

// ===== ROLES (Existing - just expose endpoint for UI consistency) =====
// Note: Roles are managed separately via existing role routes
// This is just a redirect/proxy for UI consistency
router.get("/roles", authenticate, (req, res) => {
  res.json({
    message: "Roles are managed via /api/auth/roles endpoint",
    redirectTo: "/api/auth/roles",
  });
});

// ===== LOGS (Read-only view) =====
// Note: Logs viewing will be implemented separately
router.get("/logs", authenticate, (req, res) => {
  res.json({
    message: "Logs viewing endpoint - to be implemented",
  });
});

export default router;
