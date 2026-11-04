# Audit alur Inventory / WMS

Tanggal: 4 November 2026. Status: audit untuk perancangan, bukan hasil UAT atau sertifikasi aksesibilitas.

## Ringkasan

Sistem mempunyai kontrol stok yang perlu dipertahankan, tetapi penyajiannya masih mengharuskan pengguna memahami struktur modul dan mencari ulang dokumen. Kebutuhan yang baru dikonfirmasi, penerimaan manual tanpa PO, belum mempunyai jalur operasional. Identitas barang di Master belum dijembatani ke penerimaan, QC dan stok siap digunakan.

Pilihan pengguna: tindakan dimulai dari Posisi stok dan dikerjakan di panel samping, tabel tetap terlihat. Barang yang belum terdaftar harus dapat ditambahkan atau diajukan dari penerimaan yang sedang dikerjakan. Fungsi efektif tetap dipakai.

Rancangan tindak lanjut: [PRD](2026-11-04-stock-workspace-prd.md), [desain](../superpowers/specs/2026-11-04-stock-workspace-design.md), dan [papan desain](../../artifacts/ux-audit-20261104/design.html).

## Metode dan batas bukti

- Seluruh 21 rute fungsi pada `prototype/src/catalog.ts` serta Pengaturan dibuka pada aplikasi lokal `http://127.0.0.1:4173`, akun demo admin, Main Warehouse. Empat bagian Pengaturan turut diperiksa. Screenshot dan DOM disimpan dalam [folder bukti](../../artifacts/ux-audit-20261104/).
- Sebagian besar antrean transaksi lokal kosong. Temuan form berisi dan perhitungan kompleks diberi dasar source, bukan diklaim telah direproduksi dengan transaksi nyata.
- Fixture bulk selection yang memakai komponen aplikasi diperiksa untuk stok, order, pending dan ERP. Data fixture hanya di memori. Stok dan pending diperiksa pada viewport emulasi 390 × 844, termasuk tema gelap dan Bahasa Indonesia. Ini bukan pengujian perangkat fisik atau gerakan sentuh.
- Fixture `work-queue-fixture.html` gagal merender: `Operations` membutuhkan `user.warehouses`, sedangkan fixture lama hanya memberi id/role. Bukti kosong ditolak. Form penerimaan/QC/putaway berisi dinilai dari source; fixture tidak diperbaiki sebagai bagian audit ini.
- Penelusuran independen dilakukan untuk alur inti dan pendukung. Temuan source diperiksa silang terhadap komponen dan kontrak pemiliknya. Tidak ada konfirmasi transaksi, seed data, pengubahan akses, atau mutasi stok oleh audit.
- Screenshot pengguna tentang banner shortage berasal dari instalasi pada port 5444. Audit source saat ini tidak membuktikan paket tersebut identik dengan source atau bahwa bug navigasinya telah direproduksi pada paket itu.
- Pemindai Impeccable statis terhadap `prototype/src` menghasilkan `[]`, tersimpan di `impeccable-detector.json`. Hasil ini tidak mendeteksi masalah proses bisnis dan tidak membuktikan bebas cacat.

## Kesehatan implementasi

Verdict integritas: **belum memadai untuk perjalanan manual yang diminta**. Fondasi transaksi dan sistem visual cukup koheren; penghubung tugas, arti ringkasan dan umpan balik aksi perlu diperbaiki.

| Dimensi | Skor heuristik / 4 | Bukti dan batas |
|---|---:|---|
| Aksesibilitas | 2 | Label, fokus dan dialog native tersedia; region scroll tabel tidak seragam. Pembaca layar dan seluruh alur keyboard belum diuji. |
| Performa | 2 | Pagination tersedia; pencarian dapat memicu snapshot pada tiap perubahan. Tidak ada pengukuran latensi atau benchmark perangkat. |
| Tema | 3 | Token light/dark ada; sampel stok/pending gelap terbaca. Seluruh kombinasi state belum diperiksa. |
| Responsif | 2 | Sampel 390px memakai scroll tabel lokal; pola bergantung pada adanya checkbox dan tindakan jauh dari konteks. |
| Integritas perilaku | 2 | Kontrak stok kuat, tetapi jalur manual, revisi order, ringkasan ledger dan beberapa respons simpan bermasalah. |
| Total | **11/20** | Penilaian triase dengan cakupan terbatas, bukan ukuran kepatuhan atau kecepatan. |

