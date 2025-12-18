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

// Safety inspection enums
export const inspectionStatusEnum = pgEnum("inspection_status_enum", [
  "passed",
  "failed", 
  "conditional_pass",
  "scheduled",
  "overdue"
]);



