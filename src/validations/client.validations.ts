import { z } from "zod";

// Contact validation schema
const contactSchema = z.object({
  fullName: z.string().min(1, "Contact name is required").max(150),
  title: z.string().max(100).optional(),
  email: z.string().email("Invalid email address").max(150), // Required in UI
  phone: z.string().max(20).optional(),
  mobilePhone: z.string().max(20).optional(),
  contactType: z.enum(["primary", "billing", "technical", "emergency", "project_manager"]).default("primary"),
  isPrimary: z.boolean().default(false),
  preferredContactMethod: z.string().max(50).optional(),
  notes: z.string().optional(),
});

// Property validation schema
const propertySchema = z.object({
  propertyName: z.string().min(1, "Property name is required").max(255),
  propertyType: z.enum(["commercial", "industrial", "residential", "healthcare", "education", "hospitality", "retail", "warehouse", "government", "mixed_use"]).optional(),
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
    industryClassification: z.string().min(1, "Industry is required").max(100),
    clientType: z.enum(["direct", "subcontractor", "government", "property_management", "corporate", "individual"]),
    website: z.string().url("Invalid website URL").max(255).optional().or(z.literal("")),
    companyLogo: z.string().url().optional(), // URL after upload
    
    // Address (Step 1)
    billingAddressLine1: z.string().min(1, "Street address is required").max(255),
    billingAddressLine2: z.string().max(255).optional(),
    billingCity: z.string().min(1, "City is required").max(100),
    billingState: z.string().min(1, "State is required").max(50),
    billingZipCode: z.string().min(1, "Zip code is required").max(20),
    billingCountry: z.string().max(100).default("USA"),
    
    // Contacts (Step 2)
    contacts: z.array(contactSchema).optional(),
    
    // Properties (Step 3)
    properties: z.array(propertySchema).optional(),
    
    // Settings (Step 4)
    paymentTerms: z.string().max(100).optional(), // e.g., "Net 30"
    preferredPaymentMethod: z.string().max(50).optional(), // e.g., "ACH Transfer"
    creditLimit: z.string().optional(), // Numeric as string for precision, e.g., "50000"
    taxExemptStatus: z.boolean().default(false),
    status: z.enum(["active", "inactive", "prospect", "suspended", "archived"]).default("active"), // Priority Level maps to status
    
    // Additional fields
    parentOrganizationId: z.string().uuid().optional(),
    taxId: z.string().max(50).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    accountManager: z.string().uuid().optional(),
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
    industryClassification: z.string().max(100).optional(),
    clientType: z.enum(["direct", "subcontractor", "government", "property_management", "corporate", "individual"]).optional(),
    website: z.string().url("Invalid website URL").max(255).optional().or(z.literal("")),
    companyLogo: z.string().url().optional(),
    
    // Address
    billingAddressLine1: z.string().max(255).optional(),
    billingAddressLine2: z.string().max(255).optional(),
    billingCity: z.string().max(100).optional(),
    billingState: z.string().max(50).optional(),
    billingZipCode: z.string().max(20).optional(),
    billingCountry: z.string().max(100).optional(),
    
    // Settings
    paymentTerms: z.string().max(100).optional(),
    preferredPaymentMethod: z.string().max(50).optional(),
    creditLimit: z.string().optional(),
    taxExemptStatus: z.boolean().optional(),
    status: z.enum(["active", "inactive", "prospect", "suspended", "archived"]).optional(),
    
    // Additional fields
    parentOrganizationId: z.string().uuid().optional(),
    taxId: z.string().max(50).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).or(z.record(z.string(), z.any())).optional(),
    accountManager: z.string().uuid().optional(),
  }),
});

export const getClientByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID"),
  }),
});

export const getClientsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 10),
    search: z.string().optional(),
    status: z.enum(["active", "inactive", "prospect", "suspended", "archived"]).optional(),
    clientType: z.enum(["direct", "subcontractor", "government", "property_management", "corporate", "individual"]).optional(),
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
    contactType: z.enum(["primary", "billing", "technical", "emergency", "project_manager"]).default("primary"),
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
    documentType: z.string().max(50).optional(),
    description: z.string().optional(),
  }),
});


