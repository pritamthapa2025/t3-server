import { Router, type IRouter } from "express";
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
import { requireAnyRole } from "../../middleware/featureAuthorize.js";
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

const router: IRouter = Router();

const managerOrAbove = requireAnyRole("Executive", "Manager");

// All compensation routes are restricted to Manager/Executive — salary data is sensitive
router.use(authenticate, managerOrAbove);

// Employee Compensation Routes
router.get(
  "/compensations",
  validate(getEmployeeCompensationsQuerySchema),
  getEmployeeCompensationsHandler
);

router.get(
  "/compensations/:id",
  validate(getEmployeeCompensationByIdSchema),
  getEmployeeCompensationByIdHandler
);

router.post(
  "/compensations",
  validate(createEmployeeCompensationSchema),
  createEmployeeCompensationHandler
);

router.put(
  "/compensations/:id",
  validate(updateEmployeeCompensationSchema),
  updateEmployeeCompensationHandler
);

router.delete(
  "/compensations/:id",
  validate(deleteEmployeeCompensationSchema),
  deleteEmployeeCompensationHandler
);

router.get(
  "/compensations/history/:employeeId",
  validate(getEmployeeCompensationHistorySchema),
  getEmployeeCompensationHistoryHandler
);

// Pay Periods Routes
router.get(
  "/pay-periods",
  validate(getPayPeriodsQuerySchema),
  getPayPeriodsHandler
);

router.get(
  "/pay-periods/:id",
  validate(getPayPeriodByIdSchema),
  getPayPeriodByIdHandler
);

router.post(
  "/pay-periods",
  validate(createPayPeriodSchema),
  createPayPeriodHandler
);

router.put(
  "/pay-periods/:id",
  validate(updatePayPeriodSchema),
  updatePayPeriodHandler
);

router.delete(
  "/pay-periods/:id",
  validate(deletePayPeriodSchema),
  deletePayPeriodHandler
);

// Employee Leave Balances Routes
router.get(
  "/leave-balances/:employeeId",
  validate(getEmployeeLeaveBalancesSchema),
  getEmployeeLeaveBalancesHandler
);

router.put(
  "/leave-balances/:id",
  validate(updateEmployeeLeaveBalanceSchema),
  updateEmployeeLeaveBalanceHandler
);

// Employee Benefits Routes
router.get(
  "/benefits",
  validate(getEmployeeBenefitsQuerySchema),
  getEmployeeBenefitsHandler
);

router.post(
  "/benefits",
  validate(createEmployeeBenefitSchema),
  createEmployeeBenefitHandler
);

router.put(
  "/benefits/:id",
  validate(updateEmployeeBenefitSchema),
  updateEmployeeBenefitHandler
);

router.delete(
  "/benefits/:id",
  validate(deleteEmployeeBenefitSchema),
  deleteEmployeeBenefitHandler
);

export default router;





