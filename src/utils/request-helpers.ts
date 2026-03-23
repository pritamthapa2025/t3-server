import type { ParsedQs } from "qs";

/**
 * Normalize Express param/query value to string | undefined.
 * Use when passing req.params.x or req.query.x to APIs that expect string.
 * Query values may include ParsedQs (nested objects); those yield undefined.
 */
export function asSingleString(
  value: string | ParsedQs | (string | ParsedQs)[] | undefined
): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
}
