"use strict";

const root = document.documentElement;
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const number = (value) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const products = [
  { id: "SIM-001", name: "Contoh produk A" }, { id: "SIM-002", name: "Contoh produk B" },
  { id: "SIM-003", name: "Contoh produk C" }, { id: "SIM-004", name: "Contoh produk D" },
  { id: "SIM-005", name: "Contoh produk E" }, { id: "SIM-006", name: "Contoh produk F" },
];
const locations = ["Receiving", "Rak A-01", "Rak A-02", "Area QC"];
const initialRows = [
  ["r1", 0, "Receiving", 60, 0, "Layak"], ["r2", 0, "Rak A-01", 24, 8, "Layak"],
  ["r3", 1, "Rak A-01", 40, 12, "Layak"], ["r4", 2, "Rak A-02", 32, 0, "Layak"],
  ["r5", 3, "Rak A-02", 15, 4, "Layak"], ["r6", 4, "Rak A-01", 12, 3, "Layak"],
  ["r7", 5, "Rak A-02", 18, 0, "Layak"], ["r8", 0, "Area QC", 8, 2, "Karantina"],
  ["r9", 1, "Area QC", 5, 0, "Karantina"], ["r10", 2, "Area QC", 2, 0, "Rusak"],
  ["r11", 4, "Receiving", 20, 0, "Layak"], ["r12", 5, "Receiving", 30, 5, "Layak"],
];
const state = { view: "operations", rows: [], selected: new Set(["r2", "r3", "r6"]), location: "all", condition: "all", allocation: "all", query: "", page: 0, pageSize: 10, sort: "id", ascending: true, events: [], transport: "online", presentation: "data", pending: null, receiptRemaining: 100, sequence: 0, action: null, reportProduct: null, treeOpen: true };
const available = (row) => row.condition === "Layak" ? row.physical - row.committed : 0;
const productOf = (row) => products.find((product) => product.id === row.product);
const selectedRows = () => state.rows.filter((row) => state.selected.has(row.id));
const status = (condition) => `<span class="status ${condition === "Layak" ? "success" : condition === "Karantina" ? "warning" : "danger"}">${condition}</span>`;

function seed() {
  state.rows = initialRows.map(([id, product, location, physical, committed, condition]) => ({ id, product: products[product].id, location, physical, committed, condition }));
  state.events = state.rows.map((row, i) => ({ id: `SIM-OPEN-${String(i + 1).padStart(3, "0")}`, product: row.product, location: row.location, quantity: row.physical, reason: "Saldo awal simulasi" }));
}
seed();

function notify(title, body, tone = "success") {
  $("notification").hidden = false;
  $("notification").className = `notification message ${tone}`;
  $("notification-title").textContent = title;
  $("notification-body").textContent = body;
}

function filteredRows() {
  const query = state.query.trim().toLocaleLowerCase("id-ID");
  return state.rows.filter((row) => {
    if (state.location !== "all" && row.location !== state.location) return false;
    if (state.condition !== "all" && row.condition !== state.condition) return false;
    if (state.allocation === "available" && available(row) <= 0) return false;
    if (state.allocation === "blocked" && available(row) > 0) return false;
    if (state.view === "overview" && row.condition === "Layak" && available(row) > 0) return false;
    return !query || `${row.product} ${productOf(row).name} ${row.location}`.toLocaleLowerCase("id-ID").includes(query);
  }).sort((a, b) => {
    const key = state.sort;
    const first = key === "product" ? productOf(a).name : key === "available" ? available(a) : a[key];
    const second = key === "product" ? productOf(b).name : key === "available" ? available(b) : b[key];
    const result = typeof first === "number" ? first - second : String(first).localeCompare(String(second), "id", { numeric: true });
    return state.ascending ? result : -result;
  });
}

