import type {
  NotificationCategory,
  NotificationPriority,
  DeliveryChannel,
  Notification,
  NotificationRule,
  NotificationPreference,
} from "../drizzle/schema/notifications.schema.js";

// Notification Event (triggered when something happens in the system)
export interface NotificationEvent {
  type: string; // e.g., 'job_assigned', 'invoice_overdue'
  category: NotificationCategory;
  priority: NotificationPriority;
  data: NotificationEventData;
  triggeredBy?: string; // User ID who triggered the event
}

// Event Data Structure
export interface NotificationEventData {
  entityType?: string; // Job, Invoice, Vehicle, etc.
  entityId?: string;
  entityName?: string;
  actionUrl?: string;
  message?: string;
  shortMessage?: string;
  notes?: string;
  
  // Context-specific data for recipient resolution
  assignedTechnicianId?: string;
  assignedTechnicianIds?: string[];
  projectManagerId?: string;
  clientId?: string;
  managerId?: string;
  executiveIds?: string[];
  driverId?: string;
  employeeId?: string;
  
  // Condition evaluation data
  amount?: number;
  daysUntilDue?: number;
  daysOverdue?: number;
  stockLevel?: number;
  reorderLevel?: number;
  
  // Additional context
  [key: string]: any;
}

// Notification Job (queued for delivery)
export interface NotificationJob {
  userId: string;
  notificationId: string;
  channels: DeliveryChannel[];
  data: Notification;
  retryCount?: number;
}

// Recipient Info
export interface RecipientInfo {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  role?: string;
}

// Category Preferences
export interface CategoryPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

// User Preferences Structure (for JSONB field)
export interface UserPreferencesData {
  job?: CategoryPreferences;
  dispatch?: CategoryPreferences;
  financial?: CategoryPreferences;
  expense?: CategoryPreferences;
  timesheet?: CategoryPreferences;
  inventory?: CategoryPreferences;
  fleet?: CategoryPreferences;
  safety?: CategoryPreferences;
  system?: CategoryPreferences;
}

// Email Template Data
export interface EmailTemplateData {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  additionalInfo?: Record<string, string>;
}

// SMS Template Data
export interface SMSTemplateData {
  recipientName: string;
  shortMessage: string;
  actionUrl?: string;
}

// Notification Statistics
export interface NotificationStats {
  totalNotifications: number;
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  recentCount: number; // Last 24 hours
}

// Delivery Status Summary
export interface DeliveryStatusSummary {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byChannel: {
    email: { sent: number; failed: number; pending: number };
    sms: { sent: number; failed: number; pending: number };
    push: { sent: number; failed: number; pending: number };
  };
}

// Filter Options for Notifications
export interface NotificationFilters {
  category?: NotificationCategory;
  priority?: NotificationPriority;
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
  type?: string;
}

// Paginated Notification Response
export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// Rule Condition Evaluator
export interface RuleConditions {
  amountThreshold?: number;
  daysBeforeThreshold?: number;
  daysAfterThreshold?: number;
  stockLevelThreshold?: number;
  percentageThreshold?: number;
  requiresAll?: boolean; // AND vs OR logic
  customCondition?: string; // For complex conditions
}

// Socket.IO Event Names
export const SOCKET_EVENTS = {
  // Client -> Server
  MARK_READ: "mark_notification_read",
  MARK_ALL_READ: "mark_all_notifications_read",
  DELETE_NOTIFICATION: "delete_notification",
  
  // Server -> Client
  NEW_NOTIFICATION: "notification",
  NOTIFICATION_READ: "notification_read",
  NOTIFICATION_DELETED: "notification_deleted",
  UNREAD_COUNT_UPDATE: "unread_count_update",
} as const;

