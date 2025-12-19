import { z } from "zod";

// Property validation schemas
export const createPropertySchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Organization ID must be a valid ID"),
    propertyName: z
      .string()
      .min(1, "Property name is required and cannot be empty")
      .max(255, "Property name is too long (maximum 255 characters)")
      .trim(),
    propertyCode: z
      .string()
      .max(50, "Property code is too long (maximum 50 characters)")
      .optional(),
    propertyType: z
      .string()
      .min(1, "Property type is required")
      .max(100, "Property type is too long (maximum 100 characters)")
      .trim(),
    status: z
      .enum(["active", "inactive", "under_construction", "archived"])
      .default("active"),
    addressLine1: z
      .string()
      .min(1, "Property address is required and cannot be empty")
      .max(255, "Property address is too long (maximum 255 characters)")
      .trim(),
    addressLine2: z
      .string()
      .max(255, "Address line 2 is too long (maximum 255 characters)")
      .optional(),
    city: z
      .string()
      .min(1, "City is required and cannot be empty")
      .max(100, "City is too long (maximum 100 characters)")
      .trim(),
    state: z
      .string()
      .min(1, "State is required and cannot be empty")
      .max(50, "State is too long (maximum 50 characters)")
      .trim(),
    zipCode: z
      .string()
      .min(1, "ZIP code is required and cannot be empty")
      .max(20, "ZIP code is too long (maximum 20 characters)")
      .trim(),
    country: z
      .string()
      .max(100, "Country is too long (maximum 100 characters)")
      .default("USA"),
    squareFootage: z.string().optional(), // Numeric as string for precision
    numberOfFloors: z
      .number()
      .int()
      .min(1, "Must be at least 1 floor")
      .optional(),
    yearBuilt: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 5)
      .optional(),
    accessInstructions: z.string().optional(),
    gateCode: z.string().max(50).optional(),
    parkingInstructions: z.string().optional(),
    operatingHours: z.record(z.string(), z.string()).optional(), // JSON object
    latitude: z.string().optional(), // Numeric as string for precision
    longitude: z.string().optional(), // Numeric as string for precision
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property ID"),
  }),
  body: z.object({
    propertyName: z
      .string()
      .min(1, "Property name cannot be empty")
      .max(255, "Property name is too long (maximum 255 characters)")
      .trim()
      .optional(),
    propertyCode: z
      .string()
      .max(50, "Property code is too long (maximum 50 characters)")
      .optional(),
    propertyType: z
      .string()
      .min(1, "Property type cannot be empty")
      .max(100, "Property type is too long (maximum 100 characters)")
      .trim()
      .optional(),
    status: z
      .enum(["active", "inactive", "under_construction", "archived"])
      .optional(),
    addressLine1: z
      .string()
      .min(1, "Address cannot be empty")
      .max(255, "Address is too long (maximum 255 characters)")
      .trim()
      .optional(),
    addressLine2: z
      .string()
      .max(255, "Address line 2 is too long (maximum 255 characters)")
      .optional(),
    city: z
      .string()
      .min(1, "City cannot be empty")
      .max(100, "City is too long (maximum 100 characters)")
      .trim()
      .optional(),
    state: z
      .string()
      .min(1, "State cannot be empty")
      .max(50, "State is too long (maximum 50 characters)")
      .trim()
      .optional(),
    zipCode: z
      .string()
      .min(1, "ZIP code cannot be empty")
      .max(20, "ZIP code is too long (maximum 20 characters)")
      .trim()
      .optional(),
    country: z
      .string()
      .max(100, "Country is too long (maximum 100 characters)")
      .optional(),
    squareFootage: z.string().optional(),
    numberOfFloors: z
      .number()
      .int("Number of floors must be a whole number")
      .min(1, "Property must have at least 1 floor")
      .optional(),
    yearBuilt: z
      .number()
      .int("Year built must be a whole number")
      .min(1800, "Year built must be 1800 or later")
      .max(new Date().getFullYear() + 5, `Year built cannot be more than ${new Date().getFullYear() + 5}`)
      .optional(),
    accessInstructions: z.string().optional(),
    gateCode: z
      .string()
      .max(50, "Gate code is too long (maximum 50 characters)")
      .optional(),
    parkingInstructions: z.string().optional(),
    operatingHours: z.record(z.string(), z.string()).optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const getPropertyByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property ID"),
  }),
});

