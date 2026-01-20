import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });
const numericStringSchema = z.string().regex(/^\d+(\.\d+)?$/, {
  message: "Must be a valid number (e.g., 100 or 99.99)",
});

// ============================
// Enum Schemas
// ============================

const inventoryStockStatusEnum = z.enum([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "on_order",
  "discontinued",
]);

const inventoryTransactionTypeEnum = z.enum([
  "receipt",
  "issue",
  "adjustment",
  "transfer",
  "return",
  "write_off",
  "initial_stock",
]);

const inventoryAllocationStatusEnum = z.enum([
  "allocated",
  "issued",
  "partially_used",
  "fully_used",
  "returned",
  "cancelled",
]);

const purchaseOrderStatusEnum = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "partially_received",
  "received",
  "cancelled",
  "closed",
]);

const countTypeEnum = z.enum(["full", "cycle", "spot"]);
const countStatusEnum = z.enum([
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

// ============================
// Inventory Items Validations
// ============================

export const getInventoryItemsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    category: z.string().optional(),
    status: inventoryStockStatusEnum.optional(),
    supplier: uuidSchema.optional(),
    location: uuidSchema.optional(),
    allocationStatus: z.enum(["allocated", "available"]).optional(),
    search: z.string().optional(),
    sortBy: z
      .enum(["name", "itemCode", "quantity", "value", "createdAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getInventoryItemByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createInventoryItemSchema = z.object({
  body: z.object({
    itemCode: z
      .string()
      .min(1, "Item code is required and cannot be empty")
      .max(100, "Item code is too long (maximum 100 characters)")
      .trim(),
    name: z
      .string()
      .min(1, "Item name is required and cannot be empty")
      .max(255, "Item name is too long (maximum 255 characters)")
      .trim(),
    description: z.string().optional(),
    categoryId: z
      .number()
      .int("Category ID must be a whole number")
      .positive("Category ID is required and must be a positive number"),
    primarySupplierId: uuidSchema.optional(),
    unitOfMeasureId: z
      .number()
      .int("Unit of measure ID must be a whole number")
      .positive("Unit of measure ID is required and must be a positive number"),
    unitCost: numericStringSchema,
    sellingPrice: numericStringSchema.optional(),
    quantityOnHand: numericStringSchema.optional().default("0"),
    reorderLevel: numericStringSchema.optional().default("0"),
    reorderQuantity: numericStringSchema.optional(),
    maxStockLevel: numericStringSchema.optional(),
    primaryLocationId: uuidSchema.optional(),
    manufacturer: z.string().max(150).optional(),
    modelNumber: z.string().max(100).optional(),
    partNumber: z.string().max(100).optional(),
    barcode: z.string().max(100).optional(),
    weight: numericStringSchema.optional(),
    weightUnit: z.string().max(20).optional(),
    dimensions: z.string().max(100).optional(),
    specifications: z.any().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    trackBySerialNumber: z.boolean().optional().default(false),
    trackByBatch: z.boolean().optional().default(false),
    notes: z.string().optional(),
  }),
});

export const updateInventoryItemSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    itemCode: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    categoryId: z.number().int().positive().optional(),
    primarySupplierId: uuidSchema.optional(),
    unitOfMeasureId: z.number().int().positive().optional(),
    unitCost: numericStringSchema.optional(),
    sellingPrice: numericStringSchema.optional(),
    reorderLevel: numericStringSchema.optional(),
    reorderQuantity: numericStringSchema.optional(),
    maxStockLevel: numericStringSchema.optional(),
    primaryLocationId: uuidSchema.optional(),
    manufacturer: z.string().max(150).optional(),
    modelNumber: z.string().max(100).optional(),
    partNumber: z.string().max(100).optional(),
    barcode: z.string().max(100).optional(),
    weight: numericStringSchema.optional(),
    weightUnit: z.string().max(20).optional(),
    dimensions: z.string().max(100).optional(),
    specifications: z.any().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    trackBySerialNumber: z.boolean().optional(),
    trackByBatch: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteInventoryItemSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Transaction Validations
// ============================

export const getInventoryTransactionsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    itemId: uuidSchema.optional(),
    transactionType: inventoryTransactionTypeEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
  }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    itemId: uuidSchema,
    locationId: uuidSchema.optional(),
    transactionType: inventoryTransactionTypeEnum,
    quantity: numericStringSchema,
    unitCost: numericStringSchema.optional(),
    purchaseOrderId: uuidSchema.optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    fromLocationId: uuidSchema.optional(),
    toLocationId: uuidSchema.optional(),
    batchNumber: z.string().max(100).optional(),
    serialNumber: z.string().max(100).optional(),
    expirationDate: z.string().optional(),
    referenceNumber: z.string().max(100).optional(),
    notes: z.string().optional(),
  }),
});

