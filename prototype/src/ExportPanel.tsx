import React, { useContext, useEffect, useRef, useState } from "react";
import { exportEvents, operationalExport, type ExportRequest } from "./api";
import { Button, Field, Locale, Modal, Notice, Summary, useText } from "./ui";
import { Reference } from "./Reference";

export interface ExportOption { type: string; label: string; request?: Partial<ExportRequest>; events?: string; estimate?: number; }
export function ExportPanel({ warehouse, user, options, request = {}, context = "", disabled = false }: {
  warehouse: string; user: { id: string; role: string }; options: ExportOption[];
  request?: Partial<ExportRequest>; context?: string; disabled?: boolean;
}) {
  const t = useText();
  const locale = useContext(Locale);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(0);
  const [format, setFormat] = useState("xlsx");
  const [transactionId, setTransactionId] = useState("");
  const [events, setEvents] = useState<Awaited<ReturnType<typeof exportEvents>>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countFilters, setCountFilters] = useState({ sku: "", location: "", status: "", from: "", to: "" });
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const scope = JSON.stringify([warehouse, user.id, user.role, request, context, options]);
  const live = useRef(scope); live.current = scope;
  useEffect(() => { setOpen(false); controller.current?.abort(); }, [scope]);
  useEffect(() => () => controller.current?.abort(), []);
  const option = options[choice] || options[0];
  const input = { ...request, ...option?.request, ...(option?.type === "count-review" && option.request?.scope === "all" ? countFilters : {}), type: option?.type, locale };
  useEffect(() => {
    setTransactionId(""); setEvents([]); setMessage(""); setLoading(false);
    if (!open || !option?.events || !input.documentId) return;
    const abort = new AbortController(); setLoading(true);
    exportEvents(warehouse, input.documentId, abort.signal).then(rows => {
      if (!abort.signal.aborted) setEvents(rows.filter(row => row.kind === option.events));
    }).catch(error => { if (!abort.signal.aborted) setMessage(failure(error.code)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [open, choice, scope]);
  const failure = (code: string) => ({
    "denied": t("Export access denied. Refresh your access.", "Akses ekspor ditolak. Perbarui akses Anda."),
    "blind-count": t("This scope is protected by an active blind count. Narrow the scope or use the count sheet.", "Lingkup dilindungi opname tanpa saldo. Persempit lingkup atau gunakan lembar hitung."),
    "conflict": t("The source changed. Refresh and review again.", "Sumber berubah. Muat ulang dan tinjau kembali."),
    "export-empty": t("No matching data to export.", "Tidak ada data yang cocok untuk diekspor."),
    "export-limit": t("Export limit exceeded. Narrow the filters.", "Batas ekspor terlampaui. Persempit filter."),
    "export-source": t("Source evidence is incomplete. This final document cannot be generated.", "Bukti sumber belum lengkap. Dokumen final tidak dapat dibuat."),
    "export-busy": t("Another export is processing. Try again after it finishes.", "Ekspor lain sedang diproses. Coba setelah selesai."),
    "export-timeout": t("Export timed out. Narrow the filters and try again.", "Waktu ekspor habis. Persempit filter dan coba kembali."),
    "session-expired": t("Your session expired. Sign in again.", "Sesi berakhir. Masuk kembali."),
  }[code] || t("Export failed. Refresh and try again.", "Ekspor gagal. Muat ulang lalu coba kembali."));
  const close = () => { controller.current?.abort(); setOpen(false); };
  const download = async () => {
    if (!navigator.onLine) { setMessage(t("Connect to export current server data.", "Sambungkan jaringan untuk mengekspor data server terkini.")); return; }
    const token = scope;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setMessage("");
    const timeout = setTimeout(() => abort.abort("timeout"), 65000);
    try {
      await operationalExport(warehouse, { ...input, format: ["stock", "ledger", "count-review"].includes(input.type) ? format : "pdf", ...(option.events ? { transactionId } : {}) }, abort.signal, () => live.current === token);
      if (live.current === token) setMessage(t("File ready; download requested.", "File siap; unduhan diminta."));
    } catch (error) {
      if (live.current === token) setMessage(abort.signal.aborted ? t("Export cancelled or timed out. You can try again.", "Ekspor dibatalkan atau melewati batas waktu. Anda dapat mencoba kembali.") : failure(error.code));
    } finally { clearTimeout(timeout); if (live.current === token) setBusy(false); }
  };
  if (!options.length) return null;
  return <div className="section-actions">
    <Button disabled={disabled} onClick={() => { setChoice(0); setFormat("xlsx"); setBusy(false); setMessage(""); setOpen(true); }}>{t("Export", "Ekspor")}</Button>
    {open && <Modal title={t("Review export", "Tinjau ekspor")} onClose={close} footer={<>
      <Button onClick={close}>{t("Cancel", "Batal")}</Button>
      <Button primary disabled={busy || loading || !!option.events && !transactionId} onClick={() => void download()}>{busy ? t("Processing…", "Memproses…") : t("Download", "Unduh")}</Button>
    </>}>
      <Field label={t("Output", "Keluaran")}><select disabled={busy} value={choice} onChange={e => setChoice(Number(e.target.value))}>{options.map((item, i) => <option key={`${item.type}-${i}`} value={i}>{item.label}</option>)}</select></Field>
      <Summary items={[[t("Warehouse", "Gudang"), warehouse], [t("Language", "Bahasa"), locale === "id" ? "Bahasa Indonesia" : "English"], [t("Scope", "Lingkup"), input.documentId ? <Reference value={input.documentId} /> : input.scope === "selected" ? t("Selected on this page", "Terpilih pada halaman ini") : t("All matching results, across pages", "Semua hasil filter, lintas halaman")], [t("Estimate", "Perkiraan"), option.estimate == null ? t("Validated by server", "Divalidasi server") : String(option.estimate)]]} />
      {Object.entries(input).filter(([key, value]) => ["sku", "location", "condition", "status", "query", "from", "to"].includes(key) && value).map(([key, value]) => <p key={key}>{({sku: "SKU", location: t("Location", "Lokasi"), condition: t("Condition", "Kondisi"), status: "Status", query: t("Search", "Pencarian"), from: t("From", "Dari"), to: t("To", "Sampai")})[key]}: {String(value)}</p>)}
      {["stock", "ledger", "count-review"].includes(input.type) && <Field label={t("Format", "Format")}><select disabled={busy} value={format} onChange={e => setFormat(e.target.value)}><option value="xlsx">XLSX</option>{input.type !== "count-review" && <option value="csv">CSV</option>}</select></Field>}
      {input.type === "count-review" && input.scope === "all" && <div className="form-grid">
        <Field label="SKU" value={countFilters.sku} disabled={busy} onChange={e => setCountFilters({ ...countFilters, sku: e.target.value })} />
        <Field label={t("Location", "Lokasi")} value={countFilters.location} disabled={busy} onChange={e => setCountFilters({ ...countFilters, location: e.target.value })} />
        <Field label={t("Status", "Status")}><select disabled={busy} value={countFilters.status} onChange={e => setCountFilters({ ...countFilters, status: e.target.value })}><option value="">{t("All reviewable stages", "Semua tahap yang dapat ditinjau")}</option><option value="review">{t("Pending review", "Menunggu tinjauan")}</option><option value="adjusted">{t("Adjusted", "Disesuaikan")}</option><option value="closed">{t("Closed", "Ditutup")}</option></select></Field>
        <Field label={t("Submitted from", "Diajukan dari")} type="date" value={countFilters.from} max={countFilters.to || undefined} disabled={busy} onChange={e => setCountFilters({ ...countFilters, from: e.target.value })} />
        <Field label={t("Submitted through", "Diajukan sampai")} type="date" value={countFilters.to} min={countFilters.from || undefined} disabled={busy} onChange={e => setCountFilters({ ...countFilters, to: e.target.value })} />
      </div>}
      {format === "csv" && <Notice>{t("Import identifier columns as text to preserve leading zeros. Choose XLSX for opening directly in Excel.", "Impor kolom kode sebagai teks agar nol awal tetap utuh. Pilih XLSX untuk dibuka langsung di Excel.")}</Notice>}
      {option.events && <><Field label={t("Posted transaction", "Transaksi tercatat")}><select disabled={busy || loading} value={transactionId} onChange={e => setTransactionId(e.target.value)}><option value="">{loading ? t("Loading…", "Memuat…") : t("Choose a transaction", "Pilih transaksi")}</option>{events.map(event => <option key={event.id} value={event.id}>{event.id} · {event.quantity} · {event.posted}</option>)}</select></Field>{!loading && !events.length && <p>{t("No eligible posted transactions.", "Tidak ada transaksi tercatat yang memenuhi syarat.")}</p>}</>}
      <p className="muted">{t("The file uses a fresh server snapshot and does not confirm any stock transaction.", "File memakai snapshot server terbaru dan tidak mengonfirmasi transaksi stok.")}</p>
      <div role="status" aria-live="polite">{message}</div>
    </Modal>}
  </div>;
}
