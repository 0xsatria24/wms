import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";

const bundled = await build({ entryPoints: [fileURLToPath(new URL("../src/Reference.tsx", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node", define: { "process.env.NODE_ENV": '"production"' } });
const { Reference } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));

test("new real IDs and long legacy references render verbatim without ellipsis", () => {
  for (const value of ["AbC0_123-xYZ9876", "TX-83ed29cbce8f4115b4ca9994b213c5c0", "INSPECTION-83ed29cbce8f4115b4ca9994b213c5c0", "83ed29cb-ce8f-4115-b4ca-9994b213c5c0"]) {
    const html = renderToStaticMarkup(React.createElement(Reference, { value }));
    assert.ok(html.endsWith(`>${value}</span>`), html);
    assert.ok(!html.includes("…"), html);
  }
});
test("references embedded in notices and document choices remain complete", () => {
  const value = "Recorded: TX-83ed29cbce8f4115b4ca9994b213c5c0 · SKU-A";
  assert.equal(renderToStaticMarkup(React.createElement(Reference, { value, embedded: true })), value);
});
