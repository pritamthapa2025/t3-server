import type { Request, Response } from "express";
import * as SettingsService from "../services/settings.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

/**
 * ============================================================================
 * COMPANY / GENERAL SETTINGS
 * ============================================================================
 */

export const getCompanySettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getCompanySettings();
    return successResponse(res, settings, "Company settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateCompanySettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateCompanySettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Company settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * ANNOUNCEMENT SETTINGS
 * ============================================================================
 */

export const getAnnouncementSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getAnnouncementSettings();
    return successResponse(res, settings, "Announcement settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateAnnouncementSettings = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateAnnouncementSettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Announcement settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * LABOR RATE TEMPLATES
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

export const getLaborRateByPosition = async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;
    if (positionId == null) {
      return errorResponse(res, "Position ID is required", 400);
    }
    const laborRate = await SettingsService.getLaborRateByPosition(
      parseInt(positionId, 10),
    );
    return successResponse(res, laborRate, "Labor rate retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const upsertLaborRate = async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;
    if (positionId == null) {
      return errorResponse(res, "Position ID is required", 400);
    }
    const userId = req.user?.id;
    const laborRate = await SettingsService.upsertLaborRate(
      parseInt(positionId, 10),
      req.body,
      userId,
    );
    return successResponse(res, laborRate, "Labor rate saved");
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
 * VEHICLE & TRAVEL DEFAULTS
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
 * TRAVEL ORIGINS
 * ============================================================================
 */

export const getTravelOrigins = async (req: Request, res: Response) => {
  try {
    const { page, limit, isActive } = req.query;
    const opts: {
      page?: number;
      limit?: number;
      isActive?: boolean;
    } = {};
    if (page != null && String(page).trim() !== "")
      opts.page = parseInt(String(page), 10);
    if (limit != null && String(limit).trim() !== "")
      opts.limit = parseInt(String(limit), 10);
    if (isActive === "true") opts.isActive = true;
    if (isActive === "false") opts.isActive = false;
    const origins = await SettingsService.getTravelOrigins(opts);
    return successResponse(res, origins, "Travel origins retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const getTravelOriginById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id == null) {
      return errorResponse(res, "Travel origin ID is required", 400);
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
    const { id } = req.params;
    if (id == null) {
      return errorResponse(res, "Travel origin ID is required", 400);
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
    const { id } = req.params;
    if (id == null) {
      return errorResponse(res, "Travel origin ID is required", 400);
    }
    await SettingsService.deleteTravelOrigin(id);
    return successResponse(res, null, "Travel origin deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const setDefaultTravelOrigin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id == null) {
      return errorResponse(res, "Travel origin ID is required", 400);
    }
    const origin = await SettingsService.setDefaultTravelOrigin(id);
    return successResponse(res, origin, "Default travel origin set");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * OPERATING EXPENSE DEFAULTS (Financial)
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
 * JOB SETTINGS
 * ============================================================================
 */

export const getJobSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getJobSettings();
    return successResponse(res, settings, "Job settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateJobSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateJobSettings(req.body, userId);
    return successResponse(res, settings, "Job settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * INVOICE SETTINGS
 * ============================================================================
 */

export const getInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getInvoiceSettings();
    return successResponse(res, settings, "Invoice settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateInvoiceSettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Invoice settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * TAX SETTINGS
 * ============================================================================
 */

export const getTaxSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getTaxSettings();
    return successResponse(res, settings, "Tax settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateTaxSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateTaxSettings(req.body, userId);
    return successResponse(res, settings, "Tax settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * INVENTORY SETTINGS
 * ============================================================================
 */

export const getInventorySettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getInventorySettings();
    return successResponse(res, settings, "Inventory settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateInventorySettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateInventorySettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Inventory settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * NOTIFICATION SETTINGS (System-wide)
 * ============================================================================
 */

export const getNotificationSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SettingsService.getNotificationSettings();
    return successResponse(res, settings, "Notification settings retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateNotificationSettings = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const settings = await SettingsService.updateNotificationSettings(
      req.body,
      userId,
    );
    return successResponse(res, settings, "Notification settings updated");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ============================================================================
 * USER NOTIFICATION PREFERENCES (Per-user)
 * ============================================================================
 */

export const getUserNotificationPreferences = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id!;
    const preferences =
      await SettingsService.getUserNotificationPreferences(userId);
    return successResponse(
      res,
      preferences,
      "User notification preferences retrieved",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateUserNotificationPreferences = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id!;
    const preferences = await SettingsService.updateUserNotificationPreferences(
      userId,
      req.body,
    );
    return successResponse(
      res,
      preferences,
      "User notification preferences updated",
    );
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
