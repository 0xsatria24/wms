import { test } from "node:test";
import assert from "node:assert/strict";
import { isGeneratedReference, referenceColumns, isReferenceLabel } from "../src/reference-format.ts";

test("new complete 16-character Base64URL references and legacy IDs are both recognized", () => {
  for (const id of ["AbC0_123-xYZ9876", "aB01_234-XYz5678", "TX-83ed29cbce8f4115b4ca9994b213c5c0", "INSPECTION-83ed29cbce8f4115b4ca9994b213c5c0", "83ed29cb-ce8f-4115-b4ca-9994b213c5c0"]) {
    assert.equal(isGeneratedReference(id), true, id);
  }
});
test("ordinary ERP references and short IDs remain ordinary text", () => {
  for (const id of ["SO-SIM-1001", "SKU-A", "PO-SIM-100", "short", "abcdef+/12345678", "abc=012345678901"]) assert.equal(isGeneratedReference(id), false);
  assert.equal(referenceColumns.has("sku"), false);
  assert.equal(referenceColumns.has("barcode"), false);
  assert.equal(isReferenceLabel("Barcode"), false);
  assert.equal(isReferenceLabel("Sumber"), true);
});
