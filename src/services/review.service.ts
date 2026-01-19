import {
  count,
  eq,
  desc,
  asc,
  and,
  or,
  ilike,
  gte,
  lte,
  sql,
  avg,
} from "drizzle-orm";
import { db } from "../config/db.js";
import { employeeReviews, employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// ============================
// Helper Functions
// ============================

/**
 * Calculate average score from ratings object
 */
const calculateAverageScore = (ratings: Record<string, any>): number => {
  if (!ratings || typeof ratings !== 'object') return 0;

  const categories = Object.keys(ratings);
  if (categories.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const category of categories) {
    const rating = ratings[category];
    if (rating && typeof rating.score === 'number') {
      const score = rating.score;
      const weight = rating.weight || 1;
      totalWeightedScore += score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) / 100 : 0;
};

// ============================
// REVIEW SERVICES
// ============================

/**
 * Get reviews with pagination and filters
 */
export const getReviews = async (options: {
  page?: number;
  limit?: number;
  employeeId?: number;
  reviewerId?: string;
  startDate?: string;
  endDate?: string;
  minScore?: number;
  maxScore?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 10, 100);
  const offset = (page - 1) * limit;

  let whereConditions: any[] = [eq(employeeReviews.isDeleted, false)];

  if (options.employeeId) {
    whereConditions.push(eq(employeeReviews.employeeId, options.employeeId));
  }

  if (options.reviewerId) {
    whereConditions.push(eq(employeeReviews.reviewerId, options.reviewerId));
  }

  if (options.startDate) {
    whereConditions.push(gte(employeeReviews.reviewDate, new Date(options.startDate)));
  }

  if (options.endDate) {
    whereConditions.push(lte(employeeReviews.reviewDate, new Date(options.endDate)));
  }

  if (options.minScore !== undefined) {
    whereConditions.push(
      sql`CAST(${employeeReviews.averageScore} AS DECIMAL) >= ${options.minScore}`
    );
  }

  if (options.maxScore !== undefined) {
    whereConditions.push(
      sql`CAST(${employeeReviews.averageScore} AS DECIMAL) <= ${options.maxScore}`
    );
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`;
    whereConditions.push(
      or(
        ilike(employeeReviews.title, searchTerm),
        ilike(employeeReviews.notes, searchTerm)
      )!
    );
  }

  const orderBy =
    options.sortBy === "reviewDate"
      ? options.sortOrder === "asc"
        ? asc(employeeReviews.reviewDate)
        : desc(employeeReviews.reviewDate)
      : options.sortBy === "averageScore"
      ? options.sortOrder === "asc"
        ? asc(sql`CAST(${employeeReviews.averageScore} AS DECIMAL)`)
        : desc(sql`CAST(${employeeReviews.averageScore} AS DECIMAL)`)
      : desc(employeeReviews.createdAt);

  const [reviewsList, totalResult] = await Promise.all([
    db
      .select({
        id: employeeReviews.id,
        employeeId: employeeReviews.employeeId,
        reviewerId: employeeReviews.reviewerId,
        title: employeeReviews.title,
        reviewDate: employeeReviews.reviewDate,
        ratings: employeeReviews.ratings,
        averageScore: employeeReviews.averageScore,
        notes: employeeReviews.notes,
        createdAt: employeeReviews.createdAt,
        updatedAt: employeeReviews.updatedAt,
        // Employee info
        employeeName: sql<string>`employee_user.full_name`,
        employeeEmail: sql<string>`employee_user.email`,
        // Reviewer info
        reviewerName: users.fullName,
        reviewerEmail: users.email,
      })
      .from(employeeReviews)
      .leftJoin(employees, eq(employeeReviews.employeeId, employees.id))
      .leftJoin(sql`auth.users as employee_user`, eq(employees.userId, sql`employee_user.id`))
      .leftJoin(users, eq(employeeReviews.reviewerId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(employeeReviews)
      .leftJoin(employees, eq(employeeReviews.employeeId, employees.id))
      .leftJoin(sql`auth.users as employee_user`, eq(employees.userId, sql`employee_user.id`))
      .leftJoin(users, eq(employeeReviews.reviewerId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    reviews: reviewsList.map(review => ({
      ...review,
      employee: review.employeeName ? {
        id: review.employeeId,
        name: review.employeeName,
        email: review.employeeEmail,
      } : null,
      reviewer: review.reviewerName ? {
        id: review.reviewerId,
        name: review.reviewerName,
        email: review.reviewerEmail,
      } : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Get review by ID
 */
export const getReviewById = async (id: number) => {
  const [review] = await db
    .select({
      id: employeeReviews.id,
      employeeId: employeeReviews.employeeId,
      reviewerId: employeeReviews.reviewerId,
      title: employeeReviews.title,
      reviewDate: employeeReviews.reviewDate,
      ratings: employeeReviews.ratings,
      averageScore: employeeReviews.averageScore,
      notes: employeeReviews.notes,
      createdAt: employeeReviews.createdAt,
      updatedAt: employeeReviews.updatedAt,
        // Employee info
        employeeName: sql<string>`employee_user.full_name`,
        employeeEmail: sql<string>`employee_user.email`,
      // Reviewer info
      reviewerName: users.fullName,
      reviewerEmail: users.email,
    })
    .from(employeeReviews)
    .leftJoin(employees, eq(employeeReviews.employeeId, employees.id))
    .leftJoin(sql`auth.users as employee_user`, eq(employees.userId, sql`employee_user.id`))
    .leftJoin(users, eq(employeeReviews.reviewerId, users.id))
    .where(and(eq(employeeReviews.id, id), eq(employeeReviews.isDeleted, false)))
    .limit(1);

  if (!review) return null;

  return {
    ...review,
    employee: review.employeeName ? {
      id: review.employeeId,
      name: review.employeeName,
      email: review.employeeEmail,
    } : null,
    reviewer: review.reviewerName ? {
      id: review.reviewerId,
      name: review.reviewerName,
      email: review.reviewerEmail,
    } : null,
  };
};

/**
 * Create new review
 */
export const createReview = async (data: {
  employeeId: number;
  reviewerId?: string;
  title: string;
  reviewDate?: string;
  ratings: Record<string, any>;
  notes?: string;
}) => {
  const averageScore = calculateAverageScore(data.ratings);
  const reviewDate = data.reviewDate ? new Date(data.reviewDate) : new Date();

  const [review] = await db
    .insert(employeeReviews)
    .values({
      employeeId: data.employeeId,
      reviewerId: data.reviewerId || null,
      title: data.title,
      reviewDate,
      ratings: data.ratings,
      averageScore: averageScore.toString(),
      notes: data.notes || null,
    })
    .returning();

  return review;
};

/**
 * Update review
 */
export const updateReview = async (
  id: number,
  data: {
    reviewerId?: string;
    title?: string;
    reviewDate?: string;
    ratings?: Record<string, any>;
    notes?: string;
  }
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.reviewerId !== undefined) updateData.reviewerId = data.reviewerId || null;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.reviewDate !== undefined) updateData.reviewDate = new Date(data.reviewDate);
  if (data.ratings !== undefined) {
    updateData.ratings = data.ratings;
    updateData.averageScore = calculateAverageScore(data.ratings).toString();
  }
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const [updatedReview] = await db
    .update(employeeReviews)
    .set(updateData)
    .where(eq(employeeReviews.id, id))
    .returning();

  return updatedReview;
};

/**
 * Delete review (soft delete)
 */
export const deleteReview = async (id: number) => {
  const [deletedReview] = await db
    .update(employeeReviews)
    .set({ 
      isDeleted: true,
      updatedAt: new Date()
    })
    .where(eq(employeeReviews.id, id))
    .returning();

  return deletedReview;
};

/**
 * Get reviews for specific employee
 */
export const getEmployeeReviews = async (
  employeeId: number,
  options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
) => {
  return await getReviews({
    ...options,
    employeeId,
  });
};

/**
 * Get employee review summary/statistics
 */
export const getEmployeeReviewSummary = async (
  employeeId: number,
  options: {
    startDate?: string;
    endDate?: string;
    period?: string;
  }
) => {
  let whereConditions: any[] = [
    eq(employeeReviews.employeeId, employeeId),
    eq(employeeReviews.isDeleted, false)
  ];

  // Handle period filtering
  if (options.period) {
    const now = new Date();
    let startDate: Date;

    switch (options.period) {
      case "last_3_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "last_6_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case "last_year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default: // all_time
        startDate = new Date(0);
    }
    
    if (options.period !== "all_time") {
      whereConditions.push(gte(employeeReviews.reviewDate, startDate));
    }
  }

  if (options.startDate) {
    whereConditions.push(gte(employeeReviews.reviewDate, new Date(options.startDate)));
  }

  if (options.endDate) {
    whereConditions.push(lte(employeeReviews.reviewDate, new Date(options.endDate)));
  }

  const [summary] = await db
    .select({
      totalReviews: count(),
      averageScore: avg(sql`CAST(${employeeReviews.averageScore} AS DECIMAL)`),
      latestReviewDate: sql<Date>`MAX(${employeeReviews.reviewDate})`,
      earliestReviewDate: sql<Date>`MIN(${employeeReviews.reviewDate})`,
    })
    .from(employeeReviews)
    .where(and(...whereConditions));

  // Get score trend (last 5 reviews)
  const recentReviews = await db
    .select({
      reviewDate: employeeReviews.reviewDate,
      averageScore: employeeReviews.averageScore,
    })
    .from(employeeReviews)
    .where(and(
      eq(employeeReviews.employeeId, employeeId),
      eq(employeeReviews.isDeleted, false)
    ))
    .orderBy(desc(employeeReviews.reviewDate))
    .limit(5);

  return {
    ...summary,
    scoreHistory: recentReviews.map(r => ({
      date: r.reviewDate,
      score: parseFloat(r.averageScore || "0"),
    })).reverse(), // Oldest to newest for trend
  };
};

/**
 * Get review analytics across all employees
 */
export const getReviewAnalytics = async (options: {
  startDate?: string;
  endDate?: string;
  departmentId?: number;
  period?: string;
}) => {
  let whereConditions: any[] = [eq(employeeReviews.isDeleted, false)];
  let joinConditions: any[] = [];

  // Handle period filtering
  if (options.period) {
    const now = new Date();
    let startDate: Date;

    switch (options.period) {
      case "last_3_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "last_6_months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case "last_year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default: // all_time
        startDate = new Date(0);
    }
    
    if (options.period !== "all_time") {
      whereConditions.push(gte(employeeReviews.reviewDate, startDate));
    }
  }

  if (options.startDate) {
    whereConditions.push(gte(employeeReviews.reviewDate, new Date(options.startDate)));
  }

  if (options.endDate) {
    whereConditions.push(lte(employeeReviews.reviewDate, new Date(options.endDate)));
  }

  if (options.departmentId) {
    joinConditions.push(eq(employees.departmentId, options.departmentId));
  }

  const [analytics] = await db
    .select({
      totalReviews: count(),
      averageScore: avg(sql`CAST(${employeeReviews.averageScore} AS DECIMAL)`),
      employeesReviewed: sql<number>`COUNT(DISTINCT ${employeeReviews.employeeId})`,
    })
    .from(employeeReviews)
    .leftJoin(employees, eq(employeeReviews.employeeId, employees.id))
    .where(
      and(
        ...(whereConditions.length > 0 ? whereConditions : []),
        ...(joinConditions.length > 0 ? joinConditions : [])
      )
    );

  // Get score distribution
  const scoreDistribution = await db
    .select({
      scoreRange: sql<string>`CASE 
        WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 4.5 THEN 'Excellent (4.5-5.0)'
        WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 3.5 THEN 'Good (3.5-4.4)'
        WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 2.5 THEN 'Average (2.5-3.4)'
        WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 1.5 THEN 'Below Average (1.5-2.4)'
        ELSE 'Poor (1.0-1.4)'
      END`,
      count: count(),
    })
    .from(employeeReviews)
    .leftJoin(employees, eq(employeeReviews.employeeId, employees.id))
    .where(
      and(
        ...(whereConditions.length > 0 ? whereConditions : []),
        ...(joinConditions.length > 0 ? joinConditions : [])
      )
    )
    .groupBy(sql`CASE 
      WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 4.5 THEN 'Excellent (4.5-5.0)'
      WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 3.5 THEN 'Good (3.5-4.4)'
      WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 2.5 THEN 'Average (2.5-3.4)'
      WHEN CAST(${employeeReviews.averageScore} AS DECIMAL) >= 1.5 THEN 'Below Average (1.5-2.4)'
      ELSE 'Poor (1.0-1.4)'
    END`);

  return {
    ...analytics,
    scoreDistribution,
  };
};

/**
 * Bulk create reviews (for annual review cycles)
 */
export const bulkCreateReviews = async (reviews: Array<{
  employeeId: number;
  reviewerId?: string;
  title: string;
  reviewDate?: string;
  ratings: Record<string, any>;
  notes?: string;
}>) => {
  const reviewsToCreate = reviews.map(review => ({
    employeeId: review.employeeId,
    reviewerId: review.reviewerId || null,
    title: review.title,
    reviewDate: review.reviewDate ? new Date(review.reviewDate) : new Date(),
    ratings: review.ratings,
    averageScore: calculateAverageScore(review.ratings).toString(),
    notes: review.notes || null,
  }));

  const createdReviews = await db
    .insert(employeeReviews)
    .values(reviewsToCreate)
    .returning();

  return createdReviews;
};
