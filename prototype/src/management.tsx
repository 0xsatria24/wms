import React, { useEffect, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { MAIN, SECONDARY, locations } from "./fixtures";
import {
  useText,
  Button,
  Field,
  Notice,
  Panel,
  Tag,
  DataTable,
  Modal,
  Summary,
  Tabs,
  Thumb,
  errorText,
} from "./ui.tsx";
export { Controls } from "./controls.tsx";

export function Access({ data, setData, user, flash, createUser, deleteUser }) {
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
  const rows = data.users.filter((u) =>
    tab === "users"
      ? !["pending", "deleted"].includes(u.status)
      : u.status === "pending",
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
        onChange={setTab}
        items={[
          ["users", t("Users", "Pengguna")],
          [
            "pending",
            t(
              `Pending approvals (${data.users.filter((u) => u.status === "pending").length})`,
              `Menunggu persetujuan (${data.users.filter((u) => u.status === "pending").length})`,
            ),
          ],
        ]}
      />
      <DataTable
        label={t("Users and warehouse access", "Pengguna dan akses gudang")}
        rows={rows}
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
                  disabled={u.id === user.id || actionBusy}
                  onClick={() => open(u)}
                >
                  {t("Review access", "Tinjau akses")}
                </Button>
                <Button
                  danger
                  disabled={u.id === user.id || actionBusy}
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

export function Master({ data, setData, user, flash, deleteItem }) {
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
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  useEffect(() => {
    if (selected) setForm(selected);
    setError("");
  }, [sku, selected]);
  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const canEdit = ["admin", "supervisor"].includes(user.role);
  const save = (e) => {
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
    setData((s) => ({
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
    setSku(form.sku);
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
        <div className="master-grid">
          <aside className="item-list">
            <h3>{t("Items", "Barang")}</h3>
            {data.products.map((p) => (
              <button
                key={p.sku}
                className={`queue-item ${sku === p.sku ? "selected" : ""}`}
                aria-pressed={sku === p.sku}
                onClick={() => setSku(p.sku)}
              >
                <strong>{p.name}</strong>
                <span>{p.sku}</span>
                {!p.active && <small>{t("Inactive", "Nonaktif")}</small>}
              </button>
            ))}
            {canEdit && (
              <Button
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
                }}
              >
                <Plus size={18} />
                {t("Add item", "Tambah barang")}
              </Button>
            )}
          </aside>
          {form && (
            <form className="stack" onSubmit={save}>
              <h2>{form.name || t("New item", "Barang baru")}</h2>
              {error && <Notice kind="error">{error}</Notice>}
              <fieldset disabled={!canEdit}>
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
                    onChange={change("category")}
                  />
                  <Field
                    label={t("Base unit", "Satuan dasar")}
                    value={form.unit}
                    readOnly={!!selected}
                    onChange={change("unit")}
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
                      onClick={() => {
                        setDeleting({ ...selected });
                        setDeleteReason("");
                        setDeleteError("");
                      }}
                    >
                      <Trash size={18} aria-hidden="true" />
                      {t("Delete item", "Hapus barang")}
                    </Button>
                  )}
                  <Button
                    onClick={() => setForm(selected)}
                    disabled={!selected}
                  >
                    {t("Discard edits", "Batalkan perubahan")}
                  </Button>
                  <Button primary type="submit">
                    {t("Save changes", "Simpan perubahan")}
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
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
      {deleting && (
        <Modal
          title={t("Delete item", "Hapus barang")}
          onClose={() => !deleteBusy && setDeleting(null)}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (deleteBusy || !deleteReason.trim()) return;
              setDeleteBusy(true);
              setDeleteError("");
              try {
                await deleteItem(
                  deleting.sku,
                  deleting.version,
                  deleteReason.trim(),
                );
                const next = data.products.find(
                  (product) => product.sku !== deleting.sku,
                );
                setSku(next?.sku || "");
                setForm(next || null);
                setDeleting(null);
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
            <Field
              label={t(
                "Deletion reason (required)",
                "Alasan penghapusan (wajib)",
              )}
              value={deleteReason}
              required
              disabled={deleteBusy}
              onChange={(event) => setDeleteReason(event.target.value)}
            />
            {deleteError && <Notice kind="error">{deleteError}</Notice>}
            <div className="form-actions">
              <Button disabled={deleteBusy} onClick={() => setDeleting(null)}>
                {t("Cancel", "Batal")}
              </Button>
              <Button
                danger
                type="submit"
                disabled={deleteBusy || !deleteReason.trim()}
              >
                {deleteBusy
                  ? t("Deleting…", "Lagi menghapus…")
                  : t("Delete item", "Hapus barang")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {adding && (
        <Modal
          title={t("Add master definition", "Tambah definisi master")}
          onClose={() => setAdding(false)}
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (definitions.some((r) => r.name === name)) {
                flash(
                  t("This code already exists.", "Kode ini sudah ada."),
                  "error",
                );
                return;
              }
              setData({
                ...data,
                [tab === "locations" ? "locationMaster" : "unitMaster"]: [
                  ...definitions,
                  { name, factor: Number(factor) },
                ],
              });
              setAdding(false);
              flash(
                t(
                  "Master definition saved locally.",
                  "Definisi master tersimpan lokal.",
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
            <Button type="submit" primary>
              {t("Save definition", "Simpan definisi")}
            </Button>
          </form>
        </Modal>
      )}
    </Panel>
  );
}
