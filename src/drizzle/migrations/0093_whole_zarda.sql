ALTER TABLE "org"."bid_design_build_data" DROP CONSTRAINT "bid_design_build_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" DROP CONSTRAINT "bid_design_build_files_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" DROP CONSTRAINT "bid_document_tag_links_document_id_bid_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" DROP CONSTRAINT "bid_document_tag_links_tag_id_bid_document_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_document_tags" DROP CONSTRAINT "bid_document_tags_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_documents" DROP CONSTRAINT "bid_documents_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" DROP CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_history" DROP CONSTRAINT "bid_history_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP CONSTRAINT "bid_labor_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_materials" DROP CONSTRAINT "bid_materials_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_media" DROP CONSTRAINT "bid_media_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_notes" DROP CONSTRAINT "bid_notes_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" DROP CONSTRAINT "bid_operating_expenses_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" DROP CONSTRAINT "bid_plan_spec_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" DROP CONSTRAINT "bid_plan_spec_files_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP CONSTRAINT "bid_timeline_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP CONSTRAINT "bid_travel_bid_labor_id_bid_labor_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT "employee_certifications_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT "employee_certifications_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT "employee_training_records_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT "employee_training_records_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" DROP CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT "employee_violation_history_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_current_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_current_dispatch_task_id_dispatch_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP CONSTRAINT "dispatch_assignments_technician_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" DROP CONSTRAINT "expense_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT "expense_budgets_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT "expense_budgets_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" DROP CONSTRAINT "expense_reimbursement_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" DROP CONSTRAINT "expense_reimbursement_items_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" DROP CONSTRAINT "expense_reimbursements_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" DROP CONSTRAINT "expense_reimbursements_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reports" DROP CONSTRAINT "expense_reports_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expense_reports" DROP CONSTRAINT "expense_reports_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expenses" DROP CONSTRAINT "expenses_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" DROP CONSTRAINT "mileage_logs_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP CONSTRAINT "assignment_history_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP CONSTRAINT "assignment_history_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP CONSTRAINT "check_in_out_records_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."fuel_records" DROP CONSTRAINT "fuel_records_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" DROP CONSTRAINT "maintenance_records_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."repair_records" DROP CONSTRAINT "repair_records_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."repair_records" DROP CONSTRAINT "repair_records_linked_maintenance_id_maintenance_records_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."repair_records" DROP CONSTRAINT "repair_records_linked_inspection_id_safety_inspections_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_from_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_to_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" DROP CONSTRAINT "credit_note_applications_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT "credit_notes_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT "credit_notes_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT "invoices_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payments" DROP CONSTRAINT "payments_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_surveys" DROP CONSTRAINT "job_surveys_technician_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT "employee_compensation_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."timesheets" DROP CONSTRAINT "timesheets_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ALTER COLUMN "training_program_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ALTER COLUMN "technician_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ALTER COLUMN "expense_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ALTER COLUMN "invoice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."payments" ALTER COLUMN "invoice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD CONSTRAINT "bid_design_build_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" ADD CONSTRAINT "bid_document_tag_links_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "org"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" ADD CONSTRAINT "bid_document_tag_links_tag_id_bid_document_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "org"."bid_document_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_document_tags" ADD CONSTRAINT "bid_document_tags_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD CONSTRAINT "bid_media_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD CONSTRAINT "bid_operating_expenses_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD CONSTRAINT "bid_plan_spec_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_bid_labor_id_bid_labor_id_fk" FOREIGN KEY ("bid_labor_id") REFERENCES "org"."bid_labor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "org"."training_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_dispatch_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("current_dispatch_task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_linked_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("linked_maintenance_id") REFERENCES "org"."maintenance_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_linked_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("linked_inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;