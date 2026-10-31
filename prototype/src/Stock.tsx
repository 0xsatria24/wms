import React, { useEffect, useRef, useState } from "react";
import {
  MagnifyingGlass,
  FunnelSimple,
  UploadSimple,
  CaretLeft,
  CaretRight,
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import Chart from "chart.js/auto";
import { available, locations } from "./fixtures";
import {
  Button,
  Field,
  Notice,
  Panel,
  Tag,
  Empty,
  Thumb,
  ProductName,
  Summary,
  Modal,
  useText,
} from "./ui.tsx";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
];
const trend = [80, 90, 100, 110, 100, 120, 110, 100, 120, 170];
function TrendChart({ locale }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const dark = document.documentElement.dataset.theme === "dark";
    const chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label:
              locale === "en" ? "Shipped units (2026)" : "Unit terkirim (2026)",
            data: trend,
            borderColor: dark ? "#85BDFF" : "#005FCC",
            backgroundColor: dark ? "#85BDFF" : "#005FCC",
            borderWidth: 2,
            pointRadius: 3,
            segment: {
              borderDash: (c) => (c.p1DataIndex === 9 ? [5, 4] : undefined),
            },
            pointStyle: (c) => (c.dataIndex === 9 ? "rectRot" : "circle"),
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (c) =>
                c.dataIndex === 9
                  ? locale === "en"
                    ? "Partial through 28 Oct"
                    : "Parsial sampai 28 Okt"
                  : "",
            },
          },
        },
        scales: {
          x: {
            ticks: { color: dark ? "#BBC9DA" : "#526176", font: { size: 11 } },
            grid: { color: dark ? "#304153" : "#E8EEF5" },
          },
          y: {
            min: 0,
            max: 200,
            ticks: { stepSize: 50, color: dark ? "#BBC9DA" : "#526176" },
            grid: { color: dark ? "#304153" : "#E8EEF5" },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [locale]);
  return (
    <div className="chart-slot">
      <canvas
        ref={canvas}
        aria-label={
          locale === "en"
            ? "Monthly shipped units, January to October 2026. Data table below."
            : "Unit terkirim bulanan, Januari sampai Oktober 2026. Tabel data ada di bawah."
        }
        role="img"
      />
    </div>
  );
}

