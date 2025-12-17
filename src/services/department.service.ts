import {
  count,
  eq,
  and,
  or,
  ilike,
  sql,
  gte,
  lte,
  avg,
  min,
  max,
  inArray,
  isNull,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  departments,
  employees,
  positions,
} from "../drizzle/schema/org.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

export const getDepartments = async (
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions: any[] = [];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(departments.name, `%${search}%`),
        ilike(departments.description, `%${search}%`)
      )!
    );
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Add soft delete filter
  whereConditions.push(eq(departments.isDeleted, false));
  const finalWhereClause = and(...whereConditions);

  // Get all departments (excluding soft deleted)
  const departmentsList = await db
    .select()
    .from(departments)
    .where(finalWhereClause)
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: count() })
    .from(departments)
    .where(finalWhereClause);

  // Get current month date range for utilisation calculation
  const currentDate = new Date();
  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // Process each department to get comprehensive metrics
  const departmentsWithMetrics = await Promise.all(
    departmentsList.map(async (dept) => {
      // Get all employees in this department
      const deptEmployees = await db
        .select({
          employee: {
            id: employees.id,
            status: employees.status,
            performance: employees.performance,
            positionId: employees.positionId,
            hourlyRate: employees.hourlyRate,
            salary: employees.salary,
          },
          user: {
            id: users.id,
            fullName: users.fullName,
            isActive: users.isActive,
          },
          position: {
            id: positions.id,
            name: positions.name,
          },
        })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(positions, eq(employees.positionId, positions.id))
        .where(
          and(
            eq(employees.departmentId, dept.id),
            eq(employees.isDeleted, false)
          )
        );

      // Get all positions in this department (for open roles calculation)
      // Handle null isDeleted values (for rows created before migration)
      const deptPositions = await db
        .select({
          id: positions.id,
          name: positions.name,
          description: positions.description,
        })
        .from(positions)
        .where(
          and(
            eq(positions.departmentId, dept.id),
            or(isNull(positions.isDeleted), eq(positions.isDeleted, false))
          )
        );

      // Calculate metrics
      const totalPeople = deptEmployees.length;
      const activeEmployees = deptEmployees.filter(
        (e) => e.user?.isActive === true
      );
      const inFieldCount = deptEmployees.filter(
        (e) => e.employee.status === "in_field"
      ).length;
      const availableCount = deptEmployees.filter(
        (e) => e.employee.status === "available"
      ).length;

      // Role breakdown
      const roleCounts: Record<string, number> = {};
      deptEmployees.forEach((e) => {
        const positionName = e.position?.name?.toLowerCase() || "";
        let role = "Office Staff";

        if (
          positionName.includes("director") ||
          positionName.includes("admin")
        ) {
          role = "Administrator";
        } else if (
          positionName.includes("manager") ||
          positionName.includes("supervisor")
        ) {
          role = "Manager";
        } else if (
          positionName.includes("technician") ||
          positionName.includes("engineer")
        ) {
          role = "Technician";
        }

        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });

      // Average performance
      const performanceScores = deptEmployees
        .map((e) => e.employee.performance)
        .filter((p): p is number => p !== null && p !== undefined && p > 0);
      const avgPerformance =
        performanceScores.length > 0
          ? performanceScores.reduce((sum, p) => sum + p, 0) /
            performanceScores.length
          : 0;

      // Get department lead/manager (first manager or first employee)
      const departmentLead =
        deptEmployees.find(
          (e) =>
            e.position?.name?.toLowerCase().includes("manager") ||
            e.position?.name?.toLowerCase().includes("director") ||
            e.position?.name?.toLowerCase().includes("lead")
        ) || deptEmployees[0];

      // Calculate utilisation (based on timesheets this month)
      let totalHours = 0;
      if (deptEmployees.length > 0) {
        const employeeIds = deptEmployees.map((e) => e.employee.id);
        const startOfMonthStr = startOfMonth.toISOString().split("T")[0]!;
        const endOfMonthStr = endOfMonth.toISOString().split("T")[0]!;
        const timesheetData = await db
          .select({
            totalHours: sql<number>`COALESCE(SUM(CAST(${timesheets.totalHours} AS NUMERIC)), 0)`,
          })
          .from(timesheets)
          .where(
            and(
              or(...employeeIds.map((id) => eq(timesheets.employeeId, id)))!,
              gte(timesheets.sheetDate, startOfMonthStr),
              lte(timesheets.sheetDate, endOfMonthStr),
              sql`${timesheets.status} IN ('submitted', 'approved')`
            )
          );

        totalHours = Number(timesheetData[0]?.totalHours || 0);
      }

      const expectedHours = activeEmployees.length * 160; // 160 hours per month (40 hours/week * 4 weeks)
      const utilisation =
        expectedHours > 0 ? Math.round((totalHours / expectedHours) * 100) : 0;

      // Open roles (positions without employees)
      const filledPositionIds = new Set(
        deptEmployees
          .map((e) => e.employee.positionId)
          .filter((id) => id !== null)
      );
      const openRoles = deptPositions.filter(
        (p) => !filledPositionIds.has(p.id)
      ).length;

      // Pay structure
      const payRates = deptEmployees
        .map((e) => {
          const emp = e.employee;
          if (emp.hourlyRate) {
            return {
              type: "hourly" as const,
              rate: Number(emp.hourlyRate),
            };
          } else if (emp.salary) {
            return {
              type: "salary" as const,
              rate: Number(emp.salary),
            };
          }
          return null;
        })
        .filter((p) => p !== null) as Array<{
        type: "hourly" | "salary";
        rate: number;
      }>;

      const hourlyRates = payRates
        .filter((p) => p.type === "hourly")
        .map((p) => p.rate);
      const salaryRates = payRates
        .filter((p) => p.type === "salary")
        .map((p) => p.rate);

      let payRange = "Not Set";
      let averageYearlyPay: string | null = null;
      let payType = "Not Set";
      const positionPayDetails: Array<{ role: string; pay: string }> = [];

      if (hourlyRates.length > 0 && salaryRates.length > 0) {
        // Mixed pay types
        const minHourly = Math.min(...hourlyRates);
        const maxHourly = Math.max(...hourlyRates);
        const minSalary = Math.min(...salaryRates);
        const maxSalary = Math.max(...salaryRates);
        payRange = `$${Math.round(minHourly)} - $${Math.round(
          maxHourly
        )}/hr or $${Math.round(minSalary / 1000)}k - $${Math.round(
          maxSalary / 1000
        )}k/yr`;
        payType = "Mixed pay types";
        const avgHourly =
          hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length;
        const avgSalary =
          salaryRates.reduce((a, b) => a + b, 0) / salaryRates.length;
        averageYearlyPay = `$${Math.round(
          (avgHourly * 2080 + avgSalary) / 2 / 1000
        )}k/yr`;
      } else if (hourlyRates.length > 0) {
        const minRate = Math.min(...hourlyRates);
        const maxRate = Math.max(...hourlyRates);
        payRange = `$${Math.round(minRate)} - $${Math.round(maxRate)}/hr`;
        payType = "Hourly";
        const avgRate =
          hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length;
        averageYearlyPay = `$${Math.round(avgRate * 2080)}/yr`;
      } else if (salaryRates.length > 0) {
        const minRate = Math.min(...salaryRates);
        const maxRate = Math.max(...salaryRates);
        payRange = `$${Math.round(minRate / 1000)}k - $${Math.round(
          maxRate / 1000
        )}k/yr`;
        payType = "Salary";
        const avgRate =
          salaryRates.reduce((a, b) => a + b, 0) / salaryRates.length;
        averageYearlyPay = `$${Math.round(avgRate / 1000)}k/yr`;
      }

      // Get position pay details
      deptPositions.forEach((pos) => {
        const posEmployees = deptEmployees.filter(
          (e) => e.employee.positionId === pos.id
        );
        if (posEmployees.length > 0 && posEmployees[0]) {
          const firstEmp = posEmployees[0].employee;
          if (firstEmp.hourlyRate) {
            positionPayDetails.push({
              role: pos.name,
              pay: `$${Math.round(Number(firstEmp.hourlyRate))}/hr`,
            });
          } else if (firstEmp.salary) {
            positionPayDetails.push({
              role: pos.name,
              pay: `$${Math.round(Number(firstEmp.salary) / 1000)}k/yr`,
            });
          }
        }
      });

      return {
        department: {
          id: dept.id,
          name: dept.name,
          description: dept.description,
        },
        lead: departmentLead?.user
          ? {
              id: departmentLead.user.id,
              fullName: departmentLead.user.fullName,
            }
          : null,
        headcount: {
          total: totalPeople,
          inField: inFieldCount,
          available: availableCount,
        },
        roles: Object.entries(roleCounts).map(([role, count]) => ({
          role,
          count,
        })),
        avgPerformance: Math.round(avgPerformance * 10) / 10,
        utilisation: Math.min(100, Math.max(0, utilisation)),
        openRoles,
        payStructure: {
          range: payRange,
          averageYearlyPay,
          positionsCount: deptPositions.length,
          payType,
          positionDetails: positionPayDetails.slice(0, 3), // Limit to 3 for display
          hasMore: positionPayDetails.length > 3,
        },
        location: {
          primary: "San Francisco HQ", // Default - can be enhanced with actual location data
          operatingConditions: "Business Hours", // Default - can be enhanced
        },
      };
    })
  );

  const totalCount = total[0]?.count ?? 0;

  return {
    data: departmentsWithMetrics,
    total: totalCount,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getDepartmentById = async (id: number) => {
  // Get department basic info (excluding soft deleted)
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.isDeleted, false)));

  if (!department) {
    return null;
  }

  // Parse metadata from description
  let metadata: any = {};
  let descriptionText = department.description || "";
  if (department.description) {
    try {
      const parsed = JSON.parse(department.description);
      if (parsed.metadata) {
        metadata = parsed.metadata;
        descriptionText = parsed.text || "";
      }
    } catch {
      // Not JSON, use as-is
      descriptionText = department.description;
    }
  }

  // Calculate date range for rolling 30 days (for utilisation)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // OPTIMIZATION: Run all queries in parallel
  const [deptEmployees, deptPositions] = await Promise.all([
    // Get all employees in this department
    db
      .select({
        employee: {
          id: employees.id,
          status: employees.status,
          performance: employees.performance,
          positionId: employees.positionId,
          hourlyRate: employees.hourlyRate,
          salary: employees.salary,
        },
        user: {
          id: users.id,
          fullName: users.fullName,
          isActive: users.isActive,
        },
        position: {
          id: positions.id,
          name: positions.name,
        },
      })
      .from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .leftJoin(positions, eq(employees.positionId, positions.id))
      .where(
        and(eq(employees.departmentId, id), eq(employees.isDeleted, false))
      ),

    // Get all positions in this department
    // Handle null isDeleted values (for rows created before migration)
    db
      .select({
        id: positions.id,
        name: positions.name,
        description: positions.description,
      })
      .from(positions)
      .where(
        and(
          eq(positions.departmentId, id),
          or(isNull(positions.isDeleted), eq(positions.isDeleted, false))
        )
      ),
  ]);

  // Get timesheet data for utilisation calculation (rolling 30 days)
  // Only query if there are employees
  let timesheetData = { rows: [{ total_hours: "0" }] };
  if (deptEmployees.length > 0) {
    const employeeIds = deptEmployees.map((e) => e.employee.id);
    const result = await db.execute<{
      total_hours: string;
    }>(
      sql.raw(`
        SELECT COALESCE(SUM(CAST(total_hours AS NUMERIC)), 0)::text as total_hours
        FROM org.timesheets t
        INNER JOIN org.employees e ON t.employee_id = e.id
        INNER JOIN auth.users u ON e.user_id = u.id
        WHERE e.department_id = ${id}
          AND t.sheet_date >= '${startDateStr}'::date
          AND t.sheet_date <= '${endDateStr}'::date
          AND t.status IN ('submitted', 'approved')
          AND e.is_deleted = false
          AND u.is_active = true
      `)
    );
    timesheetData = result;
  }

  // Calculate metrics
  const totalPeople = deptEmployees.length;
  const activeEmployees = deptEmployees.filter(
    (e) => e.user?.isActive === true
  );
  const inFieldCount = deptEmployees.filter(
    (e) => e.employee.status === "in_field"
  ).length;
  const availableCount = deptEmployees.filter(
    (e) => e.employee.status === "available"
  ).length;
  const suspendedCount = deptEmployees.filter(
    (e) => e.employee.status === "suspended"
  ).length;

  // Get department lead/manager
  const departmentLead =
    deptEmployees.find(
      (e) =>
        e.position?.name?.toLowerCase().includes("manager") ||
        e.position?.name?.toLowerCase().includes("director") ||
        e.position?.name?.toLowerCase().includes("lead")
    ) || deptEmployees[0];

  // Average performance
  const performanceScores = deptEmployees
    .map((e) => e.employee.performance)
    .filter((p): p is number => p !== null && p !== undefined && p > 0);
  const avgPerformance =
    performanceScores.length > 0
      ? performanceScores.reduce((sum, p) => sum + p, 0) /
        performanceScores.length
      : 0;

  // Determine performance status (above/below target - assuming 80% is target)
  const performanceTarget = 80;
  const performanceStatus =
    avgPerformance >= performanceTarget ? "Above target" : "Below target";

  // Calculate utilisation (rolling 30 days)
  const totalHours = Number(timesheetData.rows?.[0]?.total_hours || 0);
  const expectedHours = activeEmployees.length * 240; // 240 hours per 30 days (8 hrs/day * 30 days)
  const utilisation =
    expectedHours > 0 ? Math.round((totalHours / expectedHours) * 100) : 0;

  // Open roles (positions without employees)
  const filledPositionIds = new Set(
    deptEmployees.map((e) => e.employee.positionId).filter((id) => id !== null)
  );
  const openRoles = deptPositions.filter(
    (p) => !filledPositionIds.has(p.id)
  ).length;

  // Pay structure - get all positions with their pay details
  const positionPayBands = deptPositions.map((pos) => {
    const posEmployees = deptEmployees.filter(
      (e) => e.employee.positionId === pos.id
    );

    let payType: string = "Not Set";
    let payAmount: string = "Not Set";

    if (posEmployees.length > 0 && posEmployees[0]) {
      const firstEmp = posEmployees[0].employee;
      if (firstEmp.hourlyRate) {
        payType = "Hourly";
        payAmount = `$${Math.round(Number(firstEmp.hourlyRate))}/hr`;
      } else if (firstEmp.salary) {
        payType = "Salary";
        payAmount = `$${Math.round(Number(firstEmp.salary) / 1000)}k/yr`;
      }
    }

    return {
      id: pos.id,
      role: pos.name,
      description: pos.description || "",
      payType,
      payAmount,
    };
  });

  // Calculate overall pay range
  const allPayRates = deptEmployees
    .map((e) => {
      const emp = e.employee;
      if (emp.hourlyRate) {
        return { type: "hourly" as const, rate: Number(emp.hourlyRate) };
      } else if (emp.salary) {
        return { type: "salary" as const, rate: Number(emp.salary) };
      }
      return null;
    })
    .filter((p) => p !== null) as Array<{
    type: "hourly" | "salary";
    rate: number;
  }>;

  const hourlyRates = allPayRates
    .filter((p) => p.type === "hourly")
    .map((p) => p.rate);
  const salaryRates = allPayRates
    .filter((p) => p.type === "salary")
    .map((p) => p.rate);

  let payRange = "Not Set";
  if (hourlyRates.length > 0 && salaryRates.length > 0) {
    const minHourly = Math.min(...hourlyRates);
    const maxHourly = Math.max(...hourlyRates);
    const minSalary = Math.min(...salaryRates);
    const maxSalary = Math.max(...salaryRates);
    payRange = `$${Math.round(minHourly)} - $${Math.round(
      maxHourly
    )}/hr or $${Math.round(minSalary / 1000)}k - $${Math.round(
      maxSalary / 1000
    )}k/yr`;
  } else if (hourlyRates.length > 0) {
    const minRate = Math.min(...hourlyRates);
    const maxRate = Math.max(...hourlyRates);
    payRange = `$${Math.round(minRate)} - $${Math.round(maxRate)}/hr`;
  } else if (salaryRates.length > 0) {
    const minRate = Math.min(...salaryRates);
    const maxRate = Math.max(...salaryRates);
    payRange = `$${Math.round(minRate / 1000)}k - $${Math.round(
      maxRate / 1000
    )}k/yr`;
  }

  return {
    department: {
      id: department.id,
      name: department.name,
      description: descriptionText,
      operatingConditions: metadata.shiftCoverage || "Business Hours",
    },
    headcount: totalPeople,
    openRoles,
    teamLead: metadata.teamLeadId
      ? {
          id: metadata.teamLeadId,
          fullName: departmentLead?.user?.fullName || null,
        }
      : departmentLead?.user
      ? {
          id: departmentLead.user.id,
          fullName: departmentLead.user.fullName,
        }
      : null,
    primaryLocation: metadata.primaryLocation || "San Francisco HQ",
    shiftCoverage: metadata.shiftCoverage || "Business Hours",
    teamStatus: {
      inField: inFieldCount,
      available: availableCount,
      suspended: suspendedCount,
    },
    performance: {
      avgPerformance: Math.round(avgPerformance * 10) / 10,
      performanceStatus, // "Above target" or "Below target"
    },
    utilisation: {
      value: Math.min(100, Math.max(0, utilisation)),
      period: "rolling 30 days",
    },
    positionPayBands: {
      payRange,
      totalPositions: deptPositions.length,
      positions: positionPayBands,
    },
  };
};

