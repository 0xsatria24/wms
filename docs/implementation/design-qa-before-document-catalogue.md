# QA layout Stock position, sidebar, dan Items

Tanggal: 31 Oktober 2026. Cakupan hanya tiga perubahan dari screenshot pengguna, bukan pengesahan seluruh 21 fungsi. Baseline sebelumnya disimpan di `docs/implementation/design-qa-before-layout.md`.

final result: passed

## Sumber dan bukti

Sumber visual pengguna disalin tanpa perubahan ke `prototype/qa/layout-20261031/source-stock.png`, `source-sidebar.png`, dan `source-master.png`. Target perubahan: alignment stok, scrollbar sidebar tidak terlihat dengan menu tetap terjangkau, serta katalog Items menggantikan daftar kartu. Arah Clear Operations dan token dalam DESIGN.md dipertahankan. Screenshot lama adalah bukti masalah, bukan layout yang harus disalin kembali.

Seluruh bukti berikut berada di `prototype/qa/layout-20261031/`:

| Capture | Pixel | Viewport CSS dan keadaan |
|---|---|---|
| stock-before.png / master-before.png | 970×595 | Awal, English/terang; menu mobile terbuka pada capture stok. |
| stock-desktop.png / master-desktop.png | 1433×969 | 1448×1000, Main Warehouse, data API, English/terang. |
| stock-table-focus.png | 650×417 | Region tabel untuk membandingkan header, nilai dan kondisi. |
| sidebar-short.png | 1265×642 | 1280×650, Control terbuka, fokus keyboard akhir menu. |
| master-tablet.png | 885×962 | 900×1000, tabel dan toolbar. |
| master-phone.png / stock-phone.png / editor-phone.png | 375×812 | 390×844, record berlabel, dialog satu kolom. |
| master-dark-id.png | 1433×969 | 1448×1000, Bahasa Indonesia/gelap. |
| catalogue-10000-fixture.png | 1265×712 | Komponen dengan 10.000 item sintetis, tanpa penulisan database. |

Density browser sekitar 1. Permukaan screenshot lebih kecil daripada viewport CSS akibat chrome/scrollbar browser. Sumber pengguna berupa crop dengan skala tampilan berbeda. Karena ini koreksi dan redesign terarah, region/anatomi komponen dibandingkan secara semantik, bukan klaim kecocokan pixel seluruh frame. Source dan hasil stok, master, serta sidebar telah dibuka bersama dalam input perbandingan yang sama. Region tabel juga diperiksa tersendiri.

## Temuan dan perbandingan ulang

1. **P2, header/nilai stok tidak satu sumbu.** Lima kolom setelah Item kini center pada header dan isi; nama barang tetap kiri. Lebar kolom dibatasi. Computed style menghasilkan center pada kelima kolom, dan capture terfokus menunjukkan nilai tepat di bawah header.
2. **P2, scrollbar sidebar mengurangi ruang.** Accordion native memakai satu grup terbuka. Scrollbar visual disembunyikan untuk Chromium/Firefox; overflow vertikal tetap dapat dipakai. Pada tinggi 650px, fokus keyboard mencapai akhir menu, scrollTop≈102.67, scrollbarWidth=none, dan tepat satu grup terbuka. Footer tetap terjangkau; tidak ada menu dihapus.
3. **P2, kartu Items memanjang tanpa batas.** Diganti katalog tabel dengan search nama/SKU/barcode, filter status/kategori, sort, jumlah hasil dan halaman 10/25/50 baris. Tambah/edit memakai dialog terpisah sehingga daftar menjadi fokus.
4. **P2, risiko draf hilang.** Escape/Cancel dengan perubahan meminta konfirmasi; Keep editing mempertahankan isian. Snapshot baru tidak mereset form hanya karena objek produk berubah. Save tanpa perubahan disabled, kegagalan simpan mempertahankan draf.

Perbandingan ulang tidak menemukan P0/P1/P2 tersisa dalam cakupan tiga perubahan ini. Komposisi baru Items memang berbeda dari screenshot lama sesuai permintaan pengguna. Field, izin peran, barcode nol depan dan aturan stok dipertahankan.

## Lima permukaan fidelity

- **Tipografi:** Source Sans 3 lokal dan hierarki operasional dipertahankan. Header stok dua baris terbaca; kode tetap string.
- **Spacing/layout:** padding, tabel dan dialog konsisten. Tidak ada horizontal page overflow pada lebar 390/900/1448. Dialog ponsel ≈342.67px pada viewport 390 dan dapat discroll.
- **Warna/token:** peran warna Clear Operations tetap. Empat belas pasangan teks/background diperiksa ulang, semuanya ≥4.5:1; minimum 5.36:1. Ini pemeriksaan token, bukan sertifikasi seluruh aplikasi.
- **Aset:** ikon Phosphor bermakna cari/edit/halaman; tidak ada foto produk atau logo klien fiktif. Gambar produk tetap opsional.
- **Copy:** English dan Bahasa Indonesia diperiksa, termasuk label kosong/validasi. Fixture diberi label sintetis dan bukan data operasional.

## Interaksi yang diperiksa

- Search barcode nol depan, filter gabungan, reset, sort terbalik, page size dan empty state pada aplikasi.
- Pada fixture 10.000 item: Next menampilkan Page 2 of 1000 dan item 11; ukuran 50 menghasilkan 50 record; Tools+Inactive menghasilkan 1.000 hasil; Previous/Next bekerja setelah filter.
- Buka tambah/edit, validasi SKU duplikat, Escape, Keep editing, Discard, buka dialog hapus lalu Cancel.
- Submit editor positif pada fixture React dalam memori: dialog menutup dan perubahan tetap ada saat dibuka ulang. Tidak ada posting ke database untuk pengujian ini.
- Fokus keyboard terlihat; accordion dan akhir menu layar pendek dapat dijangkau. Tab Locations/Units tetap berfungsi. Tema gelap dan Bahasa Indonesia diperiksa.
- Log error aplikasi dan fixture diperiksa: tidak ada error tercatat dalam pemeriksaan ini.
- Build TypeScript/Vite, 3 tes katalog, 5 tes pending dan 4 tes packaging lulus. Backend tidak berubah; 39 tes backend sebelumnya bukan uji ulang pada revisi frontend ini.

## Batas dan P3

Pagination membatasi rendering atas master yang sudah dimuat dari snapshot API. Fixture membuktikan perilaku komponen terhadap 10.000 item, bukan throughput database atau efisiensi payload. Pagination/pencarian server dan pemuatan detail perlu dikembangkan untuk volume produksi jauh lebih besar. UAT, reader/scanner, IdP/ERP dan audit semua 21 layar tetap di luar cakupan.

P3: filter kategori/sort ponsel dapat menjadi panel opsional jika operator memerlukan tabel lebih dekat ke atas layar. Kontrol saat ini tetap terlihat dan dapat digunakan.
