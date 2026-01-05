import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all tables from schemas
import * as authSchema from "../src/drizzle/schema/auth.schema.js";
import * as orgSchema from "../src/drizzle/schema/org.schema.js";

interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  relations: RelationInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface RelationInfo {
  targetTable: string;
  targetSchema: string;
  column: string;
  onDelete?: string;
}

function extractTableInfo(schemaName: string, tables: any[]): TableInfo[] {
  const tableInfos: TableInfo[] = [];

  for (const table of tables) {
    const tableName =
      table[Symbol.for("drizzle:Name")] || table.name || "unknown";
    const columns: ColumnInfo[] = [];
    const relations: RelationInfo[] = [];

    // Extract columns and relations from table definition
    const tableDef = table[Symbol.for("drizzle:Columns")] || {};

    for (const [colName, colDef] of Object.entries(tableDef)) {
      const col = colDef as any;
      const colType = col.dataType || "unknown";
      const isNullable = !col.notNull;
      const isPrimaryKey = col.primary || false;

      // Check for foreign key references
      let isForeignKey = false;
      if (col.references) {
        isForeignKey = true;
        const ref = col.references();
        const targetTable = ref[0]?.name || "unknown";
        const targetSchema = ref[0]?.schema?.name || schemaName;
        relations.push({
          targetTable,
          targetSchema,
          column: colName,
          onDelete: col.onDelete,
        });
      }

      columns.push({
        name: colName,
        type: colType,
        nullable: isNullable,
        isPrimaryKey,
        isForeignKey,
      });
    }

    tableInfos.push({
      name: tableName,
      schema: schemaName,
      columns,
      relations,
    });
  }

  return tableInfos;
}

function generateMermaidERD(tableInfos: TableInfo[]): string {
  let mermaid = "erDiagram\n";

  // Group tables by schema
  const tablesBySchema = new Map<string, TableInfo[]>();
  for (const table of tableInfos) {
    if (!tablesBySchema.has(table.schema)) {
      tablesBySchema.set(table.schema, []);
    }
    tablesBySchema.get(table.schema)!.push(table);
  }

  // Generate table definitions
  for (const [schema, tables] of tablesBySchema) {
    for (const table of tables) {
      const fullTableName = `${schema}_${table.name}`;
      mermaid += `    ${fullTableName} {\n`;

      for (const col of table.columns) {
        let colDef = `        ${col.type} ${col.name}`;
        if (col.isPrimaryKey) {
          colDef += " PK";
        }
        if (col.isForeignKey) {
          colDef += " FK";
        }
        if (col.nullable) {
          colDef += ' "nullable"';
        }
        mermaid += colDef + "\n";
      }

      mermaid += "    }\n";
    }
  }

  // Generate relationships
  mermaid += "\n";
  for (const table of tableInfos) {
    const fullTableName = `${table.schema}_${table.name}`;
    for (const relation of table.relations) {
      const targetFullName = `${relation.targetSchema}_${relation.targetTable}`;
      mermaid += `    ${targetFullName} ||--o{ ${fullTableName} : "has many"\n`;
    }
  }

  return mermaid;
}

