import { count, eq, and, desc, asc, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable, bidFinancialBreakdown } from "../drizzle/schema/bids.schema.js";
import {
  financialSummary,
  financialCostCategories,
  profitTrend,
  cashFlowProjection,
  cashFlowScenarios,
  revenueForecast,
  financialReports,
} from "../drizzle/schema/client.schema.js";

// ============================
// Financial Summary Operations
// ============================

export const getJobFinancialSummaries = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    jobId?: string;
    search?: string;
  }
) => {
  let whereCondition = and(
    eq(jobs.isDeleted, false)
  );

  // Add filters
  if (filters?.jobId) {
    whereCondition = and(whereCondition, eq(jobs.id, filters.jobId));
  }

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.name, `%${filters.search}%`),
        ilike(jobs.jobNumber, `%${filters.search}%`)
      )
    );
  }

  const summaries = await db
    .select({
      job: jobs,
      bid: bidsTable,
      financialBreakdown: bidFinancialBreakdown,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(bidFinancialBreakdown, eq(bidsTable.id, bidFinancialBreakdown.bidId))
    .where(
      and(
        whereCondition,
        eq(bidsTable.organizationId, organizationId)
      )
    )
    .orderBy(desc(jobs.updatedAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalCountResult = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        whereCondition,
        eq(bidsTable.organizationId, organizationId)
      )
    );
  
  const totalCount = totalCountResult[0]?.count || 0;

  return {
    summaries,
    totalCount,
    // Also return structure expected by controller
    data: summaries,
    total: totalCount,
    pagination: {
      offset,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

// ============================
// Financial Analytics
// ============================

export const getFinancialOverview = async (organizationId: string) => {
  // Get total contract values from jobs
  const contractSummary = await db
    .select({
      totalJobs: count(jobs.id),
      totalContractValue: sql<string>`COALESCE(SUM(CAST(${jobs.contractValue} AS NUMERIC)), 0)`,
      avgContractValue: sql<string>`COALESCE(AVG(CAST(${jobs.contractValue} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );

  // Get bid amounts for comparison
  const bidSummary = await db
    .select({
      totalBids: count(bidsTable.id),
      totalBidAmount: sql<string>`COALESCE(SUM(CAST(${bidsTable.bidAmount} AS NUMERIC)), 0)`,
      avgBidAmount: sql<string>`COALESCE(AVG(CAST(${bidsTable.bidAmount} AS NUMERIC)), 0)`,
    })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(bidsTable.isDeleted, false)
      )
    );

  // Get jobs by status for revenue pipeline
  const jobsByStatus = await db
    .select({
      status: jobs.status,
      count: count(jobs.id),
      totalValue: sql<string>`COALESCE(SUM(CAST(${jobs.contractValue} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .groupBy(jobs.status);

  return {
    contracts: contractSummary[0] || {
      totalJobs: 0,
      totalContractValue: "0",
      avgContractValue: "0",
    },
    bids: bidSummary[0] || {
      totalBids: 0,
      totalBidAmount: "0",
      avgBidAmount: "0",
    },
    pipeline: jobsByStatus,
  };
};

export const getMonthlyFinancialTrends = async (
  organizationId: string,
  months: number = 12
) => {
  const monthlyData = await db
    .select({
      month: sql<string>`TO_CHAR(${jobs.createdAt}, 'YYYY-MM')`,
      jobsCount: count(jobs.id),
      totalContractValue: sql<string>`COALESCE(SUM(CAST(${jobs.contractValue} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false),
        sql`${jobs.createdAt} >= NOW() - INTERVAL '${months} months'`
      )
    )
    .groupBy(sql`TO_CHAR(${jobs.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${jobs.createdAt}, 'YYYY-MM')`);

  return monthlyData;
};

// ============================
// Financial Summary Operations (Table-based)
// ============================

export const getFinancialSummary = async (
  organizationId: string,
  periodStart?: string,
  periodEnd?: string
) => {
  let whereCondition = eq(financialSummary.organizationId, organizationId);

  if (periodStart && periodEnd) {
    whereCondition = and(
      whereCondition,
      sql`${financialSummary.periodStart} >= ${periodStart}`,
      sql`${financialSummary.periodEnd} <= ${periodEnd}`
    ) ?? whereCondition;
  }

  const result = await db
    .select()
    .from(financialSummary)
    .where(whereCondition)
    .orderBy(desc(financialSummary.periodStart));

  return result[0] || null;
};

export const createFinancialSummary = async (data: {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalContractValue?: string;
  totalInvoiced?: string;
  totalPaid?: string;
  totalJobExpenses?: string;
  totalOperatingExpenses?: string;
  totalCost?: string;
  projectedProfit?: string;
  actualProfit?: string;
}) => {
  const result = await db
    .insert(financialSummary)
    .values({
      ...data,
    })
    .returning();
  return result[0];
};

export const updateFinancialSummary = async (
  id: string,
  data: Partial<{
    totalContractValue: string;
    totalInvoiced: string;
    totalPaid: string;
    totalJobExpenses: string;
    totalOperatingExpenses: string;
    totalCost: string;
    projectedProfit: string;
    actualProfit: string;
  }>
) => {
  const result = await db
    .update(financialSummary)
    .set({
      ...data,
    })
    .where(eq(financialSummary.id, id))
    .returning();
  return result[0];
};

export const getJobFinancialSummary = async (jobId: string) => {
  // Get job financial data from existing tables
  const result = await db
    .select({
      job: jobs,
      bid: bidsTable,
      financialBreakdown: bidFinancialBreakdown,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(bidFinancialBreakdown, eq(bidsTable.id, bidFinancialBreakdown.bidId))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  return result[0] || null;
};

export const createJobFinancialSummary = async (data: {
  jobId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue?: string;
  totalExpenses?: string;
  grossProfit?: string;
}) => {
  // Create a financial summary for this specific job
  return await createFinancialSummary({
    organizationId: data.organizationId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
  });
};

export const updateJobFinancialSummary = async (
  jobId: string,
  data: Partial<{
    totalRevenue: string;
    totalExpenses: string;
    grossProfit: string;
  }>
) => {
  // Find the financial summary for this job and update it
  const summary = await db
    .select()
    .from(financialSummary)
    .where(
      eq(financialSummary.organizationId, jobId) // Using jobId as organizationId for job-specific summaries
    );

  if (summary[0]) {
    // Map the field names to match the expected schema
    const mappedData: Partial<{
      totalContractValue: string;
      totalInvoiced: string;
      totalPaid: string;
      totalJobExpenses: string;
      totalOperatingExpenses: string;
      totalCost: string;
      projectedProfit: string;
      actualProfit: string;
    }> = {};
    
    if (data.totalRevenue) mappedData.totalContractValue = data.totalRevenue;
    if (data.totalExpenses) mappedData.totalJobExpenses = data.totalExpenses;
    if (data.grossProfit) mappedData.projectedProfit = data.grossProfit;
    
    return await updateFinancialSummary(summary[0].id, mappedData);
  }
  return null;
};

// ============================
// Financial Cost Categories
// ============================

export const getFinancialCostCategories = async (organizationId: string) => {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }
  
  return await db
    .select()
    .from(financialCostCategories)
    .where(eq(financialCostCategories.organizationId, organizationId))
    .orderBy(asc(financialCostCategories.categoryLabel));
};

export const createFinancialCostCategory = async (data: {
  organizationId: string;
  categoryKey: string;
  categoryLabel: string;
  periodStart: string;
  periodEnd: string;
  spent?: string;
  budget?: string;
}) => {
  const result = await db
    .insert(financialCostCategories)
    .values({
      organizationId: data.organizationId,
      categoryKey: data.categoryKey,
      categoryLabel: data.categoryLabel,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      spent: data.spent || "0",
      budget: data.budget || "0",
    })
    .returning();
  return result[0];
};

export const updateFinancialCostCategory = async (
  id: string,
  data: Partial<{
    categoryKey: string;
    categoryLabel: string;
    spent: string;
    budget: string;
    status: string;
  }>
) => {
  const result = await db
    .update(financialCostCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(financialCostCategories.id, id))
    .returning();
  return result[0];
};

export const deleteFinancialCostCategory = async (id: string) => {
  const result = await db
    .update(financialCostCategories)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(financialCostCategories.id, id))
    .returning();
  return result[0];
};

// ============================
// Profit Trends
// ============================

export const getProfitTrend = async (
  organizationId: string,
  months: number = 12
) => {
  return await db
    .select()
    .from(profitTrend)
    .where(eq(profitTrend.organizationId, organizationId))
    .orderBy(desc(profitTrend.period))
    .limit(months);
};

export const createProfitTrend = async (data: {
  organizationId: string;
  period: string;
  periodDate: string;
  revenue?: string;
  expenses?: string;
}) => {
  const result = await db
    .insert(profitTrend)
    .values({
      organizationId: data.organizationId,
      period: data.period,
      periodDate: data.periodDate,
      revenue: data.revenue,
      expenses: data.expenses,
    })
    .returning();
  return result[0];
};

// ============================
// Cash Flow Operations
// ============================

export const getCashFlowProjections = async (organizationId: string) => {
  return await db
    .select()
    .from(cashFlowProjection)
    .where(eq(cashFlowProjection.organizationId, organizationId))
    .orderBy(desc(cashFlowProjection.projectionDate));
};

export const createCashFlowProjection = async (data: {
  organizationId: string;
  projectionDate: string;
  periodStart: string;
  periodEnd: string;
  projectedIncome?: string;
  projectedExpenses?: string;
}) => {
  const result = await db
    .insert(cashFlowProjection)
    .values({
      ...data,
    })
    .returning();
  return result[0];
};

export const updateCashFlowProjection = async (
  id: string,
  data: Partial<{
    projectedIncome: string;
    projectedExpenses: string;
    projectedBalance: string;
  }>
) => {
  const result = await db
    .update(cashFlowProjection)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(cashFlowProjection.id, id))
    .returning();
  return result[0];
};

export const getCashFlowScenarios = async (organizationId: string) => {
  return await db
    .select()
    .from(cashFlowScenarios)
    .where(eq(cashFlowScenarios.organizationId, organizationId))
    .orderBy(asc(cashFlowScenarios.label));
};

export const createCashFlowScenario = async (data: {
  organizationId: string;
  label: string;
  description?: string;
  projectionId: string;
  scenarioType: string;
}) => {
  const result = await db
    .insert(cashFlowScenarios)
    .values({
      ...data,
    })
    .returning();
  return result[0];
};

export const updateCashFlowScenario = async (
  id: string,
  data: Partial<{
    label: string;
    description: string;
    scenarioType: string;
  }>
) => {
  const result = await db
    .update(cashFlowScenarios)
    .set({
      ...data,
    })
    .where(eq(cashFlowScenarios.id, id))
    .returning();
  return result[0];
};

// ============================
// Revenue Forecast
// ============================

export const getRevenueForecast = async (organizationId: string) => {
  return await db
    .select()
    .from(revenueForecast)
    .where(eq(revenueForecast.organizationId, organizationId))
    .orderBy(desc(revenueForecast.monthDate));
};

export const createRevenueForecast = async (data: {
  organizationId: string;
  month: string;
  monthDate: string;
  committed?: string;
  pipeline?: string;
  probability?: string;
}) => {
  const result = await db
    .insert(revenueForecast)
    .values({
      ...data,
    })
    .returning();
  return result[0];
};

export const updateRevenueForecast = async (
  id: string,
  data: Partial<{
    projectedRevenue: string;
    confidence: number;
  }>
) => {
  const result = await db
    .update(revenueForecast)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(revenueForecast.id, id))
    .returning();
  return result[0];
};

// ============================
// Financial Reports
// ============================

export const getFinancialReports = async (organizationId: string) => {
  return await db
    .select()
    .from(financialReports)
    .where(and(
      eq(financialReports.organizationId, organizationId),
    ))
    .orderBy(desc(financialReports.createdAt));
};

export const createFinancialReport = async (data: {
  organizationId: string;
  reportKey: string;
  title: string;
  category: string;
  description?: string;
  reportConfig?: any;
}) => {
  const result = await db
    .insert(financialReports)
    .values({
      organizationId: data.organizationId,
      reportKey: data.reportKey,
      title: data.title,
      category: data.category,
      description: data.description,
      reportConfig: data.reportConfig,
    })
    .returning();
  return result[0];
};

export const updateFinancialReport = async (
  id: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    reportConfig: any;
  }>
) => {
  const result = await db
    .update(financialReports)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(financialReports.id, id))
    .returning();
  return result[0];
};

export const deleteFinancialReport = async (id: string) => {
  const result = await db
    .delete(financialReports)
    .where(eq(financialReports.id, id))
    .returning();
  return result[0];
};