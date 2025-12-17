import type { Request, Response } from "express";
import {
  getEmployeeCompensations,
  getEmployeeCompensationById,
  createEmployeeCompensation,
  updateEmployeeCompensation,
  deleteEmployeeCompensation,
  getEmployeeCompensationHistory,
  getPayPeriods,
  getPayPeriodById,
  createPayPeriod,
  updatePayPeriod,
  deletePayPeriod,
  getEmployeeLeaveBalances,
  updateEmployeeLeaveBalance,
  getEmployeeBenefits,
  createEmployeeBenefit,
  updateEmployeeBenefit,
  deleteEmployeeBenefit,
} from "../services/compensation.service.js";
import { logger } from "../utils/logger.js";

// Employee Compensation Handlers
export const getEmployeeCompensationsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const organizationId = req.query.organizationId as string;
    const employeeId = req.query.employeeId as string | undefined;
    const isActive = req.query.isActive as string | undefined;

    const offset = (page - 1) * limit;

    const result = await getEmployeeCompensations(offset, limit, {
      search,
      organizationId,
      employeeId,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    logger.info("Employee compensations fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee compensations", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getEmployeeCompensationByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid compensation ID provided",
      });
    }

    const compensation = await getEmployeeCompensationById(id);
    if (!compensation) {
      return res.status(404).json({
        success: false,
        message: "Employee compensation not found",
      });
    }

    logger.info("Employee compensation fetched successfully");
    return res.status(200).json({
      success: true,
      data: compensation,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching employee compensation details",
      error,
      req
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createEmployeeCompensationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const compensationData = req.body;
    const createdBy = (req as any).user?.id;

    const newCompensation = await createEmployeeCompensation({
      ...compensationData,
      createdBy,
    });

    logger.info("Employee compensation created successfully");
    return res.status(201).json({
      success: true,
      message: "Employee compensation created successfully",
      data: newCompensation,
    });
  } catch (error) {
    logger.logApiError("Error creating employee compensation", error, req);

    if ((error as any).code === "DUPLICATE_ACTIVE_COMPENSATION") {
      return res.status(400).json({
        success: false,
        message: "Employee already has active compensation for this period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateEmployeeCompensationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid compensation ID provided",
      });
    }

    const updatedCompensation = await updateEmployeeCompensation(
      id,
      updateData
    );

    if (!updatedCompensation) {
      return res.status(404).json({
        success: false,
        message: "Employee compensation not found",
      });
    }

    logger.info("Employee compensation updated successfully");
    return res.status(200).json({
      success: true,
      message: "Employee compensation updated successfully",
      data: updatedCompensation,
    });
  } catch (error) {
    logger.logApiError("Error updating employee compensation", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteEmployeeCompensationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid compensation ID provided",
      });
    }

    const deleted = await deleteEmployeeCompensation(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Employee compensation not found",
      });
    }

    logger.info("Employee compensation deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Employee compensation deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting employee compensation", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getEmployeeCompensationHistoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const employeeId = parseInt(req.params.employeeId as string);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID provided",
      });
    }

    const offset = (page - 1) * limit;

    const result = await getEmployeeCompensationHistory(
      employeeId,
      offset,
      limit
    );

    logger.info("Employee compensation history fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching employee compensation history",
      error,
      req
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Pay Periods Handlers
export const getPayPeriodsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const organizationId = req.query.organizationId as string;
    const frequency = req.query.frequency as string | undefined;
    const year = req.query.year as string | undefined;
    const status = req.query.status as string | undefined;

    const offset = (page - 1) * limit;

    const result = await getPayPeriods(offset, limit, {
      organizationId,
      frequency,
      year: year ? parseInt(year) : undefined,
      status,
    });

    logger.info("Pay periods fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching pay periods", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayPeriodByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid pay period ID provided",
      });
    }

    const payPeriod = await getPayPeriodById(id);
    if (!payPeriod) {
      return res.status(404).json({
        success: false,
        message: "Pay period not found",
      });
    }

    logger.info("Pay period fetched successfully");
    return res.status(200).json({
      success: true,
      data: payPeriod,
    });
  } catch (error) {
    logger.logApiError("Error fetching pay period details", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createPayPeriodHandler = async (req: Request, res: Response) => {
  try {
    const payPeriodData = req.body;
    const createdBy = (req as any).user?.id;

    const newPayPeriod = await createPayPeriod({
      ...payPeriodData,
      createdBy,
    });

    logger.info("Pay period created successfully");
    return res.status(201).json({
      success: true,
      message: "Pay period created successfully",
      data: newPayPeriod,
    });
  } catch (error) {
    logger.logApiError("Error creating pay period", error, req);

    if ((error as any).code === "DUPLICATE_PAY_PERIOD") {
      return res.status(400).json({
        success: false,
        message: "Pay period with these dates already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePayPeriodHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid pay period ID provided",
      });
    }

    const updatedPayPeriod = await updatePayPeriod(id, updateData);

    if (!updatedPayPeriod) {
      return res.status(404).json({
        success: false,
        message: "Pay period not found",
      });
    }

    logger.info("Pay period updated successfully");
    return res.status(200).json({
      success: true,
      message: "Pay period updated successfully",
      data: updatedPayPeriod,
    });
  } catch (error) {
    logger.logApiError("Error updating pay period", error, req);

    if ((error as any).code === "PERIOD_LOCKED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update locked pay period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deletePayPeriodHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid pay period ID provided",
      });
    }

    const deleted = await deletePayPeriod(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Pay period not found",
      });
    }

    logger.info("Pay period deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Pay period deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting pay period", error, req);

    if ((error as any).code === "PERIOD_HAS_PAYROLL") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete pay period with existing payroll entries",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Employee Leave Balances Handlers
export const getEmployeeLeaveBalancesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const employeeId = parseInt(req.params.employeeId as string);
    const organizationId = req.query.organizationId as string;

    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID provided",
      });
    }

    const leaveBalances = await getEmployeeLeaveBalances(
      employeeId,
      organizationId
    );

    logger.info("Employee leave balances fetched successfully");
    return res.status(200).json({
      success: true,
      data: leaveBalances,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee leave balances", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateEmployeeLeaveBalanceHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave balance ID provided",
      });
    }

    const updatedBalance = await updateEmployeeLeaveBalance(id, updateData);

    if (!updatedBalance) {
      return res.status(404).json({
        success: false,
        message: "Employee leave balance not found",
      });
    }

    logger.info("Employee leave balance updated successfully");
    return res.status(200).json({
      success: true,
      message: "Employee leave balance updated successfully",
      data: updatedBalance,
    });
  } catch (error) {
    logger.logApiError("Error updating employee leave balance", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Employee Benefits Handlers
export const getEmployeeBenefitsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const employeeId = req.query.employeeId as string | undefined;
    const organizationId = req.query.organizationId as string;
    const benefitType = req.query.benefitType as string | undefined;
    const isActive = req.query.isActive as string | undefined;

    const offset = (page - 1) * limit;

    const result = await getEmployeeBenefits(offset, limit, {
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      organizationId,
      benefitType,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    logger.info("Employee benefits fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee benefits", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createEmployeeBenefitHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const benefitData = req.body;

    const newBenefit = await createEmployeeBenefit(benefitData);

    logger.info("Employee benefit created successfully");
    return res.status(201).json({
      success: true,
      message: "Employee benefit created successfully",
      data: newBenefit,
    });
  } catch (error) {
    logger.logApiError("Error creating employee benefit", error, req);

    if ((error as any).code === "DUPLICATE_BENEFIT") {
      return res.status(400).json({
        success: false,
        message: "Employee already has this benefit type",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateEmployeeBenefitHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid benefit ID provided",
      });
    }

    const updatedBenefit = await updateEmployeeBenefit(id, updateData);

    if (!updatedBenefit) {
      return res.status(404).json({
        success: false,
        message: "Employee benefit not found",
      });
    }

    logger.info("Employee benefit updated successfully");
    return res.status(200).json({
      success: true,
      message: "Employee benefit updated successfully",
      data: updatedBenefit,
    });
  } catch (error) {
    logger.logApiError("Error updating employee benefit", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteEmployeeBenefitHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid benefit ID provided",
      });
    }

    const deleted = await deleteEmployeeBenefit(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Employee benefit not found",
      });
    }

    logger.info("Employee benefit deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Employee benefit deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting employee benefit", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
