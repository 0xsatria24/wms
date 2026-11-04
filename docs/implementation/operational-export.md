# Export operasional

Implementasi mengikuti [PRD export](../planning/prd-export-operasional.md). Export tersedia pada halaman stok, kartu stok, opname, packing/pengiriman, penerimaan, transfer, dan retur, dengan tinjauan sebelum unduh. Stok mendukung pilihan halaman aktif dan seluruh hasil filter; kartu stok memakai seluruh hasil filter. XLSX mempertahankan tipe teks identifier; CSV perlu diimpor sebagai teks untuk mencegah deteksi tipe aplikasi spreadsheet.

API: `POST /api/workspaces/{warehouse}/exports`; daftar kejadian: `GET /api/workspaces/{warehouse}/export-events?documentId=...`. Sumber diambil ulang dalam snapshot database dengan izin gudang, versi sumber, proteksi blind count dan kebijakan reviewer. Bukti aktual memakai transaksi posting, bukan jumlah kumulatif. Rekap dan packing plan diberi label tersendiri.

`export-evidence` menghubungkan dokumen yang dibuat/diubah ke transaksi bisnis dalam commit yang sama. Retry bisnis tidak menambah bukti kedua. Data lama tanpa hubungan yang memadai ditolak untuk bukti final. `export-audit` tersimpan sebagai supporting record terpisah dan tidak menambah audit konfirmasi bisnis/outbox.

Format file dibentuk tanpa dependency NuGet tambahan. PDF menyematkan font TrueType: Arial Windows atau DejaVu pada image Linux; override tersedia melalui `WMS_EXPORT_FONT`. Image API memasang paket font. Export tidak mengimpor spreadsheet, mengirim ERP, atau mengonfirmasi transaksi stok. CSV mempertahankan nama kolom bisnis; metadata yang bertabrakan diberi awalan `ExportMetadata` agar actor/lokasi asli tidak tertimpa saat impor.

Pemeriksaan otomatis mencakup struktur file, keamanan text formula, identifier dan angka presisi tinggi, pagination PDF, scope stok lintas halaman, proteksi blind count, transaksi parsial, serta hubungan bukti dan idempotensi. Hasil aktual pemeriksaan dicatat setelah eksekusi; kriteria UAT pada PRD tetap membutuhkan pengujian operasional klien.

## Verifikasi lokal, 4 November 2026

- Typecheck dan build produksi frontend: lulus.
- Build Release backend dan 10/10 tes integrasi/encoder: lulus. TRX lokal: `.runtime/export-test-results/operational-export.trx`. Mencakup stok lintas halaman/pilihan, audit tanpa mutasi bisnis, blind count, pengiriman parsial, receive/transfer/retur, BA opname, evidence idempotent, dan format file.
- Uji download API frontend: 5/5 lulus, termasuk CSRF, pilihan eksplisit, penolakan akses, abort, dan pergantian konteks sebelum file diserahkan.
- Pemeriksaan whitespace pada perubahan integrasi: lulus.
- Pembacaan file dengan parser independen: PDF 5 halaman memuat seluruh 100 baris dan teks Unicode; workbook dibuka dengan openpyxl, identifier nol awal dan angka presisi tinggi utuh, delta negatif numeric, text formula tidak menjadi formula.
- Browser smoke: belum terverifikasi karena koneksi browser lokal ditolak/timeout; tidak ada screenshot atau keberhasilan UI yang diklaim. Laporan tersedia pada `prototype/qa/export-20261104/ui-smoke.json`.
- Tes backend memakai cluster sementara pada port 55439; tidak memakai data aplikasi utama.
- UAT klien, printer fisik, dan deployment produksi belum dijalankan.
