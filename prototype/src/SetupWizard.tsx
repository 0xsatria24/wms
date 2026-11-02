import React, { useEffect, useRef, useState } from "react";
import * as api from "./api";
import { Check } from "@phosphor-icons/react";
import { Button, Field, Notice, useText } from "./ui";

export function SetupGate({ children, locale, setLocale }) {
  const t = useText();
  const [state, setState] = useState("loading");
  const [company, setCompany] = useState("");
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const message = (code: string) => ({
    "setup-code": t("Activation code is invalid or expired. Ask IT for a new code.", "Kode aktivasi salah atau kedaluwarsa. Minta kode baru ke IT."),
    "setup-session": t("Setup session expired. Activate again and sign in.", "Sesi setup habis. Aktifkan kembali dan login."),
    "network": t("Connection interrupted. Check setup status before retrying.", "Koneksi terputus. Periksa status setup sebelum mencoba lagi."),
  }[code] || t("Unable to continue. Check the connection or contact IT, then check setup status.", "Belum bisa melanjutkan. Periksa koneksi atau hubungi IT, lalu periksa status setup."));
  async function load() {
    const normal = await api.session();
    if (normal.mode === "development-demo") { setState("completed"); return "completed"; }
    const status = await api.setupStatus();
    setCompany(status.companyName);
    if (status.state === "required") setSession(await api.setupSession());
    setState(status.state);
    return status.state;
  }
  async function check() { setBusy(true); setError(""); try { await load(); } catch (e) { setState("error"); setError(message(e.code)); } finally { setBusy(false); } }
  useEffect(() => { void check().then(() => { if (window.location.hash === "#setup-expired") setError(message("setup-session")); }); }, []);
  const stage = session?.stage;
  useEffect(() => { heading.current?.focus(); }, [state, stage]);
  if (state === "completed") return children;
  async function activate(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.setupActivate(code); setCode(""); setSession(await api.setupSession()); }
    catch (e) { setError(message(e.code)); }
    finally { setBusy(false); }
  }
  async function complete() {
    setBusy(true); setError("");
    try {
      await api.setupComplete();
      setState("success");
    } catch (e) {
      // A lost response can follow a committed bootstrap. Read status before offering another submit.
      try { const status = await api.setupStatus();
        if (status.state === "completed") { setState("success"); return; }
        if (status.state !== "required") { setState(status.state); return; }
        setSession(await api.setupSession());
        setError(message(e.code));
      } catch { setState("error"); setError(message("network")); }
    } finally { setBusy(false); }
  }
  const steps = [
    {key:"activation", label:t("Activation", "Aktivasi"), detail:t("Enter the code from IT", "Masukkan kode dari IT")},
    {key:"identity", label:t("Administrator", "Admin"), detail:t("Verify your company account", "Verifikasi akun perusahaan")},
    {key:"review", label:t("Review", "Tinjauan"), detail:t("Check and finish setup", "Periksa dan selesaikan")},
  ];
  const current = state === "success" ? steps.length : steps.findIndex(step => step.key === stage);
  const title = state === "success" ? t("Setup complete", "Setup selesai") : state === "loading" ? t("Checking your installation", "Memeriksa instalasi") : t("Setup needs attention", "Setup perlu diperiksa");
  return <div className="setup-page"><header className="setup-top"><span className="setup-product">Inventory / WMS</span>
    <Field label={t("Language", "Bahasa")}><select value={locale} onChange={e => setLocale(e.target.value)}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></Field>
  </header><main className="setup-shell"><aside className="setup-sidebar"><h1>{t("Initial setup", "Setup awal")}</h1><p className="setup-company">{company}</p>
    <nav aria-label={t("Setup progress", "Progres setup")}><ol className="setup-steps">{steps.map((step,index) => <li key={step.key} className={index === current ? "is-current" : index < current ? "is-complete" : ""} aria-current={index === current ? "step" : undefined}><span className="setup-step-number" aria-hidden="true">{index < current ? <Check size={16} weight="bold"/> : index+1}</span><span><span className="setup-step-label">{step.label}</span><span className="setup-step-detail">{step.detail}</span></span></li>)}</ol></nav>
    <p className="setup-sidebar-note">{t("Set up once. Then manage user access from the application.", "Cukup sekali. Selanjutnya, kelola akses pengguna dari aplikasi.")}</p>
  </aside><section className="setup-content" aria-busy={busy}>
    <header className="setup-section-heading"><h2 ref={heading} tabIndex={-1}>{state === "required" ? ({ activation: t("Activate your installation", "Aktifkan instalasi"), identity: t("Choose the first administrator", "Tentukan admin pertama"), review: t("Review your setup", "Tinjau pengaturan awal") }[stage]) : title}</h2>
    {state === "required" && stage === "review" && <p>{t("Make sure these details are correct before creating your administrator account.", "Pastikan data berikut sudah benar sebelum membuat akun admin.")}</p>}</header>
    {error && <Notice kind="error">{error}</Notice>}
    {state === "loading" && <p role="status">{t("Checking setup status…", "Memeriksa status setup…")}</p>}
    {state === "success" && <div className="setup-state"><p>{t("Your administrator account is ready. Sign in with your company account to continue.", "Akun admin sudah siap. Masuk dengan akun perusahaan untuk melanjutkan.")}</p><div className="setup-actions"><Button primary onClick={() => window.location.assign("/")}>{t("Sign in to the application", "Masuk ke aplikasi")}</Button></div></div>}
    {["blocked", "unavailable"].includes(state) && <Notice kind="warning">{t("Setup is unavailable. Ask IT to check the database, SSO and activation configuration. Existing data will not be overwritten.", "Setup belum tersedia. Minta IT memeriksa database, SSO dan konfigurasi aktivasi. Data yang ada tidak akan ditimpa.")}</Notice>}
    {state === "required" && stage === "activation" && <form className="setup-form" onSubmit={activate}><p className="setup-description">{t("Use the private activation code provided by your IT team.", "Gunakan kode aktivasi privat yang diberikan tim IT.")}</p><Field label={t("Activation code", "Kode aktivasi")} hint={t("Keep this code private. Contact IT if it has expired.", "Jaga kerahasiaan kode. Hubungi IT jika kode kedaluwarsa.")}><input type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} maxLength={512} required disabled={busy}/></Field><div className="setup-actions"><Button primary type="submit" disabled={busy}>{busy ? t("Activating…", "Mengaktifkan…") : t("Activate setup", "Aktifkan setup")}</Button></div></form>}
    {state === "required" && stage === "identity" && <div className="setup-form"><p className="setup-description">{t("Sign in with the company account that will manage access to this application. A verified email is required.", "Masuk dengan akun perusahaan yang akan mengelola akses aplikasi ini. Email harus terverifikasi.")}</p><div className="setup-actions"><Button primary onClick={() => window.location.assign("/auth/setup-login")}>{t("Continue with SSO", "Lanjutkan dengan SSO")}</Button></div></div>}
    {state === "required" && stage === "review" && <div className="setup-review"><dl className="setup-summary">
      <div><dt>{t("Administrator", "Admin")}</dt><dd><strong>{session.identity?.name}</strong><span>{session.identity?.email}</span></dd></div>
      <div><dt>{t("Company", "Perusahaan")}</dt><dd>{company}</dd></div>
    </dl><div className="setup-actions"><Button onClick={() => setSession({...session, stage:"identity"})} disabled={busy}>{t("Back", "Kembali")}</Button><Button primary onClick={complete} disabled={busy}>{busy ? t("Saving…", "Menyimpan…") : t("Finish setup and create administrator", "Selesaikan setup dan buat admin")}</Button></div></div>}
    {!["loading", "success"].includes(state) && <footer className="setup-help"><span>{t("Need to refresh the installation status?", "Perlu memeriksa ulang status instalasi?")}</span><Button className="setup-status-action" disabled={busy} onClick={check}>{t("Check setup status", "Periksa status setup")}</Button></footer>}
  </section></main></div>;
}
