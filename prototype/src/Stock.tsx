import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MagnifyingGlass,
  FunnelSimple,
  UploadSimple,
  CheckCircle,
  WarningCircle,
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  CaretRight,
  CaretDown,
  CaretLeft,
} from "@phosphor-icons/react";
import { ShipmentTrends } from "./ShipmentTrends";
import { TableTimestamp } from "./DateTime";
import { available } from "./fixtures";
import { productSuggestions, valueSuggestions } from "./autocomplete-model";
import { stockItemPage } from "./stock-items";
import { useServerCatalogue } from "./server-catalogue";
import { SelectionCell, SelectionHeader, useBulkSelection } from "./selection";
import { BulkActions } from "./BulkActions";
import { downloadCsv } from "./bulk-files";
import {
  Button,
  Field,
  Lookup,
  Notice,
  Panel,
  Tag,
  Empty,
  Thumb,
  ProductName,
  Summary,
  Modal,
  useText,
  useCataloguePageSize,
} from "./ui.tsx";

const stockColumnWidths = [23, 11, 9, 14, 10, 11, 7, 15];

export function Stock({
  data,
  setData,
  warehouse,
  user,
  go,
  ask,
  flash,
  locale,
  setCatalogueQuery,
  authMode,
}) {
  const t = useText();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loc, setLoc] = useState("");
  const [condition, setCondition] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useCataloguePageSize();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState("item");
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState("SKU-A");
  const [imagePreview, setImagePreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [opening, setOpening] = useState(false);
  const [openingQty, setOpeningQty] = useState("");
  const [reason, setReason] = useState("");
  const inputFile = useRef<HTMLInputElement>(null);
  const positions = useMemo(
    () => data.positions.filter((p) => p.warehouse === warehouse && p.qty > 0),
    [data.positions, warehouse],
  );
  const product = data.products.find((p) => p.sku === selected);
  const server = useServerCatalogue(data, setCatalogueQuery, { view: "stock", query: search, location: loc, condition, status: stockStatus, sort, descending, page, pageSize, focusSku: selected });
  const localResult = useMemo(
    () =>
      stockItemPage(server ? data.positions.filter((position) => server.ids.includes(position.sku)) : data.positions, data.products, {
        warehouse,
        query: search,
        location: loc,
        condition,
        status: stockStatus,
        sort,
        descending,
        page: setCatalogueQuery ? 1 : page,
        pageSize,
      }),
    [
      data.positions,
      data.products,
      warehouse,
      search,
      loc,
      condition,
      stockStatus,
      sort,
      descending,
      page,
      pageSize,
      server,
    ],
  );
  const result = server ? { ...localResult, ...server, items: localResult.items } : localResult;
  const bulk = useBulkSelection({ rows: result.items, scope: JSON.stringify([user.id, user.role, warehouse, search, loc, condition, stockStatus, sort, descending, page, pageSize]), key: row => row.key, label: row => `${row.product.name} · ${row.sku}`, disabled: !!setCatalogueQuery && !server });
  useEffect(
    () => setPage(1),
    [
      warehouse,
      search,
      loc,
      condition,
      stockStatus,
      sort,
      descending,
      pageSize,
    ],
  );
  const filtersActive = !!(search.trim() || loc || condition || stockStatus);
  const clearFilters = () => {
    setSearch("");
    setLoc("");
    setCondition("");
    setStockStatus("");
    setPage(1);
  };
  const conditionLabel = (value) =>
    value === "good"
      ? t("Good", "Bagus")
      : value === "not-good"
        ? t("Not good", "Tidak bagus")
        : t("Not assessed yet", "Belum dicek");
  const renderCondition = (value) => (
    <Tag
      kind={
        value === "good"
          ? "success"
          : value === "not-good"
            ? "warning"
            : "neutral"
      }
    >
      {conditionLabel(value)}
    </Tag>
  );
  const renderStatus = (p) => (
    <div className="stock-condition">
      {p.frozen && (
        <small className="hold-label">
          <WarningCircle size={13} aria-hidden="true" />
          {t("Frozen", "Dibekukan")}
        </small>
      )}
      {p.hold && (
        <small className="hold-label">
          <WarningCircle size={13} aria-hidden="true" />
          {p.hold === "awaiting-qc"
            ? t("Awaiting QC", "Menunggu QC")
            : t("On hold", "Ditahan")}
        </small>
      )}
      {!p.frozen && !p.hold && (
        <span aria-label={t("No stock restriction", "Tanpa pembatasan stok")}>
          —
        </span>
      )}
    </div>
  );
  const unitLabel = (unit) => (unit === "units" ? t("units", "unit") : unit);
  const changeSort = (key) => {
    setDescending(sort === key ? !descending : false);
    setSort(key);
  };
  const choosePhoto = (e) => {
    const file = e.target.files?.[0];
    setPhotoError("");
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError(
        t(
          "Choose a JPEG, PNG or WebP up to 5 MB.",
          "Pilih JPEG, PNG, atau WebP sampai 5 MB.",
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setImagePreview({ sku: product.sku, src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <>
      <div className="stock-toolbar">
        <div className="search">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <Field
            label={t(
              "Search items, SKU or location",
              "Cari barang, SKU, atau lokasi",
            )}
            value={search}
            onValueChange={setSearch}
            suggestions={[
              ...productSuggestions(
                data.products.filter((product) =>
                  positions.some((position) => position.sku === product.sku),
                ),
              ),
              ...valueSuggestions(
                positions.map((position) => position.location),
              ),
            ]}
            type="search"
            placeholder={t(
              "Search items, SKU or location…",
              "Cari barang, SKU, atau lokasi…",
            )}
          />
        </div>
        <Button
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <FunnelSimple size={20} />
          {t("Filter", "Filter")}
        </Button>
      </div>
      {filterOpen && (
        <div className="filter-bar panel">
          <Field label={t("Location", "Lokasi")}>
            <Lookup
              value={loc}
              onValueChange={setLoc}
              options={[
                { value: "", label: t("All locations", "Semua lokasi") },
                ...valueSuggestions(
                  positions.map((position) => position.location),
                ),
              ]}
            />
          </Field>
          <Field label={t("Condition", "Kondisi")}>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="">{t("All conditions", "Semua kondisi")}</option>
              <option value="good">{t("Good", "Bagus")}</option>
              <option value="not-good">{t("Not good", "Tidak bagus")}</option>
              <option value="unassessed">
                {t("Not assessed yet", "Belum dicek")}
              </option>
            </select>
          </Field>
          <Field label={t("Stock status", "Status stok")}>
            <select
              value={stockStatus}
              onChange={(event) => setStockStatus(event.target.value)}
            >
              <option value="">
                {t("All stock statuses", "Semua status stok")}
              </option>
              <option value="frozen">{t("Frozen", "Dibekukan")}</option>
              <option value="hold">{t("On hold", "Ditahan")}</option>
              <option value="unrestricted">
                {t("No stock restriction", "Tanpa pembatasan stok")}
              </option>
            </select>
          </Field>
          <Button onClick={clearFilters}>
            {t("Clear filters", "Hapus filter")}
          </Button>
          {user.role !== "operator" && (
            <Button onClick={() => setOpening(true)}>
              {t("Review opening balance", "Tinjau saldo awal")}
            </Button>
          )}
        </div>
      )}
      <div className="stock-grid">
        <Panel className="stock-table-panel">
          <div className="table-heading">
            <div>
              <h2>{t("Stock by item", "Stok per barang")}</h2>
              <p id="stock-selection-scope" className="muted">
                {t(
                  "Open an item name for details across all locations. Use checkboxes to select items for export.",
                  "Klik nama barang untuk detail di semua lokasi. Centang kotak untuk memilih barang yang akan diekspor.",
                )}
              </p>
            </div>
            {product && (
              <span className="table-viewing" role="status">
                <CheckCircle size={16} aria-hidden="true" />
                {t(
                  `Details: ${selected} · All locations`,
                  `Detail: ${selected} · Semua lokasi`,
                )}
              </span>
            )}
          </div>
          <p id="stock-filter-scope" className="stock-filter-scope muted">
            {filtersActive
              ? t(
                  "Filtered view: counts, totals and expanded positions include matches only.",
                  "Tampilan terfilter: jumlah, total, dan rincian posisi hanya mencakup hasil yang cocok.",
                )
              : t(
                  "Totals cover all positions in this warehouse. Expand an item to compare its positions.",
                  "Total mencakup semua posisi di gudang ini. Buka barang untuk membandingkan posisinya.",
                )}
          </p>
          <div className="stock-mobile-sort">
            <Field label={t("Sort stock by", "Urutkan stok")}>
              <select
                value={`${sort}:${descending ? "desc" : "asc"}`}
                onChange={(event) => {
                  const [key, direction] = event.target.value.split(":");
                  setSort(key);
                  setDescending(direction === "desc");
                }}
              >
                <option value="item:asc">{t("Item A–Z", "Barang A–Z")}</option>
                <option value="item:desc">{t("Item Z–A", "Barang Z–A")}</option>
                <option value="location:asc">
                  {t("Location A–Z", "Lokasi A–Z")}
                </option>
                <option value="location:desc">
                  {t("Location Z–A", "Lokasi Z–A")}
                </option>
                <option value="available:desc">
                  {t("Available: high to low", "Tersedia: terbesar dahulu")}
                </option>
                <option value="available:asc">
                  {t("Available: low to high", "Tersedia: terkecil dahulu")}
                </option>
              </select>
            </Field>
          </div>
          <BulkActions selection={bulk} actions={[{ id: "export", label: t("Export selected stock", "Ekspor stok terpilih"), description: t("Exports only the matching positions of the selected SKUs, with locations, restrictions and units kept separate.", "Mengekspor hanya posisi yang sesuai filter dari SKU terpilih, dengan lokasi, pembatasan, dan satuan tetap terpisah."), perform: async () => {}, complete: rows => downloadCsv("selected-stock.csv", [["Warehouse", "SKU", "Item", "Location", "Condition", "Hold", "Frozen", "Pickable", "On hand", "Reserved", "Available", "Unit", "Last movement"], ...rows.flatMap(group => group.rows.map(position => [warehouse, group.sku, group.product.name, position.location, position.condition, position.hold || "", !!position.frozen, position.pickable ?? /^A-/.test(position.location), position.qty, position.reserved, available(position), position.unit || group.product.unit || "units", position.lastMovementAt || ""]))]) }]} />
          <div
            className="stock-group-scroll"
            role="region"
            tabIndex={0}
            aria-label={t(
              "Stock position table; scroll horizontally for all columns",
              "Tabel posisi stok; geser ke samping untuk semua kolom",
            )}
          >
            <table
              className="data-table stock-group-table"
              aria-label={t("Stock position", "Posisi stok")}
              aria-describedby="stock-selection-scope stock-filter-scope"
            >
              <colgroup>
                <col style={{ width: 48 }} />
                {stockColumnWidths.map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <SelectionHeader selection={bulk} label={t("Select all on this page", "Pilih semua di halaman ini")} />
                  {[
                    ["item", t("Item", "Barang")],
                    ["location", t("Location", "Lokasi")],
                    ["condition", t("Condition", "Kondisi")],
                    ["status", t("Stock status", "Status stok")],
                    ["reserved", t("Reserved", "Dipesan")],
                    ["available", t("Available", "Tersedia")],
                    ["unit", t("Unit", "Satuan")],
                    ["lastMovementAt", t("Last movement", "Mutasi terakhir")],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      className={
                        ["reserved", "available"].includes(key) ? "numeric" : ""
                      }
                      aria-label={
                        key === "reserved"
                          ? t("Reserved for orders", "Dipesan untuk order")
                          : label
                      }
                      title={
                        key === "available"
                          ? t(
                              "Quantities are sorted within the same unit",
                              "Jumlah diurutkan dalam satuan yang sama",
                            )
                          : undefined
                      }
                      aria-sort={
                        sort === key
                          ? descending
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                    >
                      {["item", "location", "available"].includes(key) ? (
                        <button
                          className="sort-button"
                          onClick={() => changeSort(key)}
                        >
                          {label}
                          <span aria-hidden="true">
                            {sort === key ? (
                              descending ? (
                                <ArrowDown size={13} />
                              ) : (
                                <ArrowUp size={13} />
                              )
                            ) : (
                              <ArrowsDownUp size={13} />
                            )}
                          </span>
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((group) => {
                  const multiple = group.rows.length > 1;
                  const isOpen = multiple && expanded.has(group.key);
                  const detailId = `stock-positions-${encodeURIComponent(group.key)}`;
                  const single = group.rows[0];
                  return (
                    <React.Fragment key={group.key}>
                      <tr className={[selected === group.sku ? "selected" : "", bulk.checked(group) ? "bulk-selected" : ""].filter(Boolean).join(" ")}>
                        <SelectionCell selection={bulk} row={group} label={t(`Select ${bulk.label(group)}`, `Pilih ${bulk.label(group)}`)} />
                        <td>
                          <div className="stock-item-cell">
                            {multiple ? (
                              <button
                                className="stock-expand"
                                aria-expanded={isOpen}
                                aria-controls={detailId}
                                aria-label={t(
                                  `${isOpen ? "Collapse" : "Expand"} stock positions for ${group.product.name}, ${group.sku}`,
                                  `${isOpen ? "Tutup" : "Buka"} posisi stok ${group.product.name}, ${group.sku}`,
                                )}
                                onClick={() =>
                                  setExpanded((current) => {
                                    const next = new Set(current);
                                    if (next.has(group.key))
                                      next.delete(group.key);
                                    else next.add(group.key);
                                    return next;
                                  })
                                }
                              >
                                {isOpen ? (
                                  <CaretDown size={16} aria-hidden="true" />
                                ) : (
                                  <CaretRight size={16} aria-hidden="true" />
                                )}
                              </button>
                            ) : (
                              <span className="stock-expand-spacer" />
                            )}
                            <button
                              className="row-select"
                              onClick={() => setSelected(group.sku)}
                              aria-pressed={selected === group.sku}
                            >
                              <ProductName product={group.product} />
                              <CheckCircle
                                size={16}
                                className="table-selection-mark"
                                data-selected={selected === group.sku}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                        <td>
                          {multiple
                            ? t(
                                `${group.locations.length} ${group.locations.length === 1 ? "location" : "locations"}`,
                                `${group.locations.length} lokasi`,
                              )
                            : single.location}
                        </td>
                        <td>
                          {group.conditions.length === 1 ? (
                            renderCondition(single.condition)
                          ) : (
                            <span
                              title={group.conditions
                                .map(conditionLabel)
                                .join(" / ")}
                            >
                              {t(
                                `Mixed (${group.conditions.length})`,
                                `Campuran (${group.conditions.length})`,
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {multiple ? (
                            <div className="stock-status-summary">
                              <span className="muted">
                                {t(
                                  `${group.statusVariants} status ${group.statusVariants === 1 ? "variant" : "variants"}`,
                                  `${group.statusVariants} variasi status`,
                                )}
                              </span>
                              {group.statuses.includes("frozen") && (
                                <span className="hold-label">
                                  {t("Frozen", "Dibekukan")}
                                </span>
                              )}
                              {group.statuses.some((s) =>
                                s.startsWith("hold:"),
                              ) && (
                                <span className="hold-label">
                                  {t("On hold", "Ditahan")}
                                </span>
                              )}
                            </div>
                          ) : (
                            renderStatus(single)
                          )}
                        </td>
                        {["reserved", "available"].map((key) => (
                          <td key={key} className="numeric">
                            {group.totals.map((total) => (
                              <div key={total.unit}>
                                {total[key]}
                                {group.totals.length > 1 && (
                                  <small> {unitLabel(total.unit)}</small>
                                )}
                              </div>
                            ))}
                          </td>
                        ))}
                        <td>
                          {group.totals.length === 1
                            ? unitLabel(group.totals[0].unit)
                            : t("Mixed units", "Satuan berbeda")}
                        </td>
                        <td className="timestamp-column"><TableTimestamp value={group.lastMovementAt} /></td>
                      </tr>
                      {multiple && (
                        <tr
                          className="stock-detail-row"
                          hidden={!isOpen}
                          id={detailId}
                        >
                          <td colSpan={2} />
                          <td colSpan={7}>
                            {isOpen && (
                              <div className="stock-position-subview">
                                <table
                                  className="stock-detail-table"
                                  aria-label={t(
                                    `Stock positions for ${group.sku}`,
                                    `Posisi stok ${group.sku}`,
                                  )}
                                >
                                  <colgroup>
                                    {stockColumnWidths.slice(1).map((width, index) => (
                                      <col key={index} style={{ width: `${width / (100 - stockColumnWidths[0]) * 100}%` }} />
                                    ))}
                                  </colgroup>
                                  <thead className="sr-only">
                                    <tr>
                                      {[
                                        t("Location", "Lokasi"),
                                        t("Condition", "Kondisi"),
                                        t("Stock status", "Status stok"),
                                        t("Reserved", "Dipesan"),
                                        t("Available", "Tersedia"),
                                        t("Unit", "Satuan"),
                                        t("Last movement", "Mutasi terakhir"),
                                      ].map((label, index) => (
                                        <th
                                          key={index}
                                          scope="col"
                                          className={
                                            [3, 4].includes(index)
                                              ? "numeric"
                                              : ""
                                          }
                                        >
                                          {label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((position, index) => (
                                      <tr key={index}>
                                        <th scope="row">{position.location}</th>
                                        <td>
                                          {renderCondition(position.condition)}
                                        </td>
                                        <td>{renderStatus(position)}</td>
                                        <td className="numeric">
                                          {position.reserved}
                                        </td>
                                        <td className="numeric">
                                          {available(position)}
                                        </td>
                                        <td>
                                          {unitLabel(
                                            position.unit ||
                                              group.product.unit ||
                                              "units",
                                          )}
                                        </td>
                                        <td className="timestamp-column"><TableTimestamp value={position.lastMovementAt} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {result.totalItems === 0 && (
              <Empty
                title={
                  positions.length
                    ? t("No matching items", "Barangnya tidak ketemu")
                    : t(
                        "No stock in this warehouse",
                        "Belum ada stok di gudang ini",
                      )
                }
                action={
                  positions.length ? (
                    <Button onClick={clearFilters}>
                      {t("Clear filters", "Hapus filter")}
                    </Button>
                  ) : (
                    <Button onClick={() => go("transfers")}>
                      {t("View incoming transfers", "Lihat transfer masuk")}
                    </Button>
                  )
                }
              />
            )}
          </div>
          <div className="stock-table-bottom">
            <div className="catalogue-pagination">
              <span role="status">
                {t(
                  `Items ${result.from}–${result.to} of ${result.totalItems} · Positions on this page: ${result.items.reduce((sum, item) => sum + item.rows.length, 0)} of ${result.totalPositions}${filtersActive ? ` matching filters (of ${result.scopedItems} items / ${result.scopedPositions} positions)` : ""}`,
                  `Barang ${result.from}–${result.to} dari ${result.totalItems} · Posisi di halaman ini: ${result.items.reduce((sum, item) => sum + item.rows.length, 0)} dari ${result.totalPositions}${filtersActive ? ` sesuai filter (dari ${result.scopedItems} barang / ${result.scopedPositions} posisi)` : ""}`,
                )}
              </span>
              <Field label={t("Items per page", "Barang per halaman")}>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  {[10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </Field>
              <nav aria-label={t("Stock item pages", "Halaman barang stok")}>
                <Button
                  aria-label={t(
                    "Previous item page",
                    "Halaman barang sebelumnya",
                  )}
                  disabled={result.page === 1}
                  onClick={() => setPage(result.page - 1)}
                >
                  <CaretLeft size={18} aria-hidden="true" />
                </Button>
                <span>
                  {t(
                    `Page ${result.page} of ${result.pages}`,
                    `Halaman ${result.page} dari ${result.pages}`,
                  )}
                </span>
                <Button
                  aria-label={t("Next item page", "Halaman barang berikutnya")}
                  disabled={result.page === result.pages}
                  onClick={() => setPage(result.page + 1)}
                >
                  <CaretRight size={18} aria-hidden="true" />
                </Button>
              </nav>
            </div>
            <p className="muted footnote">
              {t(
                "Reserved remains on site until shipment. Available excludes frozen, held and non-pickable stock. Different units are shown separately.",
                "Dipesan masih berada di gudang sampai pengiriman. Tersedia tidak mencakup stok dibekukan, ditahan, atau tidak layak diambil. Satuan berbeda ditampilkan terpisah.",
              )}
            </p>
            {authMode !== "oidc" && <Notice title={t("Simulation data", "Data simulasi")}>
              {t(
                "All sample stock and trends are fictional and for demonstration purposes only.",
                "Semua contoh stok dan tren adalah data fiktif untuk demonstrasi.",
              )}
            </Notice>}
          </div>
        </Panel>
        <Panel className="analysis-panel">
          {product && positions.some((p) => p.sku === product.sku) ? (
            <>
              <div className="analysis-identity">
                <Thumb large product={product} />
                <div>
                  <h2>{product.name}</h2>
                  <p className="muted">{product.sku}</p>
                  {user.role !== "operator" && (
                    <Button onClick={() => inputFile.current.click()}>
                      <UploadSimple size={18} />
                      {product.image
                        ? t("Change image", "Ganti gambar")
                        : t("Add image", "Tambah gambar")}
                    </Button>
                  )}
                  <small className="muted">
                    {t("Optional image", "Gambar opsional")}
                  </small>
                </div>
              </div>
              <input
                ref={inputFile}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-label={t(
                  `Image for ${product.name}`,
                  `Gambar ${product.name}`,
                )}
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
              />
              {photoError && <Notice kind="error">{photoError}</Notice>}
              {product.image && user.role !== "operator" && (
                <Button
                  onClick={() =>
                    setImagePreview({ sku: selected, remove: true })
                  }
                >
                  {t("Remove image", "Hapus gambar")}
                </Button>
              )}
              <h2>{t("Specifications", "Spesifikasi")}</h2>
              <Summary
                items={[
                  [t("Category", "Kategori"), product.category],
                  [t("Base unit", "Satuan dasar"), product.unit],
                  [
                    t("Dimensions", "Dimensi"),
                    product.dimensions || t("Not set", "Belum diisi"),
                  ],
                  [
                    t("Unit weight", "Berat satuan"),
                    product.weight || t("Not set", "Belum diisi"),
                  ],
                ]}
              />
              <p className="muted">
                {warehouse} · {t("All locations", "Semua lokasi")}
              </p>
              <ShipmentTrends summary={data.shipments} sku={selected} locale={locale} />
              <div className="analysis-footer">
                <small className="muted">
                  {t(
                    "Confirmed shipments only.",
                    "Hanya pengiriman terkonfirmasi.",
                  )}
                </small>
                <a href="#movements">
                  {t("View stock movements", "Lihat kartu stok")}
                </a>
              </div>
            </>
          ) : (
            <Empty
              title={t(
                "Select an item to view its details",
                "Pilih barang untuk melihat detail",
              )}
            />
          )}
        </Panel>
      </div>
      {imagePreview && (
        <Modal
          title={
            imagePreview.remove
              ? t("Remove item image?", "Hapus gambar barang?")
              : t("Preview image (unsaved)", "Preview gambar (belum disimpan)")
          }
          onClose={() => setImagePreview(null)}
          footer={
            <>
              <Button onClick={() => setImagePreview(null)}>
                {t("Cancel", "Batal")}
              </Button>
              <Button
                primary
                onClick={() => {
                  setData((s) => ({
                    ...s,
                    products: s.products.map((p) =>
                      p.sku === imagePreview.sku
                        ? {
                            ...p,
                            image: imagePreview.remove
                              ? null
                              : imagePreview.src,
                          }
                        : p,
                    ),
                  }));
                  setImagePreview(null);
                  flash(
                    t(
                      "Item image updated in this tab.",
                      "Gambar barang diperbarui di tab ini.",
                    ),
                  );
                }}
              >
                {t("Save image locally", "Simpan gambar lokal")}
              </Button>
            </>
          }
        >
          {imagePreview.src && (
            <img
              className="photo-preview"
              src={imagePreview.src}
              width="360"
              height="260"
              alt={t(`Preview for ${product.name}`, `Preview ${product.name}`)}
            />
          )}
          <p>
            {t(
              "Optional. JPEG, PNG or WebP up to 5 MB (demo limit).",
              "Opsional. JPEG, PNG, atau WebP sampai 5 MB (batas demo).",
            )}
          </p>
        </Modal>
      )}
      {opening && (
        <Modal
          title={t("Review opening balance", "Tinjau saldo awal")}
          onClose={() => setOpening(false)}
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setOpening(false);
              ask(
                "opening",
                {
                  sku: selected,
                  scan: selected,
                  location: "A-01",
                  qty: Number(openingQty),
                  reason,
                },
                [
                  [t("Item", "Barang"), selected],
                  [t("Destination", "Tujuan"), "A-01"],
                  [
                    t("Opening quantity", "Jumlah saldo awal"),
                    `${openingQty} ${t("units", "unit")}`,
                  ],
                  [t("Reason", "Alasan"), reason],
                ],
              );
            }}
          >
            <Notice kind="warning">
              {t(
                "This creates a new opening movement. Existing balances cannot be edited directly.",
                "Ini membuat mutasi saldo awal baru. Saldo yang ada tidak bisa diedit langsung.",
              )}
            </Notice>
            <Field
              label={t("Quantity (units)", "Jumlah (unit)")}
              type="number"
              min="1"
              step="1"
              value={openingQty}
              onChange={(e) => setOpeningQty(e.target.value)}
              required
            />
            <Field
              label={t("Reason", "Alasan")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <Button primary type="submit">
              {t("Review", "Tinjau")}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
