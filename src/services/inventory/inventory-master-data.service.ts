import { count, eq, and, ilike, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventorySuppliers,
  inventoryLocations,
  inventoryCategories,
  inventoryUnitsOfMeasure,
} from "../../drizzle/schema/inventory.schema.js";

// ============================
// Suppliers
// ============================

export const getSuppliers = async (
  offset: number,
  limit: number,
  filters?: { search?: string; isActive?: boolean },
) => {
  let whereCondition = eq(inventorySuppliers.isDeleted, false);

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      ilike(inventorySuppliers.name, `%${filters.search}%`),
    )!;
  }
  if (filters?.isActive !== undefined) {
    whereCondition = and(
      whereCondition,
      eq(inventorySuppliers.isActive, filters.isActive),
    )!;
  }

  const result = await db
    .select()
    .from(inventorySuppliers)
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(inventorySuppliers.name);

  const totalCount = await db
    .select({ count: count() })
    .from(inventorySuppliers)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSupplierById = async (id: string) => {
  const [supplier] = await db
    .select()
    .from(inventorySuppliers)
    .where(eq(inventorySuppliers.id, id))
    .limit(1);

  return supplier || null;
};

const SUPPLIER_CODE_LOCK_KEY = 918_273_648;
const LOCATION_CODE_LOCK_KEY = 918_273_649;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function allocateNextSupplierCode(tx: Tx, year: number): Promise<string> {
  await tx.execute(
    sql.raw(`SELECT pg_advisory_xact_lock(${SUPPLIER_CODE_LOCK_KEY})`),
  );

  const maxNumResult = await tx.execute<{ max_num: string | null }>(
    sql.raw(`
      WITH nums AS (
        SELECT CAST(SUBSTRING(supplier_code FROM 'SUP-${year}-(\\d+)') AS INTEGER) AS num_value
        FROM org.inventory_suppliers
        WHERE supplier_code ~ '^SUP-${year}-\\d+$'
      )
      SELECT COALESCE(MAX(num_value), 0)::text AS max_num
      FROM nums
    `),
  );

  const maxNum = maxNumResult.rows[0]?.max_num;
  const nextIdNumber = maxNum ? parseInt(maxNum, 10) + 1 : 1;
  const padding = Math.max(4, nextIdNumber.toString().length);
  const code = `SUP-${year}-${String(nextIdNumber).padStart(padding, "0")}`;

  try {
    await tx.execute(
      sql.raw(`SELECT setval('org.supplier_code_seq', ${nextIdNumber}, true)`),
    );
  } catch {
    // Sequence may be missing
  }

  return code;
}

export const createSupplier = async (data: any) => {
  const year = new Date().getFullYear();

  const newSupplier = await db.transaction(async (tx) => {
    const supplierCode = await allocateNextSupplierCode(tx, year);
    const inserted = await tx
    .insert(inventorySuppliers)
    .values({
      supplierCode: supplierCode,
      name: data.name,
      legalName: data.legalName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      website: data.website,
      streetAddress: data.streetAddress,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country || "USA",
      taxId: data.taxId,
      accountNumber: data.accountNumber,
      paymentTerms: data.paymentTerms,
      creditLimit:
        data.creditLimit != null ? data.creditLimit.toString() : undefined,
      rating: data.rating != null ? data.rating.toString() : undefined,
      leadTimeDays: data.leadTimeDays,
      isPreferred: data.isPreferred !== undefined ? data.isPreferred : false,
      notes: data.notes,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
    })
    .returning();
    const rows = inserted as unknown as Record<string, unknown>[];
    const row = rows[0] as (typeof inventorySuppliers)["$inferSelect"] | undefined;
    if (!row) throw new Error("Failed to create supplier");
    return row;
  });

  return newSupplier;
};

