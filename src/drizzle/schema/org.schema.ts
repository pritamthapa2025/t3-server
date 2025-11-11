import {
  pgSchema,
  pgTable,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";

export const org = pgSchema("org");

// Departments table
export const departments = org.table("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Positions table
export const positions = org.table("positions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employees table
export const employees = org.table("employees", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 50 }).unique(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  positionId: integer("position_id").references(() => positions.id, {
    onDelete: "set null",
  }),
  reportsTo: uuid("reports_to").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
