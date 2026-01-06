import { pgEnum } from "drizzle-orm/pg-core";

// Shift management enums
export const shiftTypeEnum = pgEnum("shift_type_enum", [
  "regular",
  "overtime", 
  "on_call",
  "emergency"
]);

export const availabilityStatusEnum = pgEnum("availability_status_enum", [
  "available",
  "on_job",
  "break",
  "pto",
  "sick", 
  "off_shift",
  "suspended"
]);

// Resource allocation enums
export const resourceAllocationStatusEnum = pgEnum("resource_allocation_status_enum", [
  "planned",
  "assigned",
  "in_progress",
  "completed",
  "cancelled"
]);

// Capacity planning enums
export const capacityPeriodTypeEnum = pgEnum("capacity_period_type_enum", [
  "daily",
  "weekly", 
  "monthly",
  "quarterly"
]);