function filterButton(kind, value, label, count, child = false) {
  return `<button type="button" class="tree-item${child ? " child" : ""}" data-filter-kind="${kind}" data-filter-value="${escapeHtml(value)}" aria-pressed="${state[kind] === value}"><span>${escapeHtml(label)}</span><span>${count}</span></button>`;
}
function renderFilters() {
  const locationButtons = locations.map((location) => filterButton("location", location, location, state.rows.filter((r) => r.location === location).length, true)).join("");
  const conditions = ["Layak", "Karantina", "Rusak"].map((condition) => filterButton("condition", condition, condition, state.rows.filter((r) => r.condition === condition).length)).join("");
  const html = `<div class="filter-group"><p class="filter-heading">Lokasi</p>${filterButton("location", "all", "Semua lokasi", state.rows.length)}<details data-location-tree ${state.treeOpen ? "open" : ""}><summary>Gudang simulasi</summary>${locationButtons}</details></div><div class="filter-group"><p class="filter-heading">Kondisi barang</p>${filterButton("condition", "all", "Semua kondisi", state.rows.length)}${conditions}</div><div class="filter-group"><p class="filter-heading">Ketersediaan</p>${filterButton("allocation", "all", "Semua posisi", state.rows.length)}${filterButton("allocation", "available", "Bebas untuk alokasi", state.rows.filter((r) => available(r) > 0).length)}${filterButton("allocation", "blocked", "Belum dapat dialokasikan", state.rows.filter((r) => available(r) === 0).length)}</div>`;
  $("desktop-filters").innerHTML = html;
  $("mobile-filters").innerHTML = html;
}

function sortHeader(key, label, numeric = false) {
  const sorted = state.sort === key;
  return `<th scope="col"${numeric ? ' class="numeric"' : ""}${sorted ? ` aria-sort="${state.ascending ? "ascending" : "descending"}"` : ""}><button type="button" class="sort" data-sort="${key}">${label}${sorted ? state.ascending ? " ↑" : " ↓" : ""}</button></th>`;
}

function renderStock() {
  const rows = filteredRows();
  state.page = Math.max(0, Math.min(state.page, Math.ceil(rows.length / state.pageSize) - 1));
  const pageRows = rows.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize);
  $("page-range").textContent = rows.length ? `${state.page * state.pageSize + 1}-${state.page * state.pageSize + pageRows.length} / ${rows.length}` : "0 / 0";
  $("previous").disabled = state.page === 0;
  $("next").disabled = (state.page + 1) * state.pageSize >= rows.length;
  $("context-label").textContent = state.location === "all" ? "Semua lokasi" : state.location;
  $("context-count").textContent = `${rows.length} posisi stok${state.condition === "all" ? "" : ` / ${state.condition}`}`;

  if (state.presentation !== "data" || !rows.length) {
    const mode = !rows.length ? "filtered" : state.presentation;
    const copy = {
      empty: ["Belum ada persediaan pada contoh ini", "Penerimaan yang dikonfirmasi akan membentuk posisi stok pada lokasi yang dipilih.", "Tampilkan data simulasi"],
      filtered: ["Tidak ada posisi stok yang cocok", "Hapus pencarian atau ubah filter lokasi, kondisi, dan ketersediaan.", "Hapus pencarian dan filter"],
      loading: ["Memuat daftar persediaan...", "Jumlah dan kondisi akan tersedia setelah pemuatan selesai. Keadaan ini disimulasikan untuk peninjauan desain.", "Selesaikan simulasi pemuatan"],
      error: ["Daftar persediaan belum berhasil dimuat", "Periksa koneksi lalu coba memuat ulang. Keadaan ini disimulasikan untuk peninjauan desain.", "Coba muat ulang"],
    }[mode];
    return `<section class="empty-state" role="status"><h2>${copy[0]}</h2><p>${copy[1]}</p><button type="button" data-recover="${mode}">${copy[2]}</button></section>`;
  }
  const body = pageRows.map((row) => `<tr class="${state.selected.has(row.id) ? "selected-row" : ""}" data-row="${row.id}"><td class="check-cell"><label class="check-hit"><input type="checkbox" data-select-row="${row.id}" aria-label="Pilih ${escapeHtml(productOf(row).name)} di ${escapeHtml(row.location)}" ${state.selected.has(row.id) ? "checked" : ""}></label></td><td class="product-cell" data-label="Produk"><span class="sku">[${row.product}]</span>${escapeHtml(productOf(row).name)}</td><td data-label="Lokasi">${escapeHtml(row.location)}</td><td class="numeric" data-label="Fisik">${number(row.physical)}</td><td class="numeric" data-label="Komitmen">${number(row.committed)}</td><td class="numeric ${available(row) ? "free-value" : "blocked-value"}" data-label="Bebas">${number(available(row))}</td><td data-label="Kondisi">${status(row.condition)}</td><td class="row-actions-cell" data-label="Tindakan"><div class="row-links"><button type="button" class="row-action" data-detail="${row.id}">Rincian</button><button type="button" class="row-action" data-history="${row.product}">Kartu stok</button></div></td></tr>`).join("");
  const allSelected = pageRows.every((row) => state.selected.has(row.id));
  const someSelected = pageRows.some((row) => state.selected.has(row.id));
  const html = `<div class="table-wrap"><table class="data-table"><caption>Posisi stok simulasi. Semua jumlah dalam pcs.</caption><colgroup><col style="width:44px"><col style="width:24%"><col style="width:14%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:12%"><col></colgroup><thead><tr><th class="check-cell" scope="col"><label class="check-hit"><input id="select-page" type="checkbox" aria-label="Pilih semua posisi pada halaman ini" ${allSelected ? "checked" : ""}></label></th>${sortHeader("product", "Produk")}${sortHeader("location", "Lokasi")}${sortHeader("physical", "Fisik", true)}${sortHeader("committed", "Komitmen", true)}${sortHeader("available", "Bebas", true)}<th scope="col">Kondisi</th><th scope="col">Tindakan</th></tr></thead><tbody>${body}</tbody></table></div><footer class="table-footer"><span>Fisik dan komitmen tetap terpisah. Karantina tidak tersedia untuk alokasi.</span><span>Data simulasi / pcs</span></footer>`;
  requestAnimationFrame(() => { if ($("select-page")) $("select-page").indeterminate = someSelected && !allSelected; });
  return html;
}

