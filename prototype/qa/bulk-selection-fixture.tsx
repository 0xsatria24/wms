import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Master, Access } from "../src/management";
import { Stock } from "../src/Stock";
import { Operations } from "../src/Operations";
import { Controls } from "../src/controls";
import { initialState, MAIN } from "../src/fixtures";
import { Locale, Notice, Field } from "../src/ui";
import "../src/styles.css";

const seed: any = initialState();
seed.products = Array.from({ length: 34 }, (_, i) => ({
  ...seed.products[i % 3],
  sku: `SKU-${String(i + 1).padStart(2, "0")}`,
  name: `Fixture product ${String(i + 1).padStart(2, "0")}`,
  barcode: `000100000${String(i + 1).padStart(3, "0")}`,
  active: i !== 2,
  version: 1,
}));
seed.positions = seed.products.map((row, i) => ({
  sku: row.sku,
  warehouse: MAIN,
  location: i % 2 ? "A-02" : "A-01",
  qty: 100,
  reserved: 10,
  condition: "good",
  hold: "",
  frozen: false,
  lastMovementAt: "2026-11-03T02:00:00Z",
}));
seed.positions.push({
  ...seed.positions[0],
  location: "QC",
  qty: 12,
  reserved: 0,
  condition: "not-good",
  hold: "quality-rejected",
});
seed.orders = Array.from({ length: 14 }, (_, i) => ({
  id: `ORDER-${String(i + 1).padStart(2, "0")}`,
  sku: seed.products[i].sku,
  warehouse: MAIN,
  qty: 20,
  status: ["draft", "pending-approval", "approved", "pending-approval"][i % 4],
  creator: i % 4 === 3 ? "qa-admin" : "qa-operator",
  allocations: {},
  picked: 0,
  shipped: 0,
  returned: 0,
  version: 1,
}));
seed.users = [
  {
    id: "qa-admin",
    name: "Fixture Admin",
    email: "admin@example.invalid",
    role: "admin",
    warehouses: [MAIN],
    status: "active",
    verified: true,
  },
  {
    id: "active-1",
    name: "Fixture Operator",
    email: "operator@example.invalid",
    role: "operator",
    warehouses: [MAIN],
    status: "active",
    verified: true,
  },
  {
    id: "pending-1",
    name: "Verified Request",
    email: "verified@example.invalid",
    role: "viewer",
    warehouses: [],
    status: "pending",
    verified: true,
  },
  {
    id: "pending-2",
    name: "Unverified Request",
    email: "unverified@example.invalid",
    role: "viewer",
    warehouses: [],
    status: "pending",
    verified: false,
  },
];
seed.events = ["pending", "failed", "acknowledged"].map((transport, i) => ({
  id: `EVENT-${i + 1}`,
  warehouse: MAIN,
  transport,
  business: "pending",
  source: `TX-${i + 1}`,
  attempts: i,
  createdAt: "2026-11-03T02:00:00Z",
}));
seed.pending = ["offline", "unknown"].map((status, i) => ({
  id: `REQUEST-${i + 1}`,
  status,
  created: "2026-11-03T02:00:00Z",
  request: {
    type: "approve-order",
    user: "qa-admin",
    warehouse: MAIN,
    payload: { order: `ORDER-${i + 1}` },
  },
}));

