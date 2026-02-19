import { db } from "../../config/db.js";
import { eq, and, sql } from "drizzle-orm";
import {
  features,
  roleFeatures,
  uiElements,
  roleUIElements,
  dataFilters,
  fieldPermissions,
} from "../schema/features.schema.js";
import type { permissionModuleEnum, accessLevelEnum, uiElementTypeEnum } from "../enums/auth.enums.js";

// Type helpers for enum values
type ModuleType = (typeof permissionModuleEnum.enumValues)[number];
type AccessLevelType = (typeof accessLevelEnum.enumValues)[number];
type UIElementType = (typeof uiElementTypeEnum.enumValues)[number];

/**
 * Seed Feature-Based Permissions
 * Based on the T3 Mechanical RBAC Matrix CSV
 */

// Role mapping from actual database
const ROLES = {
  EXECUTIVE: 1,   // "Executive" in DB - Full admin access
  MANAGER: 2,     // "Manager" in DB - Limited access  
  TECHNICIAN: 3,  // "Technician" in DB - Assigned-only access
};

/**
 * Features extracted from CSV matrix
 * Format: { module, featureCode, featureName, description }
 */
const FEATURES_DATA = [
  // === DASHBOARD MODULE ===
  { module: "dashboard", featureCode: "view", featureName: "View Dashboard", description: "Access dashboard with role-appropriate layout" },
  { module: "dashboard", featureCode: "view_recent_updates", featureName: "View Recent Updates", description: "See recent job updates" },
  { module: "dashboard", featureCode: "view_new_bids", featureName: "View New Bids", description: "See new bid notifications" },
  { module: "dashboard", featureCode: "view_recent_jobs", featureName: "View Recent Jobs", description: "See recent job activity" },
  { module: "dashboard", featureCode: "view_completed_jobs", featureName: "View Completed Jobs", description: "See completed jobs" },
  { module: "dashboard", featureCode: "view_invoicing_queue", featureName: "View Jobs Needing Invoicing", description: "See jobs ready for invoicing" },
  { module: "dashboard", featureCode: "view_outstanding_payments", featureName: "View Outstanding Payments", description: "See payment status" },
  { module: "dashboard", featureCode: "view_revenue_chart", featureName: "View Revenue Chart", description: "See revenue analytics" },
  { module: "dashboard", featureCode: "view_performance", featureName: "View Performance Overview", description: "See performance metrics" },
  { module: "dashboard", featureCode: "view_priority_jobs", featureName: "View Priority Jobs", description: "See priority jobs table" },
  { module: "dashboard", featureCode: "view_dispatch", featureName: "View Today's Dispatch", description: "See today's dispatch schedule" },

  // === TEAM MODULE ===
  { module: "team", featureCode: "view_employees", featureName: "View Employees", description: "View employee list" },
  { module: "team", featureCode: "view_own_profile", featureName: "View Own Profile", description: "View own profile information" },
  { module: "team", featureCode: "edit_own_profile", featureName: "Edit Own Profile", description: "Edit own basic profile information" },
  { module: "team", featureCode: "view_other_profiles", featureName: "View Other Profiles", description: "View other employee profiles" },
  { module: "team", featureCode: "edit_other_profiles", featureName: "Edit Other Profiles", description: "Edit other employee profiles" },
  { module: "team", featureCode: "update_contact_info", featureName: "Update Contact Info", description: "Update contact information" },
  { module: "team", featureCode: "update_emergency_contact", featureName: "Update Emergency Contact", description: "Update emergency contact" },
  { module: "team", featureCode: "update_bank_details", featureName: "Update Bank Details", description: "Update bank account details" },
  { module: "team", featureCode: "view_pay_rate", featureName: "View Pay Rate", description: "View employee pay rates" },
  { module: "team", featureCode: "add_users", featureName: "Add Users", description: "Add new employees" },
  { module: "team", featureCode: "remove_users", featureName: "Remove Users", description: "Remove/terminate employees" },
  { module: "team", featureCode: "assign_roles", featureName: "Assign Roles", description: "Assign roles to users" },
  { module: "team", featureCode: "update_employment_status", featureName: "Update Employment Status", description: "Change employment status" },
  { module: "team", featureCode: "update_pay_rate", featureName: "Update Pay Rate", description: "Modify employee pay rates" },
  { module: "team", featureCode: "view_own_activity", featureName: "View Own Activity", description: "View own activity logs" },
  { module: "team", featureCode: "view_others_activity", featureName: "View Others Activity", description: "View other employees' activity" },

  // === COMPLIANCE MODULE ===
  { module: "compliance", featureCode: "view_own_reviews", featureName: "View Own Reviews", description: "View own performance reviews" },
  { module: "compliance", featureCode: "conduct_reviews", featureName: "Conduct Reviews", description: "Conduct performance reviews" },
  { module: "compliance", featureCode: "rate_performance", featureName: "Rate Performance", description: "Rate employee performance" },
  { module: "compliance", featureCode: "view_incident_reports", featureName: "View Incident Reports", description: "View incident reports" },
  { module: "compliance", featureCode: "create_incident_reports", featureName: "Create Incident Reports", description: "Create new incident reports" },
  { module: "compliance", featureCode: "edit_incident_reports", featureName: "Edit Incident Reports", description: "Edit incident reports" },
  { module: "compliance", featureCode: "apply_violation_strike", featureName: "Apply Violation Strike", description: "Apply violation strikes" },
  { module: "compliance", featureCode: "view_audit_logs", featureName: "View Audit Logs", description: "View system audit logs" },

  // === TIMESHEET MODULE ===
  { module: "timesheet", featureCode: "view_own_timesheets", featureName: "View Own Timesheets", description: "View own timesheet entries" },
  { module: "timesheet", featureCode: "create_timesheet_entry", featureName: "Create Timesheet Entry", description: "Create new timesheet entries" },
  { module: "timesheet", featureCode: "edit_own_timesheets", featureName: "Edit Own Timesheets", description: "Edit own timesheet entries" },
  { module: "timesheet", featureCode: "delete_own_timesheets", featureName: "Delete Own Timesheets", description: "Delete own timesheet entries" },
  { module: "timesheet", featureCode: "view_others_timesheets", featureName: "View Others Timesheets", description: "View other employees' timesheets" },
  { module: "timesheet", featureCode: "edit_others_timesheets", featureName: "Edit Others Timesheets", description: "Edit other employees' timesheets" },
  { module: "timesheet", featureCode: "add_job_notes", featureName: "Add Job Notes", description: "Add notes to timesheet entries" },
  { module: "timesheet", featureCode: "track_standard_time", featureName: "Track Standard Time", description: "Track regular work hours" },
  { module: "timesheet", featureCode: "track_overtime", featureName: "Track Overtime", description: "Track overtime hours" },
  { module: "timesheet", featureCode: "submit_for_approval", featureName: "Submit for Approval", description: "Submit timesheets for approval" },
  { module: "timesheet", featureCode: "approve_timesheets", featureName: "Approve Timesheets", description: "Approve timesheet submissions" },
  { module: "timesheet", featureCode: "reject_timesheets", featureName: "Reject Timesheets", description: "Reject timesheet submissions" },
  { module: "timesheet", featureCode: "view_violations", featureName: "View Violations", description: "View timesheet violations" },
  { module: "timesheet", featureCode: "clear_violations", featureName: "Clear Violations", description: "Clear timesheet violations" },
  { module: "timesheet", featureCode: "view_labor_costs", featureName: "View Labor Costs", description: "View labor cost information" },
  { module: "timesheet", featureCode: "view_billable_amounts", featureName: "View Billable Amounts", description: "View billable amounts" },

  // === BIDS MODULE ===
  { module: "bids", featureCode: "view_bids", featureName: "View Bids", description: "View bid listings" },
  { module: "bids", featureCode: "create_general_bid", featureName: "Create General Bid", description: "Create general type bids" },
  { module: "bids", featureCode: "create_plan_spec_bid", featureName: "Create Plan Spec Bid", description: "Create plan specification bids" },
  { module: "bids", featureCode: "create_design_build_bid", featureName: "Create Design Build Bid", description: "Create design build bids" },
  { module: "bids", featureCode: "create_service_bid", featureName: "Create Service Bid", description: "Create service bids" },
  { module: "bids", featureCode: "create_pm_bid", featureName: "Create PM Bid", description: "Create preventative maintenance bids" },
  { module: "bids", featureCode: "create_survey_bid", featureName: "Create Survey Bid", description: "Create survey bids" },
  { module: "bids", featureCode: "edit_bid_draft", featureName: "Edit Bid (Draft)", description: "Edit draft bids" },
  { module: "bids", featureCode: "edit_bid_pending", featureName: "Edit Bid (Pending)", description: "Edit pending bids" },
  { module: "bids", featureCode: "delete_bid", featureName: "Delete Bid", description: "Delete bids" },
  { module: "bids", featureCode: "use_templates", featureName: "Use Templates", description: "Use bid templates" },
  { module: "bids", featureCode: "create_templates", featureName: "Create Templates", description: "Create new bid templates" },
  { module: "bids", featureCode: "edit_templates", featureName: "Edit Templates", description: "Edit bid templates" },
  { module: "bids", featureCode: "delete_templates", featureName: "Delete Templates", description: "Delete bid templates" },
  { module: "bids", featureCode: "access_calculator", featureName: "Access Calculator", description: "Access cost calculation tools" },
  { module: "bids", featureCode: "view_cost_breakdown", featureName: "View Cost Breakdown", description: "View detailed cost breakdown" },
  { module: "bids", featureCode: "add_line_items", featureName: "Add Line Items", description: "Add cost line items" },
  { module: "bids", featureCode: "view_profit_margin", featureName: "View Profit Margin", description: "View profit margin calculations" },
  { module: "bids", featureCode: "approve_bid", featureName: "Approve Bid", description: "Approve bids for submission" },

  // === CLIENTS MODULE ===
  { module: "clients", featureCode: "view_clients", featureName: "View Clients", description: "View client listings" },
  { module: "clients", featureCode: "view_client_details", featureName: "View Client Details", description: "View detailed client information" },
  { module: "clients", featureCode: "create_client", featureName: "Create Client", description: "Create new client records" },
  { module: "clients", featureCode: "edit_client", featureName: "Edit Client", description: "Edit client information" },
  { module: "clients", featureCode: "delete_client", featureName: "Delete Client", description: "Delete client records" },
  { module: "clients", featureCode: "view_contact_info", featureName: "View Contact Info", description: "View client contact information" },
  { module: "clients", featureCode: "add_contacts", featureName: "Add Contacts", description: "Add client contacts" },
  { module: "clients", featureCode: "view_job_history", featureName: "View Job History", description: "View client job history" },
  { module: "clients", featureCode: "view_financial_info", featureName: "View Financial Info", description: "View client financial information" },

  // === PROPERTIES MODULE ===
  { module: "properties", featureCode: "view_properties", featureName: "View Properties", description: "View property listings" },
  { module: "properties", featureCode: "create_property", featureName: "Create Property", description: "Create new property records" },
  { module: "properties", featureCode: "edit_property", featureName: "Edit Property", description: "Edit property information" },
  { module: "properties", featureCode: "delete_property", featureName: "Delete Property", description: "Delete property records" },

  // === JOBS MODULE ===
  { module: "jobs", featureCode: "view_jobs", featureName: "View Jobs", description: "View job listings" },
  { module: "jobs", featureCode: "view_job_overview", featureName: "View Job Overview", description: "View job overview information" },
  { module: "jobs", featureCode: "create_job", featureName: "Create Job", description: "Create new jobs" },
  { module: "jobs", featureCode: "edit_job", featureName: "Edit Job", description: "Edit job information" },
  { module: "jobs", featureCode: "delete_job", featureName: "Delete Job", description: "Delete jobs" },
  { module: "jobs", featureCode: "change_status", featureName: "Change Status", description: "Change job status" },
  { module: "jobs", featureCode: "update_progress", featureName: "Update Progress", description: "Update job completion progress" },
  { module: "jobs", featureCode: "view_budget", featureName: "View Budget", description: "View job budget information" },
  { module: "jobs", featureCode: "create_invoice", featureName: "Create Invoice", description: "Create job invoices" },
  { module: "jobs", featureCode: "upload_photos", featureName: "Upload Photos", description: "Upload job photos" },
  { module: "jobs", featureCode: "view_expenses", featureName: "View Expenses", description: "View job expenses" },
  { module: "jobs", featureCode: "add_expense", featureName: "Add Expense", description: "Add job expenses" },
  { module: "jobs", featureCode: "approve_expenses", featureName: "Approve Expenses", description: "Approve job expenses" },

  // === FLEET MODULE ===
  { module: "fleet", featureCode: "view_fleet", featureName: "View Fleet", description: "View vehicle fleet" },
  { module: "fleet", featureCode: "view_vehicle_details", featureName: "View Vehicle Details", description: "View detailed vehicle information" },
  { module: "fleet", featureCode: "add_vehicle", featureName: "Add Vehicle", description: "Add new vehicles to fleet" },
  { module: "fleet", featureCode: "edit_vehicle_info", featureName: "Edit Vehicle Info", description: "Edit vehicle information" },
  { module: "fleet", featureCode: "delete_vehicle", featureName: "Delete Vehicle", description: "Remove vehicles from fleet" },
  { module: "fleet", featureCode: "assign_vehicle", featureName: "Assign Vehicle", description: "Assign vehicles to employees" },
  { module: "fleet", featureCode: "view_maintenance_history", featureName: "View Maintenance History", description: "View vehicle maintenance records" },
  { module: "fleet", featureCode: "submit_maintenance_record", featureName: "Submit Maintenance Record", description: "Submit maintenance records" },
  { module: "fleet", featureCode: "approve_maintenance", featureName: "Approve Maintenance", description: "Approve maintenance requests" },
  { module: "fleet", featureCode: "perform_safety_inspection", featureName: "Perform Safety Inspection", description: "Perform vehicle safety inspections" },
  { module: "fleet", featureCode: "upload_documents", featureName: "Upload Documents", description: "Upload vehicle documents" },

  // === FINANCIAL MODULE ===
  { module: "financial", featureCode: "view_invoices", featureName: "View Invoices", description: "View invoice listings" },
  { module: "financial", featureCode: "create_invoice", featureName: "Create Invoice", description: "Create new invoices" },
  { module: "financial", featureCode: "edit_invoice", featureName: "Edit Invoice", description: "Edit invoice information" },
  { module: "financial", featureCode: "delete_invoice", featureName: "Delete Invoice", description: "Delete invoices" },
  { module: "financial", featureCode: "send_invoice", featureName: "Send Invoice", description: "Send invoices to clients" },
  { module: "financial", featureCode: "record_payment", featureName: "Record Payment", description: "Record invoice payments" },
  { module: "financial", featureCode: "view_payment_history", featureName: "View Payment History", description: "View payment history" },
  { module: "financial", featureCode: "create_payment_plan", featureName: "Create Payment Plan", description: "Create payment plans" },
  { module: "financial", featureCode: "generate_aging_report", featureName: "Generate Aging Report", description: "Generate accounts receivable aging reports" },

  // === DISPATCH MODULE ===
  { module: "dispatch", featureCode: "view_daily_dispatch", featureName: "View Daily Dispatch", description: "View daily dispatch schedule" },
  { module: "dispatch", featureCode: "create_dispatch", featureName: "Create Dispatch", description: "Create dispatch assignments" },
  { module: "dispatch", featureCode: "edit_dispatch", featureName: "Edit Dispatch", description: "Edit dispatch assignments" },
  { module: "dispatch", featureCode: "assign_technicians", featureName: "Assign Technicians", description: "Assign technicians to jobs" },
  { module: "dispatch", featureCode: "confirm_dispatch", featureName: "Confirm Dispatch", description: "Confirm dispatch assignments" },
  { module: "dispatch", featureCode: "view_calendar", featureName: "View Calendar", description: "View dispatch calendar" },

  // === INVENTORY MODULE ===
  { module: "inventory", featureCode: "view_inventory", featureName: "View Inventory", description: "View inventory items" },
  { module: "inventory", featureCode: "add_item", featureName: "Add Item", description: "Add new inventory items" },
  { module: "inventory", featureCode: "edit_item", featureName: "Edit Item", description: "Edit inventory items" },
  { module: "inventory", featureCode: "delete_item", featureName: "Delete Item", description: "Delete inventory items" },
  { module: "inventory", featureCode: "adjust_quantity", featureName: "Adjust Quantity", description: "Adjust inventory quantities" },
  { module: "inventory", featureCode: "create_purchase_order", featureName: "Create Purchase Order", description: "Create purchase orders" },
  { module: "inventory", featureCode: "mark_as_received", featureName: "Mark as Received", description: "Mark items as received" },

  // === PAYROLL MODULE ===
  { module: "payroll", featureCode: "view_payroll", featureName: "View Payroll", description: "View payroll information" },
  { module: "payroll", featureCode: "process_payroll", featureName: "Process Payroll", description: "Process employee payroll" },
  { module: "payroll", featureCode: "approve_payroll", featureName: "Approve Payroll", description: "Approve payroll runs" },
  { module: "payroll", featureCode: "view_pay_stubs", featureName: "View Pay Stubs", description: "View employee pay stubs" },

  // === REPORTS MODULE ===
  { module: "reports", featureCode: "view_reports", featureName: "View Reports", description: "View system reports" },
  { module: "reports", featureCode: "generate_reports", featureName: "Generate Reports", description: "Generate custom reports" },
  { module: "reports", featureCode: "export_reports", featureName: "Export Reports", description: "Export reports to various formats" },

  // === SETTINGS MODULE (Executive only) ===
  { module: "settings", featureCode: "view_settings", featureName: "View Settings", description: "Access settings module" },
  { module: "settings", featureCode: "edit_general", featureName: "Edit General Settings", description: "Edit company info and announcements" },
  { module: "settings", featureCode: "edit_labor_rates", featureName: "Edit Labor Rates", description: "Manage labor rate templates" },
  { module: "settings", featureCode: "edit_vehicle_travel", featureName: "Edit Vehicle & Travel", description: "Manage vehicle and travel defaults" },
  { module: "settings", featureCode: "edit_operating_expenses", featureName: "Edit Operating Expenses", description: "Manage operating expense defaults" },
  { module: "settings", featureCode: "edit_proposal_templates", featureName: "Edit Proposal Templates", description: "Manage proposal basis templates" },
  { module: "settings", featureCode: "edit_terms_conditions", featureName: "Edit Terms & Conditions", description: "Manage terms and conditions templates" },
  { module: "settings", featureCode: "edit_invoice_settings", featureName: "Edit Invoice Settings", description: "Manage invoice settings" },

  // Performance & Compliance Features
  { module: "performance", featureCode: "view_own_reviews", featureName: "View Own Reviews", description: "View own performance reviews" },
  { module: "performance", featureCode: "conduct_reviews", featureName: "Conduct Reviews", description: "Create and manage performance reviews" },
  { module: "performance", featureCode: "view_incident_reports", featureName: "View Incident Reports", description: "View incident reports" },
  { module: "performance", featureCode: "create_incident_reports", featureName: "Create Incident Reports", description: "Create new incident reports" },
  { module: "performance", featureCode: "edit_incident_reports", featureName: "Edit Incident Reports", description: "Edit incident reports" },
  { module: "performance", featureCode: "apply_violation_strike", featureName: "Apply Violation Strike", description: "Apply disciplinary actions" },

  // Timesheet Features
  { module: "timesheet", featureCode: "view_own_timesheets", featureName: "View Own Timesheets", description: "View own timesheet entries" },
  { module: "timesheet", featureCode: "create_timesheet", featureName: "Create Timesheet Entry", description: "Create new timesheet entries" },
  { module: "timesheet", featureCode: "edit_own_timesheets", featureName: "Edit Own Timesheets", description: "Edit own pending timesheets" },
  { module: "timesheet", featureCode: "view_others_timesheets", featureName: "View Others Timesheets", description: "View team timesheets" },
  { module: "timesheet", featureCode: "edit_others_timesheets", featureName: "Edit Others Timesheets", description: "Edit any timesheets" },
  { module: "timesheet", featureCode: "approve_timesheets", featureName: "Approve Timesheets", description: "Approve/reject timesheets" },
  { module: "timesheet", featureCode: "view_labor_costs", featureName: "View Labor Costs", description: "View labor cost information" },

  // Bid Features
  { module: "bids", featureCode: "view", featureName: "View Bids", description: "View bid information" },
  { module: "bids", featureCode: "create", featureName: "Create Bids", description: "Create new bids" },
  { module: "bids", featureCode: "edit_own", featureName: "Edit Own Bids", description: "Edit own draft bids" },
  { module: "bids", featureCode: "edit_pending", featureName: "Edit Pending Bids", description: "Edit bids after submission" },
  { module: "bids", featureCode: "delete", featureName: "Delete Bids", description: "Delete bids" },
  { module: "bids", featureCode: "use_templates", featureName: "Use Templates", description: "Use bid templates" },
  { module: "bids", featureCode: "create_templates", featureName: "Create Templates", description: "Create bid templates" },
  { module: "bids", featureCode: "approve", featureName: "Approve Bids", description: "Approve/reject bids" },

  // Client Features
  { module: "clients", featureCode: "view", featureName: "View Clients", description: "View client information" },
  { module: "clients", featureCode: "create", featureName: "Create Client", description: "Add new clients" },
  { module: "clients", featureCode: "edit", featureName: "Edit Client", description: "Edit client information" },
  { module: "clients", featureCode: "delete", featureName: "Delete Client", description: "Delete clients" },
  { module: "clients", featureCode: "view_financial", featureName: "View Client Financial", description: "View client financial information" },
  { module: "clients", featureCode: "manage_billing", featureName: "Manage Billing", description: "Manage client billing settings" },

  // Job Features
  { module: "jobs", featureCode: "view", featureName: "View Jobs", description: "View job information" },
  { module: "jobs", featureCode: "create", featureName: "Create Jobs", description: "Create new jobs" },
  { module: "jobs", featureCode: "edit", featureName: "Edit Jobs", description: "Edit job information" },
  { module: "jobs", featureCode: "change_status", featureName: "Change Job Status", description: "Change job status" },
  { module: "jobs", featureCode: "update_progress", featureName: "Update Progress", description: "Update job completion progress" },
  { module: "jobs", featureCode: "view_financial", featureName: "View Job Financial", description: "View job financial information" },
  { module: "jobs", featureCode: "manage_invoices", featureName: "Manage Invoices", description: "Create and manage job invoices" },

  // Fleet Features
  { module: "fleet", featureCode: "view", featureName: "View Fleet", description: "View fleet information" },
  { module: "fleet", featureCode: "add_vehicle", featureName: "Add Vehicle", description: "Add new vehicles" },
  { module: "fleet", featureCode: "edit_vehicle", featureName: "Edit Vehicle", description: "Edit vehicle information" },
  { module: "fleet", featureCode: "delete_vehicle", featureName: "Delete Vehicle", description: "Remove vehicles" },
  { module: "fleet", featureCode: "assign_vehicle", featureName: "Assign Vehicle", description: "Assign vehicles to employees" },
  { module: "fleet", featureCode: "maintenance", featureName: "Vehicle Maintenance", description: "Manage vehicle maintenance" },
  { module: "fleet", featureCode: "safety_inspection", featureName: "Safety Inspection", description: "Perform safety inspections" },
  { module: "fleet", featureCode: "view_costs", featureName: "View Vehicle Costs", description: "View vehicle financial information" },

  // Inventory Features
  { module: "inventory", featureCode: "view", featureName: "View Inventory", description: "View inventory items" },
  { module: "inventory", featureCode: "add_item", featureName: "Add Item", description: "Add new inventory items" },
  { module: "inventory", featureCode: "edit_item", featureName: "Edit Item", description: "Edit inventory items" },
  { module: "inventory", featureCode: "delete_item", featureName: "Delete Item", description: "Delete inventory items" },
  { module: "inventory", featureCode: "adjust_quantity", featureName: "Adjust Quantity", description: "Adjust inventory quantities" },
  { module: "inventory", featureCode: "confirm_receipt", featureName: "Confirm Receipt", description: "Confirm material receipt" },
  { module: "inventory", featureCode: "view_costs", featureName: "View Costs", description: "View inventory costs" },

  // Task & Dispatch Features
  { module: "tasks", featureCode: "view_own", featureName: "View Own Tasks", description: "View assigned tasks" },
  { module: "tasks", featureCode: "view_all", featureName: "View All Tasks", description: "View all tasks" },
  { module: "tasks", featureCode: "create", featureName: "Create Task", description: "Create new tasks" },
  { module: "tasks", featureCode: "assign", featureName: "Assign Task", description: "Assign tasks to users" },
  { module: "tasks", featureCode: "edit", featureName: "Edit Task", description: "Edit tasks" },
  { module: "tasks", featureCode: "delete", featureName: "Delete Task", description: "Delete tasks" },

  { module: "dispatch", featureCode: "view_own", featureName: "View Own Dispatch", description: "View own dispatch schedule" },
  { module: "dispatch", featureCode: "view_all", featureName: "View All Dispatch", description: "View all dispatch schedules" },
  { module: "dispatch", featureCode: "create", featureName: "Create Dispatch", description: "Create dispatch assignments" },
  { module: "dispatch", featureCode: "edit", featureName: "Edit Dispatch", description: "Edit dispatch assignments" },
  { module: "dispatch", featureCode: "assign_technicians", featureName: "Assign Technicians", description: "Assign technicians to jobs" },

  // Expense Features
  { module: "expenses", featureCode: "view_own", featureName: "View Own Expenses", description: "View own expenses" },
  { module: "expenses", featureCode: "view_all", featureName: "View All Expenses", description: "View all expenses" },
  { module: "expenses", featureCode: "create", featureName: "Create Expense", description: "Create expense entries" },
  { module: "expenses", featureCode: "edit_own", featureName: "Edit Own Expenses", description: "Edit own pending expenses" },
  { module: "expenses", featureCode: "approve", featureName: "Approve Expenses", description: "Approve/reject expenses" },

  // Financial Features (Executive only)
  { module: "financial", featureCode: "view", featureName: "View Financial", description: "View financial information" },
  { module: "financial", featureCode: "edit", featureName: "Edit Financial", description: "Edit financial settings" },
  { module: "payroll", featureCode: "view", featureName: "View Payroll", description: "View payroll information" },
  { module: "payroll", featureCode: "process", featureName: "Process Payroll", description: "Process payroll" },

  // Invoicing Features
  { module: "invoicing", featureCode: "view", featureName: "View Invoices", description: "View invoices" },
  { module: "invoicing", featureCode: "create", featureName: "Create Invoice", description: "Create invoices" },
  { module: "invoicing", featureCode: "edit", featureName: "Edit Invoice", description: "Edit invoices" },
  { module: "invoicing", featureCode: "send", featureName: "Send Invoice", description: "Send invoices to clients" },
  { module: "invoicing", featureCode: "record_payment", featureName: "Record Payment", description: "Record invoice payments" },

  // Document Features
  { module: "documents", featureCode: "view", featureName: "View Documents", description: "View documents" },
  { module: "documents", featureCode: "upload", featureName: "Upload Documents", description: "Upload documents" },
  { module: "documents", featureCode: "edit", featureName: "Edit Documents", description: "Edit documents" },
  { module: "documents", featureCode: "delete", featureName: "Delete Documents", description: "Delete documents" },

  // === FILES MODULE (Executive only) ===
  { module: "files", featureCode: "view", featureName: "View Files", description: "View file library" },
  { module: "files", featureCode: "upload", featureName: "Upload Files", description: "Upload files" },
  { module: "files", featureCode: "edit", featureName: "Edit Files", description: "Edit file metadata" },
  { module: "files", featureCode: "delete", featureName: "Delete Files", description: "Delete files" },

  // === BULK DELETE — Executive only ===
  { module: "bids",       featureCode: "bulk_delete", featureName: "Bulk Delete Bids",       description: "Bulk soft-delete bids (Executive only)" },
  { module: "jobs",       featureCode: "bulk_delete", featureName: "Bulk Delete Jobs",       description: "Bulk soft-delete jobs (Executive only)" },
  { module: "dispatch",   featureCode: "bulk_delete", featureName: "Bulk Delete Dispatch",   description: "Bulk soft-delete dispatch tasks (Executive only)" },
  { module: "timesheet",  featureCode: "bulk_delete", featureName: "Bulk Delete Timesheets", description: "Bulk soft-delete timesheets (Executive only)" },
  { module: "expenses",   featureCode: "bulk_delete", featureName: "Bulk Delete Expenses",   description: "Bulk soft-delete expenses (Executive only)" },
  { module: "invoicing",  featureCode: "bulk_delete", featureName: "Bulk Delete Invoices",   description: "Bulk soft-delete invoices (Executive only)" },
  { module: "clients",    featureCode: "bulk_delete", featureName: "Bulk Delete Clients",    description: "Bulk soft-delete clients (Executive only)" },
  { module: "team",       featureCode: "bulk_delete", featureName: "Bulk Delete Team",       description: "Bulk soft-delete employees/departments (Executive only)" },
  { module: "payroll",    featureCode: "bulk_delete", featureName: "Bulk Delete Payroll",    description: "Bulk soft-delete payroll runs (Executive only)" },
  { module: "compliance", featureCode: "bulk_delete", featureName: "Bulk Delete Compliance", description: "Bulk soft-delete compliance cases (Executive only)" },
  { module: "fleet",      featureCode: "bulk_delete", featureName: "Bulk Delete Fleet",      description: "Bulk soft-delete vehicles (Executive only)" },
  { module: "inventory",  featureCode: "bulk_delete", featureName: "Bulk Delete Inventory",  description: "Bulk soft-delete inventory items (Executive only)" },
];