function renderProducts() {
  const filtered = products.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(state.query.toLowerCase()));
  $("context-count").textContent = `${filtered.length} produk simulasi`;
  const rows = filtered.map((product) => `<tr><td class="product-cell" data-label="Produk"><span class="sku">[${product.id}]</span>${escapeHtml(product.name)}</td><td data-label="Satuan">pcs</td><td class="numeric" data-label="Lokasi berisi stok">${new Set(state.rows.filter((row) => row.product === product.id).map((row) => row.location)).size}</td><td data-label="Tindakan"><button type="button" class="row-action" data-product-stock="${product.id}">Lihat persediaan</button></td></tr>`).join("");
  return `<table class="data-table"><caption>Master produk simulasi untuk meninjau struktur daftar.</caption><thead><tr><th>Produk</th><th>Satuan</th><th class="numeric">Lokasi berisi stok</th><th>Tindakan</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Tidak ada produk yang cocok dengan pencarian.</td></tr>'}</tbody></table>`;
}

function renderReport() {
  const events = state.events.filter((event) => (!state.reportProduct || event.product === state.reportProduct) && `${event.id} ${event.product} ${productOf({ product: event.product }).name} ${event.location}`.toLowerCase().includes(state.query.toLowerCase()));
  $("context-count").textContent = `${events.length} entri simulasi`;
  const body = events.map((event) => `<tr><td data-label="Referensi"><button type="button" class="row-action" data-event="${event.id}">${event.id}</button></td><td class="product-cell" data-label="Produk">${escapeHtml(productOf({ product: event.product }).name)}</td><td data-label="Lokasi">${escapeHtml(event.location)}</td><td class="numeric" data-label="Perubahan fisik">+${number(event.quantity)}</td><td data-label="Keterangan">${escapeHtml(event.reason)}</td></tr>`).join("");
  return `${state.reportProduct ? `<div class="view-note"><p>Kartu stok ${state.reportProduct}. <button type="button" class="row-action" id="clear-report-filter">Lihat semua entri</button></p></div>` : ""}<table class="data-table"><caption>Buku mutasi simulasi. Reservasi tidak mengubah jumlah fisik.</caption><thead><tr><th>Referensi</th><th>Produk</th><th>Lokasi</th><th class="numeric">Perubahan fisik</th><th>Keterangan</th></tr></thead><tbody>${body || '<tr><td colspan="5">Belum ada entri yang cocok.</td></tr>'}</tbody></table>`;
}

function renderSettings() {
  $("context-count").textContent = "Preferensi preview";
  return `<section class="settings"><h2>Preferensi preview</h2><p class="muted">Pengaturan ini membantu meninjau komponen dan keadaan UI. Konfigurasi perusahaan belum diimplementasikan.</p><div class="fields"><div class="field"><label for="density">Kepadatan daftar</label><select id="density"><option value="compact">Ringkas</option><option value="comfortable">Nyaman</option></select></div><div class="field"><label for="transport">Koneksi penerimaan simulasi</label><select id="transport"><option value="online">Online</option><option value="offline">Offline sebelum terkirim</option><option value="unknown">Respons hilang setelah tercatat</option></select></div></div><div class="field"><label for="presentation">Keadaan contoh daftar</label><select id="presentation"><option value="data">Data tersedia</option><option value="empty">Kosong</option><option value="loading">Memuat</option><option value="error">Gagal dimuat</option></select><p>Pilih Operasi untuk melihat keadaan yang dipilih.</p></div><div class="settings-actions"><button type="button" class="primary" id="back-operations">Kembali ke persediaan</button><button type="button" id="reset-demo">Atur ulang data simulasi</button></div></section>`;
}

