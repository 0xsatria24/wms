export interface WorkQueueItem {
  id: string;
  sku: string;
  source?: string;
  remaining?: number;
  ordered?: number;
  received?: number;
  qty?: number;
  shipped?: number;
  status?: string;
}

export function selectDraftDocument<T extends { id: string } = any>(rows: T[], savedId?: string, preferred?: T): T | undefined {
  return savedId ? rows.find((row) => row.id === savedId) : preferred || rows[0];
}

export function captureDocumentDraft(draft: any, changes: any, field: string, activeId?: string) {
  return { ...(!draft[field] && activeId ? { [field]: activeId } : {}), ...changes };
}

export function queryForDocumentDraft(query: any, draft: any) {
  return { ...query, focusDocument: draft.document || draft.order || draft.task || "", focusSku: draft.newOrderSku || draft.sku || "" };
}

export interface WorkQueueRow extends WorkQueueItem {
  productName: string;
  remaining: number;
  status: string;
}

const order = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function workQueueRows(
  items: WorkQueueItem[],
  products: { sku: string; name: string }[],
  kind: string,
): WorkQueueRow[] {
  const names = new Map(products.map((product) => [product.sku, product.name]));
  return items.map((item) => {
    const remaining =
      item.remaining ?? Math.max(0, (item.qty ?? 0) - (item.shipped ?? 0));
    const status =
      kind === "receiving"
        ? remaining === 0
          ? "received"
          : item.received
            ? "partially-received"
            : "not-received"
        : item.status ||
          (kind === "quality"
            ? "awaiting-qc"
            : kind === "putaway"
              ? "ready"
              : "unknown");
    return {
      ...item,
      remaining,
      status,
      productName: names.get(item.sku) || item.sku,
    };
  });
}

export function workQueuePage(
  rows: WorkQueueRow[],
  options: {
    query: string;
    status: string;
    sku: string;
    sort: string;
    page: number;
    pageSize: number;
    selected?: string;
  },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!query ||
        [row.id, row.sku, row.productName, row.source || ""].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )) &&
      (!options.status || row.status === options.status) &&
      (!options.sku || row.sku === options.sku),
  );
  filtered.sort(
    (a, b) =>
      (options.sort === "remaining-desc"
        ? b.remaining - a.remaining
        : options.sort === "item"
          ? order.compare(a.productName, b.productName)
          : options.sort === "document-desc"
            ? order.compare(b.id, a.id)
            : order.compare(a.id, b.id)) || order.compare(a.id, b.id),
  );
  const pageSize = [10, 25, 50].includes(options.pageSize)
    ? options.pageSize
    : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.trunc(options.page) || 1));
  return {
    selectedInFilter: !options.selected || filtered.some((row) => row.id === options.selected),
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pages,
    from: filtered.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, filtered.length),
  };
}
