# Product Requirements Document

Inventory + Warehouse Management System

ID: INV-WMS-PRD-001. Versi draf: 0.2. Tanggal: 28 Oktober 2026.

Dasar: [arsitektur INV-WMS-ARCH-001 revisi 1.0](../architecture/arsitektur-inventory-wms.pdf). Dokumen ini belum mendapat persetujuan klien. Skenario dan angka contoh adalah kriteria uji atau ilustrasi, bukan data operasional.

Acuan proses: **Software Requirements Engineering**, mengacu pada ISO/IEC/IEEE 29148:2018. Peninjauan mencakup sumber, kejelasan, batasan, konsistensi dan kriteria penerimaan kebutuhan. Penerapan proyek dijelaskan pada [acuan proses rekayasa](engineering-basis.md); status kesesuaian formal belum dinilai.

## Tujuan produk

Sistem membantu perusahaan mengetahui barang apa yang dikuasai, jumlahnya, lokasi dan kondisinya, komitmennya terhadap pesanan, serta dokumen yang menyebabkan perubahan tersebut. Operator mencatat kejadian fisik; backend mengesahkan perubahan; supervisor menangani persetujuan dan selisih.

Hasil yang ingin dibuktikan adalah saldo yang dapat direkonsiliasi dengan mutasi, reservasi yang tidak menggunakan stok yang sama dua kali, dan riwayat yang dapat ditelusuri sampai dokumen sumber. Target kecepatan dan kapasitas belum ditetapkan.

## Pengguna dan pekerjaan

Peran berikut merupakan usulan pembagian tugas. Satu orang dapat memegang beberapa peran sesuai D03, dengan pembatasan pembuat dan penyetuju pada tindakan yang mensyaratkannya.

| Peran | Pekerjaan utama | Informasi yang diperlukan |
|---|---|---|
| Operator receiving | Menerima, scan, mencatat aktual dan selisih | Dokumen sumber, sisa, satuan, kondisi awal, area receiving |
| Petugas QC | Memeriksa dan menetapkan kondisi barang | Barang yang ditahan, jumlah inspeksi, hasil dan bukti |
| Operator gudang | Putaway, picking, packing, transfer | Tugas, barang, lokasi asal/tujuan, jumlah aktual |
| Peminta internal | Membuat dan memantau permintaan barang | Sisa permintaan, approval, pemenuhan dan kekurangan |
| Supervisor | Melepas pekerjaan, menyetujui koreksi, meninjau selisih | Alasan, bukti, dampak stok, transaksi terkait |
| Administrator | Mengatur master, akses, dan pemetaan integrasi | Perusahaan, gudang, pengguna, konfigurasi dan audit |
| Auditor / tim kontrol | Menelusuri dan merekonsiliasi persediaan | Kartu stok, dokumen, audit dan jejak batch/serial |
| Petugas integrasi / operasi | Menangani antrean gagal dan pemulihan | Event, versi, percobaan, respons, bukti rekonsiliasi |

## Cakupan dan tahapan

F1 membangun fondasi stok dan akses. F2 menambahkan pekerjaan gudang. F3 menyelesaikan integrasi dan kesiapan operasi. Pembagian ini mengikuti tahap pada PDF; kontrol idempotensi, audit, dan outbox dibangun sejak F1 agar F2 tidak bergantung pada fondasi sementara.

