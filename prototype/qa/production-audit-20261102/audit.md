# Audit kesiapan production Inventory/WMS

2 November 2026. Kesimpulan belum siap production. Audit menggunakan checkout lokal beserta perubahan yang sudah ada, kode backend/frontend, konfigurasi deployment, dan aplikasi development pada port 4173/5080. Superpowers dipakai untuk verifikasi, Product Design untuk alur, Impeccable untuk kualitas teknis UI, dan anti-slop untuk integritas informasi.

Tujuh prioritas berikut diurutkan berdasarkan dampak operasional. P0 menghambat pengoperasian pada lingkungan baru. P1 perlu ditutup sebelum rilis.

| Prioritas | Temuan dan dampak | Perubahan yang diperlukan | Bukti kode |
|---|---|---|---|
| P0 | Belum ada bootstrap production untuk admin pertama, gudang, lokasi, dan settings. Seed tersedia hanya untuk demo. Akun dari Add user memakai issuer `access-request`, sementara login OIDC membuat principal lain berdasarkan issuer/subject. Permintaan akses dan identitas login dapat menjadi dua akun terpisah. | Tambahkan bootstrap terkontrol untuk database kosong dan alur invitation/enrollment yang menghubungkan permintaan dengan identitas SSO terverifikasi. Uji approval, pencabutan akses, dan login pertama. | `backend/Wms.Api/Program.cs` baris 169–175, `backend/Wms.Core/Infrastructure/Seed.cs` baris 8–46, `backend/Wms.Api/Modules/Access/SsoEnrollment.cs` baris 23–38, `backend/Wms.Api/Modules/Catalog/EditService.cs` baris 101–115. |
| P0 | Master lokasi baru hanya disimpan sebagai SupportingRecord. Inventory Core mencari tabel Locations, sehingga definisi baru belum menjadi lokasi transaksi. Form juga menutup dialog dan menampilkan sukses sebelum hasil penyimpanan async diterima. | Simpan lokasi operasional ke model Locations dengan scope gudang dan validasi kode. Tunggu respons server sebelum sukses, pertahankan draft ketika gagal. | `backend/Wms.Api/Modules/Catalog/EditService.cs` baris 195–225, `backend/Wms.Core/Modules/Inventory/CommandProcessor.cs` baris 112–117, `prototype/src/management.tsx` baris 1143–1164. |
| P0 | Paket deployment belum menghubungkan HTTPS publik dengan OIDC. Nginx meneruskan `$scheme` internal, API belum memproses forwarded headers, AllowedHosts hanya localhost/127.0.0.1/api. Key Data Protection juga belum mendapat volume persisten. | Konfigurasi domain, TLS, rantai proxy tepercaya, forwarded headers sebelum autentikasi, dan penyimpanan key persisten. Uji login/callback pada domain HTTPS serta penggantian container. | `deploy/nginx.conf` baris 7–10, `backend/Wms.Api/Program.cs` baris 36–40, `backend/Wms.Api/appsettings.json` baris 3, `compose.yaml`. |
| P1 | ERP belum siap dipakai menyeluruh. Worker menunggu tanpa batas jika adapter belum dikonfigurasi. Rekonsiliasi membutuhkan Erp:StatusEndpoint, tetapi variabel itu belum diteruskan Compose. Respons transport sukses dengan hasil bisnis pending/unknown dapat tetap tertahan. Jalur impor PO nyata belum tersedia pada API yang diperiksa. | Hubungkan kontrak ERP nyata, impor dokumen sumber, status lookup, dan alert umur backlog. Uji accepted, rejected, timeout, respons rusak, serta replay setelah restore menggunakan event ID asli. | `backend/Wms.Worker/OutboxWorker.cs` baris 16–31 dan 112–125, `compose.yaml` bagian worker, `backend/Wms.Core/Infrastructure/Seed.cs` untuk PO contoh. |
| P1 | Snapshot mengambil seluruh master, posisi, dokumen, dan ledger sebelum pagination UI. Pembaruan SignalR memicu pembacaan ulang snapshot. Risiko beban meningkat mengikuti riwayat dan pengguna aktif, belum diukur pada volume production. | Tambahkan filter, pagination, dan agregasi di server. Pisahkan riwayat dari snapshot kerja. Ukur beban API/database dengan ukuran data serta operator serentak yang disepakati. | `backend/Wms.Api/Modules/Reporting/SnapshotQuery.cs` baris 17–37, `prototype/src/api.ts` baris 417–443. |
| P1 | Grafik pengiriman dan persentase perbandingan memakai angka fixture. Kondisi tampil berdasarkan SKU-A dan nama gudang, tanpa pemeriksaan mode demo. Angka contoh dapat terbawa ke build production. | Ambil metrik dari transaksi confirmed dengan periode dan scope yang benar, atau tampilkan belum ada data ketika sumber belum tersedia. | `prototype/src/Stock.tsx` baris 46 dan 854–917. |
| P1 | Belum ada bukti pemulihan dan penerimaan lingkungan klien. UI sendiri menandai backup belum tersedia, restore belum dijalankan, dan RPO/RTO belum diukur. Compose belum mempunyai restart policy serta healthcheck API/worker. | Tambahkan backup terjadwal di luar host, restore drill dengan rekonsiliasi outbox, alert kegagalan layanan, dan restart policy. Jadikan smoke test Linux/HTTPS, UAT operator, scanner/printer nyata, serta putus koneksi/restart browser sebagai syarat rilis. Validasi RFID jika masuk cakupan rilis. | `prototype/src/controls.tsx` baris 562–588, `compose.yaml`, `docs/implementation/progress.md`. |

