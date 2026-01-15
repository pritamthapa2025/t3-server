import { Router } from "express";
import authRoutes from "./auth/authRoutes.js";
import userRoutes from "./auth/userRoutes.js";
import roleRoutes from "./auth/roleRoutes.js";
import uiPermissionsRoutes from "./auth/uiPermissionsRoutes.js";
import departmentRoutes from "./org/departmentRoutes.js";
import positionRoutes from "./org/positionRoutes.js";
import employeeRoutes from "./org/employeeRoutes.js";
import expenseRoutes from "./org/expenseRoutes.js";
import timesheetRoutes from "./org/timesheetRoutes.js";
import financialRoutes from "./org/financialRoutes.js";
import bidRoutes from "./org/bidRoutes.js";
import jobRoutes from "./org/jobRoutes.js";
import clientRoutes from "./org/clientRoutes.js";
import propertyRoutes from "./org/propertyRoutes.js";
import payrollRoutes from "./org/payrollRoutes.js";
import compensationRoutes from "./org/compensationRoutes.js";
import capacityRoutes from "./org/capacityRoutes.js";
import inventoryRoutes from "./org/inventoryRoutes.js";
import complianceRoutes from "./org/complianceRoutes.js";
import fleetRoutes from "./org/fleetRoutes.js";
import dispatchRoutes from "./org/dispatchRoutes.js";
import invoiceRoutes from "./org/invoiceRoutes.js";
import paymentRoutes from "./org/paymentRoutes.js";
import reviewRoutes from "./org/reviewRoutes.js";

const router = Router();

// Mount auth routes - authRoutes should be mounted first to handle public routes
router.use("/auth", authRoutes);
router.use("/auth", userRoutes);
router.use("/auth", roleRoutes);
router.use("/auth/user", uiPermissionsRoutes);

// Mount routers - each router's authenticate middleware will only run for matching routes
router.use("/org", departmentRoutes);
router.use("/org", positionRoutes);
router.use("/org", employeeRoutes);
router.use("/org", expenseRoutes);
router.use("/org", timesheetRoutes);
router.use("/org", financialRoutes);
router.use("/org", bidRoutes);
router.use("/org", jobRoutes);
router.use("/org", clientRoutes);
router.use("/org", propertyRoutes);
router.use("/org/payroll", payrollRoutes);
router.use("/org/compensation", compensationRoutes);
router.use("/org/capacity", capacityRoutes);
router.use("/org/inventory", inventoryRoutes);
router.use("/org/compliance", complianceRoutes);
router.use("/org/fleet", fleetRoutes);
router.use("/org/dispatch", dispatchRoutes);
router.use("/org/invoices", invoiceRoutes);
router.use("/org/payments", paymentRoutes);
router.use("/org/reviews", reviewRoutes);

export default router;
