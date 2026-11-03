import React, { useEffect, useState } from "react";
import * as api from "./api";
import {
  Button,
  DataTable,
  Field,
  Notice,
  Summary,
  useText,
  errorText,
} from "./ui";
import { DemoScenarios } from "./account";

export function Settings({
  user,
  warehouse,
  preferences,
  onPreferencesSaved,
  refresh,
  ...demo
}: any) {
  const t = useText();
  const [tab, setTab] = useState(user.role === "admin" ? "organization" : "personal");
  const [companyName, setCompanyName] = useState("");
  const [newWarehouse, setNewWarehouse] = useState("");
  const [initialLocations, setInitialLocations] = useState("");
  const [organizationReason, setOrganizationReason] = useState("");
  const [saved, setSaved] = useState<any>(null);
  const [personal, setPersonal] = useState(preferences);
  const [details, setDetails] = useState<any>(null);
  const [approvals, setApprovals] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [config, prefs] = await Promise.all([
        api.warehouseSettings(warehouse),
        api.preferences(),
      ]);
      setSaved(config);
      setCompanyName(config.company?.name || "");
      setDetails(config.warehouse);
      setApprovals(config.approvals);
      setPersonal(prefs);
      setReason("");
      setApprovalReason("");
      setConflict(false);
    } catch (e) {
      setError(errorText(e.message, t));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const execute = async (name, action) => {
    setBusy(name);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess("saved");
    } catch (e) {
      setError(errorText(e.message, t));
      if (e.message === "conflict") setConflict(true);
    } finally {
      setBusy("");
    }
  };
  const tabs = [
    ...(user.role === "admin" ? [["organization", t("Company & warehouses", "Perusahaan & gudang")]] : []),
    ["personal", t("Personal", "Pribadi")],
    ["warehouse", t("Warehouse & locations", "Gudang & lokasi")],
    ["rules", t("Transaction rules", "Aturan transaksi")],
    ["approvals", t("Approvals", "Persetujuan")],
  ];
  const locked = !!busy || conflict;
  const canConfigure = saved?.canConfigure;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Settings", "Pengaturan")}</h1>
          <p>
            {t(
              "Your preferences and the operating settings for",
              "Preferensi akun dan pengaturan operasional untuk",
            )}{" "}
            {warehouse}.
          </p>
        </div>
      </div>
      <nav
        className="settings-navigation"
        aria-label={t("Settings sections", "Bagian pengaturan")}
      >
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            primary={tab === id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setError("");
              setSuccess("");
            }}
          >
            {label}
          </Button>
        ))}
      </nav>
      {error && (
        <Notice kind="error">
          {error}
          {conflict && (
            <>
              {" "}
              {t(
                "Reload saved settings before editing again. This replaces your unsaved settings drafts.",
                "Muat ulang pengaturan sebelum mengedit lagi. Draf pengaturan yang belum disimpan akan diganti.",
              )}
            </>
          )}
        </Notice>
      )}
      {success && <Notice kind="success">{t("Settings saved.", "Pengaturan tersimpan.")}</Notice>}
      {(error || conflict) && (
        <Button disabled={!!busy} onClick={() => void load()}>
          {t("Reload saved settings", "Muat ulang pengaturan tersimpan")}
        </Button>
      )}
      {loading ? (
        <Notice>{t("Loading settings…", "Memuat pengaturan…")}</Notice>
      ) : !saved ? (
        <div className="empty">
          {t(
            "Settings are unavailable. Reload to try again.",
            "Pengaturan belum tersedia. Muat ulang untuk mencoba lagi.",
          )}
        </div>
      ) : (
        <fieldset className="settings-fields" disabled={!!busy} aria-label={t("Settings form", "Formulir pengaturan")}>
          {tab === "organization" && <form className="panel stack settings-form" onSubmit={event => {
            event.preventDefault(); void execute("organization", async () => {
              await api.saveOrganization({ version: saved.company.version, companyName, warehouseName: newWarehouse, locations: initialLocations.split(/[,\n]/).map(value => value.trim()).filter(Boolean), reason: organizationReason });
              window.location.assign("/#settings"); window.location.reload();
            });
          }}>
            <h2>{t("Company and warehouse setup", "Pengaturan perusahaan dan gudang")}</h2>
            <p>{t("Enter your company name and add a warehouse with its storage locations. Manage additional locations in Warehouse & locations.", "Isi nama perusahaan dan tambahkan gudang beserta lokasi penyimpanannya. Lokasi tambahan dikelola di Gudang & lokasi.")}</p>
            {!saved.company?.canConfigure && <Notice>{t("Company setup requires administrator access to every warehouse.", "Pengaturan perusahaan memerlukan akses admin ke seluruh gudang.")}</Notice>}
            <Field label={t("Company name", "Nama perusahaan")} required maxLength={200} value={companyName} disabled={!saved.company?.canConfigure || locked} onChange={event => setCompanyName(event.target.value)}/>
            <Field label={t("New warehouse name", "Nama gudang baru")} required={saved.company.version === 0 || Boolean(initialLocations.trim())} maxLength={200} value={newWarehouse} disabled={!saved.company?.canConfigure || locked} onChange={event => setNewWarehouse(event.target.value)}/>
            <Field label={t("Storage locations", "Lokasi penyimpanan")}><textarea required={saved.company.version === 0 || Boolean(newWarehouse.trim())} value={initialLocations} disabled={!saved.company?.canConfigure || locked} onChange={event => setInitialLocations(event.target.value)} aria-describedby="initial-locations-help"/></Field>
            <p id="initial-locations-help" className="muted">{t("One code per line, or separate codes with commas. Receiving, QC and Staging are created automatically.", "Satu kode per baris, atau pisahkan dengan koma. Receiving, QC, dan Staging dibuat otomatis.")}</p>
            {saved.company.version > 0 && <p className="muted">{t("Leave warehouse and locations blank to update only the company name.", "Kosongkan gudang dan lokasi untuk mengubah nama perusahaan saja.")}</p>}
            <Field label={t("Reason for change", "Alasan perubahan")} required maxLength={2000} value={organizationReason} disabled={!saved.company?.canConfigure || locked} onChange={event => setOrganizationReason(event.target.value)}/>
            <Button primary type="submit" disabled={!saved.company?.canConfigure || locked}>{newWarehouse.trim() || saved.company.version === 0 ? t("Save company and add warehouse", "Simpan perusahaan dan tambah gudang") : t("Save company", "Simpan perusahaan")}</Button>
          </form>}
          {tab === "personal" && (
            <form
              className="panel stack settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void execute("personal", async () => {
                  const next = await api.savePreferences(personal);
                  setPersonal(next);
                  onPreferencesSaved(next);
                });
              }}
            >
              <div>
                <h2>{t("Personal preferences", "Preferensi pribadi")}</h2>
                <p className="muted">
                  {t(
                    "Saved to your account. Shared warehouse rules stay separate.",
                    "Disimpan pada akun Anda. Aturan bersama gudang dikelola terpisah.",
                  )}
                </p>
              </div>
              <div className="form-grid">
                <Field label={t("Language", "Bahasa")}>
                  <select
                    value={personal.language}
                    onChange={(e) =>
                      setPersonal({ ...personal, language: e.target.value })
                    }
                  >
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </Field>
                <Field label={t("Theme", "Tema")}>
                  <select
                    value={personal.theme}
                    onChange={(e) =>
                      setPersonal({ ...personal, theme: e.target.value })
                    }
                  >
                    <option value="light">{t("Light", "Terang")}</option>
                    <option value="dark">{t("Dark", "Gelap")}</option>
                  </select>
                </Field>
                <Field label={t("Default warehouse", "Gudang awal")}>
                  <select
                    value={personal.defaultWarehouse}
                    onChange={(e) =>
                      setPersonal({
                        ...personal,
                        defaultWarehouse: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      {t(
                        "First accessible warehouse",
                        "Gudang pertama yang dapat diakses",
                      )}
                    </option>
                    {user.warehouses.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Start page", "Halaman awal")}>
                  <select
                    value={personal.startPage}
                    onChange={(e) =>
                      setPersonal({ ...personal, startPage: e.target.value })
                    }
                  >
                    {[
                      ["workspace", t("Choose workspace", "Pilih ruang kerja")],
                      ["stock", t("Stock position", "Posisi stok")],
                      ["receiving", t("Receiving", "Penerimaan")],
                      ["orders", t("Orders", "Order")],
                      ["picking", t("Picking", "Pengambilan")],
                      [
                        "pending",
                        t("Pending transactions", "Transaksi tertunda"),
                      ],
                    ].map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t("Default catalogue rows", "Baris katalog awal")}
                  hint={t(
                    "Used when opening stock, items and document catalogues.",
                    "Digunakan saat membuka katalog stok, barang, dan dokumen.",
                  )}
                >
                  <select
                    value={personal.pageSize}
                    onChange={(e) =>
                      setPersonal({
                        ...personal,
                        pageSize: Number(e.target.value),
                      })
                    }
                  >
                    {[10, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="actions">
                <Button primary type="submit" disabled={locked}>
                  {busy === "personal"
                    ? t("Saving…", "Menyimpan…")
                    : t("Save preferences", "Simpan preferensi")}
                </Button>
              </div>
            </form>
          )}
          {tab === "warehouse" && (
            <div className="stack">
              <form
                className="panel stack settings-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void execute("warehouse", async () => {
                    const next = await api.saveWarehouseSettings(
                      warehouse,
                      "warehouse",
                      { ...details, reason },
                    );
                    setSaved(next);
                    setDetails(next.warehouse);
                    setReason("");
                    await refresh();
                  });
                }}
              >
                <h2>{t("Warehouse information", "Informasi gudang")}</h2>
                <Summary
                  items={[
                    [t("Warehouse", "Gudang"), saved.warehouse.name],
                    [t("Warehouse ID", "ID gudang"), saved.warehouse.id],
                  ]}
                />
                {!canConfigure && (
                  <Notice>
                    {t(
                      "Only a warehouse administrator can change these settings.",
                      "Hanya admin gudang yang dapat mengubah pengaturan ini.",
                    )}
                  </Notice>
                )}
                <Field label={t("Address", "Alamat")}>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    disabled={!canConfigure || !!busy}
                    value={details.address}
                    onChange={(e) =>
                      setDetails({ ...details, address: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("Display time zone", "Zona waktu tampilan")}
                  hint={t(
                    "Used for the clock, transaction times and report date boundaries. Stored timestamps remain in UTC.",
                    "Digunakan untuk jam, waktu transaksi, dan batas tanggal laporan. Waktu tersimpan tetap dalam UTC.",
                  )}
                >
                  <select
                    disabled={!canConfigure || !!busy}
                    value={details.timeZone}
                    onChange={(e) =>
                      setDetails({ ...details, timeZone: e.target.value })
                    }
                  >
                    {[
                      "Asia/Bangkok",
                      "Asia/Jakarta",
                      "Asia/Makassar",
                      "Asia/Jayapura",
                      "UTC",
                    ].map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </Field>
                {canConfigure && (
                  <>
                    <Field
                      label={t("Reason for change", "Alasan perubahan")}
                      required
                      maxLength={2000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="actions">
                      <Button primary type="submit" disabled={locked}>
                        {busy === "warehouse"
                          ? t("Saving…", "Menyimpan…")
                          : t("Save warehouse", "Simpan gudang")}
                      </Button>
                    </div>
                  </>
                )}
              </form>
              <section className="panel stack">
                <h2>{t("Operational locations", "Lokasi operasional")}</h2>
                <p className="muted">
                  {t(
                    "Receiving, QC and Staging follow the current workflows. Transfer transit is recorded separately for each transfer.",
                    "Receiving, QC, dan Staging mengikuti alur saat ini. Transit dicatat terpisah untuk setiap transfer.",
                  )}
                </p>
                <DataTable
                  label={t("Operational locations", "Lokasi operasional")}
                  rows={saved.locations}
                  empty={t(
                    "No locations registered.",
                    "Belum ada lokasi terdaftar.",
                  )}
                  columns={[
                    { key: "code", label: t("Location", "Lokasi"), render: (r) => r.code },
                    {
                      key: "use",
                      label: t("Use", "Penggunaan"),
                      render: (r) =>
                        r.pickable
                          ? t("Storage / picking", "Penyimpanan / picking")
                          : r.code === "Receiving"
                            ? t("Receiving", "Penerimaan")
                            : r.code === "QC"
                              ? t("Quality hold", "Penahanan kualitas")
                              : r.code === "Staging"
                                ? t("Shipment staging", "Persiapan pengiriman")
                                : t("Non-pickable", "Tidak dapat dialokasikan"),
                    },
                    {
                      key: "frozen",
                      label: t("Stock count", "Opname"),
                      render: (r) =>
                        r.frozen
                          ? t("Frozen", "Dibekukan")
                          : t("Not frozen", "Tidak dibekukan"),
                    },
                  ]}
                />
                {saved.canAddLocation && (
                  <form
                    className="settings-location-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void execute("location", async () => {
                        await api.addStorageLocation(
                          warehouse,
                          locationCode.trim(),
                        );
                        const next = await api.warehouseSettings(warehouse);
                        setSaved(next);
                        setLocationCode("");
                        await refresh();
                      });
                    }}
                  >
                    <Field
                      label={t(
                        "New storage location code",
                        "Kode lokasi penyimpanan baru",
                      )}
                      required
                      maxLength={100}
                      value={locationCode}
                      onChange={(e) => setLocationCode(e.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={locked || !locationCode.trim()}
                    >
                      {busy === "location"
                        ? t("Adding…", "Menambahkan…")
                        : t("Add location", "Tambah lokasi")}
                    </Button>
                  </form>
                )}
              </section>
            </div>
          )}
          {tab === "rules" && (
            <section className="panel stack settings-form">
              <h2>
                {t("Current transaction rules", "Aturan transaksi saat ini")}
              </h2>
              <p className="muted">
                {t(
                  "These rules are enforced by the system. Business decisions still awaiting agreement are shown explicitly.",
                  "Aturan ini diterapkan oleh sistem. Keputusan bisnis yang belum disepakati ditandai secara jelas.",
                )}
              </p>
              <Summary
                items={[
                  [
                    t("PO receiving limit", "Batas penerimaan PO"),
                    t(
                      "Cannot exceed the remaining PO quantity",
                      "Tidak boleh melebihi sisa jumlah PO",
                    ),
                  ],
                  [
                    t("Quantity precision", "Presisi kuantitas"),
                    t(
                      "Up to 6 decimal places; final business precision pending",
                      "Maksimal 6 angka desimal; presisi bisnis final belum ditetapkan",
                    ),
                  ],
                  [
                    t("Exception reasons", "Alasan pengecualian"),
                    t(
                      "Required for short picks, quality rejection, cancellation, returns and count adjustments",
                      "Wajib untuk selisih picking, penolakan kualitas, pembatalan, retur, dan penyesuaian opname",
                    ),
                  ],
                  [
                    t(
                      "Partial reservation / shipment",
                      "Reservasi / pengiriman parsial",
                    ),
                    t(
                    "D02 pending; available only as a development simulation",
                    "D02 belum diputuskan; hanya tersedia sebagai simulasi pengembangan",
                    ),
                  ],
                ]}
              />
              <a href="#pending">
                {t("Review pending transactions", "Tinjau transaksi tertunda")}
              </a>
            </section>
          )}
          {tab === "approvals" && (
            <form
              className="panel stack settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void execute("approvals", async () => {
                  const next = await api.saveWarehouseSettings(
                    warehouse,
                    "approvals",
                    { ...approvals, reason: approvalReason },
                  );
                  setSaved(next);
                  setApprovals(next.approvals);
                  setApprovalReason("");
                  await refresh();
                });
              }}
            >
              <h2>{t("Approval authority", "Kewenangan persetujuan")}</h2>
              <p className="muted">
                {t(
                  "Applies to this warehouse. Reviewers must hold the selected role in this warehouse.",
                  "Berlaku untuk gudang ini. Peninjau harus memiliki peran yang dipilih pada gudang ini.",
                )}
              </p>
              {!canConfigure && (
                <Notice>
                  {t(
                    "Only a warehouse administrator can change approval authority.",
                    "Hanya admin gudang yang dapat mengubah kewenangan persetujuan.",
                  )}
                </Notice>
              )}
              {[
                [
                  "orderReview",
                  t(
                    "Order approval / rejection",
                    "Persetujuan / penolakan order",
                  ),
                ],
                [
                  "countReview",
                  t(
                    "Stock-count adjustment approval",
                    "Persetujuan penyesuaian opname",
                  ),
                ],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <select
                    disabled={!canConfigure || !!busy}
                    value={approvals[key]}
                    onChange={(e) =>
                      setApprovals({ ...approvals, [key]: e.target.value })
                    }
                  >
                    <option value="supervisor">
                      {t(
                        "Supervisor or administrator",
                        "Supervisor atau admin",
                      )}
                    </option>
                    <option value="admin">
                      {t("Administrator only", "Hanya admin")}
                    </option>
                  </select>
                </Field>
              ))}
              <Notice>
                {t(
                  "The order creator cannot review their own order. The stock counter cannot approve their own count. Approval never releases an order or unfreezes stock automatically.",
                  "Pembuat order tidak dapat meninjau order sendiri. Penghitung stok tidak dapat menyetujui hitungannya sendiri. Persetujuan tidak otomatis melepas order atau membuka pembekuan stok.",
                )}
              </Notice>
              {canConfigure && (
                <>
                  <Field
                    label={t("Reason for change", "Alasan perubahan")}
                    required
                    maxLength={2000}
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                  />
                  <div className="actions">
                    <Button primary type="submit" disabled={locked}>
                      {busy === "approvals"
                        ? t("Saving…", "Menyimpan…")
                        : t("Save approval rules", "Simpan aturan persetujuan")}
                    </Button>
                  </div>
                </>
              )}
              <a href="#access">
                {t("Open users and access", "Buka pengguna dan akses")}
              </a>
            </form>
          )}
        </fieldset>
      )}
      {demo.authMode === "development-demo" && (
        <details className="settings-demo">
          <summary>
            {t("Development demo scenarios", "Skenario demo pengembangan")}
          </summary>
          <DemoScenarios {...demo} user={user} />
        </details>
      )}
    </>
  );
}