| ID | Kebutuhan | Tahap utama | Hasil yang harus dapat dibuktikan |
|---|---|---|---|
| FR-01 | Master barang, barcode, satuan, gudang dan lokasi | F1 | Kode unik dalam lingkup yang benar; barang nonaktif tidak dipakai untuk dokumen baru |
| FR-02 | Posisi stok, buku mutasi, saldo awal dan rekonsiliasi | F1 | Saldo awal berasal dari transaksi terotorisasi; saldo cocok dengan penjumlahan entri |
| FR-03 | Reservasi dan ketersediaan | F1 | Komitmen tidak melampaui fisik; stok tidak layak atau di lokasi yang diblokir tidak dialokasikan |
| FR-04 | Identitas, akses perusahaan/gudang, approval dan audit | F1 | Backend memeriksa baca maupun mutasi; persetujuan dan alasannya tercatat |
| FR-05 | Penerimaan terhadap PO atau transfer | F2 | Stok bertambah sesuai aktual; penerimaan sebagian menyisakan jumlah terbuka |
| FR-06 | QC dan penempatan | F2 | Barang karantina tidak dialokasikan; perubahan kondisi dan lokasi tercatat |
| FR-07 | Order, picking, packing dan pengiriman | F2 | Barang keluar saat pengiriman dikonfirmasi; short pick memakai jumlah aktual |
| FR-08 | Pembatalan dan pengembalian hasil picking | F2 | Komitmen baru bebas setelah pengembalian fisik yang diperlukan dikonfirmasi |
| FR-09 | Transfer lokasi dan antar gudang | F2 | Asal, perjalanan, tujuan dan selisih tidak menghitung barang dua kali |
| FR-10 | Retur pelanggan dan supplier | F2 | Retur terhubung dokumen asal dan kondisi; retur masuk diperiksa sebelum layak |
| FR-11 | Stock opname | F2 | Ada batas hitung, penahanan pergerakan, blind count dan persetujuan selisih |
| FR-12 | Integrasi ERP | F3 | ID tetap, deduplikasi, urutan versi, retry dan rekonsiliasi terlihat |
| FR-13 | Pelaporan dan ketertelusuran | F3 | Pengguna dapat menelusuri saldo ke mutasi, sumber, batch/serial dan waktu pembaruan |
| FR-14 | Scanner dengan koneksi terputus | F2 | Scan lokal berstatus pending; server memvalidasi ulang sebelum mengesahkan stok |
| FR-15 | Ketahanan permintaan dan transaksi atomik | F1 | Retry tidak menggandakan transaksi; gagal sebelum commit tidak meninggalkan pembaruan parsial |
| FR-16 | Monitoring, backup dan pemulihan | F3 | Masalah dapat ditindaklanjuti; restore dan rekonsiliasi dibuktikan sesuai target yang disepakati |

Valuasi persediaan, invoice dan jurnal keuangan tetap berada pada ERP dalam rancangan ini. Operasi offline penuh, transfer antar perusahaan, otoritas stok konsinyasi/3PL, optimasi rute, wave picking, cross-docking, serta replenishment otomatis memerlukan penetapan cakupan tambahan. Tidak ada komitmen fitur tersebut pada draf ini.

## Rincian tracker barcode dan RFID

Rincian kebutuhan scan tersedia pada [PRD Tracker Barang Masuk dan Keluar (Barcode / RFID)](prd-tracker-barcode-rfid.md). TRK-01 sampai TRK-22 menurunkan kebutuhan terkait identitas, receiving, outbound, transfer, retur, opname, pending dan audit. Barcode merupakan usulan MVP dan RFID merupakan opsi pilot yang belum dipilih; keduanya menggunakan Inventory Core serta ledger yang sama. T01 sampai T08 pada dokumen tersebut memperinci keputusan D01-D05 tanpa mengubah statusnya menjadi disetujui.

## Aturan bisnis lintas modul

