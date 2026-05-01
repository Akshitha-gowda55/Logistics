/**
 * Workflow detail URLs use a single path segment: /workflows/:itemName.
 * React Router decodes the segment once; avoid double decode (breaks names with "%")
 * and tolerate edge cases where the segment is still percent-encoded.
 */
export function itemNameFromWorkflowPathParam(raw: string | undefined): string {
  if (raw == null) return "";
  const t = raw.trim();
  if (!t) return "";
  if (/%[0-9A-Fa-f]{2}/.test(t)) {
    try {
      return decodeURIComponent(t).trim();
    } catch {
      return t;
    }
  }
  return t;
}

/** Use for all <Link to> and navigate() targets so spaces / special chars stay valid. */
export function workflowDetailPath(itemName: string): string {
  return `/workflows/${encodeURIComponent(itemName.trim())}`;
}
