const { chromium } = require("C:/Users/muham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const folder = path.resolve(__dirname, "..");
const report = { scope: "User-reference ERP design-system prototype", direction: "Supplied ERP screenshot with Ledger calm tone", checks: [], contrast: [], responsive: [], pageErrors: [], consoleErrors: [], networkRequests: [], productionUatRun: false };
const pass = (name) => report.checks.push({ name, status: "PASS" });
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.on("request", (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") report.networkRequests.push(request.url()); });
    await page.goto("http://127.0.0.1:8873");
    await page.waitForSelector("[data-row='r1']");
    assert.equal(await page.locator("#selection-count").innerText(), "3");
    assert.equal(await page.locator(".selected-row").count(), 3);
    await page.screenshot({ path: path.join(__dirname, "erp-desktop.png"), fullPage: true });
    pass("Reference layout loads with three selected simulated positions and no external requests");

    const reset = async () => {
      const openDialog = page.locator("dialog[open]");
      if (await openDialog.count()) await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('[data-view="settings"]').click();
      await page.locator("#reset-demo").click();
      await page.locator('[data-view="operations"]').click();
    };
    const cell = (id, key) => page.locator(`[data-row="${id}"] [data-label="${key}"]`);
    const receipt = async (quantity = "10", quality = "Layak") => {
      await page.locator("#receive-open").click();
      await page.locator("#receive-quantity").fill(quantity);
      await page.locator("#receive-quality").selectOption(quality);
      await page.locator('#receive-form button[type="submit"]').click();
      await page.locator("#confirm-receipt").click();
    };
    const setTransport = async (transport) => {
      await page.locator('[data-view="settings"]').click();
      await page.locator("#transport").selectOption(transport);
      await page.locator("#back-operations").click();
    };

    await page.locator("#clear-selection").click();
    await page.locator('[data-select-row="r1"]').check();
    assert.equal(await page.locator("#selection-count").innerText(), "1");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.selectRow), "r1");
    await page.locator("#reserve-open").click();
    await page.locator("#reserve-quantity").fill("61");
    await page.locator('#reserve-form button[type="submit"]').click();
    assert(await page.locator("#reserve-error").isVisible());
    await page.locator("#reserve-quantity").fill("2");
    await page.locator('#reserve-form button[type="submit"]').click();
    assert.match(await cell("r1", "Komitmen").innerText(), /2,00/);
    assert.match(await cell("r1", "Fisik").innerText(), /60,00/);
    pass("Row selection preserves keyboard focus; reservation validates available quantity and preserves physical stock");

    await page.locator("#bulk-open").click();
    await page.locator("#quarantine-review").click();
    await page.locator("#apply-bulk").click();
    assert.match(await cell("r1", "Kondisi").innerText(), /Karantina/);
    assert.match(await cell("r1", "Bebas").innerText(), /0,00/);
    assert.match(await cell("r1", "Komitmen").innerText(), /2,00/);
    assert(await page.locator("#reserve-open").isDisabled());
    await page.locator("#bulk-open").click();
    await page.locator("#release-review").click();
    await page.locator("#apply-bulk").click();
    assert.match(await cell("r1", "Komitmen").innerText(), /0,00/);
    pass("QC hold preserves physical stock and commitment; release changes commitment only");

    await reset();
    await page.locator('#desktop-filters [data-filter-kind="location"][data-filter-value="Rak A-01"]').click();
    assert.equal(await page.locator("tbody tr[data-row]").count(), 3);
    await page.locator("#select-page").check();
    assert.equal(await page.locator("#selection-count").innerText(), "3");
    await page.locator("#search").fill("Papan");
    assert.equal(await page.locator("tbody tr[data-row]").count(), 1);
    assert(await page.locator("#selection-bar").isHidden());
    await page.locator("#search").fill("NO-MATCH");
    assert.match(await page.locator("#view").innerText(), /Tidak ada posisi stok yang cocok/);
    await page.locator("[data-recover]").click();
    assert.equal(await page.locator("tbody tr[data-row]").count(), 10);
    pass("Location filter, select-page, search, filtered-empty recovery and selection clearing work");

    await page.locator('[data-sort="physical"]').click();
    assert.equal(await page.locator('th[aria-sort="ascending"] button').getAttribute("data-sort"), "physical");
    await page.locator('[data-sort="physical"]').click();
    assert.equal(await page.locator('th[aria-sort="descending"] button').getAttribute("data-sort"), "physical");
    await page.locator("#next").click();
    assert.match(await page.locator("#page-range").innerText(), /11-12/);
    await page.locator("#previous").click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "persediaan-simulasi.csv");
    const csv = fs.readFileSync(await download.path(), "utf8");
    assert.equal(csv.split(/\r?\n/).length, 13);
    pass("Numeric sorting, pagination and CSV export reflect the simulated filtered dataset");

    await page.locator('[data-detail="r1"]').click();
    assert.match(await page.locator("#action-content").innerText(), /Fisik/);
    for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); assert(await page.evaluate(() => document.getElementById("action-dialog").contains(document.activeElement))); }
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.detail), "r1");
    await page.locator('[data-history="SIM-001"]').first().click();
    assert.match(await page.locator("#view-title").innerText(), /Kartu stok/);
    await page.locator("[data-event]").first().click();
    assert.match(await page.locator("#action-content").innerText(), /Referensi|SIM-OPEN/);
    await page.keyboard.press("Escape");
    await page.locator("#clear-report-filter").click();
    await page.locator('[data-view="products"]').click();
    assert.equal(await page.locator("[data-product-stock]").count(), 6);
    await page.locator('[data-product-stock="SIM-003"]').click();
    assert.equal(await page.locator("#search").inputValue(), "SIM-003");
    await page.locator('[data-view="overview"]').click();
    assert.match(await page.locator("#view-title").innerText(), /Perlu ditinjau/);
    pass("Every module has a working view; detail/history links resolve; dialog Tab and Escape restore focus");

    await reset();
    await page.locator("#receive-open").click();
    await page.locator("#receive-quantity").fill("101");
    await page.locator('#receive-form button[type="submit"]').click();
    assert(await page.locator("#receive-error").isVisible());
    await page.keyboard.press("Escape");
    await receipt("10");
    assert.match(await cell("r1", "Fisik").innerText(), /70,00/);
    assert.match(await page.locator("#notification-body").innerText(), /SIM-RECEIPT-/);
    pass("Receiving reviews source, actual and condition; excessive quantity is rejected in the local simulation");

    await reset();
    await setTransport("unknown");
    await receipt("10");
    const lostId = (await page.locator("#notification-body").innerText()).match(/SIM-RECEIPT-\d+/)[0];
    assert.match(await page.locator("#notification-title").innerText(), /belum diketahui/);
    await page.locator("#receive-open").click();
    await page.locator("#retry-receipt").click();
    assert.match(await page.locator("#notification-body").innerText(), new RegExp(lostId));
    assert.match(await cell("r1", "Fisik").innerText(), /70,00/);
    pass("Unknown outcome reuses the simulated intent and does not add stock a second time");

    await reset();
    await setTransport("offline");
    await receipt("10");
    assert.match(await cell("r1", "Fisik").innerText(), /60,00/);
    await page.locator("#receive-open").click();
    assert(await page.locator("#retry-receipt").isDisabled());
    await page.keyboard.press("Escape");
    await setTransport("online");
    await page.locator("#receive-open").click();
    await page.locator("#retry-receipt").click();
    assert.match(await cell("r1", "Fisik").innerText(), /70,00/);
    pass("Offline capture remains pending until connection changes and the same intent is sent");

    await reset();
    await receipt("10", "Karantina");
    assert.match(await page.locator("#notification-body").innerText(), /belum tersedia untuk alokasi/);
    pass("Receiving into quarantine is allowed and clearly remains unavailable for allocation");

    for (const appearance of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-appearance") !== appearance) await page.locator("#appearance").click();
      const colors = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return Object.fromEntries(["canvas", "surface", "surface-alt", "ink", "ink-muted", "action", "on-action", "accent", "accent-soft", "selection", "line", "focus", "warning", "warning-soft", "danger", "danger-soft", "success", "success-soft"].map((name) => [name, styles.getPropertyValue(`--${name}`).trim()]));
      });
      for (const [fg, bg] of [["ink", "surface"], ["ink", "canvas"], ["ink", "surface-alt"], ["ink", "selection"], ["ink-muted", "surface"], ["ink-muted", "surface-alt"], ["ink-muted", "selection"], ["accent", "surface"], ["accent", "selection"], ["accent", "accent-soft"], ["on-action", "action"], ["warning", "warning-soft"], ["warning", "selection"], ["danger", "danger-soft"], ["success", "success-soft"]]) {
        const value = contrast(colors[fg], colors[bg]); report.contrast.push({ appearance, fg, bg, foreground: colors[fg], background: colors[bg], ratio: Number(value.toFixed(3)), required: 4.5 }); assert(value >= 4.5, `${appearance}: ${fg}/${bg} = ${value}`);
      }
      for (const fg of ["line", "focus"]) for (const bg of ["surface", "surface-alt", "canvas"]) {
        const value = contrast(colors[fg], colors[bg]); report.contrast.push({ appearance, fg, bg, foreground: colors[fg], background: colors[bg], ratio: Number(value.toFixed(3)), required: 3 }); assert(value >= 3, `${appearance}: ${fg}/${bg} = ${value}`);
      }
      for (const width of [1440, 1280, 1024, 820, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of ["operations", "products", "reporting", "settings"]) {
          if (width <= 736 && await page.locator("#module-nav").isHidden()) await page.locator("#mobile-menu").click();
          await page.locator(`[data-view="${view}"]`).click();
          const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
          report.responsive.push({ appearance, width, view, ...geometry });
          assert(geometry.page <= geometry.viewport, `Overflow ${appearance}/${view}/${width}: ${JSON.stringify(geometry)}`);
          const tooSmall = await page.locator("button:visible, input:visible, select:visible, summary:visible").evaluateAll((nodes) => nodes.filter((node) => {
            const target = node.matches('[type="checkbox"]') ? node.closest("label") : node;
            const box = target.getBoundingClientRect(); return box.width < 43.9 || box.height < 43.9;
          }).map((node) => node.id || node.textContent.trim()));
          assert.deepEqual(tooSmall, [], `Targets below 44px: ${JSON.stringify(tooSmall)}`);
        }
      }
    }
    pass("Both appearances: text/control contrast measured and all visible controls or associated labels checked for 44px hit areas");
    pass("Four module views reflow at 1440, 1280, 1024, 820, 390 and 320px without horizontal page overflow");

    await reset();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    for (const width of [820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
      assert(geometry.page <= geometry.viewport, `200% text overflow at ${width}: ${JSON.stringify(geometry)}`);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    pass("200% text resizing reflows at tablet and narrow mobile widths");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#filters-open").click();
    await page.locator('#mobile-filters [data-filter-kind="condition"][data-filter-value="Karantina"]').click();
    await page.getByRole("button", { name: "Lihat hasil", exact: true }).click();
    assert.equal(await page.locator("tbody tr[data-row]").count(), 2);
    await page.locator("#mobile-menu").click();
    await page.locator('[data-view="products"]').click();
    assert(await page.locator("#module-nav").isHidden());
    pass("Mobile filter dialog and module menu work and return to the data");

    await reset();
    await page.locator("#catalog-open").click();
    assert.equal(await page.locator("#token-list > div").count(), 6);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "catalog-open");
    await page.locator("body").click({ position: { x: 10, y: 800 } });
    await page.keyboard.press("/");
    assert.equal(await page.evaluate(() => document.activeElement.id), "search");
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle, width: parseFloat(getComputedStyle(document.activeElement).outlineWidth) }));
    assert(focus.style !== "none" && focus.width >= 3);
    pass("Catalog dialog, Escape focus restoration, search shortcut and visible keyboard focus work");

    await page.reload();
    await page.waitForSelector("[data-row='r1']");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(__dirname, "erp-desktop.png"), fullPage: true });
    await page.locator("#appearance").click();
    await page.screenshot({ path: path.join(__dirname, "erp-dark.png"), fullPage: true });
    await page.locator("#appearance").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, "erp-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#catalog-open").click();
    await page.screenshot({ path: path.join(__dirname, "erp-components.png"), fullPage: true });
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.networkRequests, []);
    report.status = "PASS";
    report.minimumTextContrast = Math.min(...report.contrast.filter((pair) => pair.required === 4.5).map((pair) => pair.ratio));
    report.minimumControlFocusContrast = Math.min(...report.contrast.filter((pair) => pair.required === 3).map((pair) => pair.ratio));
    fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ status: report.status, interactionChecks: report.checks.length, contrastPairs: report.contrast.length, responsiveChecks: report.responsive.length, minimumTextContrast: report.minimumTextContrast, minimumControlFocusContrast: report.minimumControlFocusContrast }, null, 2) + "\n");
  } catch (error) {
    report.status = "FAIL"; report.error = String(error.stack || error); fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(report, null, 2) + "\n"); throw error;
  } finally { await browser.close(); }
})().catch((error) => { process.stderr.write(String(error.stack || error) + "\n"); process.exitCode = 1; });
