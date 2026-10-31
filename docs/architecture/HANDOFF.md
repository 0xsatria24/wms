# Handoff: Inventory Management System

Tanggal handoff: 28 Oktober 2026.

## Tujuan dan batas proyek

Pengguna memisahkan pekerjaan inventory management system dari proyek CCTV.
Chat ini merupakan kelanjutan melalui ringkasan, bukan salinan seluruh riwayat chat asal.
Folder proyek ini adalah workspace inventory. Jangan menambahkan folder CCTV sebagai
sumber proyek, membaca kode CCTV, atau menjadikan generator dokumen bergantung pada
folder CCTV. Berkas di bawah `docs/architecture/` sudah disalin agar mandiri.

Pengguna belum meminta implementasi aplikasi. Hasil pekerjaan sejauh ini berupa
rancangan sistem dan dokumen PDF untuk klien. Jangan memulai implementasi, deployment,
commit, push, atau perubahan PDF tanpa permintaan lanjutan.

## Permintaan dan preferensi pengguna

- Sistem enterprise untuk pencatatan barang masuk, barang keluar, serta operasional gudang.
- Penjelasan teknis harus mudah dipahami klien, tetap konkret dan cukup detail.
- Dokumen harus profesional, bukan kumpulan slide dengan judul promosi atau kartu berulang.
- Pengguna secara eksplisit meminta antislop core dan antislop-ui, lalu memilih mode `during`.
- Jika mengubah PDF, gunakan skill PDF, render halaman dan periksa visual; jangan hanya
  mengandalkan ekstraksi teks atau pemeriksaan geometris.
- Skenario harus menjelaskan hasil yang wajib terjamin dan cara membuktikannya.
- Data ilustrasi tidak boleh disajikan sebagai hasil operasional aktual.

## Berkas yang tersedia

- `arsitektur-inventory-wms.pdf`: versi formal terbaru, 13 halaman A4 dengan orientasi campuran.
- `source/build_inventory_architecture_formal.py`: generator aktif dokumen formal.
- `source/build_inventory_architecture_detail.py`: generator versi detail sebelumnya;
  generator formal membaca literal daftar skenario dari file ini melalui AST tanpa menjalankannya.
- `source/build_inventory_architecture.py`: generator versi ringkas sebelumnya; arsip source.
- `source/antislop-review.md`: pemeriksaan antislop untuk artefak dokumen, bukan pengujian aplikasi.
- `source/validation.json`: hasil pemeriksaan struktural PDF; path disesuaikan ke salinan proyek ini.

Semua path pada daftar tersebut relatif terhadap direktori `docs/architecture/`.
Generator aktif menggunakan BASE relatif dari lokasi source. Font Windows yang dipakai
adalah Arial regular/bold. ReportLab dan pypdf diperlukan; gunakan tool pemuatan
workspace dependencies untuk menemukan runtime Python dan Poppler yang tersedia.
Jika PDF perlu dibangun ulang, jalankan generator formal, bukan generator versi ringkas.

## Rancangan yang telah dibahas

### Arsitektur

Backend modular monolith dengan satu pusat transaksi stok (Inventory Core) dan
PostgreSQL sebagai database transaksi utama. Web admin/supervisor, scanner operator,
serta permintaan internal mengakses backend API. Validasi identitas, akses gudang,
status dokumen, dan ID permintaan dilakukan di backend.

Modul penerimaan/QC, pengeluaran/tugas, transfer/retur, dan stock opname meminta
Inventory Core mengesahkan perubahan stok. Modul operasional tidak mengubah saldo
secara langsung. Pelaporan dapat memakai model baca yang sedikit tertunda, tetapi
alokasi/pengeluaran harus memakai database utama.

ERP mengelola master bisnis, PO, sales order, invoice dan nilai persediaan. WMS
mengelola posisi/kondisi/jumlah fisik, reservasi, tugas operator, penerimaan, dan
pengiriman. Worker memproses outbox, retry, deduplikasi dan rekonsiliasi. Dokumen
masuk dari ERP tetap mengikuti validasi API.

### Aturan data dan transaksi

- Bedakan dokumen, posisi stok, buku mutasi, saldo terkini, dan reservasi.
- Posisi stok dibedakan menurut perusahaan/pemilik, barang, lokasi, kondisi,
  serta batch atau serial sesuai kebutuhan.
- Saldo harus cocok dengan mutasi pada dimensi yang sama; komitmen harus cocok
  dengan reservasi aktif dan tidak menggandakan ketersediaan.
- Saldo, mutasi, reservasi, perubahan dokumen, audit, outbox dan hasil permintaan
  terkait disimpan dalam satu transaksi database.
- Lock baris dan validasi saldo terbaru mencegah alokasi stok yang sama oleh
  beberapa operator. Constraint unik melindungi identitas posisi dan transaksi.
- ID permintaan dan isi sama mengembalikan hasil terdahulu. ID sama dengan isi
  berbeda ditolak tanpa perubahan stok.
- Jumlah memakai desimal dan satuan dasar. Faktor konversi saat transaksi tetap
  tercatat sehingga perubahan master satuan tidak mengubah riwayat.
- Koreksi transaksi yang sudah dibukukan dilakukan melalui pembalikan/penyesuaian
  yang dapat ditelusuri; keputusan mengikuti kejadian fisik dan otorisasi.
- Status dokumen, kondisi barang, reservasi dan sinkronisasi tidak dicampur.

### Alur operasional

