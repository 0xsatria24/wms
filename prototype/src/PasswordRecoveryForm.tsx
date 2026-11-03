import React, { useState } from "react";
import { recoverPassword } from "./api";
import { Button, Field, Notice, errorText, useText } from "./ui";

export function PasswordRecoveryForm({ go }) {
  const t = useText();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  return <form className="stack" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await recoverPassword(email.trim()); setDone(true); }
    catch (e) { setError(errorText(e.code || e.message, t)); }
    finally { setBusy(false); }
  }}>
    {done ? <Notice kind="success">{t("Your recovery request was received. If an eligible account exists, the identity service will request a reset email. Contact IT if it does not arrive.", "Permintaan pemulihan diterima. Jika akun memenuhi syarat, layanan identitas akan memproses email reset. Hubungi IT jika email belum diterima.")}</Notice> : <>
      <p>{t("Enter your work email. You will set a new password through your company identity service.", "Masukkan email kerja. Password baru dibuat melalui layanan identitas perusahaan.")}</p>
      <Field label={t("Work email (required)", "Email kerja (wajib)")} required type="email" autoComplete="email" maxLength={253} value={email} disabled={busy} onChange={event => setEmail(event.target.value)}/>
      {error && <Notice kind="error">{error}</Notice>}
      <Button primary type="submit" disabled={busy}>{busy ? t("Submitting…", "Mengajukan…") : t("Request password reset", "Minta reset password")}</Button>
    </>}
    <Button disabled={busy} onClick={() => go("signin")}>{t("Back to sign in", "Kembali ke login")}</Button>
  </form>;
}
