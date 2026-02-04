import { Router } from "express";
import multer from "multer";
import {
  getBidsHandler,
  getBidByIdHandler,
  createBidHandler,
  updateBidHandler,
  deleteBidHandler,
  getBidFinancialBreakdownHandler,
  updateBidFinancialBreakdownHandler,
  getBidOperatingExpensesHandler,
  createBidOperatingExpensesHandler,
  updateBidOperatingExpensesHandler,
  deleteBidOperatingExpensesHandler,
  getBidMaterialsHandler,
  getBidMaterialByIdHandler,
  createBidMaterialHandler,
  updateBidMaterialHandler,
  deleteBidMaterialHandler,
  getBidLaborHandler,
  getBidLaborByIdHandler,
  createBidLaborHandler,
  updateBidLaborHandler,
  deleteBidLaborHandler,
  getBidTravelHandler,
  getAllBidTravelHandler,
  getBidTravelByIdHandler,
  createBidTravelHandler,
  createBidTravelDirectHandler,
  updateBidTravelHandler,
  updateBidTravelDirectHandler,
  deleteBidTravelHandler,
  deleteBidTravelDirectHandler,
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
  getRelatedBidsHandler,
  createBidDocumentsHandler,
  getBidDocumentsHandler,
  getBidDocumentByIdHandler,
  updateBidDocumentHandler,
  deleteBidDocumentHandler,
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
  getBidOperatingExpensesSchema,
  createBidOperatingExpensesSchema,
  updateBidOperatingExpensesSchema,
  deleteBidOperatingExpensesSchema,
  getBidMaterialsSchema,
  getBidMaterialByIdSchema,
  createBidMaterialSchema,
  updateBidMaterialSchema,
  deleteBidMaterialSchema,
  getBidLaborSchema,
  getBidLaborByIdSchema,
  createBidLaborSchema,
  updateBidLaborSchema,
  deleteBidLaborSchema,
  getBidTravelSchema,
  getAllBidTravelSchema,
  getBidTravelByIdSchema,
  createBidTravelSchema,
  createBidTravelDirectSchema,
  updateBidTravelSchema,
  updateBidTravelDirectSchema,
  deleteBidTravelSchema,
  deleteBidTravelDirectSchema,
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
  getRelatedBidsSchema,
  createBidDocumentsSchema,
  getBidDocumentsSchema,
  getBidDocumentByIdSchema,
  updateBidDocumentSchema,
  deleteBidDocumentSchema,
} from "../../validations/bid.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

// Configure multer for bid document uploads (multiple files with dynamic field names)
const uploadBidDocuments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for documents
    cb(null, true);
  },
}).any(); // Accept any files - controller will handle document_0, document_1, etc. pattern

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB per file.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Middleware to parse JSON data field from multipart/form-data
const parseFormData = (req: any, res: any, next: any) => {
  // Only parse if it's multipart/form-data and has a 'data' field
  if (
    req.headers["content-type"]?.includes("multipart/form-data") &&
    req.body &&
    req.body.data
  ) {
    try {
      // Parse the stringified JSON data field
      const parsedData =
        typeof req.body.data === "string"
          ? JSON.parse(req.body.data)
          : req.body.data;
      // Merge parsed data into req.body, preserving files and other fields
      req.body = { ...parsedData, ...req.body };
      // Remove the 'data' field itself to avoid duplication
      delete req.body.data;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON in 'data' field",
      });
    }
  }
  next();
};

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
    getBidsHandler,
  )
  .post(
    authorizeFeature("bids", "create"),
    uploadBidDocuments,
    handleMulterError,
    parseFormData,
    validate(createBidSchema),
    createBidHandler,
  );

router
  .route("/bids/:id")
  .get(
    authorizeFeature("bids", "view"),
    validate(getBidByIdSchema),
    getBidByIdHandler,
  )
  .put(
    authorizeAnyFeature("bids", ["edit_own", "edit_pending"]),
    uploadBidDocuments,
    handleMulterError,
    parseFormData,
    validate(updateBidSchema),
    updateBidHandler,
  )
  .delete(
    authorizeFeature("bids", "delete"),
    validate(deleteBidSchema),
    deleteBidHandler,
  );

// Get bid with all related data
router
  .route("/bids/:id/complete")
  .get(validate(getBidWithAllDataSchema), getBidWithAllDataHandler);

// Get all bids for the same organization (related bids)
router
  .route("/bids/:bidId/related-bids")
  .get(
    authorizeFeature("bids", "view"),
    validate(getRelatedBidsSchema),
    getRelatedBidsHandler,
  );

// Financial Breakdown Routes

router
  .route("/bids/:bidId/financial-breakdown")
  .get(getBidFinancialBreakdownHandler)
  .put(
    validate(updateFinancialBreakdownSchema),
    updateBidFinancialBreakdownHandler,
  );

// Operating Expenses Routes
router
  .route("/bids/:bidId/operating-expenses")
  .get(validate(getBidOperatingExpensesSchema), getBidOperatingExpensesHandler)
  .post(
    validate(createBidOperatingExpensesSchema),
    createBidOperatingExpensesHandler,
  )
  .put(
    validate(updateBidOperatingExpensesSchema),
    updateBidOperatingExpensesHandler,
  )
  .delete(
    validate(deleteBidOperatingExpensesSchema),
    deleteBidOperatingExpensesHandler,
  );

// Materials Routes

router
  .route("/bids/:bidId/materials")
  .get(validate(getBidMaterialsSchema), getBidMaterialsHandler)
  .post(validate(createBidMaterialSchema), createBidMaterialHandler);

router
  .route("/bids/:bidId/materials/:materialId")
  .get(validate(getBidMaterialByIdSchema), getBidMaterialByIdHandler)
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
    createBulkLaborAndTravelHandler,
  );

router
  .route("/bids/:bidId/labor/:laborId")
  .get(validate(getBidLaborByIdSchema), getBidLaborByIdHandler)
  .put(validate(updateBidLaborSchema), updateBidLaborHandler)
  .delete(validate(deleteBidLaborSchema), deleteBidLaborHandler);

// Travel Routes

// Get ALL travel entries for a bid (regardless of labor)
router
  .route("/bids/:bidId/travel")
  .get(validate(getAllBidTravelSchema), getAllBidTravelHandler)
  .post(validate(createBidTravelDirectSchema), createBidTravelDirectHandler);

router
  .route("/bids/:bidId/travel/:travelId")
  .get(validate(getBidTravelByIdSchema), getBidTravelByIdHandler)
  .put(validate(updateBidTravelDirectSchema), updateBidTravelDirectHandler)
  .delete(validate(deleteBidTravelDirectSchema), deleteBidTravelDirectHandler);

// Travel for specific labor entry
router
  .route("/bids/:bidId/labor/:laborId/travel")
  .get(validate(getBidTravelSchema), getBidTravelHandler)
  .post(validate(createBidTravelSchema), createBidTravelHandler);

router
  .route("/bids/:bidId/labor/:laborId/travel/:travelId")
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
    updateBidDesignBuildDataHandler,
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
    deleteBidTimelineEventHandler,
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

// Documents Routes

router
  .route("/bids/:bidId/documents")
  .get(validate(getBidDocumentsSchema), getBidDocumentsHandler)
  .post(
    uploadBidDocuments,
    handleMulterError,
    validate(createBidDocumentsSchema),
    createBidDocumentsHandler,
  );

router
  .route("/bids/:bidId/documents/:documentId")
  .get(validate(getBidDocumentByIdSchema), getBidDocumentByIdHandler)
  .put(
    uploadBidDocuments,
    handleMulterError,
    validate(updateBidDocumentSchema),
    updateBidDocumentHandler,
  )
  .delete(validate(deleteBidDocumentSchema), deleteBidDocumentHandler);

export default router;
