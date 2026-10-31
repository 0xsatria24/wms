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

Tema terang/gelap memakai peran warna yang sama. Panel16 dan kontrol8 mengikuti token Clear Operations; biru menandai aksi, cyan menandai pilihan. Aturan horizontal dan angka tabular membantu membandingkan stok. Tata letak berubah dari tabel/detail, menjadi panel bertumpuk, lalu record berlabel pada ponsel. Antrean tugas pada ponsel memakai selector berlabel. Animasi hanya umpan balik kontrol.

Item master menyediakan **Delete item / Hapus barang** bagi admin dan supervisor. Pengguna meninjau nama/SKU dan mengisi alasan sebelum mengonfirmasi. Server menolak penghapusan barang yang mempunyai posisi stok, dokumen, kemasan atau riwayat label di gudang mana pun. Catatan audit penghapusan tetap disimpan. Gunakan status nonaktif untuk barang yang sudah digunakan.

`npm run test:pending` menguji kode antrean dan retry menggunakan fake-indexeddb dan server tiruan pada Node24. Uji ini memeriksa identitas, scope, versi, key, respons hilang, kegagalan server, akses dicabut serta pemulihan CSRF. Browser, perangkat fisik dan pemasangan PWA tetap memerlukan pemeriksaan tersendiri. Pengguna memilih penyelesaian kode dengan batas verifikasi pada 31 Oktober 2026; hasil visual akhir belum disahkan. Lihat [status verifikasi](../docs/implementation/verification.md).

Tren SKU-A adalah fixture historis sampai 28 Oktober 2026; belum merupakan KPI perusahaan atau agregasi pengiriman produksi. Semua data pilot diberi label simulasi. Sumber kebutuhan tetap memiliki keputusan D01–D05/T01–T08 yang belum ditutup.
