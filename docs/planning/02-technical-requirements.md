# Technical Requirements Document

ID: INV-WMS-TRD-001. Versi draf: 0.2. Tanggal: 28 Oktober 2026.

Dokumen ini menjabarkan [PRD](01-product-requirements.md). Seluruh kontrak berikut adalah usulan implementasi. Aplikasi, endpoint dan worker belum tersedia.

Acuan proses: **Software Architecture & System Engineering**, mengacu pada ISO/IEC/IEEE 15288:2023. Setiap keputusan teknis perlu memiliki kebutuhan asal, alasan, dampak integrasi dan cara verifikasi. Lihat [acuan proses rekayasa](engineering-basis.md) untuk penerapan dan statusnya pada proyek.

## Komponen dan batas tanggung jawab

Backend menggunakan modular monolith sesuai arsitektur awal. API dan worker dapat menjadi proses terpisah dari codebase yang sama. Modul operasional meminta Inventory Core mengesahkan perubahan stok.

| Komponen | Tanggung jawab | Larangan / batas |
|---|---|---|
| Web admin/supervisor | Dokumen, tugas, approval, penelusuran dan pengecualian | Tidak mengesahkan perubahan saldo sendiri |
| Aplikasi scanner | Menangkap scan dan aktual, menyimpan pending ketika koneksi hilang | Tidak menyatakan stok berhasil berubah sebelum respons server |
| Backend API | Identitas, lingkup akses, validasi kontrak dan perintah bisnis | Tidak mempercayai perusahaan/gudang yang dikirim klien tanpa pemeriksaan |
| Modul M01-M05 | Master, inbound, outbound, transfer/retur dan opname | Tidak memperbarui saldo di luar Inventory Core |
| Inventory Core / M06 | Saldo, entri, reservasi, perubahan lokasi/kondisi dan rekonsiliasi | Tidak memanggil ERP di dalam transaksi stok |
| PostgreSQL utama | Transaksi dan data yang mengesahkan keputusan stok | Replica/model laporan tidak mengotorisasi pengeluaran |
| Integrasi / M07 | Inbox, outbox, retry, urutan versi dan rekonsiliasi | Ack transport tidak dianggap bukti final bisnis tanpa kontrak D04 |
| Pelaporan / M08 | Kartu stok, riwayat, traceability dan ekspor | Menampilkan waktu pembaruan jika datanya tertunda |
| Penyimpanan bukti | Foto/dokumen dengan metadata dan akses terbatas | Upload file tidak menjadi bukti transaksi stok telah commit |

Identitas, otorisasi, approval dan audit berlaku lintas modul. ID modul M01-M08 mengikuti PDF arsitektur.

## Pilihan teknologi dan statusnya

PostgreSQL dan backend modular merupakan dasar rancangan yang dibawa dari arsitektur. React + TypeScript adalah usulan web dari pembahasan awal. Bahasa/framework backend, pustaka database, sistem antrean, penyedia SSO, object storage, versi komponen dan hosting belum ditetapkan.

Sebelum menetapkan stack, tim harus memastikan dukungan transaksi eksplisit, penguncian baris, desimal, migrasi, pengujian PostgreSQL nyata dan integrasi identitas. Pilihan mengikuti kemampuan tim serta lingkungan perusahaan. Dokumen ini tidak menetapkan benchmark atau spesifikasi server.

## Kontrak data lintas API

| Elemen | Usulan kontrak |
|---|---|
| ID objek | ID internal stabil; nomor dokumen yang dibaca manusia disimpan terpisah |
| Jumlah | String desimal di JSON, dikonversi menjadi tipe desimal backend; tidak memakai aritmetika floating point untuk stok |
| Satuan | `input_qty`, `input_uom_id`, faktor konversi tersimpan dan `base_qty`; aturan presisi/pembulatan mengikuti D02 |
| Waktu | Waktu server menjadi `posted_at`; waktu kejadian fisik `occurred_at` disimpan terpisah dengan zona/offset |
| Versi | Perintah pada objek yang berubah membawa `expected_version`; perintah tertinggal meminta refresh |
| Penelusuran | `request_id` untuk satu percobaan jaringan; `Idempotency-Key` untuk satu maksud bisnis yang dapat diulang |
| Lingkup | Identitas autentik menentukan akses; backend memeriksa perusahaan, gudang, dokumen dan referensi terkait |
| Pagination | Daftar besar memakai urutan stabil dan cursor; ukuran halaman dibatasi pada implementasi |
| Error | Kode mesin stabil, pesan yang dapat ditindaklanjuti, field terkait dan `request_id`; tidak membocorkan detail internal |

## Satu perintah, satu transaksi stok

Rancangan urutan pemrosesan untuk FR-02, FR-03 dan FR-15:

1. Autentikasi dan periksa akses saat ini, termasuk sebelum mengembalikan hasil retry.
2. Mulai transaksi database; klaim identitas permintaan yang unik.
3. Jika identitas pernah berhasil dengan isi yang sama, kembalikan hasil tersimpan tanpa posting ulang. Jika isinya berbeda, tolak.
4. Kunci lingkup lokasi, dokumen dan posisi stok yang diperlukan dalam urutan konsisten. Validasi ulang status, akses terkait, kondisi, sisa, versi dan kuantitas setelah lock.
5. Ubah dokumen, entri, saldo, reservasi, tugas yang terkait, audit bisnis, outbox dan hasil idempotensi dalam transaksi yang sama.
6. Commit; baru kemudian kirim hasil berhasil. Worker hanya mengambil event yang telah commit.

Pemeriksaan akses yang ditolak dapat dicatat dalam log keamanan terpisah. Audit keberhasilan bisnis harus commit bersama perintahnya. Penolakan bisnis dan error infrastruktur tidak boleh meninggalkan dampak stok parsial.

`SELECT ... FOR UPDATE` merupakan pilihan untuk penguncian baris. PostgreSQL dapat mendeteksi deadlock; implementasi memerlukan urutan lock dan retry transaksi yang terbatas. Dasar perilakunya dijelaskan dalam [dokumentasi penguncian PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).

Urutan yang diusulkan: klaim idempotensi, lokasi berurutan ID, dokumen berurutan jenis/ID, saldo berurutan ID, lalu reservasi/tugas berurutan ID. Semua perintah yang bertemu, termasuk opname, harus mengikuti protokol yang sama. Validasi ulang pemetaan sumber/tujuan jika data berubah saat menunggu. Tim harus menguji urutan ini pada PostgreSQL nyata; diagram tidak membuktikan bebas deadlock.

Opname memakai status freeze yang disimpan, bukan transaksi database panjang selama operator menghitung. Setiap perpindahan memeriksa status tersebut di bawah lock lingkup lokasi yang sama. Penetapan freeze menunggu transaksi terdahulu selesai; perpindahan berikutnya ditolak sampai lokasi dibuka melalui tindakan sah.

## Idempotensi dan pemrosesan berulang

Usulan lingkup kunci HTTP adalah perusahaan + principal terautentikasi + jenis perintah + kunci. Hash mencakup ID target dan seluruh isi bisnis yang dinormalisasi, termasuk versi. ID jaringan, tracing dan waktu penerimaan tidak masuk hash. Kunci baru hanya dibuat untuk maksud bisnis baru.

| Kejadian | Perilaku yang direncanakan |
|---|---|
| Kunci/isi sama, hasil sudah commit | Kembalikan ID transaksi dan hasil tersimpan yang sama |
| Kunci sama, isi berbeda | `409 IDEMPOTENCY_KEY_REUSED`; tidak ada perubahan stok |
| Dua request identik bersamaan | Salah satu memproses; request lain menunggu hasil atau mendapat status retry yang jelas |
| Proses mati sebelum commit | Tidak ada hasil sukses tersimpan; percobaan ulang boleh memproses dari awal |
| Commit berhasil, respons putus | Retry dengan kunci dan payload asli menemukan hasil tersimpan |
| Validasi bisnis gagal | Tidak ada posting; usulan menyimpan hasil terminal yang deterministik. Koreksi isi memakai maksud/kunci baru |
| Timeout/deadlock/kegagalan sementara | Rollback; retry terbatas memakai kunci yang sama. Batas percobaan mengikuti D05 |

Ketika hasil belum pasti, klien mempertahankan payload dan kunci asli. Klien tidak otomatis mengubah versi atau jumlah saat retry. Konflik yang sudah pasti dapat ditinjau pengguna untuk membuat perintah baru.

Idempotensi transport tidak cukup untuk mencegah posting dokumen yang sama dari pengguna lain. Tambahkan constraint posting berdasarkan sumber dan tindakan, jumlah kumulatif per baris, serta identitas scan/konfirmasi yang stabil bila diperlukan. Retensi kunci mengikuti D01/D05; pembersihan tidak boleh membuka posting ganda dokumen lama.

## API tindakan bisnis

Nama path dan kode respons di bawah merupakan usulan, belum menjadi API yang diimplementasikan. Seluruh tindakan mengikuti kontrol akses dan idempotensi di atas.

| Perintah usulan | Validasi penting | Dampak utama |
|---|---|---|
| `POST /receipts/{id}/confirm` | Sisa sumber, toleransi, aktual, satuan, batch/serial | Receiving bertambah; sisa sumber berkurang sebesar aktual |
| `POST /quality-inspections/{id}/complete` | Jumlah inspeksi, kondisi, keputusan dan kewenangan | Perpindahan kondisi; reservasi terdampak ditahan |
| `POST /warehouse-tasks/{id}/confirm-putaway` | Barang, jumlah dan lokasi tujuan hasil scan | Stok berpindah dari receiving ke lokasi terkonfirmasi |
| `POST /outbound-orders/{id}/release` | Order lengkap dan approval yang diwajibkan | Order siap dialokasikan; belum mengubah fisik |
| `POST /outbound-orders/{id}/reserve` | Stok layak dan jumlah order yang masih terbuka | Komitmen bertambah secara atomik |
| `POST /warehouse-tasks/{id}/confirm-pick` | Reservasi, scan lokasi/barang, aktual dan kondisi terbaru | Barang dan komitmen berpindah ke staging; sisa tetap terlacak |
| `POST /shipments/{id}/confirm` | Isi packing, komitmen, kondisi terbaru dan sisa order | Fisik keluar; komitmen pemenuhan selesai |
| `POST /outbound-orders/{id}/request-cancel` | Keadaan picking/shipment dan kewenangan | Lepas bagian yang belum dipicking atau buat pekerjaan kembali |
| `POST /warehouse-tasks/{id}/confirm-return` | Barang benar-benar kembali ke lokasi sah | Perpindahan balik dan pelepasan komitmen yang terkait |
| `POST /transfers/{id}/dispatch` | Asal, aktual dan sisa transfer | Asal berkurang; perjalanan bertambah |
| `POST /transfers/{id}/receive` | Dokumen perjalanan dan jumlah yang belum diterima | Perjalanan berkurang; tujuan bertambah sebesar aktual |
| `POST /returns/{id}/confirm-receipt` | Retur pelanggan, sumber dan kondisi awal | Barang masuk pemeriksaan; belum otomatis layak |
| `POST /returns/{id}/confirm-dispatch` | Retur supplier, aktual dan otorisasi | Stok keluar saat pengiriman retur sah |
| `POST /stock-counts/{id}/freeze` | Cakupan hitung dan tugas terkait | Bekukan cakupan dan simpan snapshot batas hitung |
| `POST /stock-counts/{id}/submit` | Blind count dan satuan yang sah | Hasil hitung masuk peninjauan; saldo belum berubah |
| `POST /stock-counts/{id}/approve-adjustment` | Freeze masih sah, bukti, approval dan versi | Penyesuaian dibukukan satu kali |
| `GET /inventory/availability` | Akses perusahaan/gudang dan dimensi pencarian | Ketersediaan dari sumber transaksi utama |
| `GET /inventory/movements` | Akses sumber dan pagination | Riwayat beserta dokumen dan pelaku yang diizinkan |

`200/201` digunakan untuk hasil bisnis tersimpan sesuai kontrak endpoint; `202` hanya untuk pekerjaan yang memang belum selesai, dengan status yang dapat dipantau. `401` untuk identitas tidak sah, `403` untuk kewenangan ditolak, `409` untuk konflik versi/status/idempotensi, `422` untuk data bisnis tidak valid dan `503` untuk kegagalan layanan sementara. Kebijakan mengembalikan `404` agar tidak membocorkan keberadaan objek harus ditetapkan konsisten. Respons `202` atau HTTP sukses bukan alasan menampilkan pengiriman selesai sebelum hasil bisnisnya selesai.

## Integrasi ERP

Rancangan memakai outbox untuk menyimpan maksud pengiriman bersama transaksi bisnis, lalu worker mengirimkannya setelah commit. Penerima perlu mengenali event berulang. Pola dan risiko pengiriman ganda dijelaskan dalam [AWS Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

| Bagian kontrak | Isi yang perlu disepakati pada D04 |
|---|---|
| Identitas | `event_id`, sistem sumber, perusahaan, jenis/ID objek dan nomor dokumen eksternal |
| Urutan | Versi per objek; event independen tidak wajib mengikuti satu urutan global |
| Isi | Versi schema payload, jenis kejadian, waktu posting, baris dan jumlah satuan dasar |
| Pengakuan | Bedakan pesan diterima, diproses, ditolak dan hasil akhir bisnis |
| Deduplikasi | Unik sistem sumber + perusahaan + event; ID sumber dokumen melindungi duplikasi dengan ID event baru |
| Retry | ID event tetap, riwayat percobaan, penundaan terbatas dan antrean tindakan manual |
| Rekonsiliasi | Bandingkan dokumen/baris, jumlah dan versi; catat keputusan atas konflik |

Inbox dan perubahan bisnis yang dihasilkan harus commit bersama. Event dengan versi yang memiliki celah ditahan untuk rekonsiliasi; event lama tidak boleh menimpa state baru. Worker memakai klaim dengan masa berlaku agar pekerjaan dapat diambil ulang setelah crash, tanpa mengubah ID event.

ERP yang tidak mendukung deduplikasi memerlukan adapter dan pemeriksaan hasil berdasarkan ID bisnis sebelum retry. Rancangan tidak menjanjikan tepat satu dampak di ERP sampai kontrak dan UAT-11 membuktikannya. Setelah restore, worker outbound ditahan sampai rekonsiliasi dengan ERP selesai.

## Keamanan dan bukti

Backend memeriksa peran, perusahaan, gudang dan transisi dokumen. Akses daftar, detail, ekspor, endpoint scan, attachment dan status retry tunduk pada lingkup yang sama. Identitas integrasi diberi akses sesuai perannya. Kebijakan pembuat/penyetuju dan identitas SSO diputuskan pada D03.

Bukti disimpan melalui metadata upload terpisah. Jika bukti wajib, perintah memeriksa bahwa upload tersedia, dimiliki lingkup yang benar dan telah melewati pemeriksaan yang dipilih. Transaksi stok menyimpan referensi bukti tersebut. Upload yatim dibersihkan melalui pekerjaan terpisah; kegagalan upload tidak disamarkan sebagai transaksi berhasil.

Log operasional tidak menyimpan token atau kredensial. Audit bisnis menyimpan pelaku, tindakan, sumber, alasan, request dan hubungan koreksi. Kebutuhan retensi serta perlindungan audit dari perubahan administratif mengikuti D01/D05.

## Operasi, pemulihan dan verifikasi

Pantau backlog dan umur event tertua, integrasi gagal, konflik stok, hasil rekonsiliasi, tugas tertahan, status pending scanner, serta hasil backup/restore. Ambang alert dan penanggung jawab harus disepakati; angka belum tersedia.

Backup mencakup database, bukti, konfigurasi yang dibutuhkan dan prosedur pemulihan identitas/rahasia. Standby membantu ketersediaan tetapi tidak menggantikan backup. Latihan restore membuktikan saldo, dokumen, bukti dan status integrasi pada titik pemulihan, lalu mengukur RPO/RTO aktual terhadap D05.

Pengujian PostgreSQL nyata wajib untuk persaingan reservasi, rollback, unique constraint, perpindahan komitmen dan freeze opname. Pengujian antarmuka scanner dan integrasi ERP memakai perangkat/lingkungan representatif. Seluruhnya masih rencana pengujian; hasilnya dicatat pada Implementation Plan setelah dijalankan.
