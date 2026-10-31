import assert from "node:assert/strict";
import { test } from "node:test";
import { itemCatalogPage } from "../src/item-catalog.ts";
const items = Array.from({ length: 10000 }, (_, index) => ({
  sku: `SKU-${String(index + 1).padStart(5, "0")}`,
  name: `Test item ${index + 1}`,
  barcode: `000${String(index + 1).padStart(9, "0")}`,
  category: index % 2 ? "Tools" : "Parts",
  active: index % 5 !== 0,
}));
const options = {
  query: "",
  status: "",
  category: "",
  sort: "name",
  page: 1,
  pageSize: 10,
};
test("10,000 items produce bounded, stable pages without mutating source order", () => {
  const before = items.map((item) => item.sku);
  const first = itemCatalogPage(items, options);
  const second = itemCatalogPage(items, { ...options, page: 2 });
  const last = itemCatalogPage(items, { ...options, page: 1000 });
  assert.equal(first.total, 10000);
  assert.equal(first.rows.length, 10);
  assert.equal(second.from, 11);
  assert.equal(last.to, 10000);
  assert.equal(
    new Set([...first.rows, ...second.rows].map((item) => item.sku)).size,
    20,
  );
  assert.equal(first.rows[0].name, "Test item 1");
  assert.deepEqual(
    items.map((item) => item.sku),
    before,
  );
});
test("barcode search preserves leading zeros and combines category/status filters before pagination", () => {
  const exact = items[1234];
  const found = itemCatalogPage(items, { ...options, query: exact.barcode });
  assert.deepEqual(
    found.rows.map((item) => item.sku),
    [exact.sku],
  );
  const filtered = itemCatalogPage(items, {
    ...options,
    category: "Tools",
    status: "inactive",
    pageSize: 25,
  });
  assert.equal(filtered.total, 1000);
  assert.equal(filtered.rows.length, 25);
  assert.ok(
    filtered.rows.every((item) => !item.active && item.category === "Tools"),
  );
});
test("page size, reverse sorting, empty results and removed last-page records remain consistent", () => {
  assert.equal(
    itemCatalogPage(items, { ...options, sort: "name-desc" }).rows[0].name,
    "Test item 10000",
  );
  const tail = itemCatalogPage(items.slice(0, 11), { ...options, page: 999 });
  assert.equal(tail.page, 2);
  assert.equal(tail.rows.length, 1);
  assert.equal(
    itemCatalogPage(items.slice(0, 10), { ...options, page: 2 }).page,
    1,
  );
  const empty = itemCatalogPage(items, {
    ...options,
    query: "NO-SUCH-SKU",
    page: 500,
  });
  assert.deepEqual(
    [empty.from, empty.to, empty.page, empty.pages],
    [0, 0, 1, 1],
  );
  assert.equal(
    itemCatalogPage(items, { ...options, pageSize: 100000 }).rows.length,
    10,
  );
});
