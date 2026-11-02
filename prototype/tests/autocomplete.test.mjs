import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchSuggestions,
  productSuggestions,
  valueSuggestions,
} from "../src/autocomplete-model.ts";

test("a barcode with leading zeros finds the correct item; inactive items stay out of new orders", () => {
  const products = [
    { sku: "SKU-A", name: "Same name", barcode: "000123", active: true },
    { sku: "SKU-B", name: "Same name", barcode: "000124", active: false },
  ];
  assert.deepEqual(
    matchSuggestions(productSuggestions(products), "000124").map(
      (row) => row.value,
    ),
    ["SKU-B"],
  );
  assert.deepEqual(
    productSuggestions(products, true).map((row) => row.value),
    ["SKU-A"],
  );
  assert.equal(
    matchSuggestions(productSuggestions(products), "same name").length,
    2,
  );
  assert.equal(products[0].barcode, "000123");
  assert.deepEqual(
    matchSuggestions(
      productSuggestions([
        { sku: "SKU-A", name: "Product A", active: true },
        { sku: "SKU-B", name: "Product B", active: true },
      ]),
      "Product C",
    ),
    [],
  );
});

test("saved free text ignores blank and duplicate values without changing the saved spelling", () => {
  assert.deepEqual(
    valueSuggestions(["PT A", " pt a ", "", null, "PT B", undefined]),
    [
      { value: "PT A", label: "PT A" },
      { value: "PT B", label: "PT B" },
    ],
  );
  assert.equal(
    matchSuggestions(valueSuggestions(["Café Tools"]), "CAFE")[0].value,
    "Café Tools",
  );
});

test("10,000 suggestions remain bounded, rank exact codes first and preserve source order", () => {
  const options = Array.from({ length: 10000 }, (_, index) => ({
    value: `SKU-${index}`,
    label: `Item ${index}`,
  }));
  const before = options.map((row) => row.value);
  assert.equal(matchSuggestions(options, "").length, 8);
  assert.equal(matchSuggestions(options, "SKU-99")[0].value, "SKU-99");
  assert.equal(matchSuggestions(options, "unavailable").length, 0);
  assert.deepEqual(
    options.map((row) => row.value),
    before,
  );
});

test("document descriptions can match item and source while the selected value remains the document ID", () => {
  const options = [
    { value: "QC-1", label: "QC-1", description: "Product A · SKU-A · PO-22" },
  ];
  assert.equal(matchSuggestions(options, "product PO-22")[0].value, "QC-1");
  assert.deepEqual(matchSuggestions(options, "another warehouse"), []);
});
