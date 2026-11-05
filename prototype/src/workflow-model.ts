export function quantity(value: string, zero = false): string | null {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number >= 1e12 || (!zero && number === 0))
    return null;
  return text
    .replace(/^0+(?=\d)/, "")
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}
const scaled = (text: string) => {
  const [a, b = ""] = text.split(".");
  return BigInt(a || "0") * 1000000n + BigInt(b.padEnd(6, "0"));
};
const decimal = (value: bigint): string => {
  const sign = value < 0n ? "-" : "";
  const n = value < 0n ? -value : value;
  return (
    sign +
    `${n / 1000000n}.${String(n % 1000000n).padStart(6, "0")}`.replace(
      /\.?0+$/,
      "",
    )
  );
};
export function balance(
  total: string,
  good: string,
  bad: string,
): string | null {
  const values = [total, good, bad].map((v) => quantity(v, true));
  return values.some((v) => v === null)
    ? null
    : decimal(scaled(values[0]!) - scaled(values[1]!) - scaled(values[2]!));
}
export const sumQuantity = (values: string[]) =>
  decimal(
    values.reduce((sum, value) => sum + scaled(quantity(value, true)!), 0n),
  );
export function relocationSources<
  T extends {
    available: string;
    condition: string;
    hold: string;
    pickable: boolean;
    frozen: boolean;
    location: string;
  },
>(positions: T[]): T[] {
  return positions.filter(
    (p) =>
      p.condition === "good" &&
      !p.hold &&
      p.pickable &&
      !p.frozen &&
      !["Receiving", "QC", "Staging"].includes(p.location) &&
      Number(p.available) > 0,
  );
}
export function allocationPlan(
  qty: string,
  positions: any[],
  partial: boolean,
) {
  const target = quantity(qty);
  let remaining = target ? scaled(target) : 0n;
  const allocations: { position: string; version: number; qty: string }[] = [];
  for (const p of relocationSources(positions).sort(
    (a, b) => a.location.localeCompare(b.location) || a.id.localeCompare(b.id),
  )) {
    if (remaining <= 0n) break;
    const free = scaled(quantity(p.available, true)!);
    const take = free < remaining ? free : remaining;
    if (take > 0n)
      allocations.push({
        position: p.id,
        version: p.version,
        qty: decimal(take),
      });
    remaining -= take;
  }
  return {
    allocations,
    shortage: decimal(remaining),
    allowed:
      !!target && allocations.length > 0 && (remaining === 0n || partial),
  };
}
export function resolveItem(code: string, items: any[]) {
  const matches = items.filter(
    (i) => i.active && (i.sku === code.trim() || i.barcode === code.trim()),
  );
  return matches.length === 1
    ? { status: "known", item: matches[0] }
    : { status: matches.length ? "ambiguous" : "unknown", item: null };
}
export const canLeaveDraft = (dirty: boolean, resolved: boolean) =>
  !dirty || resolved;
export const initialWorkspaceRoute = (hash:string,preferred:string,routes:string[],setup:boolean) => setup?'settings':routes.includes(hash.slice(1))?hash.slice(1):preferred;
export const acceptsDraftSave = (
  sent: { id: string; scope: string; snapshot: string },
  current: { id: string; scope: string; snapshot: string },
) =>
  sent.id === current.id &&
  sent.scope === current.scope &&
  sent.snapshot === current.snapshot;
export const receiptIdentity = (sku: string, items: any[]) => {
  const resolved = resolveItem(sku, items);
  return resolved.status === "known" &&
    resolved.item.sku === sku &&
    !resolved.item.restricted
    ? resolved.item
    : null;
};
export const referenceId = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
export interface WorkflowItem {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  unit: string;
  active: boolean;
  version: number;
  restricted: boolean;
}
export interface WorkflowDocument {
  qcGood?: string;
  qcBad?: string;
  id: string;
  kind: string;
  source: string;
  sku: string;
  name: string;
  unit: string;
  qty: string;
  actual: string;
  picked: string;
  shipped: string;
  returned: string;
  status: string;
  creator: string;
  reason: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  documentDate: string | null;
  scheduledDate: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  allocations: { position: string; location: string; qty: string }[];
}
export interface WorkflowData {
  lineageIds?: string[];
  role: string;
  warehouse: string;
  capabilities: {
    operate: boolean;
    master: boolean;
    qc: boolean;
    orderReview: boolean;
    administer: boolean;
  };
  items: WorkflowItem[];
  positions: any[];
  locations: any[];
  documents: WorkflowDocument[];
  headers: any[];
  history: any[];
  itemPage: any;
  documentPage: any;
  historyPage: any;
  proposals: any[];
  proposalPage: any;
  partialAllowed: boolean;
}
export interface WorkspaceContext {
  action?: string;
  sku?: string;
  position?: string;
  document?: string;
  draft?: string;
}
