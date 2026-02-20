import { db } from "../config/db.js";
import { users, roles, userRoles } from "../drizzle/schema/auth.schema.js";
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
        // Get the assigned technician's direct supervisor (reportsTo)
        if (event.data.assignedTechnicianId) {
          const technicianEmployee = await db
            .select({ reportsTo: employees.reportsTo })
            .from(employees)
            .where(eq(employees.userId, event.data.assignedTechnicianId))
            .limit(1);

          if (technicianEmployee[0]?.reportsTo) {
            userIds.add(technicianEmployee[0].reportsTo);
          } else {
            // No direct supervisor assigned - don't send to anyone (technician already gets it via "assigned_technician" role)
            logger.info(
              `No direct supervisor found for technician ${event.data.assignedTechnicianId}, skipping supervisor notification`
            );
          }
        } else {
          // If no specific technician, send to all supervisors
          const supervisors = await getUsersByRole("supervisor");
          supervisors.forEach((u) => userIds.add(u.id));
        }
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
 * Get users by role (filters by actual DB role name)
 */
async function getUsersByRole(roleName: string): Promise<RecipientInfo[]> {
  try {
    // Map notification role names to actual DB role names (PascalCase as seeded)
    const roleNameMap: Record<string, string> = {
      manager: "Manager",
      project_manager: "Manager",
      executive: "Executive",
      admin: "Executive",
      supervisor: "Manager",
      technician: "Field Technician",
      client: "Client",
    };
    const dbRoleName = roleNameMap[roleName.toLowerCase()] ?? roleName;

    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(users.isActive, true), eq(roles.name, dbRoleName)));

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
  // If caller already provided a custom message, use it as-is
  let message = eventData.message || "";
  let shortMessage = eventData.shortMessage || "";

  if (!eventData.message) {
    const name = eventData.entityName || "Item";

    // Helpers to format optional fields inline
    const client = eventData.clientName ? ` for client ${eventData.clientName}` : "";
    const amount = eventData.amount ? ` $${Number(eventData.amount).toLocaleString()}` : "";
    const daysOverdue = eventData.daysOverdue
      ? `${eventData.daysOverdue} day${eventData.daysOverdue > 1 ? "s" : ""}`
      : null;
    const dueDate = eventData.dueDate
      ? new Date(eventData.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : null;
    const plate = eventData.licensePlate ? ` (Plate: ${eventData.licensePlate})` : "";
    const maintenanceType = eventData.maintenanceType ? ` — ${eventData.maintenanceType}` : "";

    switch (eventType) {
      // ── Auth & Security ────────────────────────────────────────────────
      case "2fa_code":
        message = eventData.code
          ? `Your two-factor authentication code is: ${eventData.code}. This code expires in 10 minutes. Do not share it with anyone.`
          : "Your two-factor authentication code has been sent. Please check your registered device. The code expires in 10 minutes.";
        shortMessage = "Your 2FA code is ready";
        break;

      case "password_reset_request":
        message = "We received a request to reset your T3 Mechanical account password. Click the button below to create a new password. This link is valid for 1 hour. If you did not request this, you can safely ignore this email — your password will not change.";
        shortMessage = "Password reset link sent";
        break;

      case "password_changed":
        message = "Your T3 Mechanical account password was changed successfully. If you made this change, no action is needed. If you did not change your password, please contact your administrator immediately to secure your account.";
        shortMessage = "Your password has been changed";
        break;

      case "new_account_created":
        message = "Your T3 Mechanical account has been created successfully. You can now access the platform using your registered email. A separate email has been sent with instructions to set up your password. If you have questions, contact your administrator.";
        shortMessage = "Your T3 Mechanical account is ready";
        break;

      case "password_setup_link":
        message = "Your T3 Mechanical account is ready. Please click the button below to set your password and activate your account. This link is valid for 24 hours. If you did not expect this, please contact your administrator.";
        shortMessage = "Set up your account password";
        break;

      case "account_locked":
        message = "Your T3 Mechanical account has been temporarily locked due to multiple failed login attempts. Please contact your administrator to unlock your account and verify your identity before trying again.";
        shortMessage = "Your account has been locked";
        break;

      // ── Jobs ─────────────────────────────────────────────────────────
      case "job_assigned":
        message = `You have been assigned to job "${name}"${client}. Please log in to review the full job details, scheduled dates, and site information before your start date.`;
        shortMessage = `New job assigned: ${name}`;
        break;

      case "job_status_changed": {
        const oldStatus = eventData.oldStatus ? ` from "${eventData.oldStatus}"` : "";
        const newStatus = eventData.newStatus ? ` to "${eventData.newStatus}"` : "";
        message = `The status of job "${name}"${client} has been updated${oldStatus}${newStatus}. Please log in to review the latest details and any new instructions.`;
        shortMessage = `Job status updated: ${name}${eventData.newStatus ? ` → ${eventData.newStatus}` : ""}`;
        break;
      }

      case "job_started":
        message = `Job "${name}"${client} has officially started. The assigned team is on-site and work has begun. You will be notified when the job is completed or if any issues arise.`;
        shortMessage = `Job started: ${name}`;
        break;

      case "job_completed":
        message = `Job "${name}"${client} has been completed successfully. Please log in to review the final report, any outstanding items, and follow-up actions required before closing.`;
        shortMessage = `Job completed: ${name}`;
        break;

      case "job_overdue":
        message = `Job "${name}"${client} is now ${daysOverdue ? `${daysOverdue} overdue` : "overdue"}${dueDate ? ` (was due ${dueDate})` : ""}. Immediate attention is required. Please log in to review the job status and take corrective action.`;
        shortMessage = `Job overdue: ${name}`;
        break;

      case "job_cancelled":
        message = `Job "${name}"${client} has been cancelled${eventData.reason ? ` — Reason: ${eventData.reason}` : ""}. Please log in to review any outstanding tasks, materials, or commitments tied to this job.`;
        shortMessage = `Job cancelled: ${name}`;
        break;

      case "job_site_notes_added":
        message = `New site notes have been added to job "${name}"${client}${eventData.addedBy ? ` by ${eventData.addedBy}` : ""}. Please review the updated notes before your next visit to ensure you have the latest site information.`;
        shortMessage = `New site notes: ${name}`;
        break;

      case "job_cost_exceeds_budget":
      case "job_budget_exceeded": {
        const current = eventData.currentCost ? ` Current cost:${amount}` : "";
        const budget = eventData.budget ? ` / Budget: $${Number(eventData.budget).toLocaleString()}` : "";
        message = `Job "${name}"${client} has exceeded its approved budget.${current}${budget}. Please log in to review the cost breakdown and determine whether additional approval is required before work continues.`;
        shortMessage = `Budget exceeded: ${name}`;
        break;
      }

      // ── Bids ──────────────────────────────────────────────────────────
      case "bid_created":
        message = `A new bid "${name}"${client}${amount ? ` (Amount:${amount})` : ""} has been created and is awaiting review. Please log in to verify the details and take the appropriate next steps.`;
        shortMessage = `New bid created: ${name}`;
        break;

      case "bid_sent_to_client":
        message = `Bid "${name}"${client}${amount ? ` (Amount:${amount})` : ""} has been sent to the client for review. You will be notified when the client responds with an acceptance, revision request, or rejection.`;
        shortMessage = `Bid sent to client: ${name}`;
        break;

      case "bid_requires_approval":
        message = `Bid "${name}"${client}${amount ? ` (Amount:${amount})` : ""} is pending your approval before it can be sent. Please log in to review the bid details and either approve or return it with comments at your earliest convenience.`;
        shortMessage = `Bid approval required: ${name}`;
        break;

      case "bid_won":
        message = `Great news — bid "${name}"${client}${amount ? ` (Amount:${amount})` : ""} has been won! The client has accepted the proposal. Please log in to begin the job creation and project planning process.`;
        shortMessage = `Bid won: ${name}`;
        break;

      case "bid_expired":
        message = `Bid "${name}"${client}${amount ? ` (Amount:${amount})` : ""} has expired without a client response${dueDate ? ` (expired ${dueDate})` : ""}. Please log in to review the bid and decide whether to renew, follow up with the client, or close it.`;
        shortMessage = `Bid expired: ${name}`;
        break;

      // ── Invoicing & Payments ──────────────────────────────────────────
      case "invoice_sent":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} has been sent${dueDate ? ` and is due on ${dueDate}` : ""}. Please log in to track payment status or download a copy of the invoice.`;
        shortMessage = `Invoice sent: ${name}`;
        break;

      case "payment_received_full":
        message = `Full payment${amount ? ` of${amount}` : ""} has been received for invoice ${name}${client}. The invoice is now fully settled. Please log in to confirm and close the invoice.`;
        shortMessage = `Full payment received: ${name}`;
        break;

      case "payment_received_partial": {
        const remaining = eventData.remainingBalance ? ` Remaining balance: $${Number(eventData.remainingBalance).toLocaleString()}.` : "";
        message = `A partial payment${amount ? ` of${amount}` : ""} has been received for invoice ${name}${client}.${remaining} Please log in to review the payment history and follow up on the outstanding balance.`;
        shortMessage = `Partial payment received: ${name}`;
        break;
      }

      case "invoice_due_tomorrow":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} is due tomorrow. Please ensure payment is received on time or contact the client immediately to arrange settlement.`;
        shortMessage = `Invoice due tomorrow: ${name}`;
        break;

      case "invoice_overdue_1day":
      case "invoice_overdue":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} is 1 day overdue${dueDate ? ` (was due ${dueDate})` : ""}. Please follow up with the client immediately to arrange payment.`;
        shortMessage = `Invoice overdue: ${name}`;
        break;

      case "invoice_overdue_7days":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} is now 7 days overdue${dueDate ? ` (was due ${dueDate})` : ""}. This requires prompt escalation. Please contact the client and consider formal follow-up procedures.`;
        shortMessage = `Invoice 7 days overdue: ${name}`;
        break;

      case "invoice_overdue_30days":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} is 30 days overdue${dueDate ? ` (was due ${dueDate})` : ""}. This is a critical overdue notice. Immediate escalation and formal collections procedures may be required.`;
        shortMessage = `Invoice 30 days overdue: ${name}`;
        break;

      case "invoice_cancelled":
        message = `Invoice ${name}${client}${amount ? ` for${amount}` : ""} has been cancelled${eventData.reason ? ` — Reason: ${eventData.reason}` : ""}. Please log in to review the cancellation details and any related outstanding items.`;
        shortMessage = `Invoice cancelled: ${name}`;
        break;

      // ── Dispatch ─────────────────────────────────────────────────────
      case "technician_assigned_to_dispatch": {
        const scheduledTime = eventData.scheduledTime || eventData.scheduledDate || null;
        const location = eventData.location || eventData.siteAddress || null;
        message = `You have been assigned to a new dispatch — "${name}".${scheduledTime ? ` Scheduled: ${scheduledTime}.` : ""}${location ? ` Location: ${location}.` : ""} Please review the dispatch details and prepare before heading out.`;
        shortMessage = `New dispatch assignment: ${name}`;
        break;
      }

      case "dispatch_reassigned": {
        const scheduledTime = eventData.scheduledTime || eventData.scheduledDate || null;
        message = `Dispatch "${name}" has been reassigned to you.${scheduledTime ? ` Scheduled: ${scheduledTime}.` : ""} Please review your updated schedule and the dispatch details before heading out.`;
        shortMessage = `Dispatch reassigned: ${name}`;
        break;
      }

      // ── Timesheets ───────────────────────────────────────────────────
      case "timesheet_approved": {
        const hours = eventData.totalHours ? ` (${eventData.totalHours} hrs)` : "";
        const period = eventData.period ? ` for period ${eventData.period}` : "";
        message = `Your timesheet "${name}"${period}${hours} has been approved. Your logged hours have been accepted and recorded. No further action is needed.`;
        shortMessage = `Timesheet approved: ${name}`;
        break;
      }

      case "timesheet_rejected": {
        const reason = eventData.reason ? ` Reason: ${eventData.reason}.` : "";
        message = `Your timesheet "${name}" has been rejected and requires corrections.${reason} Please log in to review the feedback and resubmit with the necessary changes as soon as possible.`;
        shortMessage = `Timesheet rejected: ${name}`;
        break;
      }

      case "clock_reminder":
        message = `This is a reminder that you have not yet clocked ${eventData.clockType === "out" ? "out" : "in"} today. Please log in and update your timesheet to ensure accurate records. Contact your supervisor if you are having trouble.`;
        shortMessage = "Clock in/out reminder";
        break;

      // ── Fleet ────────────────────────────────────────────────────────
      case "maintenance_due_3days":
        message = `Scheduled maintenance for "${name}"${plate}${maintenanceType} is due in 3 days${dueDate ? ` on ${dueDate}` : ""}. Please ensure the vehicle is available and any required parts or service appointments are arranged ahead of time.`;
        shortMessage = `Maintenance due in 3 days: ${name}`;
        break;

      case "maintenance_due_7days":
        message = `Scheduled maintenance for "${name}"${plate}${maintenanceType} is coming up in 7 days${dueDate ? ` on ${dueDate}` : ""}. This is an advance notice to help you plan and prepare for the upcoming service.`;
        shortMessage = `Maintenance due in 7 days: ${name}`;
        break;

      case "maintenance_overdue":
        message = `Maintenance for "${name}"${plate}${maintenanceType} is overdue${dueDate ? ` since ${dueDate}` : ""}. This vehicle should not be operated until the required maintenance is completed. Please arrange service immediately.`;
        shortMessage = `Maintenance overdue: ${name}`;
        break;

      case "safety_inspection_required":
        message = `A safety inspection is required for vehicle "${name}"${plate}. Please schedule the inspection immediately to ensure the vehicle remains compliant and safe to operate.`;
        shortMessage = `Safety inspection required: ${name}`;
        break;

      case "safety_inspection_expired":
        message = `The safety inspection for vehicle "${name}"${plate} has expired${dueDate ? ` on ${dueDate}` : ""}. This vehicle cannot be operated until a valid inspection is completed. Please schedule an inspection immediately.`;
        shortMessage = `Safety inspection expired: ${name}`;
        break;

      case "safety_inspection_failed":
        message = `The safety inspection for vehicle "${name}"${plate} has failed${eventData.failureReason ? ` — ${eventData.failureReason}` : ""}. The vehicle is currently out of service and must not be operated until all identified issues are resolved and re-inspected.`;
        shortMessage = `Safety inspection failed: ${name}`;
        break;

      case "driver_reassigned":
        message = `You have been reassigned to vehicle "${name}"${plate}. Please review the vehicle details, report any pre-existing damage, and ensure you are familiar with its condition before operating it.`;
        shortMessage = `Driver reassigned to: ${name}`;
        break;

      case "vehicle_registration_expiring":
        message = `The registration for vehicle "${name}"${plate} is expiring${dueDate ? ` on ${dueDate}` : " soon"}. Please initiate the renewal process immediately to avoid operating the vehicle with an expired registration, which may result in fines or compliance issues.`;
        shortMessage = `Registration expiring: ${name}`;
        break;

      case "vehicle_insurance_expiring":
        message = `The insurance policy for vehicle "${name}"${plate} is expiring${dueDate ? ` on ${dueDate}` : " soon"}. Please renew the policy immediately to ensure continuous coverage. Operating an uninsured vehicle is not permitted.`;
        shortMessage = `Insurance expiring: ${name}`;
        break;

      // ── Inventory ────────────────────────────────────────────────────
      case "low_stock_warning":
        message = `Inventory item "${name}" is running low. Current stock: ${eventData.stockLevel ?? 0} units${eventData.reorderLevel ? ` (reorder level: ${eventData.reorderLevel})` : ""}. Please initiate a reorder to avoid a stockout that could impact ongoing jobs.`;
        shortMessage = `Low stock: ${name}`;
        break;

      case "out_of_stock":
        message = `Inventory item "${name}" is now OUT OF STOCK${eventData.unit ? ` (${eventData.unit})` : ""}. This may impact ongoing or upcoming jobs that require this item. Please initiate an emergency reorder immediately.`;
        shortMessage = `Out of stock: ${name}`;
        break;

      case "stock_reordered":
        message = `A reorder for inventory item "${name}" has been placed${eventData.quantity ? ` — Quantity: ${eventData.quantity} units` : ""}${eventData.deliveryDate ? `. Expected delivery: ${eventData.deliveryDate}` : ""}. You will be notified when the stock is received.`;
        shortMessage = `Stock reordered: ${name}`;
        break;

      // ── Safety & Compliance ───────────────────────────────────────────
      case "safety_incident_reported":
        message = `A safety incident has been reported on job "${name}"${eventData.reportedBy ? ` by ${eventData.reportedBy}` : ""}${eventData.incidentDate ? ` on ${eventData.incidentDate}` : ""}${eventData.severity ? ` — Severity: ${eventData.severity}` : ""}. This requires immediate review and response. Please log in to read the full incident report and initiate the appropriate procedures.`;
        shortMessage = `Safety incident reported: ${name}`;
        break;

      case "employee_suspended":
        message = `Employee "${name}" has been suspended${eventData.effectiveDate ? ` effective ${eventData.effectiveDate}` : ""}${eventData.reason ? ` — Reason: ${eventData.reason}` : ""}. Please log in to review the details, ensure proper handover of responsibilities, and follow the required HR procedures.`;
        shortMessage = `Employee suspended: ${name}`;
        break;

      default:
        message = `There is an update regarding "${name}" that requires your attention. Please log in to review the latest information.`;
        shortMessage = `Update: ${name}`;
    }
  }

  return {
    message,
    shortMessage: shortMessage || message.substring(0, 100),
  };
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