export const getPropertiesQuerySchema = z.object({
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
      .enum([
        "active",
        "inactive",
        "under_construction",
        "archived",
        "under_service",
        "Under Service",
      ])
      .optional(),
    propertyType: z.string().max(100).optional(),
    organizationId: z.string().uuid().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
});

export const deletePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property ID"),
  }),
});

// Property Contact validation schemas
export const createPropertyContactSchema = z.object({
  params: z.object({
    propertyId: z.string().uuid("Invalid property ID"),
  }),
  body: z.object({
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
      .trim()
      .optional(),
    phone: z
      .string()
      .max(20, "Phone number is too long (maximum 20 characters)")
      .optional(),
    mobilePhone: z
      .string()
      .max(20, "Mobile phone number is too long (maximum 20 characters)")
      .optional(),
    contactType: z
      .string()
      .max(50, "Contact type is too long (maximum 50 characters)")
      .optional(),
    isPrimary: z.boolean().default(false),
    availableHours: z.string().max(255).optional(),
    notes: z.string().optional(),
  }),
});

// Property Equipment validation schemas
export const createPropertyEquipmentSchema = z.object({
  params: z.object({
    propertyId: z.string().uuid("Invalid property ID"),
  }),
  body: z.object({
    equipmentTag: z
      .string()
      .max(100, "Equipment tag is too long (maximum 100 characters)")
      .optional(),
    equipmentType: z
      .string()
      .min(1, "Equipment type is required and cannot be empty")
      .max(100, "Equipment type is too long (maximum 100 characters)")
      .trim(),
    location: z
      .string()
      .max(255, "Location is too long (maximum 255 characters)")
      .optional(),
    make: z
      .string()
      .max(100, "Make is too long (maximum 100 characters)")
      .optional(),
    model: z
      .string()
      .max(100, "Model is too long (maximum 100 characters)")
      .optional(),
    serialNumber: z
      .string()
      .max(100, "Serial number is too long (maximum 100 characters)")
      .optional(),
    installDate: z.string().optional(), // Date as string (YYYY-MM-DD)
    warrantyExpiration: z.string().optional(), // Date as string (YYYY-MM-DD)
    capacity: z.string().max(100).optional(),
    voltagePhase: z.string().max(50).optional(),
    specifications: z.record(z.string(), z.any()).optional(), // JSON object
    status: z.string().max(50).default("active"),
    condition: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

// Property Document validation schemas
export const createPropertyDocumentSchema = z.object({
  params: z.object({
    propertyId: z.string().uuid("Invalid property ID"),
  }),
  body: z.object({
    fileName: z
      .string()
      .min(1, "File name is required and cannot be empty")
      .max(255, "File name is too long (maximum 255 characters)"),
    filePath: z
      .string()
      .min(1, "File path is required and cannot be empty")
      .max(500, "File path is too long (maximum 500 characters)"),
    fileType: z
      .string()
      .max(50, "File type is too long (maximum 50 characters)")
      .optional(),
    fileSize: z
      .number()
      .min(0, "File size cannot be negative")
      .optional(),
    documentType: z
      .string()
      .max(50, "Document type is too long (maximum 50 characters)")
      .optional(),
    description: z.string().optional(),
  }),
});

// Service History validation schemas
export const createServiceHistorySchema = z.object({
  params: z.object({
    propertyId: z.string().uuid("Invalid property ID"),
  }),
  body: z.object({
    jobId: z.string().uuid().optional(),
    bidId: z.string().uuid().optional(),
    serviceDate: z
      .string()
      .min(1, "Service date is required and cannot be empty")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Service date must be in YYYY-MM-DD format (e.g., 2024-01-15)"),
    serviceType: z
      .string()
      .max(100, "Service type is too long (maximum 100 characters)")
      .optional(),
    description: z.string().optional(),
  }),
});
