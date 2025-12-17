import { and, eq, gte, lte, desc, or, ilike, count } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  financialSummary,
  financialCostCategories,
  profitTrend,
  cashFlowProjection,
  cashFlowScenarios,
  revenueForecast,
  financialReports,
} from "../drizzle/schema/org.schema.js";
import { jobFinancialSummary } from "../drizzle/schema/jobs.schema.js";

// Financial Summary Services
export const getFinancialSummary = async (
  organizationId: string,
  periodStart?: string,
  periodEnd?: string
) => {
  let whereClause = eq(financialSummary.organizationId, organizationId);

  if (periodStart && periodEnd) {
    const conditions = and(
      eq(financialSummary.organizationId, organizationId),
      gte(financialSummary.periodStart, periodStart),
      lte(financialSummary.periodEnd, periodEnd)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(financialSummary)
    .where(whereClause)
    .orderBy(desc(financialSummary.createdAt));
  return result;
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
  const [summary] = await db
    .insert(financialSummary)
    .values({
      organizationId: data.organizationId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalContractValue: data.totalContractValue || "0",
      totalInvoiced: data.totalInvoiced || "0",
      totalPaid: data.totalPaid || "0",
      totalJobExpenses: data.totalJobExpenses || "0",
      totalOperatingExpenses: data.totalOperatingExpenses || "0",
      totalCost: data.totalCost || "0",
      projectedProfit: data.projectedProfit || "0",
      actualProfit: data.actualProfit || "0",
    })
    .returning();
  return summary;
};

export const updateFinancialSummary = async (
  id: string,
  data: {
    totalContractValue?: string;
    totalInvoiced?: string;
    totalPaid?: string;
    totalJobExpenses?: string;
    totalOperatingExpenses?: string;
    totalCost?: string;
    projectedProfit?: string;
    actualProfit?: string;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [summary] = await db
    .update(financialSummary)
    .set(updateData)
    .where(eq(financialSummary.id, id))
    .returning();
  return summary || null;
};

// Job Financial Summary Services
export const getJobFinancialSummaries = async (
  organizationId: string,
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions = [
    eq(jobFinancialSummary.organizationId, organizationId),
  ];

  // Add search filter if provided
  if (search) {
    whereConditions.push(or(ilike(jobFinancialSummary.jobId, `%${search}%`))!);
  }

  const result = await db
    .select()
    .from(jobFinancialSummary)
    .where(and(...whereConditions))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(jobFinancialSummary.updatedAt));

  const totalCount = await db
    .select({ count: count() })
    .from(jobFinancialSummary)
    .where(and(...whereConditions));

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result || [],
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getJobFinancialSummary = async (jobId: string) => {
  const [summary] = await db
    .select()
    .from(jobFinancialSummary)
    .where(eq(jobFinancialSummary.jobId, jobId));
  return summary || null;
};

export const createJobFinancialSummary = async (data: {
  jobId: string;
  organizationId: string;
  contractValue: string;
  totalInvoiced?: string;
  totalPaid?: string;
  vendorsOwed?: string;
  laborPaidToDate?: string;
  jobCompletionRate?: string;
  profitability?: string;
  profitMargin?: string;
}) => {
  const [summary] = await db
    .insert(jobFinancialSummary)
    .values({
      jobId: data.jobId,
      organizationId: data.organizationId,
      contractValue: data.contractValue,
      totalInvoiced: data.totalInvoiced || "0",
      totalPaid: data.totalPaid || "0",
      vendorsOwed: data.vendorsOwed || "0",
      laborPaidToDate: data.laborPaidToDate || "0",
      jobCompletionRate: data.jobCompletionRate,
      profitability: data.profitability,
      profitMargin: data.profitMargin,
    })
    .returning();
  return summary;
};

export const updateJobFinancialSummary = async (
  jobId: string,
  data: {
    contractValue?: string;
    totalInvoiced?: string;
    totalPaid?: string;
    vendorsOwed?: string;
    laborPaidToDate?: string;
    jobCompletionRate?: string;
    profitability?: string;
    profitMargin?: string;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [summary] = await db
    .update(jobFinancialSummary)
    .set(updateData)
    .where(eq(jobFinancialSummary.jobId, jobId))
    .returning();
  return summary || null;
};

// Financial Cost Categories Services
export const getFinancialCostCategories = async (
  organizationId: string,
  periodStart?: string,
  periodEnd?: string
) => {
  let whereClause = eq(financialCostCategories.organizationId, organizationId);

  if (periodStart && periodEnd) {
    const conditions = and(
      eq(financialCostCategories.organizationId, organizationId),
      gte(financialCostCategories.periodStart, periodStart),
      lte(financialCostCategories.periodEnd, periodEnd)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(financialCostCategories)
    .where(whereClause)
    .orderBy(desc(financialCostCategories.createdAt));
  return result;
};

export const createFinancialCostCategory = async (data: {
  organizationId: string;
  categoryKey: string;
  categoryLabel: string;
  spent?: string;
  budget?: string;
  percentOfTotal?: string;
  status?: string;
  periodStart: string;
  periodEnd: string;
}) => {
  const [category] = await db
    .insert(financialCostCategories)
    .values({
      organizationId: data.organizationId,
      categoryKey: data.categoryKey,
      categoryLabel: data.categoryLabel,
      spent: data.spent || "0",
      budget: data.budget || "0",
      percentOfTotal: data.percentOfTotal || "0",
      status: data.status || "on-track",
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    })
    .returning();
  return category;
};

export const updateFinancialCostCategory = async (
  id: string,
  data: {
    categoryLabel?: string;
    spent?: string;
    budget?: string;
    percentOfTotal?: string;
    status?: string;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [category] = await db
    .update(financialCostCategories)
    .set(updateData)
    .where(eq(financialCostCategories.id, id))
    .returning();
  return category || null;
};

export const deleteFinancialCostCategory = async (id: string) => {
  const [category] = await db
    .delete(financialCostCategories)
    .where(eq(financialCostCategories.id, id))
    .returning();
  return category || null;
};

// Profit Trend Services
export const getProfitTrend = async (
  organizationId: string,
  startDate?: string,
  endDate?: string
) => {
  let whereClause = eq(profitTrend.organizationId, organizationId);

  if (startDate && endDate) {
    const conditions = and(
      eq(profitTrend.organizationId, organizationId),
      gte(profitTrend.periodDate, startDate),
      lte(profitTrend.periodDate, endDate)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(profitTrend)
    .where(whereClause)
    .orderBy(profitTrend.periodDate);
  return result;
};

export const createProfitTrend = async (data: {
  organizationId: string;
  period: string;
  periodDate: string;
  revenue?: string;
  expenses?: string;
}) => {
  const [trend] = await db
    .insert(profitTrend)
    .values({
      organizationId: data.organizationId,
      period: data.period,
      periodDate: data.periodDate,
      revenue: data.revenue || "0",
      expenses: data.expenses || "0",
    })
    .returning();
  return trend;
};

// Cash Flow Projection Services
export const getCashFlowProjections = async (
  organizationId: string,
  startDate?: string,
  endDate?: string
) => {
  let whereClause = eq(cashFlowProjection.organizationId, organizationId);

  if (startDate && endDate) {
    const conditions = and(
      eq(cashFlowProjection.organizationId, organizationId),
      gte(cashFlowProjection.projectionDate, startDate),
      lte(cashFlowProjection.projectionDate, endDate)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(cashFlowProjection)
    .where(whereClause)
    .orderBy(desc(cashFlowProjection.projectionDate));
  return result;
};

export const createCashFlowProjection = async (data: {
  organizationId: string;
  projectionDate: string;
  periodStart: string;
  periodEnd: string;
  projectedIncome?: string;
  projectedExpenses?: string;
  pipelineCoverageMonths?: string;
  openInvoicesCount?: number;
  averageCollectionDays?: number;
}) => {
  const [projection] = await db
    .insert(cashFlowProjection)
    .values({
      organizationId: data.organizationId,
      projectionDate: data.projectionDate,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      projectedIncome: data.projectedIncome || "0",
      projectedExpenses: data.projectedExpenses || "0",
      pipelineCoverageMonths: data.pipelineCoverageMonths || "0",
      openInvoicesCount: data.openInvoicesCount || 0,
      averageCollectionDays: data.averageCollectionDays || 0,
    })
    .returning();
  return projection;
};

export const updateCashFlowProjection = async (
  id: string,
  data: {
    projectedIncome?: string;
    projectedExpenses?: string;
    pipelineCoverageMonths?: string;
    openInvoicesCount?: number;
    averageCollectionDays?: number;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [projection] = await db
    .update(cashFlowProjection)
    .set(updateData)
    .where(eq(cashFlowProjection.id, id))
    .returning();
  return projection || null;
};

// Cash Flow Scenarios Services
export const getCashFlowScenarios = async (projectionId: string) => {
  const result = await db
    .select()
    .from(cashFlowScenarios)
    .where(eq(cashFlowScenarios.projectionId, projectionId))
    .orderBy(cashFlowScenarios.scenarioType);
  return result;
};

export const createCashFlowScenario = async (data: {
  organizationId: string;
  projectionId: string;
  scenarioType: string;
  label: string;
  description?: string;
  projectedIncome?: string;
  projectedExpenses?: string;
  changeDescription?: string;
}) => {
  const [scenario] = await db
    .insert(cashFlowScenarios)
    .values({
      organizationId: data.organizationId,
      projectionId: data.projectionId,
      scenarioType: data.scenarioType,
      label: data.label,
      description: data.description,
      projectedIncome: data.projectedIncome || "0",
      projectedExpenses: data.projectedExpenses || "0",
      changeDescription: data.changeDescription,
    })
    .returning();
  return scenario;
};

export const updateCashFlowScenario = async (
  id: string,
  data: {
    label?: string;
    description?: string;
    projectedIncome?: string;
    projectedExpenses?: string;
    changeDescription?: string;
  }
) => {
  const [scenario] = await db
    .update(cashFlowScenarios)
    .set(data)
    .where(eq(cashFlowScenarios.id, id))
    .returning();
  return scenario || null;
};

// Revenue Forecast Services
export const getRevenueForecast = async (
  organizationId: string,
  year?: string
) => {
  let whereClause = eq(revenueForecast.organizationId, organizationId);

  if (year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const conditions = and(
      eq(revenueForecast.organizationId, organizationId),
      gte(revenueForecast.monthDate, startDate),
      lte(revenueForecast.monthDate, endDate)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(revenueForecast)
    .where(whereClause)
    .orderBy(revenueForecast.monthDate);
  return result;
};

export const createRevenueForecast = async (data: {
  organizationId: string;
  month: string;
  monthDate: string;
  committed?: string;
  pipeline?: string;
  probability?: string;
}) => {
  const [forecast] = await db
    .insert(revenueForecast)
    .values({
      organizationId: data.organizationId,
      month: data.month,
      monthDate: data.monthDate,
      committed: data.committed || "0",
      pipeline: data.pipeline || "0",
      probability: data.probability || "0",
    })
    .returning();
  return forecast;
};

export const updateRevenueForecast = async (
  id: string,
  data: {
    committed?: string;
    pipeline?: string;
    probability?: string;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [forecast] = await db
    .update(revenueForecast)
    .set(updateData)
    .where(eq(revenueForecast.id, id))
    .returning();
  return forecast || null;
};

// Financial Reports Services
export const getFinancialReports = async (
  organizationId: string,
  category?: string
) => {
  let whereClause = eq(financialReports.organizationId, organizationId);

  if (category) {
    const conditions = and(
      eq(financialReports.organizationId, organizationId),
      eq(financialReports.category, category)
    );
    if (conditions) whereClause = conditions;
  }

  const result = await db
    .select()
    .from(financialReports)
    .where(whereClause)
    .orderBy(desc(financialReports.updatedAt));
  return result;
};

export const createFinancialReport = async (data: {
  organizationId: string;
  reportKey: string;
  title: string;
  description?: string;
  category: string;
  reportConfig?: any;
}) => {
  const [report] = await db
    .insert(financialReports)
    .values({
      organizationId: data.organizationId,
      reportKey: data.reportKey,
      title: data.title,
      description: data.description,
      category: data.category,
      reportConfig: data.reportConfig,
    })
    .returning();
  return report;
};

export const updateFinancialReport = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    reportConfig?: any;
  }
) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [report] = await db
    .update(financialReports)
    .set(updateData)
    .where(eq(financialReports.id, id))
    .returning();
  return report || null;
};

export const deleteFinancialReport = async (id: string) => {
  const [report] = await db
    .delete(financialReports)
    .where(eq(financialReports.id, id))
    .returning();
  return report || null;
};
