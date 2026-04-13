/**
 * Proposal basis is stored only as ordered string[] in `proposal_basis_items` (JSONB).
 * API consumers still receive a derived `proposalBasis` string (numbered lines) from
 * {@link formatProposalBasisFromItems}. Legacy create/update payloads may send plain
 * `proposalBasis` text; we normalize to items via {@link coerceProposalBasisStorage}.
 */

/** Numbered multiline text → items (continuations stay with previous item). */
function parseLegacyNumberedProposalBasis(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const items: string[] = [];
  let current = "";

  const startsNewNumberedItem = (s: string) => /^\s*\d+[.)]\s+\S/.test(s);
  const stripLeadingNumber = (s: string) =>
    s.replace(/^\s*\d+[.)]\s+/, "").trimEnd();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current += "\n";
      continue;
    }
    if (startsNewNumberedItem(line)) {
      if (current) items.push(current.trimEnd());
      current = stripLeadingNumber(line);
    } else {
      current = current ? `${current}\n${trimmed}` : trimmed;
    }
  }
  if (current) items.push(current.trimEnd());
  return items.filter((s) => s.length > 0);
}

/** Parse free-form or legacy stored text into line items (matches frontend rules). */
export function parseProposalBasisTextToItems(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];

  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0);
    }
  } catch {
    // not JSON
  }

  const lines = raw.split(/\r?\n/);
  const anyNumbered = lines.some((l) => /^\s*\d+[.)]\s+\S/.test(l));
  if (anyNumbered) {
    return parseLegacyNumberedProposalBasis(raw);
  }

  const trimmedLines = lines.map((l) => l.trim()).filter(Boolean);
  if (trimmedLines.length === 0) return [];
  if (trimmedLines.length > 1) {
    return trimmedLines;
  }
  return [raw.trim()];
}

export function formatProposalBasisFromItems(
  items: string[] | null | undefined,
): string {
  const arr = Array.isArray(items)
    ? items.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];
  if (arr.length === 0) return "";
  return arr.map((line, i) => `${i + 1}. ${line}`).join("\n");
}

export function coerceProposalBasisStorage(input: {
  proposalBasis?: string | null;
  proposalBasisItems?: unknown;
}): { proposalBasisItems: string[] } {
  const fromItems = Array.isArray(input.proposalBasisItems)
    ? input.proposalBasisItems
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0)
    : [];
  if (fromItems.length > 0) {
    return { proposalBasisItems: fromItems };
  }

  const text = input.proposalBasis?.trim() ?? "";
  if (!text) {
    return { proposalBasisItems: [] };
  }
  return { proposalBasisItems: parseProposalBasisTextToItems(text) };
}
