import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Operations } from "../src/Operations";
import { Master } from "../src/management";
import { initialState, MAIN } from "../src/fixtures";
import { Button, Field, Locale, Notice } from "../src/ui";
import "../src/styles.css";

const initial = initialState();
initial.receipts = Array.from({ length: 32 }, (_, index) => ({
  id: `PO-SIM-${100 + index}`,
  sku: `SKU-${index % 2 ? "B" : "A"}`,
  ordered: 100,
  received: index % 3 === 0 ? 60 : index % 3 === 1 ? 0 : 100,
  warehouse: MAIN,
}));
initial.inspections = Array.from({ length: 22 }, (_, index) => ({
  id: `QC-SIM-${100 + index}`,
  sku: "SKU-A",
  remaining: 60,
  source: `PO-SIM-${100 + index}`,
  warehouse: MAIN,
}));
initial.putaways = Array.from({ length: 16 }, (_, index) => ({
  id: `PUT-SIM-${100 + index}`,
  sku: "SKU-A",
  remaining: 50,
  source: `QC-SIM-${100 + index}`,
  warehouse: MAIN,
}));
initial.counts = [{
  id: "COUNT-QA-1", sku: "SKU-A", location: "A-01", warehouse: MAIN,
  expected: 100, actual: 98, status: "review", counter: "operator",
}];

function Fixture() {
  const [data, setData] = useState(initial);
  const [route, setRoute] = useState("receiving");
  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState("light");
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  return (
    <Locale.Provider value={locale}>
      <main style={{ padding: 16, maxWidth: 1440, margin: "auto" }}>
        <h1>Document catalogue QA fixture</h1>
        <Notice>
          Generated sample data in memory. No API or database writes. This is a
          UI test fixture, not operational data.
        </Notice>
        <div className="form-grid" style={{ margin: "20px 0" }}>
          <Field label="Workflow">
            <select
              value={route}
              onChange={(event) => setRoute(event.target.value)}
            >
              {[
                "receiving",
                "quality",
                "putaway",
                "orders",
                "reservations",
                "picking",
                "shipping",
                "count",
                "master",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
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
          <Button
            onClick={() => setData((current) => ({ ...current, receipts: [] }))}
          >
            Empty purchase orders
          </Button>
        </div>
        {message && <Notice>{message}</Notice>}
        {route === "master" ? (
          <Master
            data={data}
            setData={setData}
            user={{ id: "qa", role: "admin" }}
            flash={setMessage}
            deleteItem={async () => false}
          />
        ) : (
          <Operations
            route={route}
            data={data}
            setData={setData}
            warehouse={MAIN}
            user={{ id: "qa", role: "admin" }}
            go={setRoute}
            ask={() =>
              setMessage(
                "Review action reached. Transaction confirmation is disabled in this fixture.",
              )
            }
            flash={setMessage}
            draft={drafts[route] || {}}
            patchDraft={(patch) =>
              setDrafts((current) => ({
                ...current,
                [route]: { ...current[route], ...patch },
              }))
            }
          />
        )}
      </main>
    </Locale.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
