# Settings Module Implementation - FINAL

## ✅ **IMPLEMENTATION COMPLETE**

This implementation **exactly matches** the 5 frontend settings tabs.

---

## 📊 **FRONTEND TABS STRUCTURE**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  General  │  Labor Roles  │  Vehicle & Travel  │  Operating Expenses  │  Proposal    │
│           │               │                    │                      │  Templates   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ **DATABASE SCHEMA** (`src/drizzle/schema/settings.schema.ts`)

### **Tables Created (7 tables in `auth` schema)**

| #   | Table Name                   | Type      | Tab                | Purpose                               |
| --- | ---------------------------- | --------- | ------------------ | ------------------------------------- |
| 1   | `general_settings`           | Singleton | General            | Company info + announcements combined |
| 2   | `labor_rate_templates`       | Multi-row | Labor Roles        | One billing template per position     |
| 3   | `vehicle_travel_defaults`    | Singleton | Vehicle & Travel   | Default vehicle/travel rates          |
| 4   | `travel_origins`             | Multi-row | Vehicle & Travel   | Office/warehouse locations            |
| 5   | `operating_expense_defaults` | Singleton | Operating Expenses | Financial calculation params          |
| 6   | `proposal_basis_templates`   | Multi-row | Proposal Templates | Proposal basis templates              |
| 7   | `terms_conditions_templates` | Multi-row | Proposal Templates | Terms & conditions templates          |

---

## 📋 **DETAILED SCHEMA BREAKDOWN**

### **1. general_settings** (Singleton)

```typescript
{
  // Company Information (matches GeneralSettingsData interface)
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  taxId: string;
  licenseNumber: string;

  // Announcement Settings (embedded in same table)
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementDescription: string;

  // Audit
  updatedBy: uuid;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

### **2. labor_rate_templates** (One per position)

```typescript
{
  positionId: integer (FK to positions.id, unique)

  // Matches PositionRate interface
  defaultQuantity: integer (default: 1)
  defaultDays: integer (default: 3)
  defaultHoursPerDay: numeric (default: 8.00)
  defaultCostRate: numeric (default: 35.00)
  defaultBillableRate: numeric (default: 85.00)

  // Audit
  updatedBy: uuid
  createdAt: timestamp
  updatedAt: timestamp
}
```

### **3. vehicle_travel_defaults** (Singleton)

```typescript
{
  // Matches VehicleTravelDefaults interface
  defaultMileageRate: numeric (default: 0.67)
  defaultVehicleDayRate: numeric (default: 95.00)
  defaultMarkup: numeric (default: 20.00)
  enableFlatRate: boolean (default: false)
  flatRateAmount: numeric (default: 150.00)
  gasPricePerGallon: numeric (default: 3.50)

  // Audit
  updatedBy: uuid
  createdAt: timestamp
  updatedAt: timestamp
}
```

### **4. travel_origins** (Multiple)

```typescript
{
  // Matches TravelOriginAddress interface
  name: string
  addressLine1: string
  addressLine2: string?
  city: string
  state: string
  zipCode: string
  country: string (default: "USA")
  fullAddress: string (auto-generated)
  latitude: numeric?
  longitude: numeric?
  isDefault: boolean
  isActive: boolean
  notes: string?

  // Audit
  createdBy: uuid
  updatedBy: uuid
  isDeleted: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### **5. operating_expense_defaults** (Singleton)

```typescript
{
  // Matches OperatingExpensesDefaults interface
  grossRevenuePreviousYear: numeric (default: 5000000.00)
  operatingCostPreviousYear: numeric (default: 520000.00)
  inflationRate: numeric (default: 4.00)
  defaultMarkupPercentage: numeric (default: 20.00)
  enableByDefault: boolean (default: false)

  // Audit
  updatedBy: uuid
  createdAt: timestamp
  updatedAt: timestamp
}
```

### **6. proposal_basis_templates** (Multiple)

```typescript
{
  // Matches ProposalTemplate interface
  label: string
  template: string (supports [DATE] placeholder)
  sortOrder: integer
  isActive: boolean

  // Audit
  createdBy: uuid
  updatedBy: uuid
  isDeleted: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### **7. terms_conditions_templates** (Multiple)

```typescript
{
  // Matches TermsConditionsTemplate interface
  label: string;
  exclusions: text;
  warrantyDetails: text;
  specialTerms: text;
  sortOrder: integer;
  isActive: boolean;
  isDefault: boolean;

  // Audit
  createdBy: uuid;
  updatedBy: uuid;
  isDeleted: boolean;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

---

## 🔌 **API ENDPOINTS**

### **Base URL:** `/api/auth/settings`

#### **1. General Tab**

```
GET  /api/auth/settings/general          # Get all general settings (company + announcements)
PUT  /api/auth/settings/general          # Update general settings
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "companyName": "T3 Mechanical",
    "email": "info@t3mechanical.com",
    "phone": "+1 (555) 123-4567",
    "address": "123 Business Ave",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "taxId": "12-3456789",
    "licenseNumber": "CA-HVAC-123456",
    "announcementEnabled": true,
    "announcementTitle": "Announcement comes here !",
    "announcementDescription": "Lorem ipsum..."
  }
}
```

#### **2. Labor Roles Tab**

```
GET  /api/auth/settings/labor-rates              # Get all labor rates (with position names)
GET  /api/auth/settings/labor-rates/:positionId  # Get by position ID
PUT  /api/auth/settings/labor-rates/:positionId  # Upsert labor rate
POST /api/auth/settings/labor-rates/bulk-apply   # Apply defaults to all positions
```

**Response Example:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "positionId": 1,
      "position": "HVAC Technician",
      "defaultQuantity": 1,
      "defaultDays": 3,
      "defaultHoursPerDay": "8.00",
      "defaultCostRate": "35.00",
      "defaultBillableRate": "85.00"
    }
  ]
}
```

#### **3. Vehicle & Travel Tab**

```
GET    /api/auth/settings/vehicle-travel         # Get vehicle/travel defaults
PUT    /api/auth/settings/vehicle-travel         # Update defaults

