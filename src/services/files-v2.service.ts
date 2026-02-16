/**
 * Files Module V2 Service - Hierarchical File Structure
 * Provides centralized access to files from all modules
 * with organized hierarchical structure for executives
 */

import { eq, and, sql, gte, desc, or, isNull, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import {
  bidDocuments,
  bidMedia,
  bidPlanSpecFiles,
  bidDesignBuildFiles,
  bidsTable,
} from "../drizzle/schema/bids.schema.js";
import {
  vehicleDocuments,
  vehicleMedia,
  vehicles,
} from "../drizzle/schema/fleet.schema.js";
import {
  clientDocuments,
  propertyDocuments,
  organizations,
  properties,
} from "../drizzle/schema/client.schema.js";
import {
  invoiceDocuments,
  paymentDocuments,
  invoices,
} from "../drizzle/schema/invoicing.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
  employeeDocuments,
  employees,
} from "../drizzle/schema/org.schema.js";
import type {
  BaseFileInfo,
  RecentFilesResponse,
  StarredFilesResponse,
  BidsFilesResponse,
  BidFilesByOrganization,
  JobsFilesResponse,
  JobFilesByOrganization,
  ClientInvoicesResponse,
  ClientDocumentsResponse,
  ClientInvoiceFile,
  ClientDocumentFile,
  ClientFilesByOrganization,
  ClientInvoicesGroupedResponse,
  ClientDocumentsGroupedResponse,
  FleetDocumentsResponse,
  FleetMediaResponse,
  FleetDocumentFile,
  FleetMediaFile,
  EmployeeDocumentsResponse,
  EmployeeDocumentFile,
  PaginationParams,
  FileSourceTable,
} from "../types/files-v2.types.js";

/**
 * Get date 14 days ago
 */
function get14DaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date;
}

/**
 * ============================================================================
 * QUICK ACCESS - RECENT FILES (Last 14 Days)
 * ============================================================================
 */
export async function getRecentFiles(
  pagination: PaginationParams = {}
): Promise<RecentFilesResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;
  const fourteenDaysAgo = get14DaysAgo();
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);

  // Fetch recent files from all sources in parallel
  const [
    recentBidDocs,
    recentBidMedia,
    recentBidPlanSpec,
    recentBidDesignBuild,
    recentVehicleDocs,
    recentVehicleMedia,
    recentClientDocs,
    recentPropertyDocs,
    recentInvoiceDocs,
  ] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, sourceId: bidDocuments.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).innerJoin(bidsTable, eq(bidDocuments.bidId, bidsTable.id)).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(and(eq(bidDocuments.isDeleted, false), gte(bidDocuments.createdAt, fourteenDaysAgo))),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, sourceId: bidMedia.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).innerJoin(bidsTable, eq(bidMedia.bidId, bidsTable.id)).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(and(eq(bidMedia.isDeleted, false), gte(bidMedia.createdAt, fourteenDaysAgo))),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, sourceId: bidPlanSpecFiles.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).innerJoin(bidsTable, eq(bidPlanSpecFiles.bidId, bidsTable.id)).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(and(eq(bidPlanSpecFiles.isDeleted, false), gte(bidPlanSpecFiles.createdAt, fourteenDaysAgo))),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, sourceId: bidDesignBuildFiles.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).innerJoin(bidsTable, eq(bidDesignBuildFiles.bidId, bidsTable.id)).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(and(eq(bidDesignBuildFiles.isDeleted, false), gte(bidDesignBuildFiles.createdAt, fourteenDaysAgo))),
    db.select({ id: vehicleDocuments.id, fileName: vehicleDocuments.fileName, filePath: vehicleDocuments.filePath, fileType: vehicleDocuments.fileType, fileSize: vehicleDocuments.fileSize, sourceId: vehicleDocuments.vehicleId, sourceName: vehicles.vehicleId, uploadedBy: vehicleDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleDocuments.isStarred, createdAt: vehicleDocuments.createdAt, updatedAt: vehicleDocuments.updatedAt }).from(vehicleDocuments).innerJoin(vehicles, eq(vehicleDocuments.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleDocuments.uploadedBy, users.id)).where(and(eq(vehicleDocuments.isDeleted, false), gte(vehicleDocuments.createdAt, fourteenDaysAgo))),
    db.select({ id: vehicleMedia.id, fileName: vehicleMedia.name, fileType: vehicleMedia.type, fileSize: sql<number | null>`CAST(${vehicleMedia.size} AS INTEGER)`, sourceId: vehicleMedia.vehicleId, sourceName: vehicles.vehicleId, fileUrl: vehicleMedia.url, uploadedBy: vehicleMedia.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleMedia.isStarred, createdAt: sql<Date>`${vehicleMedia.uploadedDate}`, updatedAt: vehicleMedia.updatedAt }).from(vehicleMedia).innerJoin(vehicles, eq(vehicleMedia.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleMedia.uploadedBy, users.id)).where(and(eq(vehicleMedia.isDeleted, false), gte(vehicleMedia.uploadedDate, fourteenDaysAgoStr))),
    db.select({ id: clientDocuments.id, fileName: clientDocuments.fileName, filePath: clientDocuments.filePath, fileType: clientDocuments.fileType, fileSize: clientDocuments.fileSize, sourceId: clientDocuments.organizationId, sourceName: organizations.name, uploadedBy: clientDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: clientDocuments.isStarred, createdAt: clientDocuments.createdAt, updatedAt: clientDocuments.updatedAt }).from(clientDocuments).innerJoin(organizations, eq(clientDocuments.organizationId, organizations.id)).leftJoin(users, eq(clientDocuments.uploadedBy, users.id)).where(and(eq(clientDocuments.isDeleted, false), gte(clientDocuments.createdAt, fourteenDaysAgo))),
    db.select({ id: propertyDocuments.id, fileName: propertyDocuments.fileName, filePath: propertyDocuments.filePath, fileType: propertyDocuments.fileType, fileSize: propertyDocuments.fileSize, sourceId: propertyDocuments.propertyId, sourceName: properties.propertyName, uploadedBy: propertyDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: propertyDocuments.isStarred, createdAt: propertyDocuments.createdAt, updatedAt: propertyDocuments.updatedAt }).from(propertyDocuments).innerJoin(properties, eq(propertyDocuments.propertyId, properties.id)).leftJoin(users, eq(propertyDocuments.uploadedBy, users.id)).where(and(eq(propertyDocuments.isDeleted, false), gte(propertyDocuments.createdAt, fourteenDaysAgo))),
    db.select({ id: invoiceDocuments.id, fileName: invoiceDocuments.fileName, filePath: invoiceDocuments.filePath, fileType: invoiceDocuments.fileType, fileSize: invoiceDocuments.fileSize, sourceId: invoiceDocuments.invoiceId, sourceName: invoices.invoiceNumber, uploadedBy: invoiceDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: invoiceDocuments.isStarred, createdAt: invoiceDocuments.createdAt }).from(invoiceDocuments).innerJoin(invoices, eq(invoiceDocuments.invoiceId, invoices.id)).leftJoin(users, eq(invoiceDocuments.uploadedBy, users.id)).where(and(eq(invoiceDocuments.isDeleted, false), gte(invoiceDocuments.createdAt, fourteenDaysAgo))),
  ]);

  const allFiles: BaseFileInfo[] = [
    ...recentBidDocs.map((f) => ({ ...f, source: "bid_documents" as const, fileUrl: null, isStarred: f.isStarred ?? false })),
    ...recentBidMedia.map((f) => ({ ...f, source: "bid_media" as const, filePath: f.filePath || "", isStarred: f.isStarred ?? false })),
    ...recentBidPlanSpec.map((f) => ({ ...f, source: "bid_plan_spec" as const, fileUrl: null, updatedAt: null, isStarred: f.isStarred ?? false })),
    ...recentBidDesignBuild.map((f) => ({ ...f, source: "bid_design_build" as const, fileUrl: null, fileType: null, updatedAt: null, isStarred: f.isStarred ?? false })),
    ...recentVehicleDocs.map((f) => ({ ...f, source: "vehicle_documents" as const, fileUrl: null, isStarred: f.isStarred ?? false })),
    ...recentVehicleMedia.map((f) => ({ ...f, source: "vehicle_media" as const, filePath: "", isStarred: f.isStarred ?? false })),
    ...recentClientDocs.map((f) => ({ ...f, source: "client_documents" as const, fileUrl: null, isStarred: f.isStarred ?? false })),
    ...recentPropertyDocs.map((f) => ({ ...f, source: "property_documents" as const, fileUrl: null, isStarred: f.isStarred ?? false })),
    ...recentInvoiceDocs.map((f) => ({ ...f, source: "invoice_documents" as const, fileUrl: null, updatedAt: null, isStarred: f.isStarred ?? false })),
  ].map((f) => ({ ...f, createdAt: new Date((f.createdAt as Date | string | null) ?? 0), updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null }));

  allFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = allFiles.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedFiles = allFiles.slice(offset, offset + limit);

  return { files: paginatedFiles, pagination: { total, page, limit, totalPages } };
}

