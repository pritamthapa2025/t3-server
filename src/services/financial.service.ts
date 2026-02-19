import { count, eq, and, desc, asc, sql, or, ilike, gte, lte, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable, bidFinancialBreakdown } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { expenses } from "../drizzle/schema/expenses.schema.js";
import { payrollTimesheetEntries } from "../drizzle/schema/payroll.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
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
    const conditions = [
      ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
      eq(invoices.isDeleted, false),
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

  // Format response
  const data = Object.entries(categoryMap)
    .filter(([_, cat]) => cat.spent > 0) // Only show categories with spending
    .map(([id, cat]) => ({
      id,
      label: cat.label,
      spent: cat.spent,
      budget: 0, // TODO: Get from budget system if implemented
      percentOfTotal: totalCost > 0 ? cat.spent / totalCost : 0,
      status: "on-track" as const, // TODO: Compare with budget when available
    }));

  return { data, totalCost };
};

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
  const trendRows = organizationId ? await getProfitTrend(organizationId, 12) : [];
  const profitTrendData = trendRows.map((t) => ({
    period: t.period,
    revenue: parseFloat(t.revenue ?? "0"),
    expenses: parseFloat(t.expenses ?? "0"),
    profit: parseFloat(t.revenue ?? "0") - parseFloat(t.expenses ?? "0"),
  }));
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
export const getFinancialProfitTrendSection = async (organizationId: string | undefined) => {
  // Allow fetching without organizationId (returns all profit trends across all organizations)
  const trendRows = await getProfitTrend(organizationId, 12);
  const data = trendRows.map((t) => ({
    period: t.period,
    revenue: parseFloat(t.revenue ?? "0"),
    expenses: parseFloat(t.expenses ?? "0"),
    profit: parseFloat(t.revenue ?? "0") - parseFloat(t.expenses ?? "0"),
  }));
  return { data };
};

/** GET /financial/forecasting – Cash flow projection, scenarios, revenue forecast */
export const getFinancialForecastingSection = async (organizationId: string | undefined) => {
  // Allow fetching without organizationId (returns all forecasting data across all organizations)
  const projections = await getCashFlowProjections(organizationId);
  const latestProjection = projections[0] ?? null;
  const scenariosRows = await getCashFlowScenarios(organizationId);
  const cashFlowProjection = latestProjection
    ? {
        projectedIncome: parseFloat(latestProjection.projectedIncome ?? "0"),
        projectedExpenses: parseFloat(latestProjection.projectedExpenses ?? "0"),
        netCashFlow:
          parseFloat(latestProjection.projectedIncome ?? "0") -
          parseFloat(latestProjection.projectedExpenses ?? "0"),
        pipelineCoverageMonths: parseFloat(latestProjection.pipelineCoverageMonths ?? "0"),
        openInvoicesCount: latestProjection.openInvoicesCount ?? 0,
        averageCollectionDays: latestProjection.averageCollectionDays ?? 0,
      }
    : {
        projectedIncome: 0,
        projectedExpenses: 0,
        netCashFlow: 0,
        pipelineCoverageMonths: 0,
        openInvoicesCount: 0,
        averageCollectionDays: 0,
      };
  const cashFlowScenarios = scenariosRows.map((s) => ({
    id: (s.scenarioType as "best" | "realistic" | "worst") ?? "realistic",
    label: s.label,
    description: s.description ?? "",
    projectedIncome: parseFloat(s.projectedIncome ?? "0"),
    projectedExpenses: parseFloat(s.projectedExpenses ?? "0"),
    netCashFlow: parseFloat(s.projectedIncome ?? "0") - parseFloat(s.projectedExpenses ?? "0"),
    change: s.changeDescription ?? "",
  }));
  const forecastRows = await getRevenueForecast(organizationId);
  const revenueForecast = forecastRows.slice(0, 12).map((f) => ({
    month: f.month,
    committed: parseFloat(f.committed ?? "0"),
    pipeline: parseFloat(f.pipeline ?? "0"),
    probability: parseFloat(f.probability ?? "0"),
  }));
  return {
    data: {
      cashFlowProjection,
      cashFlowScenarios,
      revenueForecast,
    },
  };
};

/** GET /financial/reports – Report definitions for Reports & Exports tab */
export const getFinancialReportsSection = async (organizationId: string | undefined) => {
  // Allow fetching without organizationId (returns all reports across all organizations)
  const reportsRows = await getFinancialReports(organizationId);
  const data = reportsRows.map((r) => ({
    id: r.reportKey,
    title: r.title,
    description: r.description ?? "",
    updatedAt: r.updatedAt ? `Updated ${formatRelativeTime(r.updatedAt)}` : "—",
    category: (r.category as "Revenue" | "Expenses" | "Profitability" | "Vendors") ?? "Profitability",
  }));
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