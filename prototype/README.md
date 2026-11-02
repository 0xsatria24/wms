# Clear Operations application

Frontend React + TypeScript + Vite untuk pilot Inventory/WMS. API dan database berada di [backend](../backend/); [panduan implementasi](../docs/implementation/README.md) mencatat stack, perintah menjalankan dan batasnya.

Sumber visual aktif:

- [21 fungsi, komponen dan token](../design-system/redesign-2026-10-29-v2/complete-suite/README.md).
- [Autentikasi board05](../design-system/redesign-2026-10-29-v2/complete-suite/boards/05-components-responsive.png).
- [Stock position revisi individual](../design-system/redesign-2026-10-29-v2/revisions/01-stock-trends/stock-position-en.png).
- [App flow](../docs/planning/03-app-flow.md).

`npm run dev -- --host 127.0.0.1 --port 4173 --strictPort` mem-proxy `/api`, `/auth`, dan `/hubs` ke API pada 5080. `npm run build` menjalankan pemeriksaan TypeScript dan membuat bundle. `npm run typecheck` hanya memeriksa tipe. Akun demo hanya tersedia ketika API dijalankan dalam Development dengan `Development:EnableDemoAuth=true`.

Kode dikelompokkan menjadi shell dan akses, katalog/administrasi, posisi stok, transaksi operasional, serta kontrol/pelacakan. Kontrak API dan antrean IndexedDB ada di `src/api.ts`. `src/fixtures.ts` menyediakan nilai awal layar login dan helper tampilan; tidak memposting stok. Data workspace baru ditampilkan setelah snapshot API untuk pengguna/gudang tersebut berhasil dimuat.

Antrean menyimpan payload, versi dan ID asal sebelum pengiriman. Offline berarti belum dikirim; timeout berarti hasil belum pasti. Retry memakai maksud yang sama dan meminta pemeriksaan akses server. Keluar akun tidak mengirim pending milik pengguna sebelumnya. Draf formulir berada di tab; kebijakan retensi perangkat produksi masih terbuka.

Manifest dan service worker menyediakan fondasi cache aset PWA saat build produksi. API, sesi dan data gudang tidak masuk cache service worker. Pemasangan PWA dan mode offline pada perangkat fisik belum diverifikasi.

Source Sans 3 disimpan lokal. Ikon Phosphor Regular mengikuti bobot outline pada mockup; simbol kubus adalah ikon modul persediaan, bukan logo klien. Barcode Code 128 dibuat oleh JsBarcode dan merupakan kode internal, bukan GTIN resmi. Foto produk tetap opsional dan tidak diganti dengan gambar produk fiktif.

Tema terang/gelap memakai peran warna yang sama. Panel16 dan kontrol8 mengikuti token Clear Operations; biru menandai aksi, cyan menandai pilihan. Aturan horizontal dan angka tabular membantu membandingkan stok. Tata letak stok dan master berubah dari tabel/detail, menjadi panel bertumpuk, lalu record berlabel pada ponsel. Animasi hanya umpan balik kontrol.

Revisi 1 November: seluruh selector kartu dokumen pada Purchase orders, Quality inspection, Putaway, Orders, Reservations, Picking dan Shipping diganti katalog tabel mengikuti Item Master. `WorkQueue.tsx` memakai komponen `DataTable` serta toolbar/pagination katalog yang sama. Pencarian mencakup dokumen, nama barang, SKU dan sumber; filter status/barang, sort dan halaman10/25/50 membatasi daftar. Membuka dokumen memilih ID asal, memindahkan fokus ke detail di bawah tabel, dan tidak mengonfirmasi transaksi. Di ponsel tabel tetap mempunyai kolom dengan scroll horizontal lokal dan region berlabel yang dapat dioperasikan lewat keyboard. `npm run test:work-queue` menguji proyeksi, filter dan pagination; `/qa/work-queue-fixture.html` memeriksa tujuh workflow dengan data sintetis di memori, tanpa menulis API/database. Screenshot aplikasi juga memakai snapshot API lokal yang sudah ada. Item Master dan tabel stok tidak didesain ulang dalam revisi ini.

Revisi layout 31 Oktober: header dan isi kolom stok setelah Item rata tengah; nama barang tetap kiri. Sidebar menyembunyikan scrollbar visual dan membuka satu grup sekaligus, tanpa menghapus kemampuan scroll/keyboard. Tab Items kini tabel katalog dengan search nama/SKU/barcode, filter status/kategori, sort dan halaman10/25/50. Form tambah/edit berada dalam dialog dengan konfirmasi membuang draf. Query dan pagination membatasi rendering atas master dalam snapshot; belum merupakan pagination API.

`npm run test:catalogue` menguji hasil filter/sort/page menggunakan10.000item sintetis. Fixture browser lokal `/qa/catalogue-fixture.html` memakai komponen Master yang sama, data sintetis dalam memori, dan tidak menulis database; halaman ini tidak menjadi entry build produksi. Bukti desktop/tablet/ponsel dan laporan scoped berada di [design-qa.md](../design-qa.md).

Item master menyediakan **Delete item / Hapus barang** bagi admin dan supervisor. Pengguna meninjau nama/SKU dan mengisi alasan sebelum mengonfirmasi. Server menolak penghapusan barang yang mempunyai posisi stok, dokumen, kemasan atau riwayat label di gudang mana pun. Catatan audit penghapusan tetap disimpan. Gunakan status nonaktif untuk barang yang sudah digunakan.

Panel admin menyediakan **Add user / Tambah user** pada header dan **Delete user / Hapus user** pada setiap baris. User baru masuk ke Menunggu persetujuan tanpa akses gudang. Dialog hapus meminta alasan dan menjelaskan pencabutan akses serta penyimpanan riwayat. Penghapusan akun sendiri dan target di luar kewenangan admin ditolak server. Pilihan bahasa kini tertulis **Bahasa Indonesia**. Fitur ini tidak membuat akun/password pada provider SSO atau mengirim email.

`npm run test:pending` menguji kode antrean dan retry menggunakan fake-indexeddb dan server tiruan pada Node24. Uji ini memeriksa identitas, scope, versi, key, respons hilang, kegagalan server, akses dicabut serta pemulihan CSRF. Browser, perangkat fisik dan pemasangan PWA tetap memerlukan pemeriksaan tersendiri. Pengguna memilih penyelesaian kode dengan batas verifikasi pada 31 Oktober 2026; hasil visual akhir belum disahkan. Lihat [status verifikasi](../docs/implementation/verification.md).

Tren SKU-A adalah fixture historis sampai 28 Oktober 2026; belum merupakan KPI perusahaan atau agregasi pengiriman produksi. Semua data pilot diberi label simulasi. Sumber kebutuhan tetap memiliki keputusan D01–D05/T01–T08 yang belum ditutup.

Autocomplete, 1 November 2026: pencarian barang/dokumen, kategori, satuan, pilihan barang dan lokasi menggunakan nilai master/snapshot yang sudah tersedia. Panah atas/bawah dan Enter memilih saran; Escape membatalkan pencarian pada pilihan master. Kategori dan satuan baru masuk saran setelah barang disimpan. Order baru mencari barang aktif lewat nama/SKU/barcode dan mengisi detail SKU, kategori, satuan dan barcode dari master. Pilihan yang belum cocok tidak boleh dikirim sebagai identitas barang. Scan aktual, hasil hitung dan konfirmasi tetap merupakan input eksplisit. `npm run test:autocomplete` menguji pencocokan, kode dengan nol awal, deduplikasi dan batas delapan saran. [Laporan dan bukti browser](../docs/implementation/autocomplete-verification.md) memakai fixture lokal `/qa/autocomplete-fixture.html` tanpa penulisan database.
