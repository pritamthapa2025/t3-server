import { count, eq, and, ilike, isNull } from "drizzle-orm";
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
  organizationId: string,
  offset: number,
  limit: number,
  filters?: { search?: string; isActive?: boolean }
) => {
  let whereCondition = and(
    eq(inventorySuppliers.organizationId, organizationId),
    eq(inventorySuppliers.isDeleted, false)
  );

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      ilike(inventorySuppliers.name, `%${filters.search}%`)
    );
  }
  if (filters?.isActive !== undefined) {
    whereCondition = and(whereCondition, eq(inventorySuppliers.isActive, filters.isActive));
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

export const getSupplierById = async (id: string, organizationId: string) => {
  const [supplier] = await db
    .select()
    .from(inventorySuppliers)
    .where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.organizationId, organizationId)))
    .limit(1);

  return supplier || null;
};

export const createSupplier = async (data: any, organizationId: string) => {
  const [newSupplier] = await db.insert(inventorySuppliers).values({
    organizationId,
    name: data.name,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    streetAddress: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    country: data.country,
    website: data.website,
    taxId: data.taxId,
    paymentTerms: data.paymentTerms,
    notes: data.notes,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isDeleted: false,
  }).returning();

  return newSupplier!;
};

export const updateSupplier = async (id: string, data: any, organizationId: string) => {
  const [updatedSupplier] = await db
    .update(inventorySuppliers)
    .set(data)
    .where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.organizationId, organizationId)))
    .returning();

  if (!updatedSupplier) throw new Error("Supplier not found");

  return updatedSupplier;
};

export const deleteSupplier = async (id: string, organizationId: string) => {
  const [deletedSupplier] = await db
    .update(inventorySuppliers)
    .set({ isDeleted: true })
    .where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.organizationId, organizationId)))
    .returning();

  if (!deletedSupplier) throw new Error("Supplier not found");

  return deletedSupplier;
};

// ============================
// Locations
// ============================

export const getLocations = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: { search?: string; locationType?: string }
) => {
  let whereCondition = and(
    eq(inventoryLocations.organizationId, organizationId),
    eq(inventoryLocations.isDeleted, false)
  );

  if (filters?.search) {
    whereCondition = and(whereCondition, ilike(inventoryLocations.name, `%${filters.search}%`));
  }
  if (filters?.locationType) {
    whereCondition = and(whereCondition, eq(inventoryLocations.locationType, filters.locationType as any));
  }

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

export const getLocationById = async (id: string, organizationId: string) => {
  const [location] = await db
    .select()
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.organizationId, organizationId)))
    .limit(1);

  return location || null;
};

export const createLocation = async (data: any, organizationId: string) => {
  const [newLocation] = await db.insert(inventoryLocations).values({
    organizationId,
    name: data.name,
    locationType: data.locationType,
    streetAddress: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    country: data.country,
    notes: data.notes,
    isDeleted: false,
  }).returning() as any;

  return newLocation;
};

export const updateLocation = async (id: string, data: any, organizationId: string) => {
  const [updatedLocation] = await db
    .update(inventoryLocations)
    .set(data)
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.organizationId, organizationId)))
    .returning();

  if (!updatedLocation) throw new Error("Location not found");

  return updatedLocation;
};

export const deleteLocation = async (id: string, organizationId: string) => {
  const [deletedLocation] = await db
    .update(inventoryLocations)
    .set({ isDeleted: true })
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.organizationId, organizationId)))
    .returning();

  if (!deletedLocation) throw new Error("Location not found");

  return deletedLocation;
};

// ============================
// Categories
// ============================

export const getCategories = async () => {
  return await db.select().from(inventoryCategories).orderBy(inventoryCategories.name);
};

export const createCategory = async (data: any) => {
  const [newCategory] = await db.insert(inventoryCategories).values({
    name: data.name,
    description: data.description,
    code: data.code,
  }).returning();

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

// ============================
// Units of Measure
// ============================

export const getUnits = async () => {
  return await db.select().from(inventoryUnitsOfMeasure).orderBy(inventoryUnitsOfMeasure.name);
};

export const createUnit = async (data: any) => {
  const [newUnit] = await db.insert(inventoryUnitsOfMeasure).values({
    name: data.name,
    abbreviation: data.abbreviation,
    unitType: data.unitType,
  }).returning();

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

