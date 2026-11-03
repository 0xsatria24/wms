# Review login SSO dan akses pengguna — 3 November 2026

Review menggunakan Superpowers systematic-debugging dan reviewer terpisah. Cakupan: login Keycloak lokal, enrollment, setup admin, logout dan keputusan akses pada worktree saat review. Tidak ada perubahan kode, reset password, perubahan grant, atau pemasangan ulang selama review.

## Penyebab keluhan satria

- Log terbaru mencatat `realmName=master`, `clientId=security-admin-console`, `error=user_not_found`, username `satria` atau `satria@localhost.test`. Akun aplikasi dicoba pada console administrasi Keycloak.
- Di realm `wms-local`, satria aktif, email verified, credential password tersedia, tidak memiliki required action dan tidak terkena lockout. Ada sesi client `inventory-wms-local`. Password yang diketik pengguna tidak diperiksa atau ditebak.
- Pada database aplikasi `wms_sso_local`, satria berstatus `active`, `Verified=true`, issuer `https://localhost:8443/realms/wms-local`.
- Endpoint aplikasi terpasang `/auth/login` menghasilkan HTTP 302 menuju `/realms/wms-local/protocol/openid-connect/auth`.
- Cara masuk aplikasi: buka `https://localhost:5443`, lanjutkan SSO, gunakan satria. Console `https://localhost:8443/admin/master/console/` memakai akun administrator Keycloak `local-bootstrap`, bukan akun aplikasi satria. Kredensial administrator tersimpan privat di `.runtime/local-sso/KEYCLOAK-ADMIN.txt`.

## Temuan yang perlu diperbaiki

### 1. P2 — Logout belum menyediakan pergantian akun SSO

Lokasi: `backend/Wms.Api/Program.cs:183-189`, `prototype/src/App.tsx:839-848`.

Logout hanya menghapus cookie WMS. Login berikutnya tidak meminta pemilihan akun atau autentikasi ulang, sehingga sesi Keycloak yang masih aktif membawa pengguna kembali ke identitas yang sama. Akun pending juga tidak memiliki kontrol logout pada header aplikasi.

Perbaikan terarah: sediakan tindakan ganti akun yang bekerja pada alur OIDC, dengan kebijakan logout provider atau prompt autentikasi yang sesuai. Pertahankan perlindungan CSRF dan pemisahan data pengguna. Uji perpindahan dua identitas, termasuk akun pending dan langkah kembali pada setup.

### 2. P2 — Reject user baru memaksa pemilihan gudang

Lokasi: `prototype/src/management.tsx:93-102`, `backend/Wms.Api/Modules/Catalog/EditService.cs:208-227`.

User baru belum mempunyai grant. Tombol Reject memakai validasi yang sama dengan Approve, sehingga alasan penolakan saja tidak cukup: admin diminta memilih gudang. Jika gudang dipilih agar proses lolos, cabang `access` ikut membuat grant meskipun status akhirnya `rejected`. Status tersebut tetap menghalangi akses operasional, tetapi keputusan penolakan menghasilkan grant yang tidak diperlukan.

Perbaikan terarah: gunakan operasi `access-status` yang sudah ada untuk penolakan, tanpa membuat grant. Uji Add user → Review → Reject dengan alasan, pastikan grant tetap kosong.

### 3. P2 — Pilihan gudang approval belum membedakan peran admin

Lokasi: `prototype/src/management.tsx:281`, `backend/Wms.Api/Modules/Access/AccessService.cs:31-40`, `backend/Wms.Api/Modules/Catalog/EditService.cs:213-217`.

UI menawarkan semua `user.warehouses`, termasuk gudang tempat pengguna hanya viewer/operator. Backend hanya mengizinkan gudang dengan grant admin. Admin di A yang viewer di B masih dapat memilih B, lalu menerima 403 scope. Otorisasi backend tetap bekerja.

Perbaikan terarah: kirim daftar gudang yang dapat dikelola secara administratif dan gunakan daftar itu pada review. Uji admin di A/viewer di B, serta admin satu gudang.