GET    /api/auth/settings/travel-origins         # List all origins
GET    /api/auth/settings/travel-origins/:id     # Get specific origin
POST   /api/auth/settings/travel-origins         # Create origin
PUT    /api/auth/settings/travel-origins/:id     # Update origin
DELETE /api/auth/settings/travel-origins/:id     # Delete origin (soft)
PATCH  /api/auth/settings/travel-origins/:id/set-default  # Set as default
```

#### **4. Operating Expenses Tab**

```
GET  /api/auth/settings/operating-expenses       # Get operating expense defaults
PUT  /api/auth/settings/operating-expenses       # Update defaults
```

#### **5. Proposal Templates Tab**

```
# Proposal Basis sub-tab
GET    /api/auth/settings/proposal-basis-templates       # List all
GET    /api/auth/settings/proposal-basis-templates/:id   # Get one
POST   /api/auth/settings/proposal-basis-templates       # Create
PUT    /api/auth/settings/proposal-basis-templates/:id   # Update
DELETE /api/auth/settings/proposal-basis-templates/:id   # Delete (soft)

# Terms & Conditions sub-tab
GET    /api/auth/settings/terms-conditions-templates       # List all
GET    /api/auth/settings/terms-conditions-templates/:id   # Get one
POST   /api/auth/settings/terms-conditions-templates       # Create
PUT    /api/auth/settings/terms-conditions-templates/:id   # Update
DELETE /api/auth/settings/terms-conditions-templates/:id   # Delete (soft)
PATCH  /api/auth/settings/terms-conditions-templates/:id/set-default  # Set as default
```

---

## 📁 **FILES CREATED/UPDATED**

### **Created (5 files):**

1. ✅ `src/drizzle/schema/settings.schema.ts` - 7 tables
2. ✅ `src/routes/auth/settingsRoutes.ts` - All routes
3. ✅ `src/controllers/SettingsController.ts` - 21 controller methods
4. ✅ `src/services/settings.service.ts` - All business logic
5. ✅ `src/validations/settings.validations.ts` - All validations

### **Updated (2 files):**

1. ✅ `src/drizzle/index.ts` - Export settings schema
2. ✅ `src/routes/index.ts` - Mount settings routes

---

## 🎯 **KEY DESIGN DECISIONS**

### **1. General Settings - Combined Table**

- **Why:** Frontend uses single interface `GeneralSettingsData` combining company info + announcements
- **Benefit:** Single API call to get/update all general settings
- **Alternative considered:** Separate tables, but requires 2 API calls

### **2. Labor Rates - Position-based**

- **Why:** Frontend displays by position name (string)
- **Implementation:** Service joins with positions table to return position name
- **Field name:** Returns `position` (not `positionName`) to match frontend

### **3. Proposal Templates - Two Tables**

- **Why:** Frontend has two distinct sub-tabs with different data structures
- **Proposal Basis:** Simple label + template text with [DATE] placeholder
- **Terms & Conditions:** Complex with exclusions, warranty, special terms
- **Benefit:** Cleaner schema, easier to maintain

### **4. Singleton Pattern**

- **Tables:** general_settings, vehicle_travel_defaults, operating_expense_defaults
- **Behavior:** GET auto-creates with defaults if not exists, PUT always updates single row
- **Benefit:** Simple frontend integration, no null checks needed

---

## 🔄 **FRONTEND TO BACKEND MAPPING**

### **General Tab**

```typescript
// Frontend interface
interface GeneralSettingsData {
  companyName;
  email;
  phone;
  address;
  city;
  state;
  zipCode;
  taxId;
  licenseNumber;
  announcementEnabled;
  announcementTitle;
  announcementDescription;
}