export const updateSupplier = async (id: string, data: any) => {
  // Strip auto-generated field - supplierCode cannot be changed after creation
  const { supplierCode: _ignored, ...safeData } = data;

  if (safeData.creditLimit != null) {
    safeData.creditLimit = safeData.creditLimit.toString();
  }
  if (safeData.rating != null) {
    safeData.rating = safeData.rating.toString();
  }

  const [updatedSupplier] = await db
    .update(inventorySuppliers)
    .set(safeData)
    .where(eq(inventorySuppliers.id, id))
    .returning();

  if (!updatedSupplier) throw new Error("Supplier not found");

  return updatedSupplier;
};

export const deleteSupplier = async (id: string) => {
  const [deletedSupplier] = await db
    .update(inventorySuppliers)
    .set({ isDeleted: true })
    .where(eq(inventorySuppliers.id, id))
    .returning();

  if (!deletedSupplier) throw new Error("Supplier not found");

  return deletedSupplier;
};

// ============================
// Locations
// ============================

async function allocateNextLocationCode(tx: Tx, year: number): Promise<string> {
  await tx.execute(
    sql.raw(`SELECT pg_advisory_xact_lock(${LOCATION_CODE_LOCK_KEY})`),
  );

  const maxNumResult = await tx.execute<{ max_num: string | null }>(
    sql.raw(`
      WITH nums AS (
        SELECT CAST(SUBSTRING(location_code FROM 'LOC-${year}-(\\d+)') AS INTEGER) AS num_value
        FROM org.inventory_locations
        WHERE location_code ~ '^LOC-${year}-\\d+$'
      )
      SELECT COALESCE(MAX(num_value), 0)::text AS max_num
      FROM nums
    `),
  );

  const maxNum = maxNumResult.rows[0]?.max_num;
  const nextIdNumber = maxNum ? parseInt(maxNum, 10) + 1 : 1;
  const padding = Math.max(4, nextIdNumber.toString().length);
  const code = `LOC-${year}-${String(nextIdNumber).padStart(padding, "0")}`;

  try {
    await tx.execute(
      sql.raw(`SELECT setval('org.location_code_seq', ${nextIdNumber}, true)`),
    );
  } catch {
    // Sequence may be missing
  }

  return code;
}

export const getLocations = async (
  offset: number,
  limit: number,
  filters?: { search?: string; locationType?: string },
) => {
  const conditions = [eq(inventoryLocations.isDeleted, false)];

  if (filters?.search) {
    conditions.push(ilike(inventoryLocations.name, `%${filters.search}%`));
  }
  if (filters?.locationType) {
    conditions.push(
      eq(inventoryLocations.locationType, filters.locationType as any),
    );
  }

  const whereCondition =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  const result = await db
    .select()
    .from(inventoryLocations)
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(inventoryLocations.name);

  const totalCount = await db
    .select({ count: count() })
    .from(inventoryLocations)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getLocationById = async (id: string) => {
  const [location] = await db
    .select()
    .from(inventoryLocations)
    .where(
      and(
        eq(inventoryLocations.id, id),
        eq(inventoryLocations.isDeleted, false),
      ),
    )
    .limit(1);

  return location || null;
};

export const createLocation = async (data: any) => {
  const year = new Date().getFullYear();

  const newLocation = await db.transaction(async (tx) => {
    const locationCode = await allocateNextLocationCode(tx, year);
    const inserted = await tx
      .insert(inventoryLocations)
      .values({
        locationCode: locationCode,
        name: data.name,
        locationType: data.locationType,
        parentLocationId: data.parentLocationId,
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        capacity: data.capacity,
        capacityUnit: data.capacityUnit,
        managerId: data.managerId,
        accessInstructions: data.accessInstructions,
        notes: data.notes,
        isDeleted: false,
      })
      .returning();
    const rows = inserted as unknown as Record<string, unknown>[];
    const row = rows[0] as (typeof inventoryLocations)["$inferSelect"] | undefined;
    if (!row) throw new Error("Failed to create location");
    return row;
  });

  return newLocation;
};

export const updateLocation = async (id: string, data: any) => {
  // Prepare update data with explicit field mapping
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only update provided fields (locationCode is auto-generated and cannot be changed)
  if (data.name !== undefined) updateData.name = data.name;
  if (data.locationType !== undefined)
    updateData.locationType = data.locationType;
  if (data.parentLocationId !== undefined)
    updateData.parentLocationId = data.parentLocationId;
  if (data.streetAddress !== undefined)
    updateData.streetAddress = data.streetAddress;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.capacityUnit !== undefined)
    updateData.capacityUnit = data.capacityUnit;
  if (data.managerId !== undefined) updateData.managerId = data.managerId;
  if (data.accessInstructions !== undefined)
    updateData.accessInstructions = data.accessInstructions;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updatedLocation] = await db
    .update(inventoryLocations)
    .set(updateData)
    .where(eq(inventoryLocations.id, id))
    .returning();

  if (!updatedLocation) throw new Error("Location not found");

  return updatedLocation;
};

