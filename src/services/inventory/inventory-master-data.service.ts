import { count, eq, and, ilike, desc, sql } from "drizzle-orm";
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

// Generate next supplier code using PostgreSQL sequence
// Format: SUP-2025-000001 (6 digits, auto-expands to 7, 8, 9+ as needed)
// This is THREAD-SAFE and prevents race conditions
const generateSupplierCode = async (): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Use PostgreSQL sequence for atomic ID generation
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.supplier_code_seq')::text as nextval`),
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `SUP-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    console.warn(
      "Supplier code sequence not found, using fallback method:",
      error,
    );

    const result = await db
      .select({ supplierCode: inventorySuppliers.supplierCode })
      .from(inventorySuppliers)
      .where(
        and(
          eq(inventorySuppliers.isDeleted, false),
          sql`${inventorySuppliers.supplierCode} ~ ${`^SUP-${year}-\\d+$`}`,
        ),
      )
      .orderBy(desc(inventorySuppliers.supplierCode))
      .limit(1);

    let nextNumber = 1;
    if (result.length && result[0]?.supplierCode) {
      const lastSupplierCode = result[0].supplierCode;
      const match = lastSupplierCode.match(/^SUP-\d+-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]!) + 1;
      }
    }

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `SUP-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  }
};

export const createSupplier = async (data: any) => {
  // Auto-generate supplier code
  const supplierCode = await generateSupplierCode();

  const [newSupplier] = await db
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
      creditLimit: data.creditLimit != null ? data.creditLimit.toString() : undefined,
      rating: data.rating != null ? data.rating.toString() : undefined,
      leadTimeDays: data.leadTimeDays,
      isPreferred: data.isPreferred !== undefined ? data.isPreferred : false,
      notes: data.notes,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
    })
    .returning();

  return newSupplier!;
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

// Generate next location code using PostgreSQL sequence
// Format: LOC-2025-000001 (6 digits, auto-expands to 7, 8, 9+ as needed)
// This is THREAD-SAFE and prevents race conditions
const generateLocationCode = async (): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Use PostgreSQL sequence for atomic ID generation
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.location_code_seq')::text as nextval`),
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `LOC-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    console.warn(
      "Location code sequence not found, using fallback method:",
      error,
    );

    const result = await db
      .select({ locationCode: inventoryLocations.locationCode })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.isDeleted, false),
          sql`${inventoryLocations.locationCode} ~ ${`^LOC-${year}-\\d+$`}`,
        ),
      )
      .orderBy(desc(inventoryLocations.locationCode))
      .limit(1);

    let nextNumber = 1;
    if (result.length && result[0]?.locationCode) {
      const lastLocationCode = result[0].locationCode;
      const match = lastLocationCode.match(/^LOC-\d+-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]!) + 1;
      }
    }

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `LOC-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  }
};

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
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.isDeleted, false)))
    .limit(1);

  return location || null;
};

export const createLocation = async (data: any) => {
  // Always auto-generate location code - never accept from external input
  const locationCode = await generateLocationCode();

  const [newLocation] = (await db
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
    .returning()) as any;

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

export const getCategories = async () => {
  return await db
    .select()
    .from(inventoryCategories)
    .orderBy(inventoryCategories.name);
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

export const getUnits = async () => {
  return await db
    .select()
    .from(inventoryUnitsOfMeasure)
    .orderBy(inventoryUnitsOfMeasure.name);
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
