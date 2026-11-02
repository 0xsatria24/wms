import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  PencilSimple,
} from "@phosphor-icons/react";
import { itemCatalogPage } from "./item-catalog";
import { useServerCatalogue } from "./server-catalogue";
import { useBulkSelection } from "./selection";
import { BulkActions } from "./BulkActions";
import { canAccessAction } from "./bulk-model";
import { downloadLabelSheet } from "./bulk-files";
import { productSuggestions, valueSuggestions } from "./autocomplete-model";
import { MAIN, SECONDARY, locations } from "./fixtures";
import {
  useText,
  useCataloguePageSize,
  Button,
  Field,
  Lookup,
  Notice,
  Panel,
  Tag,
  DataTable,
  Modal,
  Summary,
  Tabs,
  Thumb,
  ProductName,
  errorText,
} from "./ui.tsx";
export { Controls } from "./controls.tsx";

export function Access({ data, setData, user, flash, createUser, deleteUser, setCatalogueQuery, warehouse, editRecord, refresh }) {
  const t = useText();
  const [tab, setTab] = useState("users");
  const [selected, setSelected] = useState(null);
  const [role, setRole] = useState("operator");
  const [warehouses, setWarehouses] = useState([MAIN]);
  const [reason, setReason] = useState("");
  const [userAction, setUserAction] = useState(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const server = useServerCatalogue(data, setCatalogueQuery, {
    view: "access", status: tab === "pending" ? "pending" : "users", usersPage,
  });
  const paging = setCatalogueQuery ? data.userPage : null;
  const loadingUsers = Boolean(setCatalogueQuery && !server);
  const pendingTotal = paging?.pendingTotal ?? data.users.filter((u) => u.status === "pending").length;
  const rows = data.users.filter(u => tab === "users" ? !["pending", "deleted"].includes(u.status) : u.status === "pending");
  const bulk = useBulkSelection({ rows, scope: JSON.stringify([user.id, user.role, warehouse, tab, usersPage]), label: row => `${row.name} · ${row.email}`, allowed: row => ["active", "rejected", "revoked"].some(status => canAccessAction(status, row, user)), disabled: loadingUsers || !editRecord });
  const accessActions = [
    ["active", t("Approve selected access", "Setujui akses terpilih")],
    ["rejected", t("Reject selected requests", "Tolak permintaan terpilih")],
    ["revoked", t("Revoke selected access", "Cabut akses terpilih")],
  ].map(([status, label]) => ({
    id: status, label, reason: true, danger: status !== "active", allowed: row => canAccessAction(status, row, user),
    description: t(`Existing roles and warehouse access are retained. Requests without access are approved as Operator in ${warehouse}.`, `Peran dan akses gudang yang sudah ada dipertahankan. Permintaan tanpa akses disetujui sebagai Operator di ${warehouse}.`),
    perform: async (row, reason) => editRecord("access-status", { id: row.id, expectedStatus: row.status, status, reason }),
    after: async () => { await refresh?.(); },
  }));
  if (user.role !== "admin")
    return (
      <Panel>
        <Notice kind="warning" title={t("Access denied", "Akses ditolak")}>
          {t(
            "Only the admin demo role can manage users and access.",
            "Hanya peran admin demo yang bisa mengelola pengguna dan akses.",
          )}
        </Notice>
      </Panel>
    );
  const startUserAction = (target = null) => {
    setUserAction({ target });
    setNewName("");
    setNewEmail("");
    setActionReason("");
    setActionError("");
  };
  const open = (u) => {
    setSelected(u);
    setRole(u.role);
    setWarehouses(u.warehouses);
    setReason("");
  };
  const save = (status) => {
    if (!reason.trim() || !warehouses.length) {
      flash(
        t(
          "Choose a warehouse and add a decision reason.",
          "Pilih gudang dan isi alasan keputusan.",
        ),
        "error",
      );
      return;
    }
    if (selected.id === user.id) {
      flash(
        t(
          "You cannot approve or change your own access.",
          "Kamu tidak bisa menyetujui atau mengubah akses sendiri.",
        ),
        "error",
      );
      return;
    }
    setData((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === selected.id ? { ...u, role, warehouses, status } : u,
      ),
      audit: [
        {
          id: crypto.randomUUID(),
          type: "access-change",
          user: user.id,
          warehouse: MAIN,
          payload: { target: selected.id, role, warehouses, status, reason },
          stamp: new Date().toISOString(),
        },
        ...s.audit,
      ],
    }));
    setSelected(null);
    flash(
      t(
        "Access decision recorded in the local demo. No email was sent.",
        "Keputusan akses dicatat di demo lokal. Tidak ada email dikirim.",
      ),
    );
  };
  return (
    <Panel
      title={t("Access management", "Pengelolaan akses")}
      className="access-management"
      action={
        <Button primary onClick={() => startUserAction()}>
          <Plus size={18} aria-hidden="true" />
          {t("Add user", "Tambah user")}
        </Button>
      }
    >
      <Tabs
        label={t("User lists", "Daftar pengguna")}
        value={tab}
        onChange={(value) => { setTab(value); setUsersPage(1); }}
        items={[
          ["users", t("Users", "Pengguna")],
          [
            "pending",
            t(
              `Pending approvals (${pendingTotal})`,
              `Menunggu persetujuan (${pendingTotal})`,
            ),
          ],
        ]}
      />
      <BulkActions selection={bulk} actions={accessActions} />
      <DataTable
        label={t("Users and warehouse access", "Pengguna dan akses gudang")}
        rows={rows}
        selection={bulk}
        empty={
          tab === "users"
            ? t("No users yet.", "Belum ada user.")
            : t(
                "No access requests waiting.",
                "Tidak ada permintaan akses yang menunggu.",
              )
        }
        columns={[
          { key: "name", label: t("Name", "Nama") },
          { key: "email", label: t("Work email", "Email kerja") },
          {
            key: "role",
            label: t("Role", "Peran"),
            render: (u) => <Tag>{u.role}</Tag>,
          },
          {
            key: "warehouses",
            label: t("Warehouse access", "Akses gudang"),
            render: (u) => u.warehouses.join(", "),
          },
          {
            key: "status",
            label: t("Status", "Status"),
            render: (u) => (
              <Tag kind={u.status === "active" ? "success" : "warning"}>
                {u.status === "active"
                  ? t("Active", "Aktif")
                  : u.status === "revoked"
                    ? t("Access revoked", "Akses dicabut")
                    : u.status === "rejected"
                      ? t("Request rejected", "Permintaan ditolak")
                      : u.verified
                        ? t("Awaiting approval", "Menunggu persetujuan")
                        : t("Email not verified", "Email belum diverifikasi")}
              </Tag>
            ),
          },
          {
            key: "actions",
            label: t("Actions", "Tindakan"),
            render: (u) => (
              <div className="user-actions">
                <Button
                  disabled={u.id === user.id || actionBusy || loadingUsers}
                  onClick={() => open(u)}
                >
                  {t("Review access", "Tinjau akses")}
                </Button>
                <Button
                  danger
                  disabled={u.id === user.id || actionBusy || loadingUsers}
                  onClick={() => startUserAction(u)}
                >
                  <Trash size={18} aria-hidden="true" />
                  {t("Delete user", "Hapus user")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      {paging && (
        <nav className="catalogue-pagination" aria-label={t("User pages", "Halaman pengguna")} aria-busy={loadingUsers}>
          <span role="status">{loadingUsers ? t("Loading users…", "Memuat pengguna…") : t(`Page ${paging.page} of ${paging.pages} · ${paging.total} users`, `Halaman ${paging.page} dari ${paging.pages} · ${paging.total} pengguna`)}</span>
          <Button disabled={loadingUsers || paging.page <= 1} onClick={() => setUsersPage(paging.page - 1)}>{t("Previous page", "Halaman sebelumnya")}</Button>
          <Button disabled={loadingUsers || paging.page >= paging.pages} onClick={() => setUsersPage(paging.page + 1)}>{t("Next page", "Halaman berikutnya")}</Button>
        </nav>
      )}
      <Notice>
        {t(
          "Registration requests access; it does not grant an administrator role. Production authorization is not connected in this preview.",
          "Pendaftaran mengajukan akses; tidak memberikan peran admin. Otorisasi produksi belum terhubung pada preview ini.",
        )}{" "}
        {t(
          "You cannot delete your own account.",
          "Kamu tidak bisa menghapus akun sendiri.",
        )}
      </Notice>
      {selected && (
        <Modal
          title={t("Review warehouse access", "Tinjau akses gudang")}
          onClose={() => setSelected(null)}
        >
          <div className="stack">
            <Summary
              items={[
                [t("Name", "Nama"), selected.name],
                [t("Email", "Email"), selected.email],
                [
                  t("Email verification", "Verifikasi email"),
                  selected.verified
                    ? t("Verified (demo)", "Terverifikasi (demo)")
                    : t("Not verified", "Belum diverifikasi"),
                ],
              ]}
            />
            <Field label={t("Role to grant", "Peran yang diberikan")}>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {["operator", "supervisor", "viewer", "admin"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend>
                {t("Allowed warehouses", "Gudang yang diizinkan")}
              </legend>
              {[MAIN, SECONDARY].map((w) => (
                <label key={w} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={warehouses.includes(w)}
                    onChange={(e) =>
                      setWarehouses(
                        e.target.checked
                          ? [...warehouses, w]
                          : warehouses.filter((x) => x !== w),
                      )
                    }
                  />
                  {w}
                </label>
              ))}
            </fieldset>
            <Field
              label={t(
                "Decision reason (required)",
                "Alasan keputusan (wajib)",
              )}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="form-actions">
              <Button
                danger
                onClick={() =>
                  save(selected.status === "pending" ? "rejected" : "revoked")
                }
              >
                {selected.status === "pending"
                  ? t("Reject request", "Tolak permintaan")
                  : t("Revoke access", "Cabut akses")}
              </Button>
              <Button
                primary
                disabled={!selected.verified}
                onClick={() => save("active")}
              >
                {selected.status === "pending"
                  ? t("Approve access", "Setujui akses")
                  : t("Save access", "Simpan akses")}
              </Button>
            </div>
            {!selected.verified && (
              <Notice kind="warning">
                {t(
                  "Email must be verified before approval.",
                  "Email perlu diverifikasi sebelum disetujui.",
                )}
              </Notice>
            )}
          </div>
        </Modal>
      )}
      {userAction && (
        <Modal
          title={
            userAction.target
              ? t("Delete user", "Hapus user")
              : t("Add user", "Tambah user")
          }
          onClose={() => !actionBusy && setUserAction(null)}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (actionBusy || !actionReason.trim()) return;
              setActionBusy(true);
              setActionError("");
              try {
                if (userAction.target)
                  await deleteUser(userAction.target.id, actionReason.trim());
                else {
                  await createUser(
                    newName.trim(),
                    newEmail.trim(),
                    actionReason.trim(),
                  );
                  setTab("pending");
                }
                setUserAction(null);
              } catch (error) {
                setActionError(errorText(error.message, t));
              } finally {
                setActionBusy(false);
              }
            }}
          >
            {userAction.target ? (
              <>
                <Summary
                  items={[
                    [t("Name", "Nama"), userAction.target.name],
                    [t("Work email", "Email kerja"), userAction.target.email],
                    [
                      t("Warehouse access", "Akses gudang"),
                      userAction.target.warehouses.join(", ") ||
                        t("None", "Belum ada"),
                    ],
                  ]}
                />
                <Notice kind="warning">
                  {t(
                    "This user will disappear from the user list and lose all warehouse access. Their identity remains in transaction and audit history. This action cannot be undone from this panel.",
                    "User akan dihapus dari daftar dan kehilangan seluruh akses gudang. Identitasnya tetap tersimpan di riwayat transaksi dan audit. Tindakan ini tidak bisa dibatalkan dari panel ini.",
                  )}
                </Notice>
              </>
            ) : (
              <>
                <Field
                  label={t("Full name (required)", "Nama lengkap (wajib)")}
                  required
                  maxLength={199}
                  value={newName}
                  disabled={actionBusy}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <Field
                  label={t("Work email (required)", "Email kerja (wajib)")}
                  required
                  type="email"
                  maxLength={253}
                  value={newEmail}
                  disabled={actionBusy}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
                <Notice>
                  {t(
                    "New users enter Pending approvals. Email verification and administrator review are required before warehouse access is granted. This action does not send an email.",
                    "User baru masuk ke Menunggu persetujuan. Verifikasi email dan tinjauan admin diperlukan sebelum akses gudang diberikan. Tindakan ini tidak mengirim email.",
                  )}
                </Notice>
              </>
            )}
            <Field
              label={t("Reason (required)", "Alasan (wajib)")}
              required
              value={actionReason}
              disabled={actionBusy}
              onChange={(event) => setActionReason(event.target.value)}
            />
            {actionError && <Notice kind="error">{actionError}</Notice>}
            <div className="form-actions">
              <Button disabled={actionBusy} onClick={() => setUserAction(null)}>
                {t("Cancel", "Batal")}
              </Button>
              <Button
                type="submit"
                primary={!userAction.target}
                danger={!!userAction.target}
                disabled={actionBusy || !actionReason.trim()}
              >
                {actionBusy
                  ? t("Saving…", "Lagi menyimpan…")
                  : userAction.target
                    ? t("Delete user", "Hapus user")
                    : t("Add user", "Tambah user")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Panel>
  );
}

export function Master({ data, setData, user, flash, deleteItem, setCatalogueQuery, warehouse, editRecord, refresh, locale = "en" }) {
  const t = useText();
  const [tab, setTab] = useState("items");
  const [sku, setSku] = useState("SKU-A");
  const selected = data.products.find((p) => p.sku === sku);
  const [form, setForm] = useState(selected);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [factor, setFactor] = useState("1");
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useCataloguePageSize();
  const server = useServerCatalogue(data, tab === "items" ? setCatalogueQuery : undefined, { view: "master", query: deferredQuery, status, category, sort, page, pageSize, focusSku: sku });
  const localCatalogue = useMemo(
    () =>
      itemCatalogPage(server ? data.products.filter((product) => server.ids.includes(product.sku)) : data.products, {
        query: deferredQuery,
        status,
        category,
        sort,
        page: setCatalogueQuery ? 1 : page,
        pageSize,
      }),
    [data.products, deferredQuery, status, category, sort, page, pageSize, server],
  );
  const catalogue = server ? { ...localCatalogue, ...server, rows: localCatalogue.rows } : localCatalogue;
  const bulk = useBulkSelection({ rows: catalogue.rows, scope: JSON.stringify([user.id, user.role, warehouse, tab, query, status, category, sort, page, pageSize]), key: row => row.sku, label: row => `${row.name} · ${row.sku}`, disabled: query !== deferredQuery || !!setCatalogueQuery && !server || !editRecord });
  const refreshBulk = async () => { await refresh?.(); };
  const bulkActions = [
    ...(["admin", "supervisor"].includes(user.role) ? [
      { id: "activate", label: t("Activate selected", "Aktifkan terpilih"), allowed: row => !row.active, perform: async row => editRecord("master-status", { sku: row.sku, version: row.version, active: true }), after: refreshBulk },
      { id: "deactivate", label: t("Deactivate selected", "Nonaktifkan terpilih"), reason: true, allowed: row => row.active, perform: async (row, reason) => editRecord("master-status", { sku: row.sku, version: row.version, active: false, reason }), after: refreshBulk },
      { id: "delete", label: t("Delete selected", "Hapus terpilih"), confirmLabel: t("Yes", "Ya"), cancelLabel: t("No", "Tidak"), danger: true, description: t("Items referenced by stock, documents or labels cannot be deleted. Each item is validated by the server.", "Barang yang dirujuk stok, dokumen, atau label tidak dapat dihapus. Setiap barang divalidasi server."), perform: async row => editRecord("delete-master", { sku: row.sku, version: row.version, reason: "User confirmed item deletion" }), after: refreshBulk },
    ] : []),
    ...(["admin", "supervisor", "operator"].includes(user.role) ? [{ id: "labels", label: t("Download selected labels", "Unduh label terpilih"), allowed: row => row.active && !!row.barcode, description: t("Downloads a printable label sheet. Physical printing is not confirmed.", "Mengunduh lembar label siap cetak. Cetak fisik belum dikonfirmasi."), perform: async row => editRecord("labelHistory", { sku: row.sku, version: row.version, code: row.barcode, action: "download" }), complete: rows => downloadLabelSheet(rows, locale), after: refreshBulk }] : []),
  ];
  const categories = useMemo(
    () =>
      [
        ...new Set<string>(
          (server?.categories || data.products.map((p) => p.category)).filter(Boolean),
        ),
      ].sort(),
    [data.products, server],
  );
  const closeEditor = () => {
    if (saving || deleteBusy) return;
    const dirty = selected
      ? JSON.stringify(form) !== JSON.stringify(selected)
      : !!(form?.name || form?.sku || form?.barcode);
    if (dirty) setDiscarding(true);
    else setEditorOpen(false);
  };
  useEffect(() => {
    setError("");
  }, [sku]);
  const hasChanges = selected
    ? JSON.stringify(form) !== JSON.stringify(selected)
    : !!(form?.name || form?.sku || form?.barcode);
  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const canEdit = ["admin", "supervisor"].includes(user.role);
  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (
      data.products.some(
        (p) =>
          p.sku !== sku && (p.sku === form.sku || p.barcode === form.barcode),
      )
    ) {
      setError(
        t(
          "This SKU or barcode is already assigned to another item.",
          "SKU atau barcode ini sudah dipakai barang lain.",
        ),
      );
      return;
    }
    if (Number(form.factor) <= 0) {
      setError(
        t(
          "Unit conversion must be greater than zero.",
          "Konversi satuan harus lebih dari nol.",
        ),
      );
      return;
    }
    setSaving(true);
    const saved = await setData((s) => ({
      ...s,
      products: s.products.some((p) => p.sku === sku)
        ? s.products.map((p) =>
            p.sku === sku ? { ...form, factor: Number(form.factor) } : p,
          )
        : [...s.products, { ...form, factor: Number(form.factor) }],
      audit: [
        {
          id: crypto.randomUUID(),
          type: "master-change",
          user: user.id,
          warehouse: MAIN,
          payload: { sku: form.sku },
          stamp: new Date().toISOString(),
        },
        ...s.audit,
      ],
    }));
    setSaving(false);
    if (!saved) {
      setError(
        t(
          "The item could not be saved. Your changes are still here; check the values and try again.",
          "Barang belum bisa disimpan. Perubahan tetap ada; periksa isian lalu coba lagi.",
        ),
      );
      return;
    }
    if (!selected) {
      setQuery(form.sku);
      setStatus("");
      setCategory("");
      setPage(1);
    }
    setSku(form.sku);
    setEditorOpen(false);
    flash(
      t(
        "Item master saved. No stock quantity changed.",
        "Master barang tersimpan. Jumlah stok tidak berubah.",
      ),
    );
  };
  const definitions =
    tab === "locations"
      ? data.locationMaster || locations.map((name) => ({ name, factor: 1 }))
      : data.unitMaster || [{ name: "units", factor: 1 }];
  return (
    <Panel title={t("Master data", "Data master")}>
      <Tabs
        label={t("Master type", "Jenis master")}
        value={tab}
        onChange={setTab}
        items={[
          ["items", t("Items", "Barang")],
          ["locations", t("Locations", "Lokasi")],
          ["units", t("Units", "Satuan")],
        ]}
      />
      {tab === "items" ? (
        <>
          <div className="catalogue-heading">
            <div>
              <h3>{t("Item catalogue", "Katalog barang")}</h3>
              <p className="muted">
                {t(
                  "Find an item, then open its details to make changes.",
                  "Cari barang, lalu buka detailnya untuk mengubah data.",
                )}
              </p>
            </div>
            {canEdit && (
              <Button
                primary
                onClick={() => {
                  setSku("");
                  setForm({
                    sku: "",
                    name: "",
                    barcode: "",
                    category: "General goods",
                    unit: "units",
                    factor: 1,
                    active: true,
                    image: null,
                    dimensions: "",
                    weight: "",
                  });
                  setEditorOpen(true);
                  setError("");
                }}
              >
                <Plus size={18} />
                {t("Add item", "Tambah barang")}
              </Button>
            )}
          </div>
          <div className="catalogue-toolbar">
            <div className="search">
              <MagnifyingGlass size={20} aria-hidden="true" />
              <Field
                label={t("Search items", "Cari barang")}
                type="search"
                value={query}
                suggestions={productSuggestions(
                  data.products.filter(
                    (product) =>
                      (!status ||
                        (status === "active"
                          ? product.active
                          : !product.active)) &&
                      (!category || product.category === category),
                  ),
                )}
                placeholder={t(
                  "Search name, SKU or barcode…",
                  "Cari nama, SKU, atau barcode…",
                )}
                onValueChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
              />
            </div>
            <Field label={t("Status", "Status")}>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("All statuses", "Semua status")}</option>
                <option value="active">{t("Active", "Aktif")}</option>
                <option value="inactive">{t("Inactive", "Nonaktif")}</option>
              </select>
            </Field>
            <Field label={t("Category", "Kategori")}>
              <Lookup
                value={category}
                options={[
                  { value: "", label: t("All categories", "Semua kategori") },
                  ...valueSuggestions(categories),
                ]}
                onValueChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label={t("Sort by", "Urutkan")}>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="name">{t("Name A–Z", "Nama A–Z")}</option>
                <option value="name-desc">{t("Name Z–A", "Nama Z–A")}</option>
                <option value="sku">SKU</option>
              </select>
            </Field>
          </div>
          <div className="catalogue-results" role="status">
            <span>
              {t(
                `${catalogue.total} of ${server?.scopeTotal ?? data.products.length} items`,
                `${catalogue.total} dari ${server?.scopeTotal ?? data.products.length} barang`,
              )}
            </span>
            {(query || status || category) && (
              <Button
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setCategory("");
                  setPage(1);
                }}
              >
                {t("Clear filters", "Hapus filter")}
              </Button>
            )}
          </div>
          <div className="catalogue-table" aria-busy={query !== deferredQuery}>
            <BulkActions selection={bulk} actions={bulkActions} />
            <DataTable
              label={t("Item catalogue", "Katalog barang")}
              selection={bulk}
              rows={catalogue.rows.map((p) => ({ ...p, id: p.sku }))}
              empty={t(
                "No items match these filters.",
                "Tidak ada barang yang cocok dengan filter ini.",
              )}
              columns={[
                {
                  key: "name",
                  label: t("Item / SKU", "Barang / SKU"),
                  render: (p) => (
                    <button
                      className="row-select"
                      onClick={() => {
                        setSku(p.sku);
                        const { id, ...item } = p;
                        setForm(item);
                        setEditorOpen(true);
                      }}
                    >
                      <ProductName product={p} />
                    </button>
                  ),
                },
                { key: "barcode", label: t("Barcode", "Barcode") },
                { key: "category", label: t("Category", "Kategori") },
                { key: "unit", label: t("Base unit", "Satuan dasar") },
                {
                  key: "active",
                  label: t("Status", "Status"),
                  render: (p) => (
                    <Tag kind={p.active ? "success" : "neutral"}>
                      {p.active
                        ? t("Active", "Aktif")
                        : t("Inactive", "Nonaktif")}
                    </Tag>
                  ),
                },
                {
                  key: "actions",
                  label: t("Actions", "Tindakan"),
                  render: (p) => (
                    <div className="item-actions">
                      <Button
                        aria-label={t(
                          `${canEdit ? "Edit" : "View"} ${p.name} (${p.sku})`,
                          `${canEdit ? "Ubah" : "Lihat"} ${p.name} (${p.sku})`,
                        )}
                        onClick={() => {
                          setSku(p.sku);
                          const { id, ...item } = p;
                          setForm(item);
                          setEditorOpen(true);
                        }}
                      >
                        <PencilSimple size={18} aria-hidden="true" />
                        {canEdit ? t("Edit", "Ubah") : t("View", "Lihat")}
                      </Button>
                      {canEdit && (
                        <Button
                          danger
                          aria-label={t(
                            `Delete ${p.name} (${p.sku})`,
                            `Hapus ${p.name} (${p.sku})`,
                          )}
                          onClick={() => {
                            setDeleting({ ...p });
                            setDeleteError("");
                          }}
                        >
                          <Trash size={18} aria-hidden="true" />
                          {t("Delete", "Hapus")}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
          <div className="catalogue-pagination">
            <span>
              {t(
                `Showing ${catalogue.from}–${catalogue.to} of ${catalogue.total}`,
                `Menampilkan ${catalogue.from}–${catalogue.to} dari ${catalogue.total}`,
              )}
            </span>
            <Field label={t("Rows per page", "Baris per halaman")}>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </Field>
            <nav aria-label={t("Catalogue pages", "Halaman katalog")}>
              <Button
                aria-label={t(
                  "Previous catalogue page",
                  "Halaman katalog sebelumnya",
                )}
                disabled={catalogue.page === 1}
                onClick={() => setPage(catalogue.page - 1)}
              >
                <CaretLeft size={18} />
              </Button>
              <span>
                {t(
                  `Page ${catalogue.page} of ${catalogue.pages}`,
                  `Halaman ${catalogue.page} dari ${catalogue.pages}`,
                )}
              </span>
              <Button
                aria-label={t(
                  "Next catalogue page",
                  "Halaman katalog berikutnya",
                )}
                disabled={catalogue.page === catalogue.pages}
                onClick={() => setPage(catalogue.page + 1)}
              >
                <CaretRight size={18} />
              </Button>
            </nav>
          </div>
          {editorOpen && form && (
            <Modal
              className="catalogue-editor"
              title={
                selected
                  ? t("Item details", "Detail barang")
                  : t("Add item", "Tambah barang")
              }
              onClose={closeEditor}
            >
              <form className="stack" onSubmit={save}>
                <h2>{form.name || t("New item", "Barang baru")}</h2>
                {error && <Notice kind="error">{error}</Notice>}
                <fieldset disabled={!canEdit || saving}>
                  <div className="form-grid">
                    <Field
                      label={t("Item name (required)", "Nama barang (wajib)")}
                      value={form.name}
                      required
                      onChange={change("name")}
                    />
                    <Field
                      label="SKU"
                      value={form.sku}
                      required
                      readOnly={!!selected}
                      onChange={change("sku")}
                    />
                    <Field
                      label={t("Category", "Kategori")}
                      value={form.category}
                      suggestions={valueSuggestions(
                        data.products.map((product) => product.category),
                      )}
                      onValueChange={(category) =>
                        setForm((current) => ({ ...current, category }))
                      }
                    />
                    <Field
                      label={t("Base unit", "Satuan dasar")}
                      value={form.unit}
                      readOnly={!!selected}
                      suggestions={valueSuggestions([
                        ...data.products.map((product) => product.unit),
                        ...(data.unitMaster || []).map((unit) => unit.name),
                      ])}
                      onValueChange={(unit) =>
                        setForm((current) => ({ ...current, unit }))
                      }
                    />
                    <Field
                      label={t("Conversion factor", "Faktor konversi")}
                      value={form.factor}
                      type="number"
                      min="0.0001"
                      step="any"
                      required
                      onChange={change("factor")}
                    />
                    <Field
                      label={t("Dimensions (optional)", "Dimensi (opsional)")}
                      value={form.dimensions}
                      onChange={change("dimensions")}
                    />
                    <Field
                      label={t(
                        "Unit weight (optional)",
                        "Berat satuan (opsional)",
                      )}
                      value={form.weight}
                      onChange={change("weight")}
                    />
                    <Field
                      label={t(
                        "Barcode value (internal namespace)",
                        "Nilai barcode (namespace internal)",
                      )}
                      value={form.barcode}
                      required
                      onChange={change("barcode")}
                    />
                  </div>
                  {selected && selected.barcode !== form.barcode && (
                    <Field
                      label={t(
                        "Identifier change reason (required)",
                        "Alasan perubahan kode (wajib)",
                      )}
                      value={form.reason || ""}
                      required
                      onChange={change("reason")}
                    />
                  )}
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) =>
                        setForm({ ...form, active: e.target.checked })
                      }
                    />
                    {t("Active for new documents", "Aktif untuk dokumen baru")}
                  </label>
                  {!form.active && (
                    <Field
                      label={t(
                        "Deactivation reason (required)",
                        "Alasan nonaktif (wajib)",
                      )}
                      required
                      value={form.reason || ""}
                      onChange={change("reason")}
                    />
                  )}
                </fieldset>
                <div className="image-master">
                  <Thumb large product={form} />
                  <div>
                    <strong>
                      {t("Optional item image", "Gambar barang opsional")}
                    </strong>
                    <p className="muted">
                      {t(
                        "Manage the image in the stock detail panel.",
                        "Kelola gambar di panel detail stok.",
                      )}
                    </p>
                    <a href="#stock">
                      {t("Open stock detail", "Buka detail stok")}
                    </a>
                  </div>
                </div>
                <Notice>
                  {t(
                    "Leading zeros are preserved. Internal identifiers are not official GTINs. Master changes do not rewrite transaction history.",
                    "Nol depan dipertahankan. Kode internal bukan GTIN resmi. Perubahan master tidak menulis ulang riwayat transaksi.",
                  )}
                </Notice>
                {canEdit && (
                  <div className="form-actions">
                    {selected && (
                      <Button
                        danger
                        disabled={saving}
                        onClick={() => {
                          setDeleting({ ...selected });
                          setDeleteError("");
                        }}
                      >
                        <Trash size={18} aria-hidden="true" />
                        {t("Delete item", "Hapus barang")}
                      </Button>
                    )}
                    <Button onClick={closeEditor} disabled={saving}>
                      {t("Cancel", "Batal")}
                    </Button>
                    <Button
                      primary
                      type="submit"
                      disabled={saving || !hasChanges}
                    >
                      {saving
                        ? t("Saving…", "Lagi menyimpan…")
                        : t("Save changes", "Simpan perubahan")}
                    </Button>
                  </div>
                )}
              </form>
            </Modal>
          )}
        </>
      ) : (
        <>
          <div className="section-actions">
            {canEdit && (
              <Button
                primary
                onClick={() => {
                  setAdding(true);
                  setName("");
                  setFactor("1");
                }}
              >
                {t("Add master", "Tambah master")}
              </Button>
            )}
          </div>
          <DataTable
            label={t("Master definitions", "Definisi master")}
            rows={definitions.map((r) => ({ ...r, id: r.name }))}
            columns={[
              {
                key: "name",
                label:
                  tab === "locations"
                    ? t("Location code", "Kode lokasi")
                    : t("Unit", "Satuan"),
              },
              {
                key: "factor",
                numeric: tab !== "locations",
                label:
                  tab === "locations"
                    ? t("Status", "Status")
                    : t("Conversion factor", "Faktor konversi"),
                render: (r) =>
                  tab === "locations" ? t("Active", "Aktif") : r.factor,
              },
            ]}
            empty={t("No master definitions", "Belum ada definisi master")}
          />
          <Notice>
            {t(
              "New definitions are saved locally. Transaction eligibility still follows the configured task locations and unit rules.",
              "Definisi baru tersimpan lokal. Lokasi dan satuan yang boleh dipakai transaksi tetap mengikuti aturan tugas.",
            )}
          </Notice>
        </>
      )}
      {discarding && (
        <Modal
          title={t(
            "Discard unsaved changes?",
            "Batalkan perubahan yang belum disimpan?",
          )}
          onClose={() => setDiscarding(false)}
          footer={
            <>
              <Button onClick={() => setDiscarding(false)}>
                {t("Keep editing", "Lanjutkan mengubah")}
              </Button>
              <Button
                danger
                onClick={() => {
                  setDiscarding(false);
                  setEditorOpen(false);
                  setForm(selected);
                }}
              >
                {t("Discard changes", "Batalkan perubahan")}
              </Button>
            </>
          }
        >
          <p>
            {t(
              "Your saved item stays unchanged. Only this unsaved draft will be discarded.",
              "Barang yang tersimpan tetap sama. Hanya draf yang belum disimpan ini yang akan dibuang.",
            )}
          </p>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t("Delete item", "Hapus barang")}
          onClose={() => !deleteBusy && setDeleting(null)}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (deleteBusy) return;
              setDeleteBusy(true);
              setDeleteError("");
              try {
                await deleteItem(
                  deleting.sku,
                  deleting.version,
                );
                const next = data.products.find(
                  (product) => product.sku !== deleting.sku,
                );
                setSku(next?.sku || "");
                setForm(next || null);
                setDeleting(null);
                setEditorOpen(false);
              } catch (error) {
                setDeleteError(errorText(error.message, t));
              } finally {
                setDeleteBusy(false);
              }
            }}
          >
            <p>
              {t(
                `Delete ${deleting.name} (${deleting.sku}) from the item master?`,
                `Hapus ${deleting.name} (${deleting.sku}) dari master barang?`,
              )}
            </p>
            <Notice kind="warning">
              {t(
                "Deletion cannot be undone. Only unused items can be deleted. The server checks all warehouses, documents, packaging and label history, and retains an audit record.",
                "Penghapusan tidak bisa dibatalkan. Hanya barang yang belum dipakai yang bisa dihapus. Server memeriksa seluruh gudang, dokumen, kemasan, dan riwayat label serta menyimpan catatan audit.",
              )}
            </Notice>
            {deleteError && <Notice kind="error">{deleteError}</Notice>}
            <div className="form-actions">
              <Button disabled={deleteBusy} onClick={() => setDeleting(null)}>
                {t("No", "Tidak")}
              </Button>
              <Button
                danger
                type="submit"
                disabled={deleteBusy}
              >
                {deleteBusy
                  ? t("Deleting…", "Lagi menghapus…")
                  : t("Yes", "Ya")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {adding && (
        <Modal
          title={t("Add master definition", "Tambah definisi master")}
          onClose={() => { if (!saving) setAdding(false); }}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              if (definitions.some((r) => r.name.toLowerCase() === name.trim().toLowerCase())) {
                flash(
                  t("This code already exists.", "Kode ini sudah ada."),
                  "error",
                );
                return;
              }
              setSaving(true);
              const saved = await setData({
                ...data,
                [tab === "locations" ? "locationMaster" : "unitMaster"]: [
                  ...definitions,
                  { name: name.trim(), factor: Number(factor), ...(tab === "locations" ? { pickable: true } : {}) },
                ],
              });
              setSaving(false);
              if (!saved) return;
              setAdding(false);
              flash(
                t(
                  "Master definition saved.",
                  "Definisi master tersimpan.",
                ),
              );
            }}
          >
            <Field
              label={
                tab === "locations"
                  ? t("Location code", "Kode lokasi")
                  : t("Unit name", "Nama satuan")
              }
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {tab === "units" && (
              <Field
                label={t(
                  "Positive conversion factor",
                  "Faktor konversi positif",
                )}
                type="number"
                min="0.0001"
                step="any"
                required
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              />
            )}
            <Button type="submit" primary disabled={saving}>
              {saving ? t("Saving…", "Menyimpan…") : t("Save definition", "Simpan definisi")}
            </Button>
          </form>
        </Modal>
      )}
    </Panel>
  );
}
