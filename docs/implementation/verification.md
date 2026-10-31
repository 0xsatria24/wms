# Status verifikasi implementasi

Tanggal: 31 Oktober 2026. Dokumen ini hanya mencatat pemeriksaan yang benar-benar dilakukan.

## Hasil kode dan pengujian

- Build solusi .NET10 lulus dengan 0 warning dan 0 error. API, Core, worker, gateway dan test project berhasil dikompilasi. Sesudah penambahan Delete item, `test-local.ps1` mengompilasi ulang API dan test project sebelum menjalankan tes.
- TypeScript dan build Vite revisi layout lulus. Bundle aplikasi 462.26kB, chart 209.09kB dan SignalR 55.67kB sebelum gzip; ini ukuran build, bukan pengukuran performa pengguna. Dua pemberitahuan annotation PURE dari SignalR tetap ada dan tidak menggagalkan build.
- **39/39 uji xUnit lulus, 0 skipped, pada PostgreSQL 18.4 nyata**, durasi 4 menit 23 detik. Laporan: `backend/Wms.Tests/TestResults/postgres-foundation.trx` (artefak lokal yang diabaikan Git). Jumlah ini mencakup 28 tes fondasi/katalog dan 11 tes pipeline HTTP. Fixture membuat database unik per tes dan menonaktifkan pooling koneksi untuk database tes agar koneksi idle lintas database tidak menumpuk. Penguncian dan konkurensi tetap memakai PostgreSQL asli.
- 19 tes fondasi/workflow: penerimaan60/sisa40 dan idempotensi, key berubah, rollback precommit, reservasi bersamaan, request identik bersamaan, picking, transfer50/48, freeze, desimal, akses dicabut, blind count API, QC/putaway dan konservasi ledger, pengiriman aktual, pembatalan/return-to-stock, reviewer opname berbeda, JSON kanonis, pending milik principal asal, spool SQLite setelah dibuka ulang, dan pemeriksaan akses CSV terkini.
- 9 tes Delete item: admin/supervisor dapat menghapus barang belum digunakan dan menyimpan audit snapshot; posisi stok nol, dokumen di gudang lain, kemasan di gudang lain dan riwayat label menghalangi penghapusan; operator, alasan kosong dan versi usang ditolak.
- 6 tes HTTP menjalankan pipeline ASP.NET dengan cookie/CSRF asli dan PostgreSQL terisolasi: sesi anonim/CSRF, izin gudang/pencabutan akses/logout, tambah–hapus item beserta audit, penerimaan/retry/lookup hasil, penolakan principal lain serta penghapusan barang terpakai, dan order–approval–release–reservasi–picking–shipment. TestServer menyediakan transport dalam proses, sehingga ini bukan pengujian Kestrel/TLS/reverse proxy atau browser.
- 5 tes HTTP pengelolaan user ditambahkan: pembuatan pending tanpa akses, duplikat email bersamaan dan audit tambah/hapus; penghapusan akun aktif menolak sesi lama/login baru tanpa menghapus sejarah; akun sendiri dan target di luar kewenangan admin ditolak; operator dan supervisor tidak dapat menambah/menghapus user. Tes juga memeriksa alasan wajib, approval sebelum email terverifikasi ditolak, review lama tidak mengaktifkan kembali akun terhapus, serta email akun terhapus tidak menghasilkan identitas pengganti. Backend menyimpan status deleted dan menghapus grants, bukan menghapus identitas dari riwayat.
- Tes HTTP menemukan perbedaan nama properti respons status retry (`Id` dibanding `id`). Endpoint `GET /api/requests/{type}/{key}` sekarang memakai serialisasi respons yang sama dengan konfirmasi/retry POST. Tes memeriksa ID transaksi dan bentuk JSON yang sama, satu posting penerimaan, header no-store, serta hasil tidak dibuka kepada principal lain. Rangkaian awal enam tes mencatat satu kegagalan kontrak ini; seluruh 34 tes kemudian lulus setelah perbaikannya.
- **5/5 tes antrean frontend lulus** menggunakan kode `src/api.ts`, fake-indexeddb dan fetch/server tiruan: offline tanpa POST, retry key/isi/versi asal, respons hilang dan kegagalan server, akses dicabut, pemisahan akun/gudang, penolakan validasi pasti, serta pemulihan CSRF dengan key tetap. Ini tidak membuktikan integrasi browser/PWA fisik.
- **4/4 tes packaging frontend lulus** (`test:sites`). Tidak ada deployment Sites; tes ini hanya memeriksa runtime static starter yang dipertahankan.
- Skrip `start-local.ps1` dijalankan, API readiness dan frontendHTTP200 diperiksa. Preview kembali berjalan pada127.0.0.1:4173; API5080; database proyek55432. `stop-local.ps1` telah menghentikan hanya web/worker/API milik proyek sebelum build ulang.
- 14 pasangan token teks/background terang dan gelap lulus pemeriksaan kontras4.5:1 dengan checker antislop-human; rasio terendah5.36:1. Pemeriksaan ini terhadap token statis, bukan pemindaian semua elemen hasil render.

