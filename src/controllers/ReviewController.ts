import type { Request, Response } from "express";
import * as reviewService from "../services/review.service.js";
import { logger } from "../utils/logger.js";

/**
 * Get reviews with pagination and filtering
 * GET /reviews
 */
export const getReviews = async (req: Request, res: Response) => {
  try {
    const result = await reviewService.getReviews(req.query as any);

    logger.info("Reviews fetched successfully");
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching reviews", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

/**
 * Get review by ID
 * GET /reviews/:id
 */
export const getReviewById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required",
      });
    }

    const review = await reviewService.getReviewById(parseInt(id, 10));

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    logger.info(`Review ${id} fetched successfully`);
    res.json({
      success: true,
      data: { review },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch review",
      error: error.message,
    });
  }
};

/**
 * Create new review
 * POST /reviews
 */
export const createReview = async (req: Request, res: Response) => {
  try {
    const review = await reviewService.createReview(req.body);

    if (!review) {
      return res.status(500).json({
        success: false,
        message: "Failed to create review",
      });
    }

    const fullReview = await reviewService.getReviewById(review.id);

    logger.info(`Review ${review.id} created successfully`);
    res.status(201).json({
      success: true,
      data: { review: fullReview },
      message: "Review created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create review",
      error: error.message,
    });
  }
};

/**
 * Update review
 * PUT /reviews/:id
 */
export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required",
      });
    }

    const updatedReview = await reviewService.updateReview(parseInt(id, 10), req.body);

    if (!updatedReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const fullReview = await reviewService.getReviewById(updatedReview.id);

    logger.info(`Review ${id} updated successfully`);
    res.json({
      success: true,
      data: { review: fullReview },
      message: "Review updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update review",
      error: error.message,
    });
  }
};

/**
 * Delete review
 * DELETE /reviews/:id
 */
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required",
      });
    }

    const deletedReview = await reviewService.deleteReview(parseInt(id, 10));

    if (!deletedReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    logger.info(`Review ${id} deleted successfully`);
    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};

/**
 * Get reviews for specific employee
 * GET /employees/:employeeId/reviews
 */
export const getEmployeeReviews = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const result = await reviewService.getEmployeeReviews(
      parseInt(employeeId, 10),
      req.query as any
    );

    logger.info(`Reviews for employee ${employeeId} fetched successfully`);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching employee reviews", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee reviews",
      error: error.message,
    });
  }
};

/**
 * Create review for specific employee
 * POST /employees/:employeeId/reviews
 */
export const createEmployeeReview = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const review = await reviewService.createReview({
      ...req.body,
      employeeId: parseInt(employeeId, 10),
    });

    if (!review) {
      return res.status(500).json({
        success: false,
        message: "Failed to create employee review",
      });
    }

    const fullReview = await reviewService.getReviewById(review.id);

    logger.info(`Employee review ${review.id} created successfully`);
    res.status(201).json({
      success: true,
      data: { review: fullReview },
      message: "Employee review created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating employee review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create employee review",
      error: error.message,
    });
  }
};

/**
 * Update review for specific employee
 * PUT /employees/:employeeId/reviews/:reviewId
 */
export const updateEmployeeReview = async (req: Request, res: Response) => {
  try {
    const { employeeId, reviewId } = req.params;
    if (!employeeId || !reviewId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and Review ID are required",
      });
    }

    // First verify the review belongs to the employee
    const existingReview = await reviewService.getReviewById(parseInt(reviewId, 10));
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (existingReview.employeeId !== parseInt(employeeId, 10)) {
      return res.status(400).json({
        success: false,
        message: "Review does not belong to the specified employee",
      });
    }

    const updatedReview = await reviewService.updateReview(parseInt(reviewId, 10), req.body);

    if (!updatedReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found or could not be updated",
      });
    }

    const fullReview = await reviewService.getReviewById(updatedReview.id);

    logger.info(`Employee review ${reviewId} updated successfully`);
    res.json({
      success: true,
      data: { review: fullReview },
      message: "Employee review updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating employee review", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update employee review",
      error: error.message,
    });
  }
};