/**
 * ============================================================================
 * QUICK ACCESS - STARRED FILES (For Executives)
 * ============================================================================
 */
export async function getStarredFiles(pagination: PaginationParams = {}): Promise<StarredFilesResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const [starredBidDocs, starredBidMedia, starredBidPlanSpec, starredBidDesignBuild, starredVehicleDocs, starredVehicleMedia, starredClientDocs, starredPropertyDocs, starredInvoiceDocs] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, sourceId: bidDocuments.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).innerJoin(bidsTable, eq(bidDocuments.bidId, bidsTable.id)).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(and(eq(bidDocuments.isDeleted, false), eq(bidDocuments.isStarred, true))),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, sourceId: bidMedia.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).innerJoin(bidsTable, eq(bidMedia.bidId, bidsTable.id)).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(and(eq(bidMedia.isDeleted, false), eq(bidMedia.isStarred, true))),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, sourceId: bidPlanSpecFiles.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).innerJoin(bidsTable, eq(bidPlanSpecFiles.bidId, bidsTable.id)).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(and(eq(bidPlanSpecFiles.isDeleted, false), eq(bidPlanSpecFiles.isStarred, true))),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, sourceId: bidDesignBuildFiles.bidId, sourceName: bidsTable.bidNumber, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).innerJoin(bidsTable, eq(bidDesignBuildFiles.bidId, bidsTable.id)).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(and(eq(bidDesignBuildFiles.isDeleted, false), eq(bidDesignBuildFiles.isStarred, true))),
    db.select({ id: vehicleDocuments.id, fileName: vehicleDocuments.fileName, filePath: vehicleDocuments.filePath, fileType: vehicleDocuments.fileType, fileSize: vehicleDocuments.fileSize, sourceId: vehicleDocuments.vehicleId, sourceName: vehicles.vehicleId, uploadedBy: vehicleDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleDocuments.isStarred, createdAt: vehicleDocuments.createdAt, updatedAt: vehicleDocuments.updatedAt }).from(vehicleDocuments).innerJoin(vehicles, eq(vehicleDocuments.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleDocuments.uploadedBy, users.id)).where(and(eq(vehicleDocuments.isDeleted, false), eq(vehicleDocuments.isStarred, true))),
    db.select({ id: vehicleMedia.id, fileName: vehicleMedia.name, fileType: vehicleMedia.type, fileSize: sql<number | null>`CAST(${vehicleMedia.size} AS INTEGER)`, sourceId: vehicleMedia.vehicleId, sourceName: vehicles.vehicleId, fileUrl: vehicleMedia.url, uploadedBy: vehicleMedia.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleMedia.isStarred, createdAt: sql<Date>`${vehicleMedia.uploadedDate}`, updatedAt: vehicleMedia.updatedAt }).from(vehicleMedia).innerJoin(vehicles, eq(vehicleMedia.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleMedia.uploadedBy, users.id)).where(and(eq(vehicleMedia.isDeleted, false), eq(vehicleMedia.isStarred, true))),
    db.select({ id: clientDocuments.id, fileName: clientDocuments.fileName, filePath: clientDocuments.filePath, fileType: clientDocuments.fileType, fileSize: clientDocuments.fileSize, sourceId: clientDocuments.organizationId, sourceName: organizations.name, uploadedBy: clientDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: clientDocuments.isStarred, createdAt: clientDocuments.createdAt, updatedAt: clientDocuments.updatedAt }).from(clientDocuments).innerJoin(organizations, eq(clientDocuments.organizationId, organizations.id)).leftJoin(users, eq(clientDocuments.uploadedBy, users.id)).where(and(eq(clientDocuments.isDeleted, false), eq(clientDocuments.isStarred, true))),
    db.select({ id: propertyDocuments.id, fileName: propertyDocuments.fileName, filePath: propertyDocuments.filePath, fileType: propertyDocuments.fileType, fileSize: propertyDocuments.fileSize, sourceId: propertyDocuments.propertyId, sourceName: properties.propertyName, uploadedBy: propertyDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: propertyDocuments.isStarred, createdAt: propertyDocuments.createdAt, updatedAt: propertyDocuments.updatedAt }).from(propertyDocuments).innerJoin(properties, eq(propertyDocuments.propertyId, properties.id)).leftJoin(users, eq(propertyDocuments.uploadedBy, users.id)).where(and(eq(propertyDocuments.isDeleted, false), eq(propertyDocuments.isStarred, true))),
    db.select({ id: invoiceDocuments.id, fileName: invoiceDocuments.fileName, filePath: invoiceDocuments.filePath, fileType: invoiceDocuments.fileType, fileSize: invoiceDocuments.fileSize, sourceId: invoiceDocuments.invoiceId, sourceName: invoices.invoiceNumber, uploadedBy: invoiceDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: invoiceDocuments.isStarred, createdAt: invoiceDocuments.createdAt }).from(invoiceDocuments).innerJoin(invoices, eq(invoiceDocuments.invoiceId, invoices.id)).leftJoin(users, eq(invoiceDocuments.uploadedBy, users.id)).where(and(eq(invoiceDocuments.isDeleted, false), eq(invoiceDocuments.isStarred, true))),
  ]);

  const allFiles: BaseFileInfo[] = [
    ...starredBidDocs.map((f) => ({ ...f, source: "bid_documents" as const, fileUrl: null, isStarred: true })),
    ...starredBidMedia.map((f) => ({ ...f, source: "bid_media" as const, isStarred: true })),
    ...starredBidPlanSpec.map((f) => ({ ...f, source: "bid_plan_spec" as const, fileUrl: null, updatedAt: null, isStarred: true })),
    ...starredBidDesignBuild.map((f) => ({ ...f, source: "bid_design_build" as const, fileUrl: null, fileType: null, updatedAt: null, isStarred: true })),
    ...starredVehicleDocs.map((f) => ({ ...f, source: "vehicle_documents" as const, fileUrl: null, isStarred: true })),
    ...starredVehicleMedia.map((f) => ({ ...f, source: "vehicle_media" as const, filePath: "", isStarred: true })),
    ...starredClientDocs.map((f) => ({ ...f, source: "client_documents" as const, fileUrl: null, isStarred: true })),
    ...starredPropertyDocs.map((f) => ({ ...f, source: "property_documents" as const, fileUrl: null, isStarred: true })),
    ...starredInvoiceDocs.map((f) => ({ ...f, source: "invoice_documents" as const, fileUrl: null, updatedAt: null, isStarred: true })),
  ].map((f) => ({ ...f, createdAt: new Date((f.createdAt as Date | string | null) ?? 0), updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null }));

  allFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = allFiles.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedFiles = allFiles.slice(offset, offset + limit);

  return { files: paginatedFiles, pagination: { total, page, limit, totalPages } };
}