function updateSelection() {
  const selected = selectedRows();
  $("selection-bar").hidden = !selected.length || !["operations", "overview"].includes(state.view);
  $("selection-count").textContent = selected.length;
  $("reserve-open").disabled = !selected.length || selected.some((row) => available(row) <= 0);
}

function render() {
  const active = document.activeElement;
  let restore = null;
  if (active?.id) restore = `#${CSS.escape(active.id)}`;
  else if (active?.dataset.selectRow) restore = `[data-select-row="${CSS.escape(active.dataset.selectRow)}"]`;
  else if (active?.dataset.filterKind) restore = `${active.closest("#mobile-filters") ? "#mobile-filters" : "#desktop-filters"} [data-filter-kind="${CSS.escape(active.dataset.filterKind)}"][data-filter-value="${CSS.escape(active.dataset.filterValue)}"]`;
  else if (active?.dataset.sort) restore = `[data-sort="${CSS.escape(active.dataset.sort)}"]`;
  const stockView = ["operations", "overview"].includes(state.view);
  for (const button of document.querySelectorAll("[data-view]")) {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  }
  $("view-title").textContent = ({ operations: "Persediaan", overview: "Perlu ditinjau", products: "Produk", reporting: "Kartu stok", settings: "Konfigurasi" })[state.view];
  document.title = `Inventory | ${$("view-title").textContent}`;
  $("desktop-filters").hidden = !stockView;
  $("workspace").style.gridTemplateColumns = stockView ? "" : "minmax(0, 1fr)";
  $("transaction-actions").hidden = !stockView;
  $("filters-open").hidden = !stockView;
  $("pager").hidden = !stockView || state.presentation !== "data";
  $("search-field").hidden = state.view === "settings";
  $("search").value = state.query;
  $("clear-search").hidden = !state.query;
  $("context-label").textContent = state.view === "reporting" ? "Riwayat pergerakan" : state.view === "settings" ? "Pratinjau" : "Semua lokasi";
  renderFilters();
  $("view").innerHTML = stockView ? renderStock() : state.view === "products" ? renderProducts() : state.view === "reporting" ? renderReport() : renderSettings();
  if (state.view === "settings") { $("density").value = root.dataset.density; $("transport").value = state.transport; $("presentation").value = state.presentation; }
  updateSelection();
  $("receive-open").disabled = state.receiptRemaining <= 0 && !state.pending;
  if (restore && !active.isConnected) document.querySelector(restore)?.focus({ preventScroll: true });
}

function switchView(view, preserveQuery = false) {
  state.view = view;
  state.page = 0;
  state.selected.clear();
  if (!preserveQuery) state.query = "";
  $("module-nav").classList.remove("is-open");
  $("mobile-menu").setAttribute("aria-expanded", "false");
  render();
}

const dialogTriggers = new Map();
function openDialog(id) {
  dialogTriggers.set(id, document.activeElement);
  $(id).showModal();
}
function closeDialog(id) { $(id).close(); }
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]")].filter((node) => node.getClientRects().length);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener("close", () => {
    const trigger = dialogTriggers.get(dialog.id);
    if (trigger && trigger.isConnected && !trigger.disabled) trigger.focus(); else document.querySelector('[data-view][aria-current="page"]').focus();
  });
}

function showAction(title, html, action = null) {
  state.action = action;
  $("action-title").textContent = title;
  $("action-content").innerHTML = html;
  if (!$("action-dialog").open) openDialog("action-dialog");
  else $("action-dialog").querySelector("input:not([readonly]), select, button").focus();
}

