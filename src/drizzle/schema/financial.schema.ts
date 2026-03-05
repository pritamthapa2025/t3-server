import {
  pgSchema,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";

export const financial = pgSchema("financial");

export const financialCategoryBudgets = financial.table(
  "category_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: varchar("category", { length: 50 }).notNull(), // materials | labor | travel | operating
    month: integer("month").notNull(), // 1–12
    year: integer("year").notNull(),
    budgetAmount: numeric("budget_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("100000"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_fin_cat_budget_cat_month_year").on(
      table.category,
      table.month,
      table.year,
    ),
    index("idx_fin_cat_budgets_period").on(table.month, table.year),
    index("idx_fin_cat_budgets_category").on(table.category),
  ],
);