export const getDepartmentByName = async (name: string) => {
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.name, name), eq(departments.isDeleted, false)));
  return department || null;
};

export const createDepartment = async (data: {
  name: string;
  description?: string;
  leadId?: string;
  contactEmail?: string;
  primaryLocation?: string;
  shiftCoverage?: string;
  utilization?: number;
  isActive?: boolean;
  sortOrder?: number;
  positionPayBands?: Array<{
    positionTitle: string;
    payType: string;
    payRate: number;
    notes?: string;
  }>;
}) => {
  const [department] = await db
    .insert(departments)
    .values({
      name: data.name,
      description: data.description || null,
      leadId: data.leadId || null,
      contactEmail: data.contactEmail || null,
      primaryLocation: data.primaryLocation || null,
      shiftCoverage: data.shiftCoverage || null,
      utilization: data.utilization ? String(data.utilization) : null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || null,
      isDeleted: false,
    })
    .returning();

  // Create positions if positionPayBands are provided
  if (data.positionPayBands && data.positionPayBands.length > 0 && department) {
    const positionsToCreate = data.positionPayBands.map((band) => ({
      name: band.positionTitle,
      departmentId: department.id,
      description: band.notes || null,
      payRate: String(band.payRate),
      payType: band.payType,
      currency: "USD",
      isActive: true,
      isDeleted: false,
    }));

    await db.insert(positions).values(positionsToCreate);
  }

  return department;
};

