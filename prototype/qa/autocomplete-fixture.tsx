import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Operations } from "../src/Operations";
import { Master, Controls } from "../src/management";
import { Stock } from "../src/Stock";
import { initialState, MAIN, SECONDARY } from "../src/fixtures";
import { Field, Locale, Notice } from "../src/ui";
import "../src/styles.css";

const initial = initialState();
initial.products = initial.products.map((product, index) => ({
  ...product,
  category: index === 1 ? "Tools" : "Parts",
  unit: index === 1 ? "box" : "pcs",
  active: index !== 2,
}));
initial.receipts.push({
  id: "PO-QA-SECONDARY",
  sku: "SKU-B",
  ordered: 20,
  received: 0,
  warehouse: SECONDARY,
});

function Fixture() {
  const [data, setData] = useState(initial);
  const [route, setRoute] = useState("orders");
  const [warehouse, setWarehouse] = useState(MAIN);
  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState("light");
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [rejectSave, setRejectSave] = useState(false);
  const props = {
    data,
    setData: async (update) => {
      if (rejectSave) return false;
      setData((current) =>
        typeof update === "function" ? update(current) : update,
      );
      return true;
    },
    route,
    warehouse,
    user: { id: "qa", role: "admin" },
    locale,
    flash: setMessage,
    go: setRoute,
    ask: () => setMessage("Review reached. No transaction was posted."),
    draft: drafts[`${warehouse}|${route}`] || {},
    patchDraft: (patch) =>
      setDrafts((all) => ({
        ...all,
        [`${warehouse}|${route}`]: {
          ...all[`${warehouse}|${route}`],
          ...patch,
        },
      })),
    deleteItem: async () => false,
  };
  const lastOrder = data.orders.at(-1);
  return (
    <Locale.Provider value={locale}>
      <main style={{ padding: 16, maxWidth: 1440, margin: "auto" }}>
        <h1>Autocomplete QA fixture</h1>
        <Notice>
          Generated test data in memory. Reload resets changes. No API or
          database writes.
        </Notice>
        <div className="form-grid" style={{ margin: "16px 0" }}>
          <Field label="Workflow">
            <select
              value={route}
              onChange={(event) => setRoute(event.target.value)}
            >
              {[
                "orders",
                "receiving",
                "quality",
                "putaway",
                "cancellation",
                "transfers",
                "master",
                "stock",
                "movements",
                "tracking",
                "labels",
                "rfid",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Warehouse">
            <select
              value={warehouse}
              onChange={(event) => setWarehouse(event.target.value)}
            >
              <option>{MAIN}</option>
              <option>{SECONDARY}</option>
            </select>
          </Field>
          <Field label="Language">
            <select
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value);
                document.documentElement.lang = event.target.value;
              }}
            >
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </Field>
          <Field label="Theme">
            <select
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value);
                document.documentElement.dataset.theme = event.target.value;
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={rejectSave}
            onChange={(event) => setRejectSave(event.target.checked)}
          />
          Reject saves (QA error state)
        </label>
        {message && <Notice>{message}</Notice>}
        <output aria-label="Last saved order">
          {lastOrder.id}: {lastOrder.sku}, {lastOrder.qty} units
        </output>
        {route === "master" ? (
          <Master {...props} />
        ) : route === "stock" ? (
          <Stock {...props} />
        ) : ["movements", "tracking", "labels", "rfid"].includes(route) ? (
          <Controls {...props} />
        ) : (
          <Operations key={`${route}|${warehouse}`} {...props} />
        )}
      </main>
    </Locale.Provider>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
