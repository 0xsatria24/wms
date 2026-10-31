# Tahap pengerjaan Inventory + WMS

Diperbarui: 31 Oktober 2026. Cakupan saat ini adalah pilot dengan data simulasi.

| Tahap | Status | Hasil atau pekerjaan tersisa |
|---|---|---|
| 1. Acuan desain dan flow | Dipilih dan dipakai | Clear Operations, spesifikasi 21 fungsi, dan dokumen App Flow menjadi acuan implementasi. |
| 2. Implementasi pilot full stack | Kode tersedia | React/TypeScript/Vite, .NET10, PostgreSQL18, Inventory Core, worker/outbox, SignalR, fondasi OIDC/PWA/gateway. Item master mencakup tambah, ubah, nonaktif dan hapus barang belum dipakai. Admin dapat menambah user pending dan menghapus user dengan pencabutan akses serta audit. |
| 3. Verifikasi transaksi dan kontrak API | Fondasi dan kontrak HTTP lulus | 39 tes backend pada PostgreSQL nyata lulus, termasuk 11 tes pipeline HTTP: cookie login, CSRF, scope gudang, akses dicabut, retry, tambah/hapus item dan user, serta order sampai pengiriman. Lima tes pending frontend juga telah lulus. Pemeriksaan ini belum mencakup seluruh kontrol UI atau layanan/perangkat klien. |
| 4. QA UI dan perangkat | Belum disahkan | Perbandingan visual akhir, seluruh kontrol, keyboard, responsif, bahasa dan tema belum selesai. Pengguna memilih penyelesaian kode dengan batas verifikasi setelah akses browser otomatis tertunda. |
| 5. Integrasi lingkungan klien | Menunggu konfigurasi dan validasi | SSO perusahaan, protokol ERP, reader/SDK RFID, printer/scanner, hosting/TLS dan kebijakan operasional. Adapter atau data simulasi tidak membuktikan integrasi perangkat/layanan nyata. |
| 6. UAT, pemulihan dan deployment | Belum dijalankan | UAT operasional, backup/restore, pemulihan antrean, stress/soak, serta pengujian Compose pada Linux. |

Status proyek: **implementasi pilot pada tahap verifikasi fondasi**, belum siap produksi. Keputusan D01–D05/T01–T08 pada dokumen perencanaan tetap terbuka.

Hasil lanjutan pada 31 Oktober: kontrak JSON untuk lookup hasil retry disamakan dengan konfirmasi transaksi. Langkah berikutnya adalah QA UI tahap 4 ketika pemeriksaan browser dilanjutkan, serta konfigurasi dan validasi integrasi tahap 5 setelah rincian lingkungan klien tersedia. Pembatasan pemeriksaan browser dari pengguna tetap berlaku.

[Status verifikasi dan bukti](verification.md) mencatat jumlah tes dan hasil aktual. [QA visual](../../design-qa.md) mencatat pemeriksaan yang belum selesai. Jangan menyimpulkan semua 21 fungsi telah lolos uji hanya karena route dan kode tersedia.