export const updateDepartment = async (
  id: number,
  data: {
    name?: string;
    description?: string;
    leadId?: string | null;
    contactEmail?: string | null;
    primaryLocation?: string | null;
    shiftCoverage?: string | null;
    utilization?: number | null;
    isActive?: boolean;
    sortOrder?: number | null;
    positionPayBands?: Array<{
      id?: number;
      positionTitle: string;
      payType: string;
      payRate: number;
      notes?: string;
    }>;
  }
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.leadId !== undefined) updateData.leadId = data.leadId;
  if (data.contactEmail !== undefined)
    updateData.contactEmail = data.contactEmail;
  if (data.primaryLocation !== undefined)
    updateData.primaryLocation = data.primaryLocation;
  if (data.shiftCoverage !== undefined)
    updateData.shiftCoverage = data.shiftCoverage;
  if (data.utilization !== undefined)
    updateData.utilization = data.utilization ? String(data.utilization) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [department] = await db
    .update(departments)
    .set(updateData)
    .where(and(eq(departments.id, id), eq(departments.isDeleted, false)))
    .returning();

  // Update positions if positionPayBands are provided
  if (data.positionPayBands && department) {
    // Get existing positions for this department
    const existingPositions = await db
      .select()
      .from(positions)
      .where(
        and(eq(positions.departmentId, id), eq(positions.isDeleted, false))
      );

    const existingPositionIds = new Set(
      data.positionPayBands
        .map((band) => band.id)
        .filter((id): id is number => id !== undefined)
    );

    // Soft delete positions that are no longer in the list
    const positionsToDelete = existingPositions.filter(
      (pos) => !existingPositionIds.has(pos.id)
    );
    if (positionsToDelete.length > 0) {
      await db
        .update(positions)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          inArray(
            positions.id,
            positionsToDelete.map((p) => p.id)
          )
        );
    }

    // Update or create positions
    for (const band of data.positionPayBands) {
      if (band.id) {
        // Update existing position
        await db
          .update(positions)
          .set({
            name: band.positionTitle,
            description: band.notes || null,
            payRate: String(band.payRate),
            payType: band.payType,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, band.id));
      } else {
        // Create new position
        await db.insert(positions).values({
          name: band.positionTitle,
          departmentId: id,
          description: band.notes || null,
          payRate: String(band.payRate),
          payType: band.payType,
          currency: "USD",
          isActive: true,
          isDeleted: false,
        });
      }
    }
  }

  return department || null;
};