// Notification Event Types (based on CSV)
export const NOTIFICATION_EVENT_TYPES = {
  // Authentication & Security
  TWO_FA_CODE: "2fa_code",
  PASSWORD_RESET_REQUEST: "password_reset_request",
  PASSWORD_CHANGED: "password_changed",
  NEW_ACCOUNT_CREATED: "new_account_created",
  PASSWORD_SETUP_LINK: "password_setup_link",
  ACCOUNT_LOCKED: "account_locked",
  
  // Jobs & Projects
  JOB_ASSIGNED: "job_assigned",
  JOB_STATUS_CHANGED: "job_status_changed",
  JOB_STARTED: "job_started",
  JOB_COMPLETED: "job_completed",
  JOB_OVERDUE: "job_overdue",
  JOB_CANCELLED: "job_cancelled",
  JOB_SITE_NOTES_ADDED: "job_site_notes_added",
  JOB_COST_EXCEEDS_BUDGET: "job_cost_exceeds_budget",
  
  // Bids & Proposals
  BID_CREATED: "bid_created",
  BID_SENT_TO_CLIENT: "bid_sent_to_client",
  BID_EXPIRED: "bid_expired",
  BID_WON: "bid_won",
  BID_REQUIRES_APPROVAL: "bid_requires_approval",
  
  // Invoicing & Payments
  INVOICE_SENT: "invoice_sent",
  PAYMENT_RECEIVED_FULL: "payment_received_full",
  PAYMENT_RECEIVED_PARTIAL: "payment_received_partial",
  INVOICE_DUE_TOMORROW: "invoice_due_tomorrow",
  INVOICE_OVERDUE_1DAY: "invoice_overdue_1day",
  INVOICE_OVERDUE_7DAYS: "invoice_overdue_7days",
  INVOICE_OVERDUE_30DAYS: "invoice_overdue_30days",
  INVOICE_CANCELLED: "invoice_cancelled",
  
  // Dispatch & Scheduling
  TECHNICIAN_ASSIGNED_TO_DISPATCH: "technician_assigned_to_dispatch",
  DISPATCH_REASSIGNED: "dispatch_reassigned",
  
  // Timesheets & Labor
  TIMESHEET_APPROVED: "timesheet_approved",
  TIMESHEET_REJECTED: "timesheet_rejected",
  CLOCK_REMINDER: "clock_reminder",
  TIMESHEET_RESUBMITTED: "timesheet_resubmitted",
  
  // Expenses
  JOB_BUDGET_EXCEEDED: "job_budget_exceeded",
  
  // Fleet Management
  VEHICLE_CHECKED_OUT: "vehicle_checked_out",
  VEHICLE_CHECKED_IN: "vehicle_checked_in",
  MAINTENANCE_DUE_7DAYS: "maintenance_due_7days",
  MAINTENANCE_DUE_3DAYS: "maintenance_due_3days",
  MAINTENANCE_OVERDUE: "maintenance_overdue",
  SAFETY_INSPECTION_REQUIRED: "safety_inspection_required",
  SAFETY_INSPECTION_EXPIRED: "safety_inspection_expired",
  SAFETY_INSPECTION_FAILED: "safety_inspection_failed",
  DRIVER_REASSIGNED: "driver_reassigned",
  VEHICLE_REGISTRATION_EXPIRING: "vehicle_registration_expiring",
  VEHICLE_INSURANCE_EXPIRING: "vehicle_insurance_expiring",
  
  // Inventory
  LOW_STOCK_WARNING: "low_stock_warning",
  OUT_OF_STOCK: "out_of_stock",
  STOCK_REORDERED: "stock_reordered",
  PURCHASE_ORDER_CREATED: "purchase_order_created",
  PURCHASE_ORDER_APPROVED: "purchase_order_approved",
  PURCHASE_ORDER_RECEIVED_FULL: "purchase_order_received_full",
  PURCHASE_ORDER_RECEIVED_PARTIAL: "purchase_order_received_partial",
  PURCHASE_ORDER_DELAYED: "purchase_order_delayed",
  ITEM_ALLOCATED_TO_JOB: "item_allocated_to_job",
  
  // Team & HR
  NEW_EMPLOYEE_ONBOARDED: "new_employee_onboarded",
  PERFORMANCE_REVIEW_DUE: "performance_review_due",
  
  // Safety & Compliance
  SAFETY_INCIDENT_REPORTED: "safety_incident_reported",
  COMPLIANCE_CASE_OPENED: "compliance_case_opened",
  COMPLIANCE_CASE_RESOLVED: "compliance_case_resolved",
  EMPLOYEE_SUSPENDED: "employee_suspended",
} as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[keyof typeof NOTIFICATION_EVENT_TYPES];

// Re-export schema types
export type {
  NotificationCategory,
  NotificationPriority,
  DeliveryChannel,
  Notification,
  NotificationRule,
  NotificationPreference,
};