/**
 * Get employee review summary
 * GET /employees/:employeeId/reviews/summary
 */
export const getEmployeeReviewSummary = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const summary = await reviewService.getEmployeeReviewSummary(
      parseInt(employeeId, 10),
      req.query as any
    );

    logger.info(`Employee review summary for employee ${employeeId} fetched successfully`);
    res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching employee review summary", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee review summary",
      error: error.message,
    });
  }
};

/**
 * Get review analytics
 * GET /reviews/analytics
 */
export const getReviewAnalytics = async (req: Request, res: Response) => {
  try {
    const analytics = await reviewService.getReviewAnalytics(req.query as any);

    logger.info("Review analytics fetched successfully");
    res.json({
      success: true,
      data: { analytics },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching review analytics", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch review analytics",
      error: error.message,
    });
  }
};

/**
 * Bulk create reviews (for annual review cycles)
 * POST /reviews/bulk
 */
export const bulkCreateReviews = async (req: Request, res: Response) => {
  try {
    const { reviews, reviewCycle } = req.body;

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reviews array is required and cannot be empty",
      });
    }

    const createdReviews = await reviewService.bulkCreateReviews(reviews);

    logger.info(`${createdReviews.length} reviews created successfully in bulk`);
    res.status(201).json({
      success: true,
      data: {
        reviews: createdReviews,
        count: createdReviews.length,
        reviewCycle,
      },
      message: `Successfully created ${createdReviews.length} reviews`,
    });
  } catch (error: any) {
    logger.logApiError("Error bulk creating reviews", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to bulk create reviews",
      error: error.message,
    });
  }
};

/**
 * Get review templates/categories (helper endpoint)
 * GET /reviews/templates
 */
export const getReviewTemplates = async (req: Request, res: Response) => {
  try {
    // Return standard review categories
    const templates = [
      {
        name: "Standard Performance Review",
        description: "Standard employee performance evaluation",
        categories: [
          {
            name: "communication",
            description: "Communication skills and clarity",
            weight: 1,
            required: true,
          },
          {
            name: "teamwork",
            description: "Collaboration and team contribution",
            weight: 1,
            required: true,
          },
          {
            name: "technical_skills",
            description: "Job-specific technical competencies",
            weight: 1.2,
            required: true,
          },
          {
            name: "problem_solving",
            description: "Analytical thinking and solution finding",
            weight: 1,
            required: true,
          },
          {
            name: "time_management",
            description: "Organization and deadline management",
            weight: 0.8,
            required: true,
          },
          {
            name: "quality_of_work",
            description: "Attention to detail and work standards",
            weight: 1.2,
            required: true,
          },
          {
            name: "initiative",
            description: "Proactivity and self-motivation",
            weight: 0.8,
            required: false,
          },
          {
            name: "adaptability",
            description: "Flexibility and change management",
            weight: 0.8,
            required: false,
          },
        ],
      },
      {
        name: "Leadership Review",
        description: "Review template for leadership positions",
        categories: [
          {
            name: "leadership",
            description: "Leadership and mentoring abilities",
            weight: 1.5,
            required: true,
          },
          {
            name: "strategic_thinking",
            description: "Vision and strategic planning",
            weight: 1.2,
            required: true,
          },
          {
            name: "team_development",
            description: "Team building and development",
            weight: 1.2,
            required: true,
          },
          {
            name: "decision_making",
            description: "Quality and speed of decisions",
            weight: 1.1,
            required: true,
          },
          {
            name: "communication",
            description: "Leadership communication skills",
            weight: 1,
            required: true,
          },
        ],
      },
    ];

    logger.info("Review templates fetched successfully");
    res.json({
      success: true,
      data: { templates },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching review templates", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch review templates",
      error: error.message,
    });
  }
};
