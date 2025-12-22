ALTER TABLE "org"."positions" DROP CONSTRAINT "positions_name_unique";--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" DROP CONSTRAINT "role_permissions_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" DROP CONSTRAINT "role_permissions_permission_id_permissions_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."trusted_devices" DROP CONSTRAINT "trusted_devices_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."user_roles" DROP CONSTRAINT "user_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."user_roles" DROP CONSTRAINT "user_roles_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" DROP CONSTRAINT "bid_design_build_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" DROP CONSTRAINT "bid_design_build_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" DROP CONSTRAINT "bid_design_build_files_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" DROP CONSTRAINT "bid_design_build_files_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" DROP CONSTRAINT "bid_design_build_files_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_documents" DROP CONSTRAINT "bid_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_documents" DROP CONSTRAINT "bid_documents_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_documents" DROP CONSTRAINT "bid_documents_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" DROP CONSTRAINT "bid_financial_breakdown_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" DROP CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_history" DROP CONSTRAINT "bid_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_history" DROP CONSTRAINT "bid_history_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_history" DROP CONSTRAINT "bid_history_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP CONSTRAINT "bid_labor_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP CONSTRAINT "bid_labor_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_materials" DROP CONSTRAINT "bid_materials_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_materials" DROP CONSTRAINT "bid_materials_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_notes" DROP CONSTRAINT "bid_notes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_notes" DROP CONSTRAINT "bid_notes_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_notes" DROP CONSTRAINT "bid_notes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" DROP CONSTRAINT "bid_operating_expenses_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" DROP CONSTRAINT "bid_operating_expenses_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" DROP CONSTRAINT "bid_plan_spec_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" DROP CONSTRAINT "bid_plan_spec_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" DROP CONSTRAINT "bid_plan_spec_files_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" DROP CONSTRAINT "bid_plan_spec_files_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" DROP CONSTRAINT "bid_plan_spec_files_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_technician_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP CONSTRAINT "bid_timeline_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP CONSTRAINT "bid_timeline_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP CONSTRAINT "bid_timeline_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP CONSTRAINT "bid_travel_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP CONSTRAINT "bid_travel_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_primary_teammate_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_supervisor_manager_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_technician_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."capacity_planning_templates" DROP CONSTRAINT "capacity_planning_templates_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."capacity_planning_templates" DROP CONSTRAINT "capacity_planning_templates_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."department_capacity_metrics" DROP CONSTRAINT "department_capacity_metrics_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."department_capacity_metrics" DROP CONSTRAINT "department_capacity_metrics_calculated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_availability" DROP CONSTRAINT "employee_availability_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_availability" DROP CONSTRAINT "employee_availability_current_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_availability" DROP CONSTRAINT "employee_availability_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_shifts" DROP CONSTRAINT "employee_shifts_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_shifts" DROP CONSTRAINT "employee_shifts_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" DROP CONSTRAINT "resource_allocations_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" DROP CONSTRAINT "resource_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" DROP CONSTRAINT "resource_allocations_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" DROP CONSTRAINT "resource_allocations_assigned_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."team_utilization_history" DROP CONSTRAINT "team_utilization_history_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."team_utilization_history" DROP CONSTRAINT "team_utilization_history_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" DROP CONSTRAINT "compliance_audit_log_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" DROP CONSTRAINT "compliance_audit_log_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT "employee_certifications_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" DROP CONSTRAINT "employee_certifications_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_reported_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" DROP CONSTRAINT "employee_compliance_cases_resolved_by_users_id_fk";
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
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" DROP CONSTRAINT "employee_violation_history_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" DROP CONSTRAINT "safety_inspection_items_inspection_id_safety_inspections_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."training_programs" DROP CONSTRAINT "training_programs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_current_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_allocated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT "inventory_count_items_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT "inventory_count_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT "inventory_counts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT "inventory_counts_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT "inventory_counts_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP CONSTRAINT "inventory_item_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP CONSTRAINT "inventory_item_history_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP CONSTRAINT "inventory_item_history_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT "inventory_item_locations_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT "inventory_item_locations_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT "inventory_item_locations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_primary_supplier_id_inventory_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_unit_of_measure_id_inventory_units_of_measure_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_primary_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP CONSTRAINT "inventory_locations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP CONSTRAINT "inventory_locations_parent_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP CONSTRAINT "inventory_locations_manager_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT "inventory_purchase_order_items_purchase_order_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT "inventory_purchase_order_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_supplier_id_inventory_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_ship_to_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT "inventory_stock_alerts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT "inventory_stock_alerts_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT "inventory_stock_alerts_acknowledged_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT "inventory_stock_alerts_resolved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" DROP CONSTRAINT "inventory_suppliers_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk";
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
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" DROP CONSTRAINT "job_financial_summary_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" DROP CONSTRAINT "job_financial_summary_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_team_members" DROP CONSTRAINT "job_team_members_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_team_members" DROP CONSTRAINT "job_team_members_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_project_manager_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_lead_technician_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."cash_flow_projection" DROP CONSTRAINT "cash_flow_projection_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" DROP CONSTRAINT "cash_flow_scenarios_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" DROP CONSTRAINT "cash_flow_scenarios_projection_id_cash_flow_projection_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_contacts" DROP CONSTRAINT "client_contacts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" DROP CONSTRAINT "client_document_categories_document_id_client_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" DROP CONSTRAINT "client_document_categories_category_id_document_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_documents" DROP CONSTRAINT "client_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_documents" DROP CONSTRAINT "client_documents_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_notes" DROP CONSTRAINT "client_notes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."client_notes" DROP CONSTRAINT "client_notes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."departments" DROP CONSTRAINT "departments_lead_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employees" DROP CONSTRAINT "employees_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employees" DROP CONSTRAINT "employees_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employees" DROP CONSTRAINT "employees_position_id_positions_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employees" DROP CONSTRAINT "employees_reports_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."financial_cost_categories" DROP CONSTRAINT "financial_cost_categories_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."financial_reports" DROP CONSTRAINT "financial_reports_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."financial_summary" DROP CONSTRAINT "financial_summary_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_client_type_id_client_types_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_industry_classification_id_industry_classifications_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_billing_contact_id_client_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."positions" DROP CONSTRAINT "positions_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."profit_trend" DROP CONSTRAINT "profit_trend_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."properties" DROP CONSTRAINT "properties_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."properties" DROP CONSTRAINT "properties_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_contacts" DROP CONSTRAINT "property_contacts_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_documents" DROP CONSTRAINT "property_documents_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_documents" DROP CONSTRAINT "property_documents_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_equipment" DROP CONSTRAINT "property_equipment_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_service_history" DROP CONSTRAINT "property_service_history_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_service_history" DROP CONSTRAINT "property_service_history_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_service_history" DROP CONSTRAINT "property_service_history_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."property_service_history" DROP CONSTRAINT "property_service_history_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."revenue_forecast" DROP CONSTRAINT "revenue_forecast_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."user_organizations" DROP CONSTRAINT "user_organizations_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."user_organizations" DROP CONSTRAINT "user_organizations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" DROP CONSTRAINT "employee_benefits_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" DROP CONSTRAINT "employee_benefits_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT "employee_compensation_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT "employee_compensation_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT "employee_compensation_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" DROP CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" DROP CONSTRAINT "employee_leave_balances_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_locked_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_processed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT "payroll_approval_workflow_payroll_run_id_payroll_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT "payroll_approval_workflow_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT "payroll_approval_workflow_current_approver_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" DROP CONSTRAINT "payroll_approval_workflow_overridden_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" DROP CONSTRAINT "payroll_audit_log_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" DROP CONSTRAINT "payroll_audit_log_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_deductions" DROP CONSTRAINT "payroll_deductions_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_bank_account_id_user_bank_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_processed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" DROP CONSTRAINT "payroll_locks_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" DROP CONSTRAINT "payroll_locks_locked_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" DROP CONSTRAINT "payroll_locks_unlocked_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_pay_period_id_pay_periods_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_processed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT "payroll_timesheet_entries_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT "payroll_timesheet_entries_timesheet_id_timesheets_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" DROP CONSTRAINT "payroll_timesheet_entries_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."timesheet_payroll_integration_log" DROP CONSTRAINT "timesheet_payroll_integration_log_payroll_entry_id_payroll_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "org"."training_programs" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "auth"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD CONSTRAINT "bid_design_build_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD CONSTRAINT "bid_design_build_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD CONSTRAINT "bid_operating_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD CONSTRAINT "bid_operating_expenses_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD CONSTRAINT "bid_plan_spec_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD CONSTRAINT "bid_plan_spec_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_primary_teammate_users_id_fk" FOREIGN KEY ("primary_teammate") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_supervisor_manager_users_id_fk" FOREIGN KEY ("supervisor_manager") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "org"."training_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk" FOREIGN KEY ("compliance_case_id") REFERENCES "org"."employee_compliance_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" ADD CONSTRAINT "safety_inspection_items_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_allocated_by_users_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "org"."inventory_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_primary_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("primary_supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_unit_of_measure_id_inventory_units_of_measure_id_fk" FOREIGN KEY ("unit_of_measure_id") REFERENCES "org"."inventory_units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_primary_location_id_inventory_locations_id_fk" FOREIGN KEY ("primary_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_parent_location_id_inventory_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_ship_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("ship_to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_project_manager_users_id_fk" FOREIGN KEY ("project_manager") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_lead_technician_users_id_fk" FOREIGN KEY ("lead_technician") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_projection" ADD CONSTRAINT "cash_flow_projection_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_projection_id_cash_flow_projection_id_fk" FOREIGN KEY ("projection_id") REFERENCES "org"."cash_flow_projection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" ADD CONSTRAINT "client_document_categories_document_id_client_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "org"."client_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" ADD CONSTRAINT "client_document_categories_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."document_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD CONSTRAINT "departments_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "org"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_reports_to_users_id_fk" FOREIGN KEY ("reports_to") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_cost_categories" ADD CONSTRAINT "financial_cost_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_reports" ADD CONSTRAINT "financial_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_summary" ADD CONSTRAINT "financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_client_type_id_client_types_id_fk" FOREIGN KEY ("client_type_id") REFERENCES "org"."client_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_industry_classification_id_industry_classifications_id_fk" FOREIGN KEY ("industry_classification_id") REFERENCES "org"."industry_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_billing_contact_id_client_contacts_id_fk" FOREIGN KEY ("billing_contact_id") REFERENCES "org"."client_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."profit_trend" ADD CONSTRAINT "profit_trend_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_contacts" ADD CONSTRAINT "property_contacts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_equipment" ADD CONSTRAINT "property_equipment_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."revenue_forecast" ADD CONSTRAINT "revenue_forecast_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" ADD CONSTRAINT "employee_benefits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" ADD CONSTRAINT "employee_benefits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_current_approver_users_id_fk" FOREIGN KEY ("current_approver") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" ADD CONSTRAINT "payroll_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" ADD CONSTRAINT "payroll_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "org"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_unlocked_by_users_id_fk" FOREIGN KEY ("unlocked_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "org"."pay_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_payroll_integration_log" ADD CONSTRAINT "timesheet_payroll_integration_log_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_compliance_cases_job" ON "org"."employee_compliance_cases" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_cases_case_number" ON "org"."employee_compliance_cases" USING btree ("case_number");--> statement-breakpoint
ALTER TABLE "org"."positions" ADD CONSTRAINT "unique_position_name_per_dept" UNIQUE("name","department_id");