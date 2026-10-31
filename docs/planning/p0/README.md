# Pelaksanaan P0: kebutuhan dan keputusan fondasi

Tanggal: 28 Oktober 2026. Status: **Berjalan; keputusan operasional belum lengkap**.

P0 dijalankan berdasarkan [Implementation Plan](../06-implementation-plan.md). Pekerjaan memakai [acuan proses rekayasa](../engineering-basis.md): ISO/IEC/IEEE 29148:2018 untuk kebutuhan dan ISO/IEC/IEEE 15288:2023 untuk proses sistem. Keduanya sudah menjadi acuan kerja atas permintaan pengguna; penerapan formal terhadap seluruh klausul belum dinilai.

## Hasil yang sudah tersedia

| Keluaran P0 | Status | Hasil / batas |
|---|---|---|
| Acuan proses rekayasa | Tersedia | Dua acuan ditambahkan dan dihubungkan ke enam dokumen |
| Peninjauan awal cakupan | Tersedia sebagai draf | FR-01 sampai FR-16, pengecualian dan UAT sudah diperiksa; persetujuan operasional belum tersedia |
| Register D01-D05 | Terbuka | Kategori keputusan dan dampak tersedia; nilai klien dan penanggung jawab belum diberikan |
| Stack dan versi | Belum final | PostgreSQL dan backend modular menjadi dasar rancangan; bahasa/framework, versi dan lingkungan belum dipilih |
| Perangkat dan lingkungan uji | Belum ditetapkan | Scanner, sistem login, ERP dan kebutuhan offline belum dikonfirmasi |
| Backlog paket pertama | Tersedia sebagai draf | [Backlog P1](backlog-p1.md) merinci prasyarat dan kriteria penerimaan |
| Persetujuan fondasi untuk coding | Belum tersedia | P0 belum memenuhi syarat selesai; P1 belum dimulai |

## Dasar peninjauan

Arsitektur menetapkan satu pusat transaksi stok, PostgreSQL, reservasi dan mutasi atomik, idempotensi, audit serta outbox/inbox. Alur mencakup receiving/QC, outbound, transfer, retur dan opname. Keputusan tersebut tersedia sebagai rancangan; belum ada bukti aplikasi atau persetujuan detail operasional klien.

Pemisahan yang harus dipertahankan saat memfinalkan kebutuhan: stok fisik berbeda dari komitmen; picking berbeda dari shipment; hasil lokal berbeda dari sinkronisasi ERP; scan belum terkirim berbeda dari konfirmasi yang responsnya hilang.

## Data yang diperlukan untuk menutup keputusan

| ID | Fakta yang masih diperlukan | Dampak pada fondasi |
|---|---|---|
| D01 | Jenis usaha/barang, jumlah perusahaan/gudang, pemilik stok, lingkup pilot, volume dan asal saldo awal | Batas perusahaan/pemilik, master, migrasi dan profil beban |
| D02 | Tracking per barang, batch/serial/expiry, satuan dan presisi, konversi, QC, toleransi serta aturan alokasi | Validasi input, posisi stok, konversi dan alokasi |
| D03 | Peran, lingkup gudang, tindakan yang perlu approval, pembuat/penyetuju serta identitas/SSO | Autentikasi, izin, status dokumen dan kebijakan posting |
| D04 | ERP yang dipakai, pemilik kontrak, ID dokumen/event, versi, ack dan rekonsiliasi | Adapter, kepemilikan data dan lingkungan integrasi |
| D05 | Hosting, scanner/browser, kebutuhan offline, target respons, RPO/RTO dan penanggung jawab operasi | Lingkungan pengembangan/uji dan batas layanan |

Jawaban yang belum tersedia tetap dicatat **belum diketahui**. Belum ada ERP yang disebut tidak berarti klien tidak memakai ERP. Tidak adanya jawaban offline juga tidak dianggap persetujuan operasi online saja.

## Temuan peninjauan kebutuhan

| Temuan | Tindakan yang diperlukan | Status |
|---|---|---|
| FR-01 mencakup beberapa master dengan aturan unik berbeda | Turunkan menjadi kriteria barang, satuan, barcode, gudang dan lokasi pada backlog P1 | Draf tersedia |
| FR-04 menggabungkan identitas, akses, approval dan audit | Bedakan tindakan baca/mutasi, lingkup objek dan kebijakan approval; konfirmasikan peran pada D03 | Menunggu D03 |
| Presisi/satuan dan kebijakan batch/serial belum ditetapkan | Tentukan data representatif dan aturan validasi sebelum migrasi final | Menunggu D02 |
| Profil beban dan ambang layanan belum diketahui | Siapkan bentuk profil; jangan menetapkan angka kapasitas atau kinerja sebagai fakta | Menunggu D01/D05 |
| UAT tingkat sistem belum mencakup setiap aturan master | Tambahkan kriteria rinci pada backlog tanpa mengubah UAT menjadi hasil tes | Draf tersedia |
| Kontrak ERP dan perangkat belum tersedia | Tetapkan kebutuhan antarmuka dan pihak peninjau sebelum pekerjaan yang bergantung padanya | Menunggu D04/D05 |

Peninjauan ini memeriksa isi dokumen dan keterkaitan keputusan. Nilai kejelasan/kelengkapan final memerlukan peninjauan pemilik proses atas fakta operasionalnya.

## Pemilihan stack dan versi

P0 perlu menetapkan bahasa/framework backend, pustaka transaksi/migrasi, frontend, versi PostgreSQL dan cara menjalankan lingkungan uji. Kriteria seleksi: dukungan desimal, transaksi dan lock eksplisit, migrasi, integrasi identitas, pengujian PostgreSQL nyata, kemampuan pemeliharaan tim dan lingkungan perusahaan.

Belum ada bahasa/framework atau versi baru yang diputuskan pada catatan ini. Pemilihan harus menghasilkan alasan, versi yang dipakai sebagai acuan, sumber dokumentasi resmi dan bukti kompatibilitas yang akan dijalankan pada P1. PostgreSQL uji tidak diganti database in-memory untuk membuktikan konkurensi P2.

## Aturan keputusan dan perubahan

Setiap keputusan mencatat ID, fakta sumber, pilihan, alasan, dampak, status, tanggal dan penanggung jawab yang benar-benar menyetujuinya. Perubahan setelah kebutuhan disetujui menautkan kebutuhan, dokumen, backlog dan pengujian yang terdampak.

Pengguna telah meminta P0 dijalankan dan dua acuan rekayasa ditambahkan. Permintaan itu mengizinkan penyiapan P0; permintaan tersebut belum memberikan nilai operasional D01-D05 atau menggantikan peninjauan pemilik proses.

## Syarat P0 selesai

1. Lingkup fondasi dan pengecualiannya disetujui; sumber kebutuhan dan pemilik keputusan tercatat.
2. Bagian D01-D03 yang memengaruhi schema, satuan, identitas dan akses ditetapkan.
3. Stack, versi dan lingkungan uji paket pertama dipilih dengan alasan.
4. Ketergantungan D04/D05, pihak peninjau dan pekerjaan yang belum boleh diasumsikan teridentifikasi.
5. Backlog P1 memakai keputusan tersebut dan memiliki kriteria penerimaan yang dapat dijalankan.

P0 masih berjalan. Keluaran dokumen yang tersedia dapat ditinjau sekarang; keputusan yang belum diberikan tetap terbuka.