// Backend table: general_settings (exact match)
// API: GET/PUT /api/auth/settings/general
```

### **Labor Roles Tab**

```typescript
// Frontend interface
interface PositionRate {
  position: string; // ← Position name as string
  defaultQuantity;
  defaultDays;
  defaultHoursPerDay;
  defaultCostRate;
  defaultBillableRate;
}

// Backend: labor_rate_templates (joins with positions table)
// API response returns "position" field with position name
```

### **Vehicle & Travel Tab**

```typescript
// Frontend interfaces match backend exactly
interface VehicleTravelDefaults { ... }
interface TravelOriginAddress { ... }

// Backend: vehicle_travel_defaults + travel_origins
```

### **Operating Expenses Tab**

```typescript
// Frontend interface matches backend exactly
interface OperatingExpensesDefaults {
  grossRevenuePreviousYear;
  operatingCostPreviousYear;
  inflationRate;
  defaultMarkupPercentage;
  enableByDefault;
}

// Backend: operating_expense_defaults
```

### **Proposal Templates Tab**

```typescript
// Frontend interfaces
interface ProposalTemplate {
  id;
  label;
  template;
}

interface TermsConditionsTemplate {
  id;
  label;
  exclusions;
  warrantyDetails;
  specialTerms;
}

// Backend: proposal_basis_templates + terms_conditions_templates
```

---

## 🚀 **NEXT STEPS**

### **Step 1: Generate Migration**

```bash
cd C:\Users\ASCE\Desktop\t3-server
npm run db:generate
```

**Migration Note:** When prompted about renames:

- ✅ **Create new:** `proposal_basis_templates`, `terms_conditions_templates`
- ❌ **Do NOT rename** from old tables (job_settings, invoice_settings, etc.)

### **Step 2: Run Migration**

```bash
npm run db:migrate
```

### **Step 3: Seed Initial Data (Optional)**

Create seed file for default templates:

```typescript
// proposal_basis_templates seed
[
  {
    label: "RFP and Plans",
    template: "This proposal was based on Client's RFP and plans dated [DATE]",
  },
  {
    label: "RFP and Job Walk",
    template:
      "This proposal was based on Client's RFP and job walk information from [DATE]",
  },
  {
    label: "Budgetary ROM",
    template:
      "This is a budgetary ROM based on the information received by client",
  },
  {
    label: "Service Call Information",
    template: "This proposal was based on information from last service call",
  },
][
  // terms_conditions_templates seed
  {
    label: "Standard T&C",
    exclusions: "EXCLUSIONS: Unless otherwise stated above...",
    warrantyDetails: "All materials provided in this job are warranted...",
    specialTerms: "All work to be performed during regular business hours...",
    isDefault: true,
  }
];
```

### **Step 4: Test APIs**

#### Test General Settings

```bash
# Get
curl -X GET http://localhost:3000/api/auth/settings/general \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update
curl -X PUT http://localhost:3000/api/auth/settings/general \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "T3 Mechanical",
    "email": "info@t3mechanical.com",
    "announcementEnabled": true,
    "announcementTitle": "New Announcement"
  }'
```

#### Test Labor Rates

```bash
# Get all (returns with position names)
curl -X GET http://localhost:3000/api/auth/settings/labor-rates \
  -H "Authorization: Bearer YOUR_TOKEN"

# Upsert by position ID
curl -X PUT http://localhost:3000/api/auth/settings/labor-rates/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaultCostRate": 35.00,
    "defaultBillableRate": 85.00
  }'
```

#### Test Proposal Basis Templates

```bash
# Get all
curl -X GET http://localhost:3000/api/auth/settings/proposal-basis-templates \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create
curl -X POST http://localhost:3000/api/auth/settings/proposal-basis-templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "RFP and Plans",
    "template": "This proposal was based on Client RFP and plans dated [DATE]"
  }'
```

### **Step 5: Update Frontend**

#### Update Travel Origin Service

```typescript
// lib/services/travel-origin-service.ts
// Change from: /api/settings/travel-origins
// To: /api/auth/settings/travel-origins

const url = `${API_BASE_URL}/api/auth/settings/travel-origins`;
```

#### Create New Frontend Services

Create these files in `lib/services/`:

**1. `general-settings.service.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function getGeneralSettings() {
  const res = await fetch(`${API_BASE}/api/auth/settings/general`);
  return res.json();
}

