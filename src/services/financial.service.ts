import { count, eq, and, desc, asc, sql, or, ilike, gte, lte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable, bidFinancialBreakdown } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { expenses } from "../drizzle/schema/expenses.schema.js";
import { payrollTimesheetEntries } from "../drizzle/schema/payroll.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { getBidFinancialBreakdown } from "./bid.service.js";
import {
  financialSummary,
  financialCostCategories,
  profitTrend,
  cashFlowProjection,
  cashFlowScenarios,
  revenueForecast,
  financialReports,
} from "../drizzle/schema/client.schema.js";
import { financialCategoryBudgets } from "../drizzle/schema/financial.schema.js";
import {
  getProfitAndLossStatement,
  getJobProfitability,
} from "./reports.service.js";

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
      totalContractValue: sql<string>`COALESCE(SUM(CAST(${bidsTable.actualTotalPrice} AS NUMERIC)), 0)`,
      avgContractValue: sql<string>`COALESCE(AVG(CAST(${bidsTable.actualTotalPrice} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );

  // Get bid amounts for comparison (using actualTotalPrice from bid_financial_breakdown)
  const bidSummary = await db
    .select({
      totalBids: count(bidsTable.id),
      totalBidAmount: sql<string>`COALESCE(SUM(CAST(${bidFinancialBreakdown.actualTotalPrice} AS NUMERIC)), 0)`,
      avgBidAmount: sql<string>`COALESCE(AVG(CAST(${bidFinancialBreakdown.actualTotalPrice} AS NUMERIC)), 0)`,
    })
    .from(bidsTable)
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
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
      totalValue: sql<string>`COALESCE(SUM(CAST(${bidsTable.actualTotalPrice} AS NUMERIC)), 0)`,
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
      totalContractValue: sql<string>`COALESCE(SUM(CAST(${bidsTable.actualTotalPrice} AS NUMERIC)), 0)`,
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
  organizationId: string | undefined,
  periodStart?: string,
  periodEnd?: string
) => {
  // Build conditions array - organizationId is optional
  const conditions = [];
  
  if (organizationId) {
    conditions.push(eq(financialSummary.organizationId, organizationId));
  }

  if (periodStart && periodEnd) {
    conditions.push(sql`${financialSummary.periodStart} >= ${periodStart}`);
    conditions.push(sql`${financialSummary.periodEnd} <= ${periodEnd}`);
  }

  // Build query conditionally based on whether we have conditions
  let query = db.select().from(financialSummary);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = await query.orderBy(desc(financialSummary.periodStart));

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
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      job: jobs,
      bid: bidsTable,
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.isDeleted, false)
      )
    );

  if (!jobData) {
    return null;
  }

  // Get the financial breakdown using the bid's organizationId
  const financialBreakdown = await getBidFinancialBreakdown(
    jobData.bidId,
    jobData.organizationId
  );

  return financialBreakdown;
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

export const getFinancialCostCategories = async (organizationId: string | undefined) => {
  // If no organizationId provided, return all cost categories across all organizations
  let query = db.select().from(financialCostCategories);
  
  if (organizationId) {
    query = query.where(eq(financialCostCategories.organizationId, organizationId)) as any;
  }
  
  return await query.orderBy(asc(financialCostCategories.categoryLabel));
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
  organizationId: string | undefined,
  months: number = 12
) => {
  let query = db.select().from(profitTrend);
  
  if (organizationId) {
    query = query.where(eq(profitTrend.organizationId, organizationId)) as any;
  }
    
  return await query
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

export const getCashFlowProjections = async (organizationId: string | undefined) => {
  let query = db.select().from(cashFlowProjection);
  
  if (organizationId) {
    query = query.where(eq(cashFlowProjection.organizationId, organizationId)) as any;
  }
    
  return await query.orderBy(desc(cashFlowProjection.projectionDate));
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

export const getCashFlowScenarios = async (organizationId: string | undefined) => {
  let query = db.select().from(cashFlowScenarios);
  
  if (organizationId) {
    query = query.where(eq(cashFlowScenarios.organizationId, organizationId)) as any;
  }
    
  return await query.orderBy(asc(cashFlowScenarios.label));
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

export const getRevenueForecast = async (organizationId: string | undefined) => {
  let query = db.select().from(revenueForecast);
  
  if (organizationId) {
    query = query.where(eq(revenueForecast.organizationId, organizationId)) as any;
  }
    
  return await query.orderBy(desc(revenueForecast.monthDate));
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

export const getFinancialReports = async (organizationId: string | undefined) => {
  let query = db.select().from(financialReports);
  
  if (organizationId) {
    query = query.where(eq(financialReports.organizationId, organizationId)) as any;
  }
    
  return await query.orderBy(desc(financialReports.createdAt));
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

// ============================
// Financial Module – section APIs (report-style, one per tab/area)
// ============================

export interface FinancialDashboardFilters {
  startDate?: string | undefined;
  endDate?: string | undefined;
  month?: number | undefined;
  year?: number | undefined;
}

type SummaryShape = {
  totalContractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  remainingBalance: number;
  totalJobExpenses: number;
  totalOperatingExpenses: number;
  totalCost: number;
  projectedProfit: number;
  actualProfit: number;
  profitabilityPercentage: number;
};

async function buildSummary(
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters
): Promise<SummaryShape> {
  const dateFilters = { startDate: filters?.startDate, endDate: filters?.endDate };
  const storedSummary = organizationId
    ? await getFinancialSummary(organizationId, filters?.startDate, filters?.endDate)
    : null;
  if (storedSummary) {
    const totalInvoiced = parseFloat(storedSummary.totalInvoiced ?? "0");
    const totalPaid = parseFloat(storedSummary.totalPaid ?? "0");
    return {
      totalContractValue: parseFloat(storedSummary.totalContractValue ?? "0"),
      totalInvoiced,
      totalPaid,
      remainingBalance: parseFloat(storedSummary.totalInvoiced ?? "0") - totalPaid,
      totalJobExpenses: parseFloat(storedSummary.totalJobExpenses ?? "0"),
      totalOperatingExpenses: parseFloat(storedSummary.totalOperatingExpenses ?? "0"),
      totalCost: parseFloat(storedSummary.totalCost ?? "0"),
      projectedProfit: parseFloat(storedSummary.projectedProfit ?? "0"),
      actualProfit: parseFloat(storedSummary.actualProfit ?? "0"),
      profitabilityPercentage:
        parseFloat(storedSummary.actualProfit ?? "0") > 0 && parseFloat(storedSummary.projectedProfit ?? "0") > 0
          ? parseFloat(storedSummary.actualProfit ?? "0") / parseFloat(storedSummary.projectedProfit ?? "0")
          : 0,
    };
  }
  const profitLoss = await getProfitAndLossStatement(organizationId, dateFilters);
    const NON_CANCELLED_STATUSES = ["draft", "pending", "sent", "viewed", "partial", "paid", "overdue"] as const;
  const conditions = [
      ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
      eq(invoices.isDeleted, false),
      inArray(invoices.status, [...NON_CANCELLED_STATUSES]),
    ];
    if (dateFilters.startDate) conditions.push(gte(invoices.invoiceDate, dateFilters.startDate));
    if (dateFilters.endDate) conditions.push(lte(invoices.invoiceDate, dateFilters.endDate));
    const [paidRow] = await db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
      totalInvoiced: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .innerJoin(jobs, eq(invoices.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions));
  const totalInvoiced = parseFloat(paidRow?.totalInvoiced ?? "0");
  const totalPaid = parseFloat(paidRow?.totalPaid ?? "0");
  
  // Calculate totalContractValue from bids that have been converted to jobs
  const contractConditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(jobs.isDeleted, false),
  ];
  const [contractRow] = await db
    .select({
      totalContractValue: sql<string>`COALESCE(SUM(CAST(${bidFinancialBreakdown.actualTotalPrice} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidFinancialBreakdown.bidId, bidsTable.id),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .where(and(...contractConditions));
  const totalContractValue = parseFloat(contractRow?.totalContractValue ?? "0");
  
  return {
    totalContractValue,
    totalInvoiced,
    totalPaid,
    remainingBalance: totalInvoiced - totalPaid,
    totalJobExpenses: profitLoss.totalJobExpenses,
    totalOperatingExpenses: profitLoss.operatingExpenses,
    totalCost: profitLoss.totalCost,
    projectedProfit: profitLoss.netProfit,
    actualProfit: profitLoss.netProfit,
    profitabilityPercentage: 1,
  };
}

/** GET /financial/summary – Top-level KPIs only */
export const getFinancialSummarySection = async (
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters
) => {
  const summary = await buildSummary(organizationId, filters);
  return { data: summary };
};

export interface FinancialJobsSummaryPagination {
  page?: number;
  limit?: number;
  search?: string;
}

/** GET /financial/jobs-summary – Jobs list for Summary tab table (supports pagination + search) */
export const getFinancialJobsSummarySection = async (
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters,
  pagination?: FinancialJobsSummaryPagination
) => {
  const dateFilters = { startDate: filters?.startDate, endDate: filters?.endDate };
  const page = Math.max(1, pagination?.page ?? 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 10));
  const search = pagination?.search?.trim() || undefined;
  const opts =
    search != null || pagination?.page != null || pagination?.limit != null
      ? { limit, offset: (page - 1) * limit, ...(search !== undefined ? { search } : {}) }
      : undefined;

  const result = await getJobProfitability(organizationId, dateFilters, opts);
  const profitabilityRows = Array.isArray(result)
    ? result
    : result.data;
  const totalCount = Array.isArray(result)
    ? result.length
    : result.total;
  const jobIds = profitabilityRows.map((j: { id: string }) => j.id);
  const contractByJob: Map<string, number> = new Map();
  const startDateByJob: Map<string, string> = new Map();
  const totalPaidByJob: Map<string, number> = new Map();
  const laborPaidByJob: Map<string, number> = new Map();
  
  if (jobIds.length > 0) {
    // Get contract values and start dates
    const jobConditions = [
      eq(jobs.isDeleted, false),
      inArray(jobs.id, jobIds)
    ];
    if (organizationId) {
      jobConditions.push(eq(bidsTable.organizationId, organizationId));
    }
    
    const jobRows = await db
      .select({ 
        jobId: jobs.id, 
        contractValue: bidFinancialBreakdown.actualTotalPrice, 
        startDate: jobs.createdAt
      })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .leftJoin(
        bidFinancialBreakdown,
        and(
          eq(bidFinancialBreakdown.bidId, bidsTable.id),
          eq(bidFinancialBreakdown.isDeleted, false),
        ),
      )
      .where(and(...jobConditions));
    for (const row of jobRows) {
      contractByJob.set(row.jobId, parseFloat((row.contractValue as string) ?? "0"));
      startDateByJob.set(row.jobId, row.startDate ? String(row.startDate).slice(0, 10) : "");
    }
    
    // Get per-job invoice payment totals
    const paymentRows = await db
      .select({
        jobId: invoices.jobId,
        totalPaid: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.isDeleted, false), inArray(invoices.jobId, jobIds)))
      .groupBy(invoices.jobId);
    for (const row of paymentRows) {
      totalPaidByJob.set(row.jobId, parseFloat(row.totalPaid ?? "0"));
    }
    
    // Get labor costs paid to date per job from payroll_timesheet_entries
    // Calculate: SUM(jobHours × hourlyRate) for each job
    // Join: payroll_timesheet_entries -> timesheets -> employees to get hourly rates
    const laborCostRows = await db
      .select({
        jobId: payrollTimesheetEntries.jobId,
        totalLaborCost: sql<string>`COALESCE(SUM(
          CAST(${payrollTimesheetEntries.jobHours} AS NUMERIC) * 
          CAST(COALESCE(${employees.hourlyRate}, 0) AS NUMERIC)
        ), 0)`,
      })
      .from(payrollTimesheetEntries)
      .innerJoin(timesheets, eq(payrollTimesheetEntries.timesheetId, timesheets.id))
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(
        and(
          inArray(payrollTimesheetEntries.jobId, jobIds),
          eq(payrollTimesheetEntries.includedInPayroll, true)
        )
      )
      .groupBy(payrollTimesheetEntries.jobId);
    for (const row of laborCostRows) {
      if (row.jobId) {
        laborPaidByJob.set(row.jobId, parseFloat(row.totalLaborCost ?? "0"));
      }
    }
  }
  
  const data = profitabilityRows.map(
    (j: {
      id: string;
      jobName: string;
      revenue: number;
      totalExpenses: number;
      profit: number;
      profitMargin: number;
    }) => {
      const contractValue = contractByJob.get(j.id) ?? 0;
      const totalInvoiced = j.revenue;
      const totalPaid = totalPaidByJob.get(j.id) ?? 0;
      const outstandingBalance = totalInvoiced - totalPaid;
      const laborPaidToDate = laborPaidByJob.get(j.id) ?? 0;
      const billingPct = contractValue > 0 ? Math.round((totalInvoiced / contractValue) * 100) : 0;
      return {
        id: j.id,
        jobName: j.jobName,
        startDate: startDateByJob.get(j.id) ?? "",
        contractValue,
        billingCompletionRate: billingPct,
        jobCompletionRate: billingPct,
        totalPaid,
        totalInvoiced,
        outstandingBalance,
        vendorsOwed: 0, // TODO: Requires vendor payment/payables data (accounts payable system)
        laborPaidToDate, // Calculated from payroll_timesheet_entries: SUM(jobHours × hourlyRate) - only billable hours allocated to this job
        profitability: Math.round((j.profitMargin ?? 0) * 100),
        profitMargin: Math.round((j.profitMargin ?? 0) * 100),
        totalProfit: j.profit,
      };
    }
  );
  const totalPages = opts ? Math.ceil(totalCount / limit) || 1 : 1;
  const paginationLimit = opts ? limit : totalCount;
  return {
    data,
    total: totalCount,
    pagination: { page: opts ? page : 1, limit: paginationLimit, totalPages },
  };
};

