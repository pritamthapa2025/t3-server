import { Router } from "express";
import { z } from "zod";
import * as reviewController from "../../controllers/ReviewController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getReviewsQuerySchema,
  getReviewByIdSchema,
  createReviewSchema,
  updateReviewSchema,
  deleteReviewSchema,
  getReviewsByEmployeeIdSchema,
  createEmployeeReviewSchema,
  getEmployeeReviewSummarySchema,
  getReviewAnalyticsSchema,
  bulkCreateReviewsSchema,
} from "../../validations/review.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== GENERAL REVIEW ROUTES ====================

// Get reviews with pagination and filters
router.get(
  "/",
  validate(z.object({ query: getReviewsQuerySchema })),
  reviewController.getReviews
);

// Get review analytics (must be before /:id route)
router.get(
  "/analytics",
  validate(z.object({ query: getReviewAnalyticsSchema })),
  reviewController.getReviewAnalytics
);

// Get review templates (must be before /:id route)
router.get(
  "/templates",
  reviewController.getReviewTemplates
);

// Bulk create reviews (must be before /:id route)
router.post(
  "/bulk",
  validate(bulkCreateReviewsSchema),
  reviewController.bulkCreateReviews
);

// Get review by ID
router.get(
  "/:id",
  validate(getReviewByIdSchema),
  reviewController.getReviewById
);

// Create new review
router.post(
  "/",
  validate(createReviewSchema),
  reviewController.createReview
);

// Update review
router.put(
  "/:id",
  validate(updateReviewSchema),
  reviewController.updateReview
);

// Delete review
router.delete(
  "/:id",
  validate(deleteReviewSchema),
  reviewController.deleteReview
);

// ==================== EMPLOYEE-SPECIFIC REVIEW ROUTES ====================

// Get reviews for specific employee
router.get(
  "/employees/:employeeId",
  validate(getReviewsByEmployeeIdSchema),
  reviewController.getEmployeeReviews
);

// Create review for specific employee
router.post(
  "/employees/:employeeId",
  validate(createEmployeeReviewSchema),
  reviewController.createEmployeeReview
);

// Get employee review summary
router.get(
  "/employees/:employeeId/summary",
  validate(getEmployeeReviewSummarySchema),
  reviewController.getEmployeeReviewSummary
);

export default router;






