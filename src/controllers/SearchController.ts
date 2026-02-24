import type { Request, Response } from "express";
import { z } from "zod";
import {
  globalSearch,
  searchByType,
  VALID_TYPES,
  BROWSE_PAGE_SIZE,
} from "../services/search.service.js";
import { getUserRoleWithContext } from "../services/featurePermission.service.js";

const VALID_TYPE_VALUES = [...VALID_TYPES] as [string, ...string[]];

const searchQuerySchema = z.object({
  q: z
    .string()
    .max(100, "Search query must be at most 100 characters")
    .transform((v) => v.trim())
    .optional(),
  type: z.enum(VALID_TYPE_VALUES).optional(),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(BROWSE_PAGE_SIZE),
});

export async function globalSearchHandler(req: Request, res: Response): Promise<void> {
  const parsed = searchQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid search parameters",
    });
    return;
  }

  const { q, type, page, limit } = parsed.data;

  if (!type && (!q || q.length < 2)) {
    res.status(400).json({
      success: false,
      message: "Search query must be at least 2 characters",
    });
    return;
  }

  try {
    const userId = req.user!.id;
    const roleCtx = await getUserRoleWithContext(userId);

    const ctx = {
      userId,
      roleName: roleCtx?.roleName ?? "Technician",
      employeeId: roleCtx?.employeeId ?? null,
    };

    if (type) {
      const term = q && q.length >= 2 ? q : undefined;
      const { result, hasMore } = await searchByType(type, ctx, term, page, limit);

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          query: q ?? "",
          type,
          page,
          limit,
          hasMore,
          totalResults: Object.values(result).reduce((s, a) => s + a.length, 0),
        },
      });
    } else {
      const results = await globalSearch(q!, ctx);

      res.status(200).json({
        success: true,
        data: results,
        meta: {
          query: q,
          totalResults: Object.values(results).reduce((s, a) => s + a.length, 0),
        },
      });
    }
  } catch (error) {
    console.error("[SearchController] globalSearch error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed. Please try again.",
    });
  }
}
