/** HashRouter-safe print URLs (app routes live under /#/...). */

export function printDocumentsHref(
  ids: string | string[],
  options?: { autoprint?: boolean },
): string {
  const list = (Array.isArray(ids) ? ids : [ids]).map((id) => id.trim()).filter(Boolean);
  if (!list.length) return "/#/print/documents";
  const autoprint = options?.autoprint ? "autoprint=1" : "";
  if (list.length === 1) {
    const query = autoprint ? `?${autoprint}` : "";
    return `/#/print/documents/${list[0]}${query}`;
  }
  const params = new URLSearchParams({ ids: list.join(",") });
  if (autoprint) params.set("autoprint", "1");
  return `/#/print/documents?${params.toString()}`;
}

export function openPrintDocuments(
  ids: string | string[],
  options?: { autoprint?: boolean },
): Window | null {
  // Omit noopener so the tab can close itself via window.close() from the Back button.
  return window.open(printDocumentsHref(ids, options), "_blank");
}

export function printPayslipHref(id: string): string {
  return `/#/print/payslips/${id}`;
}

export function openPrintPayslip(id: string): Window | null {
  return window.open(printPayslipHref(id), "_blank");
}
