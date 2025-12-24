import { z } from "zod";

// Helper to validate UUID strings
const uuidString = z.string().uuid("Must be a valid UUID");

// Helper to validate date strings (YYYY-MM-DD)
const dateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid date format. Please use YYYY-MM-DD format" }
);

// Rating category schema
const ratingCategorySchema = z.object({
  category: z.string().min(1, "Category name is required"),
  score: z.number().min(1).max(5, "Score must be between 1 and 5"),
  weight: z.number().min(0).max(1).default(1), // Weight for calculating average
  comments: z.string().optional(),
});

// Ratings schema - can contain multiple rating categories
const ratingsSchema = z.object({
  communication: ratingCategorySchema.optional(),
  teamwork: ratingCategorySchema.optional(),
  technical_skills: ratingCategorySchema.optional(),
  leadership: ratingCategorySchema.optional(),
  problem_solving: ratingCategorySchema.optional(),
  time_management: ratingCategorySchema.optional(),
  quality_of_work: ratingCategorySchema.optional(),
  initiative: ratingCategorySchema.optional(),
  adaptability: ratingCategorySchema.optional(),
  overall_performance: ratingCategorySchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one rating category is required" }
);

// Alternative: More flexible ratings schema for custom categories
const flexibleRatingsSchema = z.record(
  z.string(),
  ratingCategorySchema
).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one rating category is required" }
);

// ==================== REVIEW VALIDATIONS ====================

// Get Reviews Query Schema
export const getReviewsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  employeeId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  reviewerId: uuidString.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  minScore: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  maxScore: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  search: z.string().optional(), // Search in title, notes
  sortBy: z.enum(["reviewDate", "averageScore", "createdAt"]).optional().default("reviewDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Get Review by ID Params Schema
export const getReviewByIdSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// Get Reviews by Employee ID Schema
export const getReviewsByEmployeeIdSchema = z.object({
  params: z.object({
    employeeId: z.string().transform((val) => parseInt(val, 10)),
  }),
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    sortBy: z.enum(["reviewDate", "averageScore", "createdAt"]).optional().default("reviewDate"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

// Create Review Schema
export const createReviewSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID is required"),
    reviewerId: uuidString.optional(),
    title: z.string().min(1, "Review title is required").max(150, "Title too long"),
    reviewDate: dateString.optional(), // Defaults to current date if not provided
    ratings: flexibleRatingsSchema, // Use flexible schema to allow custom categories
    notes: z.string().optional(),
  }),
});

// Create Review for Employee Schema (when creating via employee endpoint)
export const createEmployeeReviewSchema = z.object({
  params: z.object({
    employeeId: z.string().transform((val) => parseInt(val, 10)),
  }),
  body: z.object({
    reviewerId: uuidString.optional(),
    title: z.string().min(1, "Review title is required").max(150, "Title too long"),
    reviewDate: dateString.optional(),
    ratings: flexibleRatingsSchema,
    notes: z.string().optional(),
  }),
});

// Update Review for Employee Schema (when updating via employee endpoint)
export const updateEmployeeReviewSchema = z.object({
  params: z.object({
    employeeId: z.string().transform((val) => parseInt(val, 10)),
    reviewId: z.string().transform((val) => parseInt(val, 10)),
  }),
  body: z.object({
    reviewerId: uuidString.optional(),
    title: z.string().min(1, "Review title is required").max(150, "Title too long").optional(),
    reviewDate: dateString.optional(),
    ratings: flexibleRatingsSchema.optional(),
    notes: z.string().optional(),
  }),
});

// Update Review Schema
export const updateReviewSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
  body: z.object({
    reviewerId: uuidString.optional(),
    title: z.string().min(1, "Review title is required").max(150, "Title too long").optional(),
    reviewDate: dateString.optional(),
    ratings: flexibleRatingsSchema.optional(),
    notes: z.string().optional(),
  }),
});

// Delete Review Schema
export const deleteReviewSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)),
  }),
});

// ==================== REVIEW SUMMARY/STATS VALIDATIONS ====================

// Get Employee Review Summary Schema
export const getEmployeeReviewSummarySchema = z.object({
  params: z.object({
    employeeId: z.string().transform((val) => parseInt(val, 10)),
  }),
  query: z.object({
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    period: z.enum(["last_year", "last_6_months", "last_3_months", "all_time"]).optional().default("last_year"),
  }),
});

// Get Review Analytics Schema  
export const getReviewAnalyticsSchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  departmentId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  period: z.enum(["last_year", "last_6_months", "last_3_months", "all_time"]).optional().default("last_year"),
});

// Bulk Create Reviews Schema (for annual review cycles)
export const bulkCreateReviewsSchema = z.object({
  body: z.object({
    reviews: z.array(z.object({
      employeeId: z.number().int().positive(),
      reviewerId: uuidString.optional(),
      title: z.string().min(1).max(150),
      reviewDate: dateString.optional(),
      ratings: flexibleRatingsSchema,
      notes: z.string().optional(),
    })).min(1, "At least one review is required"),
    reviewCycle: z.string().optional(), // e.g., "Q4 2024", "Annual 2024"
  }),
});

// Review Template Schema (for standardizing review categories)
export const reviewTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    categories: z.array(z.object({
      name: z.string().min(1, "Category name is required"),
      description: z.string().optional(),
      weight: z.number().min(0).max(1).default(1),
      required: z.boolean().default(true),
    })).min(1, "At least one category is required"),
    isActive: z.boolean().default(true),
  }),
});