Pasangan warna token yang dihitung: `#526176` pada putih 6,31:1; putih pada `#005fcc` 5,98:1; `#b8c8dc` pada `#1b2938` 8,68:1. Ketiganya melewati ambang 4,5:1 untuk teks normal. Ini hanya tiga pasangan token, bukan pemeriksaan kontras seluruh piksel, placeholder, fokus atau status.

## Cakupan layar dan keputusan

Kondisi menyatakan kesehatan perjalanan pada state yang diperiksa. Setiap berkas PNG mempunyai pasangan DOM `.txt`; fixture ditandai terpisah pada manifest.

| Langkah | Fungsi / bukti | Kondisi | Keputusan |
|---:|---|---|---|
| 1 | [Posisi stok](../../artifacts/ux-audit-20261104/01-stock.png) | Perlu perbaikan: kosong hanya menawarkan transfer | Pertahankan tabel berkelompok; tambah pintu penerimaan dan panel aksi |
| 2 | [Master barang](../../artifacts/ux-audit-20261104/02-master.png) | Katalog berjalan; tidak tersambung ke penerimaan | Pertahankan katalog; tambah quick create dan aksi Terima barang |
| 3 | [Penerimaan](../../artifacts/ux-audit-20261104/03-receiving.png) | Terblokir untuk sumber manual | Ganti pintu PO-only dengan penerimaan PO/manual |
| 4 | [QC](../../artifacts/ux-audit-20261104/04-quality.png) | Antrean kosong; prasyarat tidak cukup jelas | Masukkan ke perjalanan penerimaan yang sama |
| 5 | [Penempatan](../../artifacts/ux-audit-20261104/05-putaway.png) | Antrean kosong; konteks tugas terpisah | Subview tugas yang terkait penerimaan |
| 6 | [Order](../../artifacts/ux-audit-20261104/06-orders.png) | Pembuatan tersedia; detail terpisah jauh | Satu detail order dengan tahap berikutnya |
| 7 | [Reservasi](../../artifacts/ux-audit-20261104/07-reservations.png) | Prasyarat dilepas; label teknis | Tahap Alokasikan stok dalam order |
| 8 | [Pengambilan](../../artifacts/ux-audit-20261104/08-picking.png) | Memerlukan pencarian order ulang | Subview pengambilan dari order / tugas |
| 9 | [Pengiriman](../../artifacts/ux-audit-20261104/09-shipping.png) | Antrean kosong; alur keluar terpecah | Tetap konfirmasi fisik, di detail order yang sama |
| 10 | [Pembatalan](../../artifacts/ux-audit-20261104/10-cancellation.png) | Aturan pengembalian penting | Aksi kontekstual order dan tugas kembali ke rak |
| 11 | [Transfer](../../artifacts/ux-audit-20261104/11-transfers.png) | Masuk/keluar dibedakan | Pertahankan dokumen dan in-transit; mulai dari stok |
| 12 | [Retur](../../artifacts/ux-audit-20261104/12-returns.png) | Input sumber masih meminta identitas mentah | Pilih sumber sah dari dokumen / riwayat |
| 13 | [Opname](../../artifacts/ux-audit-20261104/13-count.png) | Pemisahan hitung/tinjau baik | Pertahankan blind count, freeze dan reviewer independen |
| 14 | [Pelacakan](../../artifacts/ux-audit-20261104/14-tracking.png) | Detail tidak muncul untuk barang tanpa stok | Gabungkan penyajian dengan detail stok / riwayat |
| 15 | [ERP](../../artifacts/ux-audit-20261104/15-integration.png) | Kosong; kasus lama berisiko tidak terjangkau | Pertahankan makna status/retry, tambah katalog lengkap |
| 16 | [Kartu stok](../../artifacts/ux-audit-20261104/16-movements.png) | Tersedia, scope total bermasalah di source | Pertahankan ledger; benarkan total dan link sumber |
| 17 | [Pending](../../artifacts/ux-audit-20261104/17-pending.png) | Makna offline/unknown benar; copy teknis | Pertahankan protokol, ganti ringkasan menjadi tindakan bisnis |
| 18 | [Monitoring](../../artifacts/ux-audit-20261104/18-monitoring.png) | Ringkasan berguna; tindak lanjut lepas dari kasus | Kaitkan catatan dan pemilik pada kasus asli |
| 19 | [Label/perangkat](../../artifacts/ux-audit-20261104/19-labels.png) | Label terlihat; fungsi setup bercampur | Label dari barang; kemasan dan perangkat punya detail tersendiri |
| 20 | [RFID](../../artifacts/ux-audit-20261104/20-rfid.png) | Terblokir tanpa dokumen, masih pilot | Pertahankan opsional; ikat sesi ke dokumen nyata |
| 21 | [Akses](../../artifacts/ux-audit-20261104/21-access.png) | Daftar/invitasi dipertahankan; role campuran rawan | Ubah editor grant per gudang, bukan wizard identitas |
| 22 | [Organisasi](../../artifacts/ux-audit-20261104/22-settings.png) | Jalur setup tersedia | Pertahankan di Pengaturan |
| 23 | [Lokasi](../../artifacts/ux-audit-20261104/23-location-settings.png) | Makna zona/freeze jelas di Pengaturan | Jadikan pengelolaan lokasi otoritatif di sini |
| 24 | [Aturan](../../artifacts/ux-audit-20261104/24-rules.png) | Aturan yang belum disepakati diungkapkan | Pertahankan, jangan menyulap keputusan terbuka menjadi pasti |
| 25 | [Persetujuan](../../artifacts/ux-audit-20261104/25-approvals.png) | Pemisahan pembuat/reviewer jelas | Pertahankan |
| 26 | [Preferensi](../../artifacts/ux-audit-20261104/26-personal.png) | Lingkup personal terpisah dari aturan gudang | Pertahankan |
| 27 | [Stok berisi, fixture](../../artifacts/ux-audit-20261104/27-fixture-stock.png) | Tabel, pengelompokan dan satuan berguna | Jadikan fondasi panel aksi |
| 28 | [Pending berisi, fixture](../../artifacts/ux-audit-20261104/28-fixture-pending.png) | Dua status benar, perintah internal belum ramah | Ringkas tujuan bisnis dan pemulihan aman |
| 29 | [ERP berisi, fixture](../../artifacts/ux-audit-20261104/29-fixture-integration.png) | Tiga lapis hasil terpisah | Pertahankan pemisahan |
| 30 | [Stok mobile light](../../artifacts/ux-audit-20261104/30-mobile-stock-light.png) | Scroll lokal; kolom kanan butuh geser | Detail aksi menjadi subview layar penuh di ponsel |
| 31 | [Stok mobile dark](../../artifacts/ux-audit-20261104/31-mobile-stock-dark.png) | Sampel tema konsisten | Pertahankan token |
| 32 | [Pending mobile dark](../../artifacts/ux-audit-20261104/32-mobile-pending-dark.png) | Pemulihan berada di kanan tabel | Aksi juga tersedia di detail permintaan |
| 33 | [Order berisi, fixture](../../artifacts/ux-audit-20261104/33-fixture-orders.png) | Detail dan aksi jauh di bawah katalog | Buka detail di panel dengan state dan peran jelas |

