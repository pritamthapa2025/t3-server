import { z } from "zod";

// Property validation schemas
export const createPropertySchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Invalid organization ID"),
    propertyName: z.string().min(1, "Property name is required").max(255),
    propertyCode: z.string().max(50).optional(),
    propertyType: z.enum([
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
    ]),
    status: z
      .enum(["active", "inactive", "under_construction", "archived"])
      .default("active"),
    addressLine1: z.string().min(1, "Address is required").max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(1, "City is required").max(100),
    state: z.string().min(1, "State is required").max(50),
    zipCode: z.string().min(1, "Zip code is required").max(20),
    country: z.string().max(100).default("USA"),
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
    propertyName: z.string().min(1).max(255).optional(),
    propertyCode: z.string().max(50).optional(),
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
    status: z
      .enum(["active", "inactive", "under_construction", "archived"])
      .optional(),
    addressLine1: z.string().min(1).max(255).optional(),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().min(1).max(50).optional(),
    zipCode: z.string().min(1).max(20).optional(),
    country: z.string().max(100).optional(),
    squareFootage: z.string().optional(),
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
    fullName: z.string().min(1, "Full name is required").max(150),
    title: z.string().max(100).optional(),
    email: z.string().email().max(150).optional(),
    phone: z.string().max(20).optional(),
    mobilePhone: z.string().max(20).optional(),
    contactType: z.string().max(50).optional(),
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
    equipmentTag: z.string().max(100).optional(),
    equipmentType: z.string().min(1, "Equipment type is required").max(100),
    location: z.string().max(255).optional(),
    make: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serialNumber: z.string().max(100).optional(),
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
    fileName: z.string().min(1, "File name is required").max(255),
    filePath: z.string().min(1, "File path is required").max(500),
    fileType: z.string().max(50).optional(),
    fileSize: z.number().min(0, "File size must be non-negative").optional(),
    documentType: z.string().max(50).optional(),
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
    serviceDate: z.string().min(1, "Service date is required"), // Date as string (YYYY-MM-DD)
    serviceType: z.string().max(100).optional(),
    description: z.string().optional(),
  }),
});
