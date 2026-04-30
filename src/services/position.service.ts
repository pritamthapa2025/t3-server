import { count, eq, and, or, ilike, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { positions } from "../drizzle/schema/org.schema.js";
import * as SettingsService from "./settings.service.js";

export const getPositions = async (
  offset: number,
  limit: number,
  search?: string,
) => {
  let whereConditions: any[] = [];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(positions.name, `%${search}%`),
        ilike(positions.description, `%${search}%`),
      )!,
    );
  }

  // Add soft delete filter
  whereConditions.push(eq(positions.isDeleted, false));
  const finalWhereClause = and(...whereConditions);

  const result = await db
    .select()
    .from(positions)
    .where(finalWhereClause)
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: count() })
    .from(positions)
    .where(finalWhereClause);

  const totalCount = total[0]?.count ?? 0;

  return {
    data: result || [],
    total: totalCount,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getPositionById = async (id: number) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)));
  return position || null;
};

export const getPositionByName = async (name: string) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.name, name), eq(positions.isDeleted, false)));
  return position || null;
};

export const createPosition = async (data: {
  name: string;
  departmentId?: number | null;
  description?: string;
  payRate: number;
  payType: string;
  currency?: string;
  notes?: string;
  isActive?: boolean;
  isFieldRole?: boolean;
  sortOrder?: number | null;
}) => {
  const [position] = await db
    .insert(positions)
    .values({
      name: data.name,
      departmentId: data.departmentId || null,
      description: data.description || null,
      payRate: String(data.payRate),
      payType: data.payType,
      currency: data.currency || "USD",
      notes: data.notes || null,
      isActive: data.isActive ?? true,
      isFieldRole: data.isFieldRole ?? false,
      sortOrder: data.sortOrder || null,
      isDeleted: false,
    })
    .returning();
  if (position && data.payType === "Hourly") {
    await SettingsService.createLaborRateTemplateForPosition(position.id);
  }
  return position;
};

export const updatePosition = async (
  id: number,
  data: {
    name?: string;
    departmentId?: number | null;
    description?: string;
    payRate?: number;
    payType?: string;
    currency?: string;
    notes?: string | null;
    isActive?: boolean;
    isFieldRole?: boolean;
    sortOrder?: number | null;
  },
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.departmentId !== undefined)
    updateData.departmentId = data.departmentId;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.payRate !== undefined) updateData.payRate = String(data.payRate);
  if (data.payType !== undefined) updateData.payType = data.payType;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isFieldRole !== undefined) updateData.isFieldRole = data.isFieldRole;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [position] = await db
    .update(positions)
    .set(updateData)
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)))
    .returning();
  return position || null;
};

export const deletePosition = async (id: number) => {
  // Soft delete: set isDeleted to true instead of hard delete
  const [position] = await db
    .update(positions)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)))
    .returning();
  return position || null;
};

export const getPositionsGrouped = async (
  page: number,
  limit: number,
  search?: string,
  fieldRoleOnly?: boolean,
) => {
  const offset = (page - 1) * limit;
  const searchFilter = search ? `%${search.toLowerCase()}%` : null;

  // Build grouped result using raw SQL for JSON_AGG support
  const rows = await db.execute(sql`
    WITH dept_groups AS (
      -- Departments with their active positions
      SELECT
        d.id            AS department_id,
        d.name          AS department_name,
        COUNT(p.id)     AS position_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',           p.id,
              'name',         p.name,
              'payRate',      p.pay_rate,
              'payType',      p.pay_type,
              'isFieldRole',  p.is_field_role
            ) ORDER BY p.name ASC
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS positions
      FROM org.departments d
      LEFT JOIN org.positions p
        ON  p.department_id = d.id
        AND p.is_deleted    = false
        AND p.is_active     = true
        ${searchFilter ? sql`AND LOWER(p.name) LIKE ${searchFilter}` : sql``}
        ${fieldRoleOnly ? sql`AND p.is_field_role = true` : sql``}
      WHERE d.is_deleted = false
      GROUP BY d.id, d.name
      ${fieldRoleOnly ? sql`HAVING COUNT(p.id) > 0` : sql``}

      UNION ALL

      -- Positions with no department
      SELECT
        NULL              AS department_id,
        'No Department'   AS department_name,
        COUNT(p.id)       AS position_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',           p.id,
              'name',         p.name,
              'payRate',      p.pay_rate,
              'payType',      p.pay_type,
              'isFieldRole',  p.is_field_role
            ) ORDER BY p.name ASC
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS positions
      FROM org.positions p
      WHERE p.department_id IS NULL
        AND p.is_deleted    = false
        AND p.is_active     = true
        ${searchFilter ? sql`AND LOWER(p.name) LIKE ${searchFilter}` : sql``}
        ${fieldRoleOnly ? sql`AND p.is_field_role = true` : sql``}
      HAVING COUNT(p.id) > 0
    ),
    total_count AS (
      SELECT COUNT(*) AS total FROM dept_groups
    )
    SELECT
      dg.department_id,
      dg.department_name,
      dg.position_count,
      dg.positions,
      tc.total AS total_departments
    FROM dept_groups dg, total_count tc
    ORDER BY
      CASE WHEN dg.department_id IS NULL THEN 1 ELSE 0 END,
      dg.department_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const data = (rows.rows ?? rows) as any[];
  const total = data.length > 0 ? parseInt(data[0].total_departments ?? "0", 10) : 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data.map((row) => ({
      departmentId: row.department_id ?? null,
      departmentName: row.department_name,
      positionCount: parseInt(row.position_count ?? "0", 10),
      positions: typeof row.positions === "string" ? JSON.parse(row.positions) : (row.positions ?? []),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
};

export const getPositionsByDepartment = async (departmentId: number) => {
  // Get positions list filtered by department ID, returning id, name, and pay info
  try {
    const result = await db
      .select({
        id: positions.id,
        name: positions.name,
        payRate: positions.payRate,
        payType: positions.payType,
        currency: positions.currency,
      })
      .from(positions)
      .where(
        and(
          eq(positions.departmentId, departmentId),
          eq(positions.isDeleted, false),
        ),
      )
      .orderBy(positions.name);

    return result;
  } catch (error: any) {
    // Log the actual database error for debugging
    console.error("Database error in getPositionsByDepartment:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack,
    });
    throw error;
  }
};