Login, aktivasi admin dan pemulihan akun tidak dieksekusi ulang sebagai alur end-to-end pada audit ini. Source-nya ditinjau untuk menentukan batas perubahan; alur tiga langkah admin dan undangan yang sudah disetujui tetap dipertahankan.

## Temuan prioritas

P0 = menghalangi kebutuhan utama yang sekarang diminta. P1 = kesulitan besar atau hasil berpotensi menyesatkan. P2 = friksi dengan jalur kerja pengganti. Prioritas ini untuk produk, bukan severity keamanan.

| ID | Prioritas | Masalah dan dampak | Bukti utama | Arah perbaikan |
|---|---|---|---|---|
| F01 | P0 | Penerimaan manual belum ada; barang tanpa PO tidak dapat masuk alur QC | `Operations.tsx:255-283`; `CommandProcessor.cs:180-190`; layar 3 | Dokumen penerimaan manual yang masuk Inventory Core dan QC |
| F02 | P1 | Setelah menyimpan Master tidak ada penjelasan belum ada stok atau aksi lanjut | `management.tsx:528-596`; layar 2 | Success state dan Terima barang yang membawa SKU |
| F03 | P1 | Barang belum dikenal tidak bisa dibuat/diajukan di dalam penerimaan | `Operations.tsx:255-283,983-1080`; layar 3 | Resolver barang dan form master ringkas tanpa kehilangan draf |
| F04 | P1 | Link tahap dan sumber hanya membuka rute, kehilangan ID penerimaan/QC/order/SKU | `Operations.tsx:248-252,376-380,477`; `App.tsx:114-120`; `controls.tsx:420-427` | Context envelope dan link ke dokumen tepat |
| F05 | P1 | Banner shortage tidak menyebut aksi/objek dan dapat terbawa menu lain | `ui.tsx:596-600`; `App.tsx:260-268,698-701`; screenshot pengguna | Error lokal transaksi, pesan sesuai aksi dan data kekurangan |
| F06 | P1 | Actual quantity UI integer/generic units, backend mendukung desimal dan master satuan berbeda | `Operations.tsx:64,99-104`; `Contracts.cs:23-27` | Satuan asli dan presisi tervalidasi sepanjang transaksi |
| F07 | P2 | QC tidak merekonsiliasi jumlah di form; good + bad baru ditolak server | `Operations.tsx:427-475`; `CommandProcessor.cs:197-201` | Tampilkan belum diklasifikasikan; blokir review yang tidak seimbang |
| F08 | P1 | Panduan ganti akun demo dan guard UI tidak mencerminkan supervisor/viewer | `Operations.tsx:419-424,475,964-969`; `CommandProcessor.cs:34-37` | Kapabilitas aktual, status menunggu peran yang sah |
| F09 | P1 | Simpan draf hanya toast, tidak tahan reload | `Operations.tsx:143-154`; `App.tsx:106,314-319` | Draf tersimpan dengan status dan kebijakan retensi eksplisit |
| F10 | P1 | Order dikembalikan menjadi rejected tetapi tidak punya revise/resubmit | `OutboundCommands.cs:47-52`; `EditService.cs:241-247`; `Operations.tsx:870-975` | Revisi berversi dan ajukan ulang, riwayat alasan tetap |
| F11 | P1 | Order penuh tidak bisa memakai beberapa rak ketika partial=false | `OutboundCommands.cs:58-62`; `Operations.tsx:726,765-770` | Alokasi multi-rak atomik; kebijakan parsial tetap terpisah |
| F12 | P1 | Nonaktif untuk dokumen baru juga memblokir scan tugas lama | `management.tsx:977`; `EditService.cs:46-56`; `CommandProcessor.cs:121-125` | Tahan deactivation selama ketergantungan terbuka dan jelaskan |
| F13 | P1 | Net movement in filter menjumlahkan halaman ledger yang sedang dimuat | `controls.tsx:351-355`; `SnapshotQuery.cs:83-86` | Agregat seluruh filter dari server, satuan benar |
| F14 | P1 | Pelacakan menyembunyikan riwayat saat stok nol; pencarian barang tercampur filter ledger | `controls.tsx:722-725,759-815`; `SnapshotQuery.cs:79,84-86` | Item lookup terpisah, riwayat tetap ada dan bisa dipaginasi |
| F15 | P1 | Kasus ERP lama dihitung tetapi daftar hanya 200 event terbaru | `SnapshotQuery.cs:91,126`; `controls.tsx:200-240,542-545` | Antrean pengecualian dengan filter/page server dan deep link |
| F16 | P1 | Editor akses dapat meratakan role berbeda di tiap gudang | `SnapshotQuery.cs:68`; `management.tsx:273-299`; `EditService.cs:216-229` | Editor baris gudang-role dan review delta |
| F17 | P1 | Beberapa aksi tunggal menawarkan hak yang berbeda dari bulk/backend | `controls.tsx:265-269,855-895,930-941`; `bulk-model.ts:56-60` | Satu kontrak kemampuan untuk semua pintu aksi |
| F18 | P1 | Label tunggal dan tindak lanjut memberi sukses sebelum persist selesai | `controls.tsx:630-670,857-880`; `App.tsx:154-171` | Await hasil, pertahankan draf gagal, pisahkan file dan audit tersimpan |
| F19 | P2 | Master lokasi menyebut semua Active dan tersimpan lokal, berbeda dari entitas operasional | `management.tsx:1078-1091`; `EditService.cs:255-261`; layar 23 | Pengaturan lokasi otoritatif dan makna pickable/frozen yang benar |
| F20 | P2 | Tugas QC/putaway selesai hilang dari perjalanan penerimaan | `Operations.tsx:386,483`; `WorkspaceQuery.cs:82`; riwayat hanya delapan aksi | Timeline induk lengkap dan filter selesai |
| F21 | P2 | Kemasan hanya memilih elemen pertama snapshot | `controls.tsx:821,912-941,1066-1084` | Katalog kemasan yang dapat dicari, versi/membership dipertahankan |
| F22 | P2 | Pending menampilkan command type/JSON dan retry tunggal kurang jelas | `controls.tsx:446-450,459-529`; layar 28 | Ringkasan bisnis, check dahulu, retry identitas sama |
| F23 | P2 | RFID menampilkan sumber/tag/fallback simulasi yang tidak terikat pilihan dokumen | `controls.tsx:1145-1170,1277-1317` | Tetap pilot opsional; sesi capture mengikuti dokumen |
| F24 | P2 | Semantik scroll/responsif tabel bergantung pada checkbox | `ui.tsx:377`; `styles.css:1577-1613,2053-2076`; layar 30-32 | Kebijakan tabel per katalog, region focusable konsisten |
| F25 | P2 | Tiap perubahan pencarian memicu snapshot, tanpa debounce/cancel request baca | `server-catalogue.ts:8-11`; `App.tsx:124-129,239-256` | Debounce/submit, scanner submit segera, batalkan read usang |
| F26 | P1 | Halaman kosong mengulang filter, tabel, pagination dan riwayat tanpa tindakan mulai yang benar | layar 1,3-9 | Empty state berorientasi pekerjaan; katalog lengkap saat ada data |
| F27 | P1 | Retur meminta ID sumber mentah; pengguna harus mencari transaksi sah di tempat lain | `Operations.tsx:1376-1447`; layar 12 | Pilih pengiriman/QC asal dari picker yang sudah scoped |
| F28 | P1 | Tidak ada aksi relokasi rak normal dari posisi stok | `Stock.tsx:730-799`; switch `CommandProcessor.cs:178-264` | Aksi Pindah rak dan command baru, bukan membuka hold/QC sembarang |

