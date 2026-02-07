import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { logger } from "./logger.js";
import type {
  NotificationEvent,
  NotificationRule,
  RecipientInfo,
  RuleConditions,
} from "../types/notification.types.js";

/**
 * Resolve recipients based on notification rule and event data
 */
export async function resolveRecipients(
  event: NotificationEvent,
  rule: NotificationRule
): Promise<RecipientInfo[]> {
  try {
    const recipients: RecipientInfo[] = [];
    const recipientRoles = (rule.recipientRoles as unknown as string[]) || [];

    // Collect all user IDs that need to be recipients
    const userIds = new Set<string>();

    for (const role of recipientRoles) {
      switch (role) {
        case "user":
          // Send to the specific user (e.g., password reset)
          if (event.data.userId) {
            userIds.add(event.data.userId);
          }
          break;

      case "technician":
      case "assigned_technician": {
        // Send to assigned technician(s)
        if (event.data.assignedTechnicianId) {
          userIds.add(event.data.assignedTechnicianId);
        }
        if (event.data.assignedTechnicianIds) {
          event.data.assignedTechnicianIds.forEach((id: string) =>
            userIds.add(id)
          );
        }
        break;
      }

      case "project_manager":
      case "manager": {
        // Get all managers
        const managers = await getUsersByRole("manager");
        managers.forEach((u) => userIds.add(u.id));

        // Also include specific manager if specified
        if (event.data.projectManagerId) {
          userIds.add(event.data.projectManagerId);
        }
        if (event.data.managerId) {
          userIds.add(event.data.managerId);
        }
        break;
      }

      case "executive": {
        // Get all executives
        const executives = await getUsersByRole("executive");
        executives.forEach((u) => userIds.add(u.id));

        // Also include specific executives if specified
        if (event.data.executiveIds) {
          event.data.executiveIds.forEach((id: string) => userIds.add(id));
        }
        break;
      }

      case "supervisor": {
        // Get all supervisors
        const supervisors = await getUsersByRole("supervisor");
        supervisors.forEach((u) => userIds.add(u.id));
        break;
      }

        case "client":
          // Send to client
          if (event.data.clientId) {
            // Get client user - assuming clients have user accounts
            // You may need to adjust this based on your client schema
            userIds.add(event.data.clientId);
          }
          break;

        case "driver":
          // Send to driver
          if (event.data.driverId) {
            userIds.add(event.data.driverId);
          }
          break;

        case "employee":
          // Send to specific employee
          if (event.data.employeeId) {
            const employee = await getEmployeeById(event.data.employeeId);
            if (employee?.userId) {
              userIds.add(employee.userId);
            }
          }
          break;

      case "all_employees": {
        // Get all active employees
        const allEmployees = await getAllEmployees();
        allEmployees.forEach((emp) => {
          if (emp.userId) userIds.add(emp.userId);
        });
        break;
      }

      case "department_manager": {
        // Get department manager
        if (event.data.departmentId) {
          const deptManager = await getDepartmentManager(
            event.data.departmentId
          );
          if (deptManager?.userId) {
            userIds.add(deptManager.userId);
          }
        }
        break;
      }

      case "admin": {
        // Get all admins
        const admins = await getUsersByRole("admin");
        admins.forEach((u) => userIds.add(u.id));
        break;
      }

        default:
          logger.warn(`Unknown recipient role: ${role}`);
      }
    }

    // Fetch user details for all collected user IDs (include inactive so explicitly
    // specified recipients e.g. assignedTechnicianId still receive notifications)
    if (userIds.size > 0) {
      const usersList = await db
        .select({
          id: users.id,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));

      recipients.push(
        ...usersList.map((u) => ({
          id: u.id,
          ...(u.email ? { email: u.email } : {}),
          ...(u.phone ? { phone: u.phone } : {}),
          ...(u.fullName ? { fullName: u.fullName } : {}),
        }))
      );
    }

    logger.debug(
      `Resolved ${recipients.length} recipients for event type: ${event.type}`
    );
    return recipients;
  } catch (error) {
    logger.error("Error resolving recipients:", error);
    return [];
  }
}

/**
 * Get users by role
 */
async function getUsersByRole(roleName: string): Promise<RecipientInfo[]> {
  try {
    // This query depends on your role schema structure
    // Adjust based on your actual schema
    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Note: You'll need to filter by role based on your schema
    // This is a placeholder - adjust based on your role structure
    return usersList.map((u) => ({
      id: u.id,
      ...(u.email ? { email: u.email } : {}),
      ...(u.phone ? { phone: u.phone } : {}),
      ...(u.fullName ? { fullName: u.fullName } : {}),
      role: roleName,
    }));
  } catch (error) {
    logger.error(`Error getting users by role ${roleName}:`, error);
    return [];
  }
}

