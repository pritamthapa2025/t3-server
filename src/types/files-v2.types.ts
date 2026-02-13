/**
 * Files Module V2 Types - Hierarchical Structure
 * Complete redesign for organized file access
 */

export type FileSourceTable =
  | "bid_documents"
  | "bid_media"
  | "bid_plan_spec"
  | "bid_design_build"
  | "vehicle_documents"
  | "vehicle_media"
  | "client_documents"
  | "property_documents"
  | "invoice_documents"
  | "payment_documents"
  | "employee_documents";

export interface BaseFileInfo {
  id: string;
  fileName: string;
  filePath: string;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  source: FileSourceTable;
  sourceId: string; // bidId, vehicleId, organizationId, etc.
  sourceName?: string | null;
  uploadedBy: string;
  uploadedByName?: string | null;
  isStarred: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
}

// Quick Access Types
export interface RecentFilesResponse {
  files: BaseFileInfo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StarredFilesResponse {
  files: BaseFileInfo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Bids Types
export interface BidFilesByOrganization {
  organizationId: string;
  organizationName: string;
  clientId: string;
  fileCount: number;
  files: BaseFileInfo[];
}

export interface BidsFilesResponse {
  organizations: BidFilesByOrganization[];
  totalOrganizations: number;
  totalFiles: number;
}

// Jobs Types
export interface JobFilesByOrganization {
  organizationId: string;
  organizationName: string;
  clientId: string;
  fileCount: number;
  files: BaseFileInfo[];
}

export interface JobsFilesResponse {
  organizations: JobFilesByOrganization[];
  totalOrganizations: number;
  totalFiles: number;
}

// Clients Types
export interface ClientInvoiceFile extends BaseFileInfo {
  invoiceId?: string;
  invoiceNumber?: string;
  organizationId: string;
  organizationName: string;
}

export interface ClientDocumentFile extends BaseFileInfo {
  organizationId: string;
  organizationName: string;
  propertyId?: string | null;
  propertyName?: string | null;
}

export interface ClientInvoicesResponse {
  files: ClientInvoiceFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ClientDocumentsResponse {
  files: ClientDocumentFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Employee Documents Types
export interface EmployeeDocumentFile extends BaseFileInfo {
  employeeId: number;
  employeeName: string | null;
  employeeNumber: string | null;
  documentType?: string | null;
  expirationDate?: string | null;
}

export interface EmployeeDocumentsResponse {
  files: EmployeeDocumentFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Fleet Types
export interface FleetDocumentFile extends BaseFileInfo {
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  documentType?: string | null;
}

export interface FleetMediaFile extends BaseFileInfo {
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  thumbnailUrl?: string | null;
}

export interface FleetDocumentsResponse {
  files: FleetDocumentFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FleetMediaResponse {
  files: FleetMediaFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Pagination Parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Toggle Star Request
export interface ToggleStarRequest {
  fileId: string;
  source: FileSourceTable;
  isStarred: boolean;
}
