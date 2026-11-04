import test from "node:test";
import assert from "node:assert/strict";
import * as reads from "../src/catalogue-reads.ts";

test("rapid typed reads dispatch only the last query", async () => {
  const sent = [];
  const cancel = reads.scheduleCatalogueRead?.({ view: "master", query: "a" }, { view: "master", query: "ab" }, row => sent.push(row), { delayMs: 10 });
  cancel?.();
  reads.scheduleCatalogueRead?.({ view: "master", query: "ab" }, { view: "master", query: "abc" }, row => sent.push(row), { delayMs: 10 });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(sent, [{ view: "master", query: "abc" }]);
});

test("scanner submit dispatches the complete value immediately", () => {
  const sent = [];
  reads.scheduleCatalogueRead?.({ view: "tracking", query: "000" }, { view: "tracking", query: "000123" }, row => sent.push(row), { immediate: true });
  assert.deepEqual(sent, [{ view: "tracking", query: "000123" }]);
});

test("page navigation is not delayed by the text-search debounce", () => {
  const sent = [];
  reads.scheduleCatalogueRead?.({ view: "master", query: "a", page: 1 }, { view: "master", query: "a", page: 2 }, row => sent.push(row));
  assert.deepEqual(sent, [{ view: "master", query: "a", page: 2 }]);
});
