import React, { useEffect, useRef, useState } from "react";
import { useDateTime, TableTimestamp } from "./DateTime";
import { localDate } from "./date-time";
import { Reference } from "./Reference";
import JsBarcode from "jsbarcode";
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
  DataTable,
  Modal,
  Tabs,
  ProductName,
  errorText,
} from "./ui.tsx";
import { MAIN } from "./fixtures";
import { ExportPanel } from "./ExportPanel";
import { productSuggestions, valueSuggestions } from "./autocomplete-model";
import { useServerCatalogue } from "./server-catalogue";
import { useBulkSelection } from "./selection";
import { BulkActions } from "./BulkActions";
import { downloadLabelSheet } from "./bulk-files";
import { itemCatalogPage } from "./item-catalog";
import { canRetryEvent } from "./bulk-model";
import { canRecoverPending, generateLabelWithHistory, pendingBusinessSummary, recordGeneratedLabel } from "./support-model";

function LabelPreview({ code, name, labelRef }) {
  const t = useText();
  useEffect(() => {
    if (labelRef.current)
      JsBarcode(labelRef.current, code, {
        format: "CODE128",
        width: 2,
        height: 70,
        margin: 16,
        displayValue: true,
        font: "sans-serif",
        fontSize: 16,
      });
  }, [code]);
  return (
    <div className="label-preview">
      <strong>{name}</strong>
      <canvas
        ref={labelRef}
        aria-label={t(`Internal Code 128 barcode: ${code}`, `Barcode Code 128 internal: ${code}`)}
        role="img"
      />
      <small>{t("Internal use only · Code 128", "Hanya untuk internal · Code 128")}</small>
    </div>
  );
}

