import assert from "node:assert/strict";
import { test } from "node:test";
import { login } from "../src/api.ts";

for (const rememberMe of [undefined, false, true]) {
  test(`login sends explicit rememberMe=${rememberMe ?? false}`, async () => {
    const originalFetch = globalThis.fetch;
    const user = { id: "operator", name: "Operator", email: "operator@demo.company", role: "operator", warehouses: ["Main Warehouse"], status: "active", verified: true };
    let signedIn = false;
    let loginPayload;
    try {
      globalThis.fetch = async (path, options) => {
        if (path === "/api/session") return Response.json({ csrfToken: "login-csrf", mode: "development-demo", user: signedIn ? user : null });
        assert.equal(path, "/api/dev/login");
        assert.equal(options.credentials, "same-origin");
        assert.equal(options.headers["X-XSRF-TOKEN"], "login-csrf");
        loginPayload = JSON.parse(options.body);
        signedIn = true;
        return new Response(null, { status: 204 });
      };
      assert.deepEqual(await login("operator", "demo123", rememberMe), user);
      assert.deepEqual(loginPayload, { account: "operator", password: "demo123", rememberMe: rememberMe ?? false });
      assert.equal(signedIn, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
