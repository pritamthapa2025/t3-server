import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  unique,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";
import { organizations, employees } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";
// Import fleet tables (vehicles, safetyInspections, safetyInspectionItems) from fleet schema
import {
  vehicles,
  safetyInspections,
  safetyInspectionItems,
} from "./fleet.schema.js";
import {
  complianceCaseTypeEnum,
  complianceSeverityEnum,
  complianceStatusEnum,
  certificationStatusEnum,
  trainingStatusEnum,
} from "../enums/compliance.enums.js";

const org = pgSchema("org");

// 1. Employee Compliance Cases
export const employeeComplianceCases = org.table(
  "employee_compliance_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id), // Optional - only set if case is related to a specific client
    jobId: uuid("job_id").references(() => jobs.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    // Case Details
    caseNumber: varchar("case_number", { length: 50 }).notNull().unique(), // CASE-2024-001
    type: complianceCaseTypeEnum("type").notNull(),
    severity: complianceSeverityEnum("severity").notNull(),
    status: complianceStatusEnum("status").notNull().default("open"),

    // Case Information
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    notes: text("notes"),

    // Dates
    openedOn: date("opened_on").notNull(),
    dueDate: date("due_date"),
    resolvedDate: date("resolved_date"),

    // Assignment
    reportedBy: uuid("reported_by").references(() => users.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    resolvedBy: uuid("resolved_by").references(() => users.id),

    // Impact Assessment
    impactLevel: varchar("impact_level", { length: 50 }), // "low_risk", "medium_risk", "high_risk"
    correctiveAction: text("corrective_action"),
    preventiveAction: text("preventive_action"),

    // Attachments & Evidence
    attachments: jsonb("attachments"), // Array of file references
    evidencePhotos: jsonb("evidence_photos"), // Array of photo URLs

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_compliance_cases_org").on(table.organizationId),
    index("idx_compliance_cases_job").on(table.jobId),
    index("idx_compliance_cases_employee").on(table.employeeId),
    index("idx_compliance_cases_case_number").on(table.caseNumber),
    index("idx_compliance_cases_status").on(table.status),
    index("idx_compliance_cases_type").on(table.type),
    index("idx_compliance_cases_assigned_to").on(table.assignedTo),
    index("idx_compliance_cases_due_date").on(table.dueDate),
  ]
);

// 2. Employee Certifications
export const employeeCertifications = org.table(
  "employee_certifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    // Certification Details
    certificationName: varchar("certification_name", { length: 255 }).notNull(),
    certificationCode: varchar("certification_code", { length: 100 }),
    issuingAuthority: varchar("issuing_authority", { length: 255 }).notNull(),

    // Dates
    issuedDate: date("issued_date").notNull(),
    expirationDate: date("expiration_date"),
    lastRenewalDate: date("last_renewal_date"),
    nextRenewalDate: date("next_renewal_date"),

    // Status & Verification
    status: certificationStatusEnum("status").notNull().default("active"),
    verificationNumber: varchar("verification_number", { length: 100 }),
    isRequired: boolean("is_required").default(false), // Required for position

    // Documentation
    certificateFilePath: varchar("certificate_file_path", { length: 500 }),
    notes: text("notes"),

    // Renewal Management
    renewalReminderDays: integer("renewal_reminder_days").default(30), // Days before expiration
    autoRenewal: boolean("auto_renewal").default(false),
    renewalCost: numeric("renewal_cost", { precision: 10, scale: 2 }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_employee_certifications_employee").on(table.employeeId),
    index("idx_employee_certifications_org").on(table.organizationId),
    index("idx_employee_certifications_status").on(table.status),
    index("idx_employee_certifications_expiration").on(table.expirationDate),
    index("idx_employee_certifications_required").on(table.isRequired),
  ]
);

// 3. Employee Violation History
export const employeeViolationHistory = org.table(
  "employee_violation_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    complianceCaseId: uuid("compliance_case_id").references(
      () => employeeComplianceCases.id
    ),

    // Violation Details
    violationType: complianceCaseTypeEnum("violation_type").notNull(),
    violationDate: date("violation_date").notNull(),
    description: text("description").notNull(),
    severity: complianceSeverityEnum("severity").notNull(),

    // Disciplinary Action
    disciplinaryAction: varchar("disciplinary_action", { length: 100 }), // "verbal_warning", "written_warning", "suspension", "termination"
    actionDate: date("action_date"),
    actionNotes: text("action_notes"),

    // Impact on Performance Score
    performanceImpact: numeric("performance_impact", {
      precision: 5,
      scale: 2,
    }), // -5.0 to -10.0 points

    // Resolution
    isResolved: boolean("is_resolved").default(false),
    resolutionDate: date("resolution_date"),
    resolutionNotes: text("resolution_notes"),

    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_violation_history_employee").on(table.employeeId),
    index("idx_violation_history_org").on(table.organizationId),
    index("idx_violation_history_type").on(table.violationType),
    index("idx_violation_history_date").on(table.violationDate),
    index("idx_violation_history_resolved").on(table.isResolved),
  ]
);

