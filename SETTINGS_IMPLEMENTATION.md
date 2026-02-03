# Settings Module Implementation Summary

## ✅ **COMPLETED**

### **1. Schema Created** (`src/drizzle/schema/settings.schema.ts`)

All settings tables created in **`auth` schema** (not `org`):

#### **Singleton Tables** (one row per system)

- ✅ `company_settings` - Company information, hours, date/time formats
- ✅ `announcement_settings` - Dashboard announcements
- ✅ `vehicle_travel_defaults` - Default vehicle/travel rates
- ✅ `operating_expense_defaults` - Operating expense calculation params
- ✅ `job_settings` - Job management defaults
- ✅ `invoice_settings` - Invoice preferences and defaults
- ✅ `tax_settings` - Tax configuration
- ✅ `inventory_settings` - Inventory management preferences
- ✅ `notification_settings` - System-wide notification defaults

#### **Multi-Row Tables**

- ✅ `labor_rate_templates` - One row per position
- ✅ `travel_origins` - Multiple office/warehouse locations
- ✅ `user_notification_preferences` - Per-user notification overrides

### **2. Routes Created** (`src/routes/auth/settingsRoutes.ts`)

All routes under `/api/auth/settings/*`:

```
GET    /api/auth/settings/general                  # Company settings
PUT    /api/auth/settings/general

GET    /api/auth/settings/announcements            # Announcements
PUT    /api/auth/settings/announcements

GET    /api/auth/settings/labor-rates              # Labor rates (all)
GET    /api/auth/settings/labor-rates/:positionId  # Labor rate by position
PUT    /api/auth/settings/labor-rates/:positionId  # Upsert labor rate
POST   /api/auth/settings/labor-rates/bulk-apply   # Apply defaults to all

GET    /api/auth/settings/vehicle-travel           # Vehicle/travel defaults
PUT    /api/auth/settings/vehicle-travel

GET    /api/auth/settings/travel-origins           # Travel origins (list)
GET    /api/auth/settings/travel-origins/:id       # Get specific origin
POST   /api/auth/settings/travel-origins           # Create origin
PUT    /api/auth/settings/travel-origins/:id       # Update origin
DELETE /api/auth/settings/travel-origins/:id       # Delete origin
PATCH  /api/auth/settings/travel-origins/:id/set-default  # Set as default

GET    /api/auth/settings/financial                # Operating expense defaults
PUT    /api/auth/settings/financial

GET    /api/auth/settings/jobs                     # Job settings
PUT    /api/auth/settings/jobs

GET    /api/auth/settings/invoicing                # Invoice settings
PUT    /api/auth/settings/invoicing

GET    /api/auth/settings/tax                      # Tax settings
PUT    /api/auth/settings/tax

GET    /api/auth/settings/inventory                # Inventory settings
PUT    /api/auth/settings/inventory

GET    /api/auth/settings/notifications            # System notification settings
PUT    /api/auth/settings/notifications

GET    /api/auth/settings/notifications/preferences  # User notification preferences
PUT    /api/auth/settings/notifications/preferences

GET    /api/auth/settings/roles                    # Redirect to /api/auth/roles
GET    /api/auth/settings/logs                     # Logs view (TBD)
```

### **3. Controller Created** (`src/controllers/SettingsController.ts`)

All controller methods for:

- Company settings (get, update)
- Announcements (get, update)
- Labor rates (get, getByPosition, upsert, bulkApply)
- Vehicle/travel defaults (get, update)
- Travel origins (get, getById, create, update, delete, setDefault)
- Operating expenses (get, update)
- Job settings (get, update)
- Invoice settings (get, update)
- Tax settings (get, update)
- Inventory settings (get, update)
- Notification settings (get, update)
- User notification preferences (get, update)

### **4. Service Created** (`src/services/settings.service.ts`)

All business logic for:

- Singleton pattern (auto-create if not exists)
- CRUD operations for all settings
- Special logic for:
  - Travel origins (full address concatenation)
  - Labor rates (join with positions)
  - Bulk apply defaults

### **5. Validations Created** (`src/validations/settings.validations.ts`)

Zod schemas for all update operations:

- Type validation
- Min/max constraints
- Regex patterns (time format, etc.)
- Enum validation

### **6. Index Files Updated**

- ✅ `src/drizzle/index.ts` - Export settings schema
- ✅ `src/routes/index.ts` - Mount settings routes

---

## 🔄 **NEXT STEPS**

### **Step 1: Generate Migration**

```bash
cd C:\Users\ASCE\Desktop\t3-server
npm run db:generate
```

This will create migration files for all the new tables.

### **Step 2: Run Migration**

```bash
npm run db:migrate
```

This will create the tables in the database.

### **Step 3: Test the APIs**

Use Postman or similar to test endpoints:

#### Example: Get Company Settings

```http
GET /api/auth/settings/general
Authorization: Bearer <token>
```

#### Example: Update Company Settings

```http
PUT /api/auth/settings/general
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyName": "T3 Mechanical",
  "email": "info@t3mechanical.com",
  "phone": "(555) 123-4567",
  "workStartTime": "08:00",
  "workEndTime": "17:00"
}
```

#### Example: Create Travel Origin

```http
POST /api/auth/settings/travel-origins
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Main Office",
  "addressLine1": "123 Business Ave",
  "city": "San Francisco",
  "state": "CA",
  "zipCode": "94102",
  "isDefault": true
}
```

### **Step 4: Update Frontend**

Update frontend services to use the new backend APIs:

#### Update `travel-origin-service.ts`