function detail(id) {
  const row = state.rows.find((entry) => entry.id === id);
  const entries = state.events.filter((event) => event.product === row.product && event.location === row.location);
  showAction(productOf(row).name, `<p class="muted">${row.product} / ${escapeHtml(row.location)} / data simulasi</p><dl class="detail-grid"><div><dt>Fisik</dt><dd>${number(row.physical)}</dd></div><div><dt>Komitmen</dt><dd>${number(row.committed)}</dd></div><div class="available"><dt>Bebas</dt><dd>${number(available(row))}</dd></div></dl><dl class="definition"><div><dt>Satuan</dt><dd>pcs</dd></div><div><dt>Kondisi</dt><dd>${status(row.condition)}</dd></div></dl>${row.condition !== "Layak" ? '<div class="message warning"><strong>Belum tersedia untuk alokasi</strong><p>Fisik dan komitmen tetap tercatat. Selesaikan pemeriksaan kualitas sebelum pemenuhan dilanjutkan.</p></div>' : ""}<h3 style="margin-top:1.2rem">Pergerakan fisik simulasi</h3><ul class="event-list">${entries.map((event) => `<li>+${number(event.quantity)} pcs <small>${event.id} / ${event.reason}</small></li>`).join("")}</ul><div class="dialog-actions"><button type="button" data-close="action-dialog">Tutup rincian</button></div>`);
}

function receiveForm() {
  if (state.pending) { showPending(); return; }
  showAction("Catat penerimaan simulasi", `<p class="muted">Penerimaan terhadap PO-SIM-001. Sisa dokumen ${number(state.receiptRemaining)} pcs.</p><form id="receive-form" novalidate><div class="fields"><div class="field"><label for="receive-product">Produk</label><select id="receive-product">${products.map((p) => `<option value="${p.id}">${p.id} / ${p.name}</option>`).join("")}</select></div><div class="field"><label for="receive-location">Lokasi tujuan</label><select id="receive-location">${locations.map((location) => `<option>${location}</option>`).join("")}</select></div></div><div class="fields"><div class="field"><label for="receive-quantity">Jumlah aktual (pcs)</label><input id="receive-quantity" type="number" min="1" max="${state.receiptRemaining}" step="1" value="${Math.min(60, state.receiptRemaining)}" inputmode="numeric" aria-describedby="receive-error"></div><div class="field"><label for="receive-quality">Kondisi awal</label><select id="receive-quality"><option>Layak</option><option>Karantina</option></select></div></div><p id="receive-error" class="error-text" role="alert" hidden></p><p class="compact-note">Data simulasi. Persetujuan, akses dan penyimpanan backend belum diimplementasikan.</p><div class="dialog-actions"><button type="submit" class="primary">Tinjau penerimaan</button><button type="button" data-close="action-dialog">Batal</button></div></form>`, { type: "receive-form" });
}

function reserveForm() {
  const rows = selectedRows();
  if (!rows.length || rows.some((row) => available(row) <= 0)) return;
  showAction("Reservasi posisi terpilih", `<p>${rows.length} posisi dipilih. Jumlah berikut berlaku untuk setiap posisi.</p>${selectedSummary(rows)}<form id="reserve-form" novalidate><div class="field"><label for="reserve-quantity">Jumlah per posisi (pcs)</label><input id="reserve-quantity" type="number" min="1" max="${Math.min(...rows.map(available))}" step="1" value="1" aria-describedby="reserve-error"></div><p id="reserve-error" class="error-text" role="alert" hidden></p><p class="compact-note">Komitmen bertambah; fisik tetap. Contoh ini belum mencakup picking.</p><div class="dialog-actions"><button type="submit" class="primary">Simulasikan reservasi</button><button type="button" data-close="action-dialog">Batal</button></div></form>`, { type: "reserve", ids: rows.map((row) => row.id) });
}

function selectedSummary(rows) {
  return `<ul class="event-list">${rows.map((row) => `<li>${escapeHtml(productOf(row).name)} <small>${row.product} / ${escapeHtml(row.location)} / bebas ${number(available(row))} pcs</small></li>`).join("")}</ul>`;
}

function bulkForm() {
  const rows = selectedRows();
  if (!rows.length) return;
  showAction("Tindakan pada pilihan", `<p>${rows.length} posisi stok dipilih.</p>${selectedSummary(rows)}<div class="dialog-actions"><button type="button" id="quarantine-review">Tahan untuk QC</button><button type="button" id="release-review" ${rows.every((row) => row.committed === 0) ? "disabled" : ""}>Lepas reservasi</button></div><p class="compact-note">Perubahan pada preview hanya mengubah data simulasi.</p>`, { type: "bulk", ids: rows.map((row) => row.id) });
}

