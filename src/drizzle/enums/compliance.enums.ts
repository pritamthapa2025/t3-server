import { pgEnum } from "drizzle-orm/pg-core";

// Compliance case enums
export const complianceCaseTypeEnum = pgEnum("compliance_case_type_enum", [
  "safety",
  "timesheet", 
  "conduct",
  "training",
  "certification",
  "other"
]);

export const complianceSeverityEnum = pgEnum("compliance_severity_enum", [
  "low",
  "medium",
  "high",
  "critical"
]);

export const complianceStatusEnum = pgEnum("compliance_status_enum", [
  "open",
  "investigating",
  "resolved",
  "closed",
  "escalated"
]);

// Certification enums
export const certificationStatusEnum = pgEnum("certification_status_enum", [
  "active",
  "expired",
  "expiring_soon",
  "suspended",
  "cancelled"
]);

// Training enums
export const trainingStatusEnum = pgEnum("training_status_enum", [
  "not_started",
  "in_progress", 
  "completed",
  "failed",
  "overdue"
]);

// Note: inspectionStatusEnum is now defined in fleet.enums.ts
// Import it from there if needed: import { inspectionStatusEnum } from "./fleet.enums.js";













