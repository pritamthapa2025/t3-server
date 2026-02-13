import { count, eq, and, desc, sql, gte, lte, or, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { expenses } from "../drizzle/schema/expenses.schema.js";
import { timesheetEntries } from "../drizzle/schema/timesheet.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users, roles, userRoles } from "../drizzle/schema/auth.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";
import {
  inventoryItems,
  inventoryCategories,
} from "../drizzle/schema/inventory.schema.js";
import { expenseCategories } from "../drizzle/schema/expenses.schema.js";
import { payrollEntries } from "../drizzle/schema/payroll.schema.js";

// ============================
// Company Summary KPIs
// ============================

interface DateRangeFilter {
  startDate?: string | undefined;
  endDate?: string | undefined;
}

interface FinancialReportFilter extends DateRangeFilter {
  jobType?: string | undefined;
}

interface ExpenseReportFilter extends DateRangeFilter {
  jobType?: string | undefined;
  category?: string | undefined;
}

interface TimesheetReportFilter extends DateRangeFilter {
  technicianId?: number | undefined;
  managerId?: number | undefined;
}

interface FleetReportFilter extends DateRangeFilter {
  vehicleId?: string | undefined;
  location?: string | undefined;
}

interface InventoryReportFilter extends DateRangeFilter {
  category?: string | undefined;
  location?: string | undefined;
}

interface ClientReportFilter extends DateRangeFilter {
  paymentStatus?: string | undefined;
}

interface TechnicianPerformanceFilter extends DateRangeFilter {
  technicianId?: number | undefined;
  managerId?: number | undefined;
}

interface JobReportFilter extends DateRangeFilter {
  jobType?: string | undefined;
  status?: string | undefined;
  managerId?: number | undefined;
  technicianId?: number | undefined;
}

interface InvoicingReportFilter extends DateRangeFilter {
  status?: string | undefined;
  paymentStatus?: string | undefined;
}

/** Build date range conditions array (no undefineds) for a date column */
function dateRangeConditions(
  filters: DateRangeFilter | undefined,
  column: Parameters<typeof gte>[0],
  valueTransform: (s: string) => string | Date = (s) => s,
): ReturnType<typeof gte>[] {
  const conds: ReturnType<typeof gte>[] = [];
  if (filters?.startDate)
    conds.push(gte(column, valueTransform(filters.startDate)));
  if (filters?.endDate)
    conds.push(lte(column, valueTransform(filters.endDate)));
  return conds;
}

export const getCompanySummaryKPIs = async (filters?: DateRangeFilter) => {
  // Date conditions for jobs (createdAt - timestamp)
  const jobDateConditions = dateRangeConditions(
    filters,
    jobs.createdAt,
    (s) => new Date(s),
  );

  // 1. Total Revenue - sum of invoices in date range
  const revenueConditions = [
    eq(invoices.isDeleted, false),
    ...dateRangeConditions(filters, invoices.invoiceDate),
  ];
  const revenueQuery = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .where(and(...revenueConditions));

  // 2. Total Cost = expenseCost + payroll
  // Expense cost includes all org.expenses in date range: job expenses (materials, equipment, transportation, permits, subcontractor, utilities, tools, safety equipment, other), fleet expenses, inventory/purchase order expenses, and manual expenses. Labour is in payroll only.
  const expenseCostConditions = [
    eq(expenses.isDeleted, false),
    ...dateRangeConditions(filters, expenses.expenseDate),
  ];
  const costQuery = await db
    .select({
      totalCost: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(and(...expenseCostConditions));

  // Payroll (gross pay) in date range - by pay date or scheduled date
  const payrollConditions = [eq(payrollEntries.isDeleted, false)];
  if (filters?.startDate) {
    payrollConditions.push(
      sql`COALESCE(${payrollEntries.paidDate}, ${payrollEntries.scheduledDate}) >= ${filters.startDate}`,
    );
  }
  if (filters?.endDate) {
    payrollConditions.push(
      sql`COALESCE(${payrollEntries.paidDate}, ${payrollEntries.scheduledDate}) <= ${filters.endDate}`,
    );
  }
  const payrollQuery = await db
    .select({
      totalPayroll: sql<string>`COALESCE(SUM(CAST(${payrollEntries.grossPay} AS NUMERIC)), 0)`,
    })
    .from(payrollEntries)
    .where(and(...payrollConditions));

  const totalRevenue = parseFloat(revenueQuery[0]?.totalRevenue || "0");
  const expenseCost = parseFloat(costQuery[0]?.totalCost || "0");
  const totalPayroll = parseFloat(payrollQuery[0]?.totalPayroll || "0");
  const totalCost = expenseCost + totalPayroll;
  const profit = totalRevenue - totalCost;

  // 3. Jobs Completed - in date range
  const completedJobsQuery = await db
    .select({ count: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "completed"),
        eq(jobs.isDeleted, false),
        ...jobDateConditions,
      ),
    );

  // 4. Invoice Collection Rate - in date range
  const invoiceStatsConditions = [
    eq(invoices.isDeleted, false),
    ...dateRangeConditions(filters, invoices.invoiceDate),
  ];
  const invoiceStatsQuery = await db
    .select({
      totalInvoiced: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .where(and(...invoiceStatsConditions));

  const totalInvoiced = parseFloat(invoiceStatsQuery[0]?.totalInvoiced || "0");
  const totalPaid = parseFloat(invoiceStatsQuery[0]?.totalPaid || "0");
  const invoiceCollectionRate =
    totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // 5. Fleet Availability
  const fleetStatsQuery = await db
    .select({
      total: count(),
      operational: sql<number>`COUNT(CASE WHEN ${vehicles.status} = 'active' THEN 1 END)`,
    })
    .from(vehicles)
    .where(and(eq(vehicles.isDeleted, false)));

  const totalVehicles = fleetStatsQuery[0]?.total || 0;
  const operationalVehicles = fleetStatsQuery[0]?.operational || 0;
  const fleetAvailability =
    totalVehicles > 0
      ? Math.round((operationalVehicles / totalVehicles) * 100)
      : 0;

  // 6. Inventory Valuation
  const inventoryValueQuery = await db
    .select({
      totalValue: sql<string>`COALESCE(SUM(CAST(${inventoryItems.quantityOnHand} AS NUMERIC) * CAST(${inventoryItems.unitCost} AS NUMERIC)), 0)`,
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.isDeleted, false)));

  // 7. Technician Efficiency (timesheet hours; job count from jobs) - in date range
  const timesheetDateConditions = dateRangeConditions(
    filters,
    timesheetEntries.sheetDate,
  );
  const [hoursRow] = await db
    .select({
      totalHours: sql<number>`COALESCE(SUM(CAST(${timesheetEntries.totalHours} AS NUMERIC) + COALESCE(CAST(${timesheetEntries.overtimeHours} AS NUMERIC), 0)), 0)`,
    })
    .from(timesheetEntries)
    .where(
      timesheetDateConditions.length > 0
        ? and(...timesheetDateConditions)
        : sql`1=1`,
    );
  const [jobsRow] = await db
    .select({ completedJobs: sql<number>`COUNT(${jobs.id})` })
    .from(jobs)
    .where(and(eq(jobs.isDeleted, false), ...jobDateConditions));
  const technicianEfficiencyQuery = [
    {
      totalHours: hoursRow?.totalHours ?? 0,
      completedJobs: jobsRow?.completedJobs ?? 0,
    },
  ];

  const totalHours = technicianEfficiencyQuery[0]?.totalHours || 0;
  const completedJobs = technicianEfficiencyQuery[0]?.completedJobs || 0;
  // Simple efficiency metric: assume 8 hours per job is 100% efficient
  const technicianEfficiency =
    totalHours > 0
      ? Math.min(Math.round(((completedJobs * 8) / totalHours) * 100), 100)
      : 95;

  // 8. Active Jobs - jobs not yet completed (planned, scheduled, in_progress, on_hold)
  const activeJobsQuery = await db
    .select({ count: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.isDeleted, false),
        inArray(jobs.status, ["planned", "scheduled", "in_progress", "on_hold"]),
        ...jobDateConditions,
      ),
    );
  const activeJobs = activeJobsQuery[0]?.count ?? 0;

  // 9. Client Count - distinct organizations with jobs in date range
  const clientCountQuery = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${bidsTable.organizationId})` })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.isDeleted, false), ...jobDateConditions));
  const clientCount = Number(clientCountQuery[0]?.count ?? 0);

  // 10. Employee Count - total active employees
  const employeeCountQuery = await db
    .select({ count: count() })
    .from(employees)
    .where(eq(employees.isDeleted, false));
  const employeeCount = employeeCountQuery[0]?.count ?? 0;

  // 11. Revenue Growth - (current - previous period) / previous * 100 when date range provided
  let revenueGrowth: number | null = null;
  if (filters?.startDate && filters?.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const periodMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);
    const prevRevenueQuery = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.isDeleted, false),
          gte(invoices.invoiceDate, prevStartStr),
          lte(invoices.invoiceDate, prevEndStr),
        ),
      );
    const prevRevenue = parseFloat(prevRevenueQuery[0]?.total || "0");
    if (prevRevenue > 0) {
      revenueGrowth = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);
    } else if (totalRevenue > 0) {
      revenueGrowth = 100;
    } else {
      revenueGrowth = 0;
    }
  }

  return {
    totalRevenue,
    totalCost,
    totalPayroll,
    expenseCost,
    profit,
    jobsCompleted: completedJobsQuery[0]?.count || 0,
    invoiceCollectionRate,
    fleetAvailability,
    inventoryValuation: parseFloat(inventoryValueQuery[0]?.totalValue || "0"),
    technicianEfficiency,
    activeJobs,
    clientCount,
    employeeCount,
    revenueGrowth,
  };
};

// ============================
// Monthly Revenue Trend
// ============================

export const getMonthlyRevenueTrend = async (filters?: DateRangeFilter) => {
  // Get monthly data for the last 6 months
  const monthlyData = await db
    .select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
      monthDate: sql<string>`DATE_TRUNC('month', ${invoices.invoiceDate})`,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${invoices.invoiceDate})`,
      sql`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
    )
    .orderBy(sql`DATE_TRUNC('month', ${invoices.invoiceDate})`);

  // Get monthly costs
  const monthlyCosts = await db
    .select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
      monthDate: sql<string>`DATE_TRUNC('month', ${expenses.expenseDate})`,
      cost: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        ...(filters?.startDate
          ? [gte(expenses.expenseDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(expenses.expenseDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${expenses.expenseDate})`,
      sql`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
    )
    .orderBy(sql`DATE_TRUNC('month', ${expenses.expenseDate})`);

  // Combine revenue and cost data
  const costMap = new Map(
    monthlyCosts.map((c) => [c.month, parseFloat(c.cost)]),
  );

  return monthlyData.map((m) => {
    const revenue = parseFloat(m.revenue);
    const cost = costMap.get(m.month) || 0;
    return {
      month: m.month,
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
};

// ============================
// Job Performance Data
// ============================

export const getJobPerformanceData = async (filters?: DateRangeFilter) => {
  const dateConditions = [];
  if (filters?.startDate) {
    dateConditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    dateConditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }

  const jobStats = await db
    .select({
      status: jobs.status,
      count: count(),
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.isDeleted, false),
        ...(dateConditions.length > 0 ? dateConditions : []),
      ),
    )
    .groupBy(jobs.status);

  // Map status to display names and colors
  const statusMap: Record<string, { label: string; color: string }> = {
    completed: { label: "Completed", color: "#008E1F" },
    active: { label: "Active", color: "#0044FF" },
    on_hold: { label: "On Hold", color: "#DF9257" },
    overdue: { label: "Overdue", color: "#EF4444" },
    cancelled: { label: "Cancelled", color: "#475467" },
  };

  return jobStats.map((stat) => ({
    status: statusMap[stat.status]?.label || stat.status,
    count: stat.count,
    color: statusMap[stat.status]?.color || "#475467",
  }));
};

// ============================
// Client Revenue Distribution
// ============================

export const getClientRevenueDistribution = async (
  filters?: DateRangeFilter,
) => {
  const clientRevenue = await db
    .select({
      organizationId: bidsTable.organizationId,
      clientName: organizations.name,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(
      and(
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(bidsTable.organizationId, organizations.name)
    .orderBy(
      desc(sql`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`),
    )
    .limit(5);

  return clientRevenue.map((cr) => ({
    organizationId: cr.organizationId,
    client: cr.clientName || "Unknown Client",
    value: parseFloat(cr.revenue),
  }));
};

// ============================
// Financial Reports - Profit & Loss Statement
// ============================

export const getProfitAndLossStatement = async (
  organizationId: string | undefined,
  filters?: FinancialReportFilter,
) => {
  // Build conditions (omit org filter when organizationId not provided = all orgs)
  const conditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];

  if (filters?.jobType) {
    conditions.push(eq(jobs.jobType, filters.jobType));
  }

  // Total Revenue from invoices
  const revenueQuery = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...conditions,
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    );

  // Cost of Goods Sold (direct job expenses - materials, labor, subcontractors)
  const cogsConditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];
  const cogsQuery = await db
    .select({
      cogs: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...cogsConditions,
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "materials"),
          eq(expenses.expenseType, "job_labor"),
          eq(expenses.expenseType, "subcontractor"),
        ),
        ...(filters?.jobType && jobs.jobType
          ? [eq(jobs.jobType, filters.jobType)]
          : []),
        ...(filters?.startDate
          ? [gte(expenses.expenseDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(expenses.expenseDate, filters.endDate)]
          : []),
      ),
    );

  // Operating Expenses (overhead, admin, tools, fleet, etc.)
  const opexConditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];
  const opexQuery = await db
    .select({
      operatingExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...opexConditions,
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "tools"),
          eq(expenses.expenseType, "vehicle_maintenance"),
          eq(expenses.expenseType, "other"),
          eq(expenses.expenseType, "travel"),
        ),
        ...(filters?.startDate
          ? [gte(expenses.expenseDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(expenses.expenseDate, filters.endDate)]
          : []),
      ),
    );

  // Total Job Expenses (all expenses linked to jobs)
  const jobExpConditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];
  const jobExpensesQuery = await db
    .select({
      totalJobExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...jobExpConditions,
        eq(expenses.isDeleted, false),
        sql`${expenses.jobId} IS NOT NULL`,
        ...(filters?.jobType && jobs.jobType
          ? [eq(jobs.jobType, filters.jobType)]
          : []),
        ...(filters?.startDate
          ? [gte(expenses.expenseDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(expenses.expenseDate, filters.endDate)]
          : []),
      ),
    );

  const totalRevenue = parseFloat(revenueQuery[0]?.totalRevenue || "0");
  const cogs = parseFloat(cogsQuery[0]?.cogs || "0");
  const operatingExpenses = parseFloat(opexQuery[0]?.operatingExpenses || "0");
  const totalJobExpenses = parseFloat(
    jobExpensesQuery[0]?.totalJobExpenses || "0",
  );

  const grossProfit = totalRevenue - cogs;
  const totalCost = totalJobExpenses + operatingExpenses;
  const netProfit = totalRevenue - totalCost;

  // Cash flow - available cash (paid invoices minus expenses)
  const paidInvoicesQuery = await db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...conditions,
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    );

  const totalPaid = parseFloat(paidInvoicesQuery[0]?.totalPaid || "0");
  const cashFlow = totalPaid - totalCost;

  return {
    totalRevenue,
    operatingExpenses,
    grossProfit,
    netProfit,
    cogs,
    cashFlow,
    totalJobExpenses,
    totalCost,
  };
};

// ============================
// Financial Reports - Cash Flow Forecast
// ============================

export const getCashFlowForecast = async (
  organizationId: string | undefined,
  filters?: FinancialReportFilter,
) => {
  // Get monthly cash flow data (omit org filter when organizationId not provided = all orgs)
  const conditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];

  if (filters?.jobType) {
    conditions.push(eq(jobs.jobType, filters.jobType));
  }

  // Monthly inflows (invoiced amounts)
  const monthlyInflows = await db
    .select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
      monthDate: sql<string>`DATE_TRUNC('month', ${invoices.invoiceDate})`,
      inflows: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      actual: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...conditions,
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${invoices.invoiceDate})`,
      sql`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
    )
    .orderBy(sql`DATE_TRUNC('month', ${invoices.invoiceDate})`);

  // Monthly outflows (expenses)
  const monthlyOutflows = await db
    .select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
      monthDate: sql<string>`DATE_TRUNC('month', ${expenses.expenseDate})`,
      outflows: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(bidsTable.organizationId, organizationId),
        eq(expenses.isDeleted, false),
        ...(filters?.jobType && jobs.jobType
          ? [eq(jobs.jobType, filters.jobType)]
          : []),
        ...(filters?.startDate
          ? [gte(expenses.expenseDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(expenses.expenseDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${expenses.expenseDate})`,
      sql`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
    )
    .orderBy(sql`DATE_TRUNC('month', ${expenses.expenseDate})`);

  // Combine inflows and outflows
  const outflowMap = new Map(
    monthlyOutflows.map((o) => [o.month, parseFloat(o.outflows)]),
  );

  return monthlyInflows.map((m) => {
    const inflows = parseFloat(m.inflows);
    const actual = parseFloat(m.actual);
    const outflows = outflowMap.get(m.month) || 0;
    const projected = inflows - outflows;

    return {
      month: m.month,
      projected,
      actual,
      inflows,
      outflows,
    };
  });
};

// ============================
// Financial Reports - Revenue by Client (with filters)
// ============================

export const getRevenueByClientFiltered = async (
  organizationId: string | undefined,
  filters?: FinancialReportFilter,
) => {
  const conditions = organizationId
    ? [eq(bidsTable.organizationId, organizationId)]
    : [];

  if (filters?.jobType) {
    conditions.push(eq(jobs.jobType, filters.jobType));
  }

  const clientRevenue = await db
    .select({
      organizationId: bidsTable.organizationId,
      clientName: organizations.name,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(
      and(
        ...conditions,
        eq(invoices.isDeleted, false),
        ...(filters?.startDate
          ? [gte(invoices.invoiceDate, filters.startDate)]
          : []),
        ...(filters?.endDate
          ? [lte(invoices.invoiceDate, filters.endDate)]
          : []),
      ),
    )
    .groupBy(bidsTable.organizationId, organizations.name)
    .orderBy(
      desc(sql`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`),
    );

  // Calculate total and percentages
  const totalRevenue = clientRevenue.reduce(
    (sum, cr) => sum + parseFloat(cr.revenue),
    0,
  );

  return clientRevenue.map((cr) => {
    const revenue = parseFloat(cr.revenue);
    return {
      organizationId: cr.organizationId,
      client: cr.clientName || "Unknown Client",
      revenue,
      percentage:
        totalRevenue > 0
          ? Number(((revenue / totalRevenue) * 100).toFixed(1))
          : 0,
    };
  });
};

// ============================
// Financial Reports - All KPIs
// ============================

export const getFinancialKPIs = async (
  organizationId: string | undefined,
  filters?: FinancialReportFilter,
) => {
  const profitLoss = await getProfitAndLossStatement(organizationId, filters);

  return {
    totalRevenue: profitLoss.totalRevenue,
    grossProfit: profitLoss.grossProfit,
    grossProfitMargin:
      profitLoss.totalRevenue > 0
        ? Number(
            ((profitLoss.grossProfit / profitLoss.totalRevenue) * 100).toFixed(
              1,
            ),
          )
        : 0,
    netProfit: profitLoss.netProfit,
    netProfitMargin:
      profitLoss.totalRevenue > 0
        ? Number(
            ((profitLoss.netProfit / profitLoss.totalRevenue) * 100).toFixed(1),
          )
        : 0,
    operatingExpenses: profitLoss.operatingExpenses,
    cogs: profitLoss.cogs,
    cashFlow: profitLoss.cashFlow,
  };
};

// ============================
// Expense Reports - By Category
// ============================

export const getExpenseByCategory = async (
  organizationId: string | undefined,
  filters?: ExpenseReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(expenses.isDeleted, false),
  ];

  // Apply category filter if provided
  if (filters?.category) {
    conditions.push(eq(expenses.expenseType, filters.category as any));
  }

  // Build date conditions
  if (filters?.startDate) {
    conditions.push(gte(expenses.expenseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(expenses.expenseDate, filters.endDate));
  }

  // If jobType filter is provided, need to join with jobs
  let query;
  if (filters?.jobType) {
    query = db
      .select({
        category: expenses.expenseType,
        amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(and(...conditions, eq(jobs.jobType, filters.jobType)))
      .groupBy(expenses.expenseType);
  } else {
    query = db
      .select({
        category: expenses.expenseType,
        amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(and(...conditions))
      .groupBy(expenses.expenseType);
  }

  const categoryData = await query;

  // Map expense types to friendly names
  const categoryMap: Record<string, string> = {
    materials: "Materials",
    tools: "Tools",
    fleet: "Fleet",
    subcontractor: "Subcontractor",
    admin: "Admin",
    travel: "Travel",
    safety: "Safety",
    labor: "Labor",
    overhead: "Overhead",
  };

  return categoryData.map((item) => ({
    category: categoryMap[item.category] || item.category,
    amount: parseFloat(item.amount),
  }));
};

// ============================
// Expense Reports - Monthly Trend
// ============================

export const getMonthlyExpenseTrend = async (
  organizationId: string | undefined,
  filters?: ExpenseReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(expenses.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(expenses.expenseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(expenses.expenseDate, filters.endDate));
  }
  if (filters?.category) {
    conditions.push(eq(expenses.expenseType, filters.category as any));
  }

  // Query for monthly data by category
  let query;
  if (filters?.jobType) {
    query = db
      .select({
        month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
        monthDate: sql<string>`DATE_TRUNC('month', ${expenses.expenseDate})`,
        category: expenses.expenseType,
        amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .where(and(...conditions, eq(jobs.jobType, filters.jobType)))
      .groupBy(
        sql`DATE_TRUNC('month', ${expenses.expenseDate})`,
        sql`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
        expenses.expenseType,
      )
      .orderBy(sql`DATE_TRUNC('month', ${expenses.expenseDate})`);
  } else {
    query = db
      .select({
        month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
        monthDate: sql<string>`DATE_TRUNC('month', ${expenses.expenseDate})`,
        category: expenses.expenseType,
        amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(and(...conditions))
      .groupBy(
        sql`DATE_TRUNC('month', ${expenses.expenseDate})`,
        sql`TO_CHAR(${expenses.expenseDate}, 'Mon')`,
        expenses.expenseType,
      )
      .orderBy(sql`DATE_TRUNC('month', ${expenses.expenseDate})`);
  }

  const monthlyData = await query;

  // Restructure data for line chart - each month has totals per category
  const monthMap = new Map<string, any>();

  monthlyData.forEach((item) => {
    if (!monthMap.has(item.month)) {
      monthMap.set(item.month, { month: item.month });
    }
    const monthData = monthMap.get(item.month);
    monthData[item.category] = parseFloat(item.amount);
  });

  return Array.from(monthMap.values());
};

// ============================
// Expense Reports - Vendor Spend
// ============================

export const getVendorSpendReport = async (
  organizationId: string | undefined,
  filters?: ExpenseReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(expenses.isDeleted, false),
    sql`${expenses.vendor} IS NOT NULL`,
  ];

  if (filters?.startDate) {
    conditions.push(gte(expenses.expenseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(expenses.expenseDate, filters.endDate));
  }
  if (filters?.category) {
    conditions.push(eq(expenses.expenseType, filters.category as any));
  }

  let query;
  if (filters?.jobType) {
    query = db
      .select({
        vendor: expenses.vendor,
        totalSpend: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
        unpaid: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.paidDate} IS NULL THEN CAST(${expenses.amount} AS NUMERIC) ELSE 0 END), 0)`,
        invoices: sql<number>`COUNT(DISTINCT ${expenses.id})`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(and(...conditions, eq(jobs.jobType, filters.jobType)))
      .groupBy(expenses.vendor)
      .orderBy(
        desc(sql`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`),
      );
  } else {
    query = db
      .select({
        vendor: expenses.vendor,
        totalSpend: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
        unpaid: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.paidDate} IS NULL THEN CAST(${expenses.amount} AS NUMERIC) ELSE 0 END), 0)`,
        invoices: sql<number>`COUNT(DISTINCT ${expenses.id})`,
      })
      .from(expenses)
      .leftJoin(jobs, eq(expenses.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(and(...conditions))
      .groupBy(expenses.vendor)
      .orderBy(
        desc(sql`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`),
      );
  }

  const vendorData = await query;

  return vendorData.map((v) => ({
    vendor: v.vendor || "Unknown Vendor",
    totalSpend: parseFloat(v.totalSpend),
    unpaid: parseFloat(v.unpaid),
    invoices: v.invoices,
  }));
};

