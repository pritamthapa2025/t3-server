# Settings Module: Frontend ↔ Backend Mapping

## 📊 **COMPLETE TAB-BY-TAB BREAKDOWN**

---

## 1️⃣ **GENERAL TAB**

### **Frontend Component:** `components/dashboard/settings/general-settings.tsx`

#### **Frontend Interface:**

```typescript
interface GeneralSettingsData {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  taxId: string;
  licenseNumber: string;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementDescription: string;
}
```

#### **Backend Table:** `auth.general_settings`

```sql
CREATE TABLE auth.general_settings (
  id UUID PRIMARY KEY,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  tax_id VARCHAR(50),
  license_number VARCHAR(100),
  announcement_enabled BOOLEAN DEFAULT false,
  announcement_title VARCHAR(255),
  announcement_description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**

- `GET /api/auth/settings/general` - Returns all fields
- `PUT /api/auth/settings/general` - Updates all fields

#### **Frontend → Backend Mapping:**

| Frontend Field            | Backend Column             | Type    | Notes                 |
| ------------------------- | -------------------------- | ------- | --------------------- |
| `companyName`             | `company_name`             | string  | Snake case conversion |
| `email`                   | `email`                    | string  | Same                  |
| `phone`                   | `phone`                    | string  | Same                  |
| `address`                 | `address`                  | string  | Same                  |
| `city`                    | `city`                     | string  | Same                  |
| `state`                   | `state`                    | string  | Same                  |
| `zipCode`                 | `zip_code`                 | string  | Snake case conversion |
| `taxId`                   | `tax_id`                   | string  | Snake case conversion |
| `licenseNumber`           | `license_number`           | string  | Snake case conversion |
| `announcementEnabled`     | `announcement_enabled`     | boolean | Snake case conversion |
| `announcementTitle`       | `announcement_title`       | string  | Snake case conversion |
| `announcementDescription` | `announcement_description` | string  | Snake case conversion |

---

## 2️⃣ **LABOR ROLES TAB**

### **Frontend Component:** `components/dashboard/settings/labor-roles-settings.tsx`

#### **Frontend Interface:**

```typescript
interface PositionRate {
  position: string; // ← Position name as STRING (not ID)
  defaultQuantity: number;
  defaultDays: number;
  defaultHoursPerDay: number;
  defaultCostRate: number;
  defaultBillableRate: number;
}
```

#### **Backend Table:** `auth.labor_rate_templates`

```sql
CREATE TABLE auth.labor_rate_templates (
  id UUID PRIMARY KEY,
  position_id INTEGER REFERENCES org.positions(id) UNIQUE,
  default_quantity INTEGER DEFAULT 1,
  default_days INTEGER DEFAULT 3,
  default_hours_per_day NUMERIC(5,2) DEFAULT 8.00,
  default_cost_rate NUMERIC(10,2) DEFAULT 35.00,
  default_billable_rate NUMERIC(10,2) DEFAULT 85.00,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**

- `GET /api/auth/settings/labor-rates` - Returns array with position names
- `GET /api/auth/settings/labor-rates/:positionId` - Get by position ID
- `PUT /api/auth/settings/labor-rates/:positionId` - Upsert rate for position
- `POST /api/auth/settings/labor-rates/bulk-apply` - Apply defaults to all

#### **Backend Service Logic:**

```typescript
// Service joins with positions table to return position names
const rates = await db
  .select({
    id: laborRateTemplates.id,
    positionId: laborRateTemplates.positionId,
    position: positions.name, // ← Returns position NAME, not ID
    defaultQuantity: laborRateTemplates.defaultQuantity,
    defaultDays: laborRateTemplates.defaultDays,
    defaultHoursPerDay: laborRateTemplates.defaultHoursPerDay,
    defaultCostRate: laborRateTemplates.defaultCostRate,
    defaultBillableRate: laborRateTemplates.defaultBillableRate,
  })
  .from(laborRateTemplates)
  .leftJoin(positions, eq(laborRateTemplates.positionId, positions.id));
```

#### **Frontend Usage:**

```typescript
// Frontend gets positions from team members (mock data)
// Backend should return same structure with position names

// Example API response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "positionId": 1,
      "position": "HVAC Technician",  // ← String, not ID
      "defaultCostRate": "35.00",
      "defaultBillableRate": "85.00",
      "defaultDays": 3,
      "defaultHoursPerDay": "8.00"
    }
  ]
}
```

---

## 3️⃣ **VEHICLE & TRAVEL TAB**

### **Frontend Component:** `components/dashboard/settings/vehicle-travel-settings.tsx`

#### **Frontend Interfaces:**

```typescript
interface VehicleTravelDefaults {
  mileageRate: number;
  vehicleDayRate: number;
  defaultMarkup: number;
  enableFlatRate: boolean;
  flatRateAmount: number;
  gasPricePerGallon: number;
}

interface TravelOriginAddress {
  id: string;
  name: string;
  address: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
}
```

#### **Backend Tables:**

**1. `auth.vehicle_travel_defaults`** (Singleton)

```sql
CREATE TABLE auth.vehicle_travel_defaults (
  id UUID PRIMARY KEY,
  default_mileage_rate NUMERIC(10,4) DEFAULT 0.6700,
  default_vehicle_day_rate NUMERIC(10,2) DEFAULT 95.00,
  default_markup NUMERIC(5,2) DEFAULT 20.00,
  enable_flat_rate BOOLEAN DEFAULT false,
  flat_rate_amount NUMERIC(10,2) DEFAULT 150.00,
  gas_price_per_gallon NUMERIC(10,4) DEFAULT 3.5000,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. `auth.travel_origins`** (Multiple)

```sql
CREATE TABLE auth.travel_origins (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'USA',
  full_address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**

```
# Vehicle/Travel Defaults
GET  /api/auth/settings/vehicle-travel
PUT  /api/auth/settings/vehicle-travel

# Travel Origins
GET    /api/auth/settings/travel-origins
POST   /api/auth/settings/travel-origins
PUT    /api/auth/settings/travel-origins/:id
DELETE /api/auth/settings/travel-origins/:id
PATCH  /api/auth/settings/travel-origins/:id/set-default
```

#### **Frontend Service Update:**

```typescript
// lib/services/travel-origin-service.ts
// OLD: const url = `${API_BASE_URL}/api/settings/travel-origins`;
// NEW:
const url = `${API_BASE_URL}/api/auth/settings/travel-origins`;
```

---

## 4️⃣ **OPERATING EXPENSES TAB**

### **Frontend Component:** `components/dashboard/settings/operating-expenses-settings.tsx`

#### **Frontend Interface:**

```typescript
interface OperatingExpensesDefaults {
  grossRevenuePreviousYear: number;
  operatingCostPreviousYear: number;
  inflationRate: number;
  defaultMarkupPercentage: number;
  enableByDefault: boolean;
}
```

#### **Backend Table:** `auth.operating_expense_defaults` (Singleton)

```sql
CREATE TABLE auth.operating_expense_defaults (
  id UUID PRIMARY KEY,
  gross_revenue_previous_year NUMERIC(15,2) DEFAULT 5000000.00,
  operating_cost_previous_year NUMERIC(15,2) DEFAULT 520000.00,
  inflation_rate NUMERIC(5,2) DEFAULT 4.00,
  default_markup_percentage NUMERIC(5,2) DEFAULT 20.00,
  enable_by_default BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**

- `GET /api/auth/settings/operating-expenses`
- `PUT /api/auth/settings/operating-expenses`

#### **Perfect Match:** ✅ Interface fields match table columns exactly (with snake_case conversion)

---

## 5️⃣ **PROPOSAL TEMPLATES TAB**

### **Frontend Component:** `components/dashboard/settings/proposal-templates-settings.tsx`

#### **Frontend Interfaces:**

```typescript
interface ProposalTemplate {
  id: string;
  label: string;
  template: string;
}

interface TermsConditionsTemplate {
  id: string;
  label: string;
  exclusions: string;
  warrantyDetails: string;
  specialTerms: string;
}
```

#### **Backend Tables:**

**1. `auth.proposal_basis_templates`** (Multiple)

```sql
CREATE TABLE auth.proposal_basis_templates (
  id UUID PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  template TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. `auth.terms_conditions_templates`** (Multiple)

```sql
CREATE TABLE auth.terms_conditions_templates (
  id UUID PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  exclusions TEXT,
  warranty_details TEXT,
  special_terms TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **API Endpoints:**

```
# Proposal Basis Templates
GET    /api/auth/settings/proposal-basis-templates
GET    /api/auth/settings/proposal-basis-templates/:id
POST   /api/auth/settings/proposal-basis-templates
PUT    /api/auth/settings/proposal-basis-templates/:id
DELETE /api/auth/settings/proposal-basis-templates/:id

# Terms & Conditions Templates
GET    /api/auth/settings/terms-conditions-templates
GET    /api/auth/settings/terms-conditions-templates/:id
POST   /api/auth/settings/terms-conditions-templates
PUT    /api/auth/settings/terms-conditions-templates/:id
DELETE /api/auth/settings/terms-conditions-templates/:id
PATCH  /api/auth/settings/terms-conditions-templates/:id/set-default
```

#### **Frontend → Backend Mapping:**

**Proposal Basis:**
| Frontend | Backend | Notes |
|----------|---------|-------|
| `id` | `id` | UUID |
| `label` | `label` | Template name |
| `template` | `template` | Text with [DATE] placeholder |

**Terms & Conditions:**
| Frontend | Backend | Notes |
|----------|---------|-------|
| `id` | `id` | UUID |
| `label` | `label` | Template name |
| `exclusions` | `exclusions` | Snake case conversion |
| `warrantyDetails` | `warranty_details` | Snake case conversion |
| `specialTerms` | `special_terms` | Snake case conversion |

---

## 🔄 **FIELD NAME CONVENTIONS**

### **Snake Case ↔ Camel Case Conversion**

The backend uses `snake_case` for column names, frontend uses `camelCase`.

**Automatic conversion should happen in:**

1. API responses (backend → frontend)
2. API requests (frontend → backend)

**Examples:**

```typescript
// Backend column         → Frontend field
company_name             → companyName
announcement_enabled     → announcementEnabled
default_cost_rate        → defaultCostRate
gross_revenue_previous_year → grossRevenuePreviousYear
warranty_details         → warrantyDetails
```

**Implementation:**

- Backend service can use a transformer
- Or frontend handles conversion manually
- Or use a library like `humps` for automatic conversion

---

## 📡 **API RESPONSE FORMATS**

### **Singleton Tables** (general, vehicle_travel, operating_expense)

```json
{
  "success": true,
  "message": "Settings retrieved",
  "data": {
    "id": "uuid",
    "companyName": "T3 Mechanical",
    "email": "info@t3mechanical.com",
    ...
  }
}
```

### **Multi-Row Tables** (labor_rates, travel_origins, templates)

```json
{
  "success": true,
  "message": "Data retrieved",
  "data": [
    { "id": "uuid", "label": "...", ... },
    { "id": "uuid", "label": "...", ... }
  ],
  "total": 10,
  "page": 1,
  "limit": 100
}
```

---

## 🎯 **SPECIAL FEATURES**

### **1. Auto-Initialization (Singleton Tables)**

```typescript
// If settings don't exist, service auto-creates with defaults
export const getGeneralSettings = async () => {
  const [settings] = await db.select().from(generalSettings).limit(1);

  if (!settings) {
    // Auto-create with defaults
    const [newSettings] = await db
      .insert(generalSettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};
```

**Benefit:** Frontend never gets null/undefined, always gets settings object.

### **2. Labor Rates - Position Name Join**

```typescript
// Service joins with positions table to return position name
const rates = await db
  .select({
    position: positions.name,  // ← Returns "HVAC Technician", not position ID
    ...
  })
  .from(laborRateTemplates)
  .leftJoin(positions, eq(laborRateTemplates.positionId, positions.id));
```

**Why:** Frontend displays position name, not ID.

### **3. Travel Origins - Full Address Auto-Generation**

```typescript
// Service auto-generates full address on create/update
const fullAddress = [
  data.addressLine1,
  data.addressLine2,
  `${data.city}, ${data.state} ${data.zipCode}`,
  data.country || "USA",
]
  .filter(Boolean)
  .join(", ");
```

**Benefit:** Frontend can display `fullAddress` directly without concatenating.

### **4. Set Default - Auto-Unset Previous**

```typescript
// Setting new default automatically unsets previous
await db
  .update(travelOrigins)
  .set({ isDefault: false })
  .where(eq(travelOrigins.isDefault, true));

await db
  .update(travelOrigins)
  .set({ isDefault: true })
  .where(eq(travelOrigins.id, id));
```

**Applies to:**

- Travel origins
- Terms & conditions templates

---

## 🧩 **FRONTEND INTEGRATION STEPS**

### **Step 1: Create Service Files**

Create in `lib/services/`:

```typescript
// general-settings.service.ts
export async function getGeneralSettings() { ... }
export async function updateGeneralSettings(data: GeneralSettingsData) { ... }

// labor-rate-settings.service.ts
export async function getLaborRates() { ... }
export async function updateLaborRate(positionId: number, data: any) { ... }
export async function bulkApplyLaborRates(defaults: any) { ... }

// vehicle-travel-settings.service.ts
export async function getVehicleTravelDefaults() { ... }
export async function updateVehicleTravelDefaults(data: any) { ... }

// operating-expense-settings.service.ts
export async function getOperatingExpenseDefaults() { ... }
export async function updateOperatingExpenseDefaults(data: OperatingExpensesDefaults) { ... }

// proposal-template-settings.service.ts
export async function getProposalBasisTemplates() { ... }
export async function createProposalBasisTemplate(data: ProposalTemplate) { ... }
export async function getTermsConditionsTemplates() { ... }
export async function createTermsConditionsTemplate(data: TermsConditionsTemplate) { ... }
```

### **Step 2: Update Components**

#### **general-settings.tsx**

```typescript
// Replace handleSave with:
const handleSave = async () => {
  try {
    await updateGeneralSettings(settings);
    toast.success("Settings saved successfully");
    setHasChanges(false);
  } catch (error) {
    toast.error("Failed to save settings");
  }
};

// Add useEffect to load settings:
useEffect(() => {
  const loadSettings = async () => {
    const data = await getGeneralSettings();
    setSettings(data);
  };
  loadSettings();
}, []);
```

#### **labor-roles-settings.tsx**

```typescript
// Add useEffect to load labor rates:
useEffect(() => {
  const loadLaborRates = async () => {
    const rates = await getLaborRates();
    // Convert array to Record<string, PositionRate>
    const ratesRecord = rates.reduce((acc, rate) => {
      acc[rate.position] = rate;
      return acc;
    }, {});
    setPositionRates(ratesRecord);
  };
  loadLaborRates();
}, []);

// Update handleApplyDefaultsToAll:
const handleApplyDefaultsToAll = async () => {
  try {
    await bulkApplyLaborRates(DEFAULT_RATE_VALUES);
    await loadLaborRates(); // Reload
    toast.success("Default rates applied to all positions");
  } catch (error) {
    toast.error("Failed to apply defaults");
  }
};
```

#### **proposal-templates-settings.tsx**

```typescript
// Add useEffect to load templates:
useEffect(() => {
  const loadTemplates = async () => {
    const [proposalData, termsData] = await Promise.all([
      getProposalBasisTemplates(),
      getTermsConditionsTemplates(),
    ]);
    setProposalTemplates(proposalData);
    setTermsTemplates(termsData);
  };
  loadTemplates();
}, []);

// Update handleSaveProposal:
const handleSaveProposal = async () => {
  try {
    if (editingProposalTemplate) {
      await updateProposalBasisTemplate(
        editingProposalTemplate.id,
        proposalFormData,
      );
      toast.success("Template updated");
    } else {
      await createProposalBasisTemplate(proposalFormData);
      toast.success("Template created");
    }
    await loadTemplates(); // Reload
    handleCloseProposalModal();
  } catch (error) {
    toast.error("Failed to save template");
  }
};
```

### **Step 3: Update Environment Variables**

Ensure `.env` has:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### **Step 4: Add Authentication**

All requests need auth token:

```typescript
const token = localStorage.getItem("authToken"); // or from context

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

---

## 🔍 **VERIFICATION CHECKLIST**

### **Schema Verification**

- [ ] All 7 tables use `auth` schema (not `org`)
- [ ] Singleton tables have no unique constraints beyond primary key
- [ ] Multi-row tables have proper indexes
- [ ] Foreign keys reference correct tables
- [ ] Default values match frontend defaults

### **API Verification**

- [ ] All routes under `/api/auth/settings/*`
- [ ] All routes require authentication
- [ ] Validation schemas match frontend interfaces
- [ ] Response format consistent across all endpoints

### **Service Verification**

- [ ] Singleton pattern works (auto-create if not exists)
- [ ] Labor rates join returns position names
- [ ] Travel origins auto-generate full address
- [ ] Set default unsets previous defaults
- [ ] Soft deletes work correctly

---

## ✅ **FINAL CHECKLIST**

### **Backend Setup**

- [x] Schema created (`settings.schema.ts`)
- [x] Routes created (`auth/settingsRoutes.ts`)
- [x] Controller created (`SettingsController.ts`)
- [x] Service created (`settings.service.ts`)
- [x] Validations created (`settings.validations.ts`)
- [x] Index files updated
- [ ] Generate migrations
- [ ] Run migrations
- [ ] Test all endpoints

### **Frontend Integration**

- [ ] Create general-settings.service.ts
- [ ] Create labor-rate-settings.service.ts
- [ ] Create vehicle-travel-settings.service.ts
- [ ] Create operating-expense-settings.service.ts
- [ ] Create proposal-template-settings.service.ts
- [ ] Update travel-origin-service.ts URLs
- [ ] Update all settings components to use APIs
- [ ] Add authentication to all requests
- [ ] Test UI end-to-end

---

## 🎯 **SUCCESS CRITERIA**

When complete:

1. ✅ All 5 tabs load data from backend
2. ✅ All 5 tabs save data to backend
3. ✅ Labor rates show position names correctly
4. ✅ Travel origins CRUD works with set-default
5. ✅ Proposal templates CRUD works for both sub-tabs
6. ✅ No console errors
7. ✅ Toast notifications show success/error
8. ✅ Data persists across page refreshes

---

## 📞 **SUPPORT**

If issues arise:

1. Check browser console for errors
2. Check network tab for API responses
3. Check backend logs for service errors
4. Verify authentication token is valid
5. Verify field name conversions (camelCase ↔ snake_case)

---

**Implementation is complete and ready for migration!** 🚀
