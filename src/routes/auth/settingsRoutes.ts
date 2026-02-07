import { Router, type IRouter } from "express";
import * as SettingsController from "../../controllers/SettingsController.js";
import { authenticate } from "../../middleware/auth.js";
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
 */

// ===== GENERAL TAB =====
router
  .route("/general")
  .get(authenticate, SettingsController.getGeneralSettings)
  .put(
    authenticate,
    validate(updateGeneralSettingsSchema),
    SettingsController.updateGeneralSettings,
  );

// ===== LABOR ROLES TAB =====
router
  .route("/labor-rates")
  .get(authenticate, SettingsController.getLaborRates);

router
  .route("/labor-rates/:laborRatesId")
  .get(authenticate, SettingsController.getLaborRateById)
  .put(
    authenticate,
    validate(updateLaborRateTemplateSchema),
    SettingsController.updateLaborRate,
  )
  .delete(authenticate, SettingsController.deleteLaborRate);

// ===== VEHICLE & TRAVEL TAB =====
router
  .route("/vehicle-travel")
  .get(authenticate, SettingsController.getVehicleTravelDefaults)
  .put(
    authenticate,
    validate(updateVehicleTravelDefaultsSchema),
    SettingsController.updateVehicleTravelDefaults,
  );

router
  .route("/travel-origins")
  .get(authenticate, SettingsController.getTravelOrigins)
  .post(
    authenticate,
    validate(createTravelOriginSchema),
    SettingsController.createTravelOrigin,
  );

router
  .route("/travel-origins/:id/set-default")
  .patch(authenticate, SettingsController.setDefaultTravelOrigin);

router
  .route("/travel-origins/:id")
  .get(authenticate, SettingsController.getTravelOriginById)
  .put(
    authenticate,
    validate(updateTravelOriginSchema),
    SettingsController.updateTravelOrigin,
  )
  .delete(authenticate, SettingsController.deleteTravelOrigin);

// ===== OPERATING EXPENSES TAB =====
router
  .route("/operating-expenses")
  .get(authenticate, SettingsController.getOperatingExpenseDefaults)
  .put(
    authenticate,
    validate(updateOperatingExpenseDefaultsSchema),
    SettingsController.updateOperatingExpenseDefaults,
  );

// ===== PROPOSAL TEMPLATES TAB =====
router
  .route("/proposal-basis-templates")
  .get(authenticate, SettingsController.getProposalBasisTemplates)
  .post(
    authenticate,
    validate(createProposalBasisTemplateSchema),
    SettingsController.createProposalBasisTemplate,
  );

router
  .route("/proposal-basis-templates/:id")
  .get(authenticate, SettingsController.getProposalBasisTemplateById)
  .put(
    authenticate,
    validate(updateProposalBasisTemplateSchema),
    SettingsController.updateProposalBasisTemplate,
  )
  .delete(authenticate, SettingsController.deleteProposalBasisTemplate);

router
  .route("/terms-conditions-templates")
  .get(authenticate, SettingsController.getTermsConditionsTemplates)
  .post(
    authenticate,
    validate(createTermsConditionsTemplateSchema),
    SettingsController.createTermsConditionsTemplate,
  );

router
  .route("/terms-conditions-templates/:id/set-default")
  .patch(authenticate, SettingsController.setDefaultTermsConditionsTemplate);

router
  .route("/terms-conditions-templates/:id")
  .get(authenticate, SettingsController.getTermsConditionsTemplateById)
  .put(
    authenticate,
    validate(updateTermsConditionsTemplateSchema),
    SettingsController.updateTermsConditionsTemplate,
  )
  .delete(authenticate, SettingsController.deleteTermsConditionsTemplate);

// ===== INVOICE SETTINGS TAB (system-wide) =====
router
  .route("/invoice")
  .get(
    authenticate,
    validate(getInvoiceSettingsSchema),
    SettingsController.getInvoiceSettings,
  )
  .put(
    authenticate,
    validate(updateInvoiceSettingsSchema),
    SettingsController.updateInvoiceSettings,
  );

export default router;