/**
 * Role-Feature mappings based on CSV matrix
 */
const ROLE_FEATURES_DATA = [
  // === TECHNICIAN (Role ID: 3) - Limited access, assigned/own only ===
  
  // Dashboard - Limited view
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_recent_updates", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_recent_jobs", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_completed_jobs", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_priority_jobs", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_dispatch", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_new_bids", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_invoicing_queue", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_outstanding_payments", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_revenue_chart", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dashboard", featureCode: "view_performance", accessLevel: "none" },

  // Team - Own profile only
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_employees", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_own_profile", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "edit_own_profile", accessLevel: "edit_own" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_other_profiles", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "edit_other_profiles", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "update_contact_info", accessLevel: "edit_own" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "update_emergency_contact", accessLevel: "edit_own" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "update_bank_details", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_pay_rate", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "add_users", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "remove_users", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "assign_roles", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "update_employment_status", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "update_pay_rate", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_own_activity", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "team", featureCode: "view_others_activity", accessLevel: "none" },

  // Compliance - Own reviews and can create incident reports
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "view_own_reviews", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "conduct_reviews", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "rate_performance", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "view_incident_reports", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "create_incident_reports", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "edit_incident_reports", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "apply_violation_strike", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "view_audit_logs", accessLevel: "none" },

  // Timesheet - Full access to own
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "view_own_timesheets", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "create_timesheet_entry", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "edit_own_timesheets", accessLevel: "edit_own" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "delete_own_timesheets", accessLevel: "delete_own" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "view_others_timesheets", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "edit_others_timesheets", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "add_job_notes", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "track_standard_time", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "track_overtime", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "submit_for_approval", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "approve_timesheets", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "reject_timesheets", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "view_violations", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "clear_violations", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "view_labor_costs", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", featureCode: "view_billable_amounts", accessLevel: "none" },

  // Bids - View assigned only
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "view_bids", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_general_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_plan_spec_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_design_build_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_service_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_pm_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_survey_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "edit_bid_draft", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "edit_bid_pending", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "delete_bid", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "use_templates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "create_templates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "edit_templates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "delete_templates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "access_calculator", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "view_cost_breakdown", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "add_line_items", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "view_profit_margin", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids", featureCode: "approve_bid", accessLevel: "none" },

  // Clients - Assigned jobs only
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "view_clients", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "view_client_details", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "create_client", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "edit_client", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "delete_client", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "view_contact_info", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "add_contacts", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "view_job_history", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "clients", featureCode: "view_financial_info", accessLevel: "none" },

  // Properties - Job related only  
  { roleId: ROLES.TECHNICIAN, module: "properties", featureCode: "view_properties", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "properties", featureCode: "create_property", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "properties", featureCode: "edit_property", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "properties", featureCode: "delete_property", accessLevel: "none" },

  // Jobs - Assigned only
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "view_jobs", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "view_job_overview", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "create_job", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "edit_job", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "delete_job", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "change_status", accessLevel: "edit_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "update_progress", accessLevel: "edit_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "view_budget", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "create_invoice", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "upload_photos", accessLevel: "edit_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "view_expenses", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "add_expense", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", featureCode: "approve_expenses", accessLevel: "none" },

  // Fleet - Assigned vehicle only
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "view_fleet", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "view_vehicle_details", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "add_vehicle", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "edit_vehicle_info", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "delete_vehicle", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "assign_vehicle", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "view_maintenance_history", accessLevel: "view_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "submit_maintenance_record", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "approve_maintenance", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "perform_safety_inspection", accessLevel: "edit_assigned" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", featureCode: "upload_documents", accessLevel: "create" },

  // Financial - No access
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "view_invoices", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "create_invoice", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "edit_invoice", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "delete_invoice", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "send_invoice", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "record_payment", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "view_payment_history", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "create_payment_plan", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "financial", featureCode: "generate_aging_report", accessLevel: "none" },

  // Dispatch - Own schedule only
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "view_daily_dispatch", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "create_dispatch", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "edit_dispatch", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "assign_technicians", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "confirm_dispatch", accessLevel: "create" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", featureCode: "view_calendar", accessLevel: "view_own" },

  // Inventory - View and confirm receipt
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "view_inventory", accessLevel: "view" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "add_item", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "edit_item", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "delete_item", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "adjust_quantity", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "create_purchase_order", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", featureCode: "mark_as_received", accessLevel: "edit_assigned" },

  // Payroll - No access
  { roleId: ROLES.TECHNICIAN, module: "payroll", featureCode: "view_payroll", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "payroll", featureCode: "process_payroll", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "payroll", featureCode: "approve_payroll", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "payroll", featureCode: "view_pay_stubs", accessLevel: "none" },

  // Reports - Own only
  { roleId: ROLES.TECHNICIAN, module: "reports", featureCode: "view_reports", accessLevel: "view_own" },
  { roleId: ROLES.TECHNICIAN, module: "reports", featureCode: "generate_reports", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "reports", featureCode: "export_reports", accessLevel: "none" },

  // Settings - No access (Executive only)
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "view_settings", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_general", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_labor_rates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_vehicle_travel", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_operating_expenses", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_proposal_templates", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_terms_conditions", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "settings", featureCode: "edit_invoice_settings", accessLevel: "none" },

  // Files - No access (Executive only)
  { roleId: ROLES.TECHNICIAN, module: "files", featureCode: "view", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "files", featureCode: "upload", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "files", featureCode: "edit", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "files", featureCode: "delete", accessLevel: "none" },

  // === MANAGER (Role ID: 2) - Full operational access, limited financial ===
  
  // Dashboard - Full view except financial details
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_recent_updates", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_new_bids", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_recent_jobs", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_completed_jobs", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_invoicing_queue", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_outstanding_payments", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_revenue_chart", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_performance", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_priority_jobs", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dashboard", featureCode: "view_dispatch", accessLevel: "view" },

  // Team - Can add users, view team, but not edit pay
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_employees", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_own_profile", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "edit_own_profile", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_other_profiles", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "edit_other_profiles", accessLevel: "edit_team" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "update_contact_info", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "update_emergency_contact", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "update_bank_details", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_pay_rate", accessLevel: "view_own" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "add_users", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "remove_users", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "assign_roles", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "update_employment_status", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "update_pay_rate", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_own_activity", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "team", featureCode: "view_others_activity", accessLevel: "view_team" },

  // Compliance - Team management
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "view_own_reviews", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "conduct_reviews", accessLevel: "edit_team" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "rate_performance", accessLevel: "edit_team" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "view_incident_reports", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "create_incident_reports", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "edit_incident_reports", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "apply_violation_strike", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "compliance", featureCode: "view_audit_logs", accessLevel: "view" },

  // Timesheet - Team management
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "view_own_timesheets", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "create_timesheet_entry", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "edit_own_timesheets", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "delete_own_timesheets", accessLevel: "delete_own" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "view_others_timesheets", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "edit_others_timesheets", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "add_job_notes", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "track_standard_time", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "track_overtime", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "submit_for_approval", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "approve_timesheets", accessLevel: "approve" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "reject_timesheets", accessLevel: "approve" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "view_violations", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "clear_violations", accessLevel: "approve" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "view_labor_costs", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "timesheet", featureCode: "view_billable_amounts", accessLevel: "view" },

  // Bids - Full access except approval
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "view_bids", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_general_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_plan_spec_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_design_build_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_service_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_pm_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_survey_bid", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "edit_bid_draft", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "edit_bid_pending", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "delete_bid", accessLevel: "delete_own" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "use_templates", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "create_templates", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "edit_templates", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "delete_templates", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "access_calculator", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "view_cost_breakdown", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "add_line_items", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "view_profit_margin", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "bids", featureCode: "approve_bid", accessLevel: "none" },

  // Clients - Full access except delete
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view_clients", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view_client_details", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "create_client", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "edit_client", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "delete_client", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view_contact_info", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "add_contacts", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view_job_history", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view_financial_info", accessLevel: "view" },

  // Properties - Full access except delete
  { roleId: ROLES.MANAGER, module: "properties", featureCode: "view_properties", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "properties", featureCode: "create_property", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "properties", featureCode: "edit_property", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "properties", featureCode: "delete_property", accessLevel: "none" },

  // Jobs - Full access
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view_jobs", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view_job_overview", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "create_job", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "edit_job", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "delete_job", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "change_status", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "update_progress", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view_budget", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "create_invoice", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "upload_photos", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view_expenses", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "add_expense", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "approve_expenses", accessLevel: "approve" },

  // Fleet - Full access except add/delete and financial details
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "view_fleet", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "view_vehicle_details", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "add_vehicle", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "edit_vehicle_info", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "delete_vehicle", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "assign_vehicle", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "view_maintenance_history", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "submit_maintenance_record", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "approve_maintenance", accessLevel: "approve" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "perform_safety_inspection", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "upload_documents", accessLevel: "create" },

  // Financial - Limited access
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "view_invoices", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "create_invoice", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "edit_invoice", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "delete_invoice", accessLevel: "delete_own" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "send_invoice", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "record_payment", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "view_payment_history", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "create_payment_plan", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "financial", featureCode: "generate_aging_report", accessLevel: "view" },

  // Dispatch - Full access
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "view_daily_dispatch", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "create_dispatch", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "edit_dispatch", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "assign_technicians", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "confirm_dispatch", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "view_calendar", accessLevel: "view" },

  // Inventory - Full access except delete
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "view_inventory", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "add_item", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "edit_item", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "delete_item", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "adjust_quantity", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "create_purchase_order", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "mark_as_received", accessLevel: "edit_all" },

  // Payroll - No access
  { roleId: ROLES.MANAGER, module: "payroll", featureCode: "view_payroll", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "payroll", featureCode: "process_payroll", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "payroll", featureCode: "approve_payroll", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "payroll", featureCode: "view_pay_stubs", accessLevel: "none" },

  // Reports - Team reports
  { roleId: ROLES.MANAGER, module: "reports", featureCode: "view_reports", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "reports", featureCode: "generate_reports", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "reports", featureCode: "export_reports", accessLevel: "create" },

  // Settings - No access (Executive only)
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "view_settings", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_general", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_labor_rates", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_vehicle_travel", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_operating_expenses", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_proposal_templates", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_terms_conditions", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "settings", featureCode: "edit_invoice_settings", accessLevel: "none" },

  // Files - No access (Executive only)
  { roleId: ROLES.MANAGER, module: "files", featureCode: "view", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "files", featureCode: "upload", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "files", featureCode: "edit", accessLevel: "none" },
  { roleId: ROLES.MANAGER, module: "files", featureCode: "delete", accessLevel: "none" },

  // === EXECUTIVE (Role ID: 1) - Full admin access ===
  
  // Dashboard - Full access
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_recent_updates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_new_bids", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_recent_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_completed_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_invoicing_queue", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_outstanding_payments", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_revenue_chart", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_performance", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_priority_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_dispatch", accessLevel: "admin" },

  // Team - Full access
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_employees", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_own_profile", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "edit_own_profile", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_other_profiles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "edit_other_profiles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_contact_info", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_emergency_contact", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_bank_details", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_pay_rate", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "add_users", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "remove_users", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "assign_roles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_employment_status", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_pay_rate", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_own_activity", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_others_activity", accessLevel: "admin" },

  // Compliance - Full access
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "view_own_reviews", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "conduct_reviews", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "rate_performance", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "view_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "create_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "edit_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "apply_violation_strike", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "compliance", featureCode: "view_audit_logs", accessLevel: "admin" },

  // All other modules for Executive have admin access
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_own_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "create_timesheet_entry", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "edit_own_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "delete_own_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_others_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "edit_others_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "add_job_notes", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "track_standard_time", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "track_overtime", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "submit_for_approval", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "approve_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "reject_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_violations", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "clear_violations", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_labor_costs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_billable_amounts", accessLevel: "admin" },

  // Bids - Full access  
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "view_bids", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_general_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_plan_spec_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_design_build_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_service_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_pm_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_survey_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "edit_bid_draft", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "edit_bid_pending", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "delete_bid", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "use_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "edit_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "delete_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "access_calculator", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "view_cost_breakdown", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "add_line_items", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "view_profit_margin", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "approve_bid", accessLevel: "admin" },

  // Continue for all other modules...
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_clients", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_client_details", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "create_client", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "edit_client", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "delete_client", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_contact_info", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "add_contacts", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_job_history", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_financial_info", accessLevel: "admin" },

  // Properties - Full access
  { roleId: ROLES.EXECUTIVE, module: "properties", featureCode: "view_properties", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "properties", featureCode: "create_property", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "properties", featureCode: "edit_property", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "properties", featureCode: "delete_property", accessLevel: "admin" },

  // Jobs - Full access
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view_job_overview", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "create_job", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "edit_job", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "delete_job", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "change_status", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "update_progress", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view_budget", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "create_invoice", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "upload_photos", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view_expenses", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "add_expense", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "approve_expenses", accessLevel: "admin" },

  // Fleet - Full access
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "view_fleet", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "view_vehicle_details", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "add_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "edit_vehicle_info", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "delete_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "assign_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "view_maintenance_history", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "submit_maintenance_record", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "approve_maintenance", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "perform_safety_inspection", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "upload_documents", accessLevel: "admin" },

  // Financial - Full access
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "view_invoices", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "create_invoice", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "edit_invoice", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "delete_invoice", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "send_invoice", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "record_payment", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "view_payment_history", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "create_payment_plan", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "generate_aging_report", accessLevel: "admin" },

  // Dispatch - Full access
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "view_daily_dispatch", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "create_dispatch", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "edit_dispatch", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "assign_technicians", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "confirm_dispatch", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "view_calendar", accessLevel: "admin" },

  // Inventory - Full access
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "view_inventory", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "add_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "edit_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "delete_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "adjust_quantity", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "create_purchase_order", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "mark_as_received", accessLevel: "admin" },

  // Payroll - Full access (Executive only)
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "view_payroll", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "process_payroll", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "approve_payroll", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "view_pay_stubs", accessLevel: "admin" },

  // Reports - Full access
  { roleId: ROLES.EXECUTIVE, module: "reports", featureCode: "view_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "reports", featureCode: "generate_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "reports", featureCode: "export_reports", accessLevel: "admin" },

  // Settings - Full access (Executive only)
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "view_settings", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_general", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_labor_rates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_vehicle_travel", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_operating_expenses", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_proposal_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_terms_conditions", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "settings", featureCode: "edit_invoice_settings", accessLevel: "admin" },

  // Files - Full access (Executive only)
  { roleId: ROLES.EXECUTIVE, module: "files", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "files", featureCode: "upload", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "files", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "files", featureCode: "delete", accessLevel: "admin" },

  // OLD DATA - TO BE CLEANED UP LATER
  // Clients - Full access except financial details
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "clients", featureCode: "edit", accessLevel: "edit_all" },

  // Jobs - Full operational access
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "edit", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "change_status", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "update_progress", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "view_financial", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "jobs", featureCode: "manage_invoices", accessLevel: "edit_all" },

  // Fleet - Full operational access, limited financial
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "edit_vehicle", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "assign_vehicle", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "maintenance", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "fleet", featureCode: "safety_inspection", accessLevel: "edit_all" },

  // Inventory - Full operational access
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "add_item", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "edit_item", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "adjust_quantity", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "inventory", featureCode: "confirm_receipt", accessLevel: "edit_all" },

  // Tasks - Full access
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "view_own", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "view_all", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "assign", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "edit", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "tasks", featureCode: "delete", accessLevel: "delete_own" },

  // Dispatch - Full access
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "view_own", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "view_all", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "edit", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "dispatch", featureCode: "assign_technicians", accessLevel: "edit_all" },

  // Expenses - Team management
  { roleId: ROLES.MANAGER, module: "expenses", featureCode: "view_own", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "expenses", featureCode: "view_all", accessLevel: "view_team" },
  { roleId: ROLES.MANAGER, module: "expenses", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "expenses", featureCode: "edit_own", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "expenses", featureCode: "approve", accessLevel: "approve" },

  // Invoicing - Full access
  { roleId: ROLES.MANAGER, module: "invoicing", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "invoicing", featureCode: "create", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "invoicing", featureCode: "edit", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "invoicing", featureCode: "send", accessLevel: "edit_all" },
  { roleId: ROLES.MANAGER, module: "invoicing", featureCode: "record_payment", accessLevel: "edit_all" },

  // Documents - Full access
  { roleId: ROLES.MANAGER, module: "documents", featureCode: "view", accessLevel: "view" },
  { roleId: ROLES.MANAGER, module: "documents", featureCode: "upload", accessLevel: "create" },
  { roleId: ROLES.MANAGER, module: "documents", featureCode: "edit", accessLevel: "edit_own" },
  { roleId: ROLES.MANAGER, module: "documents", featureCode: "delete", accessLevel: "delete_own" },

  // EXECUTIVE (Officer) - Full access to everything
  
  // Dashboard - Full access
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_recent_updates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_new_bids", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_recent_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_completed_jobs", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_invoicing_queue", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_outstanding_payments", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_revenue_chart", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dashboard", featureCode: "view_performance", accessLevel: "admin" },

  // User Management - Full administrative access
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_employees", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_own_profile", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "edit_own_profile", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "view_other_profiles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "edit_other_profiles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "add_users", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "remove_users", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "assign_roles", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_employment_status", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "team", featureCode: "update_pay_rate", accessLevel: "admin" },

  // Performance - Full access
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "view_own_reviews", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "conduct_reviews", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "view_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "create_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "edit_incident_reports", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "performance", featureCode: "apply_violation_strike", accessLevel: "admin" },

  // Timesheet - Full access
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_own_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "create_timesheet", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "edit_own_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_others_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "edit_others_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "approve_timesheets", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "timesheet", featureCode: "view_labor_costs", accessLevel: "admin" },

  // All other modules - Full admin access
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "edit_own", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "edit_pending", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "delete", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "use_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "create_templates", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "bids", featureCode: "approve", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "delete", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "view_financial", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "clients", featureCode: "manage_billing", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "change_status", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "update_progress", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "view_financial", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "jobs", featureCode: "manage_invoices", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "add_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "edit_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "delete_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "assign_vehicle", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "maintenance", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "safety_inspection", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "fleet", featureCode: "view_costs", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "add_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "edit_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "delete_item", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "adjust_quantity", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "confirm_receipt", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "inventory", featureCode: "view_costs", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "view_own", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "view_all", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "assign", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "tasks", featureCode: "delete", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "view_own", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "view_all", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "dispatch", featureCode: "assign_technicians", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "expenses", featureCode: "view_own", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "expenses", featureCode: "view_all", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "expenses", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "expenses", featureCode: "edit_own", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "expenses", featureCode: "approve", accessLevel: "admin" },

  // Financial & Payroll - Executive only
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "financial", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "payroll", featureCode: "process", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "invoicing", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "invoicing", featureCode: "create", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "invoicing", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "invoicing", featureCode: "send", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "invoicing", featureCode: "record_payment", accessLevel: "admin" },

  { roleId: ROLES.EXECUTIVE, module: "documents", featureCode: "view", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "documents", featureCode: "upload", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "documents", featureCode: "edit", accessLevel: "admin" },
  { roleId: ROLES.EXECUTIVE, module: "documents", featureCode: "delete", accessLevel: "admin" },

  // === BULK DELETE — Executive = delete_all, Manager = none, Technician = none ===
  { roleId: ROLES.EXECUTIVE,  module: "bids",       featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "bids",       featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "bids",       featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "jobs",       featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "jobs",       featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "jobs",       featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "dispatch",   featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "dispatch",   featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch",   featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "timesheet",  featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "timesheet",  featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet",  featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "expenses",   featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "expenses",   featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "expenses",   featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "invoicing",  featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "invoicing",  featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "invoicing",  featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "clients",    featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "clients",    featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "clients",    featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "team",       featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "team",       featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "team",       featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "payroll",    featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "payroll",    featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "payroll",    featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "compliance", featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "compliance", featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "compliance", featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "fleet",      featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "fleet",      featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "fleet",      featureCode: "bulk_delete", accessLevel: "none" },

  { roleId: ROLES.EXECUTIVE,  module: "inventory",  featureCode: "bulk_delete", accessLevel: "delete_all" },
  { roleId: ROLES.MANAGER,    module: "inventory",  featureCode: "bulk_delete", accessLevel: "none" },
  { roleId: ROLES.TECHNICIAN, module: "inventory",  featureCode: "bulk_delete", accessLevel: "none" },
];

