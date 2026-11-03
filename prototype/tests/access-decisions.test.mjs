import assert from "node:assert/strict";
import { test } from "node:test";
import { persistEdit } from "../src/api.ts";

for (const [previousStatus, status, warehouses] of [["pending", "rejected", []], ["active", "revoked", ["Main Warehouse"]]]) {
  test(`${status} is a status decision without assigning roles or warehouses`, async () => {
    const originalFetch = globalThis.fetch;
    let submitted;
    const previous = { id: "applicant", status: previousStatus, role: "operator", warehouses, verified: false };
    const before = { products: [], users: [previous] };
    const next = { ...before, users: [{ ...previous, status }], audit: [{ payload: { reason: "Access not required" } }] };
    try {
      globalThis.fetch = async (path, options) => {
        if (path === "/api/session") return Response.json({ csrfToken: "access-csrf", mode: "oidc", user: null });
        assert.equal(path, "/api/edit");
        submitted = JSON.parse(options.body);
        return new Response(null, { status: 204 });
      };
      await persistEdit(before, next, "Main Warehouse");
      assert.deepEqual(submitted, { type: "access-status", warehouse: "Main Warehouse", payload: { id: "applicant", expectedStatus: previousStatus, status, reason: "Access not required" } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
