# Admin Setup Wizard Implementation Plan

## Revisi eksekusi: tanpa tahap gudang

Tambahan terbatas yang diotorisasi pengguna: integrasikan generasi aktivasi ke installer Windows melalui `Initialize-WmsSetup` dalam `configuration.ps1`; probe database baca saja `--installation-state`; kode privat sebelum service start; lokasi kode di halaman akhir. Verifikasi melalui `scripts/test-installer-activation.ps1` (logika provisioning dengan ACL/service dimock) dan build/regresi backend. Instalasi nyata/ACL host tetap memerlukan verifikasi di mesin instalasi.

Koreksi pengguna 3 November 2026 menggantikan bagian Task 1/Task 3 tentang payload dan form gudang. UI hanya aktivasi → SSO → tinjauan admin/perusahaan. Stage setelah SSO adalah `review`. Complete memakai body kosong dan membaca satu `Setup:Warehouse` dari konfigurasi IT; status unavailable jika konfigurasi tersebut invalid. Payload gudang browser diabaikan dan diuji. Compose/konfigurasi Windows serta panduan provisioning diperbarui. CLI bootstrap tetap mendukung inputnya sendiri. Lihat revisi aktif PRD untuk cakupan yang berlaku; checklist rancangan awal di bawah bersifat historis untuk bagian yang diganti.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Membuat admin pertama melalui wizard aktivasi dan SSO tanpa CLI bootstrap manual.

**Architecture:** Tambahkan layanan status/aktivasi dan endpoint setup terpisah dari enrollment biasa. Identitas SSO setup tidak ditulis sebagai pending. Penyelesaian memakai `ProductionBootstrap.Run` dan lock yang sama dengan CLI.

**Tech Stack:** ASP.NET Core 10, EF Core/Npgsql 10, PostgreSQL 18, React/TypeScript/Vite, OIDC dan ASP.NET Data Protection.

**Spec:** `docs/planning/prd-admin-setup-wizard.md`

## Global Constraints

- Setup production opt-in; seed demo tetap development-only.
- Kode acak minimum 32 byte, hash di konfigurasi, default berlaku 24 jam; sesi maksimum 30 menit.
- Tidak mengubah otoritas Inventory Core, grant operasional, recovery hold atau antiforgery.
- Satu gudang awal; perusahaan baca saja dari konfigurasi instalasi; tidak membuat stok contoh.
- Tidak commit konfigurasi nyata, secret atau output provisioning.

## Review Focus

- OIDC dan registrasi normal pada database kosong tidak boleh menulis pending principal.
- CLI dan HTTP harus memakai lock bootstrap yang sama.
- Cookie dan callback setup tidak boleh memberi grant operasional sebelum commit.
- Respons submit hilang harus diikuti pemeriksaan status baca saja.
- Installer Windows dan health check Docker harus tetap dapat mengakses setup pada database kosong.

## Task 1: Layanan aktivasi dan bootstrap

**Files:** tambah `backend/Wms.Api/Modules/Access/SetupService.cs`, `SetupEndpoints.cs`, dan `backend/Wms.Tests/SetupWizardTests.cs`; ubah `ProductionBootstrap.cs`, `Program.cs`.

**Interfaces:** GET `/api/setup/status` menghasilkan `state: required|completed|unavailable|blocked` dan `companyName`. POST `/api/setup/activate` menerima `{code}`. POST `/api/setup/complete` menerima `{warehouseId,warehouseName,storageLocations}`; identitas tidak diterima dari payload. Sesi aktivasi membawa fingerprint hash konfigurasi, expiry, dan nonce melalui cookie Data Protection khusus setup.

GET `/api/setup/session` menerbitkan token antiforgery melalui `GetAndStoreTokens`, menghasilkan `{csrfToken, stage, expiresAt, identity}` dengan header `Cache-Control: no-store`. Sebelum aktivasi, identity null dan stage activation; setelah aktivasi stage identity; setelah SSO sah stage details dengan identity `{name,email}`. Identitas tidak pernah dikembalikan tanpa sesi setup valid. Frontend mengambil ulang token setelah perubahan identitas/cookie untuk menghindari token CSRF lama. Semua POST memakai header `X-XSRF-TOKEN` yang sudah digunakan aplikasi.

- [ ] Tulis tes status pada database kosong, selesai dan parsial; tes kode salah/expired/rotated; jalankan dan catat kegagalan awal.
- [ ] Implementasikan status, validasi hash constant-time dan sesi cookie terbatas; provisioning menghasilkan kode kriptografis dan konfigurasi hash/expiry tanpa menulis secret ke repo.
- [ ] Tulis tes transaksi, validasi lokasi, submit bersamaan dan CLI versus HTTP pada database `wms_test_*`.
- [ ] Implementasikan complete melalui bootstrap bersama; trim dan validasi input sebelum transaksi; tidak memperluas otorisasi API operasional.
- [ ] Jalankan tes dan pastikan satu admin, audit serta gudang/lokasi yang benar dan tidak ada stok.

## Task 2: OIDC dan pembatasan enrollment

