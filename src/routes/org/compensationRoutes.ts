import { Router } from "express";
import {
  getEmployeeCompensationsHandler,
  getEmployeeCompensationByIdHandler,
  createEmployeeCompensationHandler,
  updateEmployeeCompensationHandler,
  deleteEmployeeCompensationHandler,
  getEmployeeCompensationHistoryHandler,
  getPayPeriodsHandler,
  getPayPeriodByIdHandler,
  createPayPeriodHandler,
  updatePayPeriodHandler,
  deletePayPeriodHandler,
  getEmployeeLeaveBalancesHandler,
  updateEmployeeLeaveBalanceHandler,
  getEmployeeBenefitsHandler,
  createEmployeeBenefitHandler,
  updateEmployeeBenefitHandler,
  deleteEmployeeBenefitHandler,
} from "../../controllers/CompensationController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getEmployeeCompensationsQuerySchema,
  getEmployeeCompensationByIdSchema,
  createEmployeeCompensationSchema,
  updateEmployeeCompensationSchema,
  deleteEmployeeCompensationSchema,
  getEmployeeCompensationHistorySchema,
  getPayPeriodsQuerySchema,
  getPayPeriodByIdSchema,
  createPayPeriodSchema,
  updatePayPeriodSchema,
  deletePayPeriodSchema,
  getEmployeeLeaveBalancesSchema,
  updateEmployeeLeaveBalanceSchema,
  getEmployeeBenefitsQuerySchema,
  createEmployeeBenefitSchema,
  updateEmployeeBenefitSchema,
  deleteEmployeeBenefitSchema,
} from "../../validations/compensation.validations.js";

const router = Router();

// Employee Compensation Routes
router.get(
  "/compensations",
  authenticate,
  validate(getEmployeeCompensationsQuerySchema),
  getEmployeeCompensationsHandler
);

router.get(
  "/compensations/:id",
  authenticate,
  validate(getEmployeeCompensationByIdSchema),
  getEmployeeCompensationByIdHandler
);

router.post(
  "/compensations",
  authenticate,
  validate(createEmployeeCompensationSchema),
  createEmployeeCompensationHandler
);

router.put(
  "/compensations/:id",
  authenticate,
  validate(updateEmployeeCompensationSchema),
  updateEmployeeCompensationHandler
);

router.delete(
  "/compensations/:id",
  authenticate,
  validate(deleteEmployeeCompensationSchema),
  deleteEmployeeCompensationHandler
);

router.get(
  "/compensations/history/:employeeId",
  authenticate,
  validate(getEmployeeCompensationHistorySchema),
  getEmployeeCompensationHistoryHandler
);

// Pay Periods Routes
router.get(
  "/pay-periods",
  authenticate,
  validate(getPayPeriodsQuerySchema),
  getPayPeriodsHandler
);

router.get(
  "/pay-periods/:id",
  authenticate,
  validate(getPayPeriodByIdSchema),
  getPayPeriodByIdHandler
);

router.post(
  "/pay-periods",
  authenticate,
  validate(createPayPeriodSchema),
  createPayPeriodHandler
);

router.put(
  "/pay-periods/:id",
  authenticate,
  validate(updatePayPeriodSchema),
  updatePayPeriodHandler
);

router.delete(
  "/pay-periods/:id",
  authenticate,
  validate(deletePayPeriodSchema),
  deletePayPeriodHandler
);

// Employee Leave Balances Routes
router.get(
  "/leave-balances/:employeeId",
  authenticate,
  validate(getEmployeeLeaveBalancesSchema),
  getEmployeeLeaveBalancesHandler
);

router.put(
  "/leave-balances/:id",
  authenticate,
  validate(updateEmployeeLeaveBalanceSchema),
  updateEmployeeLeaveBalanceHandler
);

// Employee Benefits Routes
router.get(
  "/benefits",
  authenticate,
  validate(getEmployeeBenefitsQuerySchema),
  getEmployeeBenefitsHandler
);

router.post(
  "/benefits",
  authenticate,
  validate(createEmployeeBenefitSchema),
  createEmployeeBenefitHandler
);

router.put(
  "/benefits/:id",
  authenticate,
  validate(updateEmployeeBenefitSchema),
  updateEmployeeBenefitHandler
);

router.delete(
  "/benefits/:id",
  authenticate,
  validate(deleteEmployeeBenefitSchema),
  deleteEmployeeBenefitHandler
);

export default router;



