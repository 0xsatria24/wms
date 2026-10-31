# Inventory + WMS: rancangan UI per fungsi

Tanggal: 29 Oktober 2026. Status: **usulan desain untuk ditinjau, tanpa implementasi aplikasi**.

Paket ini menerjemahkan PRD, TRD, App Flow, Design Brief, Backend Schema, rencana P1-P8 dan PRD tracker menjadi fondasi visual serta spesifikasi layar. Screenshot laptop/logistik terbaru menjadi referensi kepadatan, hierarki panel dan tabel, bukan template. Logo, ilustrasi truk, modul ERP dan komposisi persis referensi tidak disalin.

Mode antislop: `during`, dipilih pengguna pada sesi ini. Arah Ledger yang telah tercatat dipertahankan: putih hangat, graphite, teal tua. ENERGY 1 / RHYTHM 1 / MOTION 1. Pengulangan shell membantu orientasi; isi ruang kerja mengikuti keputusan masing-masing fungsi.

## Mulai meninjau

1. [Fondasi dan keputusan visual](00-foundation.md), termasuk token, struktur, komponen, aksesibilitas dan tema.
2. [Papan fondasi](boards/00-foundation.png), lalu [indeks visual seluruh fungsi](boards/00-contact-sheet.png).
3. [Daftar fungsi berurutan](01-function-index.md), dengan satu spesifikasi dan satu papan desktop per fungsi.
4. [Kontrak komponen dan keadaan layar](02-components-and-states.md).
5. [Pemetaan FR, TRK dan UAT](03-traceability.md).
6. [Pemeriksaan artefak dan Delivery Gate](review.md).

Papan SVG/PNG adalah desain statis. Bentuk tombol, field dan menu menjelaskan rancangan, bukan kontrol yang bisa digunakan. Perilaku setiap kontrol dijabarkan dalam spesifikasi. Tidak ada API, frontend baru, posting stok, kredensial, atau koneksi perangkat yang dibuat.

## Batas dan sumber

- [PRD induk](../../docs/planning/01-product-requirements.md): FR-01 sampai FR-16, UAT-01 sampai UAT-14, D01-D05.
- [TRD](../../docs/planning/02-technical-requirements.md): konfirmasi, transaksi atomik, versi, idempotensi dan ERP.
- [App Flow](../../docs/planning/03-app-flow.md) dan [Design Brief](../../docs/planning/04-design-brief.md): urutan tugas, hierarki dan pengecualian.
- [Backend Schema](../../docs/planning/05-backend-schema.md): dimensi posisi, saldo, alokasi dan sumber kuantitas.
- [Implementation Plan](../../docs/planning/06-implementation-plan.md): ketergantungan P1-P8, bukan jadwal.
- [PRD tracker](../../docs/planning/prd-tracker-barcode-rfid.md): TRK-01 sampai TRK-22, TRK-UAT-01 sampai TRK-UAT-22, T01-T08.
- [Arah desain](../../DESIGN.md) dan [kontrak komponen terdahulu](../components.md): palet Ledger, numerik dan bahasa operasional.

Keputusan D01-D05 dan T01-T08 tetap terbuka. Rancangan tidak menetapkan toleransi, metode SSO, level tracking, formula pembulatan, kapasitas, RPO/RTO, reader, atau aturan approval atas nama klien. Barcode tetap usulan MVP; RFID memerlukan keputusan dan pilot fisik. Kebutuhan akses backend, blind count dan konsistensi tidak dapat dibuktikan melalui gambar.

## Isi folder

`functions/` menyimpan 21 spesifikasi. `boards/` menyimpan papan vektor SVG dan render PNG: desktop, contoh handheld, tablet, tema gelap, keadaan gagal, dan indeks. `source/` berisi data desain serta generator artefak, tanpa dependensi aplikasi. `qa/` berisi hasil pemeriksaan dokumen dan geometri.

Komponen lintas fungsi dapat ditinjau pada [review sebelum konfirmasi](boards/00-confirmation-review.png) dan [keadaan layar](boards/00-states.png).

Paket ini menjadi acuan usulan desain terbaru. Katalog HTML/CSS/JS lama di folder induk tetap sebagai draf historis dan tidak diubah atau dianggap sesuai dengan papan baru ini.
