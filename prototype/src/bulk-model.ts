export type BulkResult = {
  id: string;
  status: "success" | "error" | "pending" | "skipped";
  message?: string;
};

export function visibleSelection<T>(
  ids: string[],
  rows: T[],
  key: (row: T) => string,
  allowed: (row: T) => boolean = () => true,
) {
  const visible = new Set(rows.filter(allowed).map(key));
  return ids.filter((id) => visible.has(id));
}

export function canOrderAction(
  action: string,
  row: any,
  user: any,
  review = "supervisor",
) {
  const supervisor = ["admin", "supervisor"].includes(user.role);
  if (action === "submit-order")
    return (
      row.status === "draft" &&
      (supervisor || (user.role === "operator" && row.creator === user.id))
    );
  if (action === "release-order")
    return supervisor && row.status === "approved";
  return (
    ["approve-order", "reject-order"].includes(action) &&
    supervisor &&
    row.status === "pending-approval" &&
    row.creator !== user.id &&
    (review !== "admin" || user.role === "admin")
  );
}

export function canAccessAction(status: string, row: any, user: any) {
  if (
    user.role !== "admin" ||
    row.id === user.id ||
    !(row.warehouses || []).every((w: string) => user.warehouses?.includes(w))
  )
    return false;
  if (status === "active") return row.status === "pending" && row.verified;
  if (status === "rejected") return row.status === "pending";
  return (
    status === "revoked" &&
    row.status === "active" &&
    row.warehouses?.length > 0
  );
}

export function canRetryEvent(row: any, user: any) {
  return (
    ["admin", "supervisor"].includes(user.role) &&
    row.transport !== "acknowledged" &&
    row.business !== "accepted"
  );
}

export async function withBulkOutput(
  results: BulkResult[],
  produce: () => Promise<void> | void,
): Promise<BulkResult[]> {
  if (!results.some((result) => result.status === "success")) return results;
  try {
    await produce();
    return results;
  } catch {
    return results.map((result) =>
      result.status === "success"
        ? { ...result, status: "error", message: "output-failed" }
        : result,
    );
  }
}

export async function runBulk<T>(
  rows: T[],
  execute: (row: T) => Promise<void | Partial<BulkResult>>,
  key: (row: T) => string = (row: any) => row.id,
  current: (row: T) => boolean = () => true,
): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  let stopped = false;
  for (const row of rows) {
    const id = key(row);
    if (stopped || !current(row)) {
      results.push({ id, status: "skipped", message: "batch-stopped" });
      continue;
    }
    try {
      const result = (await execute(row)) || {};
      const outcome: BulkResult = {
        id,
        status: result?.status || "success",
        message: result?.message,
      };
      results.push(outcome);
      stopped = outcome.status === "pending";
    } catch (error) {
      const uncertain =
        error.code === "network" ||
        error.message === "network" ||
        error.status >= 500;
      results.push({
        id,
        status: uncertain ? "pending" : "error",
        message: error.code || error.message || "server-error",
      });
      stopped = uncertain || [401, 403, 408, 429].includes(error.status);
    }
  }
  return results;
}

export function csvText(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
              text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