Penerimaan: acuan PO/transfer, scan aktual, validasi terhadap sisa dan toleransi,
konfirmasi penerimaan di receiving, QC, lalu penempatan dan konfirmasi lokasi.
Karantina tidak tersedia untuk alokasi. Penerimaan sebagian menyisakan kuantitas
yang belum diterima pada dokumen sumber.

Pengeluaran: order dan persetujuan, cek stok layak, reservasi atomik, picking aktual,
packing/verifikasi, lalu konfirmasi pengiriman. Reservasi mengurangi stok bebas,
bukan fisik. Picking memindahkan lokasi; komitmen mengikuti barang di area packing.
Short pick memakai jumlah aktual dan menyisakan order yang belum terpenuhi.
Pembatalan setelah picking memerlukan konfirmasi barang kembali; setelah dikirim
mengikuti proses retur.

Transfer: gudang asal berkurang ketika dikirim, lokasi virtual perjalanan bertambah,
lalu tujuan bertambah sebesar penerimaan aktual. Selisih tetap terlacak sampai
diselesaikan. Contoh 50 dikirim dan 48 diterima menyisakan 2 dalam perjalanan.

Retur pelanggan diterima pada area pemeriksaan; retur supplier mengurangi stok
ketika pengiriman dikonfirmasi. Batch/serial dan dokumen asal tetap terhubung.

Opname awal dirancang dengan batas waktu/lokasi hitung dan penahanan perpindahan
terkait, blind count, hitung ulang/tinjau selisih, approval penyesuaian, lalu buka
kembali lokasi. Penghitungan sambil barang bergerak membutuhkan cutoff dan
rekonsiliasi tambahan.

### Integrasi dan operasi

Outbox disimpan bersama transaksi. ID event tetap dan pencatatan ID yang sudah
diproses pada penerima mencegah duplikat. Versi objek menjaga urutan event yang
saling bergantung. Kegagalan harus terlihat, dapat dicoba ulang dan direkonsiliasi.

Scanner offline hanya menyimpan scan pending; konfirmasi menunggu server dan
validasi kondisi terkini. Operasi offline penuh membutuhkan rancangan tersendiri.
SSO, otorisasi per peran/perusahaan/gudang, approval dan audit diterapkan lintas modul.
Monitoring meliputi antrean tertunda, integrasi gagal, konflik, selisih dan tugas terbuka.
Standby/replikasi tidak menggantikan backup. RPO/RTO harus disepakati; restore
mencakup database/bukti serta rekonsiliasi ERP sebelum replay event ber-ID tetap.

## Dokumen formal terbaru

Nomor dokumen: INV-WMS-ARCH-001. Revisi: 1.0. Tanggal pada dokumen: 27 Oktober 2026.
Status: usulan untuk ditinjau. Jangan mengubah tanggal/revisi hanya karena handoff.

Susunan 13 halaman:

1. Sampul, informasi dokumen, daftar isi interaktif.
2. Ringkasan eksekutif, cakupan, prinsip dan asumsi.
3. Arsitektur logis dan legenda konektor sinkron/asinkron.
4. Modul M01-M08 dan batas tanggung jawab.
5. Model data, ilustrasi saldo tersedia, pemisahan status.
6. Penerimaan dengan keputusan validasi dan kualitas.
7. Pengeluaran dengan keputusan ketersediaan dan pengecualian.
8. Sequence transaksi, idempotensi, lock dan contoh API.
9. Transfer, retur, stock opname.
10. Kontrak ERP, akses, monitoring dan operasional teknologi.
11. UAT-01 sampai UAT-07: penerimaan operasional.
12. UAT-08 sampai UAT-14: gangguan dan pemulihan.
13. Tahapan implementasi, D01-D05 keputusan terbuka, referensi teknis.

Pemeriksaan terakhir: 13 halaman (8 potret, 5 lanskap), 13 bookmark,
24 tujuan tautan internal diverifikasi, 3 tautan referensi eksternal,
0 blok teks bertumpuk. Semua halaman dirender dan diperiksa visual.
Rasio kontras teks minimum 6,25:1. Pemeriksaan ini menilai dokumen.

## Matriks penerimaan

UAT-01 permintaan stok bersamaan; UAT-02 penerimaan sebagian; UAT-03 stok menjadi
karantina; UAT-04 short pick; UAT-05 pembatalan setelah picking; UAT-06 selisih
transfer; UAT-07 penyesuaian opname. UAT-08 permintaan berulang; UAT-09 kegagalan
sebelum commit; UAT-10 respons hilang setelah commit; UAT-11 ERP tidak tersedia/event
berulang; UAT-12 scanner offline; UAT-13 akses gudang di luar kewenangan; UAT-14 restore.

Matriks tersebut adalah kriteria pengujian implementasi yang belum dilakukan,
bukan hasil tes aplikasi yang sudah ada. Aplikasi inventory belum dibuat di proyek ini.

## Keputusan yang masih terbuka

D01 skala/model operasi dan kepemilikan; D02 batch/serial, expiry, urutan pengambilan,
toleransi dan QC; D03 approval dan hak akses; D04 pemetaan/kontrak ERP; D05 offline,
target respons, RPO/RTO, backup dan tanggung jawab operasional. Jangan mengarang
identitas klien, jadwal, biaya, kapasitas, sertifikasi, atau hasil benchmark.

## Langkah awal chat penerus

Baca handoff dan periksa bahwa PDF serta source tersedia dalam proyek inventory.
Konfirmasikan konteks sudah tersedia dan tunggu permintaan pengguna berikutnya.
Tidak perlu membangun ulang PDF atau menjalankan generator saat sekadar memverifikasi handoff.
