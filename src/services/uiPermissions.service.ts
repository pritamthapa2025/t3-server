import { getUserModulePermissions } from "./featurePermission.service.js";

/**
 * UI Permissions Service
 * Handles UI element visibility and field access control for frontend
 */

export interface UIConfig {
  visibleElements: string[];
  enabledElements: string[];
  hiddenFields: string[];
  readonlyFields: string[];
  visibleSections: string[];
  availableActions: string[];
}

export interface ModuleUIConfig {
  module: string;
  userRole: string;
  features: Array<{
    featureCode: string;
    accessLevel: string;
    available: boolean;
  }>;
  uiElements: Array<{
    elementCode: string;
    elementType: string;
    isVisible: boolean;
    isEnabled: boolean;
  }>;
  fieldPermissions: Record<
    string,
    {
      accessLevel: string; // "hidden", "readonly", "editable"
      visible: boolean;
      editable: boolean;
    }
  >;
  dataFilters: {
    assignedOnly: boolean;
    departmentOnly: boolean;
    ownOnly: boolean;
    hideFinancial: boolean;
  };
  availableActions: string[];
}

/**
 * Get complete UI configuration for a user in a specific module
 */
export const getModuleUIConfig = async (
  userId: string,
  module: string,
): Promise<ModuleUIConfig> => {
  const permissions = await getUserModulePermissions(userId, module);

  // Process features to determine available actions
  const availableActions: string[] = [];
  const processedFeatures = permissions.features.map((f) => {
    const available = f.accessLevel !== "none";
    if (available) {
      availableActions.push(f.featureCode);
    }
    return {
      featureCode: f.featureCode,
      accessLevel: f.accessLevel,
      available,
    };
  });

  // Process UI elements
  const processedUIElements = permissions.uiElements.map((ui) => ({
    elementCode: ui.elementCode,
    elementType: ui.elementType as string,
    isVisible: ui.isVisible ?? true,
    isEnabled: ui.isEnabled ?? true,
  }));

  // Process field permissions
  const processedFieldPermissions: Record<
    string,
    {
      accessLevel: string;
      visible: boolean;
      editable: boolean;
    }
  > = {};

  for (const [fieldName, perm] of Object.entries(
    permissions.fieldPermissions,
  )) {
    processedFieldPermissions[fieldName] = {
      accessLevel: perm.accessLevel,
      visible: perm.accessLevel !== "hidden",
      editable: perm.accessLevel === "editable",
    };
  }

  // Process data filters
  const dataFilters = {
    assignedOnly: permissions.dataFilters.some(
      (f) => f.filterType === "assigned_only",
    ),
    departmentOnly: permissions.dataFilters.some(
      (f) => f.filterType === "department_only",
    ),
    ownOnly: permissions.dataFilters.some((f) => f.filterType === "own_only"),
    hideFinancial: permissions.dataFilters.some(
      (f) => f.filterType === "hide_financial",
    ),
  };

  return {
    module,
    userRole: permissions.userRole?.roleName || "unknown",
    features: processedFeatures,
    uiElements: processedUIElements,
    fieldPermissions: processedFieldPermissions,
    dataFilters,
    availableActions,
  };
};

/**
 * Get simplified UI config for quick frontend checks
 */
export const getSimpleUIConfig = async (
  userId: string,
  module: string,
): Promise<UIConfig> => {
  const fullConfig = await getModuleUIConfig(userId, module);

  return {
    visibleElements: fullConfig.uiElements
      .filter((ui) => ui.isVisible)
      .map((ui) => ui.elementCode),

    enabledElements: fullConfig.uiElements
      .filter((ui) => ui.isVisible && ui.isEnabled)
      .map((ui) => ui.elementCode),

    hiddenFields: Object.entries(fullConfig.fieldPermissions)
      .filter(([_, perm]) => !perm.visible)
      .map(([fieldName]) => fieldName),

    readonlyFields: Object.entries(fullConfig.fieldPermissions)
      .filter(([_, perm]) => perm.visible && !perm.editable)
      .map(([fieldName]) => fieldName),

    visibleSections: fullConfig.uiElements
      .filter((ui) => ui.elementType === "section" && ui.isVisible)
      .map((ui) => ui.elementCode),

    availableActions: fullConfig.availableActions,
  };
};

