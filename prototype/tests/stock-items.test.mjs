import assert from "node:assert/strict";
import { test } from "node:test";
import { stockItemPage } from "../src/stock-items.ts";

const products = [
  { sku: "SKU-A", name: "Same name", unit: "units" },
  { sku: "SKU-B", name: "Same name", unit: "units" },
];
const position = (patch = {}) => ({
  sku: "SKU-A",
  warehouse: "Main",
  location: "A-01",
  qty: 10,
  reserved: 2,
  condition: "good",
  hold: "",
  frozen: false,
  ...patch,
});
test("a server-authorized storage location is pickable independently of its code", () => {
  const result = stockItemPage([position({ location: "B-03", pickable: true })], products, { warehouse: "Main", query: "", location: "", condition: "", status: "", sort: "item", descending: false, page: 1, pageSize: 10 });
  assert.equal(result.items[0].totals[0].available, 8);
});
const options = {
  warehouse: "Main",
  query: "",
  location: "",
  condition: "",
  status: "",
  sort: "item",
  descending: false,
  page: 1,
  pageSize: 10,
};

test("Item sorting follows the item name before its SKU", () => {
  const names = [{sku: "Z", name: "Alpha", unit: "units"}, {sku: "A", name: "Zulu", unit: "units"}];
  const rows = [position({sku: "Z"}), position({sku: "A"})];
  assert.deepEqual(stockItemPage(rows, names, options).items.map(i => i.sku), ["Z", "A"]);
});

test("item time uses only the latest movement of matching positions and never the refresh time", () => {
  const positions = [
    position({ lastMovementAt: "2026-11-02T01:00:00Z" }),
    position({ location: "QC", lastMovementAt: "2026-11-02T03:00:00Z" }),
    position({ warehouse: "Other", lastMovementAt: "2026-11-03T09:00:00Z" }),
    position({ sku: "SKU-B", lastMovementAt: null }),
  ];
  assert.equal(stockItemPage(positions, products, options).items[0].lastMovementAt, positions[1].lastMovementAt);
  const filtered = stockItemPage(positions, products, { ...options, location: "A-01" });
  assert.equal(filtered.items[0].lastMovementAt, positions[0].lastMovementAt);
  assert.equal(filtered.items[1].lastMovementAt, null);
  assert.equal(stockItemPage([position({ lastMovementAt: "bad" })], products, options).items[0].lastMovementAt, null);
});

test("SKU grouping preserves warehouse boundaries and excludes restricted stock from Available", () => {
  const positions = [
    position({ frozen: true, reserved: 0 }),
    position({
      location: "QC",
      condition: "not-good",
      hold: "quality-rejected",
      reserved: 0,
    }),
    position({ location: "Staging", qty: 24, reserved: 24 }),
    position({ sku: "SKU-B" }),
    position({ warehouse: "Other", qty: 999 }),
  ];
  const before = structuredClone(positions);
  const result = stockItemPage(positions, products, options);
  assert.equal(result.totalItems, 2);
  assert.equal(result.totalPositions, 4);
  assert.equal(result.items[0].locations.length, 3);
  assert.equal(result.items[0].conditions.length, 2);
  assert.equal(result.items[0].statusVariants, 3);
  assert.deepEqual(result.items[0].totals, [
    { unit: "units", reserved: 24, available: 0 },
  ]);
  assert.equal(result.items[1].totals[0].available, 8);
  assert.deepEqual(positions, before);
  assert.equal(result.items[0].rows[0], positions[0]);
});

test("search and filters select positions before calculating item totals", () => {
  const positions = [
    position(),
    position({ location: "A-02", qty: 20, reserved: 4 }),
    position({
      location: "QC",
      hold: "awaiting-qc",
      condition: "unassessed",
      qty: 7,
    }),
  ];
  for (const filter of [{ query: "A-02" }, { location: "A-02" }]) {
    const result = stockItemPage(positions, products, {
      ...options,
      ...filter,
    });
    assert.equal(result.items[0].rows.length, 1);
    assert.deepEqual(result.items[0].totals, [
      { unit: "units", reserved: 4, available: 16 },
    ]);
  }
  for (const filter of [
    { query: "Awaiting QC" },
    { status: "hold" },
    { condition: "unassessed" },
  ]) {
    const result = stockItemPage(positions, products, {
      ...options,
      ...filter,
    });
    assert.equal(result.totalPositions, 1);
    assert.equal(result.items[0].rows[0].location, "QC");
    assert.equal(result.items[0].totals[0].available, 0);
  }
  assert.equal(
    stockItemPage(positions, products, { ...options, query: "missing" })
      .totalItems,
    0,
  );
});

test("mixed units stay separate and pagination counts parents rather than positions", () => {
  const positions = Array.from({ length: 12 }, (_, i) =>
    position({ sku: `SKU-${i}` }),
  );
  positions.push(
    position({
      sku: "SKU-0",
      location: "A-02",
      unit: "boxes",
      qty: 3,
      reserved: 1,
    }),
  );
  const first = stockItemPage(positions, products, options);
  assert.equal(first.items.length, 10);
  assert.equal(first.totalItems, 12);
  assert.equal(first.totalPositions, 13);
  assert.deepEqual(first.items[0].totals, [
    { unit: "units", reserved: 2, available: 8 },
    { unit: "boxes", reserved: 1, available: 2 },
  ]);
  const last = stockItemPage(positions, products, { ...options, page: 99 });
  assert.equal(last.page, 2);
  assert.equal(last.items.length, 2);
  assert.equal(last.from, 11);
});