/**
 * ============================================================================
 * TOGGLE STAR STATUS
 * ============================================================================
 */
export async function toggleFileStar(fileId: string, source: FileSourceTable, isStarred: boolean): Promise<boolean> {
  try {
    switch (source) {
      case "bid_documents":
        await db.update(bidDocuments).set({ isStarred }).where(eq(bidDocuments.id, fileId));
        break;
      case "bid_media":
        await db.update(bidMedia).set({ isStarred }).where(eq(bidMedia.id, fileId));
        break;
      case "bid_plan_spec":
        await db.update(bidPlanSpecFiles).set({ isStarred }).where(eq(bidPlanSpecFiles.id, fileId));
        break;
      case "bid_design_build":
        await db.update(bidDesignBuildFiles).set({ isStarred }).where(eq(bidDesignBuildFiles.id, fileId));
        break;
      case "vehicle_documents":
        await db.update(vehicleDocuments).set({ isStarred }).where(eq(vehicleDocuments.id, fileId));
        break;
      case "vehicle_media":
        await db.update(vehicleMedia).set({ isStarred }).where(eq(vehicleMedia.id, fileId));
        break;
      case "client_documents":
        await db.update(clientDocuments).set({ isStarred }).where(eq(clientDocuments.id, fileId));
        break;
      case "property_documents":
        await db.update(propertyDocuments).set({ isStarred }).where(eq(propertyDocuments.id, fileId));
        break;
      case "invoice_documents":
        await db.update(invoiceDocuments).set({ isStarred }).where(eq(invoiceDocuments.id, fileId));
        break;
      case "payment_documents":
        await db.update(paymentDocuments).set({ isStarred }).where(eq(paymentDocuments.id, fileId));
        break;
      case "employee_documents":
        await db.update(employeeDocuments).set({ isStarred }).where(eq(employeeDocuments.id, fileId));
        break;
      default:
        return false;
    }
    return true;
  } catch (error) {
    console.error("Error toggling file star:", error);
    return false;
  }
}

/**
 * ============================================================================
 * BIDS - ACTIVE FILES (Grouped by Organization)
 * ============================================================================
 */