## Bukti browser yang tersedia

- Browser in-app: login ke API, pilih gudang, posisi awal dari database, penerimaan60 dari100, QC50/10 dan putaway50 ke A-01 berhasil. Tersedia menjadi126 dan stok ditolak tetap di QC.
- Browser: picking24 berhasil setelah perbaikan pembaruan token CSRF. Pada31Oktober, login dan workspace berhasil lagi, serta form packing menampilkan picked24/shipped0 dari database. Konfirmasi pengiriman melalui browser belum selesai; pengiriman melalui handler dan pipeline HTTP telah lulus tes PostgreSQL.
- Screenshot tersedia: `prototype/qa/inbound-stock-result.png` dan `prototype/qa/stock-desktop.png`. Keduanya bukti keadaan saat diambil, bukan bukti semua perubahan terakhir.

## Batas pemeriksaan visual

Pembaruan setelah permintaan perbaikan screenshot: browser berhasil digunakan kembali untuk alignment stok, sidebar, katalog Items dan editor. Search/filter/sort, empty state, pagination 10/25/50 dengan fixture 10.000 item, draft/discard, validasi duplikat, submit editor dalam fixture, keyboard, tema gelap/Indonesia, serta lebar 390/900/1448 dan tinggi sidebar650 diperiksa. Tidak ada horizontal page overflow pada ukuran tersebut atau error aplikasi pada log yang diperiksa. Tiga tes katalog baru lulus; lima tes pending dan empat tes packaging dijalankan ulang dan lulus.

Root `design-qa.md` sekarang `final result: passed` **hanya untuk cakupan perubahan layout tersebut**. Bukti berada di `prototype/qa/layout-20261031/`; gate scoped ada pada `layout-antislop-gate.md`. Snapshot API masih memuat master sebelum pagination UI; pengujian fixture bukan bukti skalabilitas database atau payload produksi. Backend tidak berubah dan 39 tes backend tidak diulang untuk perubahan frontend ini.

Catatan batas sebelumnya di bawah tetap berlaku bagi fungsi lain yang tidak diperiksa pada revisi layout:

Peninjauan akses browser otomatis habis waktu dua kali ketika memeriksa origin lokal. Pengguna kemudian memilih **cukup selesaikan kode dan laporkan batas verifikasi**. Pemeriksaan browser tidak dilanjutkan. Tidak ada klaim lolos QA visual, responsive, keyboard, tema/bahasa, seluruh kontrol, atau console bersih pada versi akhir. Tombol Delete item serta Add user/Delete user sudah dikompilasi dan aturan backend diuji; klik dialognya di browser belum diverifikasi. Label pilihan bahasa pada komponen bersama diubah menjadi Bahasa Indonesia; tambahan dalam tanda kurung sudah dihapus dari kode UI.

Baseline QA yang berstatus blocked disimpan di `design-qa-before-layout.md`. Gate antislop seluruh aplikasi tetap belum lulus penuh; lihat `antislop-gate.md`. Hasil scoped layout tidak berarti seluruh 21 fungsi sudah diterima.

## Tidak dijalankan

UAT klien, SSO IdP nyata, ERP nyata, Testcontainers/Docker runtime, scanner dan reader fisik, instalasi PWA di perangkat, backup/restore nyata, RPO/RTO, stress/soak serta pengujian produksi. D01–D05/T01–T08 tetap terbuka. Lulus build/tes lokal tidak menutup gate tersebut.
