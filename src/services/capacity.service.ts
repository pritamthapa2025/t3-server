import {
  count,
  eq,
  desc,
  and,
  or,
  sql,
  gte,
  lte,
  sum,
  avg,
  ilike,
  isNull,
  ne,
  inArray,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  employeeShifts,
  employeeAvailability,
  resourceAllocations,
  departmentCapacityMetrics,
  teamUtilizationHistory,
  capacityPlanningTemplates,
} from "../drizzle/schema/capacity.schema.js";
import { employees, departments } from "../drizzle/schema/org.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";

// Dashboard KPIs - Status cards
export const getDashboardKPIs = async (organizationId: string, date?: string) => {
  const queryDate = date ? new Date(date) : new Date();
  
  // Get employee availability counts by status
  const statusCounts = await db
    .select({
      status: employeeAvailability.currentStatus,
      count: count(),
    })
    .from(employeeAvailability)
    .innerJoin(employees, eq(employeeAvailability.employeeId, employees.id))
    .where(
      and(
        eq(employees.isDeleted, false)
        // Note: Organization filtering temporarily removed until schema is clarified
      )
    )
    .groupBy(employeeAvailability.currentStatus);

  // Get total technicians count
  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .where(
      and(
        eq(employees.isDeleted, false)
        // Note: Organization filtering temporarily removed until schema is clarified
      )
    );

  const totalTechnicians = totalResult[0]?.count || 0;

  // Transform status counts into dashboard format
  const statusMap = statusCounts.reduce((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {} as Record<string, number>);

  return {
    inField: statusMap['on_job'] || 0,
    available: statusMap['available'] || 0,
    suspended: statusMap['suspended'] || 0,
    onBreak: statusMap['break'] || 0,
    onPTO: statusMap['pto'] || 0,
    sick: statusMap['sick'] || 0,
    offShift: statusMap['off_shift'] || 0,
    totalTechnicians,
    lastUpdated: new Date().toISOString(),
  };
};

// Overall utilization metrics and trend
export const getUtilizationMetrics = async (
  organizationId: string,
  filters: {
    startDate?: string | undefined;
    endDate?: string | undefined;
    departmentId?: number | undefined;
    periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  }
) => {
  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = filters.endDate || new Date().toISOString().split('T')[0];

  let whereConditions = [
    eq(departmentCapacityMetrics.periodType, filters.periodType),
  ];

  if (startDate) {
    whereConditions.push(gte(departmentCapacityMetrics.metricDate, startDate));
  }

  if (endDate) {
    whereConditions.push(lte(departmentCapacityMetrics.metricDate, endDate));
  }

  if (filters.departmentId) {
    whereConditions.push(eq(departmentCapacityMetrics.departmentId, filters.departmentId));
  }

  // Get current period utilization
  const currentMetrics = await db
    .select({
      avgUtilization: avg(departmentCapacityMetrics.utilizationPercentage),
      avgEfficiency: avg(departmentCapacityMetrics.efficiencyPercentage),
      totalPlannedHours: sum(departmentCapacityMetrics.totalPlannedHours),
      totalScheduledHours: sum(departmentCapacityMetrics.totalScheduledHours),
      totalActualHours: sum(departmentCapacityMetrics.totalActualHours),
      totalActiveJobs: sum(departmentCapacityMetrics.activeJobsCount),
      totalCompletedJobs: sum(departmentCapacityMetrics.completedJobsCount),
    })
    .from(departmentCapacityMetrics)
    .innerJoin(departments, eq(departmentCapacityMetrics.departmentId, departments.id))
    .where(and(...whereConditions));

  // Get previous period for trend calculation
  let previousMetrics: { avgUtilization: string | null }[] = [{ avgUtilization: null }];
  
  if (startDate && endDate) {
    const previousStartDate = new Date(new Date(startDate).getTime() - (new Date(endDate).getTime() - new Date(startDate).getTime()));
    const previousEndDate = new Date(startDate);

    previousMetrics = await db
      .select({
        avgUtilization: avg(departmentCapacityMetrics.utilizationPercentage),
      })
      .from(departmentCapacityMetrics)
      .innerJoin(departments, eq(departmentCapacityMetrics.departmentId, departments.id))
      .where(
        and(
          gte(departmentCapacityMetrics.metricDate, previousStartDate.toISOString().split('T')[0]!),
          lte(departmentCapacityMetrics.metricDate, previousEndDate.toISOString().split('T')[0]!),
          eq(departmentCapacityMetrics.periodType, filters.periodType)
        )
      );
  }

  const current = currentMetrics[0];
  const previous = previousMetrics[0];

  // Calculate trend percentage
  const currentUtil = parseFloat(current?.avgUtilization || '0');
  const previousUtil = parseFloat(previous?.avgUtilization || '0');
  const trendPercentage = previousUtil > 0 ? ((currentUtil - previousUtil) / previousUtil) * 100 : 0;

  return {
    teamUtilization: Math.round(currentUtil),
    trendPercentage: Math.round(trendPercentage * 100) / 100,
    efficiency: Math.round(parseFloat(current?.avgEfficiency || '0')),
    totalPlannedHours: parseFloat(current?.totalPlannedHours || '0'),
    totalScheduledHours: parseFloat(current?.totalScheduledHours || '0'),
    totalActualHours: parseFloat(current?.totalActualHours || '0'),
    totalActiveJobs: current?.totalActiveJobs || 0,
    totalCompletedJobs: current?.totalCompletedJobs || 0,
    period: {
      startDate,
      endDate,
      type: filters.periodType,
    },
  };
};

// Utilization chart data for historical trends
export const getUtilizationChartData = async (
  organizationId: string,
  filters: {
    startDate?: string | undefined;
    endDate?: string | undefined;
    periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    departmentId?: number | undefined;
  }
) => {
  const startDate = filters.startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = filters.endDate || new Date().toISOString().split('T')[0];

  let whereConditions = [
    eq(departmentCapacityMetrics.periodType, filters.periodType),
  ];

  if (startDate) {
    whereConditions.push(gte(departmentCapacityMetrics.metricDate, startDate));
  }

  if (endDate) {
    whereConditions.push(lte(departmentCapacityMetrics.metricDate, endDate));
  }

  if (filters.departmentId) {
    whereConditions.push(eq(departmentCapacityMetrics.departmentId, filters.departmentId));
  }

  const chartData = await db
    .select({
      period: departmentCapacityMetrics.metricDate,
      utilization: avg(departmentCapacityMetrics.utilizationPercentage),
      efficiency: avg(departmentCapacityMetrics.efficiencyPercentage),
      plannedHours: sum(departmentCapacityMetrics.totalPlannedHours),
      scheduledHours: sum(departmentCapacityMetrics.totalScheduledHours),
      actualHours: sum(departmentCapacityMetrics.totalActualHours),
    })
    .from(departmentCapacityMetrics)
    .innerJoin(departments, eq(departmentCapacityMetrics.departmentId, departments.id))
    .where(and(...whereConditions))
    .groupBy(departmentCapacityMetrics.metricDate)
    .orderBy(departmentCapacityMetrics.metricDate);

  return chartData.map(item => ({
    period: item.period,
    utilization: Math.round(parseFloat(item.utilization || '0')),
    efficiency: Math.round(parseFloat(item.efficiency || '0')),
    plannedHours: parseFloat(item.plannedHours || '0'),
    scheduledHours: parseFloat(item.scheduledHours || '0'),
    actualHours: parseFloat(item.actualHours || '0'),
  }));
};

// Coverage by Team - table data
export const getCoverageByTeam = async (organizationId: string, date?: string | undefined) => {
  const queryDate = date || new Date().toISOString().split('T')[0];

  // Get team coverage data
  const teamCoverage = await db
    .select({
      departmentId: departments.id,
      teamName: departments.name,
      managerId: departments.leadId,
      managerName: users.fullName,
      totalTechnicians: count(employees.id),
      coverageAreas: departmentCapacityMetrics.coverageAreas,
    })
    .from(departments)
    .leftJoin(users, eq(departments.leadId, users.id))
    .leftJoin(employees, and(
      eq(employees.departmentId, departments.id),
      eq(employees.isDeleted, false)
    ))
    .leftJoin(departmentCapacityMetrics, and(
      eq(departmentCapacityMetrics.departmentId, departments.id),
      queryDate ? eq(departmentCapacityMetrics.metricDate, queryDate) : sql`true`
    ))
    .where(
      and(
        eq(departments.isDeleted, false)
        // Note: Organization filtering temporarily removed until schema is clarified
      )
    )
    .groupBy(
      departments.id,
      departments.name,
      departments.leadId,
      users.fullName,
      departmentCapacityMetrics.coverageAreas
    );

  // Get jobs in progress for each department
  const jobsInProgress = await db
    .select({
      departmentId: employees.departmentId,
      jobsCount: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(resourceAllocations, eq(resourceAllocations.jobId, jobs.id))
    .innerJoin(employees, eq(resourceAllocations.employeeId, employees.id))
    .where(
      and(
        inArray(jobs.status, ['in_progress', 'assigned']),
        eq(jobs.isDeleted, false),
        inArray(resourceAllocations.status, ['assigned', 'in_progress'])
      )
    )
    .groupBy(employees.departmentId);

  // Combine data
  const jobsMap = jobsInProgress.reduce((acc, item) => {
    if (item.departmentId) {
      acc[item.departmentId] = item.jobsCount;
    }
    return acc;
  }, {} as Record<number, number>);

  return teamCoverage.map(team => ({
    departmentId: team.departmentId,
    team: team.teamName,
    manager: team.managerName || 'Unassigned',
    technicians: team.totalTechnicians,
    jobsInProgress: jobsMap[team.departmentId] || 0,
    coverage: Array.isArray(team.coverageAreas) ? team.coverageAreas.join(' • ') : 'Not specified',
  }));
};

// Employee availability with filtering
export const getEmployeeAvailability = async (
  offset: number,
  limit: number,
  filters: {
    organizationId: string;
    status?: string | undefined;
    departmentId?: number | undefined;
  }
) => {
  let whereConditions = [
    eq(employees.isDeleted, false),
  ];

  if (filters.status) {
    whereConditions.push(eq(employeeAvailability.currentStatus, filters.status as any));
  }

  if (filters.departmentId) {
    whereConditions.push(eq(employees.departmentId, filters.departmentId));
  }

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(employeeAvailability)
    .innerJoin(employees, eq(employeeAvailability.employeeId, employees.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.total || 0;

  // Get paginated data
  const employeesList = await db
    .select({
      employeeId: employees.id,
      employeeName: users.fullName,
      departmentName: departments.name,
      currentStatus: employeeAvailability.currentStatus,
      location: employeeAvailability.location,
      statusStartTime: employeeAvailability.statusStartTime,
      expectedAvailableTime: employeeAvailability.expectedAvailableTime,
      currentJobId: employeeAvailability.currentJobId,
      currentTaskDescription: employeeAvailability.currentTaskDescription,
      lastUpdated: employeeAvailability.lastUpdated,
    })
    .from(employeeAvailability)
    .innerJoin(employees, eq(employeeAvailability.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...whereConditions))
    .limit(limit)
    .offset((offset - 1) * limit)
    .orderBy(desc(employeeAvailability.lastUpdated));

  return { employees: employeesList, total };
};

// Update employee availability
export const updateEmployeeAvailability = async (
  employeeId: number,
  updateData: any
) => {
  const [updatedAvailability] = await db
    .update(employeeAvailability)
    .set({
      ...updateData,
      lastUpdated: new Date(),
    })
    .where(eq(employeeAvailability.employeeId, employeeId))
    .returning();

  return updatedAvailability;
};

// Resource allocations with filtering
export const getResourceAllocations = async (
  offset: number,
  limit: number,
  filters: {
    organizationId: string;
    startDate?: string | undefined;
    endDate?: string | undefined;
    employeeId?: number | undefined;
    jobId?: string | undefined;
    status?: string | undefined;
    priority?: number | undefined;
  }
) => {
  let whereConditions = [
    // Note: Organization filtering temporarily removed until schema is clarified
  ];

  if (filters.startDate) {
    whereConditions.push(gte(resourceAllocations.plannedStartTime, new Date(filters.startDate)));
  }

  if (filters.endDate) {
    whereConditions.push(lte(resourceAllocations.plannedEndTime, new Date(filters.endDate)));
  }

  if (filters.employeeId) {
    whereConditions.push(eq(resourceAllocations.employeeId, filters.employeeId));
  }

  if (filters.jobId) {
    whereConditions.push(eq(resourceAllocations.jobId, filters.jobId));
  }

  if (filters.status) {
    whereConditions.push(eq(resourceAllocations.status, filters.status as any));
  }

  if (filters.priority) {
    whereConditions.push(eq(resourceAllocations.priority, filters.priority));
  }

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(resourceAllocations)
    .innerJoin(employees, eq(resourceAllocations.employeeId, employees.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  const total = totalResult[0]?.total || 0;

  // Get paginated data
  const allocationsList = await db
    .select({
      id: resourceAllocations.id,
      employeeId: resourceAllocations.employeeId,
      employeeName: users.fullName,
      jobId: resourceAllocations.jobId,
      jobName: jobs.name,
      taskId: resourceAllocations.taskId,
      plannedStartTime: resourceAllocations.plannedStartTime,
      plannedEndTime: resourceAllocations.plannedEndTime,
      plannedHours: resourceAllocations.plannedHours,
      actualStartTime: resourceAllocations.actualStartTime,
      actualEndTime: resourceAllocations.actualEndTime,
      actualHours: resourceAllocations.actualHours,
      status: resourceAllocations.status,
      priority: resourceAllocations.priority,
      notes: resourceAllocations.notes,
      createdAt: resourceAllocations.createdAt,
      updatedAt: resourceAllocations.updatedAt,
    })
    .from(resourceAllocations)
    .innerJoin(employees, eq(resourceAllocations.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(jobs, eq(resourceAllocations.jobId, jobs.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .limit(limit)
    .offset((offset - 1) * limit)
    .orderBy(desc(resourceAllocations.createdAt));

  return { allocations: allocationsList, total };
};

// Create resource allocation
export const createResourceAllocation = async (data: any) => {
  const [newAllocation] = await db
    .insert(resourceAllocations)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newAllocation;
};

// Update resource allocation
export const updateResourceAllocation = async (id: string, updateData: any) => {
  const [updatedAllocation] = await db
    .update(resourceAllocations)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(resourceAllocations.id, id))
    .returning();

  return updatedAllocation;
};

// Employee shifts with filtering
export const getEmployeeShifts = async (
  offset: number,
  limit: number,
  filters: {
    organizationId: string;
    startDate?: string | undefined;
    endDate?: string | undefined;
    employeeId?: number | undefined;
    departmentId?: number | undefined;
    isActive?: boolean | undefined;
  }
) => {
  let whereConditions = [
    // Note: Organization filtering temporarily removed until schema is clarified
  ];

  if (filters.startDate) {
    whereConditions.push(gte(employeeShifts.shiftDate, filters.startDate));
  }

  if (filters.endDate) {
    whereConditions.push(lte(employeeShifts.shiftDate, filters.endDate));
  }

  if (filters.employeeId) {
    whereConditions.push(eq(employeeShifts.employeeId, filters.employeeId));
  }

  if (filters.departmentId) {
    whereConditions.push(eq(employees.departmentId, filters.departmentId));
  }

  if (filters.isActive !== undefined) {
    whereConditions.push(eq(employeeShifts.isActive, filters.isActive));
  }

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(employeeShifts)
    .innerJoin(employees, eq(employeeShifts.employeeId, employees.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  const total = totalResult[0]?.total || 0;

  // Get paginated data
  const shiftsList = await db
    .select({
      id: employeeShifts.id,
      employeeId: employeeShifts.employeeId,
      employeeName: users.fullName,
      shiftDate: employeeShifts.shiftDate,
      shiftStart: employeeShifts.shiftStart,
      shiftEnd: employeeShifts.shiftEnd,
      shiftType: employeeShifts.shiftType,
      plannedHours: employeeShifts.plannedHours,
      availableHours: employeeShifts.availableHours,
      breakMinutes: employeeShifts.breakMinutes,
      isActive: employeeShifts.isActive,
      notes: employeeShifts.notes,
      createdAt: employeeShifts.createdAt,
      updatedAt: employeeShifts.updatedAt,
    })
    .from(employeeShifts)
    .innerJoin(employees, eq(employeeShifts.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .limit(limit)
    .offset((offset - 1) * limit)
    .orderBy(desc(employeeShifts.shiftDate));

  return { shifts: shiftsList, total };
};

// Create employee shift
export const createEmployeeShift = async (data: any) => {
  const [newShift] = await db
    .insert(employeeShifts)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newShift;
};

// Update employee shift
export const updateEmployeeShift = async (id: number, updateData: any) => {
  const [updatedShift] = await db
    .update(employeeShifts)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(employeeShifts.id, id))
    .returning();

  return updatedShift;
};

// Delete employee shift
export const deleteEmployeeShift = async (id: number) => {
  await db
    .delete(employeeShifts)
    .where(eq(employeeShifts.id, id));
};

// Department capacity overview
export const getDepartmentCapacityOverview = async (
  organizationId: string,
  filters: {
    startDate?: string | undefined;
    endDate?: string | undefined;
    periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  }
) => {
  const startDate = filters.startDate || new Date().toISOString().split('T')[0];
  const endDate = filters.endDate || new Date().toISOString().split('T')[0];

  let whereConditions = [
    eq(departmentCapacityMetrics.periodType, filters.periodType)
    // Note: Organization filtering temporarily removed until schema is clarified
  ];

  if (startDate) {
    whereConditions.push(gte(departmentCapacityMetrics.metricDate, startDate));
  }

  if (endDate) {
    whereConditions.push(lte(departmentCapacityMetrics.metricDate, endDate));
  }

  const overview = await db
    .select({
      departmentId: departments.id,
      departmentName: departments.name,
      totalEmployees: departmentCapacityMetrics.totalEmployees,
      availableEmployees: departmentCapacityMetrics.availableEmployees,
      utilizationPercentage: departmentCapacityMetrics.utilizationPercentage,
      efficiencyPercentage: departmentCapacityMetrics.efficiencyPercentage,
      activeJobsCount: departmentCapacityMetrics.activeJobsCount,
      completedJobsCount: departmentCapacityMetrics.completedJobsCount,
      coverageAreas: departmentCapacityMetrics.coverageAreas,
      metricDate: departmentCapacityMetrics.metricDate,
    })
    .from(departmentCapacityMetrics)
    .innerJoin(departments, eq(departmentCapacityMetrics.departmentId, departments.id))
    .where(and(...whereConditions))
    .orderBy(desc(departmentCapacityMetrics.metricDate));

  return overview;
};

// Capacity planning templates
export const getCapacityPlanningTemplates = async (
  offset: number,
  limit: number,
  filters: {
    organizationId: string;
    departmentId?: number | undefined;
    isActive?: boolean | undefined;
  }
) => {
  let whereConditions = [
    // Note: Organization filtering temporarily removed until schema is clarified
  ];

  if (filters.departmentId) {
    whereConditions.push(eq(capacityPlanningTemplates.departmentId, filters.departmentId));
  }

  if (filters.isActive !== undefined) {
    whereConditions.push(eq(capacityPlanningTemplates.isActive, filters.isActive));
  }

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(capacityPlanningTemplates)
    .leftJoin(departments, eq(capacityPlanningTemplates.departmentId, departments.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  const total = totalResult[0]?.total || 0;

  // Get paginated data
  const templatesList = await db
    .select({
      id: capacityPlanningTemplates.id,
      name: capacityPlanningTemplates.name,
      description: capacityPlanningTemplates.description,
      departmentId: capacityPlanningTemplates.departmentId,
      departmentName: departments.name,
      dayOfWeek: capacityPlanningTemplates.dayOfWeek,
      shiftStart: capacityPlanningTemplates.shiftStart,
      shiftEnd: capacityPlanningTemplates.shiftEnd,
      plannedHours: capacityPlanningTemplates.plannedHours,
      minEmployees: capacityPlanningTemplates.minEmployees,
      maxEmployees: capacityPlanningTemplates.maxEmployees,
      requiredSkills: capacityPlanningTemplates.requiredSkills,
      isActive: capacityPlanningTemplates.isActive,
      effectiveFrom: capacityPlanningTemplates.effectiveFrom,
      effectiveTo: capacityPlanningTemplates.effectiveTo,
      createdAt: capacityPlanningTemplates.createdAt,
      updatedAt: capacityPlanningTemplates.updatedAt,
    })
    .from(capacityPlanningTemplates)
    .leftJoin(departments, eq(capacityPlanningTemplates.departmentId, departments.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .limit(limit)
    .offset((offset - 1) * limit)
    .orderBy(desc(capacityPlanningTemplates.createdAt));

  return { templates: templatesList, total };
};

// Create capacity planning template
export const createCapacityPlanningTemplate = async (data: any) => {
  const [newTemplate] = await db
    .insert(capacityPlanningTemplates)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newTemplate;
};

// Team Assignments - Get all teams with managers and their direct reports
// T3 employees can see all teams (no organization filtering needed)
export const getTeamAssignments = async () => {
  // Get all departments with their team leads (managers)
  const departmentsWithLeads = await db
    .select({
      // Department info
      departmentId: departments.id,
      departmentName: departments.name,
      location: departments.primaryLocation,
      
      // Team lead info
      teamLeadId: departments.leadId,
      teamLeadName: users.fullName,
      teamLeadEmail: users.email,
      teamLeadPhone: users.phone,
    })
    .from(departments)
    .leftJoin(users, eq(departments.leadId, users.id))
    .where(
      and(
        eq(departments.isDeleted, false),
        eq(departments.isActive, true)
      )
    )
    .orderBy(departments.sortOrder, departments.name);

  // Get roles for all team leads in one query
  const teamLeadIds = departmentsWithLeads
    .map(d => d.teamLeadId)
    .filter((id): id is string => id !== null);

  const teamLeadRoles = teamLeadIds.length > 0
    ? await db
        .select({
          userId: userRoles.userId,
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            inArray(userRoles.userId, teamLeadIds),
            eq(roles.isDeleted, false)
          )
        )
    : [];

  // Create role lookup map
  const roleMap = teamLeadRoles.reduce((acc, item) => {
    acc[item.userId] = item.roleName;
    return acc;
  }, {} as Record<string, string>);

  // Get employees who report to each team lead
  const reportingEmployees = teamLeadIds.length > 0
    ? await db
        .select({
          reportsTo: employees.reportsTo,
          employeeName: users.fullName,
          employeeId: employees.employeeId,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .where(
          and(
            inArray(employees.reportsTo, teamLeadIds),
            eq(employees.isDeleted, false)
          )
        )
        .orderBy(users.fullName)
    : [];

  // Create employees lookup map grouped by reportsTo
  const employeesMap = reportingEmployees.reduce((acc, emp) => {
    if (emp.reportsTo) {
      const reportsToId = emp.reportsTo;
      if (!acc[reportsToId]) {
        acc[reportsToId] = [];
      }
      acc[reportsToId].push({
        name: emp.employeeName || 'Unknown',
        employeeId: emp.employeeId || '',
      });
    }
    return acc;
  }, {} as Record<string, Array<{ name: string; employeeId: string }>>);

  // Combine all data into simplified structure
  return departmentsWithLeads.map(dept => ({
    departmentName: dept.departmentName,
    location: dept.location || 'Not specified',
    teamLead: dept.teamLeadId ? {
      role: roleMap[dept.teamLeadId] || 'No role assigned',
      name: dept.teamLeadName || 'Unassigned',
      email: dept.teamLeadEmail || '',
      phone: dept.teamLeadPhone || '',
    } : null,
    employees: dept.teamLeadId ? (employeesMap[dept.teamLeadId] || []) : [],
  }));
};