/**
 * Normalize Express param/query value to string | undefined.
 * Use when passing req.params.x or req.query.x to APIs that expect string.
 * Query values may be nested objects (qs ParsedQs); those yield undefined.
 * Typed as `unknown` so we do not depend on the `qs` package for type resolution.
 */
export function asSingleString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}
