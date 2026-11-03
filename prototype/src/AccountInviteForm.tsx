import React, { useEffect, useState } from "react";
import type { AccountInvitation, AccountInviteInput } from "./api";
import { Button, Field, Notice, Summary, errorText, useText } from "./ui";

export function AccountInviteForm({ invitationId, user, warehouse, send, check, close }) {
  const t = useText();
  const [id] = useState(() => invitationId || crypto.randomUUID());
  const [input, setInput] = useState<AccountInviteInput>({ name: "", email: "", role: "operator", warehouses: user.adminWarehouses?.includes(warehouse) ? [warehouse] : [], reason: "" });
  const [attempt, setAttempt] = useState<AccountInviteInput | null>(null);
  const [result, setResult] = useState<AccountInvitation | null>(null);
  const [busy, setBusy] = useState(Boolean(invitationId));
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const locked = Boolean(attempt || invitationId);
  const received = (value: AccountInvitation) => { setResult(value); setInput(value); setAttempt({ name: value.name, email: value.email, role: value.role, warehouses: value.warehouses, reason: value.reason }); setUncertain(false); };
  const load = async () => {
    setBusy(true); setError("");
    try { received(await check(id)); }
    catch (e) {
      if (e.code === "source" && !invitationId) { setAttempt(null); setUncertain(false); setError(t("No invitation was saved. Review the form and send again.", "Undangan belum tersimpan. Periksa form lalu kirim kembali.")); }
      else setError(errorText(e.code || e.message, t));
    } finally { setBusy(false); }
  };
  useEffect(() => { if (invitationId) void load(); }, [invitationId]);
  const submit = async (resend = false) => {
    if (busy) return;
    const payload = attempt || { ...input, name: input.name.trim(), email: input.email.trim(), reason: input.reason.trim() };
    setBusy(true); setError(""); setAttempt(payload);
    try { received(await send(id, payload, resend)); }
    catch (e) { if (e.code === "identity-not-configured" && !result) { setAttempt(null); setUncertain(false); } else setUncertain(true); setError(errorText(e.code || e.message, t)); }
    finally { setBusy(false); }
  };
  const stateCopy = {
    preparing: t("The invitation is being prepared. Check its status before retrying.", "Undangan sedang disiapkan. Cek status sebelum mencoba lagi."),
    sent: t("The identity service accepted the invitation email. The user completes email verification and any required password setup. The selected access activates after verified sign-in.", "Layanan identitas menerima pengiriman undangan. User menyelesaikan verifikasi email dan pembuatan password jika diperlukan. Akses yang dipilih aktif setelah login terverifikasi."),
    unknown: t("Email delivery status is uncertain. Check the status; resend explicitly if the email has not arrived.", "Status pengiriman email belum pasti. Cek status; kirim ulang jika email belum diterima."),
    failed: t("The account could not be prepared. Check the identity service configuration, then retry this invitation.", "Akun belum bisa disiapkan. Periksa konfigurasi layanan identitas, lalu coba undangan ini lagi."),
    expired: t("This invitation expired. Resend it to issue a new activation email.", "Undangan kedaluwarsa. Kirim ulang untuk menerbitkan email aktivasi baru."),
    accepted: t("This user has activated their account. Manage further changes through Review access.", "User sudah mengaktifkan akun. Kelola perubahan berikutnya melalui Tinjau akses."),
    cancelled: t("Access was rejected or revoked. This invitation cannot restore it.", "Akses sudah ditolak atau dicabut. Undangan ini tidak dapat mengaktifkannya kembali."),
    blocked: t("The company identity has changed. Contact IT to review this invitation; its approved access cannot be transferred automatically.", "Identitas perusahaan berubah. Hubungi IT untuk meninjau undangan; persetujuan aksesnya tidak dapat dipindahkan otomatis."),
  };
  return <form className="stack" onSubmit={event => { event.preventDefault(); void submit(); }}>
    {locked && result ? <Summary items={[[t("Name", "Nama"), result.name], [t("Work email", "Email kerja"), result.email], [t("Role", "Peran"), result.role], [t("Warehouse access", "Akses gudang"), result.warehouses.join(", ")]]}/> : <>
      <Field label={t("Full name (required)", "Nama lengkap (wajib)")} required maxLength={199} value={input.name} disabled={locked || busy} onChange={event => setInput({ ...input, name: event.target.value })}/>
      <Field label={t("Work email (required)", "Email kerja (wajib)")} required type="email" maxLength={253} value={input.email} disabled={locked || busy} onChange={event => setInput({ ...input, email: event.target.value })}/>
      <Field label={t("Role", "Peran")}><select value={input.role} disabled={locked || busy} onChange={event => setInput({ ...input, role: event.target.value })}>{["operator", "supervisor", "viewer", "admin"].map(role => <option key={role} value={role}>{role}</option>)}</select></Field>
      <fieldset className="stack"><legend>{t("Warehouse access (required)", "Akses gudang (wajib)")}</legend>{(user.adminWarehouses || []).map(name => <label className="checkbox-label" key={name}><input type="checkbox" checked={input.warehouses.includes(name)} disabled={locked || busy} onChange={event => setInput({ ...input, warehouses: event.target.checked ? [...input.warehouses, name] : input.warehouses.filter(value => value !== name) })}/>{name}</label>)}</fieldset>
      <Field label={t("Reason (required)", "Alasan (wajib)")} required maxLength={2000} value={input.reason} disabled={locked || busy} onChange={event => setInput({ ...input, reason: event.target.value })}/>
      <p className="muted">{t("The user chooses their password from the invitation email. An existing company account keeps its current password.", "User membuat password melalui email undangan. Akun perusahaan yang sudah ada mempertahankan passwordnya.")}</p>
    </>}
    {result && <Notice kind={result.state === "sent" || result.state === "accepted" ? "success" : "warning"}>{stateCopy[result.state]}</Notice>}
    {error && <Notice kind="error">{error}</Notice>}
    <div className="form-actions">
      <Button disabled={busy} onClick={close}>{t("Close", "Tutup")}</Button>
      {locked && <Button disabled={busy} onClick={() => void load()}>{t("Check status", "Cek status")}</Button>}
      {!locked && <Button primary type="submit" disabled={busy || !input.warehouses.length}>{busy ? t("Sending…", "Mengirim…") : t("Send invitation", "Kirim undangan")}</Button>}
      {result && ["failed", "preparing"].includes(result.state) && !uncertain && <Button primary disabled={busy} onClick={() => void submit()}>{t("Retry invitation", "Coba lagi undangan")}</Button>}
      {result && ["sent", "unknown", "expired"].includes(result.state) && !uncertain && <Button disabled={busy} onClick={() => void submit(true)}>{t("Resend invitation", "Kirim ulang undangan")}</Button>}
    </div>
  </form>;
}
