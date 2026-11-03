import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/api.ts";

test("invitation checks never resend and an explicit retry preserves its identity", async () => {
  const original = globalThis.fetch;
  const seen = [];
  const id = "1351ff22-65d1-4269-a188-a867029c0745";
  const payload = { name: "Worker", email: "worker@example.test", role: "operator", warehouses: ["Main Warehouse"], reason: "New employee" };
  try {
    globalThis.fetch = async (url, options) => {
      if (url === "/api/session") return Response.json({ csrfToken: "test-csrf", mode: "oidc", user: null });
      seen.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
      return Response.json({ id, state: "unknown" });
    };
    await api.inviteAccount("Main Warehouse", id, payload);
    await api.accountInvitation("Main Warehouse", id);
    await api.inviteAccount("Main Warehouse", id, payload, true);
    assert.deepEqual(seen, [
      { url: `/api/workspaces/Main%20Warehouse/invitations/${id}`, method: "POST", body: { ...payload, resend: false } },
      { url: `/api/workspaces/Main%20Warehouse/invitations/${id}`, method: "GET", body: undefined },
      { url: `/api/workspaces/Main%20Warehouse/invitations/${id}`, method: "POST", body: { ...payload, resend: true } },
    ]);
  } finally { globalThis.fetch = original; }
});

test("password recovery sends an email address and never accepts a password", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      if (url === "/api/session") return Response.json({ csrfToken: "test-csrf", mode: "oidc", user: null });
      assert.equal(url, "/api/accounts/recovery");
      assert.deepEqual(JSON.parse(options.body), { email: "worker@example.test" });
      return Response.json({ message: "recovery-requested" }, { status: 202 });
    };
    await api.recoverPassword("worker@example.test");
  } finally { globalThis.fetch = original; }
});