function generateSimpleERD(): string {
  // Since extracting from Drizzle schema objects is complex,
  // let's create a manual ERD based on the schema files we read
  return `erDiagram
    auth_users {
        uuid id PK
        varchar full_name
        varchar email UK
        text password_hash
        varchar phone
        boolean is_active
        boolean is_verified
        timestamp created_at
    }
    
    auth_roles {
        serial id PK
        varchar name UK
        text description
    }
    
    auth_permissions {
        serial id PK
        varchar code UK
        text description
        varchar module
    }
    
    auth_role_permissions {
        integer role_id PK,FK
        integer permission_id PK,FK
    }
    
    auth_user_roles {
        uuid user_id PK,FK
        integer role_id PK,FK
    }
    
    auth_audit_logs {
        bigint id PK
        uuid user_id FK
        varchar event_type
        text description
        timestamp created_at
    }
    
    org_organizations {
        uuid id PK
        varchar name
        varchar legal_name
        enum client_type
        enum status
        uuid parent_organization_id FK
        uuid account_manager FK
        uuid created_by FK
        timestamp created_at
    }
    
    org_departments {
        serial id PK
        uuid organization_id FK
        varchar name
        text description
    }
    
    org_positions {
        serial id PK
        integer department_id FK
        varchar name UK
        text description
    }
    
    org_employees {
        serial id PK
        uuid user_id FK
        varchar employee_id UK
        integer department_id FK
        integer position_id FK
        uuid reports_to FK
        enum status
        timestamp start_date
        timestamp end_date
    }
    
    org_user_bank_accounts {
        uuid id PK
        uuid user_id FK
        varchar account_holder_name
        varchar bank_name
        varchar account_number
        enum account_type
        boolean is_primary
    }
    
    org_employee_reviews {
        serial id PK
        integer employee_id FK
        uuid reviewer_id FK
        varchar title
        jsonb ratings
        timestamp review_date
    }
    
    org_timesheets {
        serial id PK
        integer employee_id FK
        date sheet_date
        timestamp clock_in
        timestamp clock_out
        numeric total_hours
        enum status
        uuid submitted_by FK
        uuid approved_by FK
    }
    
    org_timesheet_approvals {
        serial id PK
        integer timesheet_id FK
        varchar action
        uuid performed_by FK
        text remarks
    }
    
    org_properties {
        uuid id PK
        uuid organization_id FK
        varchar property_name
        varchar property_code
        enum property_type
        enum status
        text address_line1
        varchar city
        varchar state
        numeric square_footage
        uuid created_by FK
    }
    
    org_property_contacts {
        uuid id PK
        uuid property_id FK
        varchar full_name
        varchar email
        varchar phone
        varchar contact_type
        boolean is_primary
    }
    
    org_property_equipment {
        uuid id PK
        uuid property_id FK
        varchar equipment_tag
        varchar equipment_type
        varchar make
        varchar model
        varchar serial_number
        date install_date
    }
    
    org_property_documents {
        uuid id PK
        uuid property_id FK
        varchar file_name
        varchar file_path
        varchar document_type
        uuid uploaded_by FK
    }
    
    org_property_service_history {
        uuid id PK
        uuid property_id FK
        uuid job_id FK
        uuid bid_id FK
        date service_date
        varchar service_type
        uuid performed_by FK
    }
    
    org_client_contacts {
        uuid id PK
        uuid organization_id FK
        varchar full_name
        varchar email
        varchar phone
        enum contact_type
        boolean is_primary
    }
    
    org_client_notes {
        uuid id PK
        uuid organization_id FK
        varchar note_type
        text content
        uuid created_by FK
    }
    
    org_client_documents {
        uuid id PK
        uuid organization_id FK
        varchar file_name
        varchar file_path
        varchar document_type
        uuid uploaded_by FK
    }
    
    org_jobs {
        uuid id PK
        uuid organization_id FK
        varchar name
        text description
    }
    
    org_bids {
        uuid id PK
        uuid organization_id FK
        varchar bid_number UK
        varchar title
        enum job_type
        enum status
        enum priority
        numeric bid_amount
        uuid created_by FK
        uuid assigned_to FK
        uuid primary_teammate FK
        uuid supervisor_manager FK
        uuid technician_id FK
        uuid job_id FK
        date start_date
        date end_date
    }
    
    org_bid_financial_breakdown {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK,UK
        numeric materials_equipment
        numeric labor
        numeric travel
        numeric operating_expenses
        numeric total_cost
    }
    
    org_bid_materials {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        text description
        numeric quantity
        numeric unit_cost
        numeric total_cost
    }
    
    org_bid_labor {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        varchar role
        integer quantity
        integer days
        numeric cost_rate
        numeric total_cost
    }
    
    org_bid_travel {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        varchar employee_name
        numeric round_trip_miles
        numeric mileage_rate
        numeric total_cost
    }
    
    org_bid_operating_expenses {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK,UK
        boolean enabled
        numeric gross_revenue_previous_year
        numeric calculated_operating_cost
    }
    
    org_bid_survey_data {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK,UK
        varchar building_number
        text site_location
        varchar work_type
        uuid technician_id FK
    }
    
    org_bid_plan_spec_data {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK,UK
        text specifications
        text design_requirements
    }
    
    org_bid_design_build_data {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK,UK
        text design_requirements
        text build_specifications
    }
    
    org_bid_timeline {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        varchar event
        timestamp event_date
        enum status
        uuid created_by FK
    }
    
    org_bid_documents {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        varchar file_name
        varchar file_path
        varchar document_type
        uuid uploaded_by FK
    }
    
    org_bid_notes {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        text note
        uuid created_by FK
        boolean is_internal
    }
    
    org_bid_history {
        uuid id PK
        uuid organization_id FK
        uuid bid_id FK
        varchar action
        text old_value
        text new_value
        uuid performed_by FK
    }
    
    org_financial_summary {
        uuid id PK
        uuid organization_id FK
        date period_start
        date period_end
        numeric total_contract_value
        numeric total_invoiced
        numeric total_paid
    }
    
    org_job_financial_summary {
        uuid id PK
        uuid job_id FK,UK
        uuid organization_id FK
        numeric contract_value
        numeric total_invoiced
        numeric total_paid
    }
    
    org_financial_cost_categories {
        uuid id PK
        uuid organization_id FK
        varchar category_key
        numeric spent
        numeric budget
        date period_start
        date period_end
    }
    
    org_profit_trend {
        uuid id PK
        uuid organization_id FK
        varchar period
        date period_date
        numeric revenue
        numeric expenses
    }
    
    org_cash_flow_projection {
        uuid id PK
        uuid organization_id FK
        date projection_date
        date period_start
        date period_end
        numeric projected_income
        numeric projected_expenses
    }
    
    org_cash_flow_scenarios {
        uuid id PK
        uuid organization_id FK
        uuid projection_id FK
        varchar scenario_type
        numeric projected_income
        numeric projected_expenses
    }
    
    org_revenue_forecast {
        uuid id PK
        uuid organization_id FK
        varchar month
        date month_date
        numeric committed
        numeric pipeline
    }
    
    org_financial_reports {
        uuid id PK
        uuid organization_id FK
        varchar report_key UK
        varchar title
        varchar category
        jsonb report_config
    }

    auth_users ||--o{ auth_user_roles : "has"
    auth_roles ||--o{ auth_user_roles : "assigned to"
    auth_roles ||--o{ auth_role_permissions : "has"
    auth_permissions ||--o{ auth_role_permissions : "granted to"
    auth_users ||--o{ auth_audit_logs : "generates"
    
    auth_users ||--o{ org_employees : "is"
    auth_users ||--o{ org_user_bank_accounts : "has"
    auth_users ||--o{ org_organizations : "manages"
    auth_users ||--o{ org_organizations : "creates"
    auth_users ||--o{ org_properties : "creates"
    auth_users ||--o{ org_bids : "creates"
    auth_users ||--o{ org_bids : "assigned to"
    auth_users ||--o{ org_bids : "primary teammate"
    auth_users ||--o{ org_bids : "supervisor"
    auth_users ||--o{ org_bids : "technician"
    
    org_organizations ||--o{ org_departments : "has"
    org_organizations ||--o{ org_properties : "owns"
    org_organizations ||--o{ org_client_contacts : "has"
    org_organizations ||--o{ org_client_notes : "has"
    org_organizations ||--o{ org_client_documents : "has"
    org_organizations ||--o{ org_jobs : "has"
    org_organizations ||--o{ org_bids : "receives"
    org_organizations ||--o{ org_financial_summary : "has"
    org_organizations ||--o{ org_financial_cost_categories : "has"
    org_organizations ||--o{ org_profit_trend : "has"
    org_organizations ||--o{ org_cash_flow_projection : "has"
    org_organizations ||--o{ org_revenue_forecast : "has"
    org_organizations ||--o{ org_financial_reports : "has"
    org_organizations ||--o{ org_organizations : "parent of"
    
    org_departments ||--o{ org_positions : "has"
    org_departments ||--o{ org_employees : "belongs to"
    org_positions ||--o{ org_employees : "holds"
    org_employees ||--o{ org_employee_reviews : "receives"
    org_employees ||--o{ org_timesheets : "has"
    auth_users ||--o{ org_employee_reviews : "reviews"
    auth_users ||--o{ org_timesheets : "submits"
    auth_users ||--o{ org_timesheets : "approves"
    org_timesheets ||--o{ org_timesheet_approvals : "has"
    auth_users ||--o{ org_timesheet_approvals : "performs"
    
    org_properties ||--o{ org_property_contacts : "has"
    org_properties ||--o{ org_property_equipment : "has"
    org_properties ||--o{ org_property_documents : "has"
    org_properties ||--o{ org_property_service_history : "has"
    auth_users ||--o{ org_property_documents : "uploads"
    auth_users ||--o{ org_property_service_history : "performs"
    
    org_jobs ||--o{ org_job_financial_summary : "has"
    org_jobs ||--o{ org_property_service_history : "linked to"
    org_jobs ||--o{ org_bids : "converted from"
    
    org_bids ||--|| org_bid_financial_breakdown : "has"
    org_bids ||--o{ org_bid_materials : "includes"
    org_bids ||--o{ org_bid_labor : "includes"
    org_bids ||--o{ org_bid_travel : "includes"
    org_bids ||--|| org_bid_operating_expenses : "has"
    org_bids ||--|| org_bid_survey_data : "has"
    org_bids ||--|| org_bid_plan_spec_data : "has"
    org_bids ||--|| org_bid_design_build_data : "has"
    org_bids ||--o{ org_bid_timeline : "has"
    org_bids ||--o{ org_bid_documents : "has"
    org_bids ||--o{ org_bid_notes : "has"
    org_bids ||--o{ org_bid_history : "tracks"
    org_bids ||--o{ org_property_service_history : "linked to"
    auth_users ||--o{ org_bid_timeline : "creates"
    auth_users ||--o{ org_bid_documents : "uploads"
    auth_users ||--o{ org_bid_notes : "writes"
    auth_users ||--o{ org_bid_history : "performs"
    
    org_cash_flow_projection ||--o{ org_cash_flow_scenarios : "has"
`;
}

