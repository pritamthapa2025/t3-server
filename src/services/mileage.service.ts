/**
 * Mileage service - stub implementations.
 * Mileage is tracked via expenses (isMileageExpense) in the expenses schema.
 * Dedicated mileage log tables/APIs can be implemented later.
 */

export async function getMileageLogs(
  _organizationId: string | undefined,
  _offset: number,
  _limit: number,
  _filters?: Record<string, unknown>,
) {
  return {
    data: [],
    total: 0,
    pagination: { page: 1, limit: _limit, totalPages: 0 },
  };
}

export async function getMileageLogById(
  _organizationId: string | undefined,
  _id: string,
): Promise<{ organizationId?: string } | null> {
  return null;
}

export async function createMileageLog(
  _organizationId: string | undefined,
  _employeeId: number,
  _body: Record<string, unknown>,
) {
  return null;
}

export async function updateMileageLog(
  _organizationId: string | undefined,
  _id: string,
  _body: Record<string, unknown>,
) {
  return null;
}

export async function deleteMileageLog(
  _organizationId: string | undefined,
  _id: string,
) {
  return null;
}

export async function verifyMileageLog(
  _organizationId: string | undefined,
  _id: string,
  _userId?: string,
) {
  return null;
}

export async function getMileageSummary(
  _organizationId: string | undefined,
  _filters?: Record<string, unknown>,
  _extra?: unknown,
) {
  return {
    totalMiles: 0,
    totalAmount: "0",
    logCount: 0,
  };
}
