# Status verifikasi implementasi

Tanggal: 31 Oktober 2026. Dokumen ini hanya mencatat pemeriksaan yang benar-benar dilakukan.

## Hasil kode dan pengujian

- Build solusi .NET10 lulus dengan 0 warning dan 0 error. API, Core, worker, gateway dan test project berhasil dikompilasi. Sesudah penambahan Delete item, `test-local.ps1` mengompilasi ulang API dan test project sebelum menjalankan tes.
- TypeScript dan build Vite lulus. Bundle dipisah menjadi aplikasi449.43kB, chart209.09kB dan SignalR55.67kB sebelum gzip; ini ukuran artefak build, bukan pengukuran performa pengguna. Ada dua pemberitahuan annotation PURE dari paket SignalR; build berhasil.
- **28/28 uji xUnit lulus, 0 skipped, pada PostgreSQL18.4 nyata**, durasi2menit13detik. Laporan: `backend/Wms.Tests/TestResults/postgres-foundation.trx` (artefak lokal yang diabaikan Git). Fixture membuat database unik per tes dan menonaktifkan pooling koneksi untuk database tes agar koneksi idle lintas database tidak menumpuk. Penguncian dan konkurensi tetap memakai PostgreSQL asli.
- 19 tes fondasi/workflow: penerimaan60/sisa40 dan idempotensi, key berubah, rollback precommit, reservasi bersamaan, request identik bersamaan, picking, transfer50/48, freeze, desimal, akses dicabut, blind count API, QC/putaway dan konservasi ledger, pengiriman aktual, pembatalan/return-to-stock, reviewer opname berbeda, JSON kanonis, pending milik principal asal, spool SQLite setelah dibuka ulang, dan pemeriksaan akses CSV terkini.
- 9 tes Delete item: admin/supervisor dapat menghapus barang belum digunakan dan menyimpan audit snapshot; posisi stok nol, dokumen di gudang lain, kemasan di gudang lain dan riwayat label menghalangi penghapusan; operator, alasan kosong dan versi usang ditolak.
- **5/5 tes antrean frontend lulus** menggunakan kode `src/api.ts`, fake-indexeddb dan fetch/server tiruan: offline tanpa POST, retry key/isi/versi asal, respons hilang dan kegagalan server, akses dicabut, pemisahan akun/gudang, penolakan validasi pasti, serta pemulihan CSRF dengan key tetap. Ini tidak membuktikan integrasi browser/PWA fisik.
- **4/4 tes packaging frontend lulus** (`test:sites`). Tidak ada deployment Sites; tes ini hanya memeriksa runtime static starter yang dipertahankan.
- Skrip `start-local.ps1` dijalankan, API readiness dan frontendHTTP200 diperiksa. Preview kembali berjalan pada127.0.0.1:4173; API5080; database proyek55432. `stop-local.ps1` telah menghentikan hanya web/worker/API milik proyek sebelum build ulang.
- 14 pasangan token teks/background terang dan gelap lulus pemeriksaan kontras4.5:1 dengan checker antislop-human; rasio terendah5.36:1. Pemeriksaan ini terhadap token statis, bukan pemindaian semua elemen hasil render.

## Bukti browser yang tersedia

- Browser in-app: login ke API, pilih gudang, posisi awal dari database, penerimaan60 dari100, QC50/10 dan putaway50 ke A-01 berhasil. Tersedia menjadi126 dan stok ditolak tetap di QC.
- Browser: picking24 berhasil setelah perbaikan pembaruan token CSRF. Pada31Oktober, login dan workspace berhasil lagi, serta form packing menampilkan picked24/shipped0 dari database. Konfirmasi pengiriman melalui browser belum selesai; pengiriman melalui handler telah lulus tes PostgreSQL.
- Screenshot tersedia: `prototype/qa/inbound-stock-result.png` dan `prototype/qa/stock-desktop.png`. Keduanya bukti keadaan saat diambil, bukan bukti semua perubahan terakhir.

## Batas pemeriksaan visual

Peninjauan akses browser otomatis habis waktu dua kali ketika memeriksa origin lokal. Pengguna kemudian memilih **cukup selesaikan kode dan laporkan batas verifikasi**. Pemeriksaan browser tidak dilanjutkan. Tidak ada klaim lolos QA visual, responsive, keyboard, tema/bahasa, seluruh kontrol, atau console bersih pada versi akhir. Tombol Delete item sudah dikompilasi dan aturan backend diuji; klik dialognya di browser belum diverifikasi.

`design-qa.md` berstatus `final result: blocked`. Perbaikan proporsi panel stok sudah ditulis tetapi belum dicapture ulang. Gate antislop belum lulus penuh; lihat `docs/implementation/antislop-gate.md`. Penyerahan ini adalah hasil implementasi kode dengan batas pengujian yang disetujui pengguna, bukan penerimaan desain akhir.

## Tidak dijalankan

UAT klien, SSO IdP nyata, ERP nyata, Testcontainers/Docker runtime, scanner dan reader fisik, instalasi PWA di perangkat, backup/restore nyata, RPO/RTO, stress/soak serta pengujian produksi. D01–D05/T01–T08 tetap terbuka. Lulus build/tes lokal tidak menutup gate tersebut.
