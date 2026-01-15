import { eq, and, or, ne, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { users, roles } from "../drizzle/schema/auth.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { employees, departments, positions } from "../drizzle/schema/org.schema.js";

/**
 * Check if a user with the given email already exists
 */
export const checkEmailExists = async (
  email: string,
  excludeUserId?: string
): Promise<boolean> => {
  const conditions = [eq(users.email, email), eq(users.isDeleted, false)];

  if (excludeUserId) {
    conditions.push(ne(users.id, excludeUserId));
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if an employee ID already exists
 */
export const checkEmployeeIdExists = async (
  employeeId: string,
  excludeEmployeeId?: number
): Promise<boolean> => {
  const conditions = [
    eq(employees.employeeId, employeeId),
    eq(employees.isDeleted, false),
  ];

  if (excludeEmployeeId) {
    conditions.push(ne(employees.id, excludeEmployeeId));
  }

  const [existing] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if a department with the given name already exists
 */
export const checkDepartmentNameExists = async (
  name: string,
  excludeDepartmentId?: number
): Promise<boolean> => {
  const conditions = [
    sql`LOWER(${departments.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(departments.isDeleted, false),
  ];

  if (excludeDepartmentId) {
    conditions.push(ne(departments.id, excludeDepartmentId));
  }

  const [existing] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if a position with the given name already exists within the same department
 */
export const checkPositionNameExists = async (
  name: string,
  departmentId: number,
  excludePositionId?: number
): Promise<boolean> => {
  const conditions = [
    sql`LOWER(${positions.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(positions.departmentId, departmentId), // Same department only
    eq(positions.isDeleted, false),
  ];

  if (excludePositionId) {
    conditions.push(ne(positions.id, excludePositionId));
  }

  const [existing] = await db
    .select({ id: positions.id })
    .from(positions)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if an organization with the given name already exists
 */
export const checkOrganizationNameExists = async (
  name: string,
  excludeOrganizationId?: string
): Promise<boolean> => {
  const conditions = [
    sql`LOWER(${organizations.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(organizations.isDeleted, false),
  ];

  if (excludeOrganizationId) {
    conditions.push(ne(organizations.id, excludeOrganizationId));
  }

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if an organization client ID already exists
 */
export const checkClientIdExists = async (
  clientId: string,
  excludeOrganizationId?: string
): Promise<boolean> => {
  const conditions = [
    eq(organizations.clientId, clientId),
    eq(organizations.isDeleted, false),
  ];

  if (excludeOrganizationId) {
    conditions.push(ne(organizations.id, excludeOrganizationId));
  }

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Validate multiple unique fields at once
 * Returns an array of error messages for any conflicts found
 */
export const validateUniqueFields = async (
  checks: Array<{
    field: string;
    value: any;
    checkFunction: () => Promise<boolean>;
    message?: string;
  }>
): Promise<string[]> => {
  const errors: string[] = [];

  for (const check of checks) {
    if (check.value && (await check.checkFunction())) {
      errors.push(
        check.message || `${check.field} '${check.value}' is already in use`
      );
    }
  }

  return errors;
};

/**
 * Check if a role with the given name already exists
 */
export const checkRoleNameExists = async (
  name: string,
  excludeRoleId?: number
): Promise<boolean> => {
  const conditions = [
    sql`LOWER(${roles.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(roles.isDeleted, false),
  ];

  if (excludeRoleId) {
    conditions.push(ne(roles.id, excludeRoleId));
  }

  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if a bid number already exists for a specific organization
 */
export const checkBidNumberExists = async (
  bidNumber: string,
  organizationId: string,
  excludeBidId?: string
): Promise<boolean> => {
  const { bidsTable } = await import("../drizzle/schema/bids.schema.js");
  
  const conditions = [
    eq(bidsTable.bidNumber, bidNumber),
    eq(bidsTable.organizationId, organizationId),
    eq(bidsTable.isDeleted, false),
  ];

  if (excludeBidId) {
    conditions.push(ne(bidsTable.id, excludeBidId));
  }

  const [existing] = await db
    .select({ id: bidsTable.id })
    .from(bidsTable)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if a job number already exists for a specific organization
 */
export const checkJobNumberExists = async (
  jobNumber: string,
  organizationId: string,
  excludeJobId?: string
): Promise<boolean> => {
  const { jobs } = await import("../drizzle/schema/jobs.schema.js");
  
  const conditions = [
    eq(jobs.jobNumber, jobNumber),
    eq(jobs.organizationId, organizationId),
    eq(jobs.isDeleted, false),
  ];

  if (excludeJobId) {
    conditions.push(ne(jobs.id, excludeJobId));
  }

  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if a client type name already exists
 */
export const checkClientTypeNameExists = async (
  name: string,
  excludeClientTypeId?: number
): Promise<boolean> => {
  const { clientTypes } = await import("../drizzle/schema/client.schema.js");
  
  const conditions = [
    sql`LOWER(${clientTypes.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(clientTypes.isActive, true),
  ];

  if (excludeClientTypeId) {
    conditions.push(ne(clientTypes.id, excludeClientTypeId));
  }

  const [existing] = await db
    .select({ id: clientTypes.id })
    .from(clientTypes)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if an industry classification name already exists
 */
export const checkIndustryClassificationNameExists = async (
  name: string,
  excludeIndustryId?: number
): Promise<boolean> => {
  const { industryClassifications } = await import("../drizzle/schema/client.schema.js");
  
  const conditions = [
    sql`LOWER(${industryClassifications.name}) = LOWER(${name})`, // Case-insensitive comparison
    eq(industryClassifications.isActive, true),
  ];

  if (excludeIndustryId) {
    conditions.push(ne(industryClassifications.id, excludeIndustryId));
  }

  const [existing] = await db
    .select({ id: industryClassifications.id })
    .from(industryClassifications)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Check if an industry classification code already exists
 */
export const checkIndustryClassificationCodeExists = async (
  code: string,
  excludeIndustryId?: number
): Promise<boolean> => {
  const { industryClassifications } = await import("../drizzle/schema/client.schema.js");
  
  const conditions = [
    eq(industryClassifications.code, code),
    eq(industryClassifications.isActive, true),
  ];

  if (excludeIndustryId) {
    conditions.push(ne(industryClassifications.id, excludeIndustryId));
  }

  const [existing] = await db
    .select({ id: industryClassifications.id })
    .from(industryClassifications)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
};

/**
 * Generic helper to build conflict error response
 */
export const buildConflictResponse = (errors: string[]) => {
  return {
    success: false,
    message:
      errors.length === 1
        ? errors[0]
        : "The following fields are already in use",
    errors: errors.length > 1 ? errors : undefined,
  };
};

