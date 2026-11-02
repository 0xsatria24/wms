import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatStamp,
  localDate,
  timestampParts,
} from "../src/date-time.ts";
test("warehouse dates cross midnight independently of device timezone", () => {
  assert.equal(localDate("2026-11-01T16:30:00Z", "Asia/Jakarta"), "2026-11-01");
  assert.equal(
    localDate("2026-11-01T16:30:00Z", "Asia/Makassar"),
    "2026-11-02",
  );
});

test("table date and time describe the same instant in the warehouse zone", () => {
  const parts = timestampParts("2026-11-01T16:30:05Z", "en", "Asia/Makassar");
  assert.equal(parts.date, "2 Nov 2026");
  assert.match(parts.time, /00:30:05/);
  assert.match(parts.time, /GMT\+8/);
  assert.equal(timestampParts(null, "en", "Asia/Jakarta"), null);
  assert.equal(timestampParts("invalid", "id", "Asia/Jakarta"), null);
});
test("date-only fields do not shift and missing timestamps stay unknown", () => {
  assert.equal(formatDate("2026-11-02"), "2 Nov 2026");
  assert.equal(formatStamp(null), "Not recorded");
  assert.equal(formatStamp("bad", "id"), "Belum tercatat");
  assert.equal(formatDate("2026-02-30"), "Not set");
  assert.match(
    formatStamp("2026-11-01T16:30:05Z", "en", "Asia/Makassar"),
    /00:30:05/,
  );
});
