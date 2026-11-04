import React, { useState } from "react";
import { Reference } from "./Reference";
import { ExportPanel, type ExportOption } from "./ExportPanel";
import { DocumentDates, TableTimestamp, useDateTime } from "./DateTime";
import { Barcode, ArrowRight, Plus } from "@phosphor-icons/react";
import { MAIN, SECONDARY, available } from "./fixtures";
import { WorkQueue } from "./WorkQueue";
import { productSuggestions } from "./autocomplete-model";
import { useServerCatalogue } from "./server-catalogue";
import { canOrderAction } from "./bulk-model";
import { selectDraftDocument, captureDocumentDraft } from "./work-queue-model";
import {
  useText,
  Button,
  Field,
  Lookup,
  Notice,
  Panel,
  Tag,
  Empty,
  Summary,
  Tabs,
  DataTable,
  Modal,
} from "./ui.tsx";

export function Operations(props) {
  const {
    route,
    data,
    setData,
    warehouse,
    user,
    go,
    ask,
    flash,
    draft: d,
    patchDraft: applyDraft,
  } = props;
  let activeDocumentId: string | undefined;
  const documentField = ["receiving", "transfers"].includes(route) ? "document" : ["quality", "putaway", "count"].includes(route) || route === "cancellation" && d.mode && d.mode !== "cancel" ? "task" : "order";
  const patch = (changes) => applyDraft(captureDocumentDraft(d, changes, documentField, activeDocumentId));
  const t = useText();
  const { date } = useDateTime();
  useServerCatalogue(data, ["receiving", "quality", "putaway", "orders", "reservations", "picking", "shipping"].includes(route) ? undefined : props.setCatalogueQuery, { view: route, focusSku: d.newOrderSku || d.sku || "", focusDocument: d[documentField] || "", page: props.catalogueQuery?.page || 1, pageSize: 25 });
  const storageLocations = (data.locationMaster || []).filter((location) => (location.pickable ?? /^A-/.test(location.name)) && !location.frozen).map((location) => location.name);
  const operationSku = d.sku || data.products.find((product) => product.active)?.sku || "";
  const operationLocations = data.positions.filter((position) => position.sku === operationSku && position.warehouse === warehouse && available(position) > 0).map((position) => position.location);
  const operationLocation = d.location || operationLocations[0] || storageLocations[0] || "";
  const transferTargets = (data.warehouseMaster || user.warehouses.map((name) => ({ name }))).filter((row) => row.name !== warehouse);
  const transferTarget = d.to || transferTargets[0]?.name || "";
  const itemField = <Field label={t("Item / SKU", "Barang / SKU")} value={operationSku} onValueChange={(sku) => patch({ sku, scan: "", location: "", locationScan: "", source: "" })} suggestions={productSuggestions(data.products.filter((product) => product.active))} required />;
  const [newOrder, setNewOrder] = useState(false);
  const newQty = d.newOrderQty ?? "";
  const newSku = d.newOrderSku ?? "";
  const setNewQty = (qty: string) => patch({ newOrderQty: qty });
  const setNewSku = (sku: string) => patch({ newOrderSku: sku });
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [newOrderError, setNewOrderError] = useState("");
  const newProduct = data.products.find(
    (product) => product.sku === newSku && product.active,
  );
  const value = (key: string, fallback: any = "") => d[key] ?? fallback;
  const validQty = (max = Infinity) => String(value("qty")).trim() !== "" && Number.isInteger(Number(value("qty"))) && Number(value("qty")) > 0 && Number(value("qty")) <= max;
  const quantityHint = () => String(value("qty")).trim() === ""
    ? t("Not entered", "Belum diisi")
    : t("Enter a valid quantity", "Isi jumlah yang valid");
  const select = (label, key, options, fallback) => (
    <Field label={label}>
      <Lookup
        value={options.some(([option]) => option === d[key]) ? d[key] : fallback ?? options[0]?.[0] ?? ""}
        options={options.map(([value, label]) => ({ value, label }))}
        onValueChange={(next) =>
          patch({
            ...(["document", "task", "order"].includes(key)
              ? { qty: undefined, scan: "", locationScan: "", packed: false, reason: "", reasonError: false }
              : key === "destination" || key === "location"
                ? { locationScan: "", qty: undefined, scan: "" }
                : {}),
            [key]: next,
          })
        }
      />
    </Field>
  );
  const field = (
    label: string,
    key: string,
    fallback: any = "",
    extra = {},
  ) => (
    <Field
      label={label}
      value={value(key, fallback)}
      onChange={(e) => patch({ [key]: e.target.value })}
      {...extra}
    />
  );
  const qtyField = (fallback, max = undefined) =>
    field(
      t("Actual quantity (units, required)", "Jumlah aktual (unit, wajib)"),
      "qty",
      "",
      { type: "number", min: 1, max, step: 1, required: true },
    );
  const scanField = (sku) =>
    field(
      t(
        "Scan item barcode / SKU (required)",
        "Pindai barcode / SKU barang (wajib)",
      ),
      "scan",
      "",
      { required: true, placeholder: sku, autoComplete: "off" },
    );
  const scanLocation = (loc) =>
    field(
      t("Scan location (required)", "Pindai lokasi (wajib)"),
      "locationScan",
      "",
      { required: true, placeholder: loc, autoComplete: "off" },
    );
  const reasonField = (required) =>
    field(
      t(
        required ? "Reason (required)" : "Reason / notes",
        required ? "Alasan (wajib)" : "Alasan / catatan",
      ),
      "reason",
      "",
      { required, name: "reason", error: required && d.reasonError && !String(value("reason")).trim() ? t("Reason is required.", "Alasan wajib diisi.") : undefined },
    );
  const form = (children, onSubmit, button, disabled = false) => (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <div className="form-actions">
        <Button
          onClick={() =>
            flash(
              t(
                "Draft kept in this tab, tied to the current user and warehouse. Stock is unchanged.",
                "Draf disimpan di tab ini, terikat pengguna dan gudang. Stok belum berubah.",
              ),
            )
          }
        >
          {t("Keep draft", "Simpan draf")}
        </Button>
        <Button primary type="submit" disabled={disabled}>
          {button || t("Review and confirm", "Tinjau dan konfirmasi")}
        </Button>
      </div>
    </form>
  );
  const review = (type, payload, details) => {
    if (type === "adjust-count" && !String(payload.reason || "").trim()) {
      patch({ reasonError: true });
      (document.querySelector('input[name="reason"]') as HTMLInputElement)?.focus();
      return;
    }
    ask(type, payload, details);
  };
  const quantityDetails = (q) => [
    t("Actual", "Aktual"),
    `${q} ${t("units", "unit")}`,
  ];
  const itemDetails = (sku) => [
    t("Item", "Barang"),
    `${data.products.find((p) => p.sku === sku)?.name} · ${sku}`,
  ];
  const scoped = (rows) => rows.filter((r) => r.warehouse === warehouse);
  const queue = (items, selected, onSelect, title = undefined, detail = undefined) => (
    <WorkQueue
      key={`${route}:${warehouse}`}
      kind={route}
      items={items}
      products={data.products}
      data={data}
      setCatalogueQuery={props.setCatalogueQuery}
      focusDocument={d[documentField] || ""}
      lookupSku={d.newOrderSku || d.sku || ""}
      bulkScope={JSON.stringify([user.id, user.role, warehouse, data.approvalPolicy?.orderReview])}
      bulkActions={route === "orders" && props.bulkCommand && props.editRecord ? [
        ["submit-order", t("Submit selected orders", "Ajukan order terpilih")],
        ["approve-order", t("Approve selected orders", "Setujui order terpilih")],
        ["reject-order", t("Return selected for review", "Kembalikan terpilih untuk ditinjau")],
        ["release-order", t("Release selected orders", "Lepas order terpilih")],
      ].map(([action, label]) => ({ id: action, label, reason: action === "reject-order", danger: action === "reject-order", allowed: row => canOrderAction(action, row, user, data.approvalPolicy?.orderReview), description: t("Approval and release are separate. This action does not reserve or move stock.", "Persetujuan dan pelepasan terpisah. Tindakan ini tidak memesan atau memindahkan stok."), perform: async (row, reason) => action === "submit-order" ? props.editRecord("submit-order", { id: row.id, version: row.version }) : props.bulkCommand(action, { order: row.id, ...(reason ? { reason } : {}) }, row.version), after: async () => { await props.refresh?.(); } })) : undefined}
      selected={selected}
      onSelect={onSelect}
      detail={detail && <>{detail}<DocumentDates row={items.find(row => row.id === selected)} warehouse={warehouse} user={user} onSaved={props.refresh} /></>}
      title={
        title ||
        {
          quality: t("Inspection tasks", "Tugas pemeriksaan"),
          putaway: t("Putaway tasks", "Tugas penempatan"),
          orders: t("Orders", "Order"),
          reservations: t("Orders for reservation", "Order untuk reservasi"),
          picking: t("Picking orders", "Order pengambilan"),
          shipping: t("Shipment orders", "Order pengiriman"),
        }[route] ||
        t("Work queue", "Antrean kerja")
      }
    />
  );
  const emptyQueue = (items, field, detail) => <div className="workflow-grid">{queue(items, d[field], (id) => patch({ [field]: id, qty: undefined, good: undefined, bad: undefined, scan: "", locationScan: "", packed: false }), undefined, detail)}</div>;
  const history = (
    <Panel title={t("Recorded actions", "Tindakan tercatat")}>
      <DataTable
        label={t("Action history", "Riwayat tindakan")}
        empty={t(
          "No confirmed actions in this workflow yet.",
          "Belum ada tindakan terkonfirmasi pada alur ini.",
        )}
        columns={[
          { key: "id", label: t("Transaction", "Transaksi") },
          { key: "type", label: t("Action", "Tindakan") },
          { key: "user", label: t("User", "Pengguna") },
          {
            key: "stamp",
            label: t("Time", "Waktu"),
            render: (r) => <TableTimestamp value={r.stamp} />,
          },
        ]}
        rows={data.audit
          .filter(
            (a) =>
              a.warehouse === warehouse &&
              a.type ===
                ({
                  receiving: "receive",
                  quality: "qc",
                  shipping: "ship",
                  picking: "pick",
                  reservations: "reserve",
                }[route] || route),
          )
          .slice(0, 8)}
      />
    </Panel>
  );
  const next = (route, en, id, orderId?) => (
    <a className="next-link" href={`#${route}`} onClick={orderId ? (event) => { event.preventDefault(); go(route, orderId); } : undefined}>
      {t(en, id)}
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
  let content;
  if (route === "receiving") {
    const docs = scoped(data.receipts).map((r) => ({
      ...r,
      remaining: r.ordered - r.received,
    }));
    const doc = selectDraftDocument(docs, d.document);
    activeDocumentId = doc?.id;
    const q = Number(value("qty"));
    content = !doc ? emptyQueue(docs, "document", (
      <Panel>
        <Empty
          title={t(
            "No purchase orders in this warehouse",
            "Belum ada PO di gudang ini",
          )}
          action={next(
            "transfers",
            "View incoming transfers",
            "Lihat transfer masuk",
          )}
        />
      </Panel>
    )) : (
      <div className="workflow-grid">
        {queue(
          docs,
          doc.id,
          (id) => patch({ document: id, qty: undefined, scan: "" }),
          t("Purchase orders", "Pesanan pembelian"),
        <Panel
          title={doc.id}
          action={
            <Tag>
              {doc.remaining === 0
                ? t("Received", "Diterima")
                : doc.received
                ? t("Partially received", "Diterima sebagian")
                : t("Draft", "Draf")}
            </Tag>
          }
        >
          <Summary
            items={[
              [t("Item", "Barang"), doc.sku],
              [t("Ordered", "Dipesan"), `${doc.ordered} ${t("units", "unit")}`],
              [
                t("Confirmed received", "Sudah diterima"),
                `${doc.received} ${t("units", "unit")}`,
              ],
              [
                t("Remaining before this draft", "Sisa sebelum draf ini"),
                `${doc.remaining} ${t("units", "unit")}`,
              ],
            ]}
          />
          {doc.remaining ? (
            form(
              <>
                <Notice>
                  {t(
                    "QC is required. Received items stay on hold until inspected.",
                    "QC diwajibkan. Barang masuk ditahan sampai diperiksa.",
                  )}
                </Notice>
                <h3>{t("Record actual receipt", "Catat penerimaan aktual")}</h3>
                <div className="form-grid">
                  {scanField(doc.sku)}
                  {qtyField(Math.min(60, doc.remaining), doc.remaining)}
                </div>
                <Summary
                  items={[
                    [t("Destination", "Tujuan"), "Receiving"],
                    [
                      t("Draft actual", "Aktual draf"),
                      validQty(doc.remaining) ? `${q} ${t("units", "unit")}` : quantityHint(),
                    ],
                    [
                      t(
                        "Remaining after confirmation",
                        "Sisa setelah konfirmasi",
                      ),
                      validQty(doc.remaining) ? `${doc.remaining - q} ${t("units", "unit")}` : "—",
                    ],
                    [
                      t("ERP status", "Status ERP"),
                      t(
                        "Not sent for this draft",
                        "Belum dikirim untuk draf ini",
                      ),
                    ],
                  ]}
                />
              </>,
              () =>
                review(
                  "receive",
                  { document: doc.id, scan: value("scan"), qty: q },
                  [
                    [t("Purchase order", "Pesanan pembelian"), doc.id],
                    itemDetails(doc.sku),
                    quantityDetails(q),
                    [
                      t("Remaining after receipt", "Sisa setelah diterima"),
                      `${doc.remaining - q} ${t("units", "unit")}`,
                    ],
                    [
                      t("Destination / hold", "Tujuan / penahanan"),
                      "Receiving · QC",
                    ],
                  ],
                ),
              t("Review receipt", "Tinjau penerimaan"),
            )
          ) : (
            <Notice kind="success">
              {t(
                "Purchase order received in full.",
                "PO sudah diterima seluruhnya.",
              )}
            </Notice>
          )}
          {next(
            "quality",
            "Continue to quality inspection",
            "Lanjut ke pemeriksaan kualitas",
          )}
        </Panel>,
        )}
      </div>
    );
  } else if (route === "quality") {
    const tasks = scoped(data.inspections).filter((t) => t.remaining > 0);
    const task = selectDraftDocument(tasks, d.task);
    activeDocumentId = task?.id;
    const good = Number(value("good"));
    const bad = Number(value("bad"));
    content = !task ? emptyQueue(tasks, "task", (
      <Panel>
        <Empty
          title={t(
            "No inspections waiting",
            "Belum ada inspeksi yang menunggu",
          )}
          action={next("receiving", "Open receiving", "Buka penerimaan")}
        />
        {next("putaway", "View putaway tasks", "Lihat tugas penempatan")}
      </Panel>
    )) : (
      <div className="workflow-grid">
        {queue(tasks, task.id, (id) =>
          patch({ task: id, good: undefined, bad: undefined }),
          undefined,
        <Panel title={task.id}>
          <Summary
            items={[
              [t("Source", "Sumber"), task.source],
              itemDetails(task.sku),
              [
                t("Quantity to inspect", "Jumlah pemeriksaan"),
                `${task.remaining} ${t("units", "unit")}`,
              ],
              [t("Hold", "Penahanan"), t("Awaiting QC", "Menunggu QC")],
            ]}
          />
          {user.role === "operator" && (
            <Notice kind="warning">
              {t(
                "Switch to the admin demo user in Settings to record an inspection decision.",
                "Ganti ke pengguna demo admin di Pengaturan untuk mencatat keputusan inspeksi.",
              )}
            </Notice>
          )}
          {form(
            <>
              <div className="form-grid">
                {field(
                  t("Good quantity (units)", "Jumlah bagus (unit)"),
                  "good",
                  "",
                  {
                    type: "number",
                    min: 0,
                    max: task.remaining,
                    required: true,
                  },
                )}
                {field(
                  t("Not good quantity (units)", "Jumlah tidak bagus (unit)"),
                  "bad",
                  "",
                  {
                    type: "number",
                    min: 0,
                    max: task.remaining,
                    required: true,
                  },
                )}
              </div>
              {reasonField(bad > 0)}
              <Notice kind="warning">
                {t(
                  "Only inspected good stock proceeds to putaway. Not good stock stays on hold in QC.",
                  "Hanya stok yang sudah dinyatakan bagus yang lanjut ke penempatan. Stok tidak bagus tetap ditahan di QC.",
                )}
              </Notice>
            </>,
            () =>
              review(
                "qc",
                { task: task.id, good, bad, reason: value("reason") },
                [
                  itemDetails(task.sku),
                  [t("Good", "Bagus"), `${good} ${t("units", "unit")}`],
                  [
                    t("Not good / held", "Tidak bagus / ditahan"),
                    `${bad} ${t("units", "unit")}`,
                  ],
                ],
              ),
            t("Review inspection", "Tinjau pemeriksaan"),
            user.role === "operator",
          )}
          {next("putaway", "Continue to putaway", "Lanjut ke penempatan")}
        </Panel>,
        )}
      </div>
    );
  } else if (route === "putaway") {
    const tasks = scoped(data.putaways).filter((t) => t.remaining > 0);
    const task = selectDraftDocument(tasks, d.task);
    activeDocumentId = task?.id;
    const destination = value("destination", storageLocations[0] || "");
    const q = Number(value("qty"));
    content = !task ? emptyQueue(tasks, "task", (
      <Panel>
        <Empty
          title={t("No putaway tasks ready", "Belum ada tugas penempatan siap")}
          action={next(
            "quality",
            "Open quality inspection",
            "Buka pemeriksaan kualitas",
          )}
        />
      </Panel>
    )) : (
      <div className="workflow-grid">
        {queue(tasks, task.id, (id) => patch({ task: id, qty: undefined }),
          undefined,
        <Panel title={task.id}>
          <Summary
            items={[
              [t("Source", "Sumber"), task.source],
              itemDetails(task.sku),
              [t("From", "Dari"), "Receiving"],
              [
                t("Remaining", "Sisa"),
                `${task.remaining} ${t("units", "unit")}`,
              ],
            ]}
          />
          {form(
            <>
              <div className="form-grid">
                {select(
                  t("Destination location", "Lokasi tujuan"),
                  "destination",
                  storageLocations.map((location) => [location, location]),
                  storageLocations[0] || "",
                )}
                {scanLocation(destination)}
                {scanField(task.sku)}
                {qtyField(task.remaining, task.remaining)}
              </div>
              <Notice>
                {t(
                  "Selecting a location does not verify physical placement. Scan its location code.",
                  "Memilih lokasi belum membuktikan penempatan fisik. Pindai kode lokasinya.",
                )}
              </Notice>
            </>,
            () =>
              review(
                "putaway",
                {
                  task: task.id,
                  scan: value("scan"),
                  qty: q,
                  destination,
                  locationScan: value("locationScan"),
                },
                [
                  itemDetails(task.sku),
                  [t("From / to", "Dari / ke"), `Receiving / ${destination}`],
                  quantityDetails(q),
                ],
              ),
            t("Review putaway", "Tinjau penempatan"),
          )}
          {next("stock", "View stock position", "Lihat posisi stok")}
        </Panel>,
        )}
      </div>
    );
  } else if (["reservations", "picking", "shipping"].includes(route)) {
    const orders = scoped(data.orders).filter(
      (o) => o.status === "released" && !o.cancelled,
    );
    const stageQty = (order) => route === "reservations" ? Math.max(0, order.qty - order.shipped - Object.values(order.allocations as Record<string, number>).reduce((a: number, b: number) => a + b, 0)) : route === "picking" ? Object.entries(order.allocations as Record<string, number>).filter(([loc]) => loc !== "Staging").reduce((sum: number, [, qty]) => sum + qty, 0) : order.allocations.Staging || 0;
    const canWork = (order) => stageQty(order) > 0 && (route !== "reservations" || data.positions.some((position) => position.sku === order.sku && position.warehouse === warehouse && position.condition === "good" && !position.hold && !position.frozen && available(position) > 0));
    const preferred = orders.find(canWork);
    const o = selectDraftDocument(orders, d.order, preferred);
    activeDocumentId = o?.id;
    const eligible = data.positions.filter(
      (p) =>
        p.sku === o?.sku &&
        p.warehouse === warehouse &&
        p.condition === "good" &&
        !p.hold && !p.frozen && available(p) > 0,
    );
    const locations = route === "picking" ? Object.keys(o?.allocations || {}).filter((location) => location !== "Staging" && o?.allocations[location] > 0) : eligible.map((p) => p.location);
    const location = locations.includes(value("location")) ? value("location") : locations[0] || "";
    const p = eligible.find((position) => position.location === location);
    const reserved = o
      ? Object.values(o.allocations as Record<string, number>).reduce(
          (a, b) => a + b,
          0,
        )
      : 0;
    const remaining = o ? o.qty - o.shipped : 0;
    const max =
      route === "reservations"
        ? remaining - reserved
        : route === "picking"
          ? o?.allocations[location] || 0
          : o?.allocations.Staging || 0;
    const q = Number(value("qty"));
    const ready = route !== "shipping" || data.partialAllowed ||
      (max >= remaining && (!validQty(max) || q === remaining));
    content = !o ? emptyQueue(orders.map((order) => ({ ...order, remaining: stageQty(order), status: canWork(order) ? "ready" : "waiting" })), "order", (
      <Panel>
        <Empty
          title={t(
            "No released orders in this warehouse",
            "Belum ada order yang dilepas di gudang ini",
          )}
          action={next(
            "orders",
            "Open orders and approvals",
            "Buka order dan persetujuan",
          )}
        />
      </Panel>
    )) : (
      <div className="workflow-grid">
        {queue(
          orders.map((o) => ({ ...o, remaining: stageQty(o), status: canWork(o) ? "ready" : "waiting" })),
          o.id,
          (id) =>
            patch({
              order: id,
              qty: undefined,
              scan: "",
              locationScan: "",
              location: undefined,
              packed: false,
              reason: "",
              reasonError: false,
            }),
          undefined,
        <Panel title={o.id} action={<Tag>{t("Released", "Dilepas")}</Tag>}>
          <Summary
            items={[
              [t("Item", "Barang"), o.sku],
              [
                t("Order quantity", "Jumlah order"),
                `${o.qty} ${t("units", "unit")}`,
              ],
              [
                t("Reserved for orders", "Dipesan"),
                `${reserved} ${t("units", "unit")}`,
              ],
              [t("Picked", "Diambil"), `${o.picked} ${t("units", "unit")}`],
              [t("Shipped", "Terkirim"), `${o.shipped} ${t("units", "unit")}`],
              [
                t("Open order quantity", "Sisa order"),
                `${remaining} ${t("units", "unit")}`,
              ],
            ]}
          />
          {max <= 0 ? (
            <Empty
              title={
                route === "reservations"
                  ? t(
                      "Order is fully allocated",
                      "Order sudah dialokasikan seluruhnya",
                    )
                  : route === "picking"
                    ? t(
                        "No reserved stock ready to pick",
                        "Belum ada stok dipesan yang siap diambil",
                      )
                    : t(
                        "No picked stock ready to ship",
                        "Belum ada stok diambil yang siap dikirim",
                      )
              }
              action={next(
                route === "shipping"
                  ? "picking"
                  : route === "picking"
                    ? "reservations"
                    : "picking",
                route === "shipping"
                  ? "Open picking"
                  : route === "picking"
                    ? "Open reservations"
                    : "Open picking",
                route === "shipping"
                  ? "Buka pengambilan"
                  : route === "picking"
                    ? "Buka reservasi"
                    : "Buka pengambilan",
              )}
            />
          ) : (
            form(
              <>
                {route === "reservations" ? (
                  <>
                    <Summary
                      items={[
                        [t("Location", "Lokasi"), location],
                        [
                          t("Available", "Tersedia"),
                          `${p ? available(p) : 0} ${t("units", "unit")}`,
                        ],
                        [
                          t("After reservation", "Setelah reservasi"),
                          validQty(Math.min(max, p ? available(p) : 0)) ? `${(p ? available(p) : 0) - q} ${t("units", "unit")}` : "—",
                        ],
                      ]}
                    />
                    {q > (p ? available(p) : 0) && (
                      <Notice kind="warning">
                        {t(
                          "Cannot reserve the full quantity. Review the shortage; partial allocation is not automatic.",
                          "Jumlah penuh belum bisa dipesan. Tinjau kekurangannya; alokasi parsial tidak otomatis.",
                        )}
                      </Notice>
                    )}
                  </>
                ) : (
                  <>
                    <div className="form-grid">
                      {scanField(o.sku)}
                      {route === "picking" && scanLocation(location)}
                    </div>
                    <Notice>
                      {route === "picking"
                        ? t(
                            "Actual moves to Staging. Warehouse stock has not departed.",
                            "Aktual berpindah ke Staging. Barang belum keluar dari gudang.",
                          )
                        : t(
                            "Confirming records physical departure. ERP synchronization is a separate result.",
                            "Konfirmasi mencatat barang keluar secara fisik. Sinkronisasi ERP memiliki hasil terpisah.",
                          )}
                    </Notice>
                  </>
                )}
                {route !== "shipping" && locations.length > 0 && select(t("Source location", "Lokasi sumber"), "location", locations.map((loc) => [loc, loc]), location)}
                {qtyField(route === "picking" ? Math.min(20, max) : max, max)}
                {route === "picking" && reasonField(q < max)}
                {route === "shipping" && (
                  <>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        required
                        checked={!!d.packed}
                        onChange={(e) => patch({ packed: e.target.checked })}
                      />
                      {t(
                        "I have verified the packed item and quantity.",
                        "Saya sudah mencocokkan barang dan jumlah dalam paket.",
                      )}
                    </label>
                    {!ready && (
                      <Notice kind="warning">
                        {max < remaining ? t(
                          `Full shipment requires ${remaining} units; only ${max} are ready in Staging. Complete picking before shipment.`,
                          `Pengiriman penuh memerlukan ${remaining} unit; baru ${max} siap di Staging. Selesaikan picking sebelum pengiriman.`,
                        ) : t(
                          `Partial shipments are not allowed. Enter ${remaining} units to ship the full remaining quantity.`,
                          `Pengiriman parsial tidak diizinkan. Isi ${remaining} unit untuk mengirim seluruh sisa order.`,
                        )}
                      </Notice>
                    )}
                  </>
                )}
              </>,
              () =>
                review(
                  {
                    reservations: "reserve",
                    picking: "pick",
                    shipping: "ship",
                  }[route],
                  {
                    order: o.id,
                    location,
                    scan: value("scan"),
                    locationScan: value("locationScan"),
                    qty: q,
                    reason: value("reason"),
                    packingVerified:
                      route === "shipping" ? !!d.packed : undefined,
                  },
                  [
                    [t("Order", "Order"), o.id],
                    itemDetails(o.sku),
                    quantityDetails(q),
                    [
                      t("Effect", "Dampak"),
                      route === "reservations"
                        ? t(
                            "Reserve only; physical stock unchanged",
                            "Hanya dipesan; stok fisik tetap",
                          )
                        : route === "picking"
                          ? t(
                              `${location} to Staging; reservation follows`,
                              `${location} ke Staging; reservasi ikut`,
                            )
                          : t(
                              "Stock departs; related reservation fulfilled",
                              "Stok keluar; reservasi terkait terpenuhi",
                            ),
                    ],
                  ],
                ),
              t("Review", "Tinjau"),
              !ready || !location && route !== "shipping" || q > (route === "reservations" ? (p ? available(p) : 0) : max),
            )
          )}
          <div className="next-actions">
            {next("orders", "View order", "Lihat order", o.id)}
            {next(
              route === "reservations"
                ? "picking"
                : route === "picking"
                  ? "shipping"
                  : "movements",
              route === "reservations"
                ? "Continue to picking"
                : route === "picking"
                  ? "Continue to packing"
                  : "View stock movements",
              route === "reservations"
                ? "Lanjut ke pengambilan"
                : route === "picking"
                  ? "Lanjut ke packing"
                  : "Lihat kartu stok",
              route === "shipping" ? undefined : o.id,
            )}
          </div>
        </Panel>,
        )}
      </div>
    );
  } else if (route === "orders") {
    const orders = scoped(data.orders);
    const o = selectDraftDocument(orders, d.order, orders.find((order) => order.status === "pending-approval"));
    activeDocumentId = o?.id;
    content = (
      <>
        <div className="section-actions">
          <Button primary onClick={() => setNewOrder(true)}>
            <Plus size={18} />
            {t("New order", "Order baru")}
          </Button>
        </div>
        <div className="workflow-grid">
          {queue(orders, o?.id, (id) => patch({ order: id }),
          undefined,
        <Panel title={o?.id || t("Order details", "Detail order")}>
            {!o ? (
              <Empty title={t("No orders yet", "Belum ada order")} />
            ) : (
              <>
                <Summary
                  items={[
                    [t("Item", "Barang"), o.sku],
                    [
                      t("Requested", "Diminta"),
                      `${o.qty} ${t("units", "unit")}`,
                    ],
                    [t("Status", "Status"), o.status],
                    [t("Created by", "Dibuat oleh"), o.creator],
                    [
                      t("Allocated", "Dialokasikan"),
                      Object.values(
                        o.allocations as Record<string, number>,
                      ).reduce((a, b) => a + b, 0),
                    ],
                    [
                      t(
                        "Picked / shipped / remaining",
                        "Diambil / terkirim / sisa",
                      ),
                      `${o.picked} / ${o.shipped} / ${o.qty - o.shipped} ${t("units", "unit")}`,
                    ],
                  ]}
                />
                {o.status === "draft" ? (
                  <Button
                    primary
                    onClick={() => {
                      setData((s) => ({
                        ...s,
                        orders: s.orders.map((r) =>
                          r.id === o.id
                            ? { ...r, status: "pending-approval" }
                            : r,
                        ),
                      }));
                      flash(
                        t(
                          "Order submitted for approval. Stock is unchanged.",
                          "Order diajukan untuk persetujuan. Stok tetap.",
                        ),
                      );
                    }}
                  >
                    {t("Submit for approval", "Ajukan persetujuan")}
                  </Button>
                ) : ["pending-approval", "approved"].includes(o.status) ? (
                  <div className="stack">
                    <Notice>
                      {t(
                        "Approval and release are separate steps. Stock is reserved during allocation.",
                        "Persetujuan dan pelepasan adalah langkah terpisah. Stok dipesan saat alokasi.",
                      )}
                    </Notice>
                    {reasonField(o.status === "pending-approval")}
                    {o.status === "pending-approval" && data.approvalPolicy?.orderReview === "admin" && user.role !== "admin" && <Notice>{t("This warehouse requires an administrator to review orders.", "Gudang ini mewajibkan admin untuk meninjau order.")}</Notice>}
                    <div className="form-actions">
                      {o.status === "pending-approval" && (
                        <Button
                          danger
                          disabled={
                            user.role === "operator" || o.creator === user.id || (data.approvalPolicy?.orderReview === "admin" && user.role !== "admin")
                          }
                          onClick={() => {
                            if (!String(value("reason")).trim()) {
                              patch({ reasonError: true });
                              (document.querySelector('input[required][name="reason"]') as HTMLInputElement)?.focus();
                              return;
                            }
                            review(
                              "reject-order",
                              { order: o.id, reason: value("reason") },
                              [
                                [t("Order", "Order"), o.id],
                                [t("Reason", "Alasan"), value("reason")],
                              ],
                            );
                          }}
                        >
                          {t("Return for review", "Kembalikan untuk ditinjau")}
                        </Button>
                      )}
                      <Button
                        primary
                        disabled={
                          user.role === "operator" ||
                          (o.status === "pending-approval" &&
                            (o.creator === user.id || (data.approvalPolicy?.orderReview === "admin" && user.role !== "admin")))
                        }
                        onClick={() =>
                          review(
                            o.status === "approved"
                              ? "release-order"
                              : "approve-order",
                            { order: o.id },
                            [
                              [t("Order", "Order"), o.id],
                              [
                                t("Action", "Tindakan"),
                                o.status === "approved"
                                  ? t(
                                      "Release; no stock effect",
                                      "Lepas; belum mengubah stok",
                                    )
                                  : t(
                                      "Approve; no stock effect",
                                      "Setujui; belum mengubah stok",
                                    ),
                              ],
                            ],
                          )
                        }
                      >
                        {o.status === "approved"
                          ? t("Release order", "Lepas order")
                          : t("Approve order", "Setujui order")}
                      </Button>
                    </div>
                    {user.role === "operator" && (
                      <small>
                        {t(
                          "Use an authorized reviewer demo account in Settings.",
                          "Gunakan akun demo peninjau yang berwenang di Pengaturan.",
                        )}
                      </small>
                    )}
                  </div>
                ) : (
                  next("reservations", "Open reservations", "Buka reservasi")
                )}
              </>
            )}
          </Panel>,
        )}
      </div>
        {newOrder && (
          <Modal
            title={t("New order draft", "Draf order baru")}
            onClose={() => {
              if (!creatingOrder) setNewOrder(false);
            }}
          >
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newProduct || creatingOrder) return;
                setCreatingOrder(true);
                setNewOrderError("");
                const id = `SO-SIM-${1004 + data.orders.length - 3}`;
                try {
                  const saved = await setData((s) => ({
                    ...s,
                    orders: [
                      ...s.orders,
                      {
                        id,
                        sku: newSku,
                        qty: Number(newQty),
                        status: "draft",
                        creator: user.id,
                        warehouse,
                        picked: 0,
                        shipped: 0,
                        returned: 0,
                        allocations: {},
                        cancelled: false,
                        documentDate: d.newOrderDate || "",
                        scheduledDate: d.newOrderSchedule || "",
                      },
                    ],
                  }));
                  if (saved === false) {
                    setNewOrderError(
                      t(
                        "Order could not be saved. Keep this draft and try again.",
                        "Order belum tersimpan. Pertahankan draf ini dan coba lagi.",
                      ),
                    );
                    return;
                  }
                  patch({ order: id, newOrderSku: "", newOrderQty: "", newOrderDate: "", newOrderSchedule: "" });
                  setNewOrder(false);
                } catch {
                  setNewOrderError(
                    t(
                      "Order could not be saved. Keep this draft and try again.",
                      "Order belum tersimpan. Pertahankan draf ini dan coba lagi.",
                    ),
                  );
                } finally {
                  setCreatingOrder(false);
                }
              }}
            >
              <Field label={t("Item (required)", "Barang (wajib)")}>
                <Lookup
                  required
                  disabled={creatingOrder}
                  value={newSku}
                  options={productSuggestions(data.products, true)}
                  onValueChange={setNewSku}
                  placeholder={t(
                    "Search item name, SKU or barcode",
                    "Cari nama barang, SKU, atau barcode",
                  )}
                />
              </Field>
              <Field label={t("Document date (blank uses today's warehouse date)", "Tanggal dokumen (kosong memakai tanggal gudang hari ini)")} type="date" value={d.newOrderDate || ""} disabled={creatingOrder} onChange={e => patch({ newOrderDate: e.target.value })} />
              <Field label={t("Scheduled shipment date", "Rencana tanggal kirim")} type="date" value={d.newOrderSchedule || ""} disabled={creatingOrder} onChange={e => patch({ newOrderSchedule: e.target.value })} />
              {newOrderError && <Notice kind="error">{newOrderError}</Notice>}
              {newProduct && (
                <Summary
                  items={[
                    ["SKU", newProduct.sku],
                    [t("Category", "Kategori"), newProduct.category || "–"],
                    [t("Base unit", "Satuan dasar"), newProduct.unit],
                    ["Barcode", newProduct.barcode],
                  ]}
                />
              )}
              <Field
                label={t("Quantity (units)", "Jumlah (unit)")}
                type="number"
                min="1"
                step="1"
                required
                value={newQty}
                disabled={creatingOrder}
                onChange={(e) => setNewQty(e.target.value)}
              />
              <Button
                primary
                type="submit"
                disabled={!newProduct || creatingOrder}
              >
                {creatingOrder
                  ? t("Saving…", "Lagi menyimpan…")
                  : t("Create draft", "Buat draf")}
              </Button>
            </form>
          </Modal>
        )}
      </>
    );
  } else if (route === "cancellation") {
    const mode = value("mode", "cancel");
    const orders = scoped(data.orders).filter((o) => !o.cancelled);
    const o = selectDraftDocument(orders, d.order);
    const tasks = scoped(data.returnTasks).filter((r) => r.remaining > 0);
    const task = selectDraftDocument(tasks, d.task);
    activeDocumentId = mode === "cancel" ? o?.id : task?.id;
    const q = Number(value("qty", task?.remaining || 0));
    const destination = value("destination", storageLocations[0] || "");
    content = (
      <Panel
        title={t(
          "Cancellation and return to stock",
          "Pembatalan dan kembali stok",
        )}
      >
        <Tabs
          label={t("Cancellation steps", "Langkah pembatalan")}
          items={[
            ["cancel", t("Cancel order", "Batalkan order")],
            ["return", t("Return tasks", "Tugas pengembalian")],
          ]}
          value={mode}
          onChange={(m) => patch({ mode: m })}
        />
        {mode === "cancel" ? (
          o ? (
            <>
              {select(
                t("Order", "Order"),
                "order",
                orders.map((o) => [o.id, o.id]),
                o.id,
              )}
              <Summary
                items={[
                  [
                    t("Unpicked reservation", "Reservasi belum diambil"),
                    Object.entries(o.allocations as Record<string, number>)
                      .filter(([l]) => l !== "Staging")
                      .reduce((n, [, q]) => n + q, 0),
                  ],
                  [
                    t("Picked in staging", "Sudah diambil ke staging"),
                    o.allocations.Staging || 0,
                  ],
                  [t("Already shipped", "Sudah terkirim"), o.shipped],
                ]}
              />
              {form(
                <>
                  {reasonField(true)}
                  <Notice kind="warning">
                    {t(
                      "Picked items remain reserved until a physical return is confirmed. Shipped items follow the returns process.",
                      "Barang yang diambil tetap dipesan sampai pengembalian fisik dikonfirmasi. Barang terkirim mengikuti proses retur.",
                    )}
                  </Notice>
                </>,
                () =>
                  review("cancel", { order: o.id, reason: value("reason") }, [
                    [t("Order", "Order"), o.id],
                    [t("Reason", "Alasan"), value("reason")],
                    [
                      t("Staging kept reserved", "Staging tetap dipesan"),
                      o.allocations.Staging || 0,
                    ],
                  ]),
                t("Review cancellation", "Tinjau pembatalan"),
                user.role === "operator",
              )}
            </>
          ) : (
            <Empty
              title={t(
                "No cancellable orders",
                "Tidak ada order yang bisa dibatalkan",
              )}
            />
          )
        ) : task ? (
          <>
            {select(
              t("Return task", "Tugas pengembalian"),
              "task",
              tasks.map((t) => [t.id, t.id]),
              task.id,
            )}
            <Summary
              items={[
                [t("Order", "Order"), task.order],
                [t("From", "Dari"), "Staging"],
                [t("Remaining to return", "Sisa kembali"), task.remaining],
              ]}
            />
            {form(
              <div className="form-grid">
                {scanField(task.sku)}
                {select(
                  t("Destination", "Tujuan"),
                  "destination",
                  storageLocations.map((location) => [location, location]),
                  storageLocations[0] || "",
                )}
                {scanLocation(destination)}
                {qtyField(task.remaining, task.remaining)}
              </div>,
              () =>
                review(
                  "return-stock",
                  {
                    task: task.id,
                    qty: q,
                    scan: value("scan"),
                    destination,
                    locationScan: value("locationScan"),
                  },
                  [
                    itemDetails(task.sku),
                    quantityDetails(q),
                    [t("From / to", "Dari / ke"), `Staging / ${destination}`],
                  ],
                ),
              t("Review stock return", "Tinjau barang kembali"),
            )}
          </>
        ) : (
          <Empty
            title={t(
              "No physical returns waiting",
              "Belum ada pengembalian fisik yang menunggu",
            )}
          />
        )}
        {next(
          "returns",
          "Open customer returns for shipped items",
          "Buka retur pelanggan untuk barang terkirim",
        )}
      </Panel>
    );
  } else if (route === "transfers") {
    const mode = value("mode", "receive");
    const docs = data.transfers.filter((tr) =>
      mode === "receive" ? tr.to === warehouse : tr.from === warehouse,
    );
    const doc = selectDraftDocument(docs, d.document);
    activeDocumentId = doc?.id;
    const remaining = doc ? doc.sent - doc.received : 0;
    const q = Number(
      value("qty", mode === "receive" ? Math.min(48, remaining) : 50),
    );
    content = (
      <Panel title={t("Transfer workspace", "Ruang kerja transfer")}>
        <Tabs
          label={t("Transfer action", "Tindakan transfer")}
          items={[
            ["receive", t("Incoming transfers", "Transfer masuk")],
            ["send", t("Dispatch transfer", "Kirim transfer")],
          ]}
          value={mode}
          onChange={(mode) =>
            patch({ mode, document: undefined, qty: undefined, scan: "", locationScan: "" })
          }
        />
        <div className="work-queue-table operational-date-table" role="region" tabIndex={0} aria-label={t("Transfer documents", "Dokumen transfer")}><DataTable label={t("Transfer documents", "Dokumen transfer")} rows={docs} selected={doc?.id}
          onSelect={row => patch({ document: row.id, qty: undefined, scan: "", locationScan: "" })}
          columns={[
            { key: "id", label: t("Document", "Dokumen") },
            { key: "from", label: t("From", "Dari") }, { key: "to", label: t("To", "Ke") },
            { key: "scheduledDate", label: t("Planned arrival", "Rencana tiba"), render: row => date(row.scheduledDate) },
            { key: "updatedAt", label: t("Last updated", "Terakhir diubah"), render: row => <TableTimestamp value={row.updatedAt} /> },
            { key: "completedAt", label: t("Received in full", "Diterima seluruhnya"), render: row => <TableTimestamp value={row.completedAt} /> },
          ]} empty={t("No transfer documents in this view.", "Belum ada dokumen transfer pada tampilan ini.")} /></div>
        {mode === "receive" ? (
          !doc ? (
            <Empty
              title={t("No incoming transfers", "Belum ada transfer masuk")}
            />
          ) : (
            <>
              {select(
                t("Transfer document", "Dokumen transfer"),
                "document",
                docs.map((d) => [d.id, d.id]),
                doc.id,
              )}
              <Summary
                items={[
                  [t("From", "Dari"), doc.from],
                  [t("To", "Ke"), doc.to],
                  [t("Sent", "Dikirim"), `${doc.sent} ${t("units", "unit")}`],
                  [
                    t("Received", "Diterima"),
                    `${doc.received} ${t("units", "unit")}`,
                  ],
                  [
                    t("In transit", "Dalam perjalanan"),
                    `${remaining} ${t("units", "unit")}`,
                  ],
                ]}
              />
              {remaining > 0 ? (
                form(
                  <>
                    <div className="form-grid">
                      {scanField(doc.sku)}
                      {qtyField(Math.min(48, remaining), remaining)}
                    </div>
                    <Notice>
                      {t(
                        "Any unreceived units remain in transit. Receiving does not write off the difference.",
                        "Unit yang belum diterima tetap dalam perjalanan. Penerimaan tidak menghapus selisih.",
                      )}
                    </Notice>
                  </>,
                  () =>
                    review(
                      "transfer-receive",
                      { document: doc.id, scan: value("scan"), qty: q },
                      [
                        [t("Transfer", "Transfer"), doc.id],
                        quantityDetails(q),
                        [
                          t("Remaining in transit", "Sisa dalam perjalanan"),
                          `${remaining - q} ${t("units", "unit")}`,
                        ],
                      ],
                    ),
                  t("Review actual receipt", "Tinjau terima aktual"),
                )
              ) : (
                <Notice kind="success">
                  {t(
                    "Transfer received in full.",
                    "Transfer diterima seluruhnya.",
                  )}
                </Notice>
              )}
            </>
          )
        ) : (
          form(
            <>
              <Summary
                items={[
                  [t("From", "Dari"), warehouse],
                  [t("To", "Ke"), transferTarget],
                  [t("Item / location", "Barang / lokasi"), `${operationSku} · ${operationLocation}`],
                ]}
              />
              <div className="form-grid">
                {itemField}
                {select(t("Location", "Lokasi"), "location", operationLocations.map((location) => [location, location]), operationLocation)}
                {select(t("Destination warehouse", "Gudang tujuan"), "to", transferTargets.map((row) => [row.name, row.name]), transferTarget)}
                {scanField(operationSku)}
                {scanLocation(operationLocation)}
                {qtyField(50)}
              </div>
            </>,
            () =>
              review(
                "transfer-send",
                {
                  sku: operationSku,
                  location: operationLocation,
                  locationScan: value("locationScan"),
                  scan: value("scan"),
                  qty: q,
                  to: transferTarget,
                },
                [
                  itemDetails(operationSku),
                  quantityDetails(q),
                  [
                    t("Destination", "Tujuan"),
                    transferTarget,
                  ],
                ],
              ),
            t("Review dispatch", "Tinjau pengiriman"),
          )
        )}
      </Panel>
    );
  } else if (route === "returns") {
    const mode = value("mode", "customer");
    const sku = operationSku;
    const source = value("source", "");
    const q = Number(value("qty"));
    content = (
      <Panel title={t("Return details", "Detail retur")}>
        <Tabs
          label={t("Return type", "Jenis retur")}
          items={[
            ["customer", t("Customer return", "Retur pelanggan")],
            ["supplier", t("Supplier return", "Retur supplier")],
          ]}
          value={mode}
          onChange={(mode) =>
            patch({ mode, source: undefined, qty: undefined, scan: "" })
          }
        />
        {form(
          <>
            <div className="form-grid">
              {itemField}
              {field(
                t("Source document (required)", "Dokumen asal (wajib)"),
                "source",
                "",
                { required: true, suggestions: (data.returnSources || []).filter((row) => row.sku === sku && row.type === mode).map((row) => ({ value: row.id, label: row.id })) },
              )}
              {scanField(sku)}
              {qtyField(5)}
              {reasonField(true)}
            </div>
            <Notice>
              {mode === "customer"
                ? t(
                    "Use a confirmed shipment transaction as the source. Returned items enter Receiving on QC hold.",
                    "Gunakan transaksi pengiriman terkonfirmasi sebagai sumber. Barang retur masuk Receiving dan ditahan untuk QC.",
                  )
                : t(
                    "Supplier return uses unreserved, not good stock at QC. A separate confirmed dispatch reduces physical stock.",
                    "Retur supplier memakai stok tidak bagus yang tidak dipesan di QC. Konfirmasi pengiriman terpisah mengurangi stok fisik.",
                  )}
            </Notice>
          </>,
          () =>
            review(
              mode === "customer" ? "customer-return" : "supplier-return",
              {
                sku,
                source,
                scan: value("scan"),
                qty: q,
                reason: value("reason"),
              },
              [
                [t("Source", "Sumber"), source],
                itemDetails(sku),
                quantityDetails(q),
                [
                  t("Result", "Hasil"),
                  mode === "customer"
                    ? "Receiving · QC"
                    : t(
                        "Physical dispatch to supplier",
                        "Pengiriman fisik ke supplier",
                      ),
                ],
              ],
            ),
          mode === "customer"
            ? t("Review return receipt", "Tinjau penerimaan retur")
            : t("Review return dispatch", "Tinjau pengiriman retur"),
          mode === "supplier" && user.role === "operator",
        )}
        {next(
          "quality",
          "Open quality inspection",
          "Buka pemeriksaan kualitas",
        )}
        <DataTable
          label={t("Return history", "Riwayat retur")}
          empty={t("No returns recorded yet.", "Belum ada retur tercatat.")}
          rows={scoped(data.returns)}
          selected={d.exportReturnId}
          onSelect={row => applyDraft({ ...d, exportReturnId: row.id })}
          columns={[
            { key: "id", label: t("Transaction", "Transaksi") },
            { key: "source", label: t("Source", "Sumber") },
            { key: "sku", label: t("Item", "Barang") },
            { key: "createdAt", label: t("Recorded at", "Waktu pencatatan"), render: row => <TableTimestamp value={row.createdAt} /> },
            {
              key: "qty",
              label: t("Actual (units)", "Aktual (unit)"),
              numeric: true,
            },
          ]}
        />
      </Panel>
    );
  } else if (route === "count") {
    const task = selectDraftDocument(scoped(data.counts).filter((count) => count.status !== "closed" || count.id === d.task), d.task);
    activeDocumentId = task?.id;
    const reviewer =
      user.role !== "operator" && value("view", "count") === "review";
    const q = Number(value("qty", ""));
    content = (
      <Panel title={t("Count workspace", "Ruang kerja opname")}>
        {user.role !== "operator" && (
          <Tabs
            label={t("Count view", "Tampilan hitung")}
            items={[
              ["count", t("Counting view", "Tampilan penghitung")],
              ["review", t("Authorized review", "Tinjauan berwenang")],
            ]}
            value={value("view", "count")}
            onChange={(view) => patch({ view })}
          />
        )}
        <div className="work-queue-table operational-date-table" role="region" tabIndex={0} aria-label={t("Count tasks", "Tugas opname")}><DataTable label={t("Count tasks", "Tugas opname")} rows={scoped(data.counts)} selected={task?.id}
          onSelect={row => patch({ task: row.id, qty: undefined, reason: "" })}
          columns={[
            { key: "id", label: t("Task", "Tugas"), render: row => <span className="table-document-id" title={row.id}><Reference value={row.id} /></span> },
            { key: "sku", label: t("Item / SKU", "Barang / SKU") },
            { key: "location", label: t("Location", "Lokasi") },
            { key: "status", label: t("Status", "Status") },
            { key: "scheduledDate", label: t("Planned count", "Rencana hitung"), render: row => date(row.scheduledDate) },
            { key: "startedAt", label: t("Started", "Dimulai"), render: row => <TableTimestamp value={row.startedAt} /> },
            { key: "submittedAt", label: t("Submitted", "Diajukan"), render: row => <TableTimestamp value={row.submittedAt} /> },
            { key: "approvedAt", label: t("Approved", "Disetujui"), render: row => <TableTimestamp value={row.approvedAt} /> },
            { key: "completedAt", label: t("Closed", "Ditutup"), render: row => <TableTimestamp value={row.completedAt} /> },
          ]} empty={t("No count tasks in this warehouse.", "Belum ada tugas opname di gudang ini.")} /></div>
        {!task ? (
          <>
            <Empty
              title={t("No active count task", "Belum ada tugas hitung aktif")}
            />
            {user.role !== "operator" && (
              <div className="stack">
              {itemField}
              {select(t("Location", "Lokasi"), "location", (data.locationMaster || []).filter((row) => !row.frozen).map((row) => [row.name, row.name]), operationLocation)}
              <Button
                primary
                onClick={() =>
                  review("freeze", { sku: operationSku, location: operationLocation }, [
                    [t("Scope", "Lingkup"), `${warehouse} · ${operationLocation} · ${operationSku}`],
                    [
                      t("Effect", "Dampak"),
                      t(
                        "Freeze the selected location and create a blind count task",
                        "Bekukan lokasi terpilih dan buat tugas hitung tanpa saldo",
                      ),
                    ],
                  ])
                }
              >
                {t(
                  "Freeze location and start count",
                  "Bekukan lokasi dan mulai hitung",
                )}
              </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {select(t("Count task", "Tugas hitung"), "task", scoped(data.counts).map((count) => [count.id, `${count.id} · ${count.sku} · ${count.location}`]), task.id)}
            <Summary
              items={[
                [t("Count task", "Tugas hitung"), task.id],
                [t("Item", "Barang"), task.sku],
                [t("Location", "Lokasi"), task.location],
                [t("Status", "Status"), task.status],
              ]}
            />
            <Notice kind="warning">
              {t(
                "This location remains frozen until an authorized release. Closing the browser does not release it.",
                "Lokasi tetap dibekukan sampai dibuka oleh pengguna berwenang. Menutup browser tidak membukanya.",
              )}
            </Notice>
            {reviewer ? (
              <>
                <Summary
                  items={[
                    [t("Snapshot (units)", "Snapshot (unit)"), task.expected],
                    [
                      t("Counted (units)", "Hasil hitung (unit)"),
                      task.actual ?? t("Not submitted", "Belum dikirim"),
                    ],
                    [
                      t("Difference (units)", "Selisih (unit)"),
                      task.actual === null
                        ? t("Not available", "Belum tersedia")
                        : task.actual - task.expected,
                    ],
                    [
                      t("Counter", "Penghitung"),
                      task.counter || t("Not assigned yet", "Belum ditetapkan"),
                    ],
                  ]}
                />
                {task.status === "review" && (
                  <>
                    {data.approvalPolicy?.countReview === "admin" && user.role !== "admin" && <Notice>{t("This warehouse requires an administrator to approve count adjustments.", "Gudang ini mewajibkan admin untuk menyetujui penyesuaian opname.")}</Notice>}
                    {reasonField(true)}
                    <div className="form-actions">
                      <Button
                        onClick={() =>
                          review("recount", { task: task.id }, [
                            [t("Task", "Tugas"), task.id],
                            [
                              t("Action", "Tindakan"),
                              t(
                                "Create another count attempt",
                                "Buat percobaan hitung lagi",
                              ),
                            ],
                          ])
                        }
                      >
                        {t("Request recount", "Minta hitung ulang")}
                      </Button>
                      <Button
                        primary
                        disabled={task.counter === user.id || (data.approvalPolicy?.countReview === "admin" && user.role !== "admin")}
                        onClick={() =>
                          review(
                            "adjust-count",
                            { task: task.id, reason: value("reason") },
                            [
                              [t("Task", "Tugas"), task.id],
                              [
                                t("Adjustment", "Penyesuaian"),
                                `${task.actual - task.expected} ${t("units", "unit")}`,
                              ],
                              [t("Reason", "Alasan"), value("reason")],
                            ],
                          )
                        }
                      >
                        {t("Approve adjustment", "Setujui penyesuaian")}
                      </Button>
                    </div>
                    {task.counter === user.id && (
                      <Notice>
                        {t(
                          "A different authorized reviewer must approve your count. Switch demo user in Settings.",
                          "Peninjau berwenang lain perlu menyetujui hasil kamu. Ganti pengguna demo di Pengaturan.",
                        )}
                      </Notice>
                    )}
                  </>
                )}
                {task.status === "adjusted" && (
                  <Button
                    primary
                    onClick={() =>
                      review("unfreeze", { task: task.id }, [
                        [t("Task", "Tugas"), task.id],
                        [
                          t("Location to release", "Lokasi yang dibuka"),
                          task.location,
                        ],
                      ])
                    }
                  >
                    {t("Release location freeze", "Buka pembekuan lokasi")}
                  </Button>
                )}
              </>
            ) : task.status === "counting" ? (
              form(
                <>
                  {field(
                    t(
                      "Counted quantity (units, required)",
                      "Hasil hitung (unit, wajib)",
                    ),
                    "qty",
                    "",
                    { type: "number", min: 0, step: 1, required: true },
                  )}
                  <Notice>
                    {t(
                      "Enter your physical count. The expected balance is hidden. Submission does not adjust stock.",
                      "Isi hasil hitung fisik kamu. Saldo pembanding disembunyikan. Mengirim hasil belum menyesuaikan stok.",
                    )}
                  </Notice>
                </>,
                () =>
                  review("count-submit", { task: task.id, qty: q }, [
                    [t("Task", "Tugas"), task.id],
                    [t("Counted", "Terhitung"), `${q} ${t("units", "unit")}`],
                  ]),
                t("Submit count", "Kirim hasil hitung"),
              )
            ) : (
              <Notice>
                {t(
                  "Count submitted. An authorized reviewer handles the next step.",
                  "Hasil hitung dikirim. Peninjau berwenang menangani langkah berikutnya.",
                )}
              </Notice>
            )}
          </>
        )}
      </Panel>
    );
  }
  const exportDocument = [...data.receipts, ...data.orders, ...data.counts, ...data.transfers, ...data.returns].find(row => row.id === (route === "returns" ? d.exportReturnId : activeDocumentId));
  const exportOptions: ExportOption[] = [];
  if (exportDocument) {
    if (route === "receiving") exportOptions.push({ type: "receive", events: "receive", label: t("Receipt transaction", "Transaksi penerimaan") }, { type: "receive-summary", label: t("Receipt summary", "Rekap penerimaan") });
    if (route === "shipping") exportOptions.push({ type: "packing", label: t("Packing plan (not shipment evidence)", "Rencana packing (bukan bukti pengiriman)") }, { type: "ship", events: "ship", label: t("Shipment transaction", "Transaksi pengiriman") });
    if (route === "transfers") exportOptions.push({ type: "transfer-send", events: "transfer-send", label: t("Transfer dispatch", "Pengiriman transfer") }, { type: "transfer-receive", events: "transfer-receive", label: t("Transfer receipt", "Penerimaan transfer") }, { type: "transfer-summary", label: t("Transfer summary", "Rekap transfer") });
    if (route === "returns") exportOptions.push({ type: exportDocument.type, label: t("Posted return evidence", "Bukti retur tercatat") });
    if (route === "count") {
      const reviewer = user.role === "admin" || user.role === "supervisor" && data.approvalPolicy?.countReview !== "admin";
      if (exportDocument.status === "counting" && user.role !== "viewer") exportOptions.push({ type: "count-sheet", label: t("Blind count sheet", "Lembar hitung tanpa saldo") });
      if (reviewer && ["review", "adjusted", "closed"].includes(exportDocument.status)) exportOptions.push({ type: "count-review", label: t("Review this count", "Tinjau opname ini"), request: { scope: "selected", ids: [exportDocument.id] } });
      if (reviewer && ["adjusted", "closed"].includes(exportDocument.status)) exportOptions.push({ type: "count-report", label: t("Approved count report", "Berita acara opname disetujui") });
    }
  }
  if (route === "count" && (user.role === "admin" || user.role === "supervisor" && data.approvalPolicy?.countReview !== "admin")) exportOptions.push({ type: "count-review", label: t("All matching count reviews", "Semua tinjauan opname sesuai filter"), request: { documentId: undefined, version: undefined, scope: "all", sku: d.sku || "" } });
  return (
    <div className="stack">
      {d[documentField] && !activeDocumentId && !props.catalogueLoading && <Notice kind="warning">
        {t("The saved document is unavailable in this view. Choose a document explicitly before entering a new scan or quantity.", "Dokumen draf tidak tersedia pada tampilan ini. Pilih dokumen secara eksplisit sebelum memasukkan scan atau jumlah baru.")}
        <Button onClick={() => applyDraft({ [documentField]: undefined, qty: undefined, good: undefined, bad: undefined, scan: "", locationScan: "", reason: "" })}>{t("Clear unavailable document draft", "Hapus draf dokumen yang tidak tersedia")}</Button>
      </Notice>}
      {content}
      <ExportPanel warehouse={warehouse} user={user} context={JSON.stringify([route, d, props.catalogueQuery])} request={{ documentId: exportDocument?.id, version: exportDocument?.version }} options={exportOptions} />
      {!["receiving", "quality", "putaway", "orders", "reservations", "picking", "shipping"].includes(route) && <DocumentDates row={[...data.counts, ...data.transfers, ...data.returns, ...data.orders, ...data.returnTasks].find(row => row.id === activeDocumentId)} warehouse={warehouse} user={user} onSaved={props.refresh} />}
      {!["orders", "count", "returns", "transfers", "cancellation"].includes(
        route,
      ) && history}
    </div>
  );
}
