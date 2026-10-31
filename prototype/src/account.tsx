import React, { useEffect, useState } from "react";
import { Cube } from "@phosphor-icons/react";
import { MAIN } from "./fixtures";
import { useText, Button, Field, Notice, Summary, errorText } from "./ui.tsx";

export function Auth({
  route,
  go,
  data,
  setData,
  setUser,
  lang,
  signIn,
  authMode,
  notice,
}) {
  const t = useText();
  const [form, setForm] = useState({
    email: "admin@demo.company",
    password: "",
    name: "",
    company: "Demo Company",
    invitation: "",
    confirm: "",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    setError("");
    setDone("");
    setForm((f) => ({ ...f, password: "", confirm: "" }));
  }, [route]);
  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const send = (e) => {
    e.preventDefault();
    setError("");
    if (
      ["register", "reset"].includes(route) &&
      form.password !== form.confirm
    ) {
      setError(t("Passwords do not match.", "Passwordnya belum sama."));
      return;
    }
    setSending(true);
    setTimeout(async () => {
      if (route === "signin") {
        try {
          await signIn(form.email, form.password);
        } catch (error) {
          setError(
            error.code === "credentials"
              ? t(
                  "Email or password is incorrect.",
                  "Email atau password belum benar.",
                )
              : error.code === "account-unavailable"
                ? errorText(error.code, t)
                : t(
                    "Unable to sign in. Check that the API and database are running.",
                    "Belum bisa masuk. Pastikan API dan database sedang berjalan.",
                  ),
          );
        }
      } else if (route === "register") {
        if (!data.users.some((u) => u.email === form.email)) {
          const saved = await setData((s) => ({
            ...s,
            users: [
              ...s.users,
              {
                id: crypto.randomUUID(),
                name: form.name,
                email: form.email,
                role: "operator",
                warehouses: [MAIN],
                status: "pending",
                verified: false,
              },
            ],
          }));
          if (!saved) {
            setError(
              t(
                "Access request could not be saved. Check the connection and try again.",
                "Permintaan akses belum tersimpan. Cek koneksi lalu coba lagi.",
              ),
            );
            setSending(false);
            return;
          }
        }
        setDone("registered");
      } else setDone(route === "forgot" ? "reset-sent" : "reset-done");
      setForm((f) => ({ ...f, password: "", confirm: "" }));
      setSending(false);
    }, 250);
  };
  const login = route === "signin";
  const registering = route === "register";
  const forgot = route === "forgot";
  return (
    <div className="auth-page">
      <header className="auth-top">
        <a href="#signin">Inventory / WMS</a>
        <span className="simulation">{t("Local demo", "Demo lokal")}</span>
      </header>
      <main className={`auth-card ${registering ? "registration" : ""}`}>
        <section className="auth-intro">
          <Cube size={58} weight="light" aria-hidden="true" />
          <h1>
            {registering
              ? t("Request access", "Minta akses")
              : forgot
                ? t("Forgot password?", "Lupa password?")
                : route === "reset"
                  ? t("Set a new password", "Buat password baru")
                  : "Inventory / WMS"}
          </h1>
          <p>
            {registering
              ? t(
                  "Request an account. An administrator reviews your warehouse access.",
                  "Ajukan akun. Admin akan meninjau akses gudang kamu.",
                )
              : login
                ? t(
                    "Sign in to manage your warehouse.",
                    "Masuk untuk mengelola gudang kamu.",
                  )
                : t(
                    "Get back to your workspace.",
                    "Kembali ke ruang kerja kamu.",
                  )}
          </p>
          <div className="auth-language">{lang}</div>
        </section>
        <section className="auth-form-panel">
          <h2>
            {login
              ? t("Sign in to your account", "Masuk ke akun kamu")
              : registering
                ? t("Your account details", "Detail akun kamu")
                : forgot
                  ? t("Request a reset link", "Minta link reset")
                  : t("Reset your password", "Reset password kamu")}
          </h2>
          {notice && <Notice kind={notice.kind}>{notice.message}</Notice>}
          {authMode === "oidc" ? (
            <div className="stack">
              <Notice>
                {t(
                  "Sign in and password recovery use your company identity provider.",
                  "Login dan pemulihan password memakai penyedia identitas perusahaan.",
                )}
              </Notice>
              <a className="button primary" href="/auth/login">
                {t("Continue with company SSO", "Lanjut dengan SSO perusahaan")}
              </a>
            </div>
          ) : done ? (
            <div className="stack">
              <Notice
                kind="success"
                title={
                  ["registered", "verified"].includes(done)
                    ? t("Access request received", "Permintaan akses diterima")
                    : done === "reset-sent"
                      ? t("Check your email", "Cek email kamu")
                      : t("Reset preview complete", "Preview reset selesai")
                }
              >
                {["registered", "verified"].includes(done)
                  ? t(
                      "Email verification and administrator approval are required. No administrator role is granted automatically.",
                      "Perlu verifikasi email dan persetujuan admin. Hak admin tidak diberikan otomatis.",
                    )
                  : done === "reset-sent"
                    ? t(
                        "If an account exists, a reset link will be sent.",
                        "Kalau akunnya ada, link reset akan dikirim.",
                      )
                    : t(
                        "In the demo, sign in with the displayed demo credentials.",
                        "Di demo, masuk menggunakan akun contoh yang ditampilkan.",
                      )}
              </Notice>
              <p className="muted">
                {t(
                  "No email is sent and no password is stored or changed in this local prototype.",
                  "Prototipe lokal ini tidak mengirim email dan tidak menyimpan atau mengubah password.",
                )}
              </p>
              {done === "registered" && (
                <Button
                  onClick={() => {
                    setData((s) => ({
                      ...s,
                      users: s.users.map((u) =>
                        u.email === form.email ? { ...u, verified: true } : u,
                      ),
                    }));
                    setDone("verified");
                  }}
                >
                  {t(
                    "Simulate email verification",
                    "Simulasikan verifikasi email",
                  )}
                </Button>
              )}
              {done === "verified" && (
                <Notice>
                  {t(
                    "Email verified (simulation). Awaiting administrator approval.",
                    "Email terverifikasi (simulasi). Menunggu persetujuan admin.",
                  )}
                </Notice>
              )}
              {done === "reset-sent" && (
                <Button onClick={() => go("reset")}>
                  {t("Preview reset form", "Lihat contoh form reset")}
                </Button>
              )}
              <Button primary onClick={() => go("signin")}>
                {t("Back to sign in", "Kembali ke login")}
              </Button>
            </div>
          ) : (
            <form onSubmit={send} className="stack">
              {error && <Notice kind="error">{error}</Notice>}
              {registering && (
                <Field
                  label={t("Full name (required)", "Nama lengkap (wajib)")}
                  required
                  value={form.name}
                  onChange={change("name")}
                  autoComplete="name"
                />
              )}
              {route !== "reset" && (
                <Field
                  label={t("Work email (required)", "Email kerja (wajib)")}
                  type="email"
                  required
                  value={form.email}
                  onChange={change("email")}
                  autoComplete="username"
                />
              )}
              {registering && (
                <div className="form-grid">
                  <Field
                    label={t("Company (required)", "Perusahaan (wajib)")}
                    required
                    value={form.company}
                    onChange={change("company")}
                  />
                  <Field
                    label={t(
                      "Invitation code (optional)",
                      "Kode undangan (opsional)",
                    )}
                    value={form.invitation}
                    onChange={change("invitation")}
                  />
                </div>
              )}
              {!forgot && (
                <>
                  <Field
                    label={
                      route === "reset"
                        ? t("New password (required)", "Password baru (wajib)")
                        : t("Password (required)", "Password (wajib)")
                    }
                    type={show ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={change("password")}
                    autoComplete={login ? "current-password" : "new-password"}
                  />
                  {!login && (
                    <Field
                      label={t(
                        "Confirm password (required)",
                        "Ulangi password (wajib)",
                      )}
                      type={show ? "text" : "password"}
                      required
                      value={form.confirm}
                      onChange={change("confirm")}
                      autoComplete="new-password"
                    />
                  )}
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={show}
                      onChange={(e) => setShow(e.target.checked)}
                    />
                    {t("Show password", "Tampilkan password")}
                  </label>
                </>
              )}
              <Button type="submit" primary disabled={sending}>
                {sending
                  ? t("Please wait…", "Tunggu sebentar…")
                  : login
                    ? t("Sign in", "Masuk")
                    : registering
                      ? t("Request access", "Minta akses")
                      : forgot
                        ? t("Send reset link", "Kirim link reset")
                        : t(
                            "Save password (preview)",
                            "Simpan password (preview)",
                          )}
              </Button>
              <div className="auth-links">
                {login ? (
                  <>
                    <a href="#forgot">
                      {t("Forgot password?", "Lupa password?")}
                    </a>
                    <a href="#register">
                      {t("Request account", "Daftar akun")}
                    </a>
                  </>
                ) : (
                  <a href="#signin">
                    {t("Back to sign in", "Kembali ke login")}
                  </a>
                )}
              </div>
              <Notice>
                {login ? (
                  <>
                    {t("Demo account", "Akun demo")}:{" "}
                    <strong>admin@demo.company</strong>
                    <br />
                    {t("Password", "Password")}: <strong>demo123</strong>
                    <br />
                    {t(
                      "Use sample information only.",
                      "Gunakan informasi contoh saja.",
                    )}
                  </>
                ) : (
                  t(
                    "Demonstration only. Email delivery and identity services are not connected.",
                    "Hanya demonstrasi. Layanan email dan identitas belum terhubung.",
                  )
                )}
              </Notice>
            </form>
          )}
        </section>
        {registering && (
          <ol className="auth-steps">
            <li>
              <strong>{t("Submit registration", "Ajukan pendaftaran")}</strong>
              <p>
                {t(
                  "Provide your details and request access.",
                  "Isi detail dan ajukan akses.",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Verify email", "Verifikasi email")}</strong>
              <p>
                {t(
                  "Confirm your email address.",
                  "Konfirmasi alamat email kamu.",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Await approval", "Tunggu persetujuan")}</strong>
              <p>
                {t(
                  "An admin assigns role and warehouse access.",
                  "Admin menetapkan peran dan akses gudang.",
                )}
              </p>
            </li>
          </ol>
        )}
      </main>
    </div>
  );
}

export function Workspace({ user, warehouse, setWarehouse, data, go }) {
  const t = useText();
  const [selected, setSelected] = useState(warehouse);
  const pending = data.pending.filter((p) => p.request.user === user.id);
  if (!user.warehouses.length)
    return (
      <section className="panel workspace-selector">
        <h1>{t("No warehouse access yet", "Belum ada akses gudang")}</h1>
        <Notice kind="warning">
          {t(
            "Ask your administrator to assign a warehouse and role.",
            "Minta admin menetapkan gudang dan peran untuk kamu.",
          )}
        </Notice>
      </section>
    );
  return (
    <section className="workspace-selector panel stack">
      <h1>{t("Choose your workspace", "Pilih ruang kerja kamu")}</h1>
      <p className="muted">
        {t(
          "Your company and warehouse stay visible while you work.",
          "Perusahaan dan gudang tetap terlihat selama kamu bekerja.",
        )}
      </p>
      <Summary
        items={[
          [t("Account", "Akun"), user.email],
          [t("Role", "Peran"), user.role],
        ]}
      />
      <Field label={t("Company", "Perusahaan")}>
        <select>
          <option>Demo Company</option>
        </select>
      </Field>
      <Field label={t("Warehouse", "Gudang")}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {user.warehouses.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </Field>
      {pending.length > 0 && (
        <Notice kind="warning">
          {t(
            `${pending.length} pending request(s) stay in their original scope.`,
            `${pending.length} permintaan tertunda tetap di lingkup asal.`,
          )}{" "}
          <a href="#pending">{t("Review pending", "Tinjau yang tertunda")}</a>
        </Notice>
      )}
      <Button
        primary
        onClick={() => {
          setWarehouse(selected);
          go("stock");
        }}
      >
        {t("Use this workspace", "Gunakan ruang kerja ini")}
      </Button>
    </section>
  );
}
export function Settings({
  user,
  setUser,
  data,
  setData,
  theme,
  setTheme,
  mode,
  setMode,
  lang,
  authMode,
}) {
  const t = useText();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Settings", "Pengaturan")}</h1>
          <p>
            {t(
              "Appearance and local demonstration controls.",
              "Tampilan dan kontrol demonstrasi lokal.",
            )}
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel stack">
          <h2>{t("Appearance", "Tampilan")}</h2>
          {lang}
          <Field label={t("Theme", "Tema")}>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">{t("Light", "Terang")}</option>
              <option value="dark">{t("Dark", "Gelap")}</option>
            </select>
          </Field>
        </section>
        {authMode === "development-demo" && (
          <section className="panel stack">
            <h2>{t("Demo scenarios", "Skenario demo")}</h2>
            <Notice>
              {t(
                "These controls change this local preview only. They do not grant production access or change company policy.",
                "Kontrol ini hanya mengubah preview lokal. Tidak memberi akses produksi atau mengubah kebijakan perusahaan.",
              )}
            </Notice>
            <Field label={t("Demo user", "Pengguna demo")}>
              <select
                value={user.id}
                onChange={(e) => setUser({ id: e.target.value })}
              >
                {[
                  { id: "admin", name: "Demo Admin", role: "admin" },
                  { id: "operator", name: "Demo Operator", role: "operator" },
                  {
                    id: "supervisor",
                    name: "Demo Supervisor",
                    role: "supervisor",
                  },
                ].map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Connection behavior", "Perilaku koneksi")}>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {[
                  ["normal", "Normal", "Normal"],
                  ["offline", "Offline before send", "Offline sebelum dikirim"],
                  [
                    "unknown",
                    "Response lost after commit",
                    "Respons hilang setelah tercatat",
                  ],
                  ["rejected", "Definite rejection", "Penolakan pasti"],
                  ["conflict", "Stock version conflict", "Konflik versi stok"],
                ].map(([v, en, id]) => (
                  <option key={v} value={v}>
                    {t(en, id)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.partialAllowed}
                onChange={(e) =>
                  setData({ ...data, partialAllowed: e.target.checked })
                }
              />
              {t(
                "Allow partial shipment (simulation assumption)",
                "Izinkan kirim parsial (asumsi simulasi)",
              )}
            </label>
            <small className="muted">
              {t(
                "D02 remains open. This switch is for comparing the UI behavior only.",
                "D02 masih terbuka. Pilihan ini hanya untuk membandingkan perilaku UI.",
              )}
            </small>
          </section>
        )}
      </div>
    </>
  );
}