// ============================
// Timesheet & Labor Reports
// ============================

export const getTechnicianHoursReport = async (
  _organizationId: string | undefined,
  filters?: TimesheetReportFilter,
) => {
  const conditions = [];

  if (filters?.startDate) {
    conditions.push(gte(timesheetEntries.sheetDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(timesheetEntries.sheetDate, filters.endDate));
  }
  if (filters?.technicianId) {
    conditions.push(eq(timesheetEntries.employeeId, filters.technicianId));
  }

  const hoursData = await db
    .select({
      employeeId: timesheetEntries.employeeId,
      employeeName: users.fullName,
      regularHours: sql<number>`COALESCE(SUM(CAST(${timesheetEntries.totalHours} AS NUMERIC)), 0)`,
      overtime: sql<number>`COALESCE(SUM(CAST(${timesheetEntries.overtimeHours} AS NUMERIC)), 0)`,
      doubleOT: sql<number>`0`,
    })
    .from(timesheetEntries)
    .leftJoin(employees, eq(timesheetEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...conditions))
    .groupBy(timesheetEntries.employeeId, users.fullName);

  return hoursData.map((h) => {
    const regular = Number(h.regularHours) || 0;
    const overtime = Number(h.overtime) || 0;
    const doubleOT = Number(h.doubleOT) || 0;
    const totalHours = regular + overtime + doubleOT;
    return {
      employeeId: h.employeeId,
      name: h.employeeName,
      regularHours: regular,
      overtime,
      doubleOT,
      totalHours: Number.isFinite(totalHours) ? totalHours : 0,
    };
  });
};

export const getLaborCostReport = async (
  _organizationId: string | undefined,
  filters?: TimesheetReportFilter,
) => {
  const conditions = [];

  if (filters?.startDate) {
    conditions.push(gte(timesheetEntries.sheetDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(timesheetEntries.sheetDate, filters.endDate));
  }
  if (filters?.technicianId) {
    conditions.push(eq(timesheetEntries.employeeId, filters.technicianId));
  }

  const laborData = await db
    .select({
      employeeName: users.fullName,
      hourlyRate: employees.hourlyRate,
      hoursWorked: sql<number>`COALESCE(SUM(CAST(${timesheetEntries.totalHours} AS NUMERIC) + CAST(${timesheetEntries.overtimeHours} AS NUMERIC)), 0)`,
      jobs: sql<number>`COUNT(*)`,
    })
    .from(timesheetEntries)
    .leftJoin(employees, eq(timesheetEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...conditions))
    .groupBy(employees.id, users.fullName, employees.hourlyRate);

  return laborData.map((l) => {
    const hourlyRate = parseFloat(l.hourlyRate || "0");
    const hoursWorked = l.hoursWorked;
    return {
      technician: l.employeeName,
      hourlyRate,
      hoursWorked,
      laborCost: hourlyRate * hoursWorked,
      jobs: l.jobs,
    };
  });
};

export const getAttendanceReport = async (
  _organizationId: string | undefined,
  filters?: TimesheetReportFilter,
) => {
  const conditions = [];

  if (filters?.startDate) {
    conditions.push(gte(timesheetEntries.sheetDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(timesheetEntries.sheetDate, filters.endDate));
  }
  if (filters?.technicianId) {
    conditions.push(eq(timesheetEntries.employeeId, filters.technicianId));
  }

  const attendanceData = await db
    .select({
      employeeName: users.fullName,
      daysPresent: sql<number>`COUNT(DISTINCT ${timesheetEntries.sheetDate})`,
    })
    .from(timesheetEntries)
    .leftJoin(employees, eq(timesheetEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...conditions))
    .groupBy(employees.id, users.fullName);

  // Calculate working days in period for absence calculation
  const startDate = filters?.startDate
    ? new Date(filters.startDate)
    : new Date();
  const endDate = filters?.endDate ? new Date(filters.endDate) : new Date();
  const workingDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return attendanceData.map((a) => ({
    employee: a.employeeName,
    daysPresent: a.daysPresent,
    daysAbsent: Math.max(0, workingDays - a.daysPresent),
    pto: 0, // Would need separate PTO tracking
    sick: 0, // Would need separate sick leave tracking
  }));
};

// ============================
// Fleet Reports
// ============================

export const getFleetUsageReport = async (
  _organizationId: string | undefined,
  filters?: FleetReportFilter,
) => {
  const conditions = [eq(vehicles.isDeleted, false)];

  if (filters?.vehicleId) {
    conditions.push(eq(vehicles.id, filters.vehicleId));
  }
  if (filters?.location) {
    conditions.push(eq(vehicles.currentLocationAddress, filters.location));
  }

  const usageData = await db
    .select({
      vehicleId: vehicles.vehicleId,
      make: sql<string>`CONCAT(${vehicles.make}, ' ', ${vehicles.model})`,
      mileage: vehicles.mileage,
    })
    .from(vehicles)
    .where(and(...conditions));

  // For trips and utilization, we'd need dispatch/trip data - using mock values for now
  return usageData.map((v) => ({
    vehicle: v.vehicleId,
    make: v.make,
    usage: parseInt(v.mileage || "0"),
    trips: 0, // Would need dispatch/trip tracking
    utilization: 0, // Would calculate from dispatch data
  }));
};

export const getFleetMaintenanceCostReport = async (
  _organizationId: string | undefined,
  filters?: FleetReportFilter,
) => {
  const conditions = [eq(vehicles.isDeleted, false)];

  if (filters?.vehicleId) {
    conditions.push(eq(vehicles.id, filters.vehicleId));
  }

  // This would join with maintenance/repair records
  const maintenanceData = await db
    .select({
      vehicleId: vehicles.vehicleId,
      lastService: vehicles.lastService,
    })
    .from(vehicles)
    .where(and(...conditions));

  return maintenanceData.map((v) => ({
    vehicle: v.vehicleId,
    scheduledMaintenance: v.lastService ? 1 : 0,
    repairCost: 0, // Would need repair records
    downtime: "0 days", // Would need service history
  }));
};

export const getFuelExpenseReport = async (
  _organizationId: string | undefined,
  filters?: FleetReportFilter,
) => {
  const conditions = [eq(vehicles.isDeleted, false)];

  if (filters?.vehicleId) {
    conditions.push(eq(vehicles.id, filters.vehicleId));
  }

  const fuelData = await db
    .select({
      vehicleId: vehicles.vehicleId,
      fuelType: vehicles.fuelType,
    })
    .from(vehicles)
    .where(and(...conditions));

  return fuelData.map((v) => ({
    vehicle: v.vehicleId,
    fuelConsumed: 0, // Would need fuel tracking
    fuelCost: 0, // Would need fuel expense records
    efficiency: v.fuelType || "N/A",
  }));
};

// ============================
// Inventory Reports
// ============================

export const getInventoryValuation = async (
  _organizationId: string | undefined,
  filters?: InventoryReportFilter,
) => {
  const conditions = [eq(inventoryItems.isDeleted, false)];

  if (filters?.category) {
    const catId = parseInt(filters.category, 10);
    if (!Number.isNaN(catId))
      conditions.push(eq(inventoryItems.categoryId, catId));
  }
  if (filters?.location) {
    conditions.push(eq(inventoryItems.primaryLocationId, filters.location));
  }

  // Overall totals
  const totalsQuery = await db
    .select({
      totalValue: sql<string>`COALESCE(SUM(CAST(${inventoryItems.quantityOnHand} AS NUMERIC) * CAST(${inventoryItems.unitCost} AS NUMERIC)), 0)`,
      itemCount: count(),
    })
    .from(inventoryItems)
    .where(and(...conditions));

  // By category breakdown
  const categoryQuery = await db
    .select({
      categoryId: inventoryItems.categoryId,
      categoryName: inventoryCategories.name,
      value: sql<string>`COALESCE(SUM(CAST(${inventoryItems.quantityOnHand} AS NUMERIC) * CAST(${inventoryItems.unitCost} AS NUMERIC)), 0)`,
      items: count(),
    })
    .from(inventoryItems)
    .leftJoin(
      inventoryCategories,
      eq(inventoryItems.categoryId, inventoryCategories.id),
    )
    .where(and(...conditions))
    .groupBy(inventoryItems.categoryId, inventoryCategories.name);

  return {
    totalValue: parseFloat(totalsQuery[0]?.totalValue || "0"),
    itemCount: totalsQuery[0]?.itemCount || 0,
    categories: categoryQuery.map((c) => ({
      categoryId: c.categoryId,
      category: c.categoryName || "Uncategorized",
      value: parseFloat(c.value),
      items: c.items,
    })),
  };
};

export const getStockMovementReport = async (
  _organizationId: string | undefined,
  filters?: InventoryReportFilter,
) => {
  const conditions = [eq(inventoryItems.isDeleted, false)];

  if (filters?.category) {
    const catId = parseInt(filters.category, 10);
    if (!Number.isNaN(catId))
      conditions.push(eq(inventoryItems.categoryId, catId));
  }

  const stockData = await db
    .select({
      itemName: inventoryItems.name,
      currentStock: inventoryItems.quantityOnHand,
    })
    .from(inventoryItems)
    .where(and(...conditions))
    .limit(50);

  return stockData.map((s) => ({
    item: s.itemName,
    beginning: 0, // Would need historical tracking
    received: 0, // Would need transaction history
    used: 0, // Would need transaction history
    ending: parseInt(s.currentStock || "0"),
  }));
};

export const getLowStockItems = async (
  _organizationId: string | undefined,
  filters?: InventoryReportFilter,
) => {
  const conditions = [
    eq(inventoryItems.isDeleted, false),
    or(
      eq(inventoryItems.status, "low_stock"),
      eq(inventoryItems.status, "out_of_stock"),
    ),
  ];

  if (filters?.category) {
    const catId = parseInt(filters.category, 10);
    if (!Number.isNaN(catId))
      conditions.push(eq(inventoryItems.categoryId, catId));
  }

  const lowStockData = await db
    .select({
      itemName: inventoryItems.name,
      currentStock: inventoryItems.quantityOnHand,
      reorderPoint: inventoryItems.reorderLevel,
      status: inventoryItems.status,
    })
    .from(inventoryItems)
    .where(and(...conditions))
    .orderBy(inventoryItems.quantityOnHand);

  return lowStockData.map((item) => ({
    item: item.itemName,
    currentStock: parseInt(item.currentStock || "0"),
    reorderPoint: parseInt(item.reorderPoint || "0"),
    status: item.status === "out_of_stock" ? "Critical" : "Low",
  }));
};

// ============================
// Client Reports
// ============================

export const getClientSpendReport = async (
  organizationId: string | undefined,
  filters?: ClientReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(invoices.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(invoices.invoiceDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(invoices.invoiceDate, filters.endDate));
  }

  const clientData = await db
    .select({
      clientName: organizations.name,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      jobs: sql<number>`COUNT(DISTINCT ${jobs.id})`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(and(...conditions))
    .groupBy(bidsTable.organizationId, organizations.name)
    .orderBy(
      desc(sql`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`),
    );

  return clientData.map((c) => {
    const revenue = parseFloat(c.revenue);
    const jobs = c.jobs;
    return {
      client: c.clientName || "Unknown Client",
      revenue,
      jobs,
      avgJobValue: jobs > 0 ? Math.round(revenue / jobs) : 0,
    };
  });
};

export const getClientOutstandingPayments = async (
  organizationId: string | undefined,
  filters?: ClientReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(invoices.isDeleted, false),
    sql`${invoices.balanceDue} > 0`,
  ];

  if (filters?.paymentStatus === "overdue") {
    conditions.push(sql`${invoices.dueDate} < CURRENT_DATE`);
  }

  const outstandingData = await db
    .select({
      clientName: organizations.name,
      outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.balanceDue} AS NUMERIC)), 0)`,
      invoiceCount: sql<number>`COUNT(${invoices.id})`,
      oldestDue: sql<number>`CURRENT_DATE - MIN(${invoices.dueDate})`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(and(...conditions))
    .groupBy(bidsTable.organizationId, organizations.name)
    .orderBy(
      desc(sql`COALESCE(SUM(CAST(${invoices.balanceDue} AS NUMERIC)), 0)`),
    );

  return outstandingData.map((c) => ({
    client: c.clientName || "Unknown Client",
    outstanding: parseFloat(c.outstanding),
    invoices: c.invoiceCount,
    oldestDue: `${c.oldestDue || 0} days`,
  }));
};

// ============================
// Technician Performance Reports
// ============================

export const getTechnicianProductivityReport = async (
  _organizationId: string | undefined,
  filters?: TechnicianPerformanceFilter,
) => {
  const conditions = [];

  if (filters?.startDate) {
    conditions.push(gte(timesheetEntries.sheetDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(timesheetEntries.sheetDate, filters.endDate));
  }
  if (filters?.technicianId) {
    conditions.push(eq(timesheetEntries.employeeId, filters.technicianId));
  }

  const productivityData = await db
    .select({
      employeeName: users.fullName,
      jobsCompleted: sql<number>`0`,
      hoursWorked: sql<number>`COALESCE(SUM(CAST(${timesheetEntries.totalHours} AS NUMERIC) + CAST(${timesheetEntries.overtimeHours} AS NUMERIC)), 0)`,
    })
    .from(timesheetEntries)
    .leftJoin(employees, eq(timesheetEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(...conditions, eq(roles.name, "technician")))
    .groupBy(employees.id, users.fullName);

  return productivityData.map((p) => {
    const hoursWorked = p.hoursWorked;
    const jobsCompleted = p.jobsCompleted;
    const efficiency =
      hoursWorked > 0
        ? Math.min(Math.round(((jobsCompleted * 8) / hoursWorked) * 100), 100)
        : 0;

    return {
      name: p.employeeName,
      jobsCompleted,
      hoursWorked,
      efficiency,
      rating: 0, // Would need review/rating system
    };
  });
};

export const getTechnicianQualityReport = async (
  organizationId: string | undefined,
  filters?: TechnicianPerformanceFilter,
) => {
  const conditions = [eq(jobs.isDeleted, false)];

  if (filters?.startDate) {
    conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }
  if (organizationId) {
    conditions.push(eq(bidsTable.organizationId, organizationId));
  }

  // This would need callback/reopen tracking - returning placeholder
  const technicianData = await db
    .select({
      employeeName: users.fullName,
      totalJobs: sql<number>`COUNT(${jobs.id})`,
    })
    .from(jobs)
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(users, eq(bidsTable.assignedTo, users.id))
    .leftJoin(employees, eq(users.id, employees.userId))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(...conditions, eq(roles.name, "technician")))
    .groupBy(employees.id, users.fullName);

  return technicianData.map((t) => ({
    name: t.employeeName,
    callbackRate: 0, // Would need callback tracking
    reopenRate: 0, // Would need reopen tracking
    jobIssues: 0, // Would need issue tracking
  }));
};

export const getTechnicianProfitContribution = async (
  organizationId: string | undefined,
  filters?: TechnicianPerformanceFilter,
) => {
  const conditions = [eq(jobs.isDeleted, false), eq(jobs.status, "completed")];

  if (filters?.startDate) {
    conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }
  if (filters?.technicianId) {
    conditions.push(eq(employees.id, filters.technicianId));
  }
  if (organizationId) {
    conditions.push(eq(bidsTable.organizationId, organizationId));
  }

  const profitData = await db
    .select({
      employeeName: users.fullName,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      cost: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(users, eq(bidsTable.assignedTo, users.id))
    .leftJoin(employees, eq(users.id, employees.userId))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(invoices, eq(jobs.id, invoices.jobId))
    .leftJoin(expenses, eq(jobs.id, expenses.jobId))
    .where(and(...conditions, eq(roles.name, "technician")))
    .groupBy(employees.id, users.fullName);

  return profitData.map((p) => {
    const revenue = parseFloat(p.revenue);
    const cost = parseFloat(p.cost);
    const profit = revenue - cost;
    const margin =
      revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

    return {
      name: p.employeeName,
      revenue,
      cost,
      profit,
      margin,
    };
  });
};

// ============================
// Job Reports
// ============================

export const getJobStatusSummary = async (
  organizationId: string | undefined,
  filters?: JobReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(jobs.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }
  if (filters?.jobType) {
    conditions.push(eq(bidsTable.jobType, filters.jobType));
  }

  const statusCounts = await db
    .select({
      status: jobs.status,
      count: count(),
    })
    .from(jobs)
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions))
    .groupBy(jobs.status);

  const summary = {
    active: 0,
    completed: 0,
    onHold: 0,
    cancelled: 0,
    overdue: 0,
  };

  statusCounts.forEach((s) => {
    if (s.status === "in_progress") summary.active = s.count;
    if (s.status === "completed") summary.completed = s.count;
    if (s.status === "on_hold") summary.onHold = s.count;
    if (s.status === "cancelled") summary.cancelled = s.count;
    // For overdue, would need to check against expected completion date
  });

  return summary;
};

export const getJobProfitability = async (
  organizationId: string | undefined,
  filters?: JobReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(jobs.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }
  if (filters?.jobType) {
    conditions.push(eq(bidsTable.jobType, filters.jobType));
  }
  if (filters?.status) {
    conditions.push(eq(jobs.status, filters.status));
  }

  const profitabilityData = await db
    .select({
      jobId: jobs.id,
      jobNumber: jobs.jobNumber,
      jobName: bidsTable.projectName,
      clientName: organizations.name,
      revenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .leftJoin(invoices, eq(jobs.id, invoices.jobId))
    .leftJoin(expenses, eq(jobs.id, expenses.jobId))
    .where(and(...conditions))
    .groupBy(jobs.id, jobs.jobNumber, bidsTable.projectName, organizations.name)
    .limit(500);

  return profitabilityData.map((j) => {
    const revenue = parseFloat(j.revenue);
    const totalExpenses = parseFloat(j.totalExpenses);
    const profit = revenue - totalExpenses;
    const profitMargin =
      revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

    return {
      id: j.jobId,
      jobNumber: j.jobNumber || null,
      jobName: j.jobName || "Unnamed Job",
      clientName: j.clientName || null,
      revenue,
      totalExpenses,
      profit,
      profitMargin,
    };
  });
};

export const getJobCostBreakdown = async (
  organizationId: string | undefined,
  filters?: JobReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(expenses.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(expenses.expenseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(expenses.expenseDate, filters.endDate));
  }
  if (filters?.jobType) {
    conditions.push(eq(bidsTable.jobType, filters.jobType));
  }

  const costData = await db
    .select({
      category: expenseCategories.name,
      amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions))
    .groupBy(expenses.categoryId, expenseCategories.name);

  const breakdown = {
    materials: 0,
    labor: 0,
    tools: 0,
    fleet: 0,
    subcontractor: 0,
    overhead: 0,
  };

  costData.forEach((c) => {
    const amount = parseFloat(c.amount);
    const category = c.category?.toLowerCase() ?? "";

    if (category?.includes("material")) breakdown.materials += amount;
    else if (category?.includes("labor")) breakdown.labor += amount;
    else if (category?.includes("tool")) breakdown.tools += amount;
    else if (category?.includes("fleet") || category?.includes("vehicle"))
      breakdown.fleet += amount;
    else if (category?.includes("subcontractor"))
      breakdown.subcontractor += amount;
    else breakdown.overhead += amount;
  });

  return breakdown;
};

export const getJobTimeline = async (
  organizationId: string | undefined,
  filters?: JobReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(jobs.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(jobs.createdAt, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(jobs.createdAt, new Date(filters.endDate)));
  }
  if (filters?.status) {
    conditions.push(eq(jobs.status, filters.status));
  }

  const timelineData = await db
    .select({
      jobId: jobs.id,
      jobName: bidsTable.projectName,
      scheduledStartDate: jobs.scheduledStartDate,
      actualStartDate: jobs.actualStartDate,
      scheduledEndDate: jobs.scheduledEndDate,
      actualEndDate: jobs.actualEndDate,
      estimatedDuration: bidsTable.estimatedDuration,
      status: jobs.status,
    })
    .from(jobs)
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return timelineData.map((j) => {
    const estimatedDuration = j.estimatedDuration || "N/A";
    let actualDuration = "N/A";
    let delayDays = 0;

    // Prefer actual dates, fall back to scheduled dates
    const startDate = j.actualStartDate || j.scheduledStartDate;
    const endDate = j.actualEndDate || j.scheduledEndDate;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      actualDuration = `${days} days`;

      // Calculate delay if we have estimated duration
      if (estimatedDuration && estimatedDuration !== "N/A") {
        const estimatedDays = parseInt(estimatedDuration.toString());
        if (!isNaN(estimatedDays)) {
          delayDays = days - estimatedDays;
        }
      }
    }

    return {
      id: j.jobId,
      jobName: j.jobName || "Unnamed Job",
      estimatedDuration:
        estimatedDuration !== "N/A" ? `${estimatedDuration} days` : "N/A",
      actualDuration,
      scheduledStartDate: j.scheduledStartDate || "N/A",
      actualStartDate: j.actualStartDate || "N/A",
      scheduledEndDate: j.scheduledEndDate || "N/A",
      actualEndDate: j.actualEndDate || "N/A",
      delayDays,
      status: j.status || "unknown",
    };
  });
};

// ============================
// Invoicing & Payments Reports
// ============================

export const getInvoiceSummary = async (
  organizationId: string | undefined,
  filters?: InvoicingReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(invoices.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(invoices.invoiceDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(invoices.invoiceDate, filters.endDate));
  }

  // Overall totals
  const totals = await db
    .select({
      totalIssued: count(),
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      collected: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
      outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.balanceDue} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions));

  // Status breakdown
  const statusBreakdown = await db
    .select({
      status: invoices.status,
      count: count(),
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions))
    .groupBy(invoices.status);

  let paid = 0;
  let unpaid = 0;
  let overdue = 0;

  statusBreakdown.forEach((s) => {
    if (s.status === "paid") paid = s.count;
    else if (s.status === "unpaid") unpaid = s.count;
    else if (s.status === "overdue") overdue = s.count;
  });

  return {
    totalIssued: totals[0]?.totalIssued || 0,
    paid,
    unpaid,
    overdue,
    totalRevenue: parseFloat(totals[0]?.totalRevenue || "0"),
    collected: parseFloat(totals[0]?.collected || "0"),
    outstanding: parseFloat(totals[0]?.outstanding || "0"),
  };
};

export const getCustomerAgingReport = async (
  organizationId: string | undefined,
  _filters?: InvoicingReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(invoices.isDeleted, false),
    sql`${invoices.balanceDue} > 0`,
  ];

  const agingData = await db
    .select({
      clientName: organizations.name,
      balanceDue: invoices.balanceDue,
      dueDate: invoices.dueDate,
      daysOverdue: sql<number>`CURRENT_DATE - ${invoices.dueDate}`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(and(...conditions))
    .orderBy(organizations.name);

  // Group by client and age buckets
  const clientAging = new Map<string, any>();

  agingData.forEach((inv) => {
    const clientName = inv.clientName || "Unknown Client";
    const amount = parseFloat(inv.balanceDue || "0");
    const days = inv.daysOverdue || 0;

    if (!clientAging.has(clientName)) {
      clientAging.set(clientName, {
        client: clientName,
        "0-30": 0,
        "31-60": 0,
        "61-90": 0,
        "90+": 0,
        total: 0,
      });
    }

    const aging = clientAging.get(clientName)!;
    aging.total += amount;

    if (days <= 30) aging["0-30"] += amount;
    else if (days <= 60) aging["31-60"] += amount;
    else if (days <= 90) aging["61-90"] += amount;
    else aging["90+"] += amount;
  });

  return Array.from(clientAging.values()).map((a) => ({
    client: a.client,
    "0-30": Math.round(a["0-30"]),
    "31-60": Math.round(a["31-60"]),
    "61-90": Math.round(a["61-90"]),
    "90+": Math.round(a["90+"]),
    total: Math.round(a.total),
  }));
};

export const getPaymentCollectionData = async (
  organizationId: string | undefined,
  filters?: InvoicingReportFilter,
) => {
  const conditions = [
    ...(organizationId ? [eq(bidsTable.organizationId, organizationId)] : []),
    eq(invoices.isDeleted, false),
  ];

  if (filters?.startDate) {
    conditions.push(gte(invoices.invoiceDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(invoices.invoiceDate, filters.endDate));
  }

  const collectionData = await db
    .select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
      expected: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      collected: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...conditions))
    .groupBy(sql`TO_CHAR(${invoices.invoiceDate}, 'Mon')`)
    .orderBy(sql`MIN(${invoices.invoiceDate})`);

  return collectionData.map((c) => {
    const expected = parseFloat(c.expected);
    const collected = parseFloat(c.collected);
    const collectionRate =
      expected > 0 ? Number(((collected / expected) * 100).toFixed(1)) : 0;

    return {
      month: c.month,
      collected: Math.round(collected),
      expected: Math.round(expected),
      collectionRate,
    };
  });
};