export async function getBidsActiveFiles(): Promise<BidsFilesResponse> {
  // Active = all bids except won or lost (draft, in_progress, etc.)
  const activeBids = await db.select({ bidId: bidsTable.id, organizationId: bidsTable.organizationId, organizationName: organizations.name, clientId: organizations.clientId }).from(bidsTable).innerJoin(organizations, eq(bidsTable.organizationId, organizations.id)).where(and(eq(bidsTable.isDeleted, false), or(isNull(bidsTable.marked), notInArray(bidsTable.marked, ["won", "lost"]))));

  if (activeBids.length === 0) return { organizations: [], totalOrganizations: 0, totalFiles: 0 };

  const [bidDocsFiles, bidMediaFiles, planSpecFiles, designBuildFiles] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, bidId: bidDocuments.bidId, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(eq(bidDocuments.isDeleted, false)),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, bidId: bidMedia.bidId, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(eq(bidMedia.isDeleted, false)),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, bidId: bidPlanSpecFiles.bidId, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(eq(bidPlanSpecFiles.isDeleted, false)),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, bidId: bidDesignBuildFiles.bidId, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(eq(bidDesignBuildFiles.isDeleted, false)),
  ]);

  const orgMap = new Map<string, BidFilesByOrganization>();
  activeBids.forEach((bid) => { if (!orgMap.has(bid.organizationId)) orgMap.set(bid.organizationId, { organizationId: bid.organizationId, organizationName: bid.organizationName, clientId: bid.clientId, fileCount: 0, files: [] }); });

  [...bidDocsFiles.map((f) => ({ ...f, source: "bid_documents" as const, updatedAt: f.updatedAt })), ...bidMediaFiles.map((f) => ({ ...f, source: "bid_media" as const, updatedAt: f.updatedAt })), ...planSpecFiles.map((f) => ({ ...f, source: "bid_plan_spec" as const, updatedAt: null })), ...designBuildFiles.map((f) => ({ ...f, source: "bid_design_build" as const, fileType: null, updatedAt: null }))].forEach((file) => {
    const bid = activeBids.find((b) => b.bidId === file.bidId);
    if (bid) {
      const org = orgMap.get(bid.organizationId);
      if (org) {
        org.files.push({ id: file.id, fileName: file.fileName, filePath: file.filePath, fileUrl: null, fileType: file.fileType, fileSize: file.fileSize, source: file.source, sourceId: file.bidId, sourceName: null, uploadedBy: file.uploadedBy, uploadedByName: file.uploadedByName, isStarred: file.isStarred ?? false, createdAt: new Date((file.createdAt as Date | string) ?? 0), updatedAt: file.updatedAt != null ? new Date(file.updatedAt) : null });
        org.fileCount++;
      }
    }
  });

  return { organizations: Array.from(orgMap.values()), totalOrganizations: orgMap.size, totalFiles: Array.from(orgMap.values()).reduce((sum, org) => sum + org.fileCount, 0) };
}

/**
 * ============================================================================
 * BIDS - WON FILES (Grouped by Organization)
 * ============================================================================
 */
export async function getBidsWonFiles(): Promise<BidsFilesResponse> {
  const wonBids = await db.select({ bidId: bidsTable.id, organizationId: bidsTable.organizationId, organizationName: organizations.name, clientId: organizations.clientId }).from(bidsTable).innerJoin(organizations, eq(bidsTable.organizationId, organizations.id)).where(and(eq(bidsTable.marked, "won"), eq(bidsTable.isDeleted, false)));

  if (wonBids.length === 0) return { organizations: [], totalOrganizations: 0, totalFiles: 0 };

  const [bidDocsFiles, bidMediaFiles, planSpecFiles, designBuildFiles] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, bidId: bidDocuments.bidId, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(eq(bidDocuments.isDeleted, false)),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, bidId: bidMedia.bidId, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(eq(bidMedia.isDeleted, false)),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, bidId: bidPlanSpecFiles.bidId, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(eq(bidPlanSpecFiles.isDeleted, false)),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, bidId: bidDesignBuildFiles.bidId, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(eq(bidDesignBuildFiles.isDeleted, false)),
  ]);

  const orgMap = new Map<string, BidFilesByOrganization>();
  wonBids.forEach((bid) => { if (!orgMap.has(bid.organizationId)) orgMap.set(bid.organizationId, { organizationId: bid.organizationId, organizationName: bid.organizationName, clientId: bid.clientId, fileCount: 0, files: [] }); });

  [...bidDocsFiles.map((f) => ({ ...f, source: "bid_documents" as const, updatedAt: f.updatedAt })), ...bidMediaFiles.map((f) => ({ ...f, source: "bid_media" as const, updatedAt: f.updatedAt })), ...planSpecFiles.map((f) => ({ ...f, source: "bid_plan_spec" as const, updatedAt: null })), ...designBuildFiles.map((f) => ({ ...f, source: "bid_design_build" as const, fileType: null, updatedAt: null }))].forEach((file) => {
    const bid = wonBids.find((b) => b.bidId === file.bidId);
    if (bid) {
      const org = orgMap.get(bid.organizationId);
      if (org) {
        org.files.push({ id: file.id, fileName: file.fileName, filePath: file.filePath, fileUrl: null, fileType: file.fileType, fileSize: file.fileSize, source: file.source, sourceId: file.bidId, sourceName: null, uploadedBy: file.uploadedBy, uploadedByName: file.uploadedByName, isStarred: file.isStarred ?? false, createdAt: new Date((file.createdAt as Date | string) ?? 0), updatedAt: file.updatedAt != null ? new Date(file.updatedAt) : null });
        org.fileCount++;
      }
    }
  });

  return { organizations: Array.from(orgMap.values()), totalOrganizations: orgMap.size, totalFiles: Array.from(orgMap.values()).reduce((sum, org) => sum + org.fileCount, 0) };
}

/**
 * ============================================================================
 * JOBS - ACTIVE FILES (Grouped by Organization)
 * ============================================================================
 */
