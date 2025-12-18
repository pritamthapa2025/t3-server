import { z } from "zod";

// Contact validation schema
const contactSchema = z.object({
  fullName: z.string().min(1, "Contact name is required").max(150),
  title: z.string().max(100).optional(),
  email: z.string().email("Invalid email address").max(150), // Required in UI
  phone: z.string().max(20).optional(),
  mobilePhone: z.string().max(20).optional(),
  picture: z
    .string()
    .url("Invalid picture URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  contactType: z
    .enum(["primary", "billing", "technical", "emergency", "project_manager"])
    .default("primary"),
  isPrimary: z.boolean().default(false),
  preferredContactMethod: z.string().max(50).optional(),
  notes: z.string().optional(),
});

// Property validation schema
const propertySchema = z.object({
  propertyName: z.string().min(1, "Property name is required").max(255),
  propertyType: z
    .enum([
      "commercial",
      "industrial",
      "residential",
      "healthcare",
      "education",
      "hospitality",
      "retail",
      "warehouse",
      "government",
      "mixed_use",
    ])
    .optional(),
  addressLine1: z.string().min(1, "Address is required").max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(50),
  zipCode: z.string().min(1, "Zip code is required").max(20),
  numberOfUnits: z.string().optional(), // Can be stored as string or parsed to number
});

// Client validation schemas
export const createClientSchema = z.object({
  body: z.object({
    // Basic Details (Step 1)
    name: z.string().min(1, "Company name is required").max(255),
    legalName: z.string().max(255).optional(),
    clientTypeId: z.number().int().positive().optional(),
    industryClassificationId: z.number().int().positive().optional(),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .default("medium")
      .optional(),
    numberOfEmployees: z.number().int().positive().optional(),
    website: z
      .string()
      .url("Invalid website URL")
      .max(255)
      .optional()
      .or(z.literal("")),
    companyLogo: z.string().url().optional(), // URL after upload

    // Address Information
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),

    // Contacts (Step 2)
    contacts: z.array(contactSchema).optional(),

    // Properties (Step 3)
    properties: z.array(propertySchema).optional(),

    // Settings (Step 4)
    paymentTerms: z.string().max(100).optional(), // e.g., "Net 30"
    preferredPaymentMethod: z.string().max(50).optional(), // e.g., "ACH Transfer"
    creditLimit: z.string().optional(), // Numeric as string for precision, e.g., "50000"
    billingContactId: z.string().uuid().optional(),
    taxExempt: z.boolean().default(false),
    status: z
      .enum(["active", "inactive", "prospect", "suspended", "archived"])
      .default("active"), // Priority Level maps to status

    // Additional fields
    taxId: z.string().max(50).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const updateClientSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    // Basic Details
    name: z.string().min(1).max(255).optional(),
    legalName: z.string().max(255).optional(),
    clientTypeId: z.number().int().positive().optional(),
    industryClassificationId: z.number().int().positive().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    numberOfEmployees: z.number().int().positive().optional(),
    website: z
      .string()
      .url("Invalid website URL")
      .max(255)
      .optional()
      .or(z.literal("")),

    // Address Information
    streetAddress: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    companyLogo: z.string().url().optional(),

    // Settings
    paymentTerms: z.string().max(100).optional(),
    preferredPaymentMethod: z.string().max(50).optional(),
    creditLimit: z.string().optional(),
    billingContactId: z.string().uuid().optional(),
    taxExempt: z.boolean().optional(),
    status: z
      .enum(["active", "inactive", "prospect", "suspended", "archived"])
      .optional(),

    // Additional fields
    taxId: z.string().max(50).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).or(z.record(z.string(), z.any())).optional(),
  }),
});

export const getClientByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
});

export const getClientsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 10)),
    search: z.string().optional(),
    status: z
      .enum(["active", "inactive", "prospect", "suspended", "archived"])
      .optional(),
    clientTypeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : undefined)),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  }),
});

export const deleteClientSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
});

// Client Contact validation schemas
export const createClientContactSchema = z.object({
  params: z.object({
    clientId: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    fullName: z.string().min(1, "Full name is required").max(150),
    title: z.string().max(100).optional(),
    email: z.string().email().max(150).optional(),
    phone: z.string().max(20).optional(),
    mobilePhone: z.string().max(20).optional(),
    picture: z
      .string()
      .url("Invalid picture URL")
      .max(500)
      .optional()
      .or(z.literal("")),
    contactType: z
      .enum(["primary", "billing", "technical", "emergency", "project_manager"])
      .default("primary"),
    isPrimary: z.boolean().default(false),
    preferredContactMethod: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

// Client Note validation schemas
export const createClientNoteSchema = z.object({
  params: z.object({
    clientId: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    noteType: z.string().max(50).optional(),
    subject: z.string().max(255).optional(),
    content: z.string().min(1, "Note content is required"),
  }),
});

// Client Document validation schemas
export const createClientDocumentSchema = z.object({
  params: z.object({
    clientId: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    fileName: z.string().min(1, "File name is required").max(255),
    filePath: z.string().min(1, "File path is required").max(500),
    fileType: z.string().max(50).optional(),
    fileSize: z.number().optional(),
    categoryIds: z.array(z.number().int().positive()).optional(),
    description: z.string().optional(),
  }),
});

// Document Category validation schemas
export const createDocumentCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .optional(),
    sortOrder: z.number().int().default(0).optional(),
  }),
});

export const updateDocumentCategorySchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const assignDocumentCategoriesSchema = z.object({
  params: z.object({
    documentId: z.string().uuid("Invalid document ID"),
  }),
  body: z.object({
    categoryIds: z.array(z.number().int().positive()),
  }),
});

export const createCategoryAndAssignToDocumentSchema = z.object({
  params: z.object({
    clientId: z.string().uuid("Invalid client ID"),
    documentId: z.string().uuid("Invalid document ID"),
  }),
  body: z.object({
    name: z.string().min(1, "Category name is required").max(100),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .optional(),
    sortOrder: z.number().int().default(0).optional(),
  }),
});

// Client Type validation schemas
export const createClientTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().optional(),
    sortOrder: z.number().int().default(0).optional(),
  }),
});

export const updateClientTypeSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Industry Classification validation schemas
export const createIndustryClassificationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150),
    code: z.string().max(20).optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().default(0).optional(),
  }),
});

export const updateIndustryClassificationSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    code: z.string().max(20).optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Client Settings validation schema
export const updateClientSettingsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  body: z
    .object({
      creditLimit: z.string().optional(), // Numeric as string for precision
      paymentTerms: z.string().max(100).optional(), // e.g., "Net 30", "Net 60"
      preferredPaymentMethod: z.string().max(50).optional(), // e.g., "ACH Transfer", "Check"
      billingContactId: z.string().uuid().optional(), // Reference to client contact
      billingDay: z.number().int().min(1).max(31).optional(), // Day of month (1-31)
      taxExempt: z.boolean().optional(), // Tax exemption status
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one setting field must be provided",
    }),
});