// ============================
// Allocation Validations
// ============================

export const getAllocationsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    itemId: uuidSchema.optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    status: inventoryAllocationStatusEnum.optional(),
  }),
});

export const createAllocationSchema = z.object({
  body: z
    .object({
      itemId: uuidSchema,
      jobId: uuidSchema.optional(),
      bidId: uuidSchema.optional(),
      quantityAllocated: numericStringSchema,
      expectedUseDate: z.string().optional(),
      notes: z.string().optional(),
    })
    .refine((data) => data.jobId || data.bidId, {
      message: "Either a job ID or bid ID must be provided for the allocation",
    }),
});

export const updateAllocationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    quantityAllocated: numericStringSchema.optional(),
    quantityUsed: numericStringSchema.optional(),
    quantityReturned: numericStringSchema.optional(),
    actualUseDate: z.string().optional(),
    status: inventoryAllocationStatusEnum.optional(),
    notes: z.string().optional(),
  }),
});

export const issueAllocationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const returnAllocationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    quantityReturned: numericStringSchema,
    notes: z.string().optional(),
  }),
});

// ============================
// Purchase Order Validations
// ============================

export const getPurchaseOrdersQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    status: purchaseOrderStatusEnum.optional(),
    supplierId: uuidSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const getPurchaseOrderByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: uuidSchema,
    orderDate: z.string(),
    expectedDeliveryDate: z.string().optional(),
    shipToLocationId: uuidSchema.optional(),
    shippingAddress: z.string().optional(),
    paymentTerms: z.string().max(100).optional(),
    notes: z.string().optional(),
    items: z
      .array(
        z.object({
          itemId: uuidSchema,
          quantityOrdered: numericStringSchema,
          unitCost: numericStringSchema,
          expectedDeliveryDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .min(1, "At least one item must be included in the purchase order"),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    expectedDeliveryDate: z.string().optional(),
    actualDeliveryDate: z.string().optional(),
    shipToLocationId: uuidSchema.optional(),
    shippingAddress: z.string().optional(),
    trackingNumber: z.string().max(100).optional(),
    paymentTerms: z.string().max(100).optional(),
    supplierInvoiceNumber: z.string().max(100).optional(),
    notes: z.string().optional(),
  }),
});

export const approvePurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          itemId: uuidSchema,
          quantityReceived: numericStringSchema,
          actualDeliveryDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .min(1, "At least one item must be included in the receipt"),
    locationId: uuidSchema.optional(),
  }),
});

// ============================
// Supplier Validations
// ============================

export const getSuppliersQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    isActive: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    isPreferred: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    search: z.string().optional(),
  }),
});

export const createSupplierSchema = z.object({
  body: z.object({
    supplierCode: z
      .string()
      .max(50, "Supplier code is too long (maximum 50 characters)")
      .optional(),
    name: z
      .string()
      .min(1, "Supplier name is required and cannot be empty")
      .max(255, "Supplier name is too long (maximum 255 characters)")
      .trim(),
    legalName: z.string().max(255).optional(),
    contactName: z.string().max(150).optional(),
    email: z
      .string()
      .email(
        "Please provide a valid email address (e.g., supplier@example.com)"
      )
      .max(150, "Email address is too long (maximum 150 characters)")
      .trim()
      .optional(),
    phone: z.string().max(20).optional(),
    website: z.string().max(255).optional(),
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional().default("USA"),
    taxId: z.string().max(50).optional(),
    accountNumber: z.string().max(100).optional(),
    paymentTerms: z.string().max(100).optional(),
    creditLimit: numericStringSchema.optional(),
    rating: numericStringSchema.optional(),
    leadTimeDays: z.number().int().optional(),
    isPreferred: z.boolean().optional().default(false),
    notes: z.string().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    supplierCode: z.string().max(50).optional(),
    name: z.string().min(1).max(255).optional(),
    legalName: z.string().max(255).optional(),
    contactName: z.string().max(150).optional(),
    email: z
      .string()
      .email(
        "Please provide a valid email address (e.g., supplier@example.com)"
      )
      .max(150, "Email address is too long (maximum 150 characters)")
      .trim()
      .optional(),
    phone: z.string().max(20).optional(),
    website: z.string().max(255).optional(),
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    taxId: z.string().max(50).optional(),
    accountNumber: z.string().max(100).optional(),
    paymentTerms: z.string().max(100).optional(),
    creditLimit: numericStringSchema.optional(),
    rating: numericStringSchema.optional(),
    leadTimeDays: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isPreferred: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

// ============================
// Location Validations
// ============================

export const getLocationsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    locationType: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  }),
});

