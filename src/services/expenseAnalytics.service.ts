import {
  count,
  eq,
  desc,
  asc,
  and,
  or,
  sql,
  gte,
  lte,
  sum,
  avg,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  expenses,
  expenseCategories,
  expenseBudgets,
} from "../drizzle/schema/expenses.schema.js";
import {
  employees,
  departments,
} from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";

// ============================
// Expense Summary & Analytics
// ============================

export const getExpenseSummary = async (
  organizationId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    employeeId?: number;
    categoryId?: string;
    jobId?: string;
    departmentId?: number;
    status?: string;
  }
) => {
  let whereConditions = [
    eq(expenses.organizationId, organizationId),
    eq(expenses.isDeleted, false),
  ];

  // Apply filters
  if (filters?.startDate) {
    whereConditions.push(gte(expenses.expenseDate, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lte(expenses.expenseDate, filters.endDate));
  }

  if (filters?.employeeId) {
    whereConditions.push(eq(expenses.employeeId, filters.employeeId));
  }

  if (filters?.categoryId) {
    whereConditions.push(eq(expenses.categoryId, filters.categoryId));
  }

  if (filters?.jobId) {
    whereConditions.push(eq(expenses.jobId, filters.jobId));
  }

  if (filters?.status) {
    whereConditions.push(eq(expenses.status, filters.status as any));
  }

  // Get overall summary
  const summaryResult = await db
    .select({
      totalExpenses: count(),
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      totalReimbursable: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isReimbursable} = true THEN CAST(${expenses.amount} AS DECIMAL) ELSE 0 END), 0)`,
      totalReimbursed: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.reimbursementStatus} = 'paid' THEN CAST(${expenses.reimbursementAmount} AS DECIMAL) ELSE 0 END), 0)`,
      totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} IN ('draft', 'submitted') THEN CAST(${expenses.amount} AS DECIMAL) ELSE 0 END), 0)`,
      totalMileage: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isMileageExpense} = true THEN CAST(${expenses.miles} AS DECIMAL) ELSE 0 END), 0)`,
      totalMileageAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isMileageExpense} = true THEN CAST(${expenses.amount} AS DECIMAL) ELSE 0 END), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions));

  // Get breakdown by status
  const statusBreakdown = await db
    .select({
      status: expenses.status,
      count: count(),
      amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions))
    .groupBy(expenses.status);

  // Get breakdown by expense type
  const typeBreakdown = await db
    .select({
      expenseType: expenses.expenseType,
      count: count(),
      amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions))
    .groupBy(expenses.expenseType);

  // Get breakdown by payment method
  const paymentMethodBreakdown = await db
    .select({
      paymentMethod: expenses.paymentMethod,
      count: count(),
      amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions))
    .groupBy(expenses.paymentMethod);

  // Get monthly breakdown
  const monthlyBreakdown = await db
    .select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`,
      count: count(),
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      totalReimbursed: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.reimbursementStatus} = 'paid' THEN CAST(${expenses.reimbursementAmount} AS DECIMAL) ELSE 0 END), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions))
    .groupBy(sql`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`);

  // Get top categories
  const topCategories = await db
    .select({
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      count: count(),
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(...whereConditions))
    .groupBy(expenses.categoryId, expenseCategories.name)
    .orderBy(desc(sql`SUM(CAST(${expenses.amount} AS DECIMAL))`))
    .limit(10);

  // Get top employees (if not filtering by specific employee)
  let topEmployees: any[] = [];
  if (!filters?.employeeId) {
    topEmployees = await db
      .select({
        employeeId: expenses.employeeId,
        employeeName: users.fullName,
        count: count(),
        totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .leftJoin(employees, eq(expenses.employeeId, employees.id))
      .leftJoin(users, eq(employees.userId, users.id))
      .where(and(...whereConditions))
      .groupBy(expenses.employeeId, users.fullName)
      .orderBy(desc(sql`SUM(CAST(${expenses.amount} AS DECIMAL))`))
      .limit(10);
  }

  return {
    totalExpenses: summaryResult[0]?.totalExpenses || 0,
    totalAmount: summaryResult[0]?.totalAmount || "0",
    totalReimbursable: summaryResult[0]?.totalReimbursable || "0",
    totalReimbursed: summaryResult[0]?.totalReimbursed || "0",
    totalPending: summaryResult[0]?.totalPending || "0",
    totalMileage: summaryResult[0]?.totalMileage || "0",
    totalMileageAmount: summaryResult[0]?.totalMileageAmount || "0",
    byStatus: statusBreakdown.reduce((acc, item) => {
      acc[item.status] = { count: item.count, amount: item.amount };
      return acc;
    }, {} as Record<string, { count: number; amount: string }>),
    byType: typeBreakdown.reduce((acc, item) => {
      acc[item.expenseType] = { count: item.count, amount: item.amount };
      return acc;
    }, {} as Record<string, { count: number; amount: string }>),
    byPaymentMethod: paymentMethodBreakdown.reduce((acc, item) => {
      acc[item.paymentMethod] = { count: item.count, amount: item.amount };
      return acc;
    }, {} as Record<string, { count: number; amount: string }>),
    byMonth: monthlyBreakdown,
    topCategories: topCategories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName || "Unknown",
      count: cat.count,
      totalAmount: cat.totalAmount,
    })),
    topEmployees: topEmployees.map((emp) => ({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName || "Unknown",
      count: emp.count,
      totalAmount: emp.totalAmount,
    })),
  };
};

export const getExpenseBudgetSummary = async (
  organizationId: string,
  filters?: {
    budgetType?: string;
    periodStart?: string;
    periodEnd?: string;
    includeInactive?: boolean;
  }
) => {
  let whereConditions = [
    eq(expenseBudgets.organizationId, organizationId),
    eq(expenseBudgets.isDeleted, false),
  ];

  // Apply filters
  if (!filters?.includeInactive) {
    whereConditions.push(eq(expenseBudgets.isActive, true));
  }

  if (filters?.budgetType) {
    whereConditions.push(eq(expenseBudgets.budgetType, filters.budgetType));
  }

  if (filters?.periodStart) {
    whereConditions.push(gte(expenseBudgets.periodStart, filters.periodStart));
  }

  if (filters?.periodEnd) {
    whereConditions.push(lte(expenseBudgets.periodEnd, filters.periodEnd));
  }

  // Get overall budget summary
  const summaryResult = await db
    .select({
      totalBudgets: count(),
      totalBudgetAmount: sql<string>`COALESCE(SUM(CAST(${expenseBudgets.budgetAmount} AS DECIMAL)), 0)`,
      totalSpentAmount: sql<string>`COALESCE(SUM(CAST(${expenseBudgets.spentAmount} AS DECIMAL)), 0)`,
      totalRemainingAmount: sql<string>`COALESCE(SUM(CAST(${expenseBudgets.remainingAmount} AS DECIMAL)), 0)`,
      overBudgetCount: sql<number>`COUNT(CASE WHEN CAST(${expenseBudgets.spentAmount} AS DECIMAL) > CAST(${expenseBudgets.budgetAmount} AS DECIMAL) THEN 1 END)`,
      nearLimitCount: sql<number>`COUNT(CASE WHEN (CAST(${expenseBudgets.spentAmount} AS DECIMAL) / CAST(${expenseBudgets.budgetAmount} AS DECIMAL)) * 100 >= CAST(${expenseBudgets.warningThreshold} AS DECIMAL) THEN 1 END)`,
    })
    .from(expenseBudgets)
    .where(and(...whereConditions));

  // Calculate budget utilization
  const summary = summaryResult[0];
  const budgetUtilization = summary?.totalBudgetAmount && parseFloat(summary.totalBudgetAmount) > 0
    ? ((parseFloat(summary.totalSpentAmount) / parseFloat(summary.totalBudgetAmount)) * 100).toFixed(2)
    : "0";

  // Get breakdown by budget type
  const typeBreakdown = await db
    .select({
      budgetType: expenseBudgets.budgetType,
      count: count(),
      budgetAmount: sql<string>`COALESCE(SUM(CAST(${expenseBudgets.budgetAmount} AS DECIMAL)), 0)`,
      spentAmount: sql<string>`COALESCE(SUM(CAST(${expenseBudgets.spentAmount} AS DECIMAL)), 0)`,
    })
    .from(expenseBudgets)
    .where(and(...whereConditions))
    .groupBy(expenseBudgets.budgetType);

  // Get top over-budget items
  const topOverBudget = await db
    .select({
      budgetId: expenseBudgets.id,
      name: expenseBudgets.name,
      budgetType: expenseBudgets.budgetType,
      budgetAmount: expenseBudgets.budgetAmount,
      spentAmount: expenseBudgets.spentAmount,
      overAmount: sql<string>`CAST(${expenseBudgets.spentAmount} AS DECIMAL) - CAST(${expenseBudgets.budgetAmount} AS DECIMAL)`,
      utilizationPercentage: sql<string>`(CAST(${expenseBudgets.spentAmount} AS DECIMAL) / CAST(${expenseBudgets.budgetAmount} AS DECIMAL)) * 100`,
    })
    .from(expenseBudgets)
    .where(
      and(
        ...whereConditions,
        sql`CAST(${expenseBudgets.spentAmount} AS DECIMAL) > CAST(${expenseBudgets.budgetAmount} AS DECIMAL)`
      )
    )
    .orderBy(desc(sql`CAST(${expenseBudgets.spentAmount} AS DECIMAL) - CAST(${expenseBudgets.budgetAmount} AS DECIMAL)`))
    .limit(10);

  return {
    totalBudgets: summary?.totalBudgets || 0,
    totalBudgetAmount: summary?.totalBudgetAmount || "0",
    totalSpentAmount: summary?.totalSpentAmount || "0",
    totalRemainingAmount: summary?.totalRemainingAmount || "0",
    overBudgetCount: summary?.overBudgetCount || 0,
    nearLimitCount: summary?.nearLimitCount || 0,
    budgetUtilization,
    byType: typeBreakdown.reduce((acc, item) => {
      acc[item.budgetType] = {
        count: item.count,
        budgetAmount: item.budgetAmount,
        spentAmount: item.spentAmount,
      };
      return acc;
    }, {} as Record<string, { count: number; budgetAmount: string; spentAmount: string }>),
    topOverBudget: topOverBudget.map((budget) => ({
      budgetId: budget.budgetId,
      name: budget.name,
      budgetType: budget.budgetType,
      budgetAmount: budget.budgetAmount,
      spentAmount: budget.spentAmount,
      overAmount: budget.overAmount,
      utilizationPercentage: budget.utilizationPercentage,
    })),
  };
};

export const getEmployeeExpenseSummary = async (
  organizationId: string,
  employeeId: number,
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }
) => {
  let whereConditions = [
    eq(expenses.organizationId, organizationId),
    eq(expenses.employeeId, employeeId),
    eq(expenses.isDeleted, false),
  ];

  // Apply filters
  if (filters?.startDate) {
    whereConditions.push(gte(expenses.expenseDate, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lte(expenses.expenseDate, filters.endDate));
  }

  if (filters?.status) {
    whereConditions.push(eq(expenses.status, filters.status as any));
  }

  // Get employee info
  const employeeResult = await db
    .select({
      id: employees.id,
      fullName: users.fullName,
      email: users.email,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.isDeleted, false)
      )
    )
    .limit(1);

  if (!employeeResult[0]) {
    return null;
  }

  const employee = employeeResult[0];

  // Get expense summary
  const summaryResult = await db
    .select({
      totalExpenses: count(),
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      totalReimbursable: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isReimbursable} = true THEN CAST(${expenses.amount} AS DECIMAL) ELSE 0 END), 0)`,
      totalReimbursed: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.reimbursementStatus} = 'paid' THEN CAST(${expenses.reimbursementAmount} AS DECIMAL) ELSE 0 END), 0)`,
      pendingReimbursement: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isReimbursable} = true AND ${expenses.reimbursementStatus} != 'paid' THEN CAST(${expenses.reimbursementAmount} AS DECIMAL) ELSE 0 END), 0)`,
      averageExpenseAmount: sql<string>`COALESCE(AVG(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      totalMileage: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isMileageExpense} = true THEN CAST(${expenses.miles} AS DECIMAL) ELSE 0 END), 0)`,
      totalMileageAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isMileageExpense} = true THEN CAST(${expenses.amount} AS DECIMAL) ELSE 0 END), 0)`,
    })
    .from(expenses)
    .where(and(...whereConditions));

  // Get breakdown by category
  const categoryBreakdown = await db
    .select({
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      count: count(),
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(...whereConditions))
    .groupBy(expenses.categoryId, expenseCategories.name)
    .orderBy(desc(sql`SUM(CAST(${expenses.amount} AS DECIMAL))`));

  // Get recent expenses (last 5)
  const recentExpenses = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      title: expenses.title,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      status: expenses.status,
      categoryName: expenseCategories.name,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(...whereConditions))
    .orderBy(desc(expenses.expenseDate))
    .limit(5);

  // Get pending approvals
  const pendingApprovals = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      title: expenses.title,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      submittedDate: expenses.submittedDate,
      categoryName: expenseCategories.name,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        ...whereConditions,
        eq(expenses.status, "submitted")
      )
    )
    .orderBy(desc(expenses.submittedDate));

  const summary = summaryResult[0];

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName || "Unknown",
      email: employee.email || "",
      department: employee.departmentName || undefined,
    },
    summary: {
      totalExpenses: summary?.totalExpenses || 0,
      totalAmount: summary?.totalAmount || "0",
      totalReimbursable: summary?.totalReimbursable || "0",
      totalReimbursed: summary?.totalReimbursed || "0",
      pendingReimbursement: summary?.pendingReimbursement || "0",
      averageExpenseAmount: summary?.averageExpenseAmount || "0",
      totalMileage: summary?.totalMileage || "0",
      totalMileageAmount: summary?.totalMileageAmount || "0",
    },
    byCategory: categoryBreakdown.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName || "Unknown",
      count: cat.count,
      totalAmount: cat.totalAmount,
    })),
    recentExpenses: recentExpenses.map((exp) => ({
      id: exp.id,
      expenseNumber: exp.expenseNumber,
      title: exp.title,
      amount: exp.amount,
      expenseDate: exp.expenseDate,
      status: exp.status,
      category: exp.categoryName,
    })),
    pendingApprovals: pendingApprovals.map((exp) => ({
      id: exp.id,
      expenseNumber: exp.expenseNumber,
      title: exp.title,
      amount: exp.amount,
      expenseDate: exp.expenseDate,
      submittedDate: exp.submittedDate,
      category: exp.categoryName,
    })),
  };
};