/**
 * Data filters based on CSV matrix
 */
const DATA_FILTERS_DATA = [
  // Technician filters - assigned/own only
  { roleId: ROLES.TECHNICIAN, module: "jobs", filterType: "assigned_only", filterRule: "assigned_to = :userId", description: "Technicians can only see jobs assigned to them" },
  { roleId: ROLES.TECHNICIAN, module: "bids", filterType: "assigned_only", filterRule: "job_id IN (SELECT id FROM jobs WHERE assigned_to = :userId)", description: "Technicians can only see bids for assigned jobs" },
  { roleId: ROLES.TECHNICIAN, module: "clients", filterType: "assigned_only", filterRule: "client has jobs where technician is team member", description: "Technicians can only see clients they have worked or are working for" },
  { roleId: ROLES.TECHNICIAN, module: "properties", filterType: "assigned_only", filterRule: "property has jobs where technician is team member", description: "Technicians can only see properties they have worked or are working at" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", filterType: "assigned_only", filterRule: "assigned_to = :userId", description: "Technicians can only see their assigned vehicle" },
  { roleId: ROLES.TECHNICIAN, module: "tasks", filterType: "assigned_only", filterRule: "assigned_to = :userId", description: "Technicians can only see their assigned tasks" },
  { roleId: ROLES.TECHNICIAN, module: "dispatch", filterType: "assigned_only", filterRule: "assigned_to = :userId", description: "Technicians can only see their dispatch schedule" },
  { roleId: ROLES.TECHNICIAN, module: "expenses", filterType: "own_only", filterRule: "created_by = :userId", description: "Technicians can only see their own expenses" },
  { roleId: ROLES.TECHNICIAN, module: "timesheet", filterType: "own_only", filterRule: "user_id = :userId", description: "Technicians can only see their own timesheets" },
  { roleId: ROLES.TECHNICIAN, module: "performance", filterType: "own_only", filterRule: "employee_id = :employeeId", description: "Technicians can only see their own reviews" },
  { roleId: ROLES.TECHNICIAN, module: "documents", filterType: "job_related", filterRule: "job_id IN (SELECT id FROM jobs WHERE assigned_to = :userId)", description: "Technicians can only see job-related documents" },

  // Hide financial data for Technicians
  { roleId: ROLES.TECHNICIAN, module: "jobs", filterType: "hide_financial", filterRule: "exclude_fields: cost,profit,labor_rate,total_cost", description: "Hide financial fields from technicians" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", filterType: "hide_financial", filterRule: "exclude_fields: purchase_cost,monthly_payment,maintenance_cost", description: "Hide vehicle costs from technicians" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", filterType: "hide_financial", filterRule: "exclude_fields: cost,markup,total_cost", description: "Hide inventory costs from technicians" },

  // Manager filters - department level for some modules
  { roleId: ROLES.MANAGER, module: "performance", filterType: "department_only", filterRule: "department_id = :departmentId", description: "Managers can only manage their department's reviews" },
  { roleId: ROLES.MANAGER, module: "timesheet", filterType: "department_only", filterRule: "user_id IN (SELECT user_id FROM employees WHERE department_id = :departmentId)", description: "Managers can approve timesheets for their department" },

  // Hide sensitive financial data for Managers (no individual pay rates)
  { roleId: ROLES.MANAGER, module: "team", filterType: "hide_financial", filterRule: "exclude_fields: hourly_rate,salary,pay_rate", description: "Hide individual pay rates from managers" },
  { roleId: ROLES.MANAGER, module: "timesheet", filterType: "hide_rates", filterRule: "exclude_fields: hourly_rate,cost_rate", description: "Managers see totals but not individual rates" },

  // Executive has no filters - sees everything
];

/**
 * Field permissions for fine-grained field access control
 */
const FIELD_PERMISSIONS_DATA = [
  // Technician field restrictions
  { roleId: ROLES.TECHNICIAN, module: "jobs", fieldName: "total_cost", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", fieldName: "profit_margin", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", fieldName: "labor_cost", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "jobs", fieldName: "hourly_rate", accessLevel: "hidden" },
  
  { roleId: ROLES.TECHNICIAN, module: "fleet", fieldName: "purchase_cost", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", fieldName: "monthly_payment", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "fleet", fieldName: "maintenance_cost", accessLevel: "hidden" },
  
  { roleId: ROLES.TECHNICIAN, module: "inventory", fieldName: "cost", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "inventory", fieldName: "markup_percentage", accessLevel: "hidden" },
  
  { roleId: ROLES.TECHNICIAN, module: "team", fieldName: "hourly_rate", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "team", fieldName: "salary", accessLevel: "hidden" },
  { roleId: ROLES.TECHNICIAN, module: "team", fieldName: "bank_account", accessLevel: "hidden" },

  // Manager field restrictions - can see totals but not individual rates
  { roleId: ROLES.MANAGER, module: "team", fieldName: "hourly_rate", accessLevel: "hidden" },
  { roleId: ROLES.MANAGER, module: "team", fieldName: "salary", accessLevel: "hidden" },
  { roleId: ROLES.MANAGER, module: "team", fieldName: "bank_account", accessLevel: "hidden" },
  
  { roleId: ROLES.MANAGER, module: "timesheet", fieldName: "hourly_rate", accessLevel: "readonly" },
  { roleId: ROLES.MANAGER, module: "timesheet", fieldName: "cost_rate", accessLevel: "readonly" },
  
  { roleId: ROLES.MANAGER, module: "jobs", fieldName: "labor_rate", accessLevel: "readonly" },

  // Executive has no field restrictions - can see and edit everything
];

/**
 * UI Elements based on CSV matrix
 */
const UI_ELEMENTS_DATA = [
  // Dashboard UI Elements
  { module: "dashboard", elementCode: "my_tasks_card", elementName: "My Tasks Card", elementType: "card" },
  { module: "dashboard", elementCode: "my_jobs_card", elementName: "My Jobs Card", elementType: "card" },
  { module: "dashboard", elementCode: "team_performance_card", elementName: "Team Performance Card", elementType: "card" },
  { module: "dashboard", elementCode: "financial_summary_card", elementName: "Financial Summary Card", elementType: "card" },
  { module: "dashboard", elementCode: "revenue_chart", elementName: "Revenue Chart", elementType: "section" },
  { module: "dashboard", elementCode: "profit_loss_chart", elementName: "Profit/Loss Chart", elementType: "section" },

  // Job UI Elements
  { module: "jobs", elementCode: "create_job_button", elementName: "Create Job Button", elementType: "button" },
  { module: "jobs", elementCode: "edit_job_button", elementName: "Edit Job Button", elementType: "button" },
  { module: "jobs", elementCode: "view_financial_button", elementName: "View Financial Button", elementType: "button" },
  { module: "jobs", elementCode: "cost_breakdown_section", elementName: "Cost Breakdown Section", elementType: "section" },
  { module: "jobs", elementCode: "profit_margin_field", elementName: "Profit Margin Field", elementType: "field" },
  { module: "jobs", elementCode: "labor_cost_field", elementName: "Labor Cost Field", elementType: "field" },

  // Bid UI Elements
  { module: "bids", elementCode: "create_bid_button", elementName: "Create Bid Button", elementType: "button" },
  { module: "bids", elementCode: "edit_bid_button", elementName: "Edit Bid Button", elementType: "button" },
  { module: "bids", elementCode: "approve_bid_button", elementName: "Approve Bid Button", elementType: "button" },
  { module: "bids", elementCode: "cost_calculator", elementName: "Cost Calculator", elementType: "section" },
  { module: "bids", elementCode: "markup_field", elementName: "Markup Field", elementType: "field" },

  // Team UI Elements
  { module: "team", elementCode: "add_user_button", elementName: "Add User Button", elementType: "button" },
  { module: "team", elementCode: "edit_employment_button", elementName: "Edit Employment Button", elementType: "button" },
  { module: "team", elementCode: "update_pay_button", elementName: "Update Pay Button", elementType: "button" },
  { module: "team", elementCode: "assign_roles_button", elementName: "Assign Roles Button", elementType: "button" },
  { module: "team", elementCode: "salary_field", elementName: "Salary Field", elementType: "field" },
  { module: "team", elementCode: "bank_account_section", elementName: "Bank Account Section", elementType: "section" },

  // Timesheet UI Elements
  { module: "timesheet", elementCode: "approve_button", elementName: "Approve Button", elementType: "button" },
  { module: "timesheet", elementCode: "reject_button", elementName: "Reject Button", elementType: "button" },
  { module: "timesheet", elementCode: "cost_analysis_button", elementName: "Cost Analysis Button", elementType: "button" },
  { module: "timesheet", elementCode: "hourly_rate_column", elementName: "Hourly Rate Column", elementType: "column" },

  // Fleet UI Elements
  { module: "fleet", elementCode: "add_vehicle_button", elementName: "Add Vehicle Button", elementType: "button" },
  { module: "fleet", elementCode: "view_costs_button", elementName: "View Costs Button", elementType: "button" },
  { module: "fleet", elementCode: "cost_fields_section", elementName: "Cost Fields Section", elementType: "section" },

  // Inventory UI Elements
  { module: "inventory", elementCode: "add_item_button", elementName: "Add Item Button", elementType: "button" },
  { module: "inventory", elementCode: "edit_cost_button", elementName: "Edit Cost Button", elementType: "button" },
  { module: "inventory", elementCode: "cost_column", elementName: "Cost Column", elementType: "column" },

  // Financial UI Elements (Executive only)
  { module: "financial", elementCode: "financial_dashboard", elementName: "Financial Dashboard", elementType: "section" },
  { module: "payroll", elementCode: "payroll_processing", elementName: "Payroll Processing", elementType: "section" },

  // Files UI Elements (Executive only)
  { module: "files", elementCode: "files_library", elementName: "Files Library", elementType: "section" },
  { module: "files", elementCode: "upload_file_button", elementName: "Upload File Button", elementType: "button" },
  { module: "files", elementCode: "delete_file_button", elementName: "Delete File Button", elementType: "button" },
];

/**
 * Role UI Element mappings
 */
const ROLE_UI_ELEMENTS_DATA = [
  // Technician UI - Very limited
  { roleId: ROLES.TECHNICIAN, elementCode: "my_tasks_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.TECHNICIAN, elementCode: "my_jobs_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.TECHNICIAN, elementCode: "team_performance_card", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "financial_summary_card", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "revenue_chart", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "profit_loss_chart", isVisible: false, isEnabled: false },

  { roleId: ROLES.TECHNICIAN, elementCode: "create_job_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "edit_job_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "view_financial_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "cost_breakdown_section", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "profit_margin_field", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "labor_cost_field", isVisible: false, isEnabled: false },

  { roleId: ROLES.TECHNICIAN, elementCode: "create_bid_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "add_user_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "salary_field", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "add_vehicle_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "view_costs_button", isVisible: false, isEnabled: false },

  { roleId: ROLES.TECHNICIAN, elementCode: "files_library", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "upload_file_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.TECHNICIAN, elementCode: "delete_file_button", isVisible: false, isEnabled: false },

  // Manager UI - Full operational access, limited financial
  { roleId: ROLES.MANAGER, elementCode: "my_tasks_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "my_jobs_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "team_performance_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "financial_summary_card", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "revenue_chart", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "profit_loss_chart", isVisible: false, isEnabled: false },

  { roleId: ROLES.MANAGER, elementCode: "create_job_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "edit_job_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "view_financial_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "cost_breakdown_section", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "profit_margin_field", isVisible: true, isEnabled: false }, // Readonly
  { roleId: ROLES.MANAGER, elementCode: "labor_cost_field", isVisible: true, isEnabled: false }, // Readonly

  { roleId: ROLES.MANAGER, elementCode: "create_bid_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "edit_bid_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "approve_bid_button", isVisible: false, isEnabled: false },

  { roleId: ROLES.MANAGER, elementCode: "add_user_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "edit_employment_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "update_pay_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "salary_field", isVisible: false, isEnabled: false },

  { roleId: ROLES.MANAGER, elementCode: "approve_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.MANAGER, elementCode: "cost_analysis_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "hourly_rate_column", isVisible: false, isEnabled: false },

  { roleId: ROLES.MANAGER, elementCode: "add_vehicle_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "view_costs_button", isVisible: false, isEnabled: false },

  { roleId: ROLES.MANAGER, elementCode: "files_library", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "upload_file_button", isVisible: false, isEnabled: false },
  { roleId: ROLES.MANAGER, elementCode: "delete_file_button", isVisible: false, isEnabled: false },

  // Executive UI - Full access to everything
  { roleId: ROLES.EXECUTIVE, elementCode: "my_tasks_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "my_jobs_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "team_performance_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "financial_summary_card", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "revenue_chart", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "profit_loss_chart", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "create_job_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "edit_job_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "view_financial_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "cost_breakdown_section", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "profit_margin_field", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "labor_cost_field", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "create_bid_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "edit_bid_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "approve_bid_button", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "add_user_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "edit_employment_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "update_pay_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "assign_roles_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "salary_field", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "bank_account_section", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "approve_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "reject_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "cost_analysis_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "hourly_rate_column", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "add_vehicle_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "view_costs_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "cost_fields_section", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "add_item_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "edit_cost_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "cost_column", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "financial_dashboard", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "payroll_processing", isVisible: true, isEnabled: true },

  { roleId: ROLES.EXECUTIVE, elementCode: "files_library", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "upload_file_button", isVisible: true, isEnabled: true },
  { roleId: ROLES.EXECUTIVE, elementCode: "delete_file_button", isVisible: true, isEnabled: true },
];

/**
 * Internal seed function to populate all feature-based permission data
 */
export async function seedFeaturePermissionsInternal(): Promise<number> {
  try {
    console.log("🌱 Starting feature permissions seed...");

    // 1. Insert Features
    console.log("📝 Inserting features...");
    for (const feature of FEATURES_DATA) {
      await db.insert(features).values({
        ...feature,
        module: feature.module as ModuleType,
      }).onConflictDoNothing();
    }

    // 2. Insert Role Features (need to get feature IDs first)
    console.log("🔗 Inserting role-feature mappings...");
    for (const roleFeature of ROLE_FEATURES_DATA) {
      // Get feature ID
      const [featureRecord] = await db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.module, roleFeature.module as ModuleType),
            eq(features.featureCode, roleFeature.featureCode)
          )
        )
        .limit(1);

      if (featureRecord) {
        await db
          .insert(roleFeatures)
          .values({
            roleId: roleFeature.roleId,
            featureId: featureRecord.id,
            accessLevel: roleFeature.accessLevel as AccessLevelType,
          })
          .onConflictDoNothing();
      }
    }

    // 3. Insert UI Elements
    console.log("🎨 Inserting UI elements...");
    for (const uiElement of UI_ELEMENTS_DATA) {
      await db.insert(uiElements).values({
        ...uiElement,
        module: uiElement.module as ModuleType,
        elementType: uiElement.elementType as UIElementType,
      }).onConflictDoNothing();
    }

    // 4. Insert Role UI Elements
    console.log("🖱️ Inserting role UI element mappings...");
    for (const roleUIElement of ROLE_UI_ELEMENTS_DATA) {
      // Get UI element ID
      const [uiElementRecord] = await db
        .select({ id: uiElements.id })
        .from(uiElements)
        .where(eq(uiElements.elementCode, roleUIElement.elementCode))
        .limit(1);

      if (uiElementRecord) {
        await db
          .insert(roleUIElements)
          .values({
            roleId: roleUIElement.roleId,
            uiElementId: uiElementRecord.id,
            isVisible: roleUIElement.isVisible,
            isEnabled: roleUIElement.isEnabled,
          })
          .onConflictDoNothing();
      }
    }

    // 5. Insert Data Filters
    console.log("🔍 Inserting data filters...");
    for (const dataFilter of DATA_FILTERS_DATA) {
      await db.insert(dataFilters).values({
        ...dataFilter,
        module: dataFilter.module as ModuleType,
      }).onConflictDoNothing();
    }

    // 6. Insert Field Permissions
    console.log("📋 Inserting field permissions...");
    for (const fieldPermission of FIELD_PERMISSIONS_DATA) {
      await db.insert(fieldPermissions).values({
        ...fieldPermission,
        module: fieldPermission.module as ModuleType,
      }).onConflictDoNothing();
    }

    console.log("✅ Feature permissions seed completed successfully!");
    
    // Print summary
    const featureCount = await db.select({ count: sql`count(*)` }).from(features);
    const roleFeatureCount = await db.select({ count: sql`count(*)` }).from(roleFeatures);
    const uiElementCount = await db.select({ count: sql`count(*)` }).from(uiElements);
    
    console.log(`📊 Seed Summary:`);
    console.log(`   Features: ${featureCount[0]?.count ?? 0}`);
    console.log(`   Role-Feature mappings: ${roleFeatureCount[0]?.count ?? 0}`);
    console.log(`   UI Elements: ${uiElementCount[0]?.count ?? 0}`);
    console.log(`   Data Filters: ${DATA_FILTERS_DATA.length}`);
    console.log(`   Field Permissions: ${FIELD_PERMISSIONS_DATA.length}`);

    return FEATURES_DATA.length;
  } catch (error) {
    console.error("❌ Error seeding feature permissions:", error);
    throw error;
  }
}

/**
 * Public seed function — runs directly, no tracking
 */
export async function seedFeaturePermissions() {
  await seedFeaturePermissionsInternal();
}

// Export for use in main seed script
export default seedFeaturePermissions;

// Run directly if executed as main module
const isMain = process.argv[1]?.includes('featurePermissions.seed');
if (isMain) {
  seedFeaturePermissions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
