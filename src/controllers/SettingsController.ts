import type { Request, Response } from "express";
import * as SettingsService from "../services/settings.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

/**
 * ============================================================================
 * GENERAL TAB - GENERAL SETTINGS (Company Info + Announcements)
 * ============================================================================
 */

export const getGeneralSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getGeneralSettings();
    return successResponse(res, settings, "General settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateGeneralSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateGeneralSettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "General settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * LABOR ROLES TAB - LABOR RATE TEMPLATES
 * ============================================================================
 */

export const getLaborRates = async (req: Request, res: Response) => {
  try {
    const laborRates = await SettingsService.getLaborRates();
    return successResponse(res, laborRates, "Labor rates retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getLaborRateById = async (req: Request, res: Response) => {
  try {
    const laborRatesId = req.params.laborRatesId;
    if (laborRatesId === undefined) {
      return errorResponse(res, "laborRatesId is required", 400);
    }
    const laborRate = await SettingsService.getLaborRateById(laborRatesId);
    if (!laborRate) {
      return errorResponse(res, "Labor rate not found", 404);
    }
    return successResponse(res, laborRate, "Labor rate retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateLaborRate = async (req: Request, res: Response) => {
  try {
    const laborRatesId = req.params.laborRatesId;
    if (laborRatesId === undefined) {
      return errorResponse(res, "laborRatesId is required", 400);
    }
    const userId = req.user?.id;
    const laborRate = await SettingsService.updateLaborRate(
      laborRatesId,
      req.body,
      userId,
    );
    if (!laborRate) {
      return errorResponse(res, "Labor rate not found", 404);
    }
    return successResponse(res, laborRate, "Labor rate updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteLaborRate = async (req: Request, res: Response) => {
  try {
    const laborRatesId = req.params.laborRatesId;
    if (laborRatesId === undefined) {
      return errorResponse(res, "laborRatesId is required", 400);
    }
    const deleted = await SettingsService.deleteLaborRate(laborRatesId);
    if (!deleted) {
      return errorResponse(res, "Labor rate not found", 404);
    }
    return successResponse(res, null, "Labor rate deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const bulkApplyLaborRates = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await SettingsService.bulkApplyLaborRates(req.body, userId);
    return successResponse(res, result, "Labor rates applied to all positions");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - VEHICLE/TRAVEL DEFAULTS
 * ============================================================================
 */

export const getVehicleTravelDefaults = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getVehicleTravelDefaults();
    return successResponse(res, settings, "Vehicle/travel defaults retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateVehicleTravelDefaults = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateVehicleTravelDefaults(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Vehicle/travel defaults updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - TRAVEL ORIGINS
 * ============================================================================
 */

export const getTravelOrigins = async (req: Request, res: Response) => {
  try {
    const { page, limit, isActive } = req.query;
    const params: { page?: number; limit?: number; isActive?: boolean } = {};
    if (page !== undefined) params.page = parseInt(page as string);
    if (limit !== undefined) params.limit = parseInt(limit as string);
    if (isActive === "true") params.isActive = true;
    else if (isActive === "false") params.isActive = false;
    const origins = await SettingsService.getTravelOrigins(params);
    return successResponse(res, origins, "Travel origins retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getTravelOriginById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const origin = await SettingsService.getTravelOriginById(id);
    if (!origin) {
      return errorResponse(res, "Travel origin not found", 404);
    }
    return successResponse(res, origin, "Travel origin retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const createTravelOrigin = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const origin = await SettingsService.createTravelOrigin(req.body, userId);
    return successResponse(res, origin, "Travel origin created", 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateTravelOrigin = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const userId = req.user?.id;
    const origin = await SettingsService.updateTravelOrigin(
      id,
      req.body,
      userId,
    );
    return successResponse(res, origin, "Travel origin updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteTravelOrigin = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    await SettingsService.deleteTravelOrigin(id);
    return successResponse(res, null, "Travel origin deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const setDefaultTravelOrigin = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const origin = await SettingsService.setDefaultTravelOrigin(id);
    return successResponse(res, origin, "Default travel origin set");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * OPERATING EXPENSES TAB
 * ============================================================================
 */

export const getOperatingExpenseDefaults = async (
  req: Request,
  res: Response,
) => {
  try {
    const settings = await SettingsService.getOperatingExpenseDefaults();
    return successResponse(
      res,
      settings,
      "Operating expense defaults retrieved",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateOperatingExpenseDefaults = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateOperatingExpenseDefaults(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Operating expense defaults updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - PROPOSAL BASIS TEMPLATES
 * ============================================================================
 */

export const getProposalBasisTemplates = async (
  req: Request,
  res: Response,
) => {
  try {
    const templates = await SettingsService.getProposalBasisTemplates();
    return successResponse(
      res,
      templates,
      "Proposal basis templates retrieved",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getProposalBasisTemplateById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const template = await SettingsService.getProposalBasisTemplateById(id);
    if (!template) {
      return errorResponse(res, "Proposal basis template not found", 404);
    }
    return successResponse(res, template, "Proposal basis template retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const createProposalBasisTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const template = await SettingsService.createProposalBasisTemplate(
      req.body,
      userId,
    );
    return successResponse(
      res,
      template,
      "Proposal basis template created",
      201,
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateProposalBasisTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const userId = req.user?.id;
    const template = await SettingsService.updateProposalBasisTemplate(
      id,
      req.body,
      userId,
    );
    return successResponse(res, template, "Proposal basis template updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteProposalBasisTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    await SettingsService.deleteProposalBasisTemplate(id);
    return successResponse(res, null, "Proposal basis template deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - TERMS & CONDITIONS TEMPLATES
 * ============================================================================
 */

export const getTermsConditionsTemplates = async (
  req: Request,
  res: Response,
) => {
  try {
    const templates = await SettingsService.getTermsConditionsTemplates();
    return successResponse(
      res,
      templates,
      "Terms & conditions templates retrieved",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getTermsConditionsTemplateById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const template = await SettingsService.getTermsConditionsTemplateById(id);
    if (!template) {
      return errorResponse(res, "Terms & conditions template not found", 404);
    }
    return successResponse(
      res,
      template,
      "Terms & conditions template retrieved",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const createTermsConditionsTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const template = await SettingsService.createTermsConditionsTemplate(
      req.body,
      userId,
    );
    return successResponse(
      res,
      template,
      "Terms & conditions template created",
      201,
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateTermsConditionsTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const userId = req.user?.id;
    const template = await SettingsService.updateTermsConditionsTemplate(
      id,
      req.body,
      userId,
    );
    return successResponse(
      res,
      template,
      "Terms & conditions template updated",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteTermsConditionsTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    await SettingsService.deleteTermsConditionsTemplate(id);
    return successResponse(res, null, "Terms & conditions template deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const setDefaultTermsConditionsTemplate = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id;
    if (id === undefined) {
      return errorResponse(res, "id is required", 400);
    }
    const template =
      await SettingsService.setDefaultTermsConditionsTemplate(id);
    return successResponse(
      res,
      template,
      "Default terms & conditions template set",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * INVOICE SETTINGS TAB (system-wide)
 * ============================================================================
 */

export const getInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getInvoiceSettings();
    if (!settings) {
      return errorResponse(res, "Invoice settings not found", 404);
    }
    return successResponse(res, settings, "Invoice settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const data = req.body as Parameters<
      typeof SettingsService.updateInvoiceSettings
    >[0];
    const updated = await SettingsService.updateInvoiceSettings(data, userId);
    if (!updated) {
      return errorResponse(res, "Invoice settings not found", 404);
    }
    return successResponse(res, updated, "Invoice settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
