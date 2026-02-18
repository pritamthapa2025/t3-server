ALTER TABLE "org"."client_contacts" DROP CONSTRAINT IF EXISTS "client_contacts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" DROP CONSTRAINT IF EXISTS "client_document_categories_document_id_client_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_documents" DROP CONSTRAINT IF EXISTS "client_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_notes" DROP CONSTRAINT IF EXISTS "client_notes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."financial_reports" DROP CONSTRAINT IF EXISTS "financial_reports_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."properties" DROP CONSTRAINT IF EXISTS "properties_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."user_organizations" DROP CONSTRAINT IF EXISTS "user_organizations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" DROP CONSTRAINT IF EXISTS "compliance_audit_log_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT IF EXISTS "employee_certifications_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT IF EXISTS "employee_certifications_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT IF EXISTS "employee_compliance_cases_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT IF EXISTS "employee_compliance_cases_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT IF EXISTS "employee_compliance_cases_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT IF EXISTS "employee_training_records_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT IF EXISTS "employee_training_records_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT IF EXISTS "employee_training_records_training_program_id_training_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT IF EXISTS "employee_violation_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT IF EXISTS "employee_violation_history_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT IF EXISTS "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" DROP CONSTRAINT IF EXISTS "safety_inspection_items_inspection_id_safety_inspections_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT IF EXISTS "safety_inspections_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT IF EXISTS "safety_inspections_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."training_programs" DROP CONSTRAINT IF EXISTS "training_programs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_current_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_current_dispatch_task_id_dispatch_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP CONSTRAINT IF EXISTS "dispatch_assignments_task_id_dispatch_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP CONSTRAINT IF EXISTS "dispatch_assignments_technician_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" DROP CONSTRAINT IF EXISTS "dispatch_tasks_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" DROP CONSTRAINT IF EXISTS "expense_allocations_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" DROP CONSTRAINT IF EXISTS "expense_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" DROP CONSTRAINT IF EXISTS "expense_approvals_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" DROP CONSTRAINT IF EXISTS "expense_approvals_report_id_expense_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT IF EXISTS "expense_budgets_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT IF EXISTS "expense_budgets_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT IF EXISTS "expense_budgets_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_history" DROP CONSTRAINT IF EXISTS "expense_history_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_history" DROP CONSTRAINT IF EXISTS "expense_history_report_id_expense_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_receipts" DROP CONSTRAINT IF EXISTS "expense_receipts_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" DROP CONSTRAINT IF EXISTS "expense_reimbursement_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" DROP CONSTRAINT IF EXISTS "expense_reimbursement_items_reimbursement_id_expense_reimbursements_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" DROP CONSTRAINT IF EXISTS "expense_reimbursement_items_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" DROP CONSTRAINT IF EXISTS "expense_reimbursements_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" DROP CONSTRAINT IF EXISTS "expense_reimbursements_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" DROP CONSTRAINT IF EXISTS "expense_reimbursements_report_id_expense_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" DROP CONSTRAINT IF EXISTS "expense_report_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" DROP CONSTRAINT IF EXISTS "expense_report_items_report_id_expense_reports_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" DROP CONSTRAINT IF EXISTS "expense_report_items_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reports" DROP CONSTRAINT IF EXISTS "expense_reports_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reports" DROP CONSTRAINT IF EXISTS "expense_reports_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expenses" DROP CONSTRAINT IF EXISTS "expenses_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" DROP CONSTRAINT IF EXISTS "mileage_logs_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" DROP CONSTRAINT IF EXISTS "mileage_logs_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP CONSTRAINT IF EXISTS "assignment_history_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP CONSTRAINT IF EXISTS "assignment_history_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP CONSTRAINT IF EXISTS "assignment_history_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP CONSTRAINT IF EXISTS "check_in_out_records_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP CONSTRAINT IF EXISTS "check_in_out_records_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."fuel_records" DROP CONSTRAINT IF EXISTS "fuel_records_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."fuel_records" DROP CONSTRAINT IF EXISTS "fuel_records_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" DROP CONSTRAINT IF EXISTS "maintenance_records_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" DROP CONSTRAINT IF EXISTS "maintenance_records_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."repair_records" DROP CONSTRAINT IF EXISTS "repair_records_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."repair_records" DROP CONSTRAINT IF EXISTS "repair_records_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" DROP CONSTRAINT IF EXISTS "vehicle_documents_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicle_history" DROP CONSTRAINT IF EXISTS "vehicle_history_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" DROP CONSTRAINT IF EXISTS "vehicle_media_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicle_metrics" DROP CONSTRAINT IF EXISTS "vehicle_metrics_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT IF EXISTS "inventory_allocations_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT IF EXISTS "inventory_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT IF EXISTS "inventory_allocations_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT IF EXISTS "inventory_count_items_count_id_inventory_counts_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT IF EXISTS "inventory_count_items_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT IF EXISTS "inventory_counts_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP CONSTRAINT IF EXISTS "inventory_item_history_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT IF EXISTS "inventory_item_locations_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT IF EXISTS "inventory_item_locations_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" DROP CONSTRAINT IF EXISTS "inventory_price_history_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" DROP CONSTRAINT IF EXISTS "inventory_price_history_supplier_id_inventory_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" DROP CONSTRAINT IF EXISTS "inventory_price_history_purchase_order_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT IF EXISTS "inventory_purchase_order_items_purchase_order_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT IF EXISTS "inventory_purchase_order_items_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT IF EXISTS "inventory_stock_alerts_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_from_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT IF EXISTS "inventory_transactions_to_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" DROP CONSTRAINT IF EXISTS "credit_note_applications_credit_note_id_credit_notes_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" DROP CONSTRAINT IF EXISTS "credit_note_applications_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_client_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" DROP CONSTRAINT IF EXISTS "invoice_documents_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_history" DROP CONSTRAINT IF EXISTS "invoice_history_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" DROP CONSTRAINT IF EXISTS "invoice_reminders_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT IF EXISTS "invoices_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT IF EXISTS "invoices_parent_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payment_documents" DROP CONSTRAINT IF EXISTS "payment_documents_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payment_history" DROP CONSTRAINT IF EXISTS "payment_history_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payments" DROP CONSTRAINT IF EXISTS "payments_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_expenses" DROP CONSTRAINT IF EXISTS "job_expenses_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_surveys" DROP CONSTRAINT IF EXISTS "job_surveys_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_surveys" DROP CONSTRAINT IF EXISTS "job_surveys_technician_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_tasks" DROP CONSTRAINT IF EXISTS "job_tasks_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_team_members" DROP CONSTRAINT IF EXISTS "job_team_members_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_team_members" DROP CONSTRAINT IF EXISTS "job_team_members_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT IF EXISTS "jobs_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."task_comments" DROP CONSTRAINT IF EXISTS "task_comments_job_task_id_job_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_documents" DROP CONSTRAINT IF EXISTS "employee_documents_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_reviews" DROP CONSTRAINT IF EXISTS "employee_reviews_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT IF EXISTS "employee_compensation_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT IF EXISTS "payroll_approval_workflow_payroll_run_id_payroll_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT IF EXISTS "payroll_approval_workflow_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_payroll_run_id_payroll_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT IF EXISTS "payroll_entries_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT IF EXISTS "payroll_timesheet_entries_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT IF EXISTS "payroll_timesheet_entries_timesheet_id_timesheets_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT IF EXISTS "payroll_timesheet_entries_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."timesheet_payroll_integration_log" DROP CONSTRAINT IF EXISTS "timesheet_payroll_integration_log_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."timesheet_approvals" DROP CONSTRAINT IF EXISTS "timesheet_approvals_timesheet_id_timesheets_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."timesheets" DROP CONSTRAINT IF EXISTS "timesheets_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" ALTER COLUMN "rating" SET DATA TYPE numeric(4, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."client_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."property_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."employee_documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" ADD CONSTRAINT "client_document_categories_document_id_client_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "org"."client_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_reports" ADD CONSTRAINT "financial_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "org"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk" FOREIGN KEY ("compliance_case_id") REFERENCES "org"."employee_compliance_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" ADD CONSTRAINT "safety_inspection_items_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_dispatch_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("current_dispatch_task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_receipts" ADD CONSTRAINT "expense_receipts_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_reimbursement_id_expense_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "org"."expense_reimbursements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_history" ADD CONSTRAINT "vehicle_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" ADD CONSTRAINT "vehicle_media_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_metrics" ADD CONSTRAINT "vehicle_metrics_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "org"."inventory_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "org"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_client_id_organizations_id_fk" FOREIGN KEY ("client_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD CONSTRAINT "invoice_documents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_parent_invoice_id_invoices_id_fk" FOREIGN KEY ("parent_invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_documents" ADD CONSTRAINT "payment_documents_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_history" ADD CONSTRAINT "payment_history_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD CONSTRAINT "job_expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ADD CONSTRAINT "job_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."task_comments" ADD CONSTRAINT "task_comments_job_task_id_job_tasks_id_fk" FOREIGN KEY ("job_task_id") REFERENCES "org"."job_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD CONSTRAINT "departments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_reviews" ADD CONSTRAINT "employee_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_payroll_integration_log" ADD CONSTRAINT "timesheet_payroll_integration_log_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_files_deleted_at" ON "org"."bid_design_build_files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_bid_documents_deleted_at" ON "org"."bid_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_bid_media_deleted_at" ON "org"."bid_media" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_files_deleted_at" ON "org"."bid_plan_spec_files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_client_docs_deleted_at" ON "org"."client_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_orgs_deleted_at" ON "org"."organizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_property_docs_deleted_at" ON "org"."property_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_compliance_cases_deleted_at" ON "org"."employee_compliance_cases" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_vehicles_deleted_at" ON "org"."vehicles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_expenses_deleted_at" ON "org"."expenses" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_deleted_at" ON "org"."vehicle_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_deleted_at" ON "org"."vehicle_media" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_deleted_at" ON "org"."inventory_items" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_deleted_at" ON "org"."invoice_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_deleted_at" ON "org"."invoices" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_departments_deleted_at" ON "org"."departments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_deleted_at" ON "org"."employee_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_deleted_at" ON "org"."payroll_runs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_timesheets_is_deleted" ON "org"."timesheets" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_timesheets_deleted_at" ON "org"."timesheets" USING btree ("deleted_at");