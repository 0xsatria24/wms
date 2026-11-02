import { available } from "./fixtures.ts";

export interface StockPosition {
  sku: string;
  warehouse: string;
  location: string;
  qty: number;
  reserved: number;
  condition: string;
  hold?: string;
  frozen?: boolean;
  pickable?: boolean;
  unit?: string;
  lastMovementAt?: string | null;
}

export function stockStatusKeys(position: StockPosition): string[] {
  const keys = [];
  if (position.frozen) keys.push("frozen");
  if (position.hold) keys.push(`hold:${position.hold}`);
  return keys.length ? keys : ["unrestricted"];
}

export function stockItemPage(
  positions: StockPosition[],
  products: { sku: string; name: string; barcode?: string; unit?: string }[],
  options: {
    warehouse: string;
    query: string;
    location: string;
    condition: string;
    status: string;
    sort: string;
    descending: boolean;
    page: number;
    pageSize: number;
  },
) {
  const productBySku = new Map(
    products.map((product) => [product.sku, product]),
  );
  const scoped = positions.filter(
    (p) => p.warehouse === options.warehouse && p.qty > 0,
  );
  const query = options.query.trim().toLocaleLowerCase();
  const matching = scoped.filter((p) => {
    const product = productBySku.get(p.sku);
    return (
      (!query ||
        [
          p.sku,
          product?.name,
          product?.barcode,
          p.location,
          p.condition,
          p.hold,
          p.hold?.replaceAll("-", " "),
          p.hold === "awaiting-qc" ? "menunggu qc" : "",
          p.frozen ? "frozen dibekukan" : "",
          p.hold ? "on hold ditahan" : "",
          p.condition === "good"
            ? "bagus"
            : p.condition === "not-good"
              ? "not good tidak bagus"
              : "not assessed belum dicek",
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)) &&
      (!options.location || p.location === options.location) &&
      (!options.condition || p.condition === options.condition) &&
      (!options.status ||
        (options.status === "frozen"
          ? p.frozen
          : options.status === "hold"
            ? !!p.hold
            : !p.frozen && !p.hold))
    );
  });
  const groups = new Map<
    string,
    { key: string; sku: string; rows: StockPosition[] }
  >();
  for (const position of matching) {
    const key = JSON.stringify([position.warehouse, position.sku]);
    if (!groups.has(key)) groups.set(key, { key, sku: position.sku, rows: [] });
    groups.get(key)!.rows.push(position);
  }
  const items = [...groups.values()].map((group) => {
    const product = productBySku.get(group.sku) || {
      sku: group.sku,
      name: group.sku,
      unit: "units",
    };
    const rows = [...group.rows].sort(
      (a, b) =>
        a.location.localeCompare(b.location) ||
        a.condition.localeCompare(b.condition) ||
        (a.hold || "").localeCompare(b.hold || ""),
    );
    const totals = new Map<
      string,
      { unit: string; reserved: number; available: number }
    >();
    for (const row of rows) {
      const unit = row.unit || product.unit || "units";
      if (!totals.has(unit))
        totals.set(unit, { unit, reserved: 0, available: 0 });
      const total = totals.get(unit)!;
      total.reserved += row.reserved;
      total.available += available(row);
    }
    return {
      ...group,
      product,
      rows,
      lastMovementAt: rows.reduce<string | null>((latest, row) => {
        const stamp = row.lastMovementAt;
        return stamp &&
          Number.isFinite(Date.parse(stamp)) &&
          (!latest || Date.parse(stamp) > Date.parse(latest))
          ? stamp
          : latest;
      }, null),
      totals: [...totals.values()],
      locations: [...new Set(rows.map((p) => p.location))],
      conditions: [...new Set(rows.map((p) => p.condition))],
      statuses: [...new Set(rows.flatMap(stockStatusKeys))],
      statusVariants: new Set(
        rows.map((p) => JSON.stringify(stockStatusKeys(p))),
      ).size,
    };
  });
  const order = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  items.sort((a, b) => {
    // Compare quantities within a unit; different units keep a separate sort order.
    const compared =
      options.sort === "available"
        ? order.compare(
            a.totals
              .map((t) => t.unit)
              .sort()
              .join("|"),
            b.totals
              .map((t) => t.unit)
              .sort()
              .join("|"),
          ) ||
          (a.totals.length === 1 && b.totals.length === 1
            ? a.totals[0].available - b.totals[0].available
            : 0)
        : options.sort === "location"
          ? order.compare(a.locations[0], b.locations[0])
          : order.compare(a.sku, b.sku);
    return (
      (compared || order.compare(a.sku, b.sku)) * (options.descending ? -1 : 1)
    );
  });
  const pageSize = [10, 25, 50].includes(options.pageSize)
    ? options.pageSize
    : 10;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(1, Math.min(pages, options.page));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    totalItems: items.length,
    totalPositions: matching.length,
    scopedItems: new Set(scoped.map((p) => p.sku)).size,
    scopedPositions: scoped.length,
    page,
    pages,
    from: items.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, items.length),
  };
}
