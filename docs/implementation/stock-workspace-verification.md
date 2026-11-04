# Verifikasi implementasi ruang kerja stok

Tanggal: 4 November 2026. Branch: `codex/stock-workspace`. Acuan: PRD dan spesifikasi desain 4 November 2026. Implementasi dilakukan dalam worktree terpisah dari checkout pengguna yang memiliki pekerjaan lain.

## Hasil

- Posisi stok membuka panel aksi; desktop mempertahankan tabel, layar sempit memakai subview penuh.
- Receipt manual beberapa baris, resolver/tambah/proposal barang, QC, penempatan, relokasi dan tahapan order terhubung memakai identitas server.
- Katalog efektif, bulk action, ekspor, tanggal dokumen, aturan reviewer, ledger, audit/outbox dan pemulihan request asli dipertahankan.
- Draf berversi dimiliki pengguna/gudang. Posting menautkan draf tersimpan ke hasil dalam transaksi yang sama. Draf selesai dibuka sebagai hasil; relokasi dengan referensi sama tidak bisa diposting lagi.
- Ledger seluruh filter dipisah per satuan; riwayat saldo nol, paging ERP/kemasan, role per gudang, penyimpanan label/followup dan pilihan sumber retur diperbaiki.

## Bukti otomatis

| Pemeriksaan | Hasil |
|---|---|
| Suite backend PostgreSQL/HTTP/domain | **162/162 lulus**, `.runtime/verified-backend-suite.log`, TRX `backend/Wms.Tests/TestResults/stock-workspace-verified.trx` |
| Tambahan lookup ambigu dan regresi draf/proposal setelah suite lengkap | **8/8 lulus**, `.runtime/lookup-green.log` |
| Seluruh tes frontend | **81/81 lulus**, `.runtime/verified-frontend-suite.log` |
| Build seluruh solusi .NET | Lulus, 0 warning/0 error, `.runtime/verified-backend-build.log` |
| Build produksi frontend | Lulus; peringatan ukuran chunk dan anotasi SignalR tetap tercatat, `.runtime/verified-frontend-build.log` |
| Impeccable pada UI yang berubah | `[]`, `.runtime/impeccable-final.json` |

Test baru mereproduksi kegagalan sebelum perbaikan: command belum tersedia; deactivation menelantarkan pekerjaan; agregat satu halaman; ERP/kemasan terpotong; role campuran; satuan kg menjadi units; kode SKU/barcode ambigu; respons draf terlambat; dan draf relokasi selesai dapat diulang. Satu test bulk status lama memakai barang berstok sebagai fixture nonaktif; fixture diganti barang kosong sesuai kebijakan PRD, dengan assertion versi/nama/barcode/satuan tetap dipertahankan.

Run lengkap awal mencatat 157 lulus dan satu assertion kebijakan lama tersebut, lalu timeout saat teardown. Setelah fixture diperbaiki, run lengkap dengan batas inactivity yang mencakup cleanup database selesai normal: 162/162 lulus. Bukan kegagalan yang disembunyikan dengan menghapus test.

## Pemeriksaan browser lokal

CUA memakai Vite `http://127.0.0.1:4185/` dan API preview `5180`, dengan database demo khusus `wms_workflow_preview_*`; tidak menggunakan database kerja. API berjalan dari salinan runtime agar tidak mengunci build.

- Receipt 30 → child QC yang tepat; QC 20+5 diblokir, 24/6 diterima; putaway 20 lalu 4 selesai; relokasi 5 mempertahankan total gudang.
- Tambah NEW-KG dari receipt mempertahankan sumber dan aktual 0,5; master tidak menambah stok. Setelah reload penuh, draf kembali dengan sumber, scan dan 0,5 kg; review menampilkan 0.5 kg dan posting menghasilkan child QC sendiri.
- Draf relokasi disimpan, dikonfirmasi, lalu dibuka kembali sebagai hasil tercatat tanpa aksi posting ulang.
- Desktop tabel/panel, mobile 390px, dark mode, Bahasa Indonesia, focus trap Tab/Shift+Tab dan Escape diuji. Fokus kembali ke pemicu; footer berada di dalam viewport (bottom828 pada tinggi844), lebar dokumen375 pada viewport390.
- Pemeriksaan pendukung mencakup akses read-only, pemilihan kemasan, ledger, kasus ERP dan pending; label history benar-benar tersimpan. Transport download label dan pencetakan fisik tidak dibuktikan oleh browser ini.

Bukti gambar: [panel desktop](../../artifacts/stock-workspace-20261104/desktop-stock-panel.png) dan [form mobile gelap](../../artifacts/stock-workspace-20261104/mobile-dark-receipt.png). Salinan lokal juga tersedia di `D:/Projects/inventory management system/artifacts/stock-workspace-20261104/`.

## Cakupan kriteria penerimaan

| AC | Bukti yang relevan |
|---|---|
| 01–07 | StockWorkspace, WorkflowService, StockWorkspaceTests, WorkflowWorkspaceTests, WorkflowReviewTests; penerimaan/master dari browser |
| 08–13 | Alur 30→24/6→20+4→relokasi; klasifikasi/presisi/source eligibility dan lineage pada tes domain serta browser |
| 14–18 | Idempotency, pending ownership/recovery dan scoped draft tests; reload draf nyata; guard respons simpan dan draf selesai |
| 19–23 | Revise/resubmit, reviewer policy, atomic multi-bin, shortage, short pick/cancellation/return dan deactivation pada suite domain/HTTP |
| 24–28 | SupportingWorkspaceTests, support-workflows/catalogue-reads/pending tests, pemeriksaan pendukung di browser |
| 29 | Aturan observasi RFID tetap terpisah dari writer stok; regresi existing lulus; perangkat fisik belum diuji |
| 30–31 | Pemeriksaan mobile/keyboard/tema dan pembatalan read usang; tes model dan catalogue reads |
| 32–33 | Sumber retur/remaining dan warehouse scope; blind-count tests pada workflow, snapshot dan ekspor |
| 34 | Receipt manual menyimpan sourceType sendiri; outbox/retry tidak memposting ulang. Rekonsiliasi otomatis ke PO tidak ditambahkan tanpa kebijakan ERP |
| 35–36 | State empty/draft/review/confirmed/unknown berbeda; rute lama memakai katalog yang dipertahankan, bookmark reload diuji, tabel tetap terpasang saat panel dibuka |

## Review dan batas

Satu review independen atas patch beku menemukan empat masalah: ambiguitas kode, respons simpan terlambat, paging proposal, dan replay draf relokasi. Keempatnya diperbaiki dengan regresi. Pengecekan lanjutan memastikan kandidat ambigu juga tersedia saat barang dipilih dari master, bukan hanya saat pencarian diketik.

Ini bukti implementasi lokal, bukan UAT/produksi atau validasi scanner/RFID/SSO/ERP klien. Draf server tersedia; persistence draf offline dengan retensi perangkat belum diaktifkan karena kebijakannya belum ditetapkan. Pending transaksi yang sudah ada tetap memakai IndexedDB dan identitas request asli. Lot/serial dan rekonsiliasi pembelian tidak ditambahkan.

Writer baru dapat dijeda dengan `Workflow:Enabled=false`; transaksi yang sudah tercatat tidak dihapus. Branch disimpan untuk review, tanpa push/deploy atau penggabungan ke checkout yang memiliki perubahan lain.
