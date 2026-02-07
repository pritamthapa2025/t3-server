import { db } from "../../config/db.js";
import { notificationRules } from "../schema/notifications.schema.js";
import { logger } from "../../utils/logger.js";

/**
 * Seed notification rules based on T3 Notification checklist CSV
 * This creates the rules for all 95+ notification events
 */
export async function seedNotificationRules() {
  logger.info("Seeding notification rules...");

  const rules = [
    // ============================================
    // 1. AUTHENTICATION & SECURITY
    // ============================================
    {
      category: "system",
      eventType: "2fa_code",
      description: "2FA Code",
      enabled: true,
      priority: "high",
      recipientRoles: ["user"],
      channels: ["email"],
    },
    {
      category: "system",
      eventType: "password_reset_request",
      description: "Password Reset Request",
      enabled: true,
      priority: "high",
      recipientRoles: ["user"],
      channels: ["email", "sms"],
    },
    {
      category: "system",
      eventType: "password_changed",
      description: "Password Changed Successfully",
      enabled: true,
      priority: "medium",
      recipientRoles: ["user"],
      channels: ["email", "push"],
    },
    {
      category: "system",
      eventType: "new_account_created",
      description: "New Account Created",
      enabled: true,
      priority: "medium",
      recipientRoles: ["user"],
      channels: ["email", "push"],
    },
    {
      category: "system",
      eventType: "password_setup_link",
      description: "Password Setup Link (New User)",
      enabled: true,
      priority: "high",
      recipientRoles: ["user"],
      channels: ["email"],
    },
    {
      category: "system",
      eventType: "account_locked",
      description: "Account Locked",
      enabled: true,
      priority: "high",
      recipientRoles: ["user", "admin"],
      channels: ["email"],
    },

    // ============================================
    // 2. JOBS & PROJECTS
    // ============================================
    {
      category: "job",
      eventType: "job_assigned",
      description: "Job Assigned to Technician",
      enabled: true,
      priority: "high",
      recipientRoles: ["assigned_technician", "supervisor"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "job",
      eventType: "job_status_changed",
      description: "Job Status Changed",
      enabled: true,
      priority: "medium",
      recipientRoles: ["project_manager"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "job_started",
      description: "Job Started",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "job_completed",
      description: "Job Completed",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "job",
      eventType: "job_overdue",
      description: "Job Overdue",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "technician", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "job",
      eventType: "job_cancelled",
      description: "Job Cancelled",
      enabled: true,
      priority: "medium",
      recipientRoles: ["executive"],
      channels: ["push"],
    },
    {
      category: "job",
      eventType: "job_site_notes_added",
      description: "Job Site Notes Added",
      enabled: true,
      priority: "low",
      recipientRoles: ["assigned_technician", "project_manager"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "job_cost_exceeds_budget",
      description: "Job Cost Exceeds Budget",
      enabled: true,
      priority: "high",
      recipientRoles: ["project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },

    // ============================================
    // 3. BIDS & PROPOSALS
    // ============================================
    {
      category: "job",
      eventType: "bid_created",
      description: "Bid Created",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "bid_sent_to_client",
      description: "Bid Sent to Client",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client"],
      channels: ["email"],
    },
    {
      category: "job",
      eventType: "bid_expired",
      description: "Bid Expired",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "bid_won",
      description: "Bid Won",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "push"],
    },
    {
      category: "job",
      eventType: "bid_requires_approval",
      description: "Bid Requires Approval",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },

    // ============================================
    // 4. INVOICING & PAYMENTS
    // ============================================
    {
      category: "financial",
      eventType: "invoice_sent",
      description: "Invoice Sent to Client",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client"],
      channels: ["email"],
    },
    {
      category: "financial",
      eventType: "payment_received_full",
      description: "Payment Received (Full)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client"],
      channels: ["email"],
    },
    {
      category: "financial",
      eventType: "payment_received_partial",
      description: "Payment Received (Partial)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client"],
      channels: ["email"],
    },
    {
      category: "financial",
      eventType: "invoice_due_tomorrow",
      description: "Invoice Due Tomorrow",
      enabled: true,
      priority: "high",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "financial",
      eventType: "invoice_overdue_1day",
      description: "Invoice Overdue (1 day)",
      enabled: true,
      priority: "high",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "financial",
      eventType: "invoice_overdue_7days",
      description: "Invoice Overdue (7 days)",
      enabled: true,
      priority: "high",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "financial",
      eventType: "invoice_overdue_30days",
      description: "Invoice Overdue (30 days)",
      enabled: true,
      priority: "high",
      recipientRoles: ["client", "project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "financial",
      eventType: "invoice_cancelled",
      description: "Invoice Cancelled",
      enabled: true,
      priority: "medium",
      recipientRoles: ["client"],
      channels: ["email"],
    },

    // ============================================
    // 5. DISPATCH & SCHEDULING
    // ============================================
    {
      category: "dispatch",
      eventType: "technician_assigned_to_dispatch",
      description: "Technician Assigned to Dispatch",
      enabled: true,
      priority: "high",
      recipientRoles: ["assigned_technician"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "dispatch",
      eventType: "dispatch_reassigned",
      description: "Dispatch Reassigned",
      enabled: true,
      priority: "high",
      recipientRoles: ["assigned_technician"],
      channels: ["email", "sms", "push"],
    },

    // ============================================
    // 6. TIMESHEETS & LABOR
    // ============================================
    {
      category: "timesheet",
      eventType: "timesheet_approved",
      description: "Timesheet Approved",
      enabled: true,
      priority: "medium",
      recipientRoles: ["employee"],
      channels: ["email", "push"],
    },
    {
      category: "timesheet",
      eventType: "timesheet_rejected",
      description: "Timesheet Rejected",
      enabled: true,
      priority: "high",
      recipientRoles: ["employee"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "timesheet",
      eventType: "clock_reminder",
      description: "Clock in/out Reminder (If pending)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["employee"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "timesheet",
      eventType: "timesheet_resubmitted",
      description: "Timesheet Resubmitted After Rejection",
      enabled: true,
      priority: "medium",
      recipientRoles: ["department_manager", "executive"],
      channels: ["push"],
    },

    // ============================================
    // 7. EXPENSES
    // ============================================
    {
      category: "expense",
      eventType: "job_budget_exceeded",
      description: "Job Budget Exceeded",
      enabled: true,
      priority: "high",
      recipientRoles: ["project_manager", "executive"],
      channels: ["email", "sms", "push"],
    },

    // ============================================
    // 8. FLEET MANAGEMENT
    // ============================================
    {
      category: "fleet",
      eventType: "vehicle_checked_out",
      description: "Vehicle Checked Out",
      enabled: true,
      priority: "low",
      recipientRoles: ["project_manager"],
      channels: ["push"],
    },
    {
      category: "fleet",
      eventType: "vehicle_checked_in",
      description: "Vehicle Checked In",
      enabled: true,
      priority: "low",
      recipientRoles: ["project_manager"],
      channels: ["push"],
    },
    {
      category: "fleet",
      eventType: "maintenance_due_7days",
      description: "Vehicle Maintenance Due (7 days)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["driver", "manager"],
      channels: ["push"],
    },
    {
      category: "fleet",
      eventType: "maintenance_due_3days",
      description: "Vehicle Maintenance Due (3 days)",
      enabled: true,
      priority: "high",
      recipientRoles: ["driver", "manager"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "maintenance_overdue",
      description: "Vehicle Maintenance Overdue",
      enabled: true,
      priority: "high",
      recipientRoles: ["driver", "manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "safety_inspection_required",
      description: "Safety Inspection Required",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "safety_inspection_expired",
      description: "Safety Inspection Expired",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "safety_inspection_failed",
      description: "Safety Inspection Failed",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "driver_reassigned",
      description: "Driver Reassigned to Vehicle",
      enabled: true,
      priority: "medium",
      recipientRoles: ["driver"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "vehicle_registration_expiring",
      description: "Vehicle Registration Expiring",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "fleet",
      eventType: "vehicle_insurance_expiring",
      description: "Vehicle Insurance Expiring",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },

    // ============================================
    // 9. INVENTORY
    // ============================================
    {
      category: "inventory",
      eventType: "low_stock_warning",
      description: "Low Stock Warning (At Reorder Level)",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "out_of_stock",
      description: "Out of Stock Alert",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "inventory",
      eventType: "stock_reordered",
      description: "Stock Reordered",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "push"],
    },
    {
      category: "inventory",
      eventType: "purchase_order_created",
      description: "Purchase Order Created",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "purchase_order_approved",
      description: "Purchase Order Approved",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "purchase_order_received_full",
      description: "Purchase Order Received (Full)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "purchase_order_received_partial",
      description: "Purchase Order Received (Partial)",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "purchase_order_delayed",
      description: "Purchase Order Delayed",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "inventory",
      eventType: "item_allocated_to_job",
      description: "Item Allocated to Job",
      enabled: true,
      priority: "low",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },

    // ============================================
    // 10. TEAM & HR
    // ============================================
    {
      category: "system",
      eventType: "new_employee_onboarded",
      description: "New Employee Onboarded",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager"],
      channels: ["push"],
    },
    {
      category: "system",
      eventType: "performance_review_due",
      description: "Performance Review Due",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager"],
      channels: ["push"],
    },

    // ============================================
    // 11. SAFETY & COMPLIANCE
    // ============================================
    {
      category: "safety",
      eventType: "safety_incident_reported",
      description: "Safety Incident Reported",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["email", "sms", "push"],
    },
    {
      category: "safety",
      eventType: "compliance_case_opened",
      description: "Compliance Case Opened",
      enabled: true,
      priority: "high",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "safety",
      eventType: "compliance_case_resolved",
      description: "Compliance Case Resolved",
      enabled: true,
      priority: "medium",
      recipientRoles: ["manager", "executive"],
      channels: ["push"],
    },
    {
      category: "safety",
      eventType: "employee_suspended",
      description: "Employee Suspended",
      enabled: true,
      priority: "high",
      recipientRoles: ["employee", "manager", "executive"],
      channels: ["email", "sms", "push"],
    },
  ];

  try {
    // Insert rules (ignore conflicts if they already exist)
    for (const rule of rules) {
      await db
        .insert(notificationRules)
        .values(rule as any)
        .onConflictDoNothing();
    }

    logger.info(`✅ Successfully seeded ${rules.length} notification rules`);
  } catch (error) {
    logger.error("❌ Error seeding notification rules:", error);
    throw error;
  }
}

// Run seeder if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedNotificationRules()
    .then(() => {
      logger.info("Notification rules seeding complete");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Failed to seed notification rules:", error);
      process.exit(1);
    });
}