/**
 * Get employee by ID
 */
async function getEmployeeById(
  employeeId: string
): Promise<{ userId: string } | null> {
  try {
    const [employee] = await db
      .select({ userId: employees.userId })
      .from(employees)
      .where(eq(employees.id, parseInt(employeeId)))
      .limit(1);

    if (!employee?.userId) {
      return null;
    }

    return { userId: employee.userId };
  } catch (error) {
    logger.error("Error getting employee by ID:", error);
    return null;
  }
}

/**
 * Get all active employees
 */
async function getAllEmployees(): Promise<{ userId: string }[]> {
  try {
    const employeesList = await db
      .select({ userId: employees.userId })
      .from(employees)
      .where(and(isNull(employees.terminationDate)));

    return employeesList.filter((emp): emp is { userId: string } => emp.userId !== null);
  } catch (error) {
    logger.error("Error getting all employees:", error);
    return [];
  }
}

/**
 * Get department manager
 */
async function getDepartmentManager(
  _departmentId: string
): Promise<{ userId: string } | null> {
  // Adjust this query based on your department schema
  // This is a placeholder
  return null;
}

/**
 * Evaluate conditions for notification rule
 */
export function evaluateConditions(
  eventData: any,
  conditions: RuleConditions | null | undefined
): boolean {
  if (!conditions) {
    return true; // No conditions means always pass
  }

  try {
    const results: boolean[] = [];

    // Amount threshold
    if (conditions.amountThreshold !== undefined && eventData.amount !== undefined) {
      results.push(eventData.amount >= conditions.amountThreshold);
    }

    // Days before threshold
    if (conditions.daysBeforeThreshold !== undefined && eventData.daysUntilDue !== undefined) {
      results.push(eventData.daysUntilDue <= conditions.daysBeforeThreshold);
    }

    // Days after threshold (overdue)
    if (conditions.daysAfterThreshold !== undefined && eventData.daysOverdue !== undefined) {
      results.push(eventData.daysOverdue >= conditions.daysAfterThreshold);
    }

    // Stock level threshold
    if (conditions.stockLevelThreshold !== undefined && eventData.stockLevel !== undefined) {
      results.push(eventData.stockLevel <= conditions.stockLevelThreshold);
    }

    // Percentage threshold
    if (conditions.percentageThreshold !== undefined && eventData.percentage !== undefined) {
      results.push(eventData.percentage >= conditions.percentageThreshold);
    }

    // If no conditions were evaluated, pass by default
    if (results.length === 0) {
      return true;
    }

    // Apply AND/OR logic
    if (conditions.requiresAll) {
      // All conditions must pass (AND)
      return results.every((r) => r);
    } else {
      // At least one condition must pass (OR)
      return results.some((r) => r);
    }
  } catch (error) {
    logger.error("Error evaluating conditions:", error);
    return false;
  }
}

/**
 * Generate notification title based on event type
 */
