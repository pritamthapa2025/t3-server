import type { Request, Response, NextFunction } from "express";
import {
  getCompanySummaryKPIs,
  getMonthlyRevenueTrend,
  getJobPerformanceData,
  getClientRevenueDistribution,
  getProfitAndLossStatement,
  getCashFlowForecast,
  getRevenueByClientFiltered,
  getFinancialKPIs,
  getExpenseByCategory,
  getMonthlyExpenseTrend,
  getVendorSpendReport,
  getTechnicianHoursReport,
  getLaborCostReport,
  getAttendanceReport,
  getFleetUsageReport,
  getFleetMaintenanceCostReport,
  getFuelExpenseReport,
  getInventoryValuation,
  getStockMovementReport,
  getLowStockItems,
  getClientSpendReport,
  getClientOutstandingPayments,
  getTechnicianProductivityReport,
  getTechnicianQualityReport,
  getTechnicianProfitContribution,
  getJobStatusSummary,
  getJobProfitability,
  getJobCostBreakdown,
  getJobTimeline,
  getInvoiceSummary,
  getCustomerAgingReport,
  getPaymentCollectionData,
} from "../services/reports.service.js";

// ============================
// Company Summary KPIs
// ============================

export const getCompanySummaryKPIsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const kpis = await getCompanySummaryKPIs({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    console.error("Error fetching company summary KPIs:", error);
    next(error);
  }
};

// ============================
// Monthly Revenue Trend
// ============================

export const getMonthlyRevenueTrendHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const trend = await getMonthlyRevenueTrend({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Error fetching monthly revenue trend:", error);
    next(error);
  }
};

// ============================
// Job Performance Data
// ============================

export const getJobPerformanceDataHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const performance = await getJobPerformanceData({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error("Error fetching job performance data:", error);
    next(error);
  }
};

// ============================
// Client Revenue Distribution
// ============================

export const getClientRevenueDistributionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const distribution = await getClientRevenueDistribution({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error("Error fetching client revenue distribution:", error);
    next(error);
  }
};

// ============================
// Financial Reports - KPIs
// ============================

export const getFinancialKPIsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId } = req.query;

    const kpis = await getFinancialKPIs(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    console.error("Error fetching financial KPIs:", error);
    next(error);
  }
};

// ============================
// Financial Reports - Profit & Loss
// ============================

export const getProfitAndLossHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId } = req.query;

    const profitLoss = await getProfitAndLossStatement(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: profitLoss,
    });
  } catch (error) {
    console.error("Error fetching profit and loss:", error);
    next(error);
  }
};

// ============================
// Financial Reports - Cash Flow Forecast
// ============================

export const getCashFlowForecastHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId } = req.query;

    const forecast = await getCashFlowForecast(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error("Error fetching cash flow forecast:", error);
    next(error);
  }
};

// ============================
// Financial Reports - Revenue by Client
// ============================

export const getRevenueByClientHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId } = req.query;

    const revenue = await getRevenueByClientFiltered(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: revenue,
    });
  } catch (error) {
    console.error("Error fetching revenue by client:", error);
    next(error);
  }
};

// ============================
// Expense Reports - By Category
// ============================

export const getExpenseByCategoryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, category } = req.query;

    const expenses = await getExpenseByCategory(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      category: category as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    console.error("Error fetching expense by category:", error);
    next(error);
  }
};

// ============================
// Expense Reports - Monthly Trend
// ============================

export const getMonthlyExpenseTrendHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, category } = req.query;

    const trend = await getMonthlyExpenseTrend(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      category: category as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Error fetching monthly expense trend:", error);
    next(error);
  }
};

// ============================
// Expense Reports - Vendor Spend
// ============================

export const getVendorSpendHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, category } = req.query;

    const vendors = await getVendorSpendReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      category: category as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendor spend report:", error);
    next(error);
  }
};

// ============================
// Timesheet & Labor Reports
// ============================

export const getTechnicianHoursHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const hours = await getTechnicianHoursReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: hours });
  } catch (error) {
    console.error("Error fetching technician hours:", error);
    next(error);
  }
};

export const getLaborCostHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const laborCost = await getLaborCostReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: laborCost });
  } catch (error) {
    console.error("Error fetching labor cost:", error);
    next(error);
  }
};

export const getAttendanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const attendance = await getAttendanceReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    next(error);
  }
};

// ============================
// Fleet Reports
// ============================

export const getFleetUsageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, vehicleId, location } = req.query;

    const usage = await getFleetUsageReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      vehicleId: vehicleId as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: usage });
  } catch (error) {
    console.error("Error fetching fleet usage:", error);
    next(error);
  }
};