// 4. Vehicle Safety Inspections
// Note: Vehicles, safety inspections, and inspection items are now defined in fleet.schema.ts
// These are re-exported here for backward compatibility and compliance module access
export { vehicles, safetyInspections, safetyInspectionItems } from "./fleet.schema.js";

// 5. Training Management
export const trainingPrograms = org.table(
  "training_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),

    // Program Details
    programName: varchar("program_name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }), // "Safety", "Technical", "Compliance"

    // Requirements
    isRequired: boolean("is_required").default(false),
    requiredForPositions: jsonb("required_for_positions"), // Array of position IDs
    requiredForDepartments: jsonb("required_for_departments"), // Array of department IDs

    // Schedule
    durationHours: numeric("duration_hours", { precision: 5, scale: 2 }),
    validityPeriod: integer("validity_period"), // Days until renewal required

    // Content
    materials: jsonb("materials"), // Array of training material references
    externalUrl: varchar("external_url", { length: 500 }),

    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_training_programs_org").on(table.organizationId),
    index("idx_training_programs_required").on(table.isRequired),
    index("idx_training_programs_active").on(table.isActive),
  ]
);

export const employeeTrainingRecords = org.table(
  "employee_training_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    trainingProgramId: uuid("training_program_id")
      .notNull()
      .references(() => trainingPrograms.id),

    // Progress Tracking
    status: trainingStatusEnum("status").notNull().default("not_started"),
    startedDate: date("started_date"),
    completedDate: date("completed_date"),
    expirationDate: date("expiration_date"),

    // Assessment
    score: numeric("score", { precision: 5, scale: 2 }), // 0-100%
    passingScore: numeric("passing_score", { precision: 5, scale: 2 }).default(
      "80"
    ), // Required score
    attempts: integer("attempts").default(0),

    // Documentation
    certificateFilePath: varchar("certificate_file_path", { length: 500 }),
    instructorNotes: text("instructor_notes"),

    // Reminder Management
    reminderSent: boolean("reminder_sent").default(false),
    isDeleted: boolean("is_deleted").default(false),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_training").on(
      table.employeeId,
      table.trainingProgramId
    ),
    index("idx_employee_training_employee").on(table.employeeId),
    index("idx_employee_training_org").on(table.organizationId),
    index("idx_employee_training_status").on(table.status),
    index("idx_employee_training_expiration").on(table.expirationDate),
  ]
);

// 6. Compliance Audit Log
export const complianceAuditLog = org.table(
  "compliance_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),

    // Reference (can be employee, case, certification, etc.)
    referenceType: varchar("reference_type", { length: 50 }).notNull(), // "compliance_case", "certification", "training"
    referenceId: uuid("reference_id").notNull(),

    // Action Details
    action: varchar("action", { length: 100 }).notNull(), // "created", "updated", "resolved", "expired"
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    description: text("description"),

    // Personnel
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_compliance_audit_org").on(table.organizationId),
    index("idx_compliance_audit_reference").on(
      table.referenceType,
      table.referenceId
    ),
    index("idx_compliance_audit_performed_by").on(table.performedBy),
    index("idx_compliance_audit_created_at").on(table.createdAt),
  ]
);