Konfigurasi proxy dan key perlu mengikuti [panduan proxy ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0) dan [panduan Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0). Dampak pada domain production merupakan inferensi dari konfigurasi yang diperiksa, belum reproduksi pada hosting klien.

## Verifikasi aktual

- PASS. `npm run build`, termasuk TypeScript, selesai dengan exit 0.
- PASS. 20 tes frontend untuk pending, katalog, work queue, autocomplete, dan pengelompokan stok. Tidak ada kegagalan.
- PASS. 39 tes backend pada PostgreSQL 18, tidak ada kegagalan atau tes dilewati. Durasi 4 menit 38 detik. Hasil di `backend/Wms.Tests/TestResults/postgres-foundation.trx`.
- PASS terbatas. CSRF, scope akses, idempotency dan outbox mempunyai implementasi serta cakupan tes. Hasil ini berlaku pada skenario yang diuji.

## Alur UI yang diperiksa

1. Stock position desktop. Katalog dan pemisahan condition/status dapat dibaca. Grafik masih fixture, terkait temuan keenam.

![Stock position](<C:/Users/muham/OneDrive/Documents/ChatGPT/inventory management system/prototype/qa/production-audit-20261102/02-stock-desktop.png>)

2. Receiving sampai Review and confirm. Barang, kuantitas, gudang, sisa PO, dan tujuan terlihat sebelum konfirmasi. Escape menutup dialog. Pemeriksaan berhenti pada review dan tidak memposting penerimaan.

![Review penerimaan](<C:/Users/muham/OneDrive/Documents/ChatGPT/inventory management system/prototype/qa/production-audit-20261102/04-receipt-review.png>)

3. Receiving pada viewport 390 × 844. Toolbar reflow dan tabel memiliki scroll horizontal lokal dengan petunjuk. Scanner fisik belum diuji.

![Receiving handheld](<C:/Users/muham/OneDrive/Documents/ChatGPT/inventory management system/prototype/qa/production-audit-20261102/05-receiving-phone.png>)

4. Pending transactions pada viewport 390 × 844. Empty state dan perbedaan offline/unknown jelas. Lebar dokumen terukur 390 px pada viewport 390 px. Retry browser dengan antrean terisi belum diperiksa dalam run ini, perilaku antrean diperiksa melalui tes frontend.

![Pending handheld](<C:/Users/muham/OneDrive/Documents/ChatGPT/inventory management system/prototype/qa/production-audit-20261102/06-pending-phone.png>)

Audit UI ini mencakup alur di atas. Seluruh modul, pembaca layar, kepatuhan WCAG, integrasi SSO/ERP nyata, deployment Linux, load test, perangkat fisik, backup/restore, dan UAT belum divalidasi dalam run ini. Screenshot desktop cukup untuk struktur dan alur, tetapi hasil capture kurang tajam untuk menilai kontras tipografi secara presisi.

Launcher Impeccable gagal karena engine belum terpasang dan cache di luar workspace tidak dapat dibuat. Audit dilanjutkan dengan membaca DESIGN.md dan playbook audit secara langsung. Detector otomatis Impeccable tidak dijalankan. Tidak ada perubahan pada kode aplikasi selama audit.