export const deleteLocation = async (id: string) => {
  const [deletedLocation] = await db
    .update(inventoryLocations)
    .set({ isDeleted: true })
    .where(eq(inventoryLocations.id, id))
    .returning();

  if (!deletedLocation) throw new Error("Location not found");

  return deletedLocation;
};

// ============================
// Categories
// ============================

export const getCategories = async (params?: {
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(500, Math.max(1, params?.limit ?? 10));
  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(inventoryCategories)
      .orderBy(inventoryCategories.name)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(inventoryCategories),
  ]);

  const total = countResult[0]?.count ?? 0;
  return {
    data,
    total,
    pagination: { page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const createCategory = async (data: any) => {
  const [newCategory] = await db
    .insert(inventoryCategories)
    .values({
      name: data.name,
      description: data.description,
      code: data.code,
      color: data.color,
      icon: data.icon,
      sortOrder: data.sortOrder,
    })
    .returning();

  return newCategory!;
};

export const updateCategory = async (id: number, data: any) => {
  const [updatedCategory] = await db
    .update(inventoryCategories)
    .set(data)
    .where(eq(inventoryCategories.id, id))
    .returning();

  if (!updatedCategory) throw new Error("Category not found");

  return updatedCategory;
};

export const deleteCategory = async (id: number) => {
  // Soft delete by setting isActive to false
  const [deletedCategory] = await db
    .update(inventoryCategories)
    .set({ isActive: false })
    .where(eq(inventoryCategories.id, id))
    .returning();

  if (!deletedCategory) throw new Error("Category not found");

  return deletedCategory;
};

// ============================
// Units of Measure
// ============================

export const getUnits = async (params?: { page?: number; limit?: number }) => {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(500, Math.max(1, params?.limit ?? 10));
  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(inventoryUnitsOfMeasure)
      .orderBy(inventoryUnitsOfMeasure.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryUnitsOfMeasure),
  ]);

  const total = countResult[0]?.count ?? 0;
  return {
    data,
    total,
    pagination: { page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const createUnit = async (data: any) => {
  const [newUnit] = await db
    .insert(inventoryUnitsOfMeasure)
    .values({
      name: data.name,
      abbreviation: data.abbreviation,
      unitType: data.unitType,
    })
    .returning();

  return newUnit;
};

export const updateUnit = async (id: number, data: any) => {
  const [updatedUnit] = await db
    .update(inventoryUnitsOfMeasure)
    .set(data)
    .where(eq(inventoryUnitsOfMeasure.id, id))
    .returning();

  if (!updatedUnit) throw new Error("Unit not found");

  return updatedUnit;
};

export const deleteUnit = async (id: number) => {
  // Soft delete by setting isActive to false
  const [deletedUnit] = await db
    .update(inventoryUnitsOfMeasure)
    .set({ isActive: false })
    .where(eq(inventoryUnitsOfMeasure.id, id))
    .returning();

  if (!deletedUnit) throw new Error("Unit not found");

  return deletedUnit;
};
