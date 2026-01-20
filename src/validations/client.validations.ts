import { z } from "zod";

// Helper function to convert string numbers to integers or undefined
const stringToIntOrUndefined = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    const num = typeof val === "string" ? parseInt(val, 10) : val;
    return isNaN(num) ? undefined : num;
  });

// Contact validation schema
const contactSchema = z.object({
  fullName: z
    .string()
    .min(1, "Contact full name is required and cannot be empty")
    .max(150, "Contact full name is too long (maximum 150 characters)")
    .trim(),
  title: z
    .string()
    .max(100, "Contact title is too long (maximum 100 characters)")
    .optional(),
  email: z
    .string()
    .email("Please provide a valid email address (e.g., john@example.com)")
    .max(150, "Email address is too long (maximum 150 characters)")
    .trim(),
  phone: z
    .string()
    .max(20, "Phone number is too long (maximum 20 characters)")
    .optional(),
  mobilePhone: z
    .string()
    .max(20, "Mobile phone number is too long (maximum 20 characters)")
    .optional(),
  picture: z
    .union([
      z
        .string()
        .url("Profile picture must be a valid URL")
        .max(500, "Profile picture URL is too long"),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  contactType: z
    .enum(["primary", "billing", "technical", "emergency", "project_manager"])
    .default("primary"),
  isPrimary: z
    .union([z.boolean(), z.string()])
    .transform((val) =>
      typeof val === "string" ? val === "true" || val === "1" : val
    )
    .pipe(z.boolean())
    .default(false),
  preferredContactMethod: z
    .string()
    .max(50, "Preferred contact method is too long")
    .optional(),
  notes: z.string().optional(),
});

// Property validation schema
const propertySchema = z.object({
  propertyName: z
    .string()
    .min(1, "Property name is required and cannot be empty")
    .max(255, "Property name is too long (maximum 255 characters)")
    .trim(),
  propertyType: z
    .string()
    .max(100, "Property type is too long (maximum 100 characters)")
    .trim()
    .optional(),
  addressLine1: z
    .string()
    .min(1, "Property address is required and cannot be empty")
    .max(255, "Property address is too long (maximum 255 characters)")
    .trim(),
  addressLine2: z
    .string()
    .max(255, "Property address line 2 is too long (maximum 255 characters)")
    .optional(),
  city: z
    .string()
    .min(1, "Property city is required and cannot be empty")
    .max(100, "Property city is too long (maximum 100 characters)")
    .trim(),
  state: z
    .string()
    .min(1, "Property state is required and cannot be empty")
    .max(50, "Property state is too long (maximum 50 characters)")
    .trim(),
  zipCode: z
    .string()
    .min(1, "Property ZIP code is required and cannot be empty")
    .max(20, "Property ZIP code is too long (maximum 20 characters)")
    .trim(),
  numberOfUnits: z.string().optional(),
});

// Client validation schemas
export const createClientSchema = z.object({
  body: z.object({
    // Basic Details (Step 1)
    name: z
      .string()
      .min(1, "Company name is required and cannot be empty")
      .max(255, "Company name is too long (maximum 255 characters)")
      .trim(),
    legalName: z
      .string()
      .max(255, "Legal name is too long (maximum 255 characters)")
      .optional(),
    clientTypeId: stringToIntOrUndefined
      .pipe(
        z
          .number()
          .int("Client type must be a whole number")
          .positive("Client type must be a positive number")
          .optional()
      )
      .optional(),
    industryClassificationId: stringToIntOrUndefined
      .pipe(
        z
          .number()
          .int("Industry classification must be a whole number")
          .positive("Industry classification must be a positive number")
          .optional()
      )
      .optional(),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .default("medium")
      .optional(),
    numberOfEmployees: stringToIntOrUndefined
      .pipe(
        z
          .number()
          .int("Number of employees must be a whole number")
          .positive("Number of employees must be a positive number")
          .optional()
      )
      .optional(),
    website: z
      .string()
      .url("Website must be a valid URL (e.g., https://example.com)")
      .max(255, "Website URL is too long (maximum 255 characters)")
      .optional()
      .or(z.literal("")),
    companyLogo: z.string().url("Company logo must be a valid URL").optional(), // URL after upload

    // Address Information
    streetAddress: z
      .string()
      .max(255, "Street address is too long (maximum 255 characters)")
      .optional(),
    city: z
      .string()
      .max(100, "City is too long (maximum 100 characters)")
      .optional(),
    state: z
      .string()
      .max(50, "State is too long (maximum 50 characters)")
      .optional(),
    zipCode: z
      .string()
      .max(20, "ZIP code is too long (maximum 20 characters)")
      .optional(),

    // Contacts (Step 2)
    contacts: z
      .union([z.array(contactSchema), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(contactSchema))
      .optional(),

    // Properties (Step 3)
    properties: z
      .union([z.array(propertySchema), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(propertySchema))
      .optional(),

    // Settings (Step 4)
    paymentTerms: z
      .string()
      .max(100, "Payment terms is too long (maximum 100 characters)")
      .optional(),
    preferredPaymentMethod: z
      .string()
      .max(50, "Preferred payment method is too long (maximum 50 characters)")
      .optional(),
    creditLimit: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Credit limit must be a valid number")
      .optional()
      .or(z.literal("")),
    billingContactId: z
      .string()
      .uuid("Billing contact ID must be a valid ID")
      .optional()
      .or(z.literal("")),
    taxExempt: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .default(false),
    status: z
      .enum(["active", "inactive", "prospect", "suspended", "archived"])
      .default("active"),

    // Additional fields
    taxId: z
      .string()
      .max(50, "Tax ID is too long (maximum 50 characters)")
      .optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(z.string()))
      .optional(),
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
    clientTypeId: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int().positive())
      .optional(),
    industryClassificationId: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int().positive())
      .optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    numberOfEmployees: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int().positive())
      .optional(),
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
    companyLogo: z.union([z.string().url(), z.null()]).optional(),

    // Settings
    paymentTerms: z.string().max(100).optional(),
    preferredPaymentMethod: z.string().max(50).optional(),
    creditLimit: z.string().optional(),
    billingContactId: z.string().uuid().optional(),
    taxExempt: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
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
export const getClientContactsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
});

export const getClientContactByIdSchema = z.object({
  params: z.object({
    contactId: z.string().uuid("Invalid contact ID"),
  }),
});

export const createClientContactSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    fullName: z.string().min(1, "Full name is required").max(150),
    title: z.string().max(100).optional(),
    email: z.string().email().max(150).optional(),
    phone: z.string().max(20).optional(),
    mobilePhone: z.string().max(20).optional(),
    // picture is extracted from the uploaded file and DigitalOcean upload result
    // It should not be provided in the request body when uploading a file
    picture: z
      .union([
        z.string().url("Invalid picture URL").max(500),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    contactType: z
      .enum(["primary", "billing", "technical", "emergency", "project_manager"])
      .default("primary"),
    isPrimary: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .default(false),
    preferredContactMethod: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

export const updateClientContactSchema = z.object({
  params: z.object({
    contactId: z.string().uuid("Invalid contact ID"),
  }),
  body: z.object({
    fullName: z.string().min(1).max(150).optional(),
    title: z.string().max(100).optional(),
    email: z.string().email().max(150).optional(),
    phone: z.string().max(20).optional(),
    mobilePhone: z.string().max(20).optional(),
    // picture is extracted from the uploaded file and DigitalOcean upload result
    // It should not be provided in the request body when uploading a file
    picture: z
      .union([
        z.string().url("Invalid picture URL").max(500),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    contactType: z
      .enum(["primary", "billing", "technical", "emergency", "project_manager"])
      .optional(),
    isPrimary: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
    preferredContactMethod: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

export const deleteClientContactSchema = z.object({
  params: z.object({
    contactId: z.string().uuid("Invalid contact ID"),
  }),
});

// Client Note validation schemas
export const getClientNotesSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 20)),
  }),
});

export const getClientNoteByIdSchema = z.object({
  params: z.object({
    noteId: z.string().uuid("Invalid note ID"),
  }),
});

export const createClientNoteSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    noteType: z.string().max(50).optional(),
    subject: z.string().max(255).optional(),
    content: z.string().min(1, "Note content is required"),
  }),
});

