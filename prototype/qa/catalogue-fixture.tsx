import React from "react";
import { createRoot } from "react-dom/client";
import { Master } from "../src/management";
import { initialState } from "../src/fixtures";
import { Locale } from "../src/ui";
import "../src/styles.css";
const data = initialState();
data.products = Array.from({ length: 10000 }, (_, index) => ({
  sku: `QA-${String(index + 1).padStart(5, "0")}`,
  name: `Test item ${index + 1}`,
  barcode: `000${String(index + 1).padStart(9, "0")}`,
  category: index % 2 ? "Tools" : "Parts",
  active: index % 5 !== 0,
  unit: "units",
  factor: 1,
  image: null,
  dimensions: "",
  weight: "",
  version: 0,
}));
function CatalogueFixture() {
  const [fixtureData, setFixtureData] = React.useState(data);
  return (
    <Locale.Provider value="en">
      <main style={{ padding: 24 }}>
        <h1>Catalogue QA fixture</h1>
        <p>
          10,000 generated test items. Edits stay in this page and reset on
          reload. No database writes. Deletion is disabled in this fixture. Not
          operational data.
        </p>
        <Master
          data={fixtureData}
          user={{ id: "qa-editor", role: "admin" }}
          setData={async (update) => {
            setFixtureData((current) =>
              typeof update === "function" ? update(current) : update,
            );
            return true;
          }}
          flash={() => {}}
          deleteItem={async () => {
            throw new Error("Deletion is disabled in this fixture.");
          }}
        />
      </main>
    </Locale.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<CatalogueFixture />);
