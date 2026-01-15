import { Router } from "express";
import {
  getBidsHandler,
  getBidByIdHandler,
  createBidHandler,
  updateBidHandler,
  deleteBidHandler,
  getBidFinancialBreakdownHandler,
  updateBidFinancialBreakdownHandler,
  getBidMaterialsHandler,
  createBidMaterialHandler,
  updateBidMaterialHandler,
  deleteBidMaterialHandler,
  getBidLaborHandler,
  createBidLaborHandler,
  updateBidLaborHandler,
  deleteBidLaborHandler,
  getBidTravelHandler,
  createBidTravelHandler,
  updateBidTravelHandler,
  deleteBidTravelHandler,
  createBulkLaborAndTravelHandler,
  getBidSurveyDataHandler,
  updateBidSurveyDataHandler,
  getBidPlanSpecDataHandler,
  updateBidPlanSpecDataHandler,
  getBidDesignBuildDataHandler,
  updateBidDesignBuildDataHandler,
  getBidTimelineHandler,
  createBidTimelineEventHandler,
  updateBidTimelineEventHandler,
  deleteBidTimelineEventHandler,
  getBidNotesHandler,
  createBidNoteHandler,
  updateBidNoteHandler,
  deleteBidNoteHandler,
  getBidHistoryHandler,
  getBidWithAllDataHandler,
} from "../../controllers/BidController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  authorizeModule,
  authorizeFeature,
  authorizeAnyFeature,
  loadModulePermissions,
} from "../../middleware/featureAuthorize.js";
import {
  getBidsQuerySchema,
  getBidByIdSchema,
  createBidSchema,
  updateBidSchema,
  deleteBidSchema,
  updateFinancialBreakdownSchema,
  getBidMaterialsSchema,
  createBidMaterialSchema,
  updateBidMaterialSchema,
  deleteBidMaterialSchema,
  getBidLaborSchema,
  createBidLaborSchema,
  updateBidLaborSchema,
  deleteBidLaborSchema,
  getBidTravelSchema,
  createBidTravelSchema,
  updateBidTravelSchema,
  deleteBidTravelSchema,
  createBulkLaborAndTravelSchema,
  updateBidSurveyDataSchema,
  updateBidPlanSpecDataSchema,
  updateBidDesignBuildDataSchema,
  getBidTimelineSchema,
  createBidTimelineEventSchema,
  updateBidTimelineEventSchema,
  deleteBidTimelineEventSchema,
  getBidNotesSchema,
  createBidNoteSchema,
  updateBidNoteSchema,
  deleteBidNoteSchema,
  getBidHistorySchema,
  getBidWithAllDataSchema,
} from "../../validations/bid.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

router.use(authenticate);
router.use(authorizeModule("bids"));
router.use(loadModulePermissions("bids"));

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Main Bid Routes

router
  .route("/bids")
  .get(
    authorizeFeature("bids", "view"),
    validate(getBidsQuerySchema),
    getBidsHandler
  )
  .post(
    authorizeFeature("bids", "create"),
    validate(createBidSchema),
    createBidHandler
  );

router
  .route("/bids/:id")
  .get(
    authorizeFeature("bids", "view"),
    validate(getBidByIdSchema),
    getBidByIdHandler
  )
  .put(
    authorizeAnyFeature("bids", ["edit_own", "edit_pending"]),
    validate(updateBidSchema),
    updateBidHandler
  )
  .delete(
    authorizeFeature("bids", "delete"),
    validate(deleteBidSchema),
    deleteBidHandler
  );

// Get bid with all related data
router
  .route("/bids/:id/complete")
  .get(validate(getBidWithAllDataSchema), getBidWithAllDataHandler);

// Financial Breakdown Routes

router
  .route("/bids/:bidId/financial-breakdown")
  .get(getBidFinancialBreakdownHandler)
  .put(
    validate(updateFinancialBreakdownSchema),
    updateBidFinancialBreakdownHandler
  );

// Materials Routes

router
  .route("/bids/:bidId/materials")
  .get(validate(getBidMaterialsSchema), getBidMaterialsHandler)
  .post(validate(createBidMaterialSchema), createBidMaterialHandler);

router
  .route("/bids/:bidId/materials/:materialId")
  .put(validate(updateBidMaterialSchema), updateBidMaterialHandler)
  .delete(validate(deleteBidMaterialSchema), deleteBidMaterialHandler);

// Labor Routes

router
  .route("/bids/:bidId/labor")
  .get(validate(getBidLaborSchema), getBidLaborHandler)
  .post(validate(createBidLaborSchema), createBidLaborHandler);

// Bulk Labor & Travel Route
router
  .route("/bids/:bidId/labor-travel/bulk")
  .post(
    validate(createBulkLaborAndTravelSchema),
    createBulkLaborAndTravelHandler
  );

router
  .route("/bids/:bidId/labor/:laborId")
  .put(validate(updateBidLaborSchema), updateBidLaborHandler)
  .delete(validate(deleteBidLaborSchema), deleteBidLaborHandler);

// Travel Routes

router
  .route("/bids/:bidId/travel")
  .get(validate(getBidTravelSchema), getBidTravelHandler)
  .post(validate(createBidTravelSchema), createBidTravelHandler);

router
  .route("/bids/:bidId/travel/:travelId")
  .put(validate(updateBidTravelSchema), updateBidTravelHandler)
  .delete(validate(deleteBidTravelSchema), deleteBidTravelHandler);

// Job-Type Specific Data Routes

// Survey Data Routes
router
  .route("/bids/:bidId/survey-data")
  .get(getBidSurveyDataHandler)
  .put(validate(updateBidSurveyDataSchema), updateBidSurveyDataHandler);

// Plan & Spec Data Routes
router
  .route("/bids/:bidId/plan-spec-data")
  .get(getBidPlanSpecDataHandler)
  .put(validate(updateBidPlanSpecDataSchema), updateBidPlanSpecDataHandler);

// Design Build Data Routes
router
  .route("/bids/:bidId/design-build-data")
  .get(getBidDesignBuildDataHandler)
  .put(
    validate(updateBidDesignBuildDataSchema),
    updateBidDesignBuildDataHandler
  );

// Timeline Routes

router
  .route("/bids/:bidId/timeline")
  .get(validate(getBidTimelineSchema), getBidTimelineHandler)
  .post(validate(createBidTimelineEventSchema), createBidTimelineEventHandler);

router
  .route("/bids/:bidId/timeline/:eventId")
  .put(validate(updateBidTimelineEventSchema), updateBidTimelineEventHandler)
  .delete(
    validate(deleteBidTimelineEventSchema),
    deleteBidTimelineEventHandler
  );

// Notes Routes

router
  .route("/bids/:bidId/notes")
  .get(validate(getBidNotesSchema), getBidNotesHandler)
  .post(validate(createBidNoteSchema), createBidNoteHandler);

router
  .route("/bids/:bidId/notes/:noteId")
  .put(validate(updateBidNoteSchema), updateBidNoteHandler)
  .delete(validate(deleteBidNoteSchema), deleteBidNoteHandler);

// History Routes (Read-only)

router
  .route("/bids/:bidId/history")
  .get(validate(getBidHistorySchema), getBidHistoryHandler);

export default router;