1. Setiap perubahan stok memiliki dokumen atau tindakan sumber, pelaku, waktu dan alasan yang dapat ditelusuri.
2. Posisi stok membedakan perusahaan, pemilik, barang, lokasi, kondisi, dan batch/serial jika diwajibkan. Detail kebijakan mengikuti D01 dan D02.
3. Reservasi menambah komitmen dan mengurangi stok bebas. Reservasi tidak mengurangi jumlah fisik.
4. Picking memindahkan barang ke staging/packing. Komitmen tetap mengikuti barang sampai pengiriman atau pengembalian yang sah.
5. Barang karantina, rusak, ditolak, kedaluwarsa menurut kebijakan, atau berada pada lokasi yang ditahan tidak boleh menjadi alokasi baru.
6. Perubahan kondisi pada barang yang sudah direservasi menahan pemenuhan terkait. Cara mengalihkan atau melepaskan reservasi ditetapkan melalui D02; sistem tidak meneruskan pengiriman diam-diam.
7. Dokumen yang sudah dibukukan dikoreksi dengan pembalikan atau penyesuaian yang memiliki referensi. Sistem tidak menimpa riwayat agar cocok dengan angka terbaru.
8. Jumlah disimpan dalam satuan dasar dengan faktor konversi yang berlaku saat transaksi. Perubahan master tidak mengubah riwayat.
9. Status dokumen, kondisi barang, status reservasi dan status sinkronisasi disimpan sebagai konsep terpisah.
10. ERP yang sedang gagal tidak membatalkan kejadian fisik yang sudah sah dicatat di WMS. Hasil integrasi tetap harus terlihat dan direkonsiliasi.

## Kebutuhan nonfungsional dan bukti

| Area | Kebutuhan | Bukti penerimaan yang direncanakan |
|---|---|---|
| Konsistensi | Seluruh dampak satu perintah stok tersimpan bersama atau batal bersama | Pemeriksaan saldo, entri, reservasi, dokumen, audit dan outbox dalam uji kegagalan |
| Akses | Identitas dan akses perusahaan/gudang berlaku pada setiap endpoint dan berkas bukti | Uji API langsung dengan akses sah dan akses yang ditolak |
| Ketertelusuran | Mutasi terhubung sumber; koreksi menyimpan hubungan ke transaksi asal | Penelusuran dua arah dari dokumen ke mutasi dan sebaliknya |
| Kinerja | Ukur waktu respons, konflik dan antrean pada beban yang disepakati | Profil beban dari D01; ambang dan lingkungan uji dari D05 |
| Pemulihan | Pemulihan database, bukti dan integrasi memiliki prosedur yang konsisten | Latihan restore dengan pengukuran kehilangan data dan waktu pulih |
| Kemudahan kerja | Operator memahami aktual, sisa, pending dan konflik | Uji tugas receiving/picking pada perangkat dan scanner yang dipilih |

Nilai pengguna bersamaan, transaksi per detik, latensi, retensi, RPO dan RTO belum diketahui. Tim tidak boleh mengubah kolom kosong tersebut menjadi janji layanan tanpa keputusan D01/D05.

## Matriks penerimaan

Semua skenario berstatus **Belum dijalankan**. Data berikut merupakan data uji yang direncanakan. Hasil lulus memerlukan bukti implementasi dan pemeriksaan data, bukan hanya demonstrasi tampilan.

