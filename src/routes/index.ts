import { Router } from "express";
import authRoutes from "./auth/authRoutes.js";
import userRoutes from "./auth/userRoutes.js";
import departmentRoutes from "./org/departmentRoutes.js";
import positionRoutes from "./org/positionRoutes.js";
import employeeRoutes from "./org/employeeRoutes.js";
import timesheetRoutes from "./org/timesheetRoutes.js";
import financialRoutes from "./org/financialRoutes.js";

const router = Router();

router.use("/auth", authRoutes, userRoutes);
router.use("/org", departmentRoutes, positionRoutes, employeeRoutes, timesheetRoutes, financialRoutes);

export default router;