export async function getJobsActiveFiles(): Promise<JobsFilesResponse> {
  const activeJobs = await db.select({ jobId: jobs.id, bidId: jobs.bidId, organizationId: bidsTable.organizationId, organizationName: organizations.name, clientId: organizations.clientId }).from(jobs).innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id)).innerJoin(organizations, eq(bidsTable.organizationId, organizations.id)).where(and(eq(jobs.status, "in_progress"), eq(jobs.isDeleted, false)));

  if (activeJobs.length === 0) return { organizations: [], totalOrganizations: 0, totalFiles: 0 };

  const [bidDocsFiles, bidMediaFiles, planSpecFiles, designBuildFiles] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, bidId: bidDocuments.bidId, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(eq(bidDocuments.isDeleted, false)),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, bidId: bidMedia.bidId, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(eq(bidMedia.isDeleted, false)),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, bidId: bidPlanSpecFiles.bidId, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(eq(bidPlanSpecFiles.isDeleted, false)),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, bidId: bidDesignBuildFiles.bidId, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(eq(bidDesignBuildFiles.isDeleted, false)),
  ]);

  const orgMap = new Map<string, JobFilesByOrganization>();
  activeJobs.forEach((job) => { if (!orgMap.has(job.organizationId)) orgMap.set(job.organizationId, { organizationId: job.organizationId, organizationName: job.organizationName, clientId: job.clientId, fileCount: 0, files: [] }); });

  [...bidDocsFiles.map((f) => ({ ...f, source: "bid_documents" as const, updatedAt: f.updatedAt })), ...bidMediaFiles.map((f) => ({ ...f, source: "bid_media" as const, updatedAt: f.updatedAt })), ...planSpecFiles.map((f) => ({ ...f, source: "bid_plan_spec" as const, updatedAt: null })), ...designBuildFiles.map((f) => ({ ...f, source: "bid_design_build" as const, fileType: null, updatedAt: null }))].forEach((file) => {
    const job = activeJobs.find((j) => j.bidId === file.bidId);
    if (job) {
      const org = orgMap.get(job.organizationId);
      if (org) {
        org.files.push({ id: file.id, fileName: file.fileName, filePath: file.filePath, fileUrl: null, fileType: file.fileType, fileSize: file.fileSize, source: file.source, sourceId: file.bidId, sourceName: null, uploadedBy: file.uploadedBy, uploadedByName: file.uploadedByName, isStarred: file.isStarred ?? false, createdAt: new Date((file.createdAt as Date | string) ?? 0), updatedAt: file.updatedAt != null ? new Date(file.updatedAt) : null });
        org.fileCount++;
      }
    }
  });

  return { organizations: Array.from(orgMap.values()), totalOrganizations: orgMap.size, totalFiles: Array.from(orgMap.values()).reduce((sum, org) => sum + org.fileCount, 0) };
}

/**
 * ============================================================================
 * JOBS - COMPLETED FILES (Grouped by Organization)
 * ============================================================================
 */
export async function getJobsCompletedFiles(): Promise<JobsFilesResponse> {
  const completedJobs = await db.select({ jobId: jobs.id, bidId: jobs.bidId, organizationId: bidsTable.organizationId, organizationName: organizations.name, clientId: organizations.clientId }).from(jobs).innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id)).innerJoin(organizations, eq(bidsTable.organizationId, organizations.id)).where(and(eq(jobs.status, "completed"), eq(jobs.isDeleted, false)));

  if (completedJobs.length === 0) return { organizations: [], totalOrganizations: 0, totalFiles: 0 };

  const [bidDocsFiles, bidMediaFiles, planSpecFiles, designBuildFiles] = await Promise.all([
    db.select({ id: bidDocuments.id, fileName: bidDocuments.fileName, filePath: bidDocuments.filePath, fileType: bidDocuments.fileType, fileSize: bidDocuments.fileSize, bidId: bidDocuments.bidId, uploadedBy: bidDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: bidDocuments.isStarred, createdAt: bidDocuments.createdAt, updatedAt: bidDocuments.updatedAt }).from(bidDocuments).leftJoin(users, eq(bidDocuments.uploadedBy, users.id)).where(eq(bidDocuments.isDeleted, false)),
    db.select({ id: bidMedia.id, fileName: bidMedia.fileName, filePath: bidMedia.filePath, fileType: bidMedia.fileType, fileSize: bidMedia.fileSize, bidId: bidMedia.bidId, uploadedBy: bidMedia.uploadedBy, uploadedByName: users.fullName, isStarred: bidMedia.isStarred, createdAt: bidMedia.createdAt, updatedAt: bidMedia.updatedAt }).from(bidMedia).leftJoin(users, eq(bidMedia.uploadedBy, users.id)).where(eq(bidMedia.isDeleted, false)),
    db.select({ id: bidPlanSpecFiles.id, fileName: bidPlanSpecFiles.fileName, filePath: bidPlanSpecFiles.filePath, fileType: bidPlanSpecFiles.fileType, fileSize: bidPlanSpecFiles.fileSize, bidId: bidPlanSpecFiles.bidId, uploadedBy: bidPlanSpecFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidPlanSpecFiles.isStarred, createdAt: bidPlanSpecFiles.createdAt }).from(bidPlanSpecFiles).leftJoin(users, eq(bidPlanSpecFiles.uploadedBy, users.id)).where(eq(bidPlanSpecFiles.isDeleted, false)),
    db.select({ id: bidDesignBuildFiles.id, fileName: bidDesignBuildFiles.fileName, filePath: bidDesignBuildFiles.filePath, fileSize: bidDesignBuildFiles.fileSize, bidId: bidDesignBuildFiles.bidId, uploadedBy: bidDesignBuildFiles.uploadedBy, uploadedByName: users.fullName, isStarred: bidDesignBuildFiles.isStarred, createdAt: bidDesignBuildFiles.createdAt }).from(bidDesignBuildFiles).leftJoin(users, eq(bidDesignBuildFiles.uploadedBy, users.id)).where(eq(bidDesignBuildFiles.isDeleted, false)),
  ]);

  const orgMap = new Map<string, JobFilesByOrganization>();
  completedJobs.forEach((job) => { if (!orgMap.has(job.organizationId)) orgMap.set(job.organizationId, { organizationId: job.organizationId, organizationName: job.organizationName, clientId: job.clientId, fileCount: 0, files: [] }); });

  [...bidDocsFiles.map((f) => ({ ...f, source: "bid_documents" as const, updatedAt: f.updatedAt })), ...bidMediaFiles.map((f) => ({ ...f, source: "bid_media" as const, updatedAt: f.updatedAt })), ...planSpecFiles.map((f) => ({ ...f, source: "bid_plan_spec" as const, updatedAt: null })), ...designBuildFiles.map((f) => ({ ...f, source: "bid_design_build" as const, fileType: null, updatedAt: null }))].forEach((file) => {
    const job = completedJobs.find((j) => j.bidId === file.bidId);
    if (job) {
      const org = orgMap.get(job.organizationId);
      if (org) {
        org.files.push({ id: file.id, fileName: file.fileName, filePath: file.filePath, fileUrl: null, fileType: file.fileType, fileSize: file.fileSize, source: file.source, sourceId: file.bidId, sourceName: null, uploadedBy: file.uploadedBy, uploadedByName: file.uploadedByName, isStarred: file.isStarred ?? false, createdAt: new Date((file.createdAt as Date | string) ?? 0), updatedAt: file.updatedAt != null ? new Date(file.updatedAt) : null });
        org.fileCount++;
      }
    }
  });

  return { organizations: Array.from(orgMap.values()), totalOrganizations: orgMap.size, totalFiles: Array.from(orgMap.values()).reduce((sum, org) => sum + org.fileCount, 0) };
}

