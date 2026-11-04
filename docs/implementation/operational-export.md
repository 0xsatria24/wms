# Export operasional

## Template dokumen v2, 5 November 2026

Perbaikan presentasi menggunakan generator C# yang sama: PDF A4 dengan judul bisnis, konteks dokumen, tabel barang/kuantitas, detail referensi dua kolom, area pengesahan bila disediakan sumber, informasi audit ringkas dan footer bernomor halaman. Header tabel diulang pada halaman lanjutan; baris biasa dijaga utuh. Metadata kosong tidak memenuhi halaman. Nama perusahaan kosong memakai identitas produk, tanpa mengarang nama klien. Waktu berlabel UTC tetap UTC; waktu operasional ditampilkan dengan offset zona gudang. Identifier dan teks sumber tidak diterjemahkan sebagai status.

XLSX membuka Data lebih dahulu: judul, gudang, waktu snapshot, header tabel, filter dan freeze pane. Metadata tetap lengkap pada sheet terpisah. Header, warna baris, lebar kolom, perataan, format angka dan pengaturan cetak dibentuk lewat styles.xml. Identifier/nol awal dan nilai berpresisi tinggi tetap teks; kuantitas aman tetap numeric. CSV dan kontrak izin/evidence tidak berubah. Versi template pada file dan audit ekspor dinaikkan ke 2.

Verifikasi lokal: 10 tes writer dan 4 tes integrasi ekspor/evidence lulus. PDF penerimaan, berita acara, lembar hitung dan packing dirender; uji panjang 100 baris menghasilkan 9 halaman lengkap. XLSX stok dan opname dibuka dengan parser independen serta dirender untuk meninjau styling. Parser memverifikasi nol awal, angka numeric, nilai presisi tinggi, text formula inert, filter dan susunan sheet. Renderer spreadsheet dapat mengoersi tampilan string numerik pada preview; sumber XLSX diverifikasi terpisah dengan openpyxl dan tes XML.

API preview dimuat ulang; PDF penerimaan manual dan XLSX stok berhasil diunduh melalui endpoint aplikasi. Contoh lokal berada pada `output/export-preview/`; contoh fixture berlabel Data simulasi. Ini bukan UAT, verifikasi printer fisik atau deployment produksi.

## Akses UI, 5 November 2026

Dokumen PRD dan rencana ekspor disalin dari checkout proyek sebelumnya agar tersedia bersama implementasi ruang kerja stok ini. Ketentuan format, izin, sumber transaksi dan proteksi blind count tetap berlaku.

| Fungsi | Akses ekspor |
|---|---|
| Posisi stok | Toolbar atas, di samping Terima barang. Semua hasil filter lintas halaman atau SKU yang dicentang; XLSX/CSV. |
| Kartu stok | Ekspor yang sudah ada; XLSX/CSV sesuai filter dan periode. |
| Opname | Toolbar di atas ruang kerja opname. XLSX tinjauan tersedia untuk reviewer berwenang; pilih tugas untuk lembar hitung atau PDF berita acara setelah disetujui/disesuaikan atau ditutup. |
| Packing/pengiriman | Buka dokumen, lalu Ekspor di awal panel samping. Rencana packing terpisah dari bukti transaksi pengiriman aktual. |
| Penerimaan | Buka PO atau baris penerimaan manual, lalu Ekspor di awal panel samping. Bukti transaksi dan rekap tetap dibedakan. |
| Transfer/retur | Pilih dokumen yang relevan; Ekspor di atas form. Bukti transaksi tercatat dan rekap mengikuti jenis dokumen. |

Terima barang dan Buka draf saya kini satu toolbar; tab Semua penerimaan/PO sejajar dan tidak lagi menjadi baris aksi terpisah. Tombol draf tetap terpasang saat panel terbuka untuk mempertahankan pemulihan fokus.

Verifikasi lokal perubahan ini: typecheck/build produksi lulus; 17 tes ekspor, pengelompokan stok dan antrean lulus; pemeriksaan whitespace lulus. Browser memverifikasi toolbar desktop dan lebar 390px, dialog stock XLSX/CSV lintas halaman, dialog XLSX tinjauan opname, serta unduhan PDF penerimaan manual berhasil. PDF berita acara/transfer/retur dan bukti pengiriman tidak diunduh ulang pada pemeriksaan UI ini; aturan backend tidak diubah. Ini bukan verifikasi produksi atau UAT.

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
