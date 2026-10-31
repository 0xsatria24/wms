export interface CatalogItem {
  sku: string;
  name: string;
  barcode: string;
  category: string;
  active: boolean;
  [key: string]: unknown;
}
const order = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
export function itemCatalogPage<T extends CatalogItem>(
  items: T[],
  options: {
    query: string;
    status: string;
    category: string;
    sort: string;
    page: number;
    pageSize: number;
  },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const filtered = items.filter(
    (item) =>
      (!query ||
        [item.name, item.sku, item.barcode].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )) &&
      (!options.category || item.category === options.category) &&
      (!options.status || item.active === (options.status === "active")),
  );
  const key = options.sort === "sku" ? "sku" : "name";
  const direction = options.sort === "name-desc" ? -1 : 1;
  filtered.sort(
    (a, b) =>
      direction * order.compare(a[key], b[key]) || order.compare(a.sku, b.sku),
  );
  const pageSize = [10, 25, 50].includes(options.pageSize)
    ? options.pageSize
    : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.trunc(options.page) || 1));
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pages,
    from: filtered.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, filtered.length),
  };
}