export const updateClientNoteSchema = z.object({
  params: z.object({
    noteId: z.string().uuid("Invalid note ID"),
  }),
  body: z.object({
    noteType: z.string().max(50).optional(),
    subject: z.string().max(255).optional(),
    content: z.string().min(1).optional(),
  }),
});

export const deleteClientNoteSchema = z.object({
  params: z.object({
    noteId: z.string().uuid("Invalid note ID"),
  }),
});

// Client Document validation schemas
export const getClientDocumentsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 50)),
  }),
});

export const createClientDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
  body: z.object({
    // fileName and filePath are extracted from the uploaded file and DigitalOcean upload result
    // They should not be provided in the request body
    fileName: z.string().min(1, "File name is required").max(255).optional(),
    filePath: z.string().min(1, "File path is required").max(500).optional(),
    // fileType is extracted from the uploaded file's mimetype
    // It should not be provided in the request body
    fileType: z.string().max(50).optional(),
    // fileSize is extracted from the uploaded file's size
    // It should not be provided in the request body
    fileSize: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number())
      .optional(),
    categoryIds: z
      .union([z.array(z.number().int().positive()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(z.number().int().positive()))
      .optional(),
    description: z.string().optional(),
  }),
});

export const updateClientDocumentSchema = z.object({
  params: z.object({
    documentId: z.string().uuid("Invalid document ID"),
  }),
  body: z.object({
    fileName: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    categoryIds: z
      .union([z.array(z.number().int().positive()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(z.number().int().positive()))
      .optional(),
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
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .default(0)
      .optional(),
  }),
});

export const getDocumentCategoryByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, "Document category ID must be a number")
      .transform((val) => parseInt(val)),
  }),
});