Change base URL from `/api/settings/` to `/api/auth/settings/`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const url = `${API_BASE_URL}/api/auth/settings/travel-origins`;
```

#### Create new frontend services:

- `company-settings.service.ts`
- `announcement-settings.service.ts`
- `labor-rate-settings.service.ts`
- `vehicle-travel-settings.service.ts`
- `operating-expense-settings.service.ts`
- etc.

### **Step 5: Update Frontend Components**

Update settings components to call real APIs instead of mock data:

- `general-settings.tsx` → `/api/auth/settings/general`
- `labor-roles-settings.tsx` → `/api/auth/settings/labor-rates`
- `vehicle-travel-settings.tsx` → `/api/auth/settings/vehicle-travel` + `/travel-origins`
- `operating-expenses-settings.tsx` → `/api/auth/settings/financial`

---

## 📋 **DATABASE SCHEMA OVERVIEW**

### **Schema Organization**

- **Location**: `auth` schema (system-wide settings, not per-client)
- **Pattern**: Most tables are singletons (one row per system)
- **Audit**: All tables track `updatedBy` and `updatedAt`

### **Key Features**

1. **Auto-initialization**: If settings don't exist, they're created with defaults
2. **Soft deletes**: Travel origins use `isDeleted` flag
3. **Default tracking**: Travel origins track which is default
4. **Relationships**: Labor rates join with positions table
5. **User overrides**: User notification preferences override system defaults

---

## 🎯 **SETTINGS TABS MAPPING**

| Tab               | API Endpoint                       | Status         |
| ----------------- | ---------------------------------- | -------------- |
| **General**       | `/api/auth/settings/general`       | ✅ Implemented |
| **Roles**         | `/api/auth/roles` (existing)       | ✅ Existing    |
| **Jobs**          | `/api/auth/settings/jobs`          | ✅ Implemented |
| **Invoicing**     | `/api/auth/settings/invoicing`     | ✅ Implemented |
| **Financial**     | `/api/auth/settings/financial`     | ✅ Implemented |
| **Tax**           | `/api/auth/settings/tax`           | ✅ Implemented |
| **Inventory**     | `/api/auth/settings/inventory`     | ✅ Implemented |
| **Notifications** | `/api/auth/settings/notifications` | ✅ Implemented |
| **Logs**          | `/api/auth/settings/logs` (TBD)    | 🔜 Future      |

### **Additional Settings (From Frontend)**

| Setting            | API Endpoint                        | Status         |
| ------------------ | ----------------------------------- | -------------- |
| **Announcements**  | `/api/auth/settings/announcements`  | ✅ Implemented |
| **Labor Rates**    | `/api/auth/settings/labor-rates`    | ✅ Implemented |
| **Vehicle/Travel** | `/api/auth/settings/vehicle-travel` | ✅ Implemented |
| **Travel Origins** | `/api/auth/settings/travel-origins` | ✅ Implemented |

---

## 🔐 **SECURITY & PERMISSIONS**

All endpoints require authentication via `authenticate` middleware.

**Future Enhancement**: Add role-based permissions to restrict who can modify settings:

```typescript
// Example: Only admins can update settings
router.put(
  "/general",
  authenticate,
  requireRole("admin"),
  updateCompanySettings,
);
```

---

## 📝 **NOTES**

### **Singleton Pattern**

For singleton tables (company_settings, announcement_settings, etc.):

- **GET**: Returns existing row or creates with defaults if none exists
- **PUT**: Always updates the single existing row

### **Travel Origins**

- Multiple origins allowed (offices, warehouses)
- Only one can be marked as `isDefault`
- Setting a new default automatically unsets the previous default
- Uses soft delete (`isDeleted` flag)

### **Labor Rates**

- One template per position
- Joins with positions table to get position names
- Bulk apply feature to set same rates for all positions

### **Notifications**

- System-wide settings as defaults
- Per-user preferences override system defaults
- `null` values in user preferences = use system default
- Ready for future WebSocket implementation

---

## 🧪 **TESTING CHECKLIST**

- [ ] Generate and run migrations
- [ ] Test company settings GET/PUT
- [ ] Test announcements GET/PUT
- [ ] Test labor rates CRUD and bulk apply
- [ ] Test vehicle/travel defaults GET/PUT
- [ ] Test travel origins full CRUD
- [ ] Test operating expense defaults GET/PUT
- [ ] Test job settings GET/PUT
- [ ] Test invoice settings GET/PUT
- [ ] Test tax settings GET/PUT
- [ ] Test inventory settings GET/PUT
- [ ] Test notification settings GET/PUT
- [ ] Test user notification preferences GET/PUT
- [ ] Update frontend to use real APIs
- [ ] Test end-to-end from UI

---

## 📚 **DOCUMENTATION**

### **API Documentation**

Consider adding Swagger/OpenAPI documentation for all settings endpoints.

### **Frontend Integration Guide**

Document how frontend should integrate with each settings endpoint.

---

## 🚀 **FUTURE ENHANCEMENTS**

1. **Settings History/Audit Log**: Track all changes to settings with before/after values
2. **Settings Import/Export**: Backup and restore settings
3. **Settings Validation**: More complex validation rules
4. **Settings Templates**: Pre-configured settings for different business types
5. **Multi-tenant Support**: If needed in future, add organization_id to settings
6. **Settings UI Builder**: Dynamic forms based on schema
7. **Settings Search**: Search across all settings

---

## ✅ **SUMMARY**

**Created Files:**

1. `src/drizzle/schema/settings.schema.ts` - Complete schema (12 tables)
2. `src/routes/auth/settingsRoutes.ts` - All routes
3. `src/controllers/SettingsController.ts` - All controllers
4. `src/services/settings.service.ts` - All business logic
5. `src/validations/settings.validations.ts` - All validations

**Updated Files:**

1. `src/drizzle/index.ts` - Added settings export
2. `src/routes/index.ts` - Mounted settings routes

**Ready for:**

- Migration generation and execution
- API testing
- Frontend integration
