import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

const { chromium } = await import(
  process.argv[2]
    ? pathToFileURL(path.resolve(process.argv[2])).href
    : "playwright"
);
const output = path.resolve("qa/bulk-selection-20261103");
await mkdir(output, { recursive: true });
const portProbe = net.createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const fixtureUrl = `http://127.0.0.1:${port}/qa/bulk-selection-fixture.html`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { windowsHide: true, stdio: "ignore" },
);
for (let attempt = 0; attempt < 80; attempt++) {
  try {
    if (
      (await fetch(fixtureUrl, { signal: AbortSignal.timeout(1000) })).ok
    )
      break;
  } catch {}
  if (attempt === 79) throw new Error("Fixture server did not start");
  await new Promise((resolve) => setTimeout(resolve, 250));
}
const browserServer = await chromium.launchServer({ headless: true, channel: "chrome" });
const browser = await chromium.connect(browserServer.wsEndpoint());
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/**", (route) => route.abort());
const open = async (screen = "master") => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Screen", { exact: true }).selectOption(screen);
  await page
    .getByRole("heading", { name: "Bulk selection QA fixture" })
    .waitFor();
};
const shot = (name) =>
  page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
const choose = (name) =>
  page.getByRole("checkbox", { name, exact: true }).check();
const confirm = async (reason) => {
  if (reason)
    await page
      .getByRole("dialog")
      .getByLabel("Reason (required)", { exact: true })
      .fill(reason);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm selected", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
};
const log = async () =>
  (await page.locator("main > details ol li").allTextContents()).join("\n");
const check = async (name, run) => {
  if (process.argv[3] && !name.startsWith(process.argv[3])) return;
  await run();
  console.log(`PASS ${name}`);
};

try {
  await check(
    "Master selection, mixed header and independent detail opening",
    async () => {
      await open();
      await choose("Select Fixture product 01 · SKU-01");
      assert.equal(
        await page
          .locator("thead input[type=checkbox]")
          .evaluate((el) => el.indeterminate),
        true,
      );
      await choose("Select Fixture product 02 · SKU-02");
      await page
        .getByRole("button", {
          name: "Edit Fixture product 01 (SKU-01)",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close dialog" })
        .click();
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Select Fixture product 01 · SKU-01",
            exact: true,
          })
          .isChecked(),
        true,
      );
      await shot("master-desktop");
    },
  );
  await check("Bulk deletion retains Yes/No confirmation without a reason field", async () => {
    await page.getByRole("button", { name: "Delete selected (2)", exact: true }).click();
    assert.equal(await page.getByRole("dialog").getByLabel("Reason (required)", { exact: true }).count(), 0);
    await page.getByRole("dialog").getByRole("button", { name: "Yes", exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "No", exact: true }).click();
    assert.equal(await page.locator("tbody input:checked").count(), 2);
    assert.equal(await log(), "");
  });
  await check(
    "Master partial conflicts retain the failed row and reason",
    async () => {
      await page
        .getByLabel("Simulate second-item conflict", { exact: true })
        .check();
      await page
        .getByRole("button", { name: "Deactivate selected (2)", exact: true })
        .click();
      await confirm("Fixture deactivation");
      await page
        .getByText("Completed 1 · Failed 1 · Pending 0 · Skipped 0", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Select Fixture product 02 · SKU-02",
            exact: true,
          })
          .isChecked(),
        true,
      );
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Select Fixture product 01 · SKU-01",
            exact: true,
          })
          .isChecked(),
        false,
      );
      assert.match(await log(), /master-status:SKU-01\s+master-status:SKU-02/);
    },
  );
  await check(
    "Master pagination and filters clear page-local selection",
    async () => {
      await page
        .getByRole("button", { name: "Next catalogue page", exact: true })
        .click();
      assert.equal(await page.locator(".bulk-toolbar").count(), 0);
      await choose("Select all on this page");
      assert.equal(await page.locator("tbody input:checked").count(), 10);
      await page
        .locator(".catalogue-toolbar input[type=search]")
        .fill("Fixture product 21");
      await page
        .getByText("Fixture product 21", { exact: true })
        .first()
        .waitFor();
      assert.equal(await page.locator("tbody input:checked").count(), 0);
    },
  );
  await check(
    "A live row removal cannot be dispatched from an already open review",
    async () => {
      await open();
      await choose("Select Fixture product 01 · SKU-01");
      await choose("Select Fixture product 02 · SKU-02");
      await page
        .getByRole("button", { name: "Deactivate selected (2)", exact: true })
        .click();
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("fixture-remove-item", { detail: "SKU-01" }),
        ),
      );
      await confirm("Live selection regression");
      await page
        .getByText("Completed 1 · Failed 0 · Pending 0 · Skipped 1", {
          exact: true,
        })
        .waitFor();
      assert.equal((await log()).trim(), "master-status:SKU-02");
    },
  );
  await check(
    "A review does not reappear when the access scope changes and returns",
    async () => {
      await open();
      await choose("Select Fixture product 01 · SKU-01");
      await page
        .getByRole("button", { name: "Deactivate selected (1)", exact: true })
        .click();
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("fixture-role", { detail: "supervisor" }),
        ),
      );
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("fixture-role", { detail: "admin" }),
        ),
      );
      assert.equal(await page.getByRole("dialog").count(), 0);
    },
  );
  await check(
    "Stock exports matching positions including restrictions",
    async () => {
      await open("stock");
      await choose("Select Fixture product 01 · SKU-01");
      await page
        .getByRole("button", { name: "Export selected stock (1)", exact: true })
        .click();
      const downloading = page.waitForEvent("download");
      await confirm();
      const download = await downloading;
      await download.saveAs(path.join(output, "selected-stock.csv"));
      const csv = await readFile(
        path.join(output, "selected-stock.csv"),
        "utf8",
      );
      assert.equal(csv.trim().split("\r\n").length, 3);
      assert.match(
        csv,
        /"QC","not-good","quality-rejected","false","false","12","0","0"/,
      );
      assert.doesNotMatch(csv, /SKU-02/);
      await choose("Select all on this page");
      await shot("stock-desktop");
    },
  );
  await check(
    "Labels download a single sheet for exactly the selected items",
    async () => {
      await open("labels");
      await choose("Select Fixture product 01 · SKU-01");
      await choose("Select Fixture product 02 · SKU-02");
      await page
        .getByRole("button", {
          name: "Download selected labels (2)",
          exact: true,
        })
        .click();
      const downloading = page.waitForEvent("download");
      await confirm();
      const download = await downloading;
      await download.saveAs(path.join(output, "item-labels.html"));
      const html = await readFile(
        path.join(output, "item-labels.html"),
        "utf8",
      );
      assert.equal((html.match(/<article>/g) || []).length, 2);
      assert.match(html, /data:image\/png;base64/);
      assert.match(await log(), /labelHistory:SKU-01\s+labelHistory:SKU-02/);
      await shot("labels-desktop");
    },
  );
  await check(
    "A failed file output retains selection and reports no successful export",
    async () => {
      await open("stock");
      await choose("Select Fixture product 01 · SKU-01");
      await page
        .getByRole("button", { name: "Export selected stock (1)", exact: true })
        .click();
      await page.evaluate(() => {
        URL.createObjectURL = () => {
          throw new Error("Fixture output failure");
        };
      });
      await confirm();
      await page
        .getByText("Completed 0 · Failed 1 · Pending 0 · Skipped 0", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Select Fixture product 01 · SKU-01",
            exact: true,
          })
          .isChecked(),
        true,
      );
    },
  );
  await check(
    "Orders keep submit, approval and release distinct, exclude own review",
    async () => {
      await open("orders");
      await choose("Select all on this page");
      assert.equal(await page.locator("tbody input:checked").count(), 8);
      await page
        .getByRole("button", {
          name: "Approve selected orders (3)",
          exact: true,
        })
        .click();
      await confirm();
      await page
        .getByText("Completed 3 · Failed 0 · Pending 0 · Skipped 5", {
          exact: true,
        })
        .waitFor();
      const calls = await log();
      assert.match(calls, /approve-order:ORDER-02/);
      assert.match(calls, /approve-order:ORDER-06/);
      assert.match(calls, /approve-order:ORDER-10/);
      assert.doesNotMatch(calls, /release-order|reserve|ORDER-04|ORDER-08/);
      await shot("orders-desktop");
    },
  );
  await check("An unknown order outcome stops later requests", async () => {
    await open("orders");
    await page.getByLabel("Simulate unknown outcome", { exact: true }).check();
    await choose("Select ORDER-03 · Fixture product 03");
    await choose("Select ORDER-07 · Fixture product 07");
    await page
      .getByRole("button", { name: "Release selected orders (2)", exact: true })
      .click();
    await confirm();
    await page
      .getByText("Completed 0 · Failed 0 · Pending 1 · Skipped 1", {
        exact: true,
      })
      .waitFor();
    assert.equal((await log()).trim(), "release-order:ORDER-03");
  });
  await check(
    "Access approvals skip unverified requests and do not approve self",
    async () => {
      await open("access");
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Select Fixture Admin · admin@example.invalid",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Pending approvals (2)", exact: true })
        .click();
      await choose("Select all on this page");
      await page
        .getByRole("button", {
          name: "Approve selected access (1)",
          exact: true,
        })
        .click();
      await confirm("Fixture approval");
      await page
        .getByText("Completed 1 · Failed 0 · Pending 0 · Skipped 1", {
          exact: true,
        })
        .waitFor();
      assert.equal((await log()).trim(), "access-status:pending-1");
      await shot("access-desktop");
    },
  );
  await check(
    "Pending recovery separates unsent from unknown and keeps original IDs",
    async () => {
      await open("pending");
      await choose("Select all on this page");
      await page
        .getByRole("button", {
          name: "Send selected unsent requests (1)",
          exact: true,
        })
        .click();
      await confirm();
      assert.equal((await log()).trim(), "recover:REQUEST-1");
      await page
        .getByRole("button", {
          name: "Check selected unknown requests (1)",
          exact: true,
        })
        .click();
      await confirm();
      assert.match(await log(), /recover:REQUEST-1\s+recover:REQUEST-2/);
      await shot("pending-desktop");
    },
  );
  await check(
    "ERP retries preserve event IDs and skip acknowledged events",
    async () => {
      await open("integration");
      assert.equal(
        await page
          .getByRole("checkbox", { name: "Select EVENT-3", exact: true })
          .isDisabled(),
        true,
      );
      await choose("Select all on this page");
      await page
        .getByRole("button", { name: "Retry selected events (2)", exact: true })
        .click();
      await confirm();
      assert.match(await log(), /erp-retry:EVENT-1\s+erp-retry:EVENT-2/);
      assert.doesNotMatch(await log(), /EVENT-3/);
      await shot("erp-desktop");
    },
  );
  await check(
    "RFID selection only excludes unresolved simulation observations",
    async () => {
      await open("rfid");
      await page
        .getByRole("button", { name: "Start capture", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Simulate reader batch", exact: true })
        .click();
      await page
        .getByRole("button", { name: "End capture", exact: true })
        .click();
      await choose("Select all on this page");
      assert.equal(await page.locator("tbody input:checked").count(), 2);
      await page
        .getByRole("button", {
          name: "Exclude selected observations (2)",
          exact: true,
        })
        .click();
      await confirm("Fixture unexpected tags");
      assert.equal(
        await page.getByText("Excluded with reason", { exact: true }).count(),
        2,
      );
      assert.equal((await log()).trim(), "");
      await shot("rfid-desktop");
    },
  );
  await check(
    "Mobile and dark Indonesian layouts keep overflow within tables",
    async () => {
      await open();
      await page.setViewportSize({ width: 390, height: 844 });
      await choose("Select Fixture product 01 · SKU-01");
      const keyboardCheckbox = page.getByRole("checkbox", { name: "Select Fixture product 01 · SKU-01", exact: true });
      await keyboardCheckbox.focus();
      await keyboardCheckbox.press("Space");
      assert.equal(await keyboardCheckbox.isChecked(), false);
      await keyboardCheckbox.press("Space");
      assert.equal(await keyboardCheckbox.isChecked(), true);
      await page.getByLabel("Language", { exact: true }).selectOption("id");
      await page.getByLabel("Theme", { exact: true }).selectOption("dark");
      assert.equal(
        await page
          .getByRole("checkbox", {
            name: "Pilih Fixture product 01 · SKU-01",
            exact: true,
          })
          .isChecked(),
        true,
      );
      await shot("master-phone-dark-id");
      const scrollRegion = page.locator(".catalogue-table .table-wrap");
      await scrollRegion.focus();
      await scrollRegion.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector(".catalogue-table .table-wrap").scrollLeft > 0);
      await scrollRegion.evaluate(el => { el.scrollLeft = 0; });
      console.log("PASS Keyboard checkbox and region scrolling");
      assert.equal(await page.locator('.catalogue-table tbody tr').first().evaluate(el => getComputedStyle(el).display), 'table-row');
      assert.equal(await page.locator('.catalogue-table tbody .column-name').first().evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.left < innerWidth && getComputedStyle(el).display === 'table-cell'; }), true);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        true,
      );
      await page.getByLabel("Screen", { exact: true }).selectOption("stock");
      await choose("Pilih semua di halaman ini");
      await shot("stock-phone-dark-id");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        true,
      );
      await page.getByLabel("Screen", { exact: true }).selectOption("orders");
      await choose("Pilih semua di halaman ini");
      await shot("orders-phone-dark-id");
      for (const screen of ["labels", "access", "pending", "integration", "rfid"]) {
        await page.getByLabel("Screen", { exact: true }).selectOption(screen);
        if (screen === "rfid") { await page.getByRole("button", { name: "Mulai baca", exact: true }).click(); await page.getByRole("button", { name: "Simulasikan batch reader", exact: true }).click(); await page.getByRole("button", { name: "Akhiri baca", exact: true }).click(); }
        await choose("Pilih semua di halaman ini");
        assert.equal(await page.locator(".has-bulk-selection tbody tr").first().evaluate(el => getComputedStyle(el).display), "table-row");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
        await shot(`${screen}-phone-dark-id`);
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        true,
      );
    },
  );
  assert.deepEqual(errors, []);
  console.log("PASS no browser runtime errors; no API writes");
} finally {
  await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  for (const child of [browserServer.process(), server]) {
    if (child.exitCode === null) {
      const stop = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      await new Promise(resolve => stop.once('close', resolve));
    }
    child.unref();
  }
}
