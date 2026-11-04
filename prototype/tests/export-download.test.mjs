import test from "node:test";
import assert from "node:assert/strict";
import { operationalExport, exportEvents } from "../src/api.ts";

test("export sends CSRF and explicit server scope, and downloads only completed response", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let clicked = false;
  const requests = [];
  globalThis.document = { createElement: () => ({ click() { clicked = true; } }) };
  globalThis.fetch = async (url, options) => {
    requests.push([url, options]);
    return url === "/api/session" ? Response.json({ csrfToken: "export-test" }) : new Response("file", { headers: { "Content-Disposition": 'attachment; filename="stock.xlsx"' } });
  };
  try {
    await operationalExport("Main Warehouse", { type: "stock", format: "xlsx", scope: "selected", ids: ["000123"] }, new AbortController().signal);
    const [url, options] = requests.at(-1);
    assert.match(url, /Main%20Warehouse\/exports$/);
    assert.equal(options.headers["X-XSRF-TOKEN"], "export-test");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(JSON.parse(options.body).ids, ["000123"]);
    assert.equal(clicked, true);
  } finally { globalThis.fetch = originalFetch; globalThis.document = originalDocument; }
});

test("permission failure never creates a download; backend error is preserved", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { createElement() { throw new Error("must not download"); } };
  globalThis.fetch = async () => Response.json({ code: "blind-count" }, { status: 403 });
  try {
    await assert.rejects(operationalExport("w1", { type: "ledger", sku: "000123" }, new AbortController().signal), error => error.code === "blind-count" && error.status === 403);
  } finally { globalThis.fetch = originalFetch; globalThis.document = originalDocument; }
});

test("aborting after file generation prevents delivery to a changed context", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const abort = new AbortController();
  globalThis.document = { createElement() { throw new Error("must not download"); } };
  globalThis.fetch = async () => ({ ok: true, async blob() { abort.abort(); return new Blob(["private data"]); } });
  try {
    await assert.rejects(operationalExport("w1", { type: "stock" }, abort.signal), { name: "AbortError" });
  } finally { globalThis.fetch = originalFetch; globalThis.document = originalDocument; }
});

test("event history uses private cancellable backend request and preserves full source ID", async () => {
  const originalFetch = globalThis.fetch;
  const abort = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.match(url, /documentId=legacy%2Fsource%2B0001$/);
    assert.equal(options.signal, abort.signal);
    assert.equal(options.cache, "no-store");
    return Response.json([{ id: "0000000000000001", kind: "receive", quantity: "60", posted: "2026-11-04T00:00:00Z" }]);
  };
  try { assert.equal((await exportEvents("w1", "legacy/source+0001", abort.signal))[0].quantity, "60"); }
  finally { globalThis.fetch = originalFetch; }
});

test("context invalidation blocks a completed file even before abort cleanup runs", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { createElement() { throw new Error("must not download"); } };
  globalThis.fetch = async () => new Response("old warehouse data");
  try {
    await assert.rejects(operationalExport("old-warehouse", { type: "stock" }, new AbortController().signal, () => false), { name: "AbortError" });
  } finally { globalThis.fetch = originalFetch; globalThis.document = originalDocument; }
});