function Fixture() {
  const [data, setData] = useState(seed);
  const [route, setRoute] = useState("master");
  const [locale, setLocale] = useState("en");
  const [role, setRole] = useState("admin");
  const [theme, setTheme] = useState("light");
  const [fail, setFail] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [draft, setDraft] = useState({});
  useEffect(() => {
    const remove = (event: CustomEvent) =>
      setData((current) => ({
        ...current,
        products: current.products.filter((row) => row.sku !== event.detail),
      }));
    const roleChange = (event: CustomEvent) => setRole(event.detail);
    window.addEventListener("fixture-remove-item", remove);
    window.addEventListener("fixture-role", roleChange);
    return () => {
      window.removeEventListener("fixture-remove-item", remove);
      window.removeEventListener("fixture-role", roleChange);
    };
  }, []);
  const user = { ...data.users[0], role };
  const editRecord = async (type, payload) => {
    setLog((rows) => [...rows, `${type}:${payload.sku || payload.id || ""}`]);
    if (fail && (payload.sku === "SKU-02" || payload.id === "ORDER-02"))
      throw Object.assign(new Error("conflict"), { status: 409 });
    setData((current) => {
      if (type === "master-status")
        return {
          ...current,
          products: current.products.map((row) =>
            row.sku === payload.sku
              ? { ...row, ...payload, version: row.version + 1 }
              : row,
          ),
        };
      if (type === "delete-master")
        return {
          ...current,
          products: current.products.filter((row) => row.sku !== payload.sku),
        };
      if (type === "access-status")
        return {
          ...current,
          users: current.users.map((row) =>
            row.id === payload.id ? { ...row, ...payload } : row,
          ),
        };
      if (type === "submit-order")
        return {
          ...current,
          orders: current.orders.map((row) =>
            row.id === payload.id
              ? { ...row, status: "pending-approval" }
              : row,
          ),
        };
      return current;
    });
  };
  const bulkCommand = async (type, payload) => {
    setLog((rows) => [...rows, `${type}:${payload.order || payload.event}`]);
    if (unknown) return { status: "pending" as const, message: "unknown" };
    setData((current) => ({
      ...current,
      orders: current.orders.map((row) =>
        row.id === payload.order
          ? {
              ...row,
              status:
                {
                  "approve-order": "approved",
                  "reject-order": "rejected",
                  "release-order": "released",
                }[type] || row.status,
            }
          : row,
      ),
    }));
  };
  const props = {
    data,
    setData,
    route,
    user,
    warehouse: MAIN,
    locale,
    editRecord,
    bulkCommand,
    refresh: async () => {},
    recoverRequest: async (id) => {
      setLog((rows) => [...rows, `recover:${id}`]);
      if (unknown) return { status: "pending" as const, message: "unknown" };
      setData((current) => ({
        ...current,
        pending: current.pending.filter((row) => row.id !== id),
      }));
    },
    go: setRoute,
    flash: () => {},
    ask: () => {},
    createUser: () => {},
    deleteUser: () => {},
    deleteItem: () => {},
    checkPending: () => {},
    draft,
    patchDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    authMode: "development-demo",
  };
  document.documentElement.dataset.theme = theme;
  return (
    <Locale.Provider value={locale}>
      <main style={{ padding: 16, maxWidth: 1440, margin: "auto" }}>
        <h1>Bulk selection QA fixture</h1>
        <Notice>
          Generated fixture data only. Actions stay in memory; no API or
          database writes.
        </Notice>
        <div className="filter-bar">
          <Field label="Screen">
            <select value={route} onChange={(e) => setRoute(e.target.value)}>
              {[
                "master",
                "stock",
                "labels",
                "orders",
                "access",
                "pending",
                "integration",
                "rfid",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </Field>
          <Field label="Theme">
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option>light</option>
              <option>dark</option>
            </select>
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {["admin", "supervisor", "operator", "viewer"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />
            Simulate second-item conflict
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={unknown}
              onChange={(e) => setUnknown(e.target.checked)}
            />
            Simulate unknown outcome
          </label>
        </div>
        {route === "master" ? (
          <Master {...props} />
        ) : route === "stock" ? (
          <Stock {...props} />
        ) : route === "access" ? (
          <Access {...props} />
        ) : route === "orders" ? (
          <Operations {...props} />
        ) : (
          <Controls key={route} {...props} />
        )}
        <details>
          <summary>Fixture request log ({log.length})</summary>
          <ol>
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
      </main>
    </Locale.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