| ID | Skenario dan hasil yang diwajibkan | Kebutuhan | Bukti yang harus dikumpulkan |
|---|---|---|---|
| UAT-01 | Dua operator memesan stok terakhir bersamaan; total komitmen tidak melebihi fisik layak | FR-03, FR-15 | Permintaan paralel, hasil tiap permintaan, saldo dan total reservasi |
| UAT-02 | PO uji 100 diterima 60 lalu 40; sisa dan stok benar pada setiap langkah | FR-05, FR-02 | Dua penerimaan, sisa per baris, entri dan saldo akhir |
| UAT-03 | Stok direservasi lalu dikarantina; picking dan shipment terkait ditahan sampai penyelesaian sah | FR-03, FR-06, FR-07 | Riwayat kondisi, reservasi tertahan, penolakan aksi dan penyelesaiannya |
| UAT-04 | Picking uji 10 hanya menemukan 8; aktual 8 dan sisa 2 tetap terbuka | FR-07, FR-03 | Tugas, perpindahan, komitmen dan sisa order |
| UAT-05 | Order dibatalkan setelah picking; barang dan komitmen terlacak sampai kembali | FR-08 | Pembatalan, tugas kembali, mutasi dan pelepasan komitmen |
| UAT-06 | Transfer uji mengirim 50, menerima 48; sisa 2 tetap dalam perjalanan | FR-09 | Saldo asal/perjalanan/tujuan dan dokumen selisih |
| UAT-07 | Opname uji saldo 30 dan fisik 28; penyesuaian -2 hanya setelah validasi dan approval | FR-11, FR-04 | Bukti freeze, hitung, approval, entri dan penolakan perpindahan |
| UAT-08 | ID dan payload sama mengembalikan transaksi sama; payload berbeda dengan ID lama ditolak | FR-15 | Request/response, identitas transaksi dan jumlah entri |
| UAT-09 | Proses gagal sebelum commit; semua perubahan terkait batal dan event tidak terbit | FR-15, FR-02 | Titik kegagalan, pemeriksaan seluruh dampak dan outbox |
| UAT-10 | Commit berhasil tetapi respons hilang; retry mengembalikan hasil tersimpan | FR-15 | Simulasi respons putus, hasil retry dan satu set mutasi |
| UAT-11 | ERP gagal, event berulang dan urutan terbalik; hasil tidak ganda dan versi terjaga | FR-12 | Log antrean, inbox/outbox, hasil ERP dan rekonsiliasi |
| UAT-12 | Scanner offline; scan tetap pending dan konflik terbaru divalidasi saat tersambung | FR-14, FR-15 | Antrean lokal, perubahan dari perangkat lain dan hasil validasi ulang |
| UAT-13 | Akun tanpa akses gudang mencoba baca/mutasi lewat API langsung; backend menolak | FR-04 | Matriks akses, request/response dan audit penolakan yang relevan |
| UAT-14 | Restore database dan bukti; saldo konsisten dan replay ERP tidak menggandakan hasil | FR-16, FR-12 | Log restore, pengukuran RPO/RTO aktual dan rekonsiliasi sebelum replay |

## Register keputusan

Semua baris berstatus **Terbuka**. Peran pengambil keputusan di bawah adalah usulan fungsi, bukan penunjukan orang. Nilai final, tanggal persetujuan dan nama penanggung jawab belum diisi.

| ID | Keputusan yang diperlukan | Informasi yang harus tersedia | Dampak jika belum diputuskan | Fungsi yang perlu meninjau |
|---|---|---|---|---|
| D01 | Skala dan model operasi | Perusahaan, pemilik stok, gudang/lokasi, pengguna, volume puncak, jam operasi, retensi dan saldo awal | Dimensi stok, migrasi dan profil beban belum dapat difinalkan | Pemilik proses gudang dan pemilik produk |
| D02 | Aturan persediaan | Batch/serial, expiry, FIFO/FEFO, satuan/pembulatan, toleransi, QC, short pick dan karantina reservasi | Alokasi, kondisi, validasi scanner dan pengecualian belum final | Operasi gudang dan QC |
| D03 | Approval dan akses | Peran, lingkup gudang, tindakan yang perlu approval, pemisahan pembuat/penyetuju, SSO | Matriks izin dan kebijakan posting belum dapat difinalkan | Pemilik proses dan pengelola identitas |
| D04 | Kontrak ERP | ERP tujuan, pemilik data, ID sumber, pemetaan, versi, ack, deduplikasi, rekonsiliasi | Integrasi ujung ke ujung belum dapat diterima | Pemilik ERP dan tim integrasi |
| D05 | Kontinuitas layanan | Perangkat/scanner, kebutuhan offline, hosting, target respons, RPO/RTO, backup dan operasi | Desain pending, sizing dan rencana pemulihan belum dapat diterima | Operasi IT dan pemilik layanan |

Keputusan tambahan yang baru diusulkan dicatat pada dokumen terkait. Bahasa backend, framework, versi komponen, dan infrastruktur belum menjadi keputusan final.

## Syarat penyelesaian tahap perencanaan

Pemilik produk meninjau cakupan dan pengecualian; pemilik proses meninjau flow serta D01-D03; tim teknis meninjau TRD dan schema; pemilik ERP/operasi meninjau D04-D05. Catat keputusan yang diperlukan untuk paket pertama sebelum memfinalkan backlog implementasinya. UAT tetap belum dijalankan sampai aplikasi dan lingkungan pengujian tersedia.
