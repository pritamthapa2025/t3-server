import { Router, type IRouter } from "express";
import * as SettingsController from "../../controllers/SettingsController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeModule } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  updateGeneralSettingsSchema,
  updateLaborRateTemplateSchema,
  updateVehicleTravelDefaultsSchema,
  createTravelOriginSchema,
  updateTravelOriginSchema,
  updateOperatingExpenseDefaultsSchema,
  createProposalBasisTemplateSchema,
  updateProposalBasisTemplateSchema,
  createTermsConditionsTemplateSchema,
  updateTermsConditionsTemplateSchema,
  getInvoiceSettingsSchema,
  updateInvoiceSettingsSchema,
} from "../../validations/settings.validations.js";

const router: IRouter = Router();

/**
 * ============================================================================
 * SETTINGS ROUTES - /api/auth/settings/*
 * ============================================================================
 * System-wide settings management (auth schema, not org)
 * Tabs: General | Labor Roles | Vehicle & Travel | Operating Expenses | Proposal Templates
 * Access: Executive only (enforced via authorizeModule("settings"))
 */
router.use(authenticate, authorizeModule("settings"));

// ===== GENERAL TAB =====
router
  .route("/general")
  .get(SettingsController.getGeneralSettings)
  .put(
    validate(updateGeneralSettingsSchema),
    SettingsController.updateGeneralSettings,
  );

// ===== LABOR ROLES TAB =====
router
  .route("/labor-rates")
  .get(SettingsController.getLaborRates);

router
  .route("/labor-rates/:laborRatesId")
  .get(SettingsController.getLaborRateById)
  .put(
    validate(updateLaborRateTemplateSchema),
    SettingsController.updateLaborRate,
  )
  .delete(SettingsController.deleteLaborRate);

// ===== VEHICLE & TRAVEL TAB =====
router
  .route("/vehicle-travel")
  .get(SettingsController.getVehicleTravelDefaults)
  .put(
    validate(updateVehicleTravelDefaultsSchema),
    SettingsController.updateVehicleTravelDefaults,
  );

router
  .route("/travel-origins")
  .get(SettingsController.getTravelOrigins)
  .post(
    validate(createTravelOriginSchema),
    SettingsController.createTravelOrigin,
  );

router
  .route("/travel-origins/:id/set-default")
  .patch(SettingsController.setDefaultTravelOrigin);

router
  .route("/travel-origins/:id")
  .get(SettingsController.getTravelOriginById)
  .put(
    validate(updateTravelOriginSchema),
    SettingsController.updateTravelOrigin,
  )
  .delete(SettingsController.deleteTravelOrigin);

// ===== OPERATING EXPENSES TAB =====
router
  .route("/operating-expenses")
  .get(SettingsController.getOperatingExpenseDefaults)
  .put(
    validate(updateOperatingExpenseDefaultsSchema),
    SettingsController.updateOperatingExpenseDefaults,
  );

// ===== PROPOSAL TEMPLATES TAB =====
router
  .route("/proposal-basis-templates")
  .get(SettingsController.getProposalBasisTemplates)
  .post(
    validate(createProposalBasisTemplateSchema),
    SettingsController.createProposalBasisTemplate,
  );

router
  .route("/proposal-basis-templates/:id")
  .get(SettingsController.getProposalBasisTemplateById)
  .put(
    validate(updateProposalBasisTemplateSchema),
    SettingsController.updateProposalBasisTemplate,
  )
  .delete(SettingsController.deleteProposalBasisTemplate);

router
  .route("/terms-conditions-templates")
  .get(SettingsController.getTermsConditionsTemplates)
  .post(
    validate(createTermsConditionsTemplateSchema),
    SettingsController.createTermsConditionsTemplate,
  );

router
  .route("/terms-conditions-templates/:id/set-default")
  .patch(SettingsController.setDefaultTermsConditionsTemplate);

router
  .route("/terms-conditions-templates/:id")
  .get(SettingsController.getTermsConditionsTemplateById)
  .put(
    validate(updateTermsConditionsTemplateSchema),
    SettingsController.updateTermsConditionsTemplate,
  )
  .delete(SettingsController.deleteTermsConditionsTemplate);

// ===== INVOICE SETTINGS TAB (system-wide) =====
router
  .route("/invoice")
  .get(
    validate(getInvoiceSettingsSchema),
    SettingsController.getInvoiceSettings,
  )
  .put(
    validate(updateInvoiceSettingsSchema),
    SettingsController.updateInvoiceSettings,
  );

export default router;
