import test from "node:test";
import assert from "node:assert/strict";
import * as bulk from "../src/bulk-model.ts";

test("page selection cannot retain hidden or newly ineligible rows", () => {
  assert.deepEqual(
    bulk.visibleSelection(
      ["a", "b", "c"],
      [{ id: "b" }, { id: "c" }],
      (r) => r.id,
      (r) => r.id !== "c",
    ),
    ["b"],
  );
});

test("order selection respects document state, creator and warehouse reviewer policy", () => {
  const actor = { id: "reviewer", role: "supervisor" };
  const order = { status: "pending-approval", creator: "operator" };
  assert.equal(
    bulk.canOrderAction("approve-order", order, actor, "supervisor"),
    true,
  );
  assert.equal(
    bulk.canOrderAction("approve-order", order, actor, "admin"),
    false,
  );
  assert.equal(
    bulk.canOrderAction(
      "approve-order",
      { ...order, creator: actor.id },
      actor,
      "supervisor",
    ),
    false,
  );
  assert.equal(bulk.canOrderAction("release-order", order, actor), false);
  assert.equal(
    bulk.canOrderAction(
      "release-order",
      { ...order, status: "approved" },
      actor,
    ),
    true,
  );
  assert.equal(
    bulk.canOrderAction(
      "submit-order",
      { status: "draft", creator: "other" },
      { id: "operator", role: "operator" },
    ),
    false,
  );
  assert.equal(
    bulk.canOrderAction(
      "submit-order",
      { status: "draft", creator: "operator" },
      { id: "operator", role: "operator" },
    ),
    true,
  );
  assert.equal(
    bulk.canOrderAction(
      "release-order",
      { status: "approved" },
      { id: "viewer", role: "viewer" },
    ),
    false,
  );
});

test("access selection excludes self and unverified approvals without broadening warehouse scope", () => {
  const actor = { id: "admin", role: "admin", warehouses: ["Main"] };
  const target = {
    id: "pending",
    status: "pending",
    verified: true,
    warehouses: ["Main"],
  };
  assert.equal(bulk.canAccessAction("active", target, actor), true);
  assert.equal(
    bulk.canAccessAction("active", { ...target, warehouses: [] }, actor),
    true,
  );
  assert.equal(
    bulk.canAccessAction("active", { ...target, verified: false }, actor),
    false,
  );
  assert.equal(
    bulk.canAccessAction("active", { ...target, id: "admin" }, actor),
    false,
  );
  assert.equal(
    bulk.canAccessAction("active", { ...target, warehouses: ["Other"] }, actor),
    false,
  );
  assert.equal(
    bulk.canAccessAction("revoked", { ...target, status: "active" }, actor),
    true,
  );
  assert.equal(
    bulk.canAccessAction("rejected", { ...target, verified: false }, actor),
    true,
  );
});

test("bulk requests run sequentially and keep individual validation failures visible", async () => {
  const calls = [];
  const results = await bulk.runBulk(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    async (row) => {
      calls.push(row.id);
      if (row.id === "b")
        throw Object.assign(new Error("conflict"), { status: 409 });
    },
  );
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.deepEqual(
    results.map((r) => [r.id, r.status]),
    [
      ["a", "success"],
      ["b", "error"],
      ["c", "success"],
    ],
  );
  assert.equal(results[1].message, "conflict");
});

test("unknown command outcomes stop the batch without sending the remaining rows", async () => {
  const calls = [];
  const results = await bulk.runBulk(
    [{ id: "a" }, { id: "b" }],
    async (row) => {
      calls.push(row.id);
      return { status: "pending", message: "unknown" };
    },
  );
  assert.deepEqual(calls, ["a"]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["pending", "skipped"],
  );
});

test("lost authorization stops later bulk edits", async () => {
  let calls = 0;
  const results = await bulk.runBulk([{ id: "a" }, { id: "b" }], async () => {
    calls++;
    throw Object.assign(new Error("denied"), { status: 403 });
  });
  assert.equal(calls, 1);
  assert.deepEqual(
    results.map((r) => r.status),
    ["error", "skipped"],
  );
});

test("CSV quotes references and prevents spreadsheet formulas without changing quantities", () => {
  assert.equal(
    bulk.csvText([
      ["SKU", "Qty"],
      ["=1+1", -3],
      ['A,"B', 4],
    ]),
    '\uFEFF"SKU","Qty"\r\n"\'=1+1","-3"\r\n"A,""B","4"',
  );
});

test("accepted ERP events cannot enter retry selection", () => {
  assert.equal(
    bulk.canRetryEvent(
      { transport: "failed", business: "accepted" },
      { role: "admin" },
    ),
    false,
  );
  assert.equal(
    bulk.canRetryEvent(
      { transport: "failed", business: "pending" },
      { role: "supervisor" },
    ),
    true,
  );
  assert.equal(
    bulk.canRetryEvent(
      { transport: "acknowledged", business: "pending" },
      { role: "admin" },
    ),
    false,
  );
});

test("artifact failure keeps every affected row unsuccessful and retryable", async () => {
  const original = [
    { id: "a", status: "success" },
    { id: "b", status: "error", message: "conflict" },
  ];
  const results = await bulk.withBulkOutput(original, async () => {
    throw new Error("download failed");
  });
  assert.deepEqual(results, [
    { id: "a", status: "error", message: "output-failed" },
    { id: "b", status: "error", message: "conflict" },
  ]);
  assert.equal(original[0].status, "success");
});