export function Controls({
  route,
  data,
  setData,
  persistData = setData,
  warehouse,
  user,
  go,
  ask,
  flash,
  checkPending,
  setCatalogueQuery,
  authMode,
  editRecord,
  bulkCommand,
  recoverRequest,
  refresh,
  locale = "en",
}) {
  const t = useText();
  const { stamp: ts, zone, date } = useDateTime();
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState(data.focusSku || data.products[0]?.sku || "");
  const [loc, setLoc] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [supportingPage, setSupportingPage] = useState(1);
  const [tab, setTab] = useState("labels");
  const [labelPage, setLabelPage] = useState(1);
  const [eventStatus, setEventStatus] = useState("needs-attention");
  const [packagesQuery, setPackagesQuery] = useState("");
  const [packagesPage, setPackagesPage] = useState(1);
  const [packageId, setPackageId] = useState("");
  const [labelOutcome, setLabelOutcome] = useState(null);
  const [recoveryOutcome, setRecoveryOutcome] = useState(null);
  const [checkedPending, setCheckedPending] = useState<string[]>([]);
  const [caseReference, setCaseReference] = useState("");
  const [querySubmission, setQuerySubmission] = useState(0);
  const labelsView = route === "labels" && tab === "labels";
  const server = useServerCatalogue(data, setCatalogueQuery, { view: labelsView ? "master" : route, query, ...(labelsView ? { status: "active", sort: "sku" } : route === "integration" ? { status: eventStatus } : {}), sku: ["movements", "tracking"].includes(route) ? sku : "", focusSku: sku, location: loc, from: fromDate, to: toDate, page: labelsView ? labelPage : ledgerPage, pageSize: 25, supportingPage, packagesQuery, packagesPage }, querySubmission);
  useEffect(() => setLedgerPage(1), [sku, query, loc, fromDate, toDate]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [reading, setReading] = useState(false);
  const [reads, setReads] = useState([]);
  const [excluded, setExcluded] = useState({});
  const [fallback, setFallback] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { setModal(null); setSelected(null); setLabelOutcome(null); setRecoveryOutcome(null); setCheckedPending([]); }, [user.id, user.role, warehouse, route]);
  const labelCatalogue = itemCatalogPage(server && labelsView ? data.products.filter(row => server.ids.includes(row.sku)) : data.products, { query: labelsView ? query : "", status: "active", category: "", sort: "sku", page: setCatalogueQuery ? 1 : labelPage, pageSize: 25 });
  const labelPaging = server && labelsView ? server : labelCatalogue;
  const expectedTags = ["EPC-SIM-001", "EPC-SIM-002", "EPC-SIM-003"];
  const bulkRows = route === "integration" ? data.events.filter(row => (row.warehouse || MAIN) === warehouse) : route === "pending" ? data.pending.filter(row => row.request.warehouse === warehouse && row.request.user === user.id) : labelsView ? labelCatalogue.rows : route === "rfid" ? [...new Set<string>(reads)].map(code => ({ id: code, code })) : [];
  const bulk = useBulkSelection({ rows: bulkRows, scope: JSON.stringify([user.id, user.role, warehouse, route, tab, query, labelPage, ledgerPage, eventStatus]), key: row => labelsView ? row.sku : row.id, label: row => labelsView ? `${row.name} · ${row.sku}` : row.id, allowed: row => route === "integration" ? canRetryEvent(row, user) : route === "rfid" ? !expectedTags.includes(row.code) && !excluded[row.code] : labelsView ? ["admin", "supervisor", "operator"].includes(user.role) && row.active && !!row.barcode : ["send", "check"].some(intent => canRecoverPending(intent, row, user, warehouse)), disabled: !!setCatalogueQuery && !server || route === "rfid" && reading || labelsView && !editRecord || route === "integration" && !bulkCommand || route === "pending" && !recoverRequest });
  const afterBulk = async () => { await refresh?.(); };
  const labelRef = useRef<HTMLCanvasElement>(null);
  const product = data.products.find((p) => p.sku === sku) || { sku, name: sku, barcode: "", active: false, unit: "", version: null };
  const ledgerSources = data.ledger.filter(
    (m) =>
      m.warehouse === warehouse &&
      m.sku === sku &&
      (!loc || m.location === loc) &&
      (!fromDate ||
        localDate(m.posted, zone) >= fromDate) &&
      (!toDate ||
        localDate(m.posted, zone) <= toDate),
  );
  const ledger = setCatalogueQuery ? data.ledger : ledgerSources.filter((m) =>
    `${m.source} ${m.kind} ${m.id} ${m.transaction}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const submitRead = event => { if (event.key === "Enter") { event.preventDefault(); setQuerySubmission(value => value + 1); } };
  const itemSelect = <Field label={t("Item", "Barang")} value={sku} onValueChange={setSku} onKeyDown={submitRead} suggestions={productSuggestions(data.products)} />;
  const titleColumns = [
    { key: "id", label: t("Reference", "Referensi") },
    { key: "type", label: t("Type", "Jenis") },
    { key: "status", label: t("Status", "Status") },
  ];
  const loadingSupporting = Boolean(setCatalogueQuery && !server);
  const periodFields = <div className="filter-bar">
    <Field label={t(`From date (${zone})`, `Dari tanggal (${zone})`)} type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} />
    <Field label={t(`To date (${zone})`, `Sampai tanggal (${zone})`)} type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} />
    <Button onClick={() => { setFromDate(""); setToDate(""); }}>{t("All dates", "Semua tanggal")}</Button>
  </div>;
  const supportingPaging = setCatalogueQuery ? data.supportingPage : null;
  const canOperate = ["admin", "supervisor", "operator"].includes(user.role);
  const canIdentify = ["admin", "supervisor"].includes(user.role);
  const recover = async (row, intent) => {
    const current = data.pending.find(p => p.id === row.id);
    if (saving || !recoverRequest || !canRecoverPending(intent, current, user, warehouse)) return;
    setSaving(true);
    try {
      const result = await recoverRequest(row.id, intent);
      if (intent === "check") setCheckedPending(ids => [...new Set([...ids, row.id])]);
      setRecoveryOutcome({ id: row.id, status: result?.status || "success", message: result?.message });
      if (!result?.status || result.status === "success") setModal(null);
      await refresh?.();
    } catch (error) {
      setRecoveryOutcome({ id: row.id, status: "error", message: error.message });
    } finally { setSaving(false); }
  };
  const pendingLabel = key => ({ document: t("Document", "Dokumen"), order: t("Order", "Pesanan"), task: t("Task", "Tugas"), source: t("Source", "Sumber"), sku: "SKU", qty: t("Quantity", "Jumlah"), from: t("From", "Dari"), to: t("To", "Ke"), location: t("Location", "Lokasi") })[key] || key;
  if (
    !data.products.length &&
    ["movements", "tracking", "labels", "rfid"].includes(route)
  )
    return (
      <Panel>
        <Field label={t("Find item / SKU", "Cari barang / SKU")} value={sku} onValueChange={setSku} suggestions={productSuggestions(data.products)} />
        <Empty
          title={sku.trim() ? t("No matching item", "Barang tidak ditemukan") : t("No item master data yet", "Belum ada master barang")}
          action={
            <Button onClick={() => go("master")}>
              {t("Open item master", "Buka master barang")}
            </Button>
          }
        />
      </Panel>
    );
  if (route === "rfid" && !data.receipts.length)
    return (
      <Panel>
        <Empty
          title={t(
            "No receiving document in this warehouse",
            "Belum ada dokumen penerimaan di gudang ini",
          )}
        />
      </Panel>
    );
  const sourceRoute = (type) =>
    ({
      receive: "receiving",
      qc: "quality",
      putaway: "putaway",
      pick: "picking",
      ship: "shipping",
      "transfer-send": "transfers",
      "transfer-receive": "transfers",
      "customer-return": "returns",
      "supplier-return": "returns",
      "adjust-count": "count",
      opening: "stock",
    })[type] || "movements";
  if (route === "integration") {
    const events = data.events.filter(
      (e) => (e.warehouse || MAIN) === warehouse && (setCatalogueQuery || (!eventStatus || (eventStatus === "needs-attention" ? e.business !== "accepted" : e.transport === eventStatus || e.business === eventStatus))) && (setCatalogueQuery || `${e.id} ${e.source} ${e.transport} ${e.business}`.toLowerCase().includes(query.toLowerCase())),
    );
    const event = events.find((e) => e.id === selected) || events[0];
    return (
      <div className="stack">
        <Panel title={t("Integration events", "Event integrasi")}>
          <div className="filter-bar">
            <Field label={t("Find event or source transaction", "Cari event atau transaksi sumber")} type="search" value={query} onKeyDown={submitRead} onChange={e => { setQuery(e.target.value); setLedgerPage(1); }} />
            <Field label={t("Event status", "Status event")}><select value={eventStatus} onChange={e => { setEventStatus(e.target.value); setLedgerPage(1); }}><option value="needs-attention">{t("Needs attention", "Perlu tindak lanjut")}</option><option value="">{t("All events", "Semua event")}</option>{["pending", "failed", "unknown", "accepted", "acknowledged"].map(value => <option key={value}>{value}</option>)}</select></Field>
          </div>
          <BulkActions selection={bulk} actions={[{ id: "retry", label: t("Retry selected events", "Coba ulang event terpilih"), description: t("Schedules the original events again. WMS stock is not reposted.", "Menjadwalkan ulang event asal. Stok WMS tidak dicatat ulang."), perform: async row => bulkCommand("erp-retry", { event: row.id }), after: afterBulk }]} />
          <DataTable
            label={t("ERP events", "Event ERP")}
            rows={events}
            selection={bulk}
            empty={t(
              "No integration events in this warehouse.",
              "Belum ada event integrasi di gudang ini.",
            )}
            selected={event?.id}
            onSelect={(e) => setSelected(e.id)}
            columns={[
              { key: "id", label: t("Event ID", "ID event") },
              { key: "source", label: t("WMS transaction", "Transaksi WMS") },
              { key: "createdAt", label: t("Recorded at", "Waktu pencatatan"), render: r => <TableTimestamp value={r.createdAt} /> },
              {
                key: "wms",
                label: t("WMS status", "Status WMS"),
                render: () => (
                  <Tag kind="success">{t("Confirmed", "Terkonfirmasi")}</Tag>
                ),
              },
              { key: "transport", label: t("Transport", "Pengiriman event") },
              {
                key: "business",
                label: t("ERP business result", "Hasil bisnis ERP"),
              },
              {
                key: "attempts",
                label: t("Attempts", "Percobaan"),
                numeric: true,
              },
            ]}
          />
          {data.eventPage && <nav className="catalogue-pagination" aria-label={t("Integration event pages", "Halaman event integrasi")} aria-busy={loadingSupporting}><span role="status">{loadingSupporting ? t("Loading events…", "Memuat event…") : t(`Page ${data.eventPage.page} of ${data.eventPage.pages} · ${data.eventPage.total} events`, `Halaman ${data.eventPage.page} dari ${data.eventPage.pages} · ${data.eventPage.total} event`)}</span><Button disabled={loadingSupporting || data.eventPage.page <= 1} onClick={() => setLedgerPage(data.eventPage.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button><Button disabled={loadingSupporting || data.eventPage.page >= data.eventPage.pages} onClick={() => setLedgerPage(data.eventPage.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button></nav>}
        </Panel>
        {event && (
          <Panel title={t("Event detail", "Detail event")}>
            <Summary
              items={[
                [t("Event ID (fixed)", "ID event (tetap)"), event.id],
                [t("Recorded at", "Waktu pencatatan"), ts(event.createdAt)],
                [t("Next scheduled attempt", "Jadwal percobaan berikutnya"), event.transport === "acknowledged" ? t("Completed", "Selesai") : ts(event.nextAttemptAt)],
                [t("Source", "Sumber"), event.source],
                [
                  t("WMS", "WMS"),
                  t(
                    "Confirmed; do not repost stock",
                    "Terkonfirmasi; jangan catat stok ulang",
                  ),
                ],
                [t("Transport", "Pengiriman event"), event.transport],
                [t("ERP result", "Hasil ERP"), event.business],
              ]}
            />
            <div className="form-actions">
              <Button onClick={() => setModal({ kind: "payload", event })}>
                {t("View event payload", "Lihat isi event")}
              </Button>
              <Button
                primary
                disabled={
                  loadingSupporting || !canRetryEvent(event, user)
                }
                onClick={() => canRetryEvent(event, user) && !loadingSupporting &&
                  ask("erp-retry", { event: event.id }, [
                    [t("Same event", "Event yang sama"), event.id],
                    [t("Stock effect", "Dampak stok"), t("None", "Tidak ada")],
                  ])
                }
              >
                {t("Retry same event", "Coba ulang event yang sama")}
              </Button>
            </div>
            <Notice>
              {t(
                "Retry schedules the original event. Transport acknowledgement and the ERP business result remain separate. Stock is not reposted.",
                "Retry menjadwalkan event asli. Ack transport dan hasil bisnis ERP tetap terpisah. Stok tidak dicatat ulang.",
              )}
            </Notice>
          </Panel>
        )}
        {modal && (
          <Modal
            title={t("Event payload", "Isi event")}
            onClose={() => setModal(null)}
          >
            <pre>
              {JSON.stringify(modal.event.payload || modal.event, null, 2)}
            </pre>
          </Modal>
        )}
      </div>
    );
  }
  if (route === "movements")
    return (
      <Panel title={t("Item stock ledger", "Kartu stok barang")}>
        <p className="muted">{t("Report period", "Periode laporan")}: {fromDate ? date(fromDate) : t("Beginning", "Awal")} – {toDate ? date(toDate) : t("Latest", "Terbaru")} · {zone}. {t("Export includes its generation time in UTC.", "Ekspor menyertakan waktu pembuatan dalam UTC.")}</p>
        <div className="filter-bar">
          {itemSelect}
          <Field label={t("Location", "Lokasi")}>
            <Lookup
              value={loc}
              onValueChange={setLoc}
              options={[
                { value: "", label: t("All locations", "Semua lokasi") },
                ...valueSuggestions(
                  data.positions
                    .filter((position) => position.warehouse === warehouse)
                    .map((position) => position.location),
                ),
              ]}
            />
          </Field>
          <Field
            label={t("Search source document", "Cari dokumen sumber")}
            value={query}
            suggestions={valueSuggestions(
              ledgerSources.flatMap((movement) => [
                movement.source,
                movement.id,
                movement.transaction,
              ]),
            )}
            onValueChange={setQuery}
            type="search"
            onKeyDown={submitRead}
          />
          <Field
            label={t(`From date (${zone})`, `Dari tanggal (${zone})`)}
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Field
            label={t(`To date (${zone})`, `Sampai tanggal (${zone})`)}
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <Summary
          items={[
            [t("Item", "Barang"), `${product.name} · ${sku}`],
            [
              t("Net movement in filter", "Mutasi bersih pada filter"),
              setCatalogueQuery ? loadingSupporting ? t("Loading aggregate…", "Memuat total…") : (data.ledgerSummary?.quantities || []).map(row => `${row.qty} ${row.unit}`).join(" · ") || `0 ${product.unit || t("units", "unit")}` : `${ledger.reduce((n, m) => n + m.qty, 0)} ${product.unit || t("units", "unit")}`,
            ],
            [t("Warehouse", "Gudang"), warehouse],
          ]}
        />
        <DataTable
          label={t("Posted stock movements", "Mutasi stok tercatat")}
          rows={ledger}
          onSelect={(r) => setModal(r)}
          empty={t(
            "No movements match these filters.",
            "Tidak ada mutasi yang cocok dengan filter.",
          )}
          columns={[
            { key: "source", label: t("Source document", "Dokumen sumber") },
            { key: "kind", label: t("Type", "Jenis") },
            { key: "location", label: t("Location", "Lokasi") },
            {
              key: "qty",
              label: t("Quantity", "Jumlah"),
              numeric: true,
              render: (r) => (
                <span
                  className={r.qty < 0 ? "error-text" : "quantity-positive"}
                >
                  {r.qty > 0 ? "+" : ""}
                  {r.qty}
                  {` ${r.unit || product.unit || t("units", "unit")}`}
                </span>
              ),
            },
            {
              key: "posted",
              label: t("Posted at", "Waktu pencatatan"),
              render: (r) => <TableTimestamp value={r.posted} />,
            },
            { key: "user", label: t("User", "Pengguna") },
            { key: "occurred", label: t("Occurred at", "Waktu kejadian"), render: r => <TableTimestamp value={r.occurred} /> },
          ]}
        />
        {data.ledgerPage && <div className="form-actions">
          <Button disabled={data.ledgerPage.page <= 1} onClick={() => setLedgerPage(data.ledgerPage.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button>
          <span>{t(`Page ${data.ledgerPage.page} of ${data.ledgerPage.pages} · ${data.ledgerPage.total} movements`, `Halaman ${data.ledgerPage.page} dari ${data.ledgerPage.pages} · ${data.ledgerPage.total} mutasi`)}</span>
          <Button disabled={data.ledgerPage.page >= data.ledgerPage.pages} onClick={() => setLedgerPage(data.ledgerPage.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button>
        </div>}
        <ExportPanel warehouse={warehouse} user={user} request={{ sku, location: loc, query, from: fromDate, to: toDate, scope: "all" }} options={[{ type: "ledger", label: t("All matching movements", "Semua mutasi sesuai filter"), estimate: data.ledgerPage?.total }]} />
        <Notice>
          {t(
            "Posted history is read only. Corrections use an authorized count or opening document with a source reference.",
            "Riwayat tercatat hanya bisa dibaca. Koreksi memakai opname atau dokumen saldo awal yang berwenang dengan referensi sumber.",
          )}
        </Notice>
        {modal && (
          <Modal
            title={t("Movement and source", "Mutasi dan sumber")}
            onClose={() => setModal(null)}
          >
            <Summary
              items={[
                [t("Entry", "Entri"), modal.id],
                [t("Source", "Sumber"), modal.source],
                [t("Actor", "Pelaku"), modal.user],
                [t("Occurred at", "Waktu kejadian"), ts(modal.occurred)],
                [t("Posted at", "Waktu pencatatan"), ts(modal.posted)],
                [t("Actual", "Aktual"), `${modal.qty} ${modal.unit || product.unit || t("units", "unit")}`],
              ]}
            />
            <Button
              onClick={() => {
                go(sourceRoute(modal.kind));
                setModal(null);
              }}
            >
              {t("Open source workflow", "Buka alur sumber")}
            </Button>
          </Modal>
        )}
      </Panel>
    );
  if (route === "pending") {
    const rows = data.pending.filter(
      (p) => p.request.warehouse === warehouse && p.request.user === user.id,
    );
    return (
      <Panel
        title={t("Requests in this workspace", "Permintaan di ruang kerja ini")}
      >
        <Notice kind="warning">
          {t(
            "Offline means not sent. Unknown means the server may already have committed. Retry preserves the original ID and payload.",
            "Offline berarti belum dikirim. Hasil belum jelas berarti server mungkin sudah mencatatnya. Retry mempertahankan ID dan isi asal.",
          )}
        </Notice>
        {recoveryOutcome && <Notice kind={recoveryOutcome.status === "success" ? "success" : recoveryOutcome.status === "pending" ? "warning" : "error"} title={<Reference value={recoveryOutcome.id} />}>
          {recoveryOutcome.status === "success" ? t("The original request is confirmed by the server.", "Permintaan asal dikonfirmasi oleh server.") : recoveryOutcome.status === "pending" ? recoveryOutcome.message === "offline" ? t("Not sent. Restore the connection, then send the original request.", "Belum dikirim. Pulihkan koneksi, lalu kirim permintaan asal.") : t("The outcome is still unknown. A missing result does not prove failure. Check again or explicitly review retry of the original request.", "Hasil masih belum jelas. Hasil yang belum ditemukan bukan bukti gagal. Periksa kembali atau tinjau coba ulang permintaan asal.") : errorText(recoveryOutcome.message, t)}
        </Notice>}
        <BulkActions selection={bulk} actions={[
          { id: "send", label: t("Send selected unsent requests", "Kirim permintaan belum terkirim"), allowed: row => canRecoverPending("send", row, user, warehouse), description: t("Uses each original request ID, payload and version. Requests are sent in order.", "Memakai ID, isi, dan versi permintaan asal. Permintaan dikirim berurutan."), perform: async row => recoverRequest(row.id, "send"), after: afterBulk },
          { id: "check", label: t("Check selected unknown requests", "Periksa hasil yang belum jelas"), allowed: row => canRecoverPending("check", row, user, warehouse), description: t("Checks the original requests before any resend. No new request ID is created.", "Memeriksa permintaan asal sebelum pengiriman ulang. Tidak membuat ID permintaan baru."), perform: async row => { const result = await recoverRequest(row.id, "check"); setCheckedPending(ids => [...new Set([...ids, row.id])]); return result; }, after: afterBulk },
          { id: "retry-original", label: t("Retry selected original requests", "Coba ulang permintaan asal terpilih"), allowed: row => checkedPending.includes(row.id) && canRecoverPending("retry", row, user, warehouse), description: t("After checking, explicitly resend the original ID, payload and version. A missing result does not prove failure.", "Setelah diperiksa, kirim ulang ID, isi, dan versi asal secara eksplisit. Hasil belum ditemukan bukan bukti gagal."), perform: async row => recoverRequest(row.id, "retry"), after: afterBulk },
        ]} />
        <DataTable
          label={t("Pending requests", "Permintaan tertunda")}
          rows={rows}
          selection={bulk}
          empty={t(
            "No pending requests for this user and warehouse.",
            "Tidak ada permintaan tertunda untuk pengguna dan gudang ini.",
          )}
          columns={[
            {
              key: "summary",
              label: t("Business request", "Permintaan bisnis"),
              render: row => pendingBusinessSummary(row).map(([key, value]) => `${pendingLabel(key)}: ${value}`).join(" · ") || t("Open request details", "Buka detail permintaan"),
            },
            {
              key: "id",
              label: t("Request ID", "ID permintaan"),
              render: (r) => (
                <button
                  className="text-button break-word"
                  onClick={() => setModal(r)}
                >
                  <Reference value={r.id} />
                </button>
              ),
            },
            {
              key: "type",
              label: t("Action", "Tindakan"),
              render: (r) => r.request.type,
            },
            {
              key: "status",
              label: t("Outcome", "Hasil"),
              render: (r) => (
                <Tag kind="warning">
                  {r.status === "offline"
                    ? t("Not sent", "Belum dikirim")
                    : t("Unknown result", "Hasil belum jelas")}
                </Tag>
              ),
            },
            {
              key: "created",
              label: t("Captured", "Ditangkap"),
              render: (r) => <TableTimestamp value={r.created} />,
            },
            {
              key: "action",
              label: t("Recovery", "Pemulihan"),
              render: (r) => (
                <Button primary disabled={saving || bulk.busy || !canRecoverPending(r.status === "offline" ? "send" : "check", r, user, warehouse)} onClick={() => r.status === "offline" ? setModal(r) : recover(r, "check")}>
                  {r.status === "offline"
                    ? t("Review original request", "Tinjau permintaan asal")
                    : t("Check same request", "Periksa permintaan sama")}
                </Button>
              ),
            },
          ]}
        />
        {modal && (
          <Modal
            title={t("Original request", "Permintaan asal")}
            onClose={() => setModal(null)}
          >
            <Summary
              items={[
                [t("Request ID", "ID permintaan"), modal.id],
                [t("Owner", "Pemilik"), modal.request.user],
                [t("Warehouse", "Gudang"), modal.request.warehouse],
                [t("Type", "Jenis"), modal.request.type],
                [t("Captured on device", "Dicatat di perangkat"), ts(modal.created)],
                [t("Occurred at", "Waktu kejadian"), ts(modal.request.occurredAt)],
                [t("Server confirmed", "Dikonfirmasi server"), t("Not confirmed yet", "Belum dikonfirmasi")],
                ...pendingBusinessSummary(modal).map(([key, value]) => [pendingLabel(key), value]),
              ]}
            />
            <pre>{JSON.stringify(modal.request.payload, null, 2)}</pre>
            <Notice>
              {modal.status === "offline" ? t("This is the captured request. Sending preserves its original ID, payload and version.", "Ini permintaan yang telah dicatat. Pengiriman mempertahankan ID, isi, dan versi asal.") : t(
                "This payload cannot be edited while its outcome is unknown.",
                "Isi ini tidak bisa diedit selama hasilnya belum jelas.",
              )}
            </Notice>
            {recoveryOutcome?.id === modal.id && recoveryOutcome.status !== "success" && <Notice kind={recoveryOutcome.status === "pending" ? "warning" : "error"}>{recoveryOutcome.status === "pending" ? t("The original outcome is still unknown. Keep its ID and check again before retrying.", "Hasil asal masih belum jelas. Pertahankan ID dan periksa kembali sebelum mencoba ulang.") : errorText(recoveryOutcome.message, t)}</Notice>}
            <div className="form-actions">
              <Button primary disabled={saving || !canRecoverPending(modal.status === "offline" ? "send" : "check", data.pending.find(row => row.id === modal.id), user, warehouse)} onClick={() => recover(modal, modal.status === "offline" ? "send" : "check")}>{modal.status === "offline" ? t("Send original request", "Kirim permintaan asal") : t("Check original request", "Periksa permintaan asal")}</Button>
              {modal.status === "unknown" && checkedPending.includes(modal.id) && <Button disabled={saving || !canRecoverPending("retry", data.pending.find(row => row.id === modal.id), user, warehouse)} onClick={() => recover(modal, "retry")}>{t("Retry original ID and payload", "Coba ulang ID dan isi asal")}</Button>}
            </div>
          </Modal>
        )}
      </Panel>
    );
  }
  if (route === "monitoring") {
    const cases = [
      {
        id: "ERP",
        type: t(
          "Integration events awaiting a result",
          "Event integrasi menunggu hasil",
        ),
        count: data.operationalTotals?.erp ?? data.events.filter(
          (e) =>
            (e.warehouse || MAIN) === warehouse && e.business !== "accepted",
        ).length,
        target: "integration",
      },
      {
        id: "PENDING",
        type: t(
          "Pending requests owned by this user",
          "Permintaan tertunda milik pengguna ini",
        ),
        count: data.pending.filter(
          (p) =>
            p.request.warehouse === warehouse && p.request.user === user.id,
        ).length,
        target: "pending",
      },
      {
        id: "FREEZE",
        type: t("Open location freezes", "Pembekuan lokasi terbuka"),
        count: data.operationalTotals?.freezes ?? data.counts.filter(
          (c) => c.warehouse === warehouse && c.status !== "closed",
        ).length,
        target: "count",
      },
    ];
    return (
      <div className="stack">
        <Notice kind={data.erpDelivery?.enabled && !data.erpDelivery?.paused ? "info" : "warning"}>
          {data.erpDelivery?.enabled ? data.erpDelivery?.paused ? t("ERP delivery is held. Complete reconciliation before releasing the outbox.", "Pengiriman ERP ditahan. Selesaikan rekonsiliasi sebelum melepas outbox.") : t("ERP delivery is enabled. Monitor pending business results below.", "Pengiriman ERP aktif. Pantau hasil bisnis tertunda di bawah.") : t("ERP delivery is disabled. WMS events remain queued.", "Pengiriman ERP nonaktif. Event WMS tetap dalam antrean.")}
        </Notice>
        <Panel title={t("Activity period", "Periode aktivitas")}>
          {periodFields}
          <Summary items={[[t("Confirmed actions in period", "Tindakan tercatat pada periode"), data.activity?.confirmedActions ?? t("Loading", "Memuat")]]} />
          <p className="muted">{t("The period applies to confirmed activity. Open cases below show the current state.", "Periode berlaku untuk aktivitas tercatat. Kasus terbuka di bawah menampilkan kondisi saat ini.")}</p>
        </Panel>
        <Panel title={t("Open operational cases", "Kasus operasional terbuka")}>
          <DataTable
            label={t("Operational queues", "Antrean operasional")}
            rows={cases}
            columns={[
              { key: "type", label: t("Case", "Kasus") },
              { key: "count", label: t("Open", "Terbuka"), numeric: true },
              {
                key: "action",
                label: t("Action", "Tindakan"),
                render: (r) => (
                  <Button onClick={() => go(r.target)}>
                    {t("Open cases", "Buka kasus")}
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        <Panel
          title={t(
            "Database backup and recovery",
            "Backup database dan pemulihan",
          )}
        >
          <Summary
            items={[
              [
                t("Backup evidence", "Bukti backup"),
                data.backupEvidence?.completedAt ? ts(data.backupEvidence.completedAt) : t("Not available", "Belum tersedia"),
              ],
              [
                t("Restore drill", "Latihan restore"),
                t("Not run", "Belum dijalankan"),
              ],
              [
                t("Measured RPO / RTO", "RPO / RTO terukur"),
                t("Not measured", "Belum diukur"),
              ],
            ]}
          />
          <Button onClick={() => setModal({ kind: "recovery" })}>
            {t("View recovery procedure", "Lihat prosedur pemulihan")}
          </Button>
          <Notice kind="warning">
            {t(
              "No live infrastructure is connected. A standby is not backup evidence. Outbound replay must remain held after restore until ERP reconciliation.",
              "Infrastruktur nyata belum terhubung. Standby bukan bukti backup. Replay keluar harus ditahan setelah restore sampai rekonsiliasi ERP.",
            )}
          </Notice>
        </Panel>
        <Panel title={t("Case follow-up", "Tindak lanjut kasus")}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving || !canOperate || !note.trim() || !caseReference.trim()) return;
              setSaving(true);
              const saved = await persistData((s) => ({
                ...s,
                followups: [
                  ...(s.followups || []),
                  {
                    user: user.id,
                    warehouse,
                    note,
                    caseReference: caseReference.trim(),
                    stamp: new Date().toISOString(),
                  },
                ],
              }));
              setSaving(false);
              if (!saved) return;
              setNote("");
              flash(
                t(
                  "Follow-up saved for the original case.",
                  "Tindak lanjut tersimpan untuk kasus asal.",
                ),
              );
            }}
          >
            <Field label={t("Original case reference", "Referensi kasus asal")} value={caseReference} onChange={e => setCaseReference(e.target.value)} required disabled={saving || !canOperate} />
            <Field
              label={t(
                "Owner and follow-up note (required)",
                "Penanggung jawab dan catatan (wajib)",
              )}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
            <Button primary type="submit" disabled={saving || !canOperate}>
              {t("Record follow-up", "Catat tindak lanjut")}
            </Button>
          </form>
          <DataTable label={t("Recorded follow-ups", "Tindak lanjut tercatat")} rows={(data.followups || []).filter(n => n.warehouse === warehouse)}
            columns={[{ key: "caseReference", label: t("Original case", "Kasus asal") }, { key: "user", label: t("User", "Pengguna") }, { key: "note", label: t("Note", "Catatan") }, { key: "stamp", label: t("Recorded at", "Waktu pencatatan"), render: row => <TableTimestamp value={row.stamp} /> }]}
            empty={t("No follow-ups recorded.", "Belum ada tindak lanjut tercatat.")} />
          {supportingPaging && (
            <nav className="catalogue-pagination" aria-label={t("Follow-up pages", "Halaman tindak lanjut")} aria-busy={loadingSupporting}>
              <span role="status">{loadingSupporting ? t("Loading follow-ups…", "Memuat tindak lanjut…") : t(`Page ${supportingPaging.page} of ${supportingPaging.pages} · ${supportingPaging.total} follow-ups`, `Halaman ${supportingPaging.page} dari ${supportingPaging.pages} · ${supportingPaging.total} tindak lanjut`)}</span>
              <Button disabled={loadingSupporting || supportingPaging.page <= 1} onClick={() => setSupportingPage(supportingPaging.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button>
              <Button disabled={loadingSupporting || supportingPaging.page >= supportingPaging.pages} onClick={() => setSupportingPage(supportingPaging.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button>
            </nav>
          )}
        </Panel>
        {modal && (
          <Modal
            title={t("Recovery procedure", "Prosedur pemulihan")}
            onClose={() => setModal(null)}
          >
            <ol>
              <li>
                {t(
                  "Restore into an isolated environment and record the recovery point.",
                  "Restore ke lingkungan terisolasi dan catat titik pulih.",
                )}
              </li>
              <li>
                {t(
                  "Reconcile balances, entries, reservations and attachments.",
                  "Rekonsiliasi saldo, entri, reservasi, dan lampiran.",
                )}
              </li>
              <li>
                {t(
                  "Measure RPO and RTO against agreed targets.",
                  "Ukur RPO dan RTO terhadap target yang disepakati.",
                )}
              </li>
              <li>
                {t(
                  "Compare ERP evidence before authorizing outbound replay.",
                  "Bandingkan bukti ERP sebelum mengizinkan replay keluar.",
                )}
              </li>
            </ol>
          </Modal>
        )}
      </div>
    );
  }
  if (route === "tracking") {
    const found = data.products.filter((p) =>
      `${p.sku} ${p.name} ${p.barcode}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    const positions = data.positions.filter(
      (p) => p.warehouse === warehouse && p.sku === sku && p.qty > 0,
    );
    return (
      <div className="stack">
        <Panel title={t("Find an item", "Cari barang")}>
          <Field
            label={t(
              "Search SKU, barcode or item name",
              "Cari SKU, barcode, atau nama barang",
            )}
            value={query}
            type="search"
            onKeyDown={submitRead}
            onChange={(e) => setQuery(e.target.value)}
          />
          <DataTable
            label={t("Item search results", "Hasil pencarian barang")}
            rows={found.map((p) => ({ ...p, id: p.sku }))}
            onSelect={(p) => setSku(p.sku)}
            selected={sku}
            empty={t(
              "Item not recognized. Check the full code and namespace.",
              "Barang belum dikenal. Cek kode lengkap dan namespace.",
            )}
            columns={[
              {
                key: "name",
                label: t("Item", "Barang"),
                render: (p) => <ProductName product={p} />,
              },
              {
                key: "barcode",
                label: t("Internal barcode", "Barcode internal"),
              },
            ]}
          />
        </Panel>
        {sku && (
          <Panel title={`${data.products.find(row => row.sku === sku)?.name || sku} · ${sku}`}>
            <div className="tracking-summary">
              <div>
                <h3>
                  {t("Confirmed stock positions", "Posisi stok terkonfirmasi")}
                </h3>
                {positions.map((p) => (
                  <p key={`${p.location}${p.hold}`}>
                    {p.location} · {p.condition} · {p.qty} {product.unit || t("units", "unit")}
                  </p>
                ))}
                {!positions.length && <p>{t("No physical stock remains. Posted history is still available.", "Tidak ada stok fisik tersisa. Riwayat tercatat tetap tersedia.")}</p>}
              </div>
              <div>
                <h3>
                  {t("Last scan observation", "Pengamatan scan terakhir")}
                </h3>
                <p>
                  {t("No observation available", "Belum ada pengamatan")}
                </p>
                <Tag>{t("Observation only", "Hanya pengamatan")}</Tag>
              </div>
            </div>
            <Notice>
              {t(
                "SKU tracking does not identify an individual physical unit. A scan observation does not prove a stock movement or current location.",
                "Pelacakan SKU tidak mengidentifikasi satu unit fisik. Pengamatan scan tidak membuktikan mutasi stok atau lokasi saat ini.",
              )}
            </Notice>
            <DataTable
              label={t(
                "Confirmed item timeline",
                "Timeline barang terkonfirmasi",
              )}
              rows={data.ledger.filter(
                (m) => m.warehouse === warehouse && m.sku === sku,
              )}
              empty={t(
                "No confirmed movements.",
                "Belum ada mutasi terkonfirmasi.",
              )}
              columns={[
                { key: "kind", label: t("Posted event", "Kejadian tercatat") },
                { key: "location", label: t("Location", "Lokasi") },
                { key: "source", label: t("Source", "Sumber") },
                { key: "occurred", label: t("Occurred at", "Waktu kejadian"), render: row => <TableTimestamp value={row.occurred} /> },
                {
                  key: "posted",
                  label: t("Posted at", "Dicatat pada"),
                  render: (r) => <TableTimestamp value={r.posted} />,
                },
              ]}
            />
            {data.ledgerPage && <nav className="catalogue-pagination" aria-label={t("Item history pages", "Halaman riwayat barang")}><Button disabled={loadingSupporting || data.ledgerPage.page <= 1} onClick={() => setLedgerPage(data.ledgerPage.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button><span>{t(`Page ${data.ledgerPage.page} of ${data.ledgerPage.pages} · ${data.ledgerPage.total} movements`, `Halaman ${data.ledgerPage.page} dari ${data.ledgerPage.pages} · ${data.ledgerPage.total} mutasi`)}</span><Button disabled={loadingSupporting || data.ledgerPage.page >= data.ledgerPage.pages} onClick={() => setLedgerPage(data.ledgerPage.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button></nav>}
            <a href="#movements">
              {t("Open stock movements", "Buka kartu stok")}
            </a>
          </Panel>
        )}
      </div>
    );
  }
  if (route === "labels") {
    const packages = data.packages.filter(row => !row.warehouse || row.warehouse === warehouse).filter(row => setCatalogueQuery || `${row.id} ${row.items.map(item => item.sku).join(" ")}`.toLowerCase().includes(packagesQuery.toLowerCase()));
    const pkg = packages.find(row => row.id === packageId);
    const packagePaging = setCatalogueQuery ? data.packagePage : null;
    return (
      <Panel
        title={t("Identification and devices", "Identifikasi dan perangkat")}
      >
        <Tabs
          label={t("Label workspace", "Ruang kerja label")}
          items={[
            ["labels", t("Labels", "Label")],
            ["packaging", t("Packaging", "Kemasan")],
            ["devices", t("Devices", "Perangkat")],
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "labels" ? (
          <div className="stack">
            <Field label={t("Find items for labels", "Cari barang untuk label")} type="search" value={query} onChange={e => { setQuery(e.target.value); setLabelPage(1); }} />
            <BulkActions selection={bulk} actions={[{ id: "labels", label: t("Download selected labels", "Unduh label terpilih"), description: t("Generates one printable sheet, then saves each item's download history. Physical printing is not confirmed.", "Membuat satu lembar siap cetak, lalu menyimpan riwayat unduhan tiap barang. Cetak fisik belum dikonfirmasi."), prepare: rows => downloadLabelSheet(rows, locale), perform: async row => recordGeneratedLabel(() => editRecord("labelHistory", { sku: row.sku, version: row.version, code: row.barcode, action: "download" })), after: afterBulk }]} />
            <div className="bulk-label-table" role="region" tabIndex={0} aria-label={t("Items for label output", "Barang untuk pembuatan label")}><DataTable label={t("Select items for labels", "Pilih barang untuk label")} rows={labelCatalogue.rows} selection={bulk} onSelect={row => setSku(row.sku)} selected={sku} columns={[{ key: "sku", label: "SKU" }, { key: "name", label: t("Item", "Barang") }, { key: "barcode", label: "Barcode" }]} /></div>
            <div className="catalogue-pagination"><Button disabled={bulk.busy || labelPaging.page <= 1 || !!setCatalogueQuery && !server} onClick={() => setLabelPage(labelPaging.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button><span>{t(`Page ${labelPaging.page} of ${labelPaging.pages} · ${labelPaging.total} items`, `Halaman ${labelPaging.page} dari ${labelPaging.pages} · ${labelPaging.total} barang`)}</span><Button disabled={bulk.busy || labelPaging.page >= labelPaging.pages || !!setCatalogueQuery && !server} onClick={() => setLabelPage(labelPaging.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button></div>
          <div className="settings-grid">
            <div className="stack">
              {itemSelect}
              <Summary
                items={[
                  [t("Barcode type", "Jenis barcode"), "Code 128"],
                  [t("Code", "Kode"), product.barcode],
                  [
                    t("Namespace", "Namespace"),
                    t("Internal only", "Hanya internal"),
                  ],
                ]}
              />
              <Button
                primary
                disabled={saving || loadingSupporting || !canOperate || !editRecord || !product.active || product.sku !== sku}
                onClick={async () => {
                  if (saving || loadingSupporting || !canOperate || !product.active || product.sku !== sku) return;
                  setSaving(true);
                  const result = await generateLabelWithHistory(() => {
                  const a = document.createElement("a");
                  a.href = labelRef.current.toDataURL("image/png");
                  a.download = `label-${sku}.png`;
                  a.click();
                  }, () => editRecord("labelHistory", { sku, version: product.version, code: product.barcode, action: "download" }));
                  setLabelOutcome({ ...result, sku, code: product.barcode, version: product.version });
                  setSaving(false);
                }}
              >
                {t("Download printable label", "Unduh label siap cetak")}
              </Button>
              <Button
                disabled={saving || loadingSupporting || !canIdentify || !product.barcode}
                onClick={() => {
                  setModal({ kind: "replace", sku, version: product.version, previous: product.barcode });
                  setCode(product.barcode);
                  setReason("");
                }}
              >
                {t("Replace identifier", "Ganti kode identifikasi")}
              </Button>
              {labelOutcome && <Notice kind={labelOutcome.history === "saved" ? "success" : "warning"}>
                {labelOutcome.file === "failed" ? t("The label file could not be generated. No download history was saved.", "File label belum dapat dibuat. Riwayat unduhan tidak disimpan.") : labelOutcome.history === "saved" ? t("Label file generated and download history saved. Physical printing is not confirmed.", "File label dibuat dan riwayat unduhan tersimpan. Cetak fisik belum dikonfirmasi.") : t("Label file generated, but its history is not confirmed. The item mapping is unchanged.", "File label dibuat, tetapi riwayatnya belum terkonfirmasi. Pemetaan barang tetap.")}
                {labelOutcome.file === "generated" && labelOutcome.history === "failed" && <Button disabled={saving || loadingSupporting || !canOperate} onClick={async () => { setSaving(true); try { const result = await recordGeneratedLabel(() => editRecord("labelHistory", { sku: labelOutcome.sku, code: labelOutcome.code, version: labelOutcome.version, action: "download" })); setLabelOutcome(current => ({ ...current, history: result.status === "success" ? "saved" : "failed" })); } catch (error) { flash(errorText(error.message, t), "error"); } finally { setSaving(false); } }}>{t("Retry saving download history", "Coba simpan riwayat unduhan")}</Button>}
              </Notice>}
              <Notice>
                {t(
                  "A replacement deactivates the old mapping. Labels and reprints do not change inventory. No hardware printer is connected.",
                  "Penggantian menonaktifkan pemetaan lama. Label dan cetak ulang tidak mengubah stok. Printer fisik belum terhubung.",
                )}
              </Notice>
            </div>
            {product.barcode ? <LabelPreview
              code={product.barcode}
              name={`${product.name} · ${sku}`}
              labelRef={labelRef}
            /> : <Empty title={t("Select a known item to preview its label.", "Pilih barang terdaftar untuk melihat labelnya.")} />}
          </div>
          <DataTable label={t("Recent label history", "Riwayat label terbaru")} rows={(data.labelHistory || []).filter(row => row.sku === sku && (!row.warehouse || row.warehouse === warehouse)).map((row, index) => ({ ...row, id: row.id || `${row.stamp}-${index}` }))} columns={[{ key: "action", label: t("Action", "Tindakan") }, { key: "code", label: t("Identifier", "Kode identifikasi") }, { key: "user", label: t("User", "Pengguna") }, { key: "stamp", label: t("Saved at", "Waktu tersimpan"), render: row => <TableTimestamp value={row.stamp} /> }]} empty={t("No recent label history for this item.", "Belum ada riwayat label terbaru untuk barang ini.")} />
          </div>
        ) : tab === "packaging" ? (
          <>
            <Field label={t("Find carton or contained SKU", "Cari karton atau SKU isi")} type="search" value={packagesQuery} onChange={e => { setPackagesQuery(e.target.value); setPackagesPage(1); setPackageId(""); }} />
            <DataTable label={t("Package catalogue", "Katalog kemasan")} rows={packages} selected={packageId} onSelect={row => setPackageId(row.id)} empty={loadingSupporting ? t("Loading packages…", "Memuat kemasan…") : t("No packages match. Change the search to find another carton.", "Tidak ada kemasan yang cocok. Ubah pencarian untuk mencari karton lain.")} columns={[{ key: "id", label: t("Carton", "Karton") }, { key: "version", label: t("Contents version", "Versi isi"), numeric: true }, { key: "items", label: t("Contained items", "Barang di dalamnya"), render: row => row.items.map(item => item.sku).join(", ") }]} />
            {packagePaging && <nav className="catalogue-pagination" aria-label={t("Package pages", "Halaman kemasan")} aria-busy={loadingSupporting}><span role="status">{t(`Page ${packagePaging.page} of ${packagePaging.pages} · ${packagePaging.total} packages`, `Halaman ${packagePaging.page} dari ${packagePaging.pages} · ${packagePaging.total} kemasan`)}</span><Button disabled={loadingSupporting || packagePaging.page <= 1} onClick={() => { setPackagesPage(packagePaging.page - 1); setPackageId(""); }}>{t("Previous page", "Halaman sebelumnya")}</Button><Button disabled={loadingSupporting || packagePaging.page >= packagePaging.pages} onClick={() => { setPackagesPage(packagePaging.page + 1); setPackageId(""); }}>{t("Next page", "Halaman berikutnya")}</Button></nav>}
            {pkg ? <>
            <Summary
              items={[
                [t("Carton", "Karton"), pkg.id],
                [t("Contents version", "Versi isi"), pkg.version],
              ]}
            />
            <DataTable
              label={t("Carton contents", "Isi karton")}
              rows={pkg.items}
              columns={[
                { key: "sku", label: t("Item", "Barang") },
                {
                  key: "qty",
                  label: t("Quantity (units)", "Jumlah (unit)"),
                  numeric: true,
                },
              ]}
            />
            <Button
              disabled={saving || loadingSupporting || !canIdentify}
              onClick={() => {
                setModal({
                  kind: "package",
                  packageId: pkg.id,
                  version: pkg.version,
                  sku: pkg.items[0]?.sku || "",
                  qty: pkg.items[0]?.qty || 0,
                });
                setReason("");
              }}
            >
              {t("Revise contents (new version)", "Ubah isi (versi baru)")}
            </Button>
            <Notice>
              {t(
                "Parent and child reads represent the same contents. Package membership is not an additional stock balance.",
                "Bacaan parent dan child mewakili isi yang sama. Keanggotaan kemasan bukan saldo stok tambahan.",
              )}
            </Notice>
            </> : <Notice>{t("Select a carton to view or revise its contents.", "Pilih karton untuk melihat atau mengubah isinya.")}</Notice>}
          </>
        ) : (
          <>
            <DataTable
              label={t("Registered devices", "Perangkat terdaftar")}
              empty={t("No devices registered", "Belum ada perangkat terdaftar")}
              rows={authMode === "oidc" ? [] : [
                {
                  id: "SCANNER-SIM-01",
                  type: "Barcode",
                  status: t("Not connected", "Belum terhubung"),
                },
                {
                  id: "READER-SIM-01",
                  type: "RFID pilot",
                  status: t("Not connected", "Belum terhubung"),
                },
              ]}
              columns={[
                ...titleColumns,
                {
                  key: "actions",
                  label: t("Details", "Detail"),
                  render: (r) => (
                    <Button
                      onClick={() => setModal({ kind: "device", device: r })}
                    >
                      {t("View device", "Lihat perangkat")}
                    </Button>
                  ),
                },
              ]}
            />
            <Notice>
              {t(
                "Device registration is not permission to post stock. RFID SDK and hardware pairing remain unconfigured.",
                "Perangkat terdaftar belum berarti boleh mencatat stok. SDK RFID dan pairing perangkat belum dikonfigurasi.",
              )}
            </Notice>
          </>
        )}
        {modal && (
          <Modal
            title={
              modal.kind === "replace"
                ? t("Replace active identifier", "Ganti kode aktif")
                : modal.kind === "package"
                  ? t("Revise carton contents", "Ubah isi karton")
                  : t("Device details", "Detail perangkat")
            }
            onClose={() => setModal(null)}
          >
            {modal.kind === "device" ? (
              <Summary
                items={[
                  [t("Device", "Perangkat"), modal.device.id],
                  [t("Status", "Status"), modal.device.status],
                  [t("Warehouse", "Gudang"), warehouse],
                  [
                    t("Last contact", "Kontak terakhir"),
                    t("Not available", "Belum tersedia"),
                  ],
                ]}
              />
            ) : (
              <form
                className="stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (saving) return;
                  let saved;
                  if (modal.kind === "replace") {
                    if (
                      data.products.some(
                        (p) => p.sku !== sku && p.barcode === code,
                      )
                    ) {
                      flash(
                        t(
                          "Identifier already belongs to another item.",
                          "Kode sudah dipakai barang lain.",
                        ),
                        "error",
                      );
                      return;
                    }
                    if (!/^[\x20-\x7E]+$/.test(code)) {
                      flash(
                        t(
                          "Use printable ASCII characters for Code 128.",
                          "Gunakan karakter ASCII tercetak untuk Code 128.",
                        ),
                        "error",
                      );
                      return;
                    }
                    if (!canIdentify || !product.barcode || loadingSupporting || modal.sku !== sku || modal.version !== product.version || modal.previous !== product.barcode) {
                      flash(t("The mapping or access changed. Close this review and reopen the current item.", "Pemetaan atau akses berubah. Tutup tinjauan ini dan buka barang terbaru."), "error");
                      return;
                    }
                    setSaving(true);
                    saved = await persistData((s) => ({
                      ...s,
                      products: s.products.map((p) =>
                        p.sku === sku ? { ...p, barcode: code } : p,
                      ),
                      labelHistory: [
                        {
                          sku,
                          code,
                          previous: product.barcode,
                          reason,
                          action: "replace",
                          user: user.id,
                          warehouse,
                          stamp: new Date().toISOString(),
                        },
                        ...s.labelHistory,
                      ],
                    }));
                  } else {
                    const currentPackage = packages.find(row => row.id === modal.packageId);
                    if (!canIdentify || loadingSupporting || !currentPackage || currentPackage.version !== modal.version || !currentPackage.items.some((item) => item.sku === modal.sku)) {
                      flash(t("The package changed. Close this review and reopen the current package.", "Kemasan berubah. Tutup tinjauan ini dan buka kemasan terbaru."), "error");
                      return;
                    }
                    setSaving(true);
                    saved = await persistData((s) => ({
                      ...s,
                      packages: s.packages.map((p) =>
                        p.id === currentPackage.id
                          ? {
                              ...p,
                              version: p.version + 1,
                              reason,
                              items: p.items.map((i) =>
                                i.sku === modal.sku
                                  ? { ...i, qty: Number(modal.qty) }
                                  : i,
                              ),
                            }
                          : p,
                      ),
                    }));
                  }
                  setSaving(false);
                  if (saved === false) return;
                  setModal(null);
                  flash(
                    t(
                      "Identification change saved. Stock is unchanged.",
                      "Perubahan identifikasi tersimpan. Stok tetap.",
                    ),
                  );
                }}
              >
                {modal.kind === "replace" ? (
                  <Field
                    label={t("New active barcode", "Barcode aktif baru")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                ) : (
                  <>
                    <Field label={t("Carton item", "Barang dalam karton")}>
                      <Lookup
                        value={modal.sku}
                        options={(packages.find(row => row.id === modal.packageId)?.items || []).map((item) => ({ value: item.sku, label: item.sku }))}
                        onValueChange={(value) => setModal({
                          ...modal,
                          sku: value,
                          qty: packages.find(row => row.id === modal.packageId)?.items.find((item) => item.sku === value)?.qty || 0,
                        })}
                      />
                    </Field>
                    <Field
                      label={t("Quantity in carton", "Jumlah dalam karton")}
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={modal.qty}
                      onChange={(e) => setModal({ ...modal, qty: e.target.value })}
                    />
                  </>
                )}
                <Field
                  label={t("Reason (required)", "Alasan (wajib)")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
                <Button primary type="submit" disabled={saving}>
                  {t("Confirm mapping change", "Konfirmasi perubahan pemetaan")}
                </Button>
              </form>
            )}
          </Modal>
        )}
      </Panel>
    );
  }
  if (route === "rfid") {
    const expected = ["EPC-SIM-001", "EPC-SIM-002", "EPC-SIM-003"];
    const known = [...expected, "EPC-SIM-999"];
    const unique = [...new Set(reads)];
    const unresolved = unique.filter(
      (code) => !expected.includes(code) && !excluded[code],
    );
    return (
      <Panel
        title={t(
          "RFID capture session (optional pilot)",
          "Sesi baca RFID (pilot opsional)",
        )}
      >
        <Notice>
          {t(
            "Simulation only. No reader SDK is connected. Raw read counts are not stock quantities. RSSI does not prove direction or location.",
            "Hanya simulasi. SDK reader belum terhubung. Jumlah baca mentah bukan jumlah stok. RSSI tidak membuktikan arah atau lokasi.",
          )}
        </Notice>
        <Summary
          items={[
            [t("Source document", "Dokumen sumber"), "PO-SIM-100"],
            [t("Area", "Area"), "Receiving"],
            [t("Reader", "Reader"), "READER-SIM-01"],
            [t("Warehouse", "Gudang"), warehouse],
          ]}
        />
        <div className="form-actions">
          <Button
            primary
            disabled={reading}
            onClick={() => {
              setReading(true);
              setReads([]);
              setExcluded({});
            }}
          >
            {t("Start capture", "Mulai baca")}
          </Button>
          <Button
            disabled={!reading}
            onClick={() =>
              setReads([
                ...reads,
                "EPC-SIM-001",
                "EPC-SIM-001",
                "EPC-SIM-002",
                "EPC-SIM-003",
                "EPC-SIM-999",
                "EPC-UNKNOWN",
              ])
            }
          >
            {t("Simulate reader batch", "Simulasikan batch reader")}
          </Button>
          <Button disabled={!reading} onClick={() => setReading(false)}>
            {t("End capture", "Akhiri baca")}
          </Button>
        </div>
        <Summary
          items={[
            [t("Raw reads", "Baca mentah"), reads.length],
            [t("Unique objects", "Objek unik"), unique.length],
            [
              t("Repeated reads", "Baca berulang"),
              reads.length - unique.length,
            ],
            [
              t("Matched", "Cocok"),
              unique.filter((code) => expected.includes(code)).length,
            ],
            [
              t("Missing", "Belum terbaca"),
              expected.filter((code) => !unique.includes(code)).length,
            ],
            [t("Unresolved", "Belum selesai"), unresolved.length],
          ]}
        />
        <BulkActions selection={bulk} actions={[{ id: "exclude", label: t("Exclude selected observations", "Kecualikan pengamatan terpilih"), reason: true, description: t("Excludes observations from this simulation only. No stock is confirmed or changed.", "Mengecualikan pengamatan pada simulasi ini saja. Tidak mengonfirmasi atau mengubah stok."), perform: async (row, reason) => { setExcluded(current => ({ ...current, [row.code]: reason })); } }]} />
        <DataTable
          label={t("Unique read observations", "Pengamatan baca unik")}
          selection={bulk}
          rows={unique.map((code) => ({ id: code, code }))}
          empty={t(
            "Start capture and simulate a reader batch.",
            "Mulai baca lalu simulasikan batch reader.",
          )}
          columns={[
            { key: "code", label: "EPC / Tag ID" },
            {
              key: "status",
              label: t("Result", "Hasil"),
              render: (r) => (
                <Tag
                  kind={
                    excluded[r.code]
                      ? "neutral"
                      : expected.includes(r.code)
                        ? "success"
                        : "warning"
                  }
                >
                  {excluded[r.code]
                    ? t("Excluded with reason", "Dikecualikan dengan alasan")
                    : expected.includes(r.code)
                      ? t("Matched", "Cocok")
                      : known.includes(r.code)
                        ? t("Unexpected", "Di luar dokumen")
                        : t("Unknown identifier", "Kode belum dikenal")}
                </Tag>
              ),
            },
            {
              key: "action",
              label: t("Review", "Tinjau"),
              render: (r) =>
                !expected.includes(r.code) && !excluded[r.code] ? (
                  <Button
                    disabled={reading}
                    onClick={() => {
                      setModal({ kind: "exclude", code: r.code });
                      setReason("");
                    }}
                  >
                    {t("Review case", "Tinjau kasus")}
                  </Button>
                ) : (
                  t("No pending case", "Tidak ada kasus tertunda")
                ),
            },
          ]}
        />
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (fallback !== "SKU-A") {
              flash(
                t(
                  "Barcode does not match the selected document.",
                  "Barcode tidak cocok dengan dokumen yang dipilih.",
                ),
                "error",
              );
              return;
            }
            setReads([...reads, "EPC-SIM-001"]);
            setFallback("");
            flash(
              t(
                "Barcode fallback resolved the same object without adding a second unit.",
                "Fallback barcode mengenali objek yang sama tanpa menambah unit kedua.",
              ),
            );
          }}
        >
          <Field
            label={t("Barcode fallback (SKU-A)", "Fallback barcode (SKU-A)")}
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            required
          />
          <Button type="submit" disabled={reading}>
            {t("Resolve with barcode", "Cocokkan lewat barcode")}
          </Button>
        </form>
        <div className="form-actions">
          <Button
            primary
            disabled={reading || !reads.length || unresolved.length > 0}
            onClick={() => go("receiving")}
          >
            {t("Review in receiving", "Tinjau di penerimaan")}
          </Button>
        </div>
        <Notice kind="warning">
          {t(
            "Capture never posts stock. Resolve exceptions, check physical contents, then confirm the business document separately.",
            "Hasil baca tidak mencatat stok. Selesaikan pengecualian, cek fisik, lalu konfirmasi dokumen transaksi secara terpisah.",
          )}
        </Notice>
        {modal && (
          <Modal
            title={`${t("Review observation", "Tinjau pengamatan")}: ${modal.code}`}
            onClose={() => setModal(null)}
          >
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                setExcluded({ ...excluded, [modal.code]: reason });
                setModal(null);
              }}
            >
              <Field
                label={t(
                  "Reason for excluding this observation",
                  "Alasan mengecualikan pengamatan ini",
                )}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button primary type="submit">
                {t("Record exclusion", "Catat pengecualian")}
              </Button>
            </form>
          </Modal>
        )}
      </Panel>
    );
  }
}