function applyReceipt(intent) {
  if (intent.applied) return;
  let row = state.rows.find((entry) => entry.product === intent.product && entry.location === intent.location && entry.condition === intent.condition);
  if (!row) { row = { id: `r${state.rows.length + 1}`, product: intent.product, location: intent.location, condition: intent.condition, physical: 0, committed: 0 }; state.rows.push(row); }
  row.physical += intent.quantity;
  state.receiptRemaining -= intent.quantity;
  state.events.push({ id: intent.id, product: intent.product, location: intent.location, quantity: intent.quantity, reason: `Penerimaan ${intent.condition.toLowerCase()} simulasi` });
  intent.applied = true;
}

function showPending() {
  const intent = state.pending;
  const offline = !intent.applied;
  showAction(offline ? "Penerimaan pending" : "Hasil konfirmasi belum diketahui", `<div class="message warning"><strong>${offline ? "Belum terkirim; stok belum dikonfirmasi" : "Periksa hasil sebelum membuat permintaan baru"}</strong><p>${intent.quantity} pcs / ${escapeHtml(productOf({ product: intent.product }).name)} / ${escapeHtml(intent.location)}</p></div><dl class="definition"><div><dt>Referensi simulasi</dt><dd>${intent.id}</dd></div><div><dt>Kondisi</dt><dd>${intent.condition}</dd></div></dl><p class="muted">Jumlah dan identitas awal dipertahankan saat pemeriksaan ulang.</p><div class="dialog-actions"><button type="button" class="primary" id="retry-receipt" ${state.transport === "offline" ? "disabled" : ""}>${offline ? "Kirim penerimaan pending" : "Periksa hasil simulasi"}</button><button type="button" data-close="action-dialog">Tutup</button></div>${state.transport === "offline" ? '<p class="compact-note">Ubah koneksi simulasi menjadi Online di Konfigurasi untuk mengirim.</p>' : ""}`, { type: "pending" });
}

function exportCsv() {
  const rows = filteredRows();
  const csv = [["Produk", "Lokasi", "Fisik", "Komitmen", "Bebas", "Kondisi"], ...rows.map((r) => [r.product, r.location, r.physical, r.committed, available(r), r.condition])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "persediaan-simulasi.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Ekspor simulasi disiapkan", `${rows.length} posisi sesuai pencarian dan filter dimasukkan ke CSV.`);
}

function updateTokens() {
  const styles = getComputedStyle(root);
  const names = ["--canvas", "--surface", "--ink", "--action", "--accent", "--selection"];
  $("token-list").innerHTML = names.map((name) => `<div><dt class="token-code">${name}</dt><dd class="token-code">${styles.getPropertyValue(name).trim()}</dd></div>`).join("");
  $("token-swatches").innerHTML = names.map((name) => `<div><div class="swatch" style="background:var(${name})" aria-label="${name}"></div><span class="small">${name.replace("--", "")}</span></div>`).join("");
}