/**
 * Check if a specific UI element should be visible
 */
export const isUIElementVisible = async (
  userId: string,
  module: string,
  elementCode: string,
): Promise<boolean> => {
  const config = await getSimpleUIConfig(userId, module);
  return config.visibleElements.includes(elementCode);
};

/**
 * Check if a specific field should be hidden
 */
export const isFieldHidden = async (
  userId: string,
  module: string,
  fieldName: string,
): Promise<boolean> => {
  const config = await getSimpleUIConfig(userId, module);
  return config.hiddenFields.includes(fieldName);
};

/**
 * Get dashboard configuration based on role
 * This implements the specific dashboard layouts from the CSV
 */
export const getDashboardConfig = async (userId: string) => {
  const config = await getModuleUIConfig(userId, "dashboard");

  // Role-specific dashboard layouts from CSV
  const dashboardLayouts = {
    Technician: {
      cards: ["my_tasks_card", "my_jobs_card"],
      sections: ["my_dispatch", "my_timesheet"],
      hiddenSections: [
        "team_performance",
        "financial_summary",
        "revenue_chart",
        "profit_loss",
      ],
    },
    Manager: {
      cards: [
        "my_tasks_card",
        "my_jobs_card",
        "team_performance_card",
        "job_pipeline_card",
        "invoice_queue_card",
      ],
      sections: ["team_performance", "job_pipeline", "invoice_queue"],
      hiddenSections: ["financial_summary", "profit_loss", "cash_flow"],
    },
    Executive: {
      cards: [
        "my_tasks_card",
        "my_jobs_card",
        "team_performance_card",
        "financial_summary_card",
        "revenue_chart",
        "profit_loss_chart",
      ],
      sections: [
        "financial_summary",
        "profit_loss",
        "cash_flow",
        "team_performance",
        "job_pipeline",
      ],
      hiddenSections: [],
    },
  };

  const userRole = config.userRole as keyof typeof dashboardLayouts;
  const layout = dashboardLayouts[userRole] || dashboardLayouts["Technician"];

  return {
    ...config,
    layout,
    visibleCards: layout.cards,
    visibleSections: layout.sections,
    hiddenSections: layout.hiddenSections,
  };
};

/**
 * Get navigation menu configuration based on user permissions
 */