export const createLocationSchema = z.object({
  body: z.object({
    locationCode: z
      .string()
      .max(50, "Location code is too long (maximum 50 characters)")
      .optional(),
    name: z
      .string()
      .min(1, "Location name is required and cannot be empty")
      .max(255, "Location name is too long (maximum 255 characters)")
      .trim(),
    locationType: z.string().max(50).optional(),
    parentLocationId: uuidSchema.optional(),
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    capacity: numericStringSchema.optional(),
    capacityUnit: z.string().max(20).optional(),
    managerId: uuidSchema.optional(),
    accessInstructions: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateLocationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    locationCode: z.string().max(50).optional(),
    name: z.string().min(1).max(255).optional(),
    locationType: z.string().max(50).optional(),
    parentLocationId: uuidSchema.optional(),
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    capacity: numericStringSchema.optional(),
    capacityUnit: z.string().max(20).optional(),
    managerId: uuidSchema.optional(),
    accessInstructions: z.string().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

// ============================
// Category Validations
// ============================

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Category name is required and cannot be empty")
      .max(100, "Category name is too long (maximum 100 characters)")
      .trim(),
    description: z.string().optional(),
    code: z.string().max(20).optional(),
    color: z.string().max(7).optional(),
    icon: z.string().max(100).optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    code: z.string().max(20).optional(),
    color: z.string().max(7).optional(),
    icon: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const deleteCategorySchema = z.object({
  params: z.object({
    id: z.number().int().positive(),
  }),
});

// ============================
// Unit of Measure Validations
// ============================

export const deleteUnitSchema = z.object({
  params: z.object({
    id: z.number().int().positive(),
  }),
});

// ============================
// Alert Validations
// ============================

export const acknowledgeAlertSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const resolveAlertSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    resolutionNotes: z.string().optional(),
  }),
});

// ============================
// Physical Count Validations
// ============================

export const createCountSchema = z.object({
  body: z.object({
    countType: countTypeEnum,
    locationId: uuidSchema.optional(),
    countDate: z.string(),
    notes: z.string().optional(),
  }),
});

export const updateCountSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: countStatusEnum.optional(),
    notes: z.string().optional(),
  }),
});

export const recordCountItemSchema = z.object({
  params: z.object({
    countId: uuidSchema,
    itemId: uuidSchema,
  }),
  body: z.object({
    countedQuantity: numericStringSchema,
    notes: z.string().optional(),
  }),
});

// ============================
// Purchase Order Workflow Validations
// ============================

export const sendPurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const cancelPurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const closePurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const receivePartialPurchaseOrderSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          itemId: uuidSchema,
          quantityReceived: numericStringSchema,
          actualDeliveryDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .min(1, "At least one item must be received"),
    locationId: uuidSchema.optional(),
    trackingNumber: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
  }),
});

// PO Line Item Validations
export const addPurchaseOrderItemSchema = z.object({
  params: z.object({
    id: uuidSchema, // PO ID
  }),
  body: z.object({
    itemId: uuidSchema,
    quantityOrdered: numericStringSchema,
    unitCost: numericStringSchema,
    expectedDeliveryDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updatePurchaseOrderItemSchema = z.object({
  params: z.object({
    id: uuidSchema, // PO Item ID
  }),
  body: z.object({
    quantityOrdered: numericStringSchema.optional(),
    unitCost: numericStringSchema.optional(),
    expectedDeliveryDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const deletePurchaseOrderItemSchema = z.object({
  params: z.object({
    id: uuidSchema, // PO Item ID
  }),
});

// ============================
// Common Validations
// ============================

export const uuidParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});