export function Stock({
  data,
  setData,
  warehouse,
  user,
  go,
  ask,
  flash,
  locale,
}) {
  const t = useText();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loc, setLoc] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("item");
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState("SKU-A");
  const [imagePreview, setImagePreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [opening, setOpening] = useState(false);
  const [openingQty, setOpeningQty] = useState("");
  const [reason, setReason] = useState("");
  const inputFile = useRef<HTMLInputElement>(null);
  const positions = data.positions.filter(
    (p) => p.warehouse === warehouse && p.qty > 0,
  );
  const product = data.products.find((p) => p.sku === selected);
  const filtered = positions
    .filter((p) => {
      const item = data.products.find((i) => i.sku === p.sku);
      return (
        `${p.sku} ${item?.name} ${p.location}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!loc || p.location === loc) &&
        (!condition || p.condition === condition)
      );
    })
    .sort(
      (a, b) =>
        (sort === "available"
          ? available(a) - available(b)
          : sort === "location"
            ? a.location.localeCompare(b.location)
            : a.sku.localeCompare(b.sku)) * (descending ? -1 : 1),
    );
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
            onChange={(e) => setSearch(e.target.value)}
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
            <select value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">{t("All locations", "Semua lokasi")}</option>
              {locations.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
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
          <Button
            onClick={() => {
              setSearch("");
              setLoc("");
              setCondition("");
            }}
          >
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
          <div className="table-wrap">
            <table aria-label={t("Stock position", "Posisi stok")}>
              <thead>
                <tr>
                  {[
                    ["item", t("Item", "Barang")],
                    ["location", t("Location", "Lokasi")],
                    ["condition", t("Condition", "Kondisi")],
                    ["reserved", t("Reserved for orders", "Dipesan")],
                    ["available", t("Available", "Tersedia")],
                    ["unit", t("Unit", "Satuan")],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className={
                        ["reserved", "available"].includes(key) ? "numeric" : ""
                      }
                      scope="col"
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
                {filtered.map((p, i) => {
                  const item = data.products.find((i) => i.sku === p.sku);
                  return (
                    <tr
                      key={`${p.sku}-${p.location}-${p.hold}`}
                      className={selected === p.sku ? "selected" : ""}
                    >
                      <td data-label={t("Item", "Barang")}>
                        <button
                          className="row-select"
                          onClick={() => setSelected(p.sku)}
                          aria-pressed={selected === p.sku}
                        >
                          <ProductName product={item} />
                        </button>
                      </td>
                      <td data-label={t("Location", "Lokasi")}>{p.location}</td>
                      <td data-label={t("Condition", "Kondisi")}>
                        <Tag
                          kind={
                            p.condition === "good"
                              ? "success"
                              : p.condition === "not-good"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {p.condition === "good"
                            ? t("Good", "Bagus")
                            : p.condition === "not-good"
                              ? t("Not good", "Tidak bagus")
                              : t("Not assessed yet", "Belum dicek")}
                        </Tag>
                        {p.hold && (
                          <small className="hold-label">
                            {p.hold === "awaiting-qc"
                              ? t("Awaiting QC", "Menunggu QC")
                              : t("On hold", "Ditahan")}
                          </small>
                        )}
                        {p.frozen && (
                          <small className="hold-label">
                            {t("Frozen", "Dibekukan")}
                          </small>
                        )}
                      </td>
                      <td
                        className="numeric"
                        data-label={t("Reserved for orders", "Dipesan")}
                      >
                        {p.reserved}
                      </td>
                      <td
                        className="numeric"
                        data-label={t("Available", "Tersedia")}
                      >
                        {available(p)}
                      </td>
                      <td data-label={t("Unit", "Satuan")}>
                        {t("units", "unit")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
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
                    <Button
                      onClick={() => {
                        setSearch("");
                        setLoc("");
                        setCondition("");
                      }}
                    >
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
            <div className="pagination">
              <span>
                {t(
                  `Showing ${filtered.length} of ${positions.length} positions`,
                  `Menampilkan ${filtered.length} dari ${positions.length} posisi`,
                )}
              </span>
              <div>
                <Button
                  disabled
                  aria-label={t("Previous page", "Halaman sebelumnya")}
                >
                  <CaretLeft size={18} />
                </Button>
                <Button primary disabled aria-current="page">
                  1
                </Button>
                <Button
                  disabled
                  aria-label={t("Next page", "Halaman berikutnya")}
                >
                  <CaretRight size={18} />
                </Button>
              </div>
            </div>
            <p className="muted footnote">
              {t(
                "Reserved for orders remains on site until the shipment departs. Available excludes stock on hold.",
                "Dipesan masih berada di gudang sampai pengiriman. Tersedia tidak termasuk stok yang ditahan.",
              )}
            </p>
            <Notice title={t("Simulation data", "Data simulasi")}>
              {t(
                "All sample stock and trends are fictional and for demonstration purposes only.",
                "Semua contoh stok dan tren adalah data fiktif untuk demonstrasi.",
              )}
            </Notice>
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
              <div className="panel-heading">
                <h2>{t("Item trends", "Tren barang")}</h2>
                <span className="metric-label">
                  {t("Shipped units", "Unit terkirim")}
                </span>
              </div>
              <p className="muted">
                {warehouse} · {t("All locations", "Semua lokasi")}
              </p>
              {selected === "SKU-A" && warehouse === MAIN_NAME ? (
                <>
                  <div className="trend-summary">
                    <div>
                      <span>{t("YTD shipped", "Terkirim YTD")}</span>
                      <strong>1,100 {t("units", "unit")}</strong>
                      <small>1 Jan – 28 Oct 2026</small>
                    </div>
                    <div>
                      <b>+10.0%</b>
                      <small>
                        {t("vs same period 2025", "vs periode sama 2025")}
                      </small>
                    </div>
                  </div>
                  <div className="panel-heading chart-heading">
                    <h3>
                      {t("Monthly shipped units", "Unit terkirim per bulan")}
                    </h3>
                    <Tag>{t("Oct partial", "Okt parsial")}</Tag>
                  </div>
                  <TrendChart
                    key={document.documentElement.dataset.theme}
                    locale={locale}
                  />
                  <Summary
                    items={[
                      [t("MoM", "MoM"), "+20.0% · Sep 120 / Aug 100"],
                      [
                        t("YoY", "YoY"),
                        "+25.0% · Sep 2026: 120 / Sep 2025: 96",
                      ],
                    ]}
                  />
                  <small className="muted">
                    {t(
                      "Last complete month: Sep 2026. Historical fixture through 28 Oct 2026.",
                      "Bulan terakhir lengkap: Sep 2026. Data contoh historis sampai 28 Okt 2026.",
                    )}
                  </small>
                  <details className="chart-data">
                    <summary>
                      {t("View chart data", "Lihat data grafik")}
                    </summary>
                    <table>
                      <caption>
                        {t(
                          "2026 shipped units; October is partial.",
                          "Unit terkirim 2026; Oktober parsial.",
                        )}
                      </caption>
                      <tbody>
                        {months.map((m, i) => (
                          <tr key={m}>
                            <th scope="row">
                              {m} 2026
                              {i === 9 ? t(" (partial)", " (parsial)") : ""}
                            </th>
                            <td>
                              {trend[i]} {t("units", "unit")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              ) : (
                <Empty
                  title={t("No comparison data", "Data pembanding belum ada")}
                >
                  {t(
                    "No shipment history is included for this item and warehouse.",
                    "Riwayat pengiriman contoh belum tersedia untuk barang dan gudang ini.",
                  )}
                </Empty>
              )}
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
const MAIN_NAME = "Main Warehouse";