Jumlah: **28 temuan, 1 P0, 19 P1, 8 P2**. Temuan F01/F03/F28 mencakup gap terhadap kebutuhan yang baru dikonfirmasi; bukan klaim regresi pada cakupan PO-only sebelumnya. Temuan source yang memerlukan data/concurrency belum dianggap telah lulus/gagal uji runtime.

## Fungsi yang dipertahankan

- Stock grouped per warehouse/SKU, detail per posisi, identitas lengkap, search/filter/sort/pagination dan pemilihan yang terpisah dari membuka detail.
- Inventory Core, ledger/audit/outbox atomik, idempotency, lock, optimistic version, scope gudang dan pemeriksaan akses saat tindakan.
- Penerimaan dan penempatan parsial; kondisi, hold, frozen dan pickable yang berbeda; stok yang belum lolos QC tidak menjadi available.
- Pemisahan approve, release, allocate, pick dan ship. Penyajian disatukan; efek tiap peristiwa tetap eksplisit.
- Blind count, freeze lokasi, larangan melihat saldo untuk penghitung dan reviewer independen. Panel stok tidak boleh menjadi pintu bocor alternatif.
- Recovery offline dan unknown yang berbeda, request asli pada retry, ERP transport/business result terpisah dari transaksi WMS.
- Undangan akun, kepemilikan password oleh IdP, wizard admin tiga langkah, organisasi di Pengaturan dan personal preferences.
- Shared spacing, token warna, full reference IDs, waktu per baris, autentikasi dan ekspor yang sudah tersedia. Tidak ada alasan mengganti semuanya untuk memenuhi panel samping.

## Prioritas tindak lanjut

1. `$impeccable shape`: panel stok, penerimaan manual, identitas barang dan kontrak tugas terhubung; diuraikan di PRD/desain.
2. `$impeccable clarify` dan `$impeccable harden`: error scoped, draf, unit, permission, revisi order dan hasil simpan yang benar.
3. `$impeccable layout` dan `$impeccable adapt`: panel desktop, subview ponsel, empty states dan tabel yang konsisten.
4. `$impeccable optimize`: ukur dan kurangi request pencarian usang tanpa mengubah konfirmasi stok.
5. `$impeccable polish`: setelah alur dan kontrol domain lulus verifikasi, periksa kembali detail visual.

Perintah di atas adalah pemetaan pekerjaan berikutnya, belum dieksekusi sebagai perbaikan aplikasi. Jalankan ulang audit terhadap implementasi baru sebelum UAT. Daftar skenario yang harus membuktikan hasilnya ada di PRD; tidak ada klaim bahwa alur baru sudah diimplementasikan.