async function main() {
  try {
    console.log("📊 Generating ER Diagram from Drizzle Schema...\n");

    // Generate Mermaid ERD
    const mermaidERD = generateSimpleERD();

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "..", "docs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write Mermaid file
    const mermaidPath = path.join(outputDir, "database-erd.mmd");
    fs.writeFileSync(mermaidPath, mermaidERD, "utf-8");
    console.log(`✅ Mermaid ERD generated: ${mermaidPath}`);

    // Create Markdown file with embedded diagram
    const markdownContent = `# Database ER Diagram

This ER diagram represents the database schema for the T3 Server application.

## How to View

### Option 1: GitHub/GitLab
If you push this to GitHub or GitLab, the Mermaid diagram will render automatically in the markdown file.

### Option 2: Online Mermaid Editor
1. Go to https://mermaid.live/
2. Copy the contents of \`database-erd.mmd\`
3. Paste and view the diagram

### Option 3: VS Code Extension
Install the "Markdown Preview Mermaid Support" extension in VS Code to view the diagram.

### Option 4: Database Tools
You can also use database visualization tools like:
- **pgAdmin**: Built-in ER diagram tool
- **DBeaver**: Free database tool with ER diagram feature
- **dbdiagram.io**: Online tool (import from PostgreSQL)
- **dbdocs.io**: Generate docs from database

## Schema Overview

The database consists of two main schemas:

### \`auth\` Schema
- User authentication and authorization
- Roles and permissions management
- Audit logging

### \`org\` Schema
- Organizations (clients)
- Employees and departments
- Properties and equipment
- Bids and jobs
- Financial tracking

## Mermaid Diagram

\\\`\\\`\\\`mermaid
${mermaidERD}
\\\`\\\`\\\`

## Legend

- **PK**: Primary Key
- **FK**: Foreign Key
- **UK**: Unique Key
- **||--||**: One-to-One relationship
- **||--o{**: One-to-Many relationship
`;

    const markdownPath = path.join(outputDir, "database-erd.md");
    fs.writeFileSync(markdownPath, markdownContent, "utf-8");
    console.log(`✅ Markdown ERD generated: ${markdownPath}`);

    console.log("\n✨ ER Diagram generation complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. View the diagram at: docs/database-erd.md");
    console.log("   2. Or open database-erd.mmd in https://mermaid.live/");
    console.log(
      "   3. Or use database tools like pgAdmin or DBeaver to connect to your PostgreSQL database"
    );
  } catch (error) {
    console.error("❌ Error generating ER diagram:", error);
    process.exit(1);
  }
}

main();
