export const getNavigationConfig = async (userId: string) => {
  // Get all modules the user has access to
  const modulePermissions: Record<string, ModuleUIConfig> = {};

  const modules = [
    "dashboard",
    "bids",
    "jobs",
    "clients",
    "properties",
    "fleet",
    "team",
    "timesheet",
    "tasks",
    "dispatch",
    "inventory",
    "expenses",
    "invoicing",
    "documents",
    "performance",
    "files",
    "financial",
    "payroll",
    "reports",
    "settings",
  ];

  for (const module of modules) {
    try {
      const config = await getModuleUIConfig(userId, module);
      // Only include module if user has at least one non-"none" feature (availableActions)
      if (config.availableActions.length > 0) {
        modulePermissions[module] = config;
      }
    } catch {
      // Module not accessible, skip
      continue;
    }
  }

  // Build navigation structure
  const navigation = {
    main: [] as Array<{
      module: string;
      label: string;
      icon: string;
      route: string;
      features: string[];
      badge?: string;
    }>,
    financial: [] as Array<{
      module: string;
      label: string;
      icon: string;
      route: string;
      features: string[];
    }>,
    settings: [] as Array<{
      module: string;
      label: string;
      icon: string;
      route: string;
      features: string[];
    }>,
  };

  // Module metadata (optional route overrides default /:module)
  const moduleMetadata: Record<
    string,
    { label: string; icon: string; category: string; route?: string }
  > = {
    dashboard: { label: "Dashboard", icon: "dashboard", category: "main" },
    jobs: { label: "Jobs", icon: "briefcase", category: "main" },
    bids: { label: "Bids", icon: "file-contract", category: "main" },
    clients: { label: "Clients", icon: "users", category: "main" },
    properties: { label: "Properties", icon: "building", category: "main" },
    fleet: { label: "Fleet", icon: "truck", category: "main" },
    team: { label: "Team", icon: "user-friends", category: "main" },
    timesheet: { label: "Timesheet", icon: "clock", category: "main" },
    tasks: { label: "Tasks", icon: "tasks", category: "main" },
    dispatch: { label: "Dispatch", icon: "route", category: "main" },
    inventory: { label: "Inventory", icon: "boxes", category: "main" },
    expenses: { label: "Expenses", icon: "receipt", category: "main" },
    invoicing: {
      label: "Invoicing",
      icon: "file-invoice",
      category: "financial",
    },
    documents: { label: "Documents", icon: "folder", category: "main" },
    files: { label: "Files", icon: "folder-open", category: "main" },
    performance: { label: "Performance", icon: "chart-line", category: "main" },
    financial: {
      label: "Financial",
      icon: "dollar-sign",
      category: "financial",
    },
    payroll: {
      label: "Payroll",
      icon: "money-bill",
      category: "financial",
      route: "/team/payroll",
    },
    reports: { label: "Reports", icon: "chart-bar", category: "settings" },
    settings: { label: "Settings", icon: "cog", category: "settings" },
  };

  // Populate navigation based on accessible modules
  for (const [module, config] of Object.entries(modulePermissions)) {
    const metadata = moduleMetadata[module as keyof typeof moduleMetadata];
    if (!metadata) continue;

    const navItem = {
      module,
      label: metadata.label,
      icon: metadata.icon,
      route: metadata.route ?? `/${module}`,
      features: config.availableActions,
    };

    switch (metadata.category) {
      case "main":
        navigation.main.push(navItem);
        break;
      case "financial":
        navigation.financial.push(navItem);
        break;
      case "settings":
        navigation.settings.push(navItem);
        break;
    }
  }

  return {
    navigation,
    userRole: Object.values(modulePermissions)[0]?.userRole || "unknown",
    accessibleModules: Object.keys(modulePermissions),
  };
};

/**
 * Get button permissions for a specific module
 */
export const getButtonPermissions = async (userId: string, module: string) => {
  const config = await getModuleUIConfig(userId, module);

  const buttons = config.uiElements
    .filter((ui) => ui.elementType === "button")
    .reduce(
      (acc, ui) => {
        acc[ui.elementCode] = {
          visible: ui.isVisible,
          enabled: ui.isEnabled,
        };
        return acc;
      },
      {} as Record<string, { visible: boolean; enabled: boolean }>,
    );

  return buttons;
};

/**
 * Filter data object based on field permissions
 * Removes hidden fields and marks readonly fields
 */
export const filterDataByFieldPermissions = async (
  userId: string,
  module: string,
  data: any,
): Promise<{
  filteredData: any;
  readonlyFields: string[];
  hiddenFields: string[];
}> => {
  const config = await getModuleUIConfig(userId, module);

  const filteredData = { ...data };
  const readonlyFields: string[] = [];
  const hiddenFields: string[] = [];

  for (const [fieldName, perm] of Object.entries(config.fieldPermissions)) {
    if (!perm.visible) {
      delete filteredData[fieldName];
      hiddenFields.push(fieldName);
    } else if (!perm.editable) {
      readonlyFields.push(fieldName);
    }
  }

  return {
    filteredData,
    readonlyFields,
    hiddenFields,
  };
};

/**
 * Get complete user interface configuration
 * This is the main function frontends should call
 */
export const getUserInterfaceConfig = async (userId: string) => {
  const [dashboardConfig, navigationConfig] = await Promise.all([
    getDashboardConfig(userId),
    getNavigationConfig(userId),
  ]);

  return {
    user: {
      role: navigationConfig.userRole,
      accessibleModules: navigationConfig.accessibleModules,
    },
    dashboard: dashboardConfig,
    navigation: navigationConfig.navigation,
    timestamp: new Date().toISOString(),
  };
};