/** GET /financial/cost-categories – Cost breakdown for Cost Breakdown tab */
export const getFinancialCostCategoriesSection = async (
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters
) => {
  const dateFilters = { startDate: filters?.startDate, endDate: filters?.endDate };
  
  // Build conditions for filtering
  const expenseConditions = [eq(expenses.isDeleted, false)];
  if (organizationId) {
    expenseConditions.push(eq(bidsTable.organizationId, organizationId));
  }
  if (dateFilters.startDate) {
    expenseConditions.push(gte(expenses.expenseDate, dateFilters.startDate));
  }
  if (dateFilters.endDate) {
    expenseConditions.push(lte(expenses.expenseDate, dateFilters.endDate));
  }

  // Get actual expenses grouped by category
  let expenseQuery = db
    .select({
      category: expenses.category,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .groupBy(expenses.category);

  if (expenseConditions.length > 0) {
    expenseQuery = expenseQuery.where(and(...expenseConditions)) as any;
  }

  const expensesByCategory = await expenseQuery;

  // Get labor costs from payroll
  const laborConditions = [eq(payrollTimesheetEntries.includedInPayroll, true)];
  if (organizationId) {
    laborConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  let laborQuery = db
    .select({
      totalLaborCost: sql<string>`COALESCE(SUM(
        CAST(${payrollTimesheetEntries.jobHours} AS NUMERIC) * 
        CAST(COALESCE(${employees.hourlyRate}, 0) AS NUMERIC)
      ), 0)`,
    })
    .from(payrollTimesheetEntries)
    .innerJoin(timesheets, eq(payrollTimesheetEntries.timesheetId, timesheets.id))
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .leftJoin(jobs, eq(payrollTimesheetEntries.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id));

  if (laborConditions.length > 0) {
    laborQuery = laborQuery.where(and(...laborConditions)) as any;
  }

  const [laborResult] = await laborQuery;
  const totalLaborCost = parseFloat(laborResult?.totalLaborCost ?? "0");

  // Category mapping and grouping
  const categoryMap: Record<string, { label: string; spent: number }> = {
    materials: { label: "Materials & Equipment", spent: 0 },
    labor: { label: "Labor", spent: totalLaborCost },
    travel: { label: "Travel & Transportation", spent: 0 },
    operating: { label: "Operating Expenses", spent: 0 },
    fleet: { label: "Fleet & Vehicles", spent: 0 },
    subcontractor: { label: "Subcontractors", spent: 0 },
  };

  // Map expense categories to main categories
  const categoryGrouping: Record<string, string> = {
    materials: "materials",
    equipment: "materials",
    tools: "materials",
    transportation: "travel",
    fuel: "travel",
    permits: "operating",
    utilities: "operating",
    office_supplies: "operating",
    rent: "operating",
    internet: "operating",
    insurance: "operating",
    safety: "operating",
    fleet: "fleet",
    maintenance: "fleet",
    tires: "fleet",
    registration: "fleet",
    repairs: "fleet",
    subcontractor: "subcontractor",
    other: "operating",
  };

  // Aggregate expenses into main categories
  for (const expense of expensesByCategory) {
    const amount = parseFloat(expense.totalAmount ?? "0");
    const mainCategory = categoryGrouping[expense.category as string] || "operating";
    if (categoryMap[mainCategory]) {
      categoryMap[mainCategory].spent += amount;
    }
  }

  // Calculate total cost
  const totalCost = Object.values(categoryMap).reduce((sum, cat) => sum + cat.spent, 0);

  // Fetch monthly budgets for the target period (default to current month/year)
  const now = new Date();
  const targetMonth = filters?.month ?? now.getMonth() + 1;
  const targetYear = filters?.year ?? now.getFullYear();

  const budgetRows = await db
    .select({
      category: financialCategoryBudgets.category,
      budgetAmount: financialCategoryBudgets.budgetAmount,
    })
    .from(financialCategoryBudgets)
    .where(
      and(
        eq(financialCategoryBudgets.month, targetMonth),
        eq(financialCategoryBudgets.year, targetYear),
        eq(financialCategoryBudgets.isDeleted, false),
      ),
    );

  const budgetByCategory: Record<string, number> = Object.fromEntries(
    budgetRows.map((r) => [r.category, parseFloat(r.budgetAmount ?? "0")]),
  );

  const deriveStatus = (spent: number, budget: number): string => {
    if (!budget) return "on-track";
    const pct = spent / budget;
    if (pct >= 1) return "over-budget";
    if (pct >= 0.8) return "at-risk";
    return "on-track";
  };

  // Categories that are always included in the response regardless of spend
  const alwaysInclude = new Set(["materials", "labor", "travel", "operating"]);

  // Format response
  const data = Object.entries(categoryMap)
    .filter(([id, cat]) => alwaysInclude.has(id) || cat.spent > 0)
    .map(([id, cat]) => {
      const budget = budgetByCategory[id] ?? 0;
      return {
        id,
        label: cat.label,
        spent: cat.spent,
        budget,
        percentOfTotal: totalCost > 0 ? cat.spent / totalCost : 0,
        status: deriveStatus(cat.spent, budget),
      };
    });

  return { data, totalCost };
};

/**
 * Returns the Monday (ISO week start) for a given date as "YYYY-MM-DD".
 * PostgreSQL DATE_TRUNC('week', ...) also uses Monday as the start.
 */
function getISOWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Dynamically compute weekly profit trend from live invoices + expenses data.
 *  Covers every ISO week between startDate and endDate (defaults to last 30 days).
 *  Every week slot is always present in the output (pre-filled with 0 when no data).
 */
async function computeProfitTrendData(
  organizationId: string | undefined,
  startDate?: string,
  endDate?: string
): Promise<{ period: string; revenue: number; expenses: number; profit: number }[]> {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 29 * 86400000);

  // Clamp both dates to their ISO week Monday so every bucket aligns with PostgreSQL DATE_TRUNC('week')
  const startKey = getISOWeekStart(start);
  const endKey = getISOWeekStart(end);

  // Pre-build weekMap covering every Monday from startKey to endKey
  const weekMap = new Map<string, { revenue: number; expenses: number }>();
  const cursor = new Date(startKey);
  while (cursor.toISOString().slice(0, 10) <= endKey) {
    weekMap.set(cursor.toISOString().slice(0, 10), { revenue: 0, expenses: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const startStr = startKey;
  const endStr = end.toISOString().slice(0, 10);

  // Revenue per week from invoices filtered to the date range
  const revenueConditions = [eq(invoices.isDeleted, false)];
  if (organizationId) {
    revenueConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const revenueRows = await db
    .select({
      weekStart: sql<string>`DATE_TRUNC('week', CAST(${invoices.invoiceDate} AS date))::text`,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .innerJoin(jobs, eq(invoices.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...revenueConditions,
        sql`CAST(${invoices.invoiceDate} AS date) BETWEEN ${sql.raw(`'${startStr}'`)} AND ${sql.raw(`'${endStr}'`)}`
      )
    )
    .groupBy(sql`DATE_TRUNC('week', CAST(${invoices.invoiceDate} AS date))`)
    .orderBy(sql`DATE_TRUNC('week', CAST(${invoices.invoiceDate} AS date)) ASC`);

  // Expenses per week filtered to the date range
  const expenseConditions = [eq(expenses.isDeleted, false)];
  if (organizationId) {
    expenseConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const expenseRows = await db
    .select({
      weekStart: sql<string>`DATE_TRUNC('week', CAST(${expenses.expenseDate} AS date))::text`,
      totalExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...expenseConditions,
        sql`CAST(${expenses.expenseDate} AS date) BETWEEN ${sql.raw(`'${startStr}'`)} AND ${sql.raw(`'${endStr}'`)}`
      )
    )
    .groupBy(sql`DATE_TRUNC('week', CAST(${expenses.expenseDate} AS date))`)
    .orderBy(sql`DATE_TRUNC('week', CAST(${expenses.expenseDate} AS date)) ASC`);

  // Merge DB results into the pre-populated weekMap
  for (const row of revenueRows) {
    const week = String(row.weekStart).slice(0, 10);
    if (weekMap.has(week)) {
      weekMap.set(week, { revenue: parseFloat(row.revenue ?? "0"), expenses: weekMap.get(week)!.expenses });
    }
  }

  for (const row of expenseRows) {
    const week = String(row.weekStart).slice(0, 10);
    if (weekMap.has(week)) {
      weekMap.set(week, { revenue: weekMap.get(week)!.revenue, expenses: parseFloat(row.totalExpenses ?? "0") });
    }
  }

  // Sort chronologically and label as "Week 1", "Week 2", ...
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data], idx) => ({
      period: `Week ${idx + 1}`,
      revenue: data.revenue,
      expenses: data.expenses,
      profit: data.revenue - data.expenses,
    }));
}

/** GET /financial/profitability – Projected vs actual, job list, trend for Profitability tab */
export const getFinancialProfitabilitySection = async (
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters
) => {
  const dateFilters = { startDate: filters?.startDate, endDate: filters?.endDate };
  const summary = await buildSummary(organizationId, filters);
  const result = await getJobProfitability(organizationId, dateFilters);
  const profitabilityRows = Array.isArray(result) ? result : result.data;
  const jobProfitability = profitabilityRows.map(
    (j: {
      id: string;
      jobName: string;
      clientName: string | null;
      revenue: number;
      totalExpenses: number;
      profit: number;
      profitMargin: number;
    }) => {
      const margin = j.revenue > 0 ? j.profit / j.revenue : 0;
      let status: "On Track" | "Watchlist" | "Over Budget" = "On Track";
      if (margin < 0.1) status = "Over Budget";
      else if (margin < 0.2) status = "Watchlist";
      return {
        id: j.id,
        jobName: j.jobName,
        clientName: j.clientName ?? "",
        revenue: j.revenue,
        expenses: j.totalExpenses,
        projectedProfit: j.profit,
        actualProfit: j.profit,
        margin,
        status,
      };
    }
  );

  // Compute trend from live data scoped to the selected date range
  const profitTrendData = await computeProfitTrendData(
    organizationId,
    filters?.startDate,
    filters?.endDate
  );

  const deviation = summary.actualProfit - summary.projectedProfit;
  return {
    data: {
      projectedProfit: summary.projectedProfit,
      actualProfit: summary.actualProfit,
      deviation,
      jobProfitability,
      profitTrendData,
    },
  };
};

/** GET /financial/profit-trend – Trend data only (for chart) */
export const getFinancialProfitTrendSection = async (
  organizationId: string | undefined,
  filters?: { startDate?: string; endDate?: string }
) => {
  const data = await computeProfitTrendData(organizationId, filters?.startDate, filters?.endDate);
  return { data };
};

/** GET /financial/forecasting – Cash flow projection, scenarios, revenue forecast */
/** GET /financial/forecasting – Cash flow projection, scenarios, revenue forecast (computed from live data) */
export const getFinancialForecastingSection = async (organizationId: string | undefined) => {
  // ── 1. Open AR: sum of balanceDue for all unpaid invoices ─────────────────
  const invoiceOrgConditions = [eq(invoices.isDeleted, false)];
  if (organizationId) {
    invoiceOrgConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const [openArRow] = await db
    .select({
      projectedIncome: sql<string>`COALESCE(SUM(
        CAST(COALESCE(${invoices.balanceDue}, ${invoices.totalAmount} - ${invoices.amountPaid}, 0) AS NUMERIC)
      ), 0)`,
      openCount: count(invoices.id),
    })
    .from(invoices)
    .innerJoin(jobs, eq(invoices.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...invoiceOrgConditions,
        sql`${invoices.status} IN ('draft', 'pending', 'sent', 'viewed', 'partial', 'overdue')`,
      )
    );

  // ── 2. Average collection days from fully paid invoices ───────────────────
  const [collectionRow] = await db
    .select({
      avgDays: sql<string>`COALESCE(AVG(
        ${invoices.paidDate}::date - ${invoices.invoiceDate}::date
      ), 30)`,
    })
    .from(invoices)
    .innerJoin(jobs, eq(invoices.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...invoiceOrgConditions,
        sql`${invoices.status} = 'paid'`,
        sql`${invoices.paidDate} IS NOT NULL`,
      )
    );

  // ── 3. Projected expenses: last-30-day run-rate as next-month estimate ────
  const expenseOrgConditions = [eq(expenses.isDeleted, false)];
  if (organizationId) {
    expenseOrgConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const [expenseRow] = await db
    .select({
      totalExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...expenseOrgConditions,
        sql`CAST(${expenses.expenseDate} AS date) >= CURRENT_DATE - INTERVAL '30 days'`,
      )
    );

  const projectedIncome = parseFloat(openArRow?.projectedIncome ?? "0");
  const projectedExpenses = parseFloat(expenseRow?.totalExpenses ?? "0");
  const netCashFlow = projectedIncome - projectedExpenses;
  const openInvoicesCount = openArRow?.openCount ?? 0;
  const avgCollectionDays = Math.round(parseFloat(collectionRow?.avgDays ?? "30"));
  // Pipeline coverage = how many months of expenses the open AR covers
  const pipelineCoverageMonths =
    projectedExpenses > 0
      ? parseFloat((projectedIncome / projectedExpenses).toFixed(1))
      : 0;

  const cashFlowProjection = {
    projectedIncome,
    projectedExpenses,
    netCashFlow,
    pipelineCoverageMonths,
    openInvoicesCount,
    averageCollectionDays: avgCollectionDays,
  };

  // ── 4. Scenarios: derived at standard industry collection rates ───────────
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const cashFlowScenarios = [
    {
      id: "best" as const,
      label: "Best Case",
      description: "100% invoice collection, current expense level",
      projectedIncome: round2(projectedIncome),
      projectedExpenses: round2(projectedExpenses),
      netCashFlow: round2(projectedIncome - projectedExpenses),
      change: "+Favorable",
    },
    {
      id: "realistic" as const,
      label: "Realistic",
      description: "80% invoice collection, current expense level",
      projectedIncome: round2(projectedIncome * 0.8),
      projectedExpenses: round2(projectedExpenses),
      netCashFlow: round2(projectedIncome * 0.8 - projectedExpenses),
      change: "Expected outcome",
    },
    {
      id: "worst" as const,
      label: "Worst Case",
      description: "60% invoice collection, expenses up 15%",
      projectedIncome: round2(projectedIncome * 0.6),
      projectedExpenses: round2(projectedExpenses * 1.15),
      netCashFlow: round2(projectedIncome * 0.6 - projectedExpenses * 1.15),
      change: "Needs attention",
    },
  ];

  // ── 5. Revenue Forecast: next 6 months ────────────────────────────────────
  // Committed = bid prices of existing (non-deleted) jobs ending in each month
  // Pipeline  = finalBidAmount of bids not yet converted to jobs, expected in each month
  const jobOrgConditions = [eq(jobs.isDeleted, false)];
  if (organizationId) {
    jobOrgConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const committedRows = await db
    .select({
      monthDate: sql<string>`DATE_TRUNC('month', ${jobs.scheduledEndDate}::date)::text`,
      committed: sql<string>`COALESCE(SUM(CAST(${bidFinancialBreakdown.totalPrice} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidFinancialBreakdown.bidId, bidsTable.id),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .where(
      and(
        ...jobOrgConditions,
        sql`${jobs.scheduledEndDate} IS NOT NULL`,
        sql`${jobs.scheduledEndDate}::date >= CURRENT_DATE`,
        sql`${jobs.scheduledEndDate}::date < CURRENT_DATE + INTERVAL '6 months'`,
      )
    )
    .groupBy(sql`DATE_TRUNC('month', ${jobs.scheduledEndDate}::date)`)
    .orderBy(sql`DATE_TRUNC('month', ${jobs.scheduledEndDate}::date) ASC`);

  const bidOrgConditions = [eq(bidsTable.isDeleted, false)];
  if (organizationId) {
    bidOrgConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const pipelineRows = await db
    .select({
      monthDate: sql<string>`DATE_TRUNC('month', ${bidsTable.estimatedCompletion}::date)::text`,
      pipeline: sql<string>`COALESCE(SUM(CAST(${bidsTable.finalBidAmount} AS NUMERIC)), 0)`,
    })
    .from(bidsTable)
    .where(
      and(
        ...bidOrgConditions,
        // Pipeline = bids not yet converted to a job (convertedToJobId is null)
        sql`${bidsTable.convertedToJobId} IS NULL`,
        sql`${bidsTable.finalBidAmount} IS NOT NULL`,
        sql`CAST(${bidsTable.finalBidAmount} AS NUMERIC) > 0`,
        sql`${bidsTable.estimatedCompletion} IS NOT NULL`,
        sql`${bidsTable.estimatedCompletion}::date >= CURRENT_DATE`,
        sql`${bidsTable.estimatedCompletion}::date < CURRENT_DATE + INTERVAL '6 months'`,
      )
    )
    .groupBy(sql`DATE_TRUNC('month', ${bidsTable.estimatedCompletion}::date)`)
    .orderBy(sql`DATE_TRUNC('month', ${bidsTable.estimatedCompletion}::date) ASC`);

  // Pre-seed next 6 months with zeros so every month always appears
  const monthMap = new Map<string, { month: string; committed: number; pipeline: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = d.toISOString().slice(0, 7); // "YYYY-MM"
    const monthLabel = d.toLocaleString("en-US", { month: "short" });
    monthMap.set(key, { month: monthLabel, committed: 0, pipeline: 0 });
  }

  for (const row of committedRows) {
    const key = String(row.monthDate).slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.committed = parseFloat(row.committed ?? "0");
  }

  for (const row of pipelineRows) {
    const key = String(row.monthDate).slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.pipeline = parseFloat(row.pipeline ?? "0");
  }

  const revenueForecast = Array.from(monthMap.values()).map((m) => ({
    month: m.month,
    committed: m.committed,
    pipeline: m.pipeline,
    // Committed revenue = certainty 1.0; pipeline uses standard 70% win probability
    probability: m.committed > 0 ? 1.0 : m.pipeline > 0 ? 0.7 : 0,
  }));

  return {
    data: {
      cashFlowProjection,
      cashFlowScenarios,
      revenueForecast,
    },
  };
};

/** GET /financial/reports – Hardcoded report definitions derived from business logic */
export const getFinancialReportsSection = async (_organizationId: string | undefined) => {
  const now = new Date();
  const updatedStr = `Updated ${formatRelativeTime(now)}`;
  const data = [
    {
      id: "profit-loss",
      title: "Profit & Loss Statement",
      description: "Revenue, cost of goods sold, gross profit, operating expenses, and net income for the selected period.",
      updatedAt: updatedStr,
      category: "Profitability" as const,
    },
    {
      id: "job-profitability",
      title: "Job Profitability Report",
      description: "Per-job breakdown of contract value, actual revenue, expenses, profit, and margin percentage.",
      updatedAt: updatedStr,
      category: "Profitability" as const,
    },
    {
      id: "expense-by-category",
      title: "Expense Breakdown by Category",
      description: "Total spend grouped by expense category (materials, labor, fleet, subcontractors, overhead) with trend.",
      updatedAt: updatedStr,
      category: "Expenses" as const,
    },
    {
      id: "revenue-by-client",
      title: "Revenue by Client",
      description: "Top clients ranked by total invoiced revenue, with percentage share of total and outstanding balances.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "invoice-aging",
      title: "Invoice Aging Report",
      description: "Outstanding invoices bucketed by age (current, 30, 60, 90+ days) to track collections and overdue risk.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "cash-flow",
      title: "Cash Flow Statement",
      description: "Monthly inflows from invoices, outflows from expenses, and net cash position across the selected period.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "vendor-spend",
      title: "Vendor Spend Summary",
      description: "Total spending per vendor/supplier with job attribution, helping identify top vendors and cost trends.",
      updatedAt: updatedStr,
      category: "Vendors" as const,
    },
    {
      id: "monthly-revenue-trend",
      title: "Monthly Revenue Trend",
      description: "Month-over-month revenue, cost, and profit breakdown — with target comparison where targets are set.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "labor-cost",
      title: "Labor Cost Report",
      description: "Hours worked and total labor cost per employee for the selected period, based on timesheet data.",
      updatedAt: updatedStr,
      category: "Expenses" as const,
    },
    {
      id: "client-outstanding",
      title: "Client Outstanding Payments",
      description: "Clients ranked by total outstanding balance with invoice count and how long the oldest invoice has been due.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "technician-profit",
      title: "Technician Profit Contribution",
      description: "Revenue, costs, and profit generated by each technician across their assigned jobs.",
      updatedAt: updatedStr,
      category: "Profitability" as const,
    },
    {
      id: "payment-collection",
      title: "Payment Collection Rate",
      description: "Monthly invoiced vs collected amounts and collection rate percentage — tracks AR efficiency.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "client-spend",
      title: "Client Spend Report",
      description: "Total billed revenue per client with job count and average job value — identify highest-value clients.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "job-cost-breakdown",
      title: "Job Cost Breakdown",
      description: "Total costs split across materials, labor, tools, fleet, subcontractors, and overhead.",
      updatedAt: updatedStr,
      category: "Expenses" as const,
    },
    {
      id: "invoice-summary",
      title: "Invoice Summary",
      description: "Invoice count and dollar totals by status (paid, unpaid, overdue) with collection rate.",
      updatedAt: updatedStr,
      category: "Revenue" as const,
    },
    {
      id: "monthly-expense-trend",
      title: "Monthly Expense Trend",
      description: "Month-over-month expense totals broken down by category — identify spending spikes over time.",
      updatedAt: updatedStr,
      category: "Expenses" as const,
    },
    {
      id: "inventory-valuation",
      title: "Inventory Valuation",
      description: "Total stock value with per-category breakdown of SKU count and dollar value.",
      updatedAt: updatedStr,
      category: "Expenses" as const,
    },
  ];
  return { data };
};

// ============================
// Financial Module Dashboard (aggregate – optional one-call)
// ============================

/** Optional: single call that returns all sections (like before). */
export const getFinancialDashboard = async (
  organizationId: string | undefined,
  filters?: FinancialDashboardFilters
) => {
  const [summaryRes, jobsRes, categoriesRes, profitabilityRes, reportsRes] = await Promise.all([
    getFinancialSummarySection(organizationId, filters),
    getFinancialJobsSummarySection(organizationId, filters, { page: 1, limit: 10 }),
    getFinancialCostCategoriesSection(organizationId, filters),
    getFinancialProfitabilitySection(organizationId, filters),
    getFinancialReportsSection(organizationId),
  ]);
  const forecastingRes = await getFinancialForecastingSection(organizationId);
  return {
    summary: summaryRes.data,
    jobsFinancialList: jobsRes.data,
    jobsTotal: jobsRes.total,
    jobsPagination: jobsRes.pagination,
    financialCostCategories: categoriesRes.data,
    totalCost: categoriesRes.totalCost,
    jobProfitability: profitabilityRes.data.jobProfitability,
    profitTrendData: profitabilityRes.data.profitTrendData,
    projectedProfit: profitabilityRes.data.projectedProfit,
    actualProfit: profitabilityRes.data.actualProfit,
    deviation: profitabilityRes.data.deviation,
    cashFlowProjection: forecastingRes.data.cashFlowProjection,
    cashFlowScenarios: forecastingRes.data.cashFlowScenarios,
    revenueForecast: forecastingRes.data.revenueForecast,
    financialReports: reportsRes.data,
  };
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

// ============================
// Financial Category Budgets
// ============================

const catBudgetCreatedByUser = alias(users, "cat_budget_created_by_user");
const catBudgetUpdatedByUser = alias(users, "cat_budget_updated_by_user");

const categoryBudgetSelect = {
  id: financialCategoryBudgets.id,
  category: financialCategoryBudgets.category,
  month: financialCategoryBudgets.month,
  year: financialCategoryBudgets.year,
  budgetAmount: financialCategoryBudgets.budgetAmount,
  notes: financialCategoryBudgets.notes,
  createdBy: financialCategoryBudgets.createdBy,
  createdByName: catBudgetCreatedByUser.fullName,
  updatedBy: financialCategoryBudgets.updatedBy,
  updatedByName: catBudgetUpdatedByUser.fullName,
  isDeleted: financialCategoryBudgets.isDeleted,
  createdAt: financialCategoryBudgets.createdAt,
  updatedAt: financialCategoryBudgets.updatedAt,
};

export const getFinancialCategoryBudgetById = async (id: string) => {
  const [row] = await db
    .select(categoryBudgetSelect)
    .from(financialCategoryBudgets)
    .leftJoin(
      catBudgetCreatedByUser,
      eq(financialCategoryBudgets.createdBy, catBudgetCreatedByUser.id),
    )
    .leftJoin(
      catBudgetUpdatedByUser,
      eq(financialCategoryBudgets.updatedBy, catBudgetUpdatedByUser.id),
    )
    .where(
      and(
        eq(financialCategoryBudgets.id, id),
        eq(financialCategoryBudgets.isDeleted, false),
      ),
    );

  if (!row) return null;

  const { createdByName, updatedByName, ...rest } = row;
  return {
    ...rest,
    createdByName: createdByName ?? null,
    updatedByName: updatedByName ?? null,
  };
};

export const listFinancialCategoryBudgets = async (filters?: {
  month?: number;
  year?: number;
  category?: string;
}) => {
  const conditions = [eq(financialCategoryBudgets.isDeleted, false)];
  if (filters?.month) conditions.push(eq(financialCategoryBudgets.month, filters.month));
  if (filters?.year) conditions.push(eq(financialCategoryBudgets.year, filters.year));
  if (filters?.category) conditions.push(eq(financialCategoryBudgets.category, filters.category));

  const rows = await db
    .select(categoryBudgetSelect)
    .from(financialCategoryBudgets)
    .leftJoin(
      catBudgetCreatedByUser,
      eq(financialCategoryBudgets.createdBy, catBudgetCreatedByUser.id),
    )
    .leftJoin(
      catBudgetUpdatedByUser,
      eq(financialCategoryBudgets.updatedBy, catBudgetUpdatedByUser.id),
    )
    .where(and(...conditions))
    .orderBy(asc(financialCategoryBudgets.year), asc(financialCategoryBudgets.month));

  return rows.map(({ createdByName, updatedByName, ...rest }) => ({
    ...rest,
    createdByName: createdByName ?? null,
    updatedByName: updatedByName ?? null,
  }));
};

export const createFinancialCategoryBudget = async (input: {
  category: string;
  month: number;
  year: number;
  budgetAmount?: number;
  notes?: string;
  createdBy?: string;
}) => {
  const [result] = await db
    .insert(financialCategoryBudgets)
    .values({
      category: input.category,
      month: input.month,
      year: input.year,
      ...(input.budgetAmount !== undefined && {
        budgetAmount: String(input.budgetAmount),
      }),
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .returning({ id: financialCategoryBudgets.id });

  if (!result) throw new Error("Failed to create financial category budget");
  return getFinancialCategoryBudgetById(result.id);
};

export const updateFinancialCategoryBudget = async (
  id: string,
  input: {
    category?: string;
    month?: number;
    year?: number;
    budgetAmount?: number;
    notes?: string;
    updatedBy?: string;
  },
) => {
  const existing = await getFinancialCategoryBudgetById(id);
  if (!existing) return null;

  await db
    .update(financialCategoryBudgets)
    .set({
      ...(input.category !== undefined && { category: input.category }),
      ...(input.month !== undefined && { month: input.month }),
      ...(input.year !== undefined && { year: input.year }),
      ...(input.budgetAmount !== undefined && {
        budgetAmount: String(input.budgetAmount),
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialCategoryBudgets.id, id),
        eq(financialCategoryBudgets.isDeleted, false),
      ),
    );

  return getFinancialCategoryBudgetById(id);
};

export const deleteFinancialCategoryBudget = async (
  id: string,
  deletedBy?: string,
) => {
  const existing = await getFinancialCategoryBudgetById(id);
  if (!existing) return null;

  await db
    .update(financialCategoryBudgets)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: deletedBy ?? null,
    })
    .where(eq(financialCategoryBudgets.id, id));

  return { id };
};