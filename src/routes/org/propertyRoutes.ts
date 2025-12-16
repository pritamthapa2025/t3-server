import { Router } from "express";
import {
  getPropertiesHandler,
  getPropertyByIdHandler,
  createPropertyHandler,
  updatePropertyHandler,
  deletePropertyHandler,
  // createPropertyContactHandler,
  createPropertyEquipmentHandler,
  // createPropertyDocumentHandler,
  createServiceHistoryHandler,
  getPropertyKPIsHandler,
} from "../../controllers/PropertyController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { generalTransformer } from "../../middleware/response-transformer.js";
import {
  getPropertiesQuerySchema,
  getPropertyByIdSchema,
  createPropertySchema,
  updatePropertySchema,
  deletePropertySchema,
  // createPropertyContactSchema,
  createPropertyEquipmentSchema,
  // createPropertyDocumentSchema,
  createServiceHistorySchema,
} from "../../validations/property.validations.js";

const router = Router();

// Apply authentication middleware to all property routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Property KPIs route
router.get("/properties/kpis", getPropertyKPIsHandler);

// Main property routes
router
  .route("/properties")
  .get(validate(getPropertiesQuerySchema), getPropertiesHandler)
  .post(validate(createPropertySchema), createPropertyHandler);

router
  .route("/properties/:id")
  .get(validate(getPropertyByIdSchema), getPropertyByIdHandler)
  .put(validate(updatePropertySchema), updatePropertyHandler)
  .delete(validate(deletePropertySchema), deletePropertyHandler);

// Property contacts routes (coming soon)
// router
//   .route("/properties/:propertyId/contacts")
//   .post(validate(createPropertyContactSchema), createPropertyContactHandler);

// Property equipment routes
router
  .route("/properties/:propertyId/equipment")
  .post(
    validate(createPropertyEquipmentSchema),
    createPropertyEquipmentHandler
  );

// Property documents routes (coming soon)
// router
//   .route("/properties/:propertyId/documents")
//   .post(validate(createPropertyDocumentSchema), createPropertyDocumentHandler);

// Property service history routes
router
  .route("/properties/:propertyId/service-history")
  .post(validate(createServiceHistorySchema), createServiceHistoryHandler);

export default router;