## Verifikasi dan batas bukti

- Pemeriksaan read-only Keycloak Admin API, log lokal, status principal di PostgreSQL, dan redirect aplikasi terpasang dilakukan pada sesi review ini.
- Hash `index.html` aplikasi terpasang cocok dengan build frontend workspace.
- Backend: 20 tes terpilih `SetupWizardTests`, `ProductionReadinessTests`, `RememberMe`, dan `LoginRateLimit` lolos dengan konfigurasi Release. Build Debug awal terhalang DLL yang digunakan proses lokal; proses pengguna tidak dihentikan.
- Frontend: 4 tes login/preview lolos; `npm run typecheck` lolos. Tes preview awal gagal karena sandbox menolak socket loopback, lalu lolos dengan izin koneksi lokal.
- Tes tersebut belum membuktikan alur browser dua akun, logout provider, mixed-role approval, dan penolakan undangan tanpa grant. Ketiga temuan di atas diperiksa dari jalur kode, bukan dipicu dengan mengubah akun pengguna.
- WMS Add user tidak membuat password atau akun Keycloak: ini pemisahan identitas dan otorisasi yang memang digunakan aplikasi, bukan bug sinkronisasi.
- Callback gagal enrollment belum direproduksi sebagai respons HTTP nyata; tidak ada klaim tentang status/exception persisnya. SMTP, restart komputer, dan penerimaan production di luar cakupan review ini.

Rekomendasi: perbaiki tiga temuan di atas sebelum merekam simulasi beberapa pengguna. Error login satria yang diperiksa berasal dari realm console admin yang berbeda; reset password tidak diperlukan berdasarkan bukti yang tersedia.

## Tindak lanjut implementasi pada hari yang sama

Ketiga temuan sudah ditangani dan diterapkan pada aplikasi Windows lokal terpasang setelah pengguna meminta perbaikan:

- Challenge OIDC normal dan setup meminta `prompt=login`. Cookie WMS tetap dihapus saat Logout; sesi provider untuk aplikasi perusahaan lain tidak diakhiri. Uji browser nyata berhasil masuk sebagai admin, keluar, lalu meminta login kembali. Keycloak menampilkan autentikasi ulang akun sebelumnya; tombol **Restart login** membuka username yang dapat diedit dan input password untuk akun berbeda. Tidak mengubah atau mereset password satria.
- Session API sekarang mengirim `adminWarehouses`, yang hanya berasal dari grant admin. Review akses menggunakan daftar tersebut. Backend tetap menolak gudang di luar scope.
- Reject/Revoke tidak mewajibkan pilihan gudang atau mengubah role/grant. Frontend memakai operasi `access-status` beserta expectedStatus; jalur `access` lama juga dibatasi agar hanya approval yang mengubah grant. Revoke dinonaktifkan untuk akun yang sudah rejected/revoked.
- Tes regresi awal mereproduksi tujuh kegagalan backend terkait prompt/scope/grant dan dua kegagalan payload frontend. Satu tes setup awal membutuhkan koreksi fixture metadata OIDC, kemudian lulus bersama suite terpilih.
- Verifikasi setelah patch: 23 tes backend terpilih dan 14 tes frontend lolos; typecheck/build production lolos; pemeriksaan diff dan detector UI tidak menemukan masalah. Bukti TRX ada pada output tes lokal.
- API terpasang dan frontend cocok dengan hash publish/build. Service `InventoryWms.Api` kembali Running dan `/health/ready` merespons 200. Backup file sebelum pembaruan ada di `.runtime/access-fix-backup-20261103-161511`.
- Update lokal hanya mengganti assembly API/Core dan aset frontend. Database, konfigurasi, service worker, kredensial dan grant pengguna dipertahankan. Installer lama belum dibangun ulang; bukti pemasangan ini berlaku pada aplikasi lokal yang sedang terpasang.

Penerimaan yang masih bergantung pada pengguna: login memakai password satria yang dibuat sendiri. Pengujian browser tidak menebak password tersebut atau membuat akun operasional baru.
