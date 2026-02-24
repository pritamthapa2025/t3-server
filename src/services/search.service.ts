import { ilike, or, eq, and } from "drizzle-orm";
import { db } from "../config/db.js";
import redis from "../config/redis.js";
import { organizations, properties } from "../drizzle/schema/client.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { jobs, jobTeamMembers } from "../drizzle/schema/jobs.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";
import { inventoryItems } from "../drizzle/schema/inventory.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
  dispatchTasks,
  dispatchAssignments,
} from "../drizzle/schema/dispatch.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { expenses } from "../drizzle/schema/expenses.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";

export interface SearchContext {
  userId: string;
  roleName: string;
  employeeId: number | null;
}

const isTechnician = (ctx: SearchContext) =>
  ctx.roleName.toLowerCase() === "technician";

const isExecutive = (ctx: SearchContext) =>
  ctx.roleName.toLowerCase() === "executive";

const CACHE_TTL_SECONDS = 30;
const RESULTS_PER_TYPE = 5;

export const VALID_TYPES = [
  "bid",
  "job",
  "client",
  "property",
  "employee",
  "vehicle",
  "inventory",
  "dispatch",
  "timesheet",
  "expense",
  "invoice",
] as const;

export type EntityType = (typeof VALID_TYPES)[number];

export interface GlobalSearchResult {
  bids: SearchItem[];
  jobs: SearchItem[];
  clients: SearchItem[];
  properties: SearchItem[];
  employees: SearchItem[];
  vehicles: SearchItem[];
  inventory: SearchItem[];
  dispatch: SearchItem[];
  timesheets: SearchItem[];
  expenses: SearchItem[];
  invoices: SearchItem[];
}

export interface SearchItem {
  id: string;
  type:
    | "bid"
    | "job"
    | "client"
    | "property"
    | "vehicle"
    | "employee"
    | "inventory"
    | "dispatch"
    | "timesheet"
    | "expense"
    | "invoice";
  title: string;
  subtitle: string;
  metadata?: string;
  url: string;
  icon?: string;
}

// ─── Bids ────────────────────────────────────────────────────────────────────