export const updateDocumentCategorySchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, "Document category ID must be a number")
      .transform((val) => parseInt(val)),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code")
      .optional(),
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .optional(),
    isActive: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
  }),
});

export const deleteDocumentCategorySchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, "Document category ID must be a number")
      .transform((val) => parseInt(val)),
  }),
});

export const assignDocumentCategoriesSchema = z.object({
  params: z.object({
    documentId: z.string().uuid("Invalid document ID"),
  }),
  body: z.object({
    categoryIds: z
      .union([z.array(z.number().int().positive()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      })
      .pipe(z.array(z.number().int().positive())),
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
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .default(0)
      .optional(),
  }),
});

// Client Type validation schemas
export const createClientTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().optional(),
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .default(0)
      .optional(),
  }),
});

export const getClientTypeByIdSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
  }),
});

export const updateClientTypeSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .optional(),
    isActive: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
  }),
});

// Industry Classification validation schemas
export const createIndustryClassificationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150),
    code: z.string().max(20).optional(),
    description: z.string().optional(),
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .default(0)
      .optional(),
  }),
});

export const getIndustryClassificationByIdSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val)),
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
    sortOrder: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int())
      .optional(),
    isActive: z
      .union([z.boolean(), z.string()])
      .transform((val) =>
        typeof val === "string" ? val === "true" || val === "1" : val
      )
      .pipe(z.boolean())
      .optional(),
  }),
});

// Client Settings validation schemas
export const getClientSettingsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
});

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
      billingDay: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().min(1).max(31))
        .optional(), // Day of month (1-31)
      taxExempt: z
        .union([z.boolean(), z.string()])
        .transform((val) =>
          typeof val === "string" ? val === "true" || val === "1" : val
        )
        .pipe(z.boolean())
        .optional(), // Tax exemption status
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one setting field must be provided",
    }),
});