export const deleteDepartment = async (id: number) => {
  // Soft delete: set isDeleted to true instead of hard delete
  const [department] = await db
    .update(departments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(departments.id, id), eq(departments.isDeleted, false)))
    .returning();
  return department || null;
};

export const getDepartmentsList = async () => {
  // Get simplified department list with just id, name, leadId, and lead name
  const result = await db
    .select({
      id: departments.id,
      name: departments.name,
      leadId: departments.leadId,
      leadName: users.fullName,
    })
    .from(departments)
    .leftJoin(users, eq(departments.leadId, users.id))
    .where(eq(departments.isDeleted, false))
    .orderBy(departments.name);

  return result.map((dept) => ({
    id: dept.id,
    name: dept.name,
    leadId: dept.leadId,
    leadName: dept.leadName || null,
  }));
};

export const getDepartmentKPIs = async () => {
  // Calculate date range for rolling 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  // Format dates as YYYY-MM-DD strings for date column comparison
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // OPTIMIZATION: Run all queries in parallel for maximum performance
  const [departmentsCount, totalHeadcount, openRolesCount, utilisationData] =
    await Promise.all([
      // 1. Count active departments (departments with at least one active employee)
      db.execute<{ count: string }>(
        sql.raw(`
        SELECT COUNT(DISTINCT d.id)::text as count
        FROM org.departments d
        INNER JOIN org.employees e ON e.department_id = d.id
        INNER JOIN auth.users u ON e.user_id = u.id
        WHERE d.is_deleted = false
          AND e.is_deleted = false
          AND u.is_active = true
      `)
      ),

      // 2. Total headcount across all teams (active employees)
      db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .where(and(eq(employees.isDeleted, false), eq(users.isActive, true))),

      // 3. Open roles (positions without assigned employees)
      db.execute<{ count: string }>(
        sql.raw(`
        SELECT COUNT(*)::text as count
        FROM org.positions p
        WHERE p.department_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM org.employees e
            WHERE e.position_id = p.id
              AND e.is_deleted = false
          )
      `)
      ),

      // 4. Average utilisation (rolling 30 days)
      // Calculate: (total hours worked / expected hours) * 100
      // Expected hours = active employees * 8 hours/day * 30 days = 240 hours per employee
      db.execute<{
        total_hours: string;
        active_employees: string;
      }>(
        sql.raw(`
        SELECT 
          COALESCE(SUM(CAST(t.total_hours AS NUMERIC)), 0)::text as total_hours,
          COUNT(DISTINCT e.id)::text as active_employees
        FROM org.timesheets t
        INNER JOIN org.employees e ON t.employee_id = e.id
        INNER JOIN auth.users u ON e.user_id = u.id
        WHERE t.sheet_date >= '${startDateStr}'::date
          AND t.sheet_date <= '${endDateStr}'::date
          AND t.status IN ('submitted', 'approved')
          AND e.is_deleted = false
          AND u.is_active = true
      `)
      ),
    ]);

  // Extract values
  const departments = Number(departmentsCount.rows?.[0]?.count || 0);
  const headcount = Number(totalHeadcount[0]?.count || 0);
  const openRoles = Number(openRolesCount.rows?.[0]?.count || 0);

  // Calculate average utilisation (rolling 30 days)
  // Expected hours = active employees * 8 hours/day * 30 days = 240 hours per employee
  const totalHours = Number(utilisationData.rows?.[0]?.total_hours || 0);
  const activeEmployees = Number(
    utilisationData.rows?.[0]?.active_employees || 0
  );
  const expectedHours = activeEmployees * 240; // 240 hours per 30 days (8 hrs/day * 30 days)
  const avgUtilisation =
    expectedHours > 0 ? Math.round((totalHours / expectedHours) * 100) : 0;

  return {
    departments: {
      value: departments,
      label: "Active teams",
    },
    headcount: {
      value: headcount,
      label: "Employees across teams",
    },
    openRoles: {
      value: openRoles,
      label: "Approved requisitions",
    },
    avgUtilisation: {
      value: `${avgUtilisation}%`,
      label: "Rolling 30 days",
    },
  };
};