export async function updateGeneralSettings(data: GeneralSettingsData) {
  const res = await fetch(`${API_BASE}/api/auth/settings/general`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

**2. `labor-rate-settings.service.ts`**

```typescript
export async function getLaborRates() {
  const res = await fetch(`${API_BASE}/api/auth/settings/labor-rates`);
  return res.json();
}

export async function updateLaborRate(positionId: number, data: any) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/labor-rates/${positionId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return res.json();
}

export async function bulkApplyLaborRates(data: any) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/labor-rates/bulk-apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return res.json();
}
```

**3. `proposal-template-settings.service.ts`**

```typescript
// Proposal Basis Templates
export async function getProposalBasisTemplates() {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/proposal-basis-templates`,
  );
  return res.json();
}

export async function createProposalBasisTemplate(data: any) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/proposal-basis-templates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return res.json();
}

export async function updateProposalBasisTemplate(id: string, data: any) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/proposal-basis-templates/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return res.json();
}

export async function deleteProposalBasisTemplate(id: string) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/proposal-basis-templates/${id}`,
    {
      method: "DELETE",
    },
  );
  return res.json();
}

// Terms & Conditions Templates
export async function getTermsConditionsTemplates() {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/terms-conditions-templates`,
  );
  return res.json();
}

export async function createTermsConditionsTemplate(data: any) {
  const res = await fetch(
    `${API_BASE}/api/auth/settings/terms-conditions-templates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return res.json();
}

// ... similar for update, delete, set-default
```

---

## 🧪 **TESTING CHECKLIST**

### **Backend Testing**

- [ ] Generate migrations successfully
- [ ] Run migrations without errors
- [ ] Test GET /general (auto-creates if not exists)
- [ ] Test PUT /general (updates single row)
- [ ] Test GET /labor-rates (returns position names)
- [ ] Test PUT /labor-rates/:positionId (upsert)
- [ ] Test POST /labor-rates/bulk-apply
- [ ] Test GET/PUT /vehicle-travel
- [ ] Test full CRUD for /travel-origins
- [ ] Test PATCH /travel-origins/:id/set-default (unsets others)
- [ ] Test GET/PUT /operating-expenses
- [ ] Test full CRUD for /proposal-basis-templates
- [ ] Test full CRUD for /terms-conditions-templates
- [ ] Test PATCH /terms-conditions-templates/:id/set-default

### **Frontend Integration**

- [ ] Update travel-origin-service.ts URL
- [ ] Create general-settings.service.ts
- [ ] Create labor-rate-settings.service.ts
- [ ] Create proposal-template-settings.service.ts
- [ ] Update general-settings.tsx to call API
- [ ] Update labor-roles-settings.tsx to call API
- [ ] Update vehicle-travel-settings.tsx to call API
- [ ] Update operating-expenses-settings.tsx to call API
- [ ] Update proposal-templates-settings.tsx to call API
- [ ] Test end-to-end from UI

---

## 📝 **IMPORTANT NOTES**

### **General Settings - Single Table Design**

The `general_settings` table combines company info and announcements because:

- Frontend uses single interface `GeneralSettingsData`
- Single API call is more efficient
- Both are "general" system settings
- Easier to manage in UI (one save button)

### **Labor Rates - Position Join**

The service returns `position` field (not `positionName`) because:

- Frontend expects `position: string`
- Service joins with positions table: `position: positions.name`
- Matches frontend `PositionRate` interface exactly

### **Proposal Templates - Two Sub-Tabs**

Two separate tables because:

- Different data structures (simple vs. complex)
- Different use cases (proposal basis vs. legal terms)
- Frontend has two distinct sub-tabs with separate CRUD
- Cleaner schema design

### **Soft Deletes**

These tables use soft delete (`isDeleted` flag):

- `travel_origins`
- `proposal_basis_templates`
- `terms_conditions_templates`

Singleton tables don't need soft delete (never deleted).

---

## 🔐 **SECURITY**

All endpoints require:

- ✅ Authentication via `authenticate` middleware
- ✅ Validation via Zod schemas
- ✅ Audit tracking (`updatedBy` user ID)

**Future Enhancement:**
Add role-based permissions (admin-only for settings).

---

## ✅ **SUMMARY**

**Implementation Status:**

- ✅ Schema matches frontend interfaces exactly
- ✅ Routes organized by frontend tabs
- ✅ Services use singleton pattern with auto-initialization
- ✅ Validations ensure data integrity
- ✅ All endpoints documented

**Ready for:**

- Migration generation and execution
- API testing
- Frontend service integration
- End-to-end UI testing

**Next Action:**
Run `npm run db:generate` to create migrations!
