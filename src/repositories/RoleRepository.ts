import { db } from "../config/db.js";
import { roles } from "../drizzle/schema/auth.schema.js";
import { eq, and, ilike, desc, asc, ne } from "drizzle-orm";

export interface CreateRoleData {
  name: string;
  description?: string;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  isDeleted?: boolean;
}

export interface GetRolesOptions {
  offset?: number;
  limit?: number;
  search?: string | undefined;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class RoleRepository {
  // Get all roles with pagination and filtering
  static async getRoles(options: GetRolesOptions = {}) {
    const {
      offset = 0,
      limit = 10,
      search,
      includeDeleted = false,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build where conditions
    const conditions = [];
    
    if (!includeDeleted) {
      conditions.push(eq(roles.isDeleted, false));
    }

    if (search) {
      conditions.push(ilike(roles.name, `%${search}%`));
    }

    // Build base query
    let query = db.select().from(roles);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Add sorting
    const sortColumn = sortBy === 'name' ? roles.name : roles.createdAt;
    const sortDirection = sortOrder === 'asc' ? asc : desc;
    query = query.orderBy(sortDirection(sortColumn)) as typeof query;

    // Add pagination
    query = query.offset(offset).limit(limit) as typeof query;

    const result = await query;

    // Get total count for pagination
    let countQuery = db.select({ count: roles.id }).from(roles);
    
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }

    const totalResult = await countQuery;
    const total = totalResult.length;

    return {
      data: result,
      total,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
    };
  }

  // Get role by ID
  static async getRoleById(id: number) {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.isDeleted, false)))
      .limit(1);

    return result[0] || null;
  }

  // Get role by name
  static async getRoleByName(name: string) {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.name, name), eq(roles.isDeleted, false)))
      .limit(1);

    return result[0] || null;
  }

  // Create a new role
  static async createRole(data: CreateRoleData) {
    const result = await db
      .insert(roles)
      .values({
        name: data.name,
        description: data.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result[0];
  }

  // Update a role
  static async updateRole(id: number, data: UpdateRoleData) {
    const result = await db
      .update(roles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(roles.id, id), eq(roles.isDeleted, false)))
      .returning();

    return result[0] || null;
  }

  // Soft delete a role
  static async deleteRole(id: number) {
    const result = await db
      .update(roles)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(roles.id, id), eq(roles.isDeleted, false)))
      .returning();

    return result[0] || null;
  }

  // Check if role name exists (for validation)
  static async roleNameExists(name: string, excludeId?: number) {
    const conditions = [eq(roles.name, name), eq(roles.isDeleted, false)];
    
    if (excludeId) {
      conditions.push(ne(roles.id, excludeId));
    }

    const query = db
      .select({ id: roles.id })
      .from(roles)
      .where(and(...conditions));

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Get active roles count
  static async getActiveRolesCount() {
    const result = await db
      .select({ count: roles.id })
      .from(roles)
      .where(eq(roles.isDeleted, false));

    return result.length;
  }
}
