/**
 * Client/Organization Types
 * Comprehensive type definitions for client-related data structures
 */

// ============================
// Enum Types
// ============================

export type ClientStatus = 
  | "active" 
  | "inactive" 
  | "prospect" 
  | "suspended" 
  | "archived";

export type ClientPriority = 
  | "low" 
  | "medium" 
  | "high" 
  | "critical";

export type ContactType = 
  | "primary" 
  | "billing" 
  | "technical" 
  | "emergency" 
  | "project_manager";

export type PropertyStatus = 
  | "active" 
  | "inactive" 
  | "maintenance" 
  | "sold";

export type PropertyType = 
  | "residential" 
  | "commercial" 
  | "industrial" 
  | "mixed_use" 
  | "warehouse";

// ============================
// Base Entity Types
// ============================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface BaseReferenceEntity {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Client/Organization Types
// ============================

export interface Client extends BaseEntity {
  clientId: string;
  name: string;
  legalName?: string;
  clientTypeId?: number;
  status: ClientStatus;
  priority?: ClientPriority;
  logo?: string;
  
  // Business Info
  industryClassificationId?: number;
  taxId?: string;
  website?: string;
  numberOfEmployees?: number;
  
  // Address Information
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Financial
  creditLimit?: string; // Stored as string for precision
  paymentTerms?: string;
  preferredPaymentMethod?: string;
  
  // Billing Contact
  billingContactId?: string;
  billingDay?: number;
  taxExempt: boolean;
  
  // Additional Info
  description?: string;
  notes?: string;
  tags?: Record<string, any>;
  
  // Metadata
  createdBy?: string;
}

export interface ClientWithRelations extends Client {
  clientType?: ClientType;
  industryClassification?: IndustryClassification;
  contacts?: ClientContact[];
  properties?: Property[];
}

// ============================
// Client Contact Types
// ============================

export interface ClientContact extends BaseEntity {
  organizationId: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  picture?: string;
  contactType: ContactType;
  isPrimary: boolean;
  preferredContactMethod?: string;
  notes?: string;
}

// ============================
// Client Notes Types
// ============================

export interface ClientNote extends BaseEntity {
  organizationId: string;
  noteType?: string; // call, meeting, email, general
  subject?: string;
  content: string;
  createdBy: string;
}

// ============================
// Client Documents Types
// ============================

export interface ClientDocument extends BaseEntity {
  organizationId: string;
  fileName: string;
  filePath: string;
  fileType?: string | null;
  fileSize?: number | null;
  description?: string | null;
  uploadedBy: string;
  categories?: DocumentCategory[];
}

export interface DocumentCategory extends BaseReferenceEntity {
  color?: string; // Hex color code
}

export interface ClientDocumentCategory {
  id: string;
  documentId: string;
  categoryId: number;
  createdAt: Date;
}

// ============================
// Reference Data Types
// ============================

export interface ClientType extends BaseReferenceEntity {}

export interface IndustryClassification extends BaseReferenceEntity {
  code?: string;
}

// ============================
// Property Types
// ============================

export interface Property extends BaseEntity {
  organizationId: string;
  propertyName: string;
  propertyCode?: string;
  propertyType: string;
  status: PropertyStatus;
  
  // Address
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  
  // Property Details
  squareFootage?: string;
  numberOfFloors?: number;
  numberOfUnits?: string;
  yearBuilt?: number;
  
  // Access Information
  accessInstructions?: string;
  gateCode?: string;
  parkingInstructions?: string;
  
  // Operating Hours
  operatingHours?: Record<string, any>;
  
  // Geo Location
  latitude?: string;
  longitude?: string;
  
  // Additional Info
  description?: string;
  notes?: string;
  tags?: Record<string, any>;
  
  // Metadata
  createdBy?: string;
}

// ============================
// Client Settings Types
// ============================

export interface ClientSettings {
  id: string;
  creditLimit?: string;
  paymentTerms?: string;
  preferredPaymentMethod?: string;
  billingContactId?: string;
  billingDay?: number;
  taxExempt?: boolean;
  notifications?: {
    email: boolean;
    sms: boolean;
  };
  preferences?: {
    currency: string;
    timezone: string;
  };
  updatedAt?: Date;
}

// ============================
// API Request/Response Types
// ============================