$("appearance").addEventListener("click", () => {
  const dark = root.dataset.appearance !== "dark";
  root.dataset.appearance = dark ? "dark" : "light";
  $("appearance").setAttribute("aria-pressed", String(dark));
  updateTokens();
});
$("mobile-menu").addEventListener("click", () => {
  const open = $("module-nav").classList.toggle("is-open");
  $("mobile-menu").setAttribute("aria-expanded", String(open));
});
$("catalog-open").addEventListener("click", () => { updateTokens(); openDialog("catalog-dialog"); });
$("filters-open").addEventListener("click", () => openDialog("filters-dialog"));
$("receive-open").addEventListener("click", receiveForm);
$("reserve-open").addEventListener("click", reserveForm);
$("bulk-open").addEventListener("click", bulkForm);
$("export").addEventListener("click", exportCsv);
$("clear-selection").addEventListener("click", () => { state.selected.clear(); render(); });
$("search").addEventListener("input", () => { state.query = $("search").value; state.page = 0; state.selected.clear(); render(); $("search").focus(); });
$("clear-search").addEventListener("click", () => { state.query = ""; state.page = 0; render(); $("search").focus(); });
$("previous").addEventListener("click", () => { state.page -= 1; state.selected.clear(); render(); });
$("next").addEventListener("click", () => { state.page += 1; state.selected.clear(); render(); });

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || target.disabled) return;
  if (target.dataset.close) { closeDialog(target.dataset.close); return; }
  if (target.dataset.view) { switchView(target.dataset.view); return; }
  if (target.dataset.filterKind) { state[target.dataset.filterKind] = target.dataset.filterValue; state.page = 0; state.selected.clear(); render(); return; }
  if (target.dataset.sort) { state.ascending = state.sort === target.dataset.sort ? !state.ascending : true; state.sort = target.dataset.sort; render(); return; }
  if (target.dataset.detail) { detail(target.dataset.detail); return; }
  if (target.dataset.history) { state.reportProduct = target.dataset.history; switchView("reporting"); return; }
  if (target.dataset.productStock) { state.location = "all"; state.condition = "all"; state.allocation = "all"; state.query = target.dataset.productStock; switchView("operations", true); return; }
  if (target.dataset.recover) { state.presentation = "data"; state.location = "all"; state.condition = "all"; state.allocation = "all"; state.query = ""; state.page = 0; render(); return; }
  if (target.dataset.event) {
    const entry = state.events.find((row) => row.id === target.dataset.event);
    showAction("Referensi mutasi simulasi", `<dl class="definition"><div><dt>Referensi</dt><dd>${entry.id}</dd></div><div><dt>Produk</dt><dd>${escapeHtml(productOf({ product: entry.product }).name)}</dd></div><div><dt>Lokasi</dt><dd>${escapeHtml(entry.location)}</dd></div><div><dt>Perubahan fisik</dt><dd>+${number(entry.quantity)} pcs</dd></div><div><dt>Sumber</dt><dd>${escapeHtml(entry.reason)}</dd></div></dl><p class="muted">Contoh lokal untuk ketertelusuran, bukan bukti akuntansi.</p>`); return;
  }
  if (target.id === "back-operations") { switchView("operations"); return; }
  if (target.id === "clear-report-filter") { state.reportProduct = null; render(); return; }
  if (target.id === "reset-demo") {
    seed(); state.pending = null; state.receiptRemaining = 100; state.presentation = "data"; state.transport = "online"; state.query = ""; state.location = "all"; state.condition = "all"; state.allocation = "all"; state.selected.clear(); render(); notify("Data simulasi diatur ulang", "Saldo awal, reservasi dan contoh koneksi kembali ke keadaan awal."); return;
  }
  if (target.id === "quarantine-review" || target.id === "release-review") {
    const rows = state.rows.filter((row) => state.action.ids.includes(row.id));
    const quarantine = target.id === "quarantine-review";
    showAction(quarantine ? "Tahan posisi untuk QC" : "Lepas reservasi simulasi", `${selectedSummary(rows)}<div class="message warning"><strong>${quarantine ? "Alokasi dan pemenuhan harus ditahan" : "Hanya reservasi sebelum picking"}</strong><p>${quarantine ? "Fisik dan komitmen tetap tercatat. Bebas untuk alokasi menjadi nol pada posisi karantina." : "Contoh ini melepas komitmen pada posisi terpilih tanpa mengubah fisik. Proses setelah picking membutuhkan pengembalian yang sah."}</p></div><div class="dialog-actions"><button type="button" class="primary" id="apply-bulk">Simulasikan perubahan</button><button type="button" data-close="action-dialog">Batal</button></div>`, { type: quarantine ? "quarantine" : "release", ids: rows.map((row) => row.id) }); return;
  }
  if (target.id === "apply-bulk") {
    const rows = state.rows.filter((row) => state.action.ids.includes(row.id));
    const quarantine = state.action.type === "quarantine";
    for (const row of rows) { if (quarantine) row.condition = "Karantina"; else row.committed = 0; }
    closeDialog("action-dialog"); render(); notify(quarantine ? "Posisi simulasi ditahan untuk QC" : "Reservasi simulasi dilepas", `${rows.length} posisi berubah. Jumlah fisik tetap. ${quarantine ? "Komitmen tetap terlacak; alokasi baru tertahan." : "Contoh ini hanya mencakup keadaan sebelum picking."}`, quarantine ? "warning" : "success"); return;
  }
  if (target.id === "confirm-receipt") {
    if (state.action?.type !== "receive-confirm" || !$("action-dialog").open || state.action.intent.id) return;
    const intent = state.action.intent;
    intent.id = `SIM-RECEIPT-${String(++state.sequence).padStart(3, "0")}`;
    if (state.transport === "offline") { state.pending = intent; closeDialog("action-dialog"); render(); notify("Penerimaan pending; stok belum dikonfirmasi", `${intent.quantity} pcs belum terkirim. Buka Penerimaan untuk melihat antrean yang sama.`, "warning"); }
    else {
      applyReceipt(intent); state.pending = state.transport === "unknown" ? intent : null;
      closeDialog("action-dialog"); render();
      notify(state.pending ? "Hasil konfirmasi belum diketahui" : "Penerimaan simulasi tercatat", state.pending ? `${intent.id}: periksa hasil melalui Penerimaan sebelum membuat permintaan baru.` : `${intent.id} / ${intent.quantity} pcs / ${intent.condition}. ${intent.condition === "Karantina" ? "Barang belum tersedia untuk alokasi." : "Sinkronisasi ERP belum disimulasikan."}`, state.pending || intent.condition === "Karantina" ? "warning" : "success");
    }
    return;
  }
  if (target.id === "retry-receipt") {
    if (!state.pending || state.transport === "offline") return;
    const intent = state.pending;
    applyReceipt(intent); state.pending = null; closeDialog("action-dialog"); render();
    notify("Hasil penerimaan simulasi ditemukan", `${intent.id} / ${intent.quantity} pcs. Identitas tetap sama dan fisik tidak ditambahkan dua kali.`); return;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.selectRow) { if (target.checked) state.selected.add(target.dataset.selectRow); else state.selected.delete(target.dataset.selectRow); render(); }
  if (target.id === "select-page") { for (const row of filteredRows().slice(state.page * state.pageSize, (state.page + 1) * state.pageSize)) { if (target.checked) state.selected.add(row.id); else state.selected.delete(row.id); } render(); }
  if (target.id === "density") root.dataset.density = target.value;
  if (target.id === "transport") state.transport = target.value;
  if (target.id === "presentation") state.presentation = target.value;
});

