import assert from "node:assert/strict";
import { queryForDocumentDraft, selectDraftDocument, captureDocumentDraft } from "../src/work-queue-model.ts";
import { test } from "node:test";
import { workQueuePage, workQueueRows } from "../src/work-queue-model.ts";

const products = [
  { sku: "SKU-A", name: "Product A" },
  { sku: "SKU-B", name: "Product B" },
];
const options = {
  query: "",
  status: "",
  sku: "",
  sort: "document",
  page: 1,
  pageSize: 10,
};

test("receiving status distinguishes an untouched, partial and completed PO without changing source data", () => {
  const items = [
    { id: "PO-1", sku: "SKU-A", ordered: 100, received: 0, remaining: 100 },
    { id: "PO-2", sku: "SKU-A", ordered: 100, received: 60, remaining: 40 },
    { id: "PO-3", sku: "SKU-B", ordered: 100, received: 100, remaining: 0 },
  ];
  const before = structuredClone(items);
  const rows = workQueueRows(items, products, "receiving");
  assert.deepEqual(
    rows.map((row) => row.status),
    ["not-received", "partially-received", "received"],
  );
  assert.deepEqual(
    rows.map((row) => row.remaining),
    [100, 40, 0],
  );
  assert.deepEqual(items, before);
});

test("document, SKU, item-name and source search combine with exact status/item filters before paging", () => {
  const rows = workQueueRows(
    [
      { id: "QC-1", sku: "SKU-A", source: "RECEIPT-001", remaining: 40 },
      { id: "QC-2", sku: "SKU-B", source: "RECEIPT-002", remaining: 20 },
    ],
    products,
    "quality",
  );
  for (const query of [" qc-1 ", "sku-a", "product a", "receipt-001"]) {
    assert.deepEqual(
      workQueuePage(rows, { ...options, query }).rows.map((row) => row.id),
      ["QC-1"],
    );
  }
  assert.equal(
    workQueuePage(rows, { ...options, status: "awaiting-qc", sku: "SKU-B" })
      .total,
    1,
  );
  assert.equal(
    workQueuePage(rows, { ...options, query: "QC-1", sku: "SKU-B" }).total,
    0,
  );
});

test("natural document ordering and quantity ordering are stable, bounded and do not mutate workflow order", () => {
  const items = Array.from({ length: 1000 }, (_, index) => ({
    id: `PO-${index + 1}`,
    sku: index % 2 ? "SKU-A" : "SKU-B",
    remaining: index,
    received: 0,
  }));
  const rows = workQueueRows(items, products, "receiving");
  const first = workQueuePage(rows, options);
  const second = workQueuePage(rows, { ...options, page: 2 });
  assert.equal(first.rows[1].id, "PO-2");
  assert.equal(second.rows[0].id, "PO-11");
  assert.equal(first.rows.length, 10);
  assert.equal(
    workQueuePage(rows, { ...options, sort: "remaining-desc" }).rows[0].id,
    "PO-1000",
  );
  assert.equal(rows[0].id, "PO-1");
  assert.equal(workQueuePage(rows, { ...options, page: 9999 }).page, 100);
  assert.equal(
    workQueuePage(rows, { ...options, query: "missing", page: 5 }).from,
    0,
  );
});

test("order quantities remain attached to their original identifiers after filtering and pagination", () => {
  const rows = workQueueRows(
    [
      { id: "SO-1", sku: "SKU-A", qty: 24, shipped: 8, status: "released" },
      {
        id: "SO-2",
        sku: "SKU-B",
        qty: 10,
        shipped: 0,
        status: "pending-approval",
      },
    ],
    products,
    "orders",
  );
  const found = workQueuePage(rows, { ...options, status: "released" }).rows[0];
  assert.equal(found.id, "SO-1");
  assert.equal(found.remaining, 16);
  assert.equal(found.qty, 24);
});

test("an active document outside a filter cannot expose its actions, while paging keeps its draft available", () => {
  const rows = workQueueRows(Array.from({ length: 12 }, (_, index) => ({
    id: `SO-${index + 1}`,
    sku: index === 11 ? "SKU-B" : "SKU-A",
    status: index === 11 ? "pending-approval" : "released",
  })), products, "orders");
  const selected = "SO-12";
  assert.equal(workQueuePage(rows, { ...options, selected }).selectedInFilter, true);
  for (const filter of [{ status: "released" }, { sku: "SKU-A" }, { query: "SO-2" }, { query: "missing" }]) {
    assert.equal(workQueuePage(rows, { ...options, selected, ...filter }).selectedInFilter, false);
  }
  assert.equal(workQueuePage(rows, { ...options, selected, page: 2 }).selectedInFilter, true);
  assert.equal(workQueuePage(rows, { ...options, selected, query: "SO-12" }).selectedInFilter, true);
  assert.equal(workQueuePage(rows, { ...options, selected: "removed" }).selectedInFilter, false);
});
test("a saved document outside the page never falls back to another document", () => {
  const rows = [{ id: "PO-FIRST", sku: "SAME-SKU" }];
  assert.equal(selectDraftDocument(rows, "PO-SAVED"), undefined);
  assert.equal(selectDraftDocument(rows, undefined), rows[0]);
  const draft = captureDocumentDraft({}, { qty: "3", scan: "SAME-SKU" }, "document", "PO-SAVED");
  assert.equal(draft.document, "PO-SAVED");
  assert.equal(captureDocumentDraft(draft, { document: "PO-FIRST", qty: undefined }, "document", "PO-SAVED").document, "PO-FIRST");
});

test("the queue query preserves a saved draft and a new order item lookup", () => {
  const result = queryForDocumentDraft({ view: "orders", page: 2, status: "draft", focusDocument: "FALLBACK" }, { order: "SAVED-ORDER", newOrderSku: "UNSEEN-SKU", qty: "7", scan: "PHYSICAL" });
  assert.equal(result.focusDocument, "SAVED-ORDER");
  assert.equal(result.focusSku, "UNSEEN-SKU");
  assert.equal(result.page, 2);
  assert.equal(result.status, "draft");
  assert.equal("scan" in result, false);
  assert.equal("qty" in result, false);
});