**Files:** ubah `backend/Wms.Api/Modules/Access/SsoEnrollment.cs`, `Program.cs`; tambah tes HTTP/OIDC dalam `backend/Wms.Tests/SetupWizardTests.cs`.

**Interfaces:** GET `/auth/setup-login` memulai challenge OIDC setelah memverifikasi cookie aktivasi. AuthenticationProperties menandai proses setup; callback memverifikasi ulang cookie, fingerprint dan expiry, lalu menyimpan identitas dalam sesi setup terlindungi tanpa enrollment. Redirect hanya ke route setup lokal tetap.

- [ ] Tulis dan jalankan tes callback tanpa sesi, email unverified, expiry saat login, serta normal login/access request sebelum setup.
- [ ] Implementasikan cabang setup pada callback dan blokir enrollment biasa sebelum database diinisialisasi. Setelah setup, pertahankan aturan enrollment lama.
- [ ] Lakukan pemeriksaan status enrollment di dalam transaksi dengan lock `production-bootstrap` sebelum lock `edit:demo:users`, selalu dalam urutan yang sama. Tolak database kosong/parsial sebelum menulis principal. Tambahkan tes race enrollment versus completion; pemeriksaan di luar transaksi saja tidak cukup.
- [ ] Tes endpoint POST tanpa CSRF, sesi setup terhadap API operasional, rate limit dan replay cookie setelah completion.
- [ ] Jalankan regresi `ProductionReadinessTests` dan tes akses yang sudah ada.

## Task 3: UI wizard

**Files:** tambah `prototype/src/SetupWizard.tsx`; ubah `prototype/src/App.tsx`, modul API yang dipakai App, dan `prototype/src/styles.css` bila diperlukan; tambah bukti `prototype/qa/admin-setup-20261103/`.

**Interfaces:** Komponen memuat status backend sebelum memutuskan login/setup. Aktivasi → SSO → form → tinjauan → hasil; status identitas dari endpoint sesi setup, bukan browser storage. API session setup hanya mengembalikan nama/email untuk sesi berizin, tidak token/issuer-subject mentah.

- [ ] Tambahkan state loading/error/retry, kode aktivasi dan navigasi SSO; input kode tidak dipersistenkan.
- [ ] Implementasikan form satu gudang, daftar lokasi, tinjauan baca saja, Kembali dan submit eksplisit. Gunakan pola komponen auth, bahasa dan token yang sudah ada.
- [ ] Pada hasil tidak diketahui, baca status ulang sebelum retry; sesi habis kembali ke aktivasi dengan penjelasan.
- [ ] Jalankan `npm run build` dari prototype; gunakan tes komponen atau browser untuk validasi, navigasi kembali dan unknown result.
- [ ] Jalankan server sendiri; click-through desktop dan 360px dengan keyboard dalam dua bahasa. Rekam screenshot, error console dan hasil setiap kontrol; jangan mengklaim login SSO klien telah diuji bila hanya memakai provider uji.

## Task 4: Provisioning, installer dan verifikasi akhir

**Files:** ubah `deploy/windows/install-services.ps1`, `deploy/windows/setup.iss`, konfigurasi contoh Windows/Docker yang terkait, `docs/implementation/windows-local.md`, `docs/implementation/production-runbook.md`; tambah skrip provisioning kode dan tes deployment.

- [ ] Tambahkan contoh konfigurasi setup disabled default dengan hash dan expiry placeholder; skrip menolak menimpa output privat tanpa instruksi eksplisit.
- [ ] Uji instalasi baru yang sudah dimigrasikan: health operasional 503 tetapi pemeriksaan kesiapan setup mengizinkan installer selesai. Database rusak tidak dianggap siap setup.
- [ ] Periksa worker dan dependency health Docker; setup harus terjangkau tanpa menyatakan inventori siap sebelum bootstrap.
- [ ] Dokumentasikan penerbitan/rotasi kode, jalur wizard versus CLI, restart, dan penanganan respons hilang; jangan dokumentasikan kode nyata.
- [ ] Jalankan tes backend yang relevan, build frontend dan tes packaging yang relevan. Tinjau diff untuk secret, perubahan tidak terkait dan klaim yang tidak didukung.

## Status eksekusi

Pengguna menyetujui implementasi pada 3 November 2026. Task 1–4 diimplementasikan lokal: layanan aktivasi, endpoint/cookie setup, callback OIDC tanpa enrollment, lock enrollment bersama bootstrap, UI dua bahasa, helper provisioning, konfigurasi dan readiness installer/container. Checklist di atas menyimpan rincian rencana; hasil aktual dan batas pengujian dicatat dalam `prototype/qa/admin-setup-20261103/review.md`.

Pemeriksaan builder menemukan dua celah kontrak yang sudah dimasukkan: endpoint sesi/CSRF dan koordinasi lock enrollment versus bootstrap. Cookie setup memakai Secure/HttpOnly/SameSite=None agar callback OIDC form_post lintas situs dapat membawa cookie; nonce terlindungi mengikat callback ke sesi aktivasi.