export function generateNotificationTitle(eventType: string): string {
  const titleMap: Record<string, string> = {
    // Authentication & Security
    "2fa_code": "2FA Code",
    password_reset_request: "Password Reset Request",
    password_changed: "Password Changed Successfully",
    new_account_created: "Welcome to T3 Mechanical",
    password_setup_link: "Set Up Your Password",
    account_locked: "Account Locked",

    // Jobs & Projects
    job_assigned: "New Job Assigned",
    job_status_changed: "Job Status Updated",
    job_started: "Job Started",
    job_completed: "Job Completed",
    job_overdue: "Job Overdue",
    job_cancelled: "Job Cancelled",
    job_site_notes_added: "New Job Site Notes",
    job_cost_exceeds_budget: "Job Cost Alert",

    // Bids & Proposals
    bid_created: "New Bid Created",
    bid_sent_to_client: "Bid Sent to Client",
    bid_expired: "Bid Expired",
    bid_won: "Bid Won!",
    bid_requires_approval: "Bid Requires Approval",

    // Invoicing & Payments
    invoice_sent: "Invoice Sent",
    payment_received_full: "Payment Received",
    payment_received_partial: "Partial Payment Received",
    invoice_due_tomorrow: "Invoice Due Tomorrow",
    invoice_overdue_1day: "Invoice Overdue",
    invoice_overdue_7days: "Invoice 7 Days Overdue",
    invoice_overdue_30days: "Invoice 30 Days Overdue",
    invoice_cancelled: "Invoice Cancelled",

    // Dispatch
    technician_assigned_to_dispatch: "New Dispatch Assignment",
    dispatch_reassigned: "Dispatch Reassigned",

    // Timesheets
    timesheet_approved: "Timesheet Approved",
    timesheet_rejected: "Timesheet Rejected",
    clock_reminder: "Clock In/Out Reminder",
    timesheet_resubmitted: "Timesheet Resubmitted",

    // Expenses
    job_budget_exceeded: "Budget Exceeded",

    // Fleet
    vehicle_checked_out: "Vehicle Checked Out",
    vehicle_checked_in: "Vehicle Checked In",
    maintenance_due_7days: "Maintenance Due Soon",
    maintenance_due_3days: "Maintenance Due in 3 Days",
    maintenance_overdue: "Maintenance Overdue",
    safety_inspection_required: "Safety Inspection Required",
    safety_inspection_expired: "Safety Inspection Expired",
    safety_inspection_failed: "Safety Inspection Failed",
    driver_reassigned: "Driver Reassigned",
    vehicle_registration_expiring: "Vehicle Registration Expiring",
    vehicle_insurance_expiring: "Vehicle Insurance Expiring",

    // Inventory
    low_stock_warning: "Low Stock Warning",
    out_of_stock: "Out of Stock Alert",
    stock_reordered: "Stock Reordered",
    purchase_order_created: "Purchase Order Created",
    purchase_order_approved: "Purchase Order Approved",

    // Team & HR
    new_employee_onboarded: "New Employee Onboarded",
    performance_review_due: "Performance Review Due",

    // Safety & Compliance
    safety_incident_reported: "Safety Incident Reported",
    compliance_case_opened: "Compliance Case Opened",
    compliance_case_resolved: "Compliance Case Resolved",
    employee_suspended: "Employee Suspended",
  };

  return titleMap[eventType] || "Notification";
}

/**
 * Generate notification message based on event data
 */
export function generateNotificationMessage(
  eventType: string,
  eventData: any
): { message: string; shortMessage: string } {
  // Default messages
  let message = eventData.message || "You have a new notification";
  let shortMessage = eventData.shortMessage || message.substring(0, 100);

  // Customize based on event type if not provided
  if (!eventData.message) {
    const entityName = eventData.entityName || "Item";

    switch (eventType) {
      case "job_assigned":
        message = `You have been assigned to ${entityName}`;
        shortMessage = `New job assigned: ${entityName}`;
        break;
      case "job_overdue":
        message = `${entityName} is now ${eventData.daysOverdue || ""} overdue`;
        shortMessage = `Job overdue: ${entityName}`;
        break;
      case "invoice_overdue":
        message = `Invoice ${entityName} is ${eventData.daysOverdue || ""} days overdue. Amount: $${eventData.amount || "0"}`;
        shortMessage = `Invoice overdue: ${entityName}`;
        break;
      case "maintenance_due_3days":
        message = `${entityName} maintenance is due in 3 days`;
        shortMessage = `Maintenance due: ${entityName}`;
        break;
      case "low_stock_warning":
        message = `${entityName} is running low. Current stock: ${eventData.stockLevel || 0}`;
        shortMessage = `Low stock: ${entityName}`;
        break;
      default:
        message = `Update regarding ${entityName}`;
        shortMessage = message;
    }
  }

  return { message, shortMessage };
}

/**
 * Determine action URL based on entity type and ID
 */
export function generateActionUrl(
  entityType?: string,
  entityId?: string
): string | undefined {
  if (!entityType || !entityId) {
    return undefined;
  }

  const urlMap: Record<string, string> = {
    Job: `/dashboard/jobs/${entityId}`,
    Bid: `/dashboard/bids/${entityId}`,
    Invoice: `/dashboard/invoicing/${entityId}`,
    Timesheet: `/dashboard/timesheets/${entityId}`,
    Vehicle: `/dashboard/fleet/${entityId}`,
    Expense: `/dashboard/expenses/${entityId}`,
    Dispatch: `/dashboard/dispatch`,
    Employee: `/dashboard/team/employees/${entityId}`,
    Client: `/dashboard/clients/${entityId}`,
    Inventory: `/dashboard/inventory/${entityId}`,
  };

  return urlMap[entityType] || `/dashboard`;
}
