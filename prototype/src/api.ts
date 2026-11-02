import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  warehouses: string[];
  status: string;
  verified: boolean;
}
export interface Session {
  companyName?: string;
  mode: "development-demo" | "oidc";
  csrfToken: string;
  user: SessionUser | null;
}
export interface BusinessCommand {
  type: string;
  warehouse: string;
  principalId: string;
  expectedVersion: number | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}
export interface PendingRequest {
  id: string;
  request: BusinessCommand & { user: string };
  status: "offline" | "unknown";
  created: string;
}
export interface CommandResult {
  id: string;
  message: string;
  type?: string;
  stamp?: string;
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
}
export interface UserPreferences {
  version: number;
  language: string;
  theme: string;
  defaultWarehouse: string;
  startPage: string;
  pageSize: number;
}
export const defaultPreferences: UserPreferences = { version: 0, language: "en", theme: "light", defaultWarehouse: "", startPage: "workspace", pageSize: 10 };
export const preferences = () => request<UserPreferences>("/api/preferences");
export const savePreferences = (value: UserPreferences) => request<UserPreferences>("/api/preferences", value);
export const warehouseSettings = (warehouse: string) => request<any>(`/api/workspaces/${encodeURIComponent(warehouse)}/settings`);
export const saveWarehouseSettings = (warehouse: string, section: string, value: unknown) => request<any>(`/api/workspaces/${encodeURIComponent(warehouse)}/settings/${section}`, value);
export const addStorageLocation = (warehouse: string, name: string) => request("/api/edit", { type: "locationMaster", warehouse, payload: { name, pickable: true } });
let csrf = "";
export const setupStatus = () => request<{state: string; companyName: string}>("/api/setup/status");
export async function setupSession() {
  const value = await request<any>("/api/setup/session"); csrf = value.csrfToken; return value;
}
export const setupActivate = (code: string) => request("/api/setup/activate", {code}, undefined, false);
export const setupComplete = () => request("/api/setup/complete", {}, undefined, false);
export async function session(): Promise<Session> {
  const value = await request<Session>("/api/session");
  csrf = value.csrfToken;
  return value;
}
async function request<T = void>(
  path: string,
  body?: unknown,
  key?: string,
  refreshCsrf = true,
): Promise<T> {
  if (body !== undefined && !csrf) await session();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: {
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-XSRF-TOKEN": csrf }),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({
        code: response.status === 401 ? "session-expired" : "server-error",
      }));
      if (problem.code === "csrf" && body !== undefined && refreshCsrf) {
        await session();
        return request<T>(path, body, key, false);
      }
      throw new ApiError(problem.code || "server-error", response.status);
    }
    return response.status === 204 ? undefined : await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("network");
  } finally {
    clearTimeout(timeout);
  }
}
export async function login(
  account: string,
  password: string,
  rememberMe = false,
): Promise<SessionUser> {
  await session();
  await request("/api/dev/login", { account, password, rememberMe });
  const next = await session();
  if (!next.user) throw new ApiError("session-expired", 401);
  return next.user;
}
export async function logout() {
  await request("/api/logout", {});
  await session();
}
export async function deleteItem(
  warehouse: string,
  sku: string,
  version: number,
) {
  await request("/api/edit", {
    type: "delete-master",
    warehouse,
    payload: { sku, version, reason: "User confirmed item deletion" },
  });
}
export async function editRecord(warehouse: string, type: string, payload: any) {
  await request("/api/edit", { type, warehouse, payload: wireQuantities(payload) });
}
export async function requestAccess(name: string, email: string) {
  await session();
  await request("/api/access/request", { name, email });
}
export async function createUser(
  warehouse: string,
  name: string,
  email: string,
  reason: string,
) {
  await request("/api/edit", {
    type: "create-user",
    warehouse,
    payload: { name, email, reason },
  });
}
export async function deleteUser(
  warehouse: string,
  id: string,
  reason: string,
) {
  await request("/api/edit", {
    type: "delete-user",
    warehouse,
    payload: { id, reason },
  });
}
export async function verifyDemoEmail(email: string) {
  await request("/api/dev/verify-email", { email });
}
const numberKeys = new Set([
  "qty",
  "ordered",
  "received",
  "remaining",
  "reserved",
  "available",
  "picked",
  "shipped",
  "returned",
  "expected",
  "actual",
  "factor",
  "sent",
]);
export function uiSnapshot(value: any): any {
  if (Array.isArray(value)) return value.map(uiSnapshot);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        numberKeys.has(key) &&
        typeof v === "string" &&
        /^-?\d+(\.\d+)?$/.test(v)
          ? Number(v)
          : key === "allocations" && v
            ? Object.fromEntries(
                Object.entries(v).map(([loc, q]) => [loc, Number(q)]),
              )
            : uiSnapshot(v),
      ]),
    );
  return value;
}
export async function snapshot(warehouse: string, options: Record<string, string | number | boolean> = {}) {
  const params = new URLSearchParams(Object.entries({ ...options, requestKey: JSON.stringify(options) }).map(([key, value]) => [key, String(value)]));
  const value = uiSnapshot(
    await request(`/api/workspaces/${encodeURIComponent(warehouse)}/snapshot?${params}`),
  );
  for (const key of ["receipts", "orders", "inspections", "putaways", "returnTasks", "transfers", "returns", "counts"]) {
    value[key] = (value[key] || []).map((row: any) => ({ ...row, ...value.documentDates?.[row.id] }));
  }
  return value;
}
export const saveDocumentDates = (warehouse: string, value: any) => request("/api/edit", { type: "document-dates", warehouse, payload: value });
export async function exportLedger(
  warehouse: string,
  sku: string,
  location: string,
  query: string,
  from = "",
  to = "",
) {
  const params = new URLSearchParams({ sku, location, query, from, to });
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(warehouse)}/ledger.csv?${params}`,
    { credentials: "same-origin" },
  );
  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ code: "server-error" }));
    throw new ApiError(problem.code || "server-error", response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `stock-movements_${from || "beginning"}_${to || "latest"}_${new Date().toISOString().replaceAll(":", "-")}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function wireQuantities(value: any): any {
  if (Array.isArray(value)) return value.map(wireQuantities);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        ["qty", "good", "bad", "factor"].includes(k) && typeof v === "number"
          ? String(v)
          : wireQuantities(v),
      ]),
    );
  return value;
}
export function businessCommand(request: any, data: any): BusinessCommand {
  const p = request.payload;
  const reference = p.document || p.order || p.task;
  const doc = [
    ...data.receipts,
    ...data.orders,
    ...data.inspections,
    ...data.putaways,
    ...data.returnTasks,
    ...data.transfers,
    ...data.counts,
  ].find((d) => d.id === reference);
  return {
    type: request.type,
    warehouse: request.warehouse,
    principalId: request.user,
    expectedVersion: doc?.version ?? null,
    payload: wireQuantities(p),
    occurredAt: new Date().toISOString(),
  };
}
let database: Promise<IDBDatabase> | undefined;
function queueDb() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("inventory-wms-pending", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("requests", { keyPath: "id" });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new ApiError("storage-unavailable"));
  }));
}
async function queueWrite(
  operation: "put" | "delete",
  value: PendingRequest | string,
) {
  const db = await queueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("requests", "readwrite");
    const store = tx.objectStore("requests");
    if (operation === "put") store.put(value);
    else store.delete(value as string);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new ApiError("storage-unavailable"));
    tx.onabort = () => reject(new ApiError("storage-unavailable"));
  });
}
export async function pending(): Promise<PendingRequest[]> {
  const db = await queueDb();
  return new Promise((resolve, reject) => {
    const read = db.transaction("requests").objectStore("requests").getAll();
    read.onsuccess = () => resolve(read.result);
    read.onerror = () => reject(new ApiError("storage-unavailable"));
  });
}
export async function send(
  id: string,
  body: BusinessCommand,
  user: string,
  mode: string = "normal",
): Promise<CommandResult> {
  if (mode === "rejected" || mode === "conflict") throw new ApiError(mode);
  const existing = (await pending()).find(row => row.id === id);
  const row: PendingRequest = {
    id,
    request: { ...body, user },
    status: "offline",
    created: existing?.created || new Date().toISOString(),
  };
  if (mode === "offline" || !navigator.onLine) {
    const status = existing?.status === "unknown" ? "unknown" : "offline";
    await queueWrite("put", { ...row, status });
    return { id, message: status };
  }
  await queueWrite("put", { ...row, status: "unknown" });
  try {
    const result = await request<CommandResult>("/api/commands", body, id);
    if (mode === "unknown") {
      await queueWrite("put", { ...row, status: "unknown" });
      return { id, message: "unknown" };
    }
    await queueWrite("delete", id).catch(() => {});
    return result;
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      throw error;
    if (
      error instanceof ApiError &&
      error.code !== "network" &&
      error.status > 0 &&
      error.status < 500 &&
      ![408, 429].includes(error.status)
    ) {
      await queueWrite("delete", id);
      throw error;
    }
    return { id, message: "unknown" };
  }
}
export async function retryOriginal(
  row: PendingRequest,
  user: SessionUser,
  warehouse: string,
): Promise<CommandResult> {
  if (!row) throw new ApiError("source", 404);
  if (row.request.user !== user.id || row.request.warehouse !== warehouse)
    throw new ApiError("pending-owner", 403);
  const { user: ignored, ...body } = row.request;
  return send(row.id, body, user.id);
}
export async function checkOriginal(row: PendingRequest, user: SessionUser, warehouse: string): Promise<CommandResult> {
  if (!row) throw new ApiError("source", 404);
  if (row.request.user !== user.id || row.request.warehouse !== warehouse) throw new ApiError("pending-owner", 403);
  if (!navigator.onLine) return { id: row.id, message: "unknown" };
  try {
    const result = await request<CommandResult>(`/api/requests/${encodeURIComponent(row.request.type)}/${encodeURIComponent(row.id)}?warehouse=${encodeURIComponent(warehouse)}`);
    await queueWrite("delete", row.id);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { id: row.id, message: "unknown" };
    throw error;
  }
}
export async function persistEdit(
  before: any,
  next: any,
  warehouse: string,
): Promise<void> {
  const edit = async (type: string, payload: any) =>
    request("/api/edit", { type, warehouse, payload: wireQuantities(payload) });
  const previousProducts = new Map(before.products.map((p: any) => [p.sku, p]));
  const product = next.products.find(
    (p: any) =>
      JSON.stringify(p) !==
      JSON.stringify(previousProducts.get(p.sku)),
  );
  if (product) {
    const label = next.labelHistory.find(
      (l: any) => !before.labelHistory.includes(l) && l.action === "replace",
    );
    await edit("master", {
      ...product,
      reason: product.reason || label?.reason || "",
    });
    return;
  }
  const addedUser = next.users.find(
    (u: any) => !before.users.some((old: any) => old.id === u.id),
  );
  if (addedUser) {
    await requestAccess(addedUser.name, addedUser.email);
    return;
  }
  const changedUser = next.users.find(
    (u: any) =>
      JSON.stringify(u) !==
      JSON.stringify(before.users.find((old: any) => old.id === u.id)),
  );
  if (changedUser) {
    const old = before.users.find((u: any) => u.id === changedUser.id);
    if (!old.verified && changedUser.verified) {
      await verifyDemoEmail(changedUser.email);
      return;
    }
    await edit("access", {
      ...changedUser,
      reason: next.audit[0]?.payload?.reason || "",
    });
    return;
  }
  const order = next.orders.find(
    (o: any) => !before.orders.some((old: any) => old.id === o.id),
  );
  if (order) {
    await edit("create-order", order);
    return;
  }
  const changedOrder = next.orders.find(
    (o: any) =>
      JSON.stringify(o) !==
      JSON.stringify(before.orders.find((old: any) => old.id === o.id)),
  );
  if (changedOrder) {
    await edit("submit-order", changedOrder);
    return;
  }
  if (next.partialAllowed !== before.partialAllowed) {
    await edit("partial-policy", { enabled: next.partialAllowed });
    return;
  }
  for (const kind of [
    "packages",
    "labelHistory",
    "followups",
    "locationMaster",
    "unitMaster",
  ]) {
    const old = before[kind] || [];
    const changed = (next[kind] || []).find(
      (r: any) =>
        !old.some((o: any) => JSON.stringify(o) === JSON.stringify(r)),
    );
    if (changed) {
      await edit(kind, changed);
      return;
    }
  }
  throw new ApiError("unsupported-edit");
}
export function subscribe(warehouse: string, onChange: () => void): () => void {
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl("/hubs/workspace")
    .withAutomaticReconnect()
    .build();
  connection.on("WorkspaceChanged", () => {
    clearTimeout(changeTimer);
    if (!stopped) changeTimer = setTimeout(onChange, 200);
  });
  connection.onreconnected(async () => {
    if (stopped) return;
    await connection.invoke("JoinWorkspace", warehouse);
    if (!stopped) onChange();
  });
  const connect = () => {
    connection.start()
      .then(async () => {
        if (stopped) return;
        await connection.invoke("JoinWorkspace", warehouse);
        if (!stopped) onChange();
      })
      .catch(() => { if (!stopped) retryTimer = setTimeout(connect, 5000); });
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(changeTimer);
    void connection.stop();
  };
}
