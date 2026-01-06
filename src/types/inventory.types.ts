// Inventory TypeScript Type Definitions

export interface InventoryItem {
  id: string;
  organizationId: string;
  itemCode: string;
  name: string;
  description?: string | null;
  categoryId: number;
  primarySupplierId?: string | null;
  unitOfMeasureId: number;
  unitCost: string;
  lastPurchasePrice?: string | null;
  averageCost?: string | null;
  sellingPrice?: string | null;
  quantityOnHand: string;
  quantityAllocated: string;
  quantityAvailable: string;
  quantityOnOrder: string;
  reorderLevel: string;
  reorderQuantity?: string | null;
  maxStockLevel?: string | null;
  primaryLocationId?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  partNumber?: string | null;
  barcode?: string | null;
  weight?: string | null;
  weightUnit?: string | null;
  dimensions?: string | null;
  specifications?: any;
  tags?: any;
  images?: any;
  trackBySerialNumber: boolean;
  trackByBatch: boolean;
  status: "in_stock" | "low_stock" | "out_of_stock" | "on_order" | "discontinued";
  isActive: boolean;
  lastRestockedDate?: Date | null;
  lastCountedDate?: Date | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItemWithDetails extends InventoryItem {
  category?: { id: number; name: string; code: string } | null;
  supplier?: { id: string; name: string } | null;
  location?: { id: string; name: string; locationCode: string } | null;
  unit?: { id: number; name: string; abbreviation: string } | null;
}

export interface InventoryCategory {
  id: number;
  name: string;
  description?: string | null;
  code?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventorySupplier {
  id: string;
  organizationId: string;
  supplierCode?: string | null;
  name: string;
  legalName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country: string;
  taxId?: string | null;
  accountNumber?: string | null;
  paymentTerms?: string | null;
  creditLimit?: string | null;
  rating?: string | null;
  leadTimeDays?: number | null;
  isActive: boolean;
  isPreferred: boolean;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLocation {
  id: string;
  organizationId: string;
  locationCode?: string | null;
  name: string;
  locationType?: string | null;
  parentLocationId?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  capacity?: string | null;
  capacityUnit?: string | null;
  managerId?: string | null;
  accessInstructions?: string | null;
  isActive: boolean;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryUnitOfMeasure {
  id: number;
  name: string;
  abbreviation: string;
  unitType?: string | null;
  isActive: boolean;
  sortOrder?: number | null;
  createdAt: Date;
}

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  transactionNumber: string;
  itemId: string;
  locationId?: string | null;
  transactionType:
    | "receipt"
    | "issue"
    | "adjustment"
    | "transfer"
    | "return"
    | "write_off"
    | "initial_stock";
  transactionDate: Date;
  quantity: string;
  unitCost?: string | null;
  totalCost?: string | null;
  balanceAfter?: string | null;
  purchaseOrderId?: string | null;
  jobId?: string | null;
  bidId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expirationDate?: Date | null;
  referenceNumber?: string | null;
  notes?: string | null;
  performedBy: string;
  createdAt: Date;
}

export interface InventoryTransactionWithDetails extends InventoryTransaction {
  item?: { id: string; name: string; itemCode: string } | null;
  location?: { id: string; name: string } | null;
  performedByUser?: { id: string; fullName: string } | null;
  job?: { id: string; name: string; jobNumber: string } | null;
  bid?: { id: string; title: string; bidNumber: string } | null;
}

export interface InventoryAllocation {
  id: string;
  organizationId: string;
  itemId: string;
  jobId?: string | null;
  bidId?: string | null;
  quantityAllocated: string;
  quantityUsed: string;
  quantityReturned: string;
  allocationDate: Date;
  expectedUseDate?: Date | null;
  actualUseDate?: Date | null;
  status: "allocated" | "issued" | "partially_used" | "fully_used" | "returned" | "cancelled";
  allocatedBy: string;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAllocationWithDetails extends InventoryAllocation {
  item?: { id: string; name: string; itemCode: string; unitCost: string } | null;
  job?: { id: string; name: string; jobNumber: string } | null;
  bid?: { id: string; title: string; bidNumber: string } | null;
  allocatedByUser?: { id: string; fullName: string } | null;
}

export interface InventoryPurchaseOrder {
  id: string;
  organizationId: string;
  poNumber: string;
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate?: Date | null;
  actualDeliveryDate?: Date | null;
  status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "sent"
    | "partially_received"
    | "received"
    | "cancelled"
    | "closed";
  subtotal: string;
  taxAmount: string;
  shippingCost: string;
  totalAmount: string;
  shipToLocationId?: string | null;
  shippingAddress?: string | null;
  trackingNumber?: string | null;
  paymentTerms?: string | null;
  paymentStatus?: string | null;
  amountPaid: string;
  supplierInvoiceNumber?: string | null;
  notes?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryPurchaseOrderWithDetails extends InventoryPurchaseOrder {
  supplier?: { id: string; name: string; phone?: string } | null;
  location?: { id: string; name: string } | null;
  createdByUser?: { id: string; fullName: string } | null;
  approvedByUser?: { id: string; fullName: string } | null;
  items?: InventoryPurchaseOrderItem[];
}

export interface InventoryPurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  itemId: string;
  organizationId: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
  lineTotal: string;
  expectedDeliveryDate?: Date | null;
  actualDeliveryDate?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryPurchaseOrderItemWithDetails extends InventoryPurchaseOrderItem {
  item?: { id: string; name: string; itemCode: string } | null;
}

export interface InventoryStockAlert {
  id: string;
  organizationId: string;
  itemId: string;
  alertType: "low_stock" | "out_of_stock" | "overstock" | "expiring";
  severity: "info" | "warning" | "critical";
  message: string;
  currentQuantity?: string | null;
  thresholdQuantity?: string | null;
  isAcknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
  createdAt: Date;
}

export interface InventoryStockAlertWithDetails extends InventoryStockAlert {
  item?: { id: string; name: string; itemCode: string } | null;
  acknowledgedByUser?: { id: string; fullName: string } | null;
  resolvedByUser?: { id: string; fullName: string } | null;
}

export interface InventoryCount {
  id: string;
  organizationId: string;
  countNumber: string;
  countType: "full" | "cycle" | "spot";
  locationId?: string | null;
  countDate: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  performedBy?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryCountItem {
  id: string;
  countId: string;
  itemId: string;
  organizationId: string;
  systemQuantity: string;
  countedQuantity?: string | null;
  variance?: string | null;
  variancePercentage?: string | null;
  unitCost?: string | null;
  varianceCost?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard summary types
export interface InventoryDashboardSummary {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  categoriesCount: number;
  suppliersCount: number;
  locationsCount: number;
  pendingPOs: number;
  activeAllocations: number;
  unresolvedAlerts: number;
}

export interface InventoryCategoryStats {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface InventoryLocationStats {
  locationId: string;
  locationName: string;
  itemCount: number;
  totalValue: number;
}

export interface InventoryStatusStats {
  status: string;
  count: number;
  value: number;
}

// Filter types
export interface InventoryItemFilters {
  category?: string;
  status?: string;
  supplier?: string;
  location?: string;
  allocationStatus?: string;
  search?: string;
}

export interface InventoryTransactionFilters {
  itemId?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  jobId?: string;
  bidId?: string;
}

export interface InventoryAllocationFilters {
  itemId?: string;
  jobId?: string;
  bidId?: string;
  status?: string;
}