document.addEventListener("toggle", (event) => {
  if (!event.target.matches?.("details[data-location-tree]")) return;
  state.treeOpen = event.target.open;
  for (const tree of document.querySelectorAll("details[data-location-tree]")) if (tree.open !== state.treeOpen) tree.open = state.treeOpen;
}, true);

document.addEventListener("submit", (event) => {
  if (!["receive-form", "reserve-form"].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === "receive-form") {
    const quantity = Number($("receive-quantity").value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > state.receiptRemaining) { $("receive-error").hidden = false; $("receive-error").textContent = `Masukkan jumlah bulat dari 1 sampai ${state.receiptRemaining} pcs.`; $("receive-quantity").setAttribute("aria-invalid", "true"); $("receive-quantity").focus(); return; }
    const intent = { product: $("receive-product").value, location: $("receive-location").value, condition: $("receive-quality").value, quantity, applied: false };
    showAction("Tinjau penerimaan simulasi", `<dl class="definition"><div><dt>Dokumen sumber</dt><dd>PO-SIM-001</dd></div><div><dt>Produk</dt><dd>${escapeHtml(productOf({ product: intent.product }).name)}</dd></div><div><dt>Lokasi</dt><dd>${escapeHtml(intent.location)}</dd></div><div><dt>Aktual</dt><dd>${quantity} pcs</dd></div><div><dt>Sisa setelah penerimaan</dt><dd>${state.receiptRemaining - quantity} pcs</dd></div><div><dt>Kondisi awal</dt><dd>${status(intent.condition)}</dd></div></dl>${intent.condition === "Karantina" ? '<div class="message warning"><strong>Penerimaan tetap dapat dicatat</strong><p>Barang masuk karantina dan belum tersedia untuk alokasi.</p></div>' : ""}<div class="dialog-actions"><button type="button" class="primary" id="confirm-receipt">Simulasikan konfirmasi</button><button type="button" data-close="action-dialog">Batal</button></div><p class="compact-note">Hanya demonstrasi lokal. Tidak ada transaksi database atau pengiriman ERP.</p>`, { type: "receive-confirm", intent });
  } else {
    const quantity = Number($("reserve-quantity").value);
    const rows = state.rows.filter((row) => state.action.ids.includes(row.id));
    const limit = Math.min(...rows.map(available));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > limit) { $("reserve-error").hidden = false; $("reserve-error").textContent = `Jumlah harus bulat, minimal 1 dan maksimal ${limit} pcs untuk setiap posisi terpilih.`; $("reserve-quantity").setAttribute("aria-invalid", "true"); $("reserve-quantity").focus(); return; }
    for (const row of rows) row.committed += quantity;
    closeDialog("action-dialog"); render(); notify("Reservasi simulasi tercatat", `${quantity} pcs pada setiap ${rows.length} posisi. Jumlah fisik tetap; bebas untuk alokasi berkurang.`);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); if (!$("search-field").hidden) $("search").focus(); }
});
render();
updateTokens();