export interface CreateClientRequest {
  name: string;
  legalName?: string;
  clientTypeId?: number;
  industryClassificationId?: number;
  priority?: ClientPriority;
  numberOfEmployees?: number;
  website?: string;
  companyLogo?: string;
  
  // Address Information
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Settings
  paymentTerms?: string;
  preferredPaymentMethod?: string;
  creditLimit?: string;
  billingContactId?: string;
  taxExempt?: boolean;
  status?: ClientStatus;
  
  // Additional fields
  taxId?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  
  // Related entities
  contacts?: CreateContactRequest[];
  properties?: CreatePropertyRequest[];
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {
  id?: never; // Prevent id in update request
}

export interface CreateContactRequest {
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  picture?: string;
  contactType?: ContactType;
  isPrimary?: boolean;
  preferredContactMethod?: string;
  notes?: string;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {
  id?: never; // Prevent id in update request
}

export interface CreatePropertyRequest {
  propertyName: string;
  propertyType?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  numberOfUnits?: string;
}

export interface CreateNoteRequest {
  noteType?: string;
  subject?: string;
  content: string;
}

export interface UpdateNoteRequest extends Partial<CreateNoteRequest> {
  id?: never; // Prevent id in update request
}

export interface CreateDocumentRequest {
  fileName?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  description?: string;
  categoryIds?: number[];
}

export interface UpdateDocumentRequest {
  fileName?: string;
  description?: string;
  categoryIds?: number[];
}

// ============================
// Filter and Query Types
// ============================

export interface ClientFilters {
  type?: string; // Client Type ID as string
  status?: string | string[];
  search?: string;
  tags?: string[];
}

export interface ClientQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClientStatus;
  clientTypeId?: number;
  priority?: ClientPriority;
}

// ============================
// Pagination Types
// ============================

export interface PaginationInfo {
  page?: number;
  limit?: number;
  offset?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagination: PaginationInfo;
}

// ============================
// API Response Types
// ============================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  suggestions?: string[];
  technicalDetails?: string;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  message: string;
  errorCode?: string;
  suggestions?: string[];
  technicalDetails?: string;
}

export interface ApiSuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// ============================
// Dashboard and KPI Types
// ============================

export interface ClientKPIs {
  totalClients: number;
  activeClients: number;
  pendingOrders: number;
  totalRevenue: string;
  newThisMonth: number;
}

export interface ClientDashboard {
  totalClients: number;
  totalProspects: number;
  totalActiveClients: number;
  totalRevenue: string;
  recentClients: Client[];
  clientsByStatus: Array<{
    status: ClientStatus;
    count: number;
  }>;
  clientsByType: Array<{
    typeName: string;
    count: number;
  }>;
}

// ============================
// File Upload Types
// ============================

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

// ============================
// Validation Types
// ============================

export interface ValidationError {
  field: string;
  value: any;
  message: string;
}

export interface UniqueFieldCheck {
  field: string;
  value: any;
  checkFunction: () => Promise<boolean>;
  message: string;
}

// ============================
// Database Query Result Types
// ============================

/** Primary contact summary for list views */
export interface ClientListPrimaryContact {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Financial summary for list views */
export interface ClientListFinancial {
  totalPaid: number;
  totalOutstanding: number;
}

export interface ClientQueryResult {
  organization: Client;
  clientType?: ClientType;
  /** Enriched for list: primary contact (when available) */
  primaryContact?: ClientListPrimaryContact | null;
  /** Enriched for list: count of active jobs */
  activeJobs?: number;
  /** Enriched for list: paid and outstanding totals */
  financial?: ClientListFinancial | null;
}

export interface ClientListResult {
  data: ClientQueryResult[];
  total: number;
  pagination: {
    offset: number;
    limit: number;
    totalPages: number;
  };
}

export interface ContactListResult {
  contacts: ClientContact[];
  totalCount: number;
}

export interface DocumentListResult {
  documents: ClientDocument[];
  totalCount: number;
}

export interface NoteListResult {
  notes: ClientNote[];
  totalCount: number;
}

// ============================
// Export all types for easy importing
// ============================

export type {
  // Re-export commonly used types for convenience
  Client as Organization, // Legacy alias
  CreateClientRequest as CreateOrganizationRequest,
  UpdateClientRequest as UpdateOrganizationRequest,
  ClientQueryResult as OrganizationQueryResult,
};
