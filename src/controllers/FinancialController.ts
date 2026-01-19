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
import { logger } from "../utils/logger.js";

// Financial Summary Handlers
export const getFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;
    const periodStart = req.query.periodStart as string;
    const periodEnd = req.query.periodEnd as string;

    const summary = await getFinancialSummary(
      organizationId,
      periodStart,
      periodEnd
    );

    logger.info("Financial summary fetched successfully");
    return res.status(200).json({ data: summary });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const summary = await createFinancialSummary(req.body);
    logger.info("Financial summary created successfully");
    return res.status(201).json({ data: summary });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const summary = await updateFinancialSummary(id, req.body);

    if (!summary) {
      return res.status(404).json({ error: "Financial summary not found" });
    }

    logger.info("Financial summary updated successfully");
    return res.status(200).json({ data: summary });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Job Financial Summary Handlers
export const getJobFinancialSummariesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    const filters: { search?: string } = {};
    if (search) {
      filters.search = search;
    }
    
    const summaries = await getJobFinancialSummaries(
      organizationId,
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    logger.info("Job financial summaries fetched successfully");
    return res.status(200).json({
      success: true,
      data: summaries.data,
      total: summaries.total,
      pagination: summaries.pagination,
    });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getJobFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID parameter is required" });
    }

    const summary = await getJobFinancialSummary(jobId);

    if (!summary) {
      return res.status(404).json({ error: "Job financial summary not found" });
    }

    logger.info("Job financial summary fetched successfully");
    return res.status(200).json({ data: summary });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createJobFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const summary = await createJobFinancialSummary(req.body);
    logger.info("Job financial summary created successfully");
    return res.status(201).json({ data: summary });
  } catch (error: any) {
    logger.logApiError("Financial error", error, req);
    if (error?.code === "23505") {
      return res
        .status(409)
        .json({ error: "Job financial summary already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateJobFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID parameter is required" });
    }

    const summary = await updateJobFinancialSummary(jobId, req.body);

    if (!summary) {
      return res.status(404).json({ error: "Job financial summary not found" });
    }

    logger.info("Job financial summary updated successfully");
    return res.status(200).json({ data: summary });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Financial Cost Categories Handlers
export const getFinancialCostCategoriesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;

    const categories = await getFinancialCostCategories(organizationId);

    logger.info("Financial cost categories fetched successfully");
    return res.status(200).json({ data: categories });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialCostCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const category = await createFinancialCostCategory(req.body);
    logger.info("Financial cost category created successfully");
    return res.status(201).json({ data: category });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialCostCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const category = await updateFinancialCostCategory(id, req.body);

    if (!category) {
      return res
        .status(404)
        .json({ error: "Financial cost category not found" });
    }

    logger.info("Financial cost category updated successfully");
    return res.status(200).json({ data: category });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFinancialCostCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const category = await deleteFinancialCostCategory(id);

    if (!category) {
      return res
        .status(404)
        .json({ error: "Financial cost category not found" });
    }

    logger.info("Financial cost category deleted successfully");
    return res
      .status(200)
      .json({ message: "Financial cost category deleted successfully" });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Profit Trend Handlers
export const getProfitTrendHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;

    const trends = await getProfitTrend(organizationId);

    logger.info("Profit trends fetched successfully");
    return res.status(200).json({ data: trends });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createProfitTrendHandler = async (req: Request, res: Response) => {
  try {
    const trend = await createProfitTrend(req.body);
    logger.info("Profit trend created successfully");
    return res.status(201).json({ data: trend });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Cash Flow Projection Handlers
export const getCashFlowProjectionsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;

    const projections = await getCashFlowProjections(organizationId);

    logger.info("Cash flow projections fetched successfully");
    return res.status(200).json({ data: projections });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createCashFlowProjectionHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const projection = await createCashFlowProjection(req.body);
    logger.info("Cash flow projection created successfully");
    return res.status(201).json({ data: projection });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCashFlowProjectionHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const projection = await updateCashFlowProjection(id, req.body);

    if (!projection) {
      return res.status(404).json({ error: "Cash flow projection not found" });
    }

    logger.info("Cash flow projection updated successfully");
    return res.status(200).json({ data: projection });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Cash Flow Scenarios Handlers
export const getCashFlowScenariosHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { projectionId } = req.params;

    if (!projectionId) {
      return res
        .status(400)
        .json({ error: "Projection ID parameter is required" });
    }

    const scenarios = await getCashFlowScenarios(projectionId);

    logger.info("Cash flow scenarios fetched successfully");
    return res.status(200).json({ data: scenarios });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createCashFlowScenarioHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const scenario = await createCashFlowScenario(req.body);
    logger.info("Cash flow scenario created successfully");
    return res.status(201).json({ data: scenario });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCashFlowScenarioHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const scenario = await updateCashFlowScenario(id, req.body);

    if (!scenario) {
      return res.status(404).json({ error: "Cash flow scenario not found" });
    }

    logger.info("Cash flow scenario updated successfully");
    return res.status(200).json({ data: scenario });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Revenue Forecast Handlers
export const getRevenueForecastHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;

    const forecast = await getRevenueForecast(organizationId);

    logger.info("Revenue forecast fetched successfully");
    return res.status(200).json({ data: forecast });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createRevenueForecastHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const forecast = await createRevenueForecast(req.body);
    logger.info("Revenue forecast created successfully");
    return res.status(201).json({ data: forecast });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateRevenueForecastHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const forecast = await updateRevenueForecast(id, req.body);

    if (!forecast) {
      return res.status(404).json({ error: "Revenue forecast not found" });
    }

    logger.info("Revenue forecast updated successfully");
    return res.status(200).json({ data: forecast });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Financial Reports Handlers
export const getFinancialReportsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.query.organizationId as string;

    const reports = await getFinancialReports(organizationId);

    logger.info("Financial reports fetched successfully");
    return res.status(200).json({ data: reports });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createFinancialReportHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const report = await createFinancialReport(req.body);
    logger.info("Financial report created successfully");
    return res.status(201).json({ data: report });
  } catch (error: any) {
    logger.logApiError("Financial error", error, req);
    if (error?.code === "23505") {
      return res
        .status(409)
        .json({ error: "Financial report with this key already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateFinancialReportHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const report = await updateFinancialReport(id, req.body);

    if (!report) {
      return res.status(404).json({ error: "Financial report not found" });
    }

    logger.info("Financial report updated successfully");
    return res.status(200).json({ data: report });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFinancialReportHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID parameter is required" });
    }

    const report = await deleteFinancialReport(id);

    if (!report) {
      return res.status(404).json({ error: "Financial report not found" });
    }

    logger.info("Financial report deleted successfully");
    return res
      .status(200)
      .json({ message: "Financial report deleted successfully" });
  } catch (error) {
    logger.logApiError("Financial error", error, req);
    return res.status(500).json({ error: "Internal server error" });
  }
};
