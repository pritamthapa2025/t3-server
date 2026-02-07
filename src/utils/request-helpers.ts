/**
 * Normalize Express param/query value (string | string[]) to string | undefined.
 * Use when passing req.params.x or req.query.x to APIs that expect string.
 */
export function asSingleString(
  value: string | string[] | undefined
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
