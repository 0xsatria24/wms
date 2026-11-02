import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { pending, retryOriginal, send, session } from "../src/api.ts";
import * as api from "../src/api.ts";

Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
const user = {
  id: "operator",
  warehouses: ["Main Warehouse"],
  status: "active",
};
const body = {
  type: "receive",
  warehouse: "Main Warehouse",
  principalId: user.id,
  expectedVersion: 7,
  payload: { document: "PO-TEST", scan: "000123", qty: "0.1" },
  occurredAt: "2026-10-31T01:00:00.000Z",
};
let posts;
let command;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });

beforeEach(async () => {
  posts = [];
  command = async () => json({ id: "TX-TEST", message: "recorded" });
  globalThis.fetch = async (path, options) => {
    if (path === "/api/session")
      return json({ csrfToken: "test-csrf", user, mode: "development-demo" });
    assert.equal(path, "/api/commands");
    posts.push({
      key: options.headers["Idempotency-Key"],
      body: JSON.parse(options.body),
    });
    return command(posts.at(-1));
  };
  await session();
  await new Promise((resolve, reject) => {
    const open = indexedDB.open("inventory-wms-pending", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("requests", { keyPath: "id" });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("requests", "readwrite");
      tx.objectStore("requests").clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
});

test("offline capture makes no POST and retries with the original identity, scope, version and key", async () => {
  const key = crypto.randomUUID();
  assert.equal((await send(key, body, user.id, "offline")).message, "offline");
  assert.equal(posts.length, 0);
  const [row] = await pending();
  assert.equal(row.status, "offline");
  assert.deepEqual(row.request, { ...body, user: user.id });
  await retryOriginal(row, user, body.warehouse);
  assert.deepEqual(posts, [{ key, body }]);
  assert.deepEqual(await pending(), []);
});

test("checking an unknown result only reads its scoped receipt and retains it when absent", async () => {
  const key = crypto.randomUUID();
  await send(key, body, user.id, "unknown");
  const [row] = await pending();
  let reads = 0;
  globalThis.fetch = async (path, options) => {
    assert.equal(path, `/api/requests/receive/${key}?warehouse=Main%20Warehouse`);
    assert.equal(options.method, 'GET');
    reads++;
    return json({ code: 'not-found' }, 404);
  };
  assert.equal((await api.checkOriginal(row, user, body.warehouse)).message, 'unknown');
  assert.equal(reads, 1);
  assert.deepEqual(await pending(), [row]);
  globalThis.fetch = async (_, options) => {
    assert.equal(options.method, 'GET');
    return json({ id: 'TX-TEST', message: 'recorded' });
  };
  assert.equal((await api.checkOriginal(row, user, body.warehouse)).id, 'TX-TEST');
  assert.deepEqual(await pending(), []);
});

test("a previously unknown request never becomes unsent when retrying offline", async () => {
  const key = crypto.randomUUID();
  await send(key, body, user.id, 'unknown');
  navigator.onLine = false;
  try {
    assert.equal((await retryOriginal((await pending())[0], user, body.warehouse)).message, 'unknown');
    assert.equal((await pending())[0].status, 'unknown');
  } finally { navigator.onLine = true; }
});

test("retry retains the first device capture time when the result remains unknown", async () => {
  const key = crypto.randomUUID();
  await send(key, body, user.id, "offline");
  const row = (await pending())[0];
  row.created = "2026-01-01T00:00:00.000Z";
  await new Promise((resolve, reject) => {
    const open = indexedDB.open("inventory-wms-pending", 1);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction("requests", "readwrite");
      tx.objectStore("requests").put(row);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    open.onerror = () => reject(open.error);
  });
  await send(key, body, user.id, "unknown");
  assert.equal((await pending())[0].created, row.created);
  assert.equal(posts[0].body.occurredAt, body.occurredAt);
});

test("lost response, server failure and revoked access retain the same unresolved request until a known result", async () => {
  const key = crypto.randomUUID();
  const committed = new Set();
  command = async ({ key }) => {
    committed.add(key);
    throw new TypeError("Response lost");
  };
  assert.equal((await send(key, body, user.id)).message, "unknown");
  let [row] = await pending();
  command = async () => json({ code: "server-error" }, 503);
  assert.equal(
    (await retryOriginal(row, user, body.warehouse)).message,
    "unknown",
  );
  [row] = await pending();
  command = async () => json({ code: "denied" }, 403);
  await assert.rejects(() => retryOriginal(row, user, body.warehouse), {
    code: "denied",
  });
  [row] = await pending();
  assert.deepEqual(row.request, { ...body, user: user.id });
  command = async ({ key }) => {
    committed.add(key);
    return json({ id: "TX-TEST", message: "recorded" });
  };
  assert.equal((await retryOriginal(row, user, body.warehouse)).id, "TX-TEST");
  assert.equal(committed.size, 1);
  assert.ok(posts.every((post) => post.key === key));
  assert.ok(
    posts.every((post) => JSON.stringify(post.body) === JSON.stringify(body)),
  );
  assert.deepEqual(await pending(), []);
});

test("a different user or warehouse cannot send another capture", async () => {
  await send(crypto.randomUUID(), body, user.id, "offline");
  const [row] = await pending();
  await assert.rejects(
    () => retryOriginal(row, { ...user, id: "admin" }, body.warehouse),
    { code: "pending-owner" },
  );
  await assert.rejects(() => retryOriginal(row, user, "Secondary Warehouse"), {
    code: "pending-owner",
  });
  assert.equal(posts.length, 0);
  assert.equal((await pending()).length, 1);
});

test("a definite validation rejection removes only the rejected capture", async () => {
  command = async () => json({ code: "scan-item" }, 400);
  const key = crypto.randomUUID();
  await assert.rejects(() => send(key, body, user.id), { code: "scan-item" });
  assert.deepEqual(await pending(), []);
  assert.equal(posts.length, 1);
});

test("a deterministic CSRF rejection refreshes the token and preserves the command key and payload", async () => {
  const key = crypto.randomUUID();
  command = async () =>
    posts.length === 1
      ? json({ code: "csrf" }, 400)
      : json({ id: "TX-TEST", message: "recorded" });
  await send(key, body, user.id);
  assert.deepEqual(posts, [
    { key, body },
    { key, body },
  ]);
  assert.deepEqual(await pending(), []);
});
