import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Stock } from "../src/Stock";
import { initialState, MAIN } from "../src/fixtures";
import { Locale } from "../src/ui";
import "../src/styles.css";

const sample = initialState();
sample.positions = [
  { ...sample.positions[0], qty: 126, reserved: 0, frozen: true },
  { ...sample.positions[1], sku: "SKU-A", reserved: 0 },
  { ...sample.positions[2], sku: "SKU-A", qty: 24, reserved: 24 },
  sample.positions[1],
  sample.positions[2],
];

function Fixture() {
  const [locale, setLocale] = useState("en");
  const [workspaceWidth, setWorkspaceWidth] = useState(1310);
  const [scenario, setScenario] = useState("screenshot");
  const extraProducts =
    scenario === "pagination"
      ? Array.from({ length: 12 }, (_, i) => ({
          ...sample.products[0],
          sku: `QA-${i}`,
          name: `QA item ${i}`,
        }))
      : [];
  const extraPositions =
    scenario === "comparison"
      ? [
          {
            ...sample.positions[0],
            sku: "SKU-B",
            location: "A-02",
            frozen: false,
            qty: 12,
            reserved: 1,
          },
        ]
      : scenario === "pagination"
        ? extraProducts.map((product) => ({
            ...sample.positions[0],
            sku: product.sku,
          }))
        : scenario === "mixed-units"
          ? [
              {
                ...sample.positions[0],
                location: "A-02",
                frozen: false,
                unit: "boxes",
                qty: 3,
                reserved: 1,
              },
            ]
          : [];
  return (
    <Locale.Provider value={locale}>
      <header
        style={{ padding: 16, display: "flex", gap: 16, flexWrap: "wrap" }}
      >
        <strong>Stock spacing review · simulation only</strong>
        <label>
          Scenario{" "}
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
          >
            <option value="screenshot">Screenshot data</option>
            <option value="comparison">Compare two items</option>
            <option value="pagination">Multiple pages</option>
            <option value="mixed-units">Mixed units</option>
          </select>
        </label>
        <label>
          Language{" "}
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="en">English</option>
            <option value="id">Bahasa Indonesia</option>
          </select>
        </label>
        <label>
          Theme{" "}
          <select
            onChange={(event) => {
              document.documentElement.dataset.theme = event.target.value;
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Workspace width{" "}
          <select
            value={workspaceWidth}
            onChange={(event) => setWorkspaceWidth(Number(event.target.value))}
          >
            <option value={1310}>Wide</option>
            <option value={1024}>With desktop sidebar</option>
          </select>
        </label>
      </header>
      <main
        className="stock-spacing-review"
        style={{ padding: 16, maxWidth: workspaceWidth, margin: "auto" }}
      >
        <Stock
          data={{
            ...sample,
            products: [...sample.products, ...extraProducts],
            positions: [...sample.positions, ...extraPositions],
          }}
          setData={async () => false}
          warehouse={MAIN}
          user={{ role: "operator" }}
          go={() => {}}
          ask={() => {}}
          flash={() => {}}
          locale={locale}
        />
      </main>
    </Locale.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
