export function accessRoleDraft(user: any): Record<string, string> {
  return Object.fromEntries((user.warehouses || []).map((warehouse: string) => [warehouse, user.warehouseRoles?.[warehouse] || user.role || "operator"]));
}

export function canRecoverPending(intent: string, row: any, user: any, warehouse: string) {
  if (!row || row.request.user !== user.id || row.request.warehouse !== warehouse || !["operator", "supervisor", "admin"].includes(user.role)) return false;
  return intent === "send" ? row.status === "offline" : ["check", "retry"].includes(intent) && row.status === "unknown";
}

export async function generateLabelWithHistory(generate: () => void | Promise<void>, persist: () => unknown | Promise<unknown>) {
  try { await generate(); } catch { return { file: "failed", history: "not-attempted" }; }
  try {
    if (await persist() === false) return { file: "generated", history: "failed" };
    return { file: "generated", history: "saved" };
  } catch { return { file: "generated", history: "failed" }; }
}

export async function recordGeneratedLabel(persist: () => unknown | Promise<unknown>) {
  try {
    await persist();
    return { status: "success" as const, message: "label-history-saved" };
  } catch (error) {
    const uncertain = error.status === 0 || error.status >= 500 || error.message === "network";
    if ([401, 403, 408, 429].includes(error.status)) throw Object.assign(error, { code: "label-history-failed" });
    return { status: uncertain ? "pending" as const : "error" as const, message: uncertain ? "label-history-unknown" : "label-history-failed" };
  }
}

export function pendingBusinessSummary(row: any): [string, string][] {
  const payload = row.request.payload || {};
  return ["document", "order", "task", "source", "sku", "qty", "from", "to", "location"].flatMap(key => {
    const value = payload[key];
    if (value === undefined || value === null || value === "") return [];
    return [[key, key === "qty" ? `${value}${payload.unit ? ` ${payload.unit}` : ""}` : String(value)] as [string, string]];
  });
}