async function searchBids(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(bidsTable.bidNumber, term),
    ilike(bidsTable.projectName, term),
    ilike(bidsTable.siteAddress, term),
  )!;

  let rows;

  if (isTechnician(ctx) && ctx.employeeId !== null) {
    // Technician: only bids linked to jobs they are assigned to
    rows = await db
      .selectDistinct({
        id: bidsTable.id,
        bidNumber: bidsTable.bidNumber,
        projectName: bidsTable.projectName,
        siteAddress: bidsTable.siteAddress,
        status: bidsTable.status,
      })
      .from(bidsTable)
      .innerJoin(jobs, eq(jobs.bidId, bidsTable.id))
      .innerJoin(
        jobTeamMembers,
        and(
          eq(jobTeamMembers.jobId, jobs.id),
          eq(jobTeamMembers.employeeId, ctx.employeeId!),
          eq(jobTeamMembers.isActive, true),
        ),
      )
      .where(and(eq(bidsTable.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  } else {
    rows = await db
      .select({
        id: bidsTable.id,
        bidNumber: bidsTable.bidNumber,
        projectName: bidsTable.projectName,
        siteAddress: bidsTable.siteAddress,
        status: bidsTable.status,
      })
      .from(bidsTable)
      .where(and(eq(bidsTable.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  }

  return rows.map((row) => ({
    id: row.id,
    type: "bid" as const,
    title: row.projectName,
    subtitle: `${row.bidNumber}${row.siteAddress ? ` • ${row.siteAddress}` : ""}`,
    metadata: row.status,
    url: `/dashboard/bids/${row.id}`,
    icon: "/icons/Case Icon.svg",
  }));
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

async function searchJobs(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(jobs.jobNumber, term),
    ilike(jobs.description, term),
  )!;

  let rows;

  if (isTechnician(ctx) && ctx.employeeId !== null) {
    // Technician: only jobs they are assigned to
    rows = await db
      .selectDistinct({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        description: jobs.description,
        status: jobs.status,
        jobType: jobs.jobType,
      })
      .from(jobs)
      .innerJoin(
        jobTeamMembers,
        and(
          eq(jobTeamMembers.jobId, jobs.id),
          eq(jobTeamMembers.employeeId, ctx.employeeId!),
          eq(jobTeamMembers.isActive, true),
        ),
      )
      .where(and(eq(jobs.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  } else {
    rows = await db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        description: jobs.description,
        status: jobs.status,
        jobType: jobs.jobType,
      })
      .from(jobs)
      .where(and(eq(jobs.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  }

  return rows.map((row) => ({
    id: row.id,
    type: "job" as const,
    title: row.jobNumber,
    subtitle: `${row.jobType || "Job"}${row.description ? ` • ${row.description.slice(0, 60)}` : ""}`,
    metadata: row.status,
    url: `/dashboard/jobs/${row.id}`,
    icon: "/icons/job.svg",
  }));
}

// ─── Clients ─────────────────────────────────────────────────────────────────

async function searchClients(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(organizations.name, term),
    ilike(organizations.clientId, term),
    ilike(organizations.website, term),
  )!;

  let rows;

  if (isTechnician(ctx) && ctx.employeeId !== null) {
    // Technician: only clients of jobs they are assigned to (via bids)
    rows = await db
      .selectDistinct({
        id: organizations.id,
        clientId: organizations.clientId,
        name: organizations.name,
        website: organizations.website,
        status: organizations.status,
      })
      .from(organizations)
      .innerJoin(bidsTable, eq(bidsTable.organizationId, organizations.id))
      .innerJoin(jobs, eq(jobs.bidId, bidsTable.id))
      .innerJoin(
        jobTeamMembers,
        and(
          eq(jobTeamMembers.jobId, jobs.id),
          eq(jobTeamMembers.employeeId, ctx.employeeId!),
          eq(jobTeamMembers.isActive, true),
        ),
      )
      .where(and(eq(organizations.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  } else {
    rows = await db
      .select({
        id: organizations.id,
        clientId: organizations.clientId,
        name: organizations.name,
        website: organizations.website,
        status: organizations.status,
      })
      .from(organizations)
      .where(and(eq(organizations.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  }

  return rows.map((row) => ({
    id: row.id,
    type: "client" as const,
    title: row.name,
    subtitle: `${row.clientId}${row.website ? ` • ${row.website}` : ""}`,
    metadata: row.status,
    url: `/dashboard/clients/${row.id}`,
    icon: "/icons/User Icon.svg",
  }));
}

// ─── Properties ──────────────────────────────────────────────────────────────

async function searchProperties(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(properties.propertyName, term),
    ilike(properties.propertyCode, term),
    ilike(properties.addressLine1, term),
    ilike(properties.city, term),
  )!;

  let rows;

  if (isTechnician(ctx) && ctx.employeeId !== null) {
    // Technician: only properties of jobs they are assigned to (via bids)
    rows = await db
      .selectDistinct({
        id: properties.id,
        propertyName: properties.propertyName,
        propertyCode: properties.propertyCode,
        addressLine1: properties.addressLine1,
        city: properties.city,
        status: properties.status,
      })
      .from(properties)
      .innerJoin(bidsTable, eq(bidsTable.propertyId, properties.id))
      .innerJoin(jobs, eq(jobs.bidId, bidsTable.id))
      .innerJoin(
        jobTeamMembers,
        and(
          eq(jobTeamMembers.jobId, jobs.id),
          eq(jobTeamMembers.employeeId, ctx.employeeId!),
          eq(jobTeamMembers.isActive, true),
        ),
      )
      .where(textFilter)
      .limit(RESULTS_PER_TYPE);
  } else {
    rows = await db
      .select({
        id: properties.id,
        propertyName: properties.propertyName,
        propertyCode: properties.propertyCode,
        addressLine1: properties.addressLine1,
        city: properties.city,
        status: properties.status,
      })
      .from(properties)
      .where(textFilter)
      .limit(RESULTS_PER_TYPE);
  }

  return rows.map((row) => ({
    id: row.id,
    type: "property" as const,
    title: row.propertyName,
    subtitle:
      `${row.propertyCode || ""}${row.addressLine1 ? ` • ${row.addressLine1}, ${row.city}` : ""}`.replace(
        /^• /,
        "",
      ),
    metadata: row.status,
    url: `/dashboard/properties/${row.id}`,
    icon: "/icons/Home Icon.svg",
  }));
}

// ─── Employees ───────────────────────────────────────────────────────────────

async function searchEmployees(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  // Technicians cannot search other employees
  if (isTechnician(ctx)) return [];

  const rows = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      status: employees.status,
      fullName: users.fullName,
      email: users.email,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(
      and(
        eq(employees.isDeleted, false),
        or(
          ilike(users.fullName, term),
          ilike(users.email, term),
          ilike(employees.employeeId, term),
        ),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: String(row.id),
    type: "employee" as const,
    title: row.fullName,
    subtitle:
      `${row.employeeId || ""}${row.email ? ` • ${row.email}` : ""}`.replace(
        /^• /,
        "",
      ),
    metadata: row.status,
    url: `/dashboard/team?employee=${row.id}`,
    icon: "/icons/Users Icon.svg",
  }));
}

// ─── Fleet ───────────────────────────────────────────────────────────────────

async function searchVehicles(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(vehicles.vehicleId, term),
    ilike(vehicles.make, term),
    ilike(vehicles.model, term),
    ilike(vehicles.licensePlate, term),
    ilike(vehicles.vin, term),
  )!;

  const baseFilter = and(eq(vehicles.isDeleted, false), textFilter);

  const filter =
    isTechnician(ctx) && ctx.employeeId !== null
      ? and(baseFilter, eq(vehicles.assignedToEmployeeId, ctx.employeeId!))
      : baseFilter;

  const rows = await db
    .select({
      id: vehicles.id,
      vehicleId: vehicles.vehicleId,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      licensePlate: vehicles.licensePlate,
      status: vehicles.status,
    })
    .from(vehicles)
    .where(filter)
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: row.id,
    type: "vehicle" as const,
    title: `${row.year} ${row.make} ${row.model}`,
    subtitle: `${row.vehicleId} • ${row.licensePlate || "No plate"}`,
    metadata: row.status,
    url: `/dashboard/fleet/${row.vehicleId}`,
    icon: "/icons/Bus Icon.svg",
  }));
}

// ─── Inventory ───────────────────────────────────────────────────────────────

async function searchInventory(
  term: string,
  _ctx: SearchContext,
): Promise<SearchItem[]> {
  const rows = await db
    .select({
      id: inventoryItems.id,
      itemCode: inventoryItems.itemCode,
      name: inventoryItems.name,
      description: inventoryItems.description,
      stockStatus: inventoryItems.status,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.isDeleted, false),
        or(
          ilike(inventoryItems.name, term),
          ilike(inventoryItems.itemCode, term),
          ilike(inventoryItems.description, term),
        ),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: row.id,
    type: "inventory" as const,
    title: row.name,
    subtitle: `${row.itemCode}${row.description ? ` • ${row.description.slice(0, 60)}` : ""}`,
    metadata: row.stockStatus,
    url: `/dashboard/inventory?item=${row.id}`,
    icon: "/icons/Box.svg",
  }));
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

async function searchDispatch(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(dispatchTasks.title, term),
    ilike(dispatchTasks.description, term),
  )!;

  let rows;

  if (isTechnician(ctx) && ctx.employeeId !== null) {
    // Technician: only dispatch tasks they are assigned to
    rows = await db
      .selectDistinct({
        id: dispatchTasks.id,
        title: dispatchTasks.title,
        description: dispatchTasks.description,
        taskType: dispatchTasks.taskType,
        status: dispatchTasks.status,
      })
      .from(dispatchTasks)
      .innerJoin(
        dispatchAssignments,
        and(
          eq(dispatchAssignments.taskId, dispatchTasks.id),
          eq(dispatchAssignments.technicianId, ctx.employeeId!),
          eq(dispatchAssignments.isDeleted, false),
        ),
      )
      .where(and(eq(dispatchTasks.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  } else {
    rows = await db
      .select({
        id: dispatchTasks.id,
        title: dispatchTasks.title,
        description: dispatchTasks.description,
        taskType: dispatchTasks.taskType,
        status: dispatchTasks.status,
      })
      .from(dispatchTasks)
      .where(and(eq(dispatchTasks.isDeleted, false), textFilter))
      .limit(RESULTS_PER_TYPE);
  }

  return rows.map((row) => ({
    id: row.id,
    type: "dispatch" as const,
    title: row.title,
    subtitle: `${row.taskType}${row.description ? ` • ${row.description.slice(0, 60)}` : ""}`,
    metadata: row.status,
    url: `/dashboard/dispatch`,
    icon: "/icons/Calendar.svg",
  }));
}

// ─── Timesheets ───────────────────────────────────────────────────────────────

async function searchTimesheets(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(users.fullName, term),
    ilike(employees.employeeId, term),
    ilike(timesheets.notes, term),
  )!;

  const ownFilter =
    isTechnician(ctx) && ctx.employeeId !== null
      ? eq(timesheets.employeeId, ctx.employeeId!)
      : undefined;

  const rows = await db
    .select({
      id: timesheets.id,
      sheetDate: timesheets.sheetDate,
      notes: timesheets.notes,
      status: timesheets.status,
      fullName: users.fullName,
      employeeId: employees.employeeId,
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(and(eq(timesheets.isDeleted, false), ownFilter, textFilter))
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: String(row.id),
    type: "timesheet" as const,
    title: row.fullName,
    subtitle: `${row.sheetDate}${row.notes ? ` • ${row.notes.slice(0, 60)}` : ""}`,
    metadata: row.status,
    url: `/dashboard/timesheets`,
    icon: "/icons/clock.svg",
  }));
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

async function searchExpenses(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  const textFilter = or(
    ilike(expenses.expenseNumber, term),
    ilike(expenses.title, term),
    ilike(expenses.description, term),
    ilike(expenses.vendor, term),
  )!;

  // Technician: only expenses they created
  const ownFilter = isTechnician(ctx)
    ? eq(expenses.createdBy, ctx.userId)
    : undefined;

  const rows = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      title: expenses.title,
      description: expenses.description,
      vendor: expenses.vendor,
      status: expenses.status,
    })
    .from(expenses)
    .where(and(eq(expenses.isDeleted, false), ownFilter, textFilter))
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: row.id,
    type: "expense" as const,
    title: row.title,
    subtitle: `${row.expenseNumber}${row.vendor ? ` • ${row.vendor}` : ""}`,
    metadata: row.status,
    url: `/dashboard/expenses`,
    icon: "/icons/Wallet Icon.svg",
  }));
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

async function searchInvoices(
  term: string,
  ctx: SearchContext,
): Promise<SearchItem[]> {
  // Only Executive has access to invoices
  if (!isExecutive(ctx)) return [];

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      billingAddressLine1: invoices.billingAddressLine1,
      billingCity: invoices.billingCity,
      status: invoices.status,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.isDeleted, false),
        or(
          ilike(invoices.invoiceNumber, term),
          ilike(invoices.billingAddressLine1, term),
          ilike(invoices.billingCity, term),
        ),
      ),
    )
    .limit(RESULTS_PER_TYPE);

  return rows.map((row) => ({
    id: row.id,
    type: "invoice" as const,
    title: row.invoiceNumber,
    subtitle: [row.billingAddressLine1, row.billingCity]
      .filter(Boolean)
      .join(", "),
    metadata: row.status,
    url: `/dashboard/invoicing`,
    icon: "/icons/Bill Icon.svg",
  }));
}

// ─── Browse by type ───────────────────────────────────────────────────────────
// Returns results for a single entity type. Uses provided query or "%%" to
// match all records (browse/category mode with no search term).

export async function searchByType(
  type: string,
  ctx: SearchContext,
  query?: string,
): Promise<GlobalSearchResult> {
  const term = query ? `%${query}%` : "%%";

  const empty: GlobalSearchResult = {
    bids: [],
    jobs: [],
    clients: [],
    properties: [],
    employees: [],
    vehicles: [],
    inventory: [],
    dispatch: [],
    timesheets: [],
    expenses: [],
    invoices: [],
  };

  const dispatchMap: Record<string, () => Promise<SearchItem[]>> = {
    bid: () => searchBids(term, ctx),
    job: () => searchJobs(term, ctx),
    client: () => searchClients(term, ctx),
    property: () => searchProperties(term, ctx),
    employee: () => searchEmployees(term, ctx),
    vehicle: () => searchVehicles(term, ctx),
    inventory: () => searchInventory(term, ctx),
    dispatch: () => searchDispatch(term, ctx),
    timesheet: () => searchTimesheets(term, ctx),
    expense: () => searchExpenses(term, ctx),
    invoice: () => searchInvoices(term, ctx),
  };

  const fn = dispatchMap[type];
  if (!fn) return empty;

  const items = await fn();

  const keyMap: Record<string, keyof GlobalSearchResult> = {
    bid: "bids",
    job: "jobs",
    client: "clients",
    property: "properties",
    employee: "employees",
    vehicle: "vehicles",
    inventory: "inventory",
    dispatch: "dispatch",
    timesheet: "timesheets",
    expense: "expenses",
    invoice: "invoices",
  };

  const key = keyMap[type] as string;
  return { ...empty, [key]: items };
}

// ─── Main search ─────────────────────────────────────────────────────────────

export async function globalSearch(
  query: string,
  ctx: SearchContext,
): Promise<GlobalSearchResult> {
  const normalized = query.trim().toLowerCase();
  // Cache key is scoped per user so role/employee filtering is respected
  const cacheKey = `search:global:${ctx.userId}:${normalized}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GlobalSearchResult;
    }
  } catch {
    // Redis miss or error — proceed to DB
  }

  const term = `%${query.trim()}%`;

  const [
    bids,
    jobResults,
    clients,
    propertyResults,
    employeeResults,
    vehicleResults,
    inventoryResults,
    dispatchResults,
    timesheetResults,
    expenseResults,
    invoiceResults,
  ] = await Promise.all([
    searchBids(term, ctx),
    searchJobs(term, ctx),
    searchClients(term, ctx),
    searchProperties(term, ctx),
    searchEmployees(term, ctx),
    searchVehicles(term, ctx),
    searchInventory(term, ctx),
    searchDispatch(term, ctx),
    searchTimesheets(term, ctx),
    searchExpenses(term, ctx),
    searchInvoices(term, ctx),
  ]);

  const results: GlobalSearchResult = {
    bids,
    jobs: jobResults,
    clients,
    properties: propertyResults,
    employees: employeeResults,
    vehicles: vehicleResults,
    inventory: inventoryResults,
    dispatch: dispatchResults,
    timesheets: timesheetResults,
    expenses: expenseResults,
    invoices: invoiceResults,
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(results));
  } catch {
    // Cache write failure is non-fatal
  }

  return results;
}
