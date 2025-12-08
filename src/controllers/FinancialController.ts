import type { Request, Response } from "express";
import {
  getFinancialSummary,
  createFinancialSummary,
  updateFinancialSummary,
  getJobFinancialSummaries,
  getJobFinancialSummary,
  createJobFinancialSummary,
  updateJobFinancialSummary,
  getFinancialCostCategories,
  createFinancialCostCategory,
  updateFinancialCostCategory,
  deleteFinancialCostCategory,
  getProfitTrend,
  createProfitTrend,
  getCashFlowProjections,
  createCashFlowProjection,
  updateCashFlowProjection,
  getCashFlowScenarios,
  createCashFlowScenario,
  updateCashFlowScenario,
  getRevenueForecast,
  createRevenueForecast,
  updateRevenueForecast,
  getFinancialReports,
  createFinancialReport,
  updateFinancialReport,
  deleteFinancialReport,
} from "../services/financial.service.js";

// Financial Summary Handlers
export const getFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const periodStart = req.query.periodStart as string;
    const periodEnd = req.query.periodEnd as string;

    const summary = await getFinancialSummary(organizationId, periodStart, periodEnd);
    
    return res.status(200).json({ data: summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const summary = await createFinancialSummary(req.body);
    return res.status(201).json({ data: summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const summary = await updateFinancialSummary(id, req.body);
    
    if (!summary) {
      return res.status(404).json({ error: "Financial summary not found" });
    }
    
    return res.status(200).json({ data: summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Job Financial Summary Handlers
export const getJobFinancialSummariesHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const summaries = await getJobFinancialSummaries(organizationId, offset, limit);
    
    return res.status(200).json({ data: summaries });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getJobFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: "Job ID parameter is required" });
    }
    
    const summary = await getJobFinancialSummary(jobId);
    
    if (!summary) {
      return res.status(404).json({ error: "Job financial summary not found" });
    }
    
    return res.status(200).json({ data: summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createJobFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const summary = await createJobFinancialSummary(req.body);
    return res.status(201).json({ data: summary });
  } catch (error: any) {
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Job financial summary already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateJobFinancialSummaryHandler = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: "Job ID parameter is required" });
    }
    
    const summary = await updateJobFinancialSummary(jobId, req.body);
    
    if (!summary) {
      return res.status(404).json({ error: "Job financial summary not found" });
    }
    
    return res.status(200).json({ data: summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Financial Cost Categories Handlers
export const getFinancialCostCategoriesHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const periodStart = req.query.periodStart as string;
    const periodEnd = req.query.periodEnd as string;

    const categories = await getFinancialCostCategories(organizationId, periodStart, periodEnd);
    
    return res.status(200).json({ data: categories });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialCostCategoryHandler = async (req: Request, res: Response) => {
  try {
    const category = await createFinancialCostCategory(req.body);
    return res.status(201).json({ data: category });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialCostCategoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const category = await updateFinancialCostCategory(id, req.body);
    
    if (!category) {
      return res.status(404).json({ error: "Financial cost category not found" });
    }
    
    return res.status(200).json({ data: category });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFinancialCostCategoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const category = await deleteFinancialCostCategory(id);
    
    if (!category) {
      return res.status(404).json({ error: "Financial cost category not found" });
    }
    
    return res.status(200).json({ message: "Financial cost category deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Profit Trend Handlers
export const getProfitTrendHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const trends = await getProfitTrend(organizationId, startDate, endDate);
    
    return res.status(200).json({ data: trends });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createProfitTrendHandler = async (req: Request, res: Response) => {
  try {
    const trend = await createProfitTrend(req.body);
    return res.status(201).json({ data: trend });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Cash Flow Projection Handlers
export const getCashFlowProjectionsHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const projections = await getCashFlowProjections(organizationId, startDate, endDate);
    
    return res.status(200).json({ data: projections });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createCashFlowProjectionHandler = async (req: Request, res: Response) => {
  try {
    const projection = await createCashFlowProjection(req.body);
    return res.status(201).json({ data: projection });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCashFlowProjectionHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const projection = await updateCashFlowProjection(id, req.body);
    
    if (!projection) {
      return res.status(404).json({ error: "Cash flow projection not found" });
    }
    
    return res.status(200).json({ data: projection });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Cash Flow Scenarios Handlers
export const getCashFlowScenariosHandler = async (req: Request, res: Response) => {
  try {
    const { projectionId } = req.params;
    
    if (!projectionId) {
      return res.status(400).json({ error: "Projection ID parameter is required" });
    }
    
    const scenarios = await getCashFlowScenarios(projectionId);
    
    return res.status(200).json({ data: scenarios });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createCashFlowScenarioHandler = async (req: Request, res: Response) => {
  try {
    const scenario = await createCashFlowScenario(req.body);
    return res.status(201).json({ data: scenario });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCashFlowScenarioHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const scenario = await updateCashFlowScenario(id, req.body);
    
    if (!scenario) {
      return res.status(404).json({ error: "Cash flow scenario not found" });
    }
    
    return res.status(200).json({ data: scenario });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Revenue Forecast Handlers
export const getRevenueForecastHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const year = req.query.year as string;

    const forecast = await getRevenueForecast(organizationId, year);
    
    return res.status(200).json({ data: forecast });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createRevenueForecastHandler = async (req: Request, res: Response) => {
  try {
    const forecast = await createRevenueForecast(req.body);
    return res.status(201).json({ data: forecast });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateRevenueForecastHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const forecast = await updateRevenueForecast(id, req.body);
    
    if (!forecast) {
      return res.status(404).json({ error: "Revenue forecast not found" });
    }
    
    return res.status(200).json({ data: forecast });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Financial Reports Handlers
export const getFinancialReportsHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const category = req.query.category as string;

    const reports = await getFinancialReports(organizationId, category);
    
    return res.status(200).json({ data: reports });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialReportHandler = async (req: Request, res: Response) => {
  try {
    const report = await createFinancialReport(req.body);
    return res.status(201).json({ data: report });
  } catch (error: any) {
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Financial report with this key already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialReportHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const report = await updateFinancialReport(id, req.body);
    
    if (!report) {
      return res.status(404).json({ error: "Financial report not found" });
    }
    
    return res.status(200).json({ data: report });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFinancialReportHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }
    
    const report = await deleteFinancialReport(id);
    
    if (!report) {
      return res.status(404).json({ error: "Financial report not found" });
    }
    
    return res.status(200).json({ message: "Financial report deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