/**
 * ============================================================================
 * CLIENTS - INVOICES (Flat List)
 * ============================================================================
 */
export async function getClientInvoiceFiles(pagination: PaginationParams = {}): Promise<ClientInvoicesResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const invoiceDocs = await db
    .select({
      id: invoiceDocuments.id,
      fileName: invoiceDocuments.fileName,
      filePath: invoiceDocuments.filePath,
      fileType: invoiceDocuments.fileType,
      fileSize: invoiceDocuments.fileSize,
      invoiceId: invoiceDocuments.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      organizationId: bidsTable.organizationId,
      organizationName: organizations.name,
      uploadedBy: invoiceDocuments.uploadedBy,
      uploadedByName: users.fullName,
      isStarred: invoiceDocuments.isStarred,
      createdAt: invoiceDocuments.createdAt,
    })
    .from(invoiceDocuments)
    .innerJoin(invoices, eq(invoiceDocuments.invoiceId, invoices.id))
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .leftJoin(users, eq(invoiceDocuments.uploadedBy, users.id))
    .where(
      and(
        eq(invoiceDocuments.isDeleted, false),
        eq(invoices.isDeleted, false)
      )
    )
    .orderBy(desc(invoiceDocuments.createdAt));

  const total = invoiceDocs.length;
  const files: ClientInvoiceFile[] = invoiceDocs.slice(offset, offset + limit).map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath, fileUrl: null, fileType: f.fileType, fileSize: f.fileSize, source: "invoice_documents", sourceId: f.invoiceId, sourceName: f.invoiceNumber, invoiceId: f.invoiceId, invoiceNumber: f.invoiceNumber, organizationId: f.organizationId ?? "", organizationName: f.organizationName ?? "", uploadedBy: f.uploadedBy, uploadedByName: f.uploadedByName, isStarred: f.isStarred ?? false, createdAt: new Date((f.createdAt as Date | string) ?? 0), updatedAt: null }));

  return { files, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * ============================================================================
 * CLIENTS - INVOICES (Grouped by Organization)
 * ============================================================================
 */
export async function getClientInvoiceFilesGroupedByOrg(): Promise<ClientInvoicesGroupedResponse> {
  // Use raw SQL to avoid any Drizzle schema/join quirks; org comes from invoice -> job -> bid -> organization
  type Row = {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    invoice_id: string;
    invoice_number: string | null;
    organization_id: string | null;
    organization_name: string | null;
    client_id: string | null;
    uploaded_by: string;
    uploaded_by_name: string | null;
    is_starred: boolean | null;
    created_at: Date;
  };
  const result = await db.execute<Row>(sql`
    SELECT
      id.id,
      id.file_name,
      id.file_path,
      id.file_type,
      id.file_size,
      id.invoice_id,
      i.invoice_number,
      b.organization_id,
      o.name AS organization_name,
      o.client_id,
      id.uploaded_by,
      u.full_name AS uploaded_by_name,
      id.is_starred,
      id.created_at
    FROM org.invoice_documents id
    LEFT JOIN org.invoices i ON id.invoice_id = i.id AND i.is_deleted = false
    LEFT JOIN org.jobs j ON i.job_id = j.id AND j.is_deleted = false
    LEFT JOIN org.bids b ON j.bid_id = b.id AND b.is_deleted = false
    LEFT JOIN org.organizations o ON b.organization_id = o.id
    LEFT JOIN auth.users u ON id.uploaded_by = u.id
    WHERE id.is_deleted = false
    ORDER BY id.created_at DESC
  `);
  const invoiceDocs: Row[] = Array.isArray(result) ? result : (result as { rows: Row[] }).rows ?? [];
  const orgMap = new Map<string, ClientFilesByOrganization>();
  for (const f of invoiceDocs) {
    const orgId = f.organization_id ?? "";
    const orgName = f.organization_name ?? "";
    const clientId = f.client_id ?? "";
    if (!orgMap.has(orgId)) {
      orgMap.set(orgId, { organizationId: orgId, organizationName: orgName, clientId, fileCount: 0, files: [] });
    }
    const org = orgMap.get(orgId)!;
    org.files.push({
      id: f.id,
      fileName: f.file_name,
      filePath: f.file_path,
      fileUrl: null,
      fileType: f.file_type,
      fileSize: f.file_size,
      source: "invoice_documents",
      sourceId: f.invoice_id,
      sourceName: f.invoice_number ?? "",
      uploadedBy: f.uploaded_by,
      uploadedByName: f.uploaded_by_name,
      isStarred: f.is_starred ?? false,
      createdAt: new Date(f.created_at),
      updatedAt: null,
    });
    org.fileCount++;
  }
  const organizationsList = Array.from(orgMap.values());
  const totalFiles = organizationsList.reduce((sum, o) => sum + o.fileCount, 0);
  return { organizations: organizationsList, totalOrganizations: organizationsList.length, totalFiles };
}

/**
 * ============================================================================
 * CLIENTS - DOCUMENTS (Flat List)
 * ============================================================================
 */
export async function getClientDocumentFiles(pagination: PaginationParams = {}): Promise<ClientDocumentsResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const [clientDocs, propertyDocs] = await Promise.all([
    db.select({ id: clientDocuments.id, fileName: clientDocuments.fileName, filePath: clientDocuments.filePath, fileType: clientDocuments.fileType, fileSize: clientDocuments.fileSize, organizationId: clientDocuments.organizationId, organizationName: organizations.name, uploadedBy: clientDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: clientDocuments.isStarred, createdAt: clientDocuments.createdAt, updatedAt: clientDocuments.updatedAt }).from(clientDocuments).innerJoin(organizations, eq(clientDocuments.organizationId, organizations.id)).leftJoin(users, eq(clientDocuments.uploadedBy, users.id)).where(eq(clientDocuments.isDeleted, false)),
    db.select({ id: propertyDocuments.id, fileName: propertyDocuments.fileName, filePath: propertyDocuments.filePath, fileType: propertyDocuments.fileType, fileSize: propertyDocuments.fileSize, organizationId: properties.organizationId, organizationName: organizations.name, propertyId: propertyDocuments.propertyId, propertyName: properties.propertyName, uploadedBy: propertyDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: propertyDocuments.isStarred, createdAt: propertyDocuments.createdAt, updatedAt: propertyDocuments.updatedAt }).from(propertyDocuments).innerJoin(properties, eq(propertyDocuments.propertyId, properties.id)).innerJoin(organizations, eq(properties.organizationId, organizations.id)).leftJoin(users, eq(propertyDocuments.uploadedBy, users.id)).where(eq(propertyDocuments.isDeleted, false)),
  ]);

  const allDocs = [...clientDocs.map((f) => ({ ...f, propertyId: null, propertyName: null, source: "client_documents" as const })), ...propertyDocs.map((f) => ({ ...f, source: "property_documents" as const }))].sort((a, b) => new Date((b.createdAt as Date | string) ?? 0).getTime() - new Date((a.createdAt as Date | string) ?? 0).getTime());

  const total = allDocs.length;
  const files: ClientDocumentFile[] = allDocs.slice(offset, offset + limit).map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath, fileUrl: null, fileType: f.fileType, fileSize: f.fileSize, source: f.source, sourceId: f.propertyId || f.organizationId, sourceName: f.propertyName || f.organizationName, organizationId: f.organizationId, organizationName: f.organizationName, propertyId: f.propertyId, propertyName: f.propertyName, uploadedBy: f.uploadedBy, uploadedByName: f.uploadedByName, isStarred: f.isStarred ?? false, createdAt: new Date((f.createdAt as Date | string) ?? 0), updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null }));

  return { files, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * ============================================================================
 * CLIENTS - DOCUMENTS (Grouped by Organization)
 * ============================================================================
 */
export async function getClientDocumentFilesGroupedByOrg(): Promise<ClientDocumentsGroupedResponse> {
  const [clientDocs, propertyDocs] = await Promise.all([
    db.select({ id: clientDocuments.id, fileName: clientDocuments.fileName, filePath: clientDocuments.filePath, fileType: clientDocuments.fileType, fileSize: clientDocuments.fileSize, organizationId: clientDocuments.organizationId, organizationName: organizations.name, clientId: organizations.clientId, uploadedBy: clientDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: clientDocuments.isStarred, createdAt: clientDocuments.createdAt, updatedAt: clientDocuments.updatedAt }).from(clientDocuments).innerJoin(organizations, eq(clientDocuments.organizationId, organizations.id)).leftJoin(users, eq(clientDocuments.uploadedBy, users.id)).where(eq(clientDocuments.isDeleted, false)),
    db.select({ id: propertyDocuments.id, fileName: propertyDocuments.fileName, filePath: propertyDocuments.filePath, fileType: propertyDocuments.fileType, fileSize: propertyDocuments.fileSize, organizationId: properties.organizationId, organizationName: organizations.name, clientId: organizations.clientId, propertyId: propertyDocuments.propertyId, propertyName: properties.propertyName, uploadedBy: propertyDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: propertyDocuments.isStarred, createdAt: propertyDocuments.createdAt, updatedAt: propertyDocuments.updatedAt }).from(propertyDocuments).innerJoin(properties, eq(propertyDocuments.propertyId, properties.id)).innerJoin(organizations, eq(properties.organizationId, organizations.id)).leftJoin(users, eq(propertyDocuments.uploadedBy, users.id)).where(eq(propertyDocuments.isDeleted, false)),
  ]);
  type DocRow = { id: string; fileName: string; filePath: string; fileType: string | null; fileSize: number | null; organizationId: string; organizationName: string; clientId: string; uploadedBy: string; uploadedByName: string | null; isStarred: boolean | null; createdAt: Date; updatedAt: Date | null; propertyId?: string; propertyName?: string | null };
  const withSource = (row: DocRow, source: "client_documents" | "property_documents", sourceId: string, sourceName: string | null) => ({ row, source, sourceId, sourceName });
  const merged: { row: DocRow; source: "client_documents" | "property_documents"; sourceId: string; sourceName: string | null }[] = [
    ...clientDocs.map((r) => withSource(r as DocRow, "client_documents", r.organizationId, r.organizationName)),
    ...(propertyDocs as DocRow[]).map((r) => withSource(r, "property_documents", r.propertyId ?? r.organizationId, r.propertyName ?? r.organizationName)),
  ].sort((a, b) => new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime());

  const orgMap = new Map<string, ClientFilesByOrganization>();
  for (const { row: f, source, sourceId, sourceName } of merged) {
    const orgId = f.organizationId ?? "";
    const orgName = f.organizationName ?? "";
    const clientId = f.clientId ?? "";
    if (!orgMap.has(orgId)) {
      orgMap.set(orgId, { organizationId: orgId, organizationName: orgName, clientId, fileCount: 0, files: [] });
    }
    const org = orgMap.get(orgId)!;
    org.files.push({
      id: f.id,
      fileName: f.fileName,
      filePath: f.filePath,
      fileUrl: null,
      fileType: f.fileType,
      fileSize: f.fileSize,
      source,
      sourceId,
      sourceName,
      uploadedBy: f.uploadedBy,
      uploadedByName: f.uploadedByName ?? null,
      isStarred: f.isStarred ?? false,
      createdAt: new Date(f.createdAt),
      updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null,
    });
    org.fileCount++;
  }
  const organizationsList = Array.from(orgMap.values());
  const totalFiles = organizationsList.reduce((sum, o) => sum + o.fileCount, 0);
  return { organizations: organizationsList, totalOrganizations: organizationsList.length, totalFiles };
}

/**
 * ============================================================================
 * FLEET - DOCUMENTS (Flat List)
 * ============================================================================
 */
export async function getFleetDocumentFiles(pagination: PaginationParams = {}): Promise<FleetDocumentsResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const docs = await db.select({ id: vehicleDocuments.id, fileName: vehicleDocuments.fileName, filePath: vehicleDocuments.filePath, fileType: vehicleDocuments.fileType, fileSize: vehicleDocuments.fileSize, vehicleId: vehicleDocuments.vehicleId, vehicleNumber: vehicles.vehicleId, vehicleName: sql<string>`CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model})`, documentType: vehicleDocuments.documentType, uploadedBy: vehicleDocuments.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleDocuments.isStarred, createdAt: vehicleDocuments.createdAt, updatedAt: vehicleDocuments.updatedAt }).from(vehicleDocuments).innerJoin(vehicles, eq(vehicleDocuments.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleDocuments.uploadedBy, users.id)).where(eq(vehicleDocuments.isDeleted, false)).orderBy(desc(vehicleDocuments.createdAt));

  const total = docs.length;
  const files: FleetDocumentFile[] = docs.slice(offset, offset + limit).map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath, fileUrl: null, fileType: f.fileType, fileSize: f.fileSize, source: "vehicle_documents", sourceId: f.vehicleId, sourceName: f.vehicleNumber, vehicleId: f.vehicleId, vehicleName: f.vehicleName, vehicleNumber: f.vehicleNumber, documentType: f.documentType, uploadedBy: f.uploadedBy, uploadedByName: f.uploadedByName, isStarred: f.isStarred ?? false, createdAt: new Date((f.createdAt as Date | string) ?? 0), updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null }));

  return { files, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * ============================================================================
 * FLEET - MEDIA (Flat List)
 * ============================================================================
 */
export async function getFleetMediaFiles(pagination: PaginationParams = {}): Promise<FleetMediaResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const media = await db.select({ id: vehicleMedia.id, fileName: vehicleMedia.name, fileType: vehicleMedia.type, fileSize: sql<number | null>`CAST(${vehicleMedia.size} AS INTEGER)`, vehicleId: vehicleMedia.vehicleId, vehicleNumber: vehicles.vehicleId, vehicleName: sql<string>`CONCAT(${vehicles.year}, ' ', ${vehicles.make}, ' ', ${vehicles.model})`, fileUrl: vehicleMedia.url, thumbnailUrl: vehicleMedia.thumbnailUrl, uploadedBy: vehicleMedia.uploadedBy, uploadedByName: users.fullName, isStarred: vehicleMedia.isStarred, createdAt: sql<Date>`${vehicleMedia.uploadedDate}`, updatedAt: vehicleMedia.updatedAt }).from(vehicleMedia).innerJoin(vehicles, eq(vehicleMedia.vehicleId, vehicles.id)).leftJoin(users, eq(vehicleMedia.uploadedBy, users.id)).where(eq(vehicleMedia.isDeleted, false)).orderBy(desc(vehicleMedia.uploadedDate));

  const total = media.length;
  const files: FleetMediaFile[] = media.slice(offset, offset + limit).map((f) => ({ id: f.id, fileName: f.fileName, filePath: "", fileUrl: f.fileUrl, fileType: f.fileType, fileSize: f.fileSize, source: "vehicle_media", sourceId: f.vehicleId, sourceName: f.vehicleNumber, vehicleId: f.vehicleId, vehicleName: f.vehicleName, vehicleNumber: f.vehicleNumber, thumbnailUrl: f.thumbnailUrl, uploadedBy: f.uploadedBy, uploadedByName: f.uploadedByName, isStarred: f.isStarred ?? false, createdAt: new Date((f.createdAt as Date | string) ?? 0), updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null }));

  return { files, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * ============================================================================
 * EMPLOYEES - DOCUMENTS (Flat List with Employee Info)
 * ============================================================================
 */
const employeeUserAlias = alias(users, "employee_user");
const uploadedByUserAlias = alias(users, "uploaded_by_user");

export async function getEmployeeDocumentFiles(
  pagination: PaginationParams = {}
): Promise<EmployeeDocumentsResponse> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const offset = (page - 1) * limit;

  const docs = await db
    .select({
      id: employeeDocuments.id,
      fileName: employeeDocuments.fileName,
      filePath: employeeDocuments.filePath,
      fileType: employeeDocuments.fileType,
      fileSize: employeeDocuments.fileSize,
      employeeId: employeeDocuments.employeeId,
      employeeNumber: employees.employeeId,
      employeeName: employeeUserAlias.fullName,
      documentType: employeeDocuments.documentType,
      expirationDate: employeeDocuments.expirationDate,
      uploadedBy: employeeDocuments.uploadedBy,
      uploadedByName: uploadedByUserAlias.fullName,
      isStarred: employeeDocuments.isStarred,
      createdAt: employeeDocuments.createdAt,
      updatedAt: employeeDocuments.updatedAt,
    })
    .from(employeeDocuments)
    .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id))
    .leftJoin(employeeUserAlias, eq(employees.userId, employeeUserAlias.id))
    .leftJoin(uploadedByUserAlias, eq(employeeDocuments.uploadedBy, uploadedByUserAlias.id))
    .where(
      and(
        eq(employeeDocuments.isDeleted, false),
        eq(employees.isDeleted, false)
      )
    )
    .orderBy(desc(employeeDocuments.createdAt));

  const total = docs.length;
  const files: EmployeeDocumentFile[] = docs
    .slice(offset, offset + limit)
    .map((f) => ({
      id: f.id,
      fileName: f.fileName,
      filePath: f.filePath,
      fileUrl: null,
      fileType: f.fileType,
      fileSize: f.fileSize,
      source: "employee_documents",
      sourceId: String(f.employeeId),
      sourceName: f.employeeNumber ?? f.employeeName ?? String(f.employeeId),
      employeeId: f.employeeId,
      employeeName: f.employeeName ?? null,
      employeeNumber: f.employeeNumber ?? null,
      documentType: f.documentType ?? null,
      expirationDate: f.expirationDate != null ? String(f.expirationDate) : null,
      uploadedBy: f.uploadedBy,
      uploadedByName: f.uploadedByName ?? null,
      isStarred: f.isStarred ?? false,
      createdAt: new Date((f.createdAt as Date | string) ?? 0),
      updatedAt: f.updatedAt != null ? new Date(f.updatedAt) : null,
    }));

  return {
    files,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}