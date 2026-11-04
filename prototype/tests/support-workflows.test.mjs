import test from "node:test";
import assert from "node:assert/strict";
import * as support from "../src/support-model.ts";
import { canAccessAction } from "../src/bulk-model.ts";

test("access decisions use administrative warehouse scope, including individual edits", () => {
  const actor = { id: "admin", role: "admin", warehouses: ["A", "B"], adminWarehouses: ["A"] };
  const target = { id: "other", verified: true, status: "active", warehouses: ["B"] };
  assert.equal(canAccessAction("revoked", target, actor), false);
  assert.equal(canAccessAction("edit", { ...target, warehouses: ["A"] }, actor), true);
});

test("opening a mixed-role access editor keeps the role for each warehouse", () => {
  assert.deepEqual(support.accessRoleDraft?.({ role: "operator", warehouses: ["A", "B"], warehouseRoles: { A: "operator", B: "viewer" } }), { A: "operator", B: "viewer" });
});

test("pending recovery requires matching owner, warehouse, role and outcome", () => {
  const actor = { id: "operator", role: "operator" };
  const row = { status: "unknown", request: { user: "operator", warehouse: "A" } };
  assert.equal(support.canRecoverPending?.("check", row, actor, "A"), true);
  assert.equal(support.canRecoverPending?.("send", row, actor, "A"), false);
  assert.equal(support.canRecoverPending?.("retry", row, { ...actor, role: "viewer" }, "A"), false);
  assert.equal(support.canRecoverPending?.("check", row, actor, "B"), false);
});

test("a label file remains generated when its history cannot be saved", async () => {
  let outputCount = 0;
  const result = await support.generateLabelWithHistory?.(() => { outputCount++; }, async () => { throw new Error("network"); });
  assert.deepEqual(result, { file: "generated", history: "failed" });
  assert.equal(outputCount, 1);
});

test("a failed file generation never creates label history", async () => {
  let historyCount = 0;
  const result = await support.generateLabelWithHistory?.(() => { throw new Error("canvas"); }, async () => { historyCount++; });
  assert.deepEqual(result, { file: "failed", history: "not-attempted" });
  assert.equal(historyCount, 0);
});

test("pending business summary preserves quantities, source and intended location", () => {
  assert.deepEqual(support.pendingBusinessSummary?.({ request: { type: "receive", payload: { document: "PO-001", sku: "SKU-A", qty: 0.5, unit: "kg", location: "Receiving" } } }), [
    ["document", "PO-001"], ["sku", "SKU-A"], ["qty", "0.5 kg"], ["location", "Receiving"],
  ]);
});

test("a generated label with uncertain history stops the batch and names both outcomes", async () => {
  assert.deepEqual(await support.recordGeneratedLabel?.(async () => { throw Object.assign(new Error("network"), { status: 0 }); }), { status: "pending", message: "label-history-unknown" });
});

test("revoked label history access stops bulk writes while keeping file generation visible", async () => {
  await assert.rejects(() => support.recordGeneratedLabel(async () => { throw Object.assign(new Error("denied"), { status: 403 }); }), error => error.status === 403 && error.code === "label-history-failed");
});
