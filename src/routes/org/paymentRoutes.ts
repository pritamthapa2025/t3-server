import { Router } from "express";
import { z } from "zod";
import * as paymentController from "../../controllers/PaymentController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getPaymentsQuerySchema,
  getPaymentByIdQuerySchema,
  createPaymentSchema,
  updatePaymentSchema,
  processPaymentSchema,
  markPaymentClearedSchema,
  createPaymentAllocationSchema,
  updatePaymentAllocationSchema,
  getPaymentSummaryQuerySchema,
} from "../../validations/invoicing.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== PAYMENT ROUTES ====================

// Get payments (list) with pagination and filters
router.get(
  "/",
  validate(z.object({ query: getPaymentsQuerySchema })),
  paymentController.getPayments
);

// Get payment summary report
router.get(
  "/summary",
  validate(z.object({ query: getPaymentSummaryQuerySchema })),
  paymentController.getPaymentSummary
);

// Get payment by ID
router.get(
  "/:id",
  validate(z.object({ 
    query: getPaymentByIdQuerySchema,
    params: z.object({ id: z.string().uuid() })
  })),
  paymentController.getPaymentById
);

// Create new payment
router.post(
  "/",
  validate(createPaymentSchema),
  paymentController.createPayment
);

// Update payment
router.put(
  "/:id",
  validate(z.object({
    ...updatePaymentSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  paymentController.updatePayment
);

// Delete payment (soft delete)
router.delete(
  "/:id",
  validate(z.object({
    params: z.object({ id: z.string().uuid() })
  })),
  paymentController.deletePayment
);

// Process payment
router.post(
  "/:id/process",
  validate(z.object({
    ...processPaymentSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  paymentController.processPayment
);

// Mark payment as cleared
router.post(
  "/:id/clear",
  validate(z.object({
    ...markPaymentClearedSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  paymentController.markPaymentAsCleared
);

// ==================== PAYMENT ALLOCATION ROUTES ====================

// Get payment allocations
router.get(
  "/:paymentId/allocations",
  validate(z.object({
    params: z.object({ paymentId: z.string().uuid() })
  })),
  paymentController.getPaymentAllocations
);

// Create payment allocation
router.post(
  "/:paymentId/allocations",
  validate(z.object({
    ...createPaymentAllocationSchema.shape,
    params: z.object({ paymentId: z.string().uuid() })
  })),
  paymentController.createPaymentAllocation
);

// Update payment allocation
router.put(
  "/:paymentId/allocations/:allocationId",
  validate(z.object({
    ...updatePaymentAllocationSchema.shape,
    params: z.object({ 
      paymentId: z.string().uuid(),
      allocationId: z.string().uuid()
    })
  })),
  paymentController.updatePaymentAllocation
);

// Delete payment allocation
router.delete(
  "/:paymentId/allocations/:allocationId",
  validate(z.object({
    params: z.object({ 
      paymentId: z.string().uuid(),
      allocationId: z.string().uuid()
    })
  })),
  paymentController.deletePaymentAllocation
);

export default router;