export const getFleetMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, vehicleId, location } = req.query;

    const maintenance = await getFleetMaintenanceCostReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      vehicleId: vehicleId as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: maintenance });
  } catch (error) {
    console.error("Error fetching fleet maintenance:", error);
    next(error);
  }
};

export const getFuelExpenseHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, vehicleId, location } = req.query;

    const fuel = await getFuelExpenseReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      vehicleId: vehicleId as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: fuel });
  } catch (error) {
    console.error("Error fetching fuel expense:", error);
    next(error);
  }
};

// ============================
// Inventory Reports
// ============================

export const getInventoryValuationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, category, location } = req.query;

    const valuation = await getInventoryValuation(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      category: category as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: valuation });
  } catch (error) {
    console.error("Error fetching inventory valuation:", error);
    next(error);
  }
};

export const getStockMovementHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, category, location } = req.query;

    const movement = await getStockMovementReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      category: category as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: movement });
  } catch (error) {
    console.error("Error fetching stock movement:", error);
    next(error);
  }
};

export const getLowStockItemsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, category, location } = req.query;

    const lowStock = await getLowStockItems(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      category: category as string | undefined,
      location: location as string | undefined,
    });

    res.status(200).json({ success: true, data: lowStock });
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    next(error);
  }
};

// ============================
// Client Reports
// ============================

export const getClientSpendHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, clientId, paymentStatus } = req.query;

    const clientSpend = await getClientSpendReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });

    res.status(200).json({ success: true, data: clientSpend });
  } catch (error) {
    console.error("Error fetching client spend:", error);
    next(error);
  }
};

export const getClientOutstandingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, clientId, paymentStatus } = req.query;

    const outstanding = await getClientOutstandingPayments(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });

    res.status(200).json({ success: true, data: outstanding });
  } catch (error) {
    console.error("Error fetching client outstanding payments:", error);
    next(error);
  }
};

// ============================
// Technician Performance Reports
// ============================

export const getTechnicianProductivityHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const productivity = await getTechnicianProductivityReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: productivity });
  } catch (error) {
    console.error("Error fetching technician productivity:", error);
    next(error);
  }
};

export const getTechnicianQualityHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const quality = await getTechnicianQualityReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: quality });
  } catch (error) {
    console.error("Error fetching technician quality:", error);
    next(error);
  }
};

export const getTechnicianProfitHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, technicianId, managerId } = req.query;

    const profit = await getTechnicianProfitContribution(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
    });

    res.status(200).json({ success: true, data: profit });
  } catch (error) {
    console.error("Error fetching technician profit contribution:", error);
    next(error);
  }
};

// ============================
// Job Reports
// ============================

export const getJobStatusSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId, status, managerId, technicianId } = req.query;

    const summary = await getJobStatusSummary(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error fetching job status summary:", error);
    next(error);
  }
};

export const getJobProfitabilityHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId, status, managerId, technicianId } = req.query;

    const profitability = await getJobProfitability(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
    });

    res.status(200).json({ success: true, data: profitability });
  } catch (error) {
    console.error("Error fetching job profitability:", error);
    next(error);
  }
};

export const getJobCostBreakdownHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId, status, managerId, technicianId } = req.query;

    const breakdown = await getJobCostBreakdown(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
    });

    res.status(200).json({ success: true, data: breakdown });
  } catch (error) {
    console.error("Error fetching job cost breakdown:", error);
    next(error);
  }
};

export const getJobTimelineHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, jobType, clientId, status, managerId, technicianId } = req.query;

    const timeline = await getJobTimeline(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      jobType: jobType as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      managerId: managerId ? parseInt(managerId as string) : undefined,
      technicianId: technicianId ? parseInt(technicianId as string) : undefined,
    });

    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    console.error("Error fetching job timeline:", error);
    next(error);
  }
};

// ============================
// Invoicing & Payments Reports
// ============================

export const getInvoiceSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, clientId, status, paymentStatus } = req.query;

    const summary = await getInvoiceSummary(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error fetching invoice summary:", error);
    next(error);
  }
};

export const getCustomerAgingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, clientId, status, paymentStatus } = req.query;

    const aging = await getCustomerAgingReport(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });

    res.status(200).json({ success: true, data: aging });
  } catch (error) {
    console.error("Error fetching customer aging report:", error);
    next(error);
  }
};

export const getPaymentCollectionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(400).json({ error: "Organization ID is required" });
      return;
    }

    const { startDate, endDate, clientId, status, paymentStatus } = req.query;

    const collection = await getPaymentCollectionData(organizationId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
    });

    res.status(200).json({ success: true, data: collection });
  } catch (error) {
    console.error("Error fetching payment collection data:", error);
    next(error);
  }
};
