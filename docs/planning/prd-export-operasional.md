# PRD: Export laporan dan dokumen operasional Inventory + WMS

ID: INV-WMS-EXP-PRD-001  
Versi: 0.1  
Tanggal: 4 November 2026  
Status: Disetujui pengguna untuk implementasi pada 4 November 2026. Hasil implementasi dan verifikasi dicatat di [catatan export operasional](../implementation/operational-export.md); persetujuan ini bukan hasil UAT.

Pengguna meminta seluruh export yang direkomendasikan untuk kebutuhan stok, rekonsiliasi, opname, dan serah terima barang. Dokumen ini menetapkan tujuh kelompok export: posisi stok, kartu stok, opname, packing/pengiriman, penerimaan, transfer, dan retur. Permintaan pengguna menetapkan cakupan tersebut; rincian format, batas proses, dan matriks izin di bawah merupakan usulan rancangan untuk ditinjau.

PRD ini melengkapi [PRD induk](01-product-requirements.md), khususnya FR-02, FR-04, FR-05, FR-08 sampai FR-11, FR-13, dan FR-15, serta mengikuti [TRD](02-technical-requirements.md). Export memakai Inventory Core dan dokumen yang sama dengan aplikasi. Penulisan PRD tidak menyatakan fitur baru sudah diimplementasikan atau UAT sudah dijalankan.

## 1. Masalah dan tujuan

Pengguna perlu membawa data keluar aplikasi untuk merekonsiliasi stok, memeriksa selisih opname, dan menyertakan bukti pada serah terima. Menyalin tabel atau mencetak layar berisiko melewatkan halaman, kondisi barang, satuan, transaksi parsial, dan referensi sumber.

Hasil yang harus tersedia:

- File analisis yang memuat seluruh hasil filter atau pilihan yang dinyatakan pengguna.
- Laporan opname yang memisahkan lembar penghitung dari informasi reviewer.
- PDF yang membedakan rencana packing, bukti transaksi aktual, dan rekap kumulatif.
- Data yang dapat ditelusuri ke dokumen/transaksi sumber, dengan waktu dan lingkup akses yang jelas.

Keberhasilan dinilai melalui kecocokan isi file dengan sumber backend, kelengkapan lintas halaman, perlindungan akses/blind count, dan keterbacaan file. Tidak ada target penghematan waktu atau kapasitas produksi yang sudah dibuktikan.

## 2. Kondisi awal yang diperiksa

Pemeriksaan sumber dilakukan pada checkout proyek tanggal 4 November 2026. Ini adalah pembacaan kode, bukan hasil uji runtime.

| Area | Kondisi awal | Pekerjaan yang dibutuhkan |
|---|---|---|
| Posisi stok | [Stock.tsx](../../prototype/src/Stock.tsx) menyediakan CSV untuk SKU terpilih dan posisi yang cocok; pilihan mengikuti halaman aktif | Tambah seluruh hasil filter, XLSX, metadata, serta pembacaan dan validasi ulang oleh backend |
| Kartu stok | [LedgerExport.cs](../../backend/Wms.Api/Modules/Reporting/LedgerExport.cs) menyediakan CSV server berdasarkan gudang, SKU, lokasi, pencarian, dan periode; ada pemeriksaan akses dan blind count | Pertahankan kontrak yang dipakai, tambah XLSX, referensi lengkap, metadata yang seragam, dan verifikasi kesetaraan filter |
| Opname | [TransferAndCountCommands.cs](../../backend/Wms.Core/Modules/Operations/TransferAndCountCommands.cs) memiliki tahap counting, review, adjusted, dan closed; penghitung berbeda dari penyetuju | Tambah lembar hitung PDF, laporan review XLSX, dan berita acara PDF sesuai tahap/izin |
| Penerimaan/pengiriman | Dokumen menyimpan jumlah kumulatif; ledger/audit menyimpan kejadian yang dibukukan | Susun PDF per kejadian aktual dan pisahkan dari ringkasan dokumen |
| Transfer/retur | Dokumen sumber dan mutasi tersedia, termasuk transit serta retur pelanggan/supplier | Tambah bukti kirim/terima/retur yang tidak menggandakan jumlah antar sisi mutasi |
| Model data | [Entities.cs](../../backend/Wms.Core/Infrastructure/Entities.cs) memakai dokumen operasional satu barang, ledger, dan audit | Jangan menganggap sudah ada shipment multi-baris, master mitra, arsip PDF, atau riwayat semua versi dokumen |
| Label | [bulk-files.ts](../../prototype/src/bulk-files.ts) menyediakan lembar label yang dapat diunduh dan dicetak | Tetap memakai alur label yang ada; tidak dijadikan laporan stok |

Sumber lain: [SnapshotQuery.cs](../../backend/Wms.Api/Modules/Reporting/SnapshotQuery.cs), [CommandProcessor.cs](../../backend/Wms.Core/Modules/Inventory/CommandProcessor.cs), [OutboundCommands.cs](../../backend/Wms.Core/Modules/Outbound/OutboundCommands.cs), dan [aturan frontend](../../prototype/AGENTS.md).

## 3. Cakupan dan format

Seluruh baris berikut termasuk paket fitur ini. Urutan pengerjaan pada bagian 14 bukan pengurangan cakupan.

| Kode | Fungsi | File yang wajib tersedia | Lingkup |
|---|---|---|---|
| EXP-STK | Posisi stok | XLSX dan CSV | SKU terpilih pada halaman aktif atau seluruh hasil filter, dalam satu gudang |
| EXP-LED | Kartu stok / mutasi | XLSX dan CSV | Seluruh mutasi yang cocok untuk satu SKU, satu gudang, lokasi opsional, pencarian, dan periode |
| EXP-CNT | Stock opname | PDF lembar hitung, XLSX laporan review, PDF berita acara | Lembar/berita acara per tugas; XLSX per tugas atau seluruh tugas yang cocok dan boleh ditinjau |
| EXP-SHP | Packing dan pengiriman | PDF packing list, PDF bukti pengiriman aktual | Satu order untuk packing; satu kejadian shipment untuk bukti aktual |
| EXP-RCV | Penerimaan | PDF bukti penerimaan aktual, PDF rekap penerimaan | Satu kejadian receive atau satu PO untuk rekap |
| EXP-TRF | Transfer antar gudang | PDF bukti kirim, PDF bukti terima, PDF rekap transfer | Satu dispatch/receipt atau satu dokumen transfer untuk rekap |
| EXP-RET | Retur | PDF bukti retur pelanggan dan PDF bukti retur supplier | Satu dokumen retur beserta kejadian posting yang terkait |

XLSX berarti berkas `.xlsx` asli yang dapat dibuka sebagai workbook. CSV tidak boleh hanya diganti ekstensinya menjadi XLSX. PDF berarti berkas `.pdf` asli yang dapat diunduh, bukan hanya halaman HTML yang meminta pengguna mencetak sendiri.

PDF pada paket ini adalah dokumen operasional WMS. Invoice, pajak, credit note, valuasi persediaan, dan penomoran resmi ERP tetap menjadi tanggung jawab ERP. Tanda tangan basah dapat dibubuhkan setelah cetak; sistem tidak mengklaim tanda tangan digital atau penerimaan pihak luar.

Di luar cakupan versi ini: export master barang, pengguna, pengaturan, log ERP, pending, RFID mentah; import balik hasil edit spreadsheet; laporan terjadwal/email; arsip file dan tautan publik; ZIP/gabungan banyak PDF; konsolidasi semua gudang; saldo stok historis per tanggal; running balance kartu stok; perluasan dokumen menjadi multi-baris; serta integrasi printer/perangkat baru. Keperluan tersebut dapat memiliki PRD terpisah.

## 4. Pendekatan yang diusulkan

| Pilihan | Manfaat | Batasan |
|---|---|---|
| Meneruskan export dari data tabel browser | Paling sedikit perubahan untuk CSV kecil | Data dapat terbatas halaman, tertinggal, atau berubah izin; tidak cukup untuk seluruh hasil filter dan bukti aktual |
| Export dari backend, dipanggil dari halaman fungsi yang ada | Memakai sumber dan otorisasi yang sama; mendukung file lengkap dan PDF | Membutuhkan pembacaan laporan bersama, generator file, dan uji lintas format |
| Portal pelaporan dengan antrean, jadwal, dan arsip | Cocok bila kelak ada pekerjaan besar dan distribusi rutin | Menambah pengelolaan job/file serta UI yang belum diperlukan |

Usulan PRD: pilihan kedua. Pengguna tetap membuka fungsi yang sedang dikerjakan, kemudian memilih lingkup/format atau jenis PDF. Tidak perlu menu Reports baru. CSV stok yang ada diarahkan ke layanan backend; endpoint CSV kartu stok yang ada tetap berfungsi bagi pemanggil lama. Nama library, struktur kelas, dan rincian endpoint tambahan dipilih dalam rencana teknis setelah kebutuhan disepakati.

## 5. Pengguna dan hak akses

Semua izin diperiksa server berdasarkan pengguna aktif, perusahaan, grant gudang terkini, serta izin membaca jenis dokumen. Menyembunyikan tombol tidak menggantikan pemeriksaan API. Matriks berikut adalah usulan yang mempertahankan pembatasan bisnis saat ini.

| Jenis export | Operator | Supervisor | Admin | Viewer |
|---|---|---|---|---|
| Posisi stok / kartu stok | Boleh sesuai akses baca dan proteksi blind count | Boleh di gudang berwenang | Boleh di gudang berwenang | Boleh jika memiliki akses baca gudang |
| Lembar hitung tanpa saldo | Boleh untuk tugas yang dapat dibuka | Boleh | Boleh | Tidak |
| Review opname / berita acara | Tidak | Boleh hanya jika kebijakan countReview mengizinkan supervisor | Boleh di gudang berwenang | Tidak |
| Packing / penerimaan / pengiriman / transfer / retur | Boleh untuk dokumen yang dapat dibuka | Boleh | Boleh | Boleh jika akses baca jenis dokumen tersebut tersedia |

Hak export tidak memberi hak konfirmasi, approval, pelepasan freeze, atau perubahan dokumen. Penghitung tetap tidak boleh menyetujui adjustment miliknya sendiri. Status ERP tidak menjadi dasar memberi izin export.

Transfer dapat dibaca oleh pengguna berwenang di gudang asal atau tujuan, mengikuti hubungan transfer yang sama dengan aplikasi. File hanya menampilkan fakta transfer terkait dan identitas gudang lawan transaksi; tidak membuka stok, pengguna, dokumen lain, atau detail internal gudang lawan. ID gudang transit teknis bukan pilihan export lintas gudang.

Proteksi blind count berlaku juga pada posisi stok, mutasi, rekap, dan PDF lain yang dapat membuka saldo atau pergerakan posisi yang dilindungi. Untuk operator, jika lingkup permintaan mencakup posisi pada tugas count yang belum closed, backend menolak file yang mengungkap saldo/pergerakannya. Tidak boleh mengirim sebagian data lalu menyebutnya laporan lengkap. Pengguna dapat mempersempit lingkup yang diizinkan atau memakai lembar hitung tanpa saldo. File yang sudah pernah diunduh tidak dapat ditarik kembali oleh aplikasi.

## 6. Ketentuan bersama untuk seluruh export

| ID | Kebutuhan |
|---|---|
| EXP-01 | Export hanya membaca fakta bisnis yang tersimpan. Tidak membuat/mengulang transaksi stok, reservasi, dokumen, approval, atau outbox ERP. Pencatatan audit export dipisahkan dari mutasi bisnis. |
| EXP-02 | Tinjauan sebelum export menunjukkan jenis file, gudang, lingkup, filter, bahasa, serta jumlah hasil yang aman ditampilkan. Export seluruh hasil filter melampaui pagination; export terpilih memakai ID pilihan eksplisit, bukan seluruh halaman secara diam-diam. |
| EXP-03 | Data dan metadata setiap file berasal dari satu snapshot konsisten pada saat pembuatan. Bila stok berubah setelah tabel dimuat, file memakai pembacaan backend terbaru dan mencantumkan waktu snapshot. Estimasi jumlah pada tinjauan boleh berbeda dari jumlah final karena perubahan ini. |
| EXP-04 | Untuk pilihan eksplisit, backend memeriksa ulang seluruh ID, gudang, filter, dan kelayakannya. ID hilang/berpindah lingkup/tidak lagi cocok menghasilkan konflik seluruh permintaan tanpa file parsial. Pemilihan diulang setelah refresh. |
| EXP-05 | Export detail mengikat ID dan versi dokumen yang ditinjau. Bila versi berubah, pengguna diminta membuka ulang detail. Bukti kejadian juga mengikat ID transaksi posting; jumlah aktualnya tidak diganti jumlah kumulatif terkini. |
| EXP-06 | Satuan, kondisi, hold, freeze, dan pickable tidak digabung menjadi satu status. Kuantitas mempertahankan presisi tersimpan tanpa pembulatan diam-diam. Tidak menjumlahkan unit berbeda atau menggandakan sisi ledger berpasangan. |
| EXP-07 | SKU, barcode, nomor dokumen ERP, dan semua reference ID ditulis penuh. XLSX memakai text cell dan PDF mempertahankan karakter, termasuk nol awal. CSV mempertahankan karakter dalam isi file, dengan escaping/proteksi text sesuai EXP-12; tidak menjamin aplikasi spreadsheet tidak menebak tipe saat dibuka langsung. ID lama tidak dipotong atau diganti; ID export baru mengikuti generator referensi 16 karakter proyek. |
| EXP-08 | File memuat jenis laporan, versi template, ID export, perusahaan, gudang, lingkup/filter, waktu snapshot, waktu pembuatan UTC, zona waktu gudang, bahasa, pembuat export, dan jumlah data. Dokumen juga memuat sumber/versi/ID transaksi yang relevan. |
| EXP-09 | Periode kartu stok memakai PostedAt dalam zona waktu gudang: mulai tanggal pertama inklusif sampai awal hari setelah tanggal terakhir eksklusif. OccurredAt, PostedAt, tanggal dokumen, rencana, approval, dan waktu pembuatan tetap dibedakan. |
| EXP-10 | PDF/XLSX mengikuti bahasa aplikasi, English default atau Bahasa Indonesia. Nilai master, nama gudang, kode, dan referensi sumber tidak diterjemahkan. CSV memakai header teknis English yang stabil, tanggal ISO 8601, desimal titik tanpa pemisah ribuan, serta metadata bahasa yang diminta. |
| EXP-11 | Backend memeriksa akses saat memulai, dan memeriksanya lagi sebelum menyerahkan file yang selesai dibuat. Konteks akun/gudang/filter yang berubah membatalkan tinjauan/download yang belum diserahkan. Pengguna tanpa izin tidak menerima isi atau jumlah data tersembunyi. |
| EXP-12 | Text yang berasal dari pengguna disimpan sebagai text cell di XLSX, bukan formula, macro, atau external link. CSV melindungi text yang dapat menjadi formula, termasuk prefix whitespace/control character, sambil menjaga angka negatif yang sah sebagai angka. PDF melakukan escaping dan tidak memuat resource eksternal berdasarkan input pengguna. |
| EXP-13 | Tidak ada hasil, konflik, akses ditolak, offline, batas terlampaui, proses gagal, dan proses dibatalkan memiliki pesan tersendiri. Hasil kosong tidak menghasilkan file sukses yang seolah berisi laporan. File rusak/terpotong tidak ditawarkan sebagai hasil selesai. |
| EXP-14 | Download memakai respons attachment privat dengan nama file aman, tanpa path/secret dari input pengguna. File tidak disimpan di cache aplikasi/service worker, folder publik, atau browser storage sebagai arsip otomatis. |
| EXP-15 | Audit export mencatat ID export, pengguna, gudang, tipe/format, scope/filter aman, sumber, waktu, jumlah baris/halaman, versi template, serta hasil generated/failed/denied/cancelled yang diketahui server. Generated berarti file berhasil dibuat, bukan bukti dibuka, dicetak, atau diterima pihak lain. |
| EXP-16 | Audit export tidak dihitung sebagai konfirmasi operasional, tidak menambah outbox ERP, dan tidak mengubah versi dokumen. Tidak mencatat isi file penuh, token, cookie, secret, atau saldo yang ditolak oleh proteksi akses. |

### 6.1 Susunan file dan representasi nilai

- XLSX memiliki sheet `Metadata` dan `Data`. Header dibekukan, filter tersedia, angka menjadi numeric cell sesuai presisi yang aman, dan identifier menjadi text cell. Jika presisi suatu angka tidak aman dalam spreadsheet, nilai disimpan sebagai teks desimal tepat dan penjelasan diberikan pada metadata.
- CSV memiliki satu baris header dan baris data datar. Metadata penting menjadi kolom berulang, termasuk ExportId, ReportType, WarehouseId, SnapshotAtUTC, GeneratedAtUTC, WarehouseTimeZone, Scope, dan filter terkait. Tidak ada judul bebas sebelum header. Encoding UTF-8 BOM, pemisah koma, quote/escape serta newline konsisten.
- CSV tidak memiliki tipe sel. Tinjauan format CSV menjelaskan bahwa kolom kode/identifier perlu diimpor sebagai teks di aplikasi spreadsheet agar nol awal dan angka panjang tidak diubah oleh aplikasi pembuka; XLSX menjadi pilihan yang disarankan untuk membuka langsung di Excel. Jangan memakai formula seperti `="000123"` untuk memaksa tipe. Prefix pengaman text berisiko formula merupakan encoding keselamatan file, bukan perubahan identifier pada sumber bisnis.
- PDF memakai A4, portrait untuk bukti serah terima dan landscape bila tabel opname memerlukannya. Header tabel berulang; footer memuat ID export, nomor halaman/total halaman, dan status dokumen. Referensi panjang membungkus tanpa ellipsis, angka tidak terpotong, dan baris tidak hilang saat pindah halaman.
- Nilai yang tidak tercatat tetap kosong atau berlabel `Tidak tercatat` sesuai format. Angka nol berbeda dari tidak diketahui. Waktu refresh browser tidak dipakai sebagai waktu transaksi.
- Nama/alamat mitra, nomor kendaraan, batch/serial, detail kemasan, dan logo hanya ditampilkan bila sumber sah menyimpannya. Ketiadaan field tidak diisi dari contoh/simulasi dan tidak memicu pembangunan master baru dalam paket ini. Ruang tanda tangan cetak boleh kosong dan tidak dianggap tanda tangan tersimpan.
- File reprint memiliki ID export dan waktu pembuatan baru, tetapi tetap merujuk transaksi bisnis asal. Versi ini tidak menjanjikan arsip byte-identik; nama/status master yang dibaca saat export merupakan metadata terkini, bukan klaim nilai historis saat kejadian.

### 6.2 Batas proses yang diusulkan

Usulan default awal: maksimum 50.000 baris data datar untuk XLSX/CSV dan 500 baris isi untuk satu PDF; batas dihitung setelah filter/otorisasi, sebelum file diserahkan. Posisi stok dihitung per posisi yang keluar, bukan jumlah parent SKU. Batas ini merupakan pengaman rancangan, bukan klaim kapasitas yang sudah diuji.

Versi pertama memproses satu permintaan export aktif per pengguna. UI tetap dapat digunakan dan menampilkan status proses serta Batal. Usulan batas waktu proses server 60 detik; request yang terputus/dibatalkan menghentikan pekerjaan bila transport mendeteksinya. Kelebihan ukuran/waktu meminta pengguna mempersempit filter. File tidak dipotong otomatis dan tidak berubah menjadi background job tanpa penjelasan. Angka batas harus dibuktikan atau direvisi melalui pengujian sebelum rilis; jadwal dan kapasitas produksi belum ditetapkan.

## 7. EXP-STK: Posisi stok

Pengguna memilih **Export selected / Ekspor terpilih** atau **Export all matching / Ekspor semua hasil filter**, lalu XLSX atau CSV. Pilihan checkbox tetap pada halaman aktif dan terpisah dari pembukaan detail. Pergantian akun, gudang, filter, sort, atau halaman membersihkan pilihan seperti aturan bulk yang ada; pergantian bahasa/tema mempertahankan pilihan tetapi memperbarui bahasa file saat tinjauan dibuat.

Satu baris file mewakili satu posisi stok dari SKU yang dipilih dan cocok dengan filter. Export semua hasil filter memakai query penuh di backend tanpa batas pagination UI. Sort mengikuti layar dengan tie-break stabil pada SKU/lokasi/ID posisi. Filter mengikuti pencarian item/SKU/barcode/lokasi, kondisi, dan pembatasan yang didukung halaman; tidak menambah filter tanggal historis.

Kolom wajib: WarehouseId, WarehouseName, PositionId, SKU, ItemName, Location, Condition, Hold, Frozen, Pickable, OnHand, Reserved, Available, Unit, LastPostedMovementAt, dan metadata bersama. OnHand adalah fisik tersimpan, Reserved adalah komitmen order, dan Available memakai aturan Inventory Core: good, tidak hold/frozen, lokasi pickable, lalu OnHand dikurangi Reserved; posisi yang tidak memenuhi syarat memiliki Available nol.

Hanya posisi dalam lingkup tampilan stok yang cocok yang keluar, termasuk aturan jumlah positif saat ini. Ekspansi parent SKU tidak memengaruhi file. Ringkasan memisahkan jumlah SKU dan jumlah posisi; total kuantitas dikelompokkan per satuan. Foto tidak ikut dalam file.

## 8. EXP-LED: Kartu stok / mutasi

Pengguna memilih satu SKU, lokasi opsional, pencarian, dan periode, lalu mengunduh XLSX/CSV untuk seluruh hasil. Tidak perlu memilih mutasi satu per satu. Filter dan urutan memakai semantik yang sama dengan halaman; pemetaan pencarian atas source, jenis, ID entri, dan ID transaksi harus konsisten antara tabel dan file.

Kolom wajib: WarehouseId, WarehouseName, SKU, ItemName, EntryId, TransactionId, SourceReference, MovementType, Location, QuantityDelta, Unit, ConversionFactor, OccurredAt, PostedAt, ActorId, ActorName bila tersedia, Reason, dan metadata bersama. Urutan stabil: PostedAt kemudian EntryId. Metadata periode tetap tersedia dan kontrak CSV lama tidak dihilangkan tanpa penyesuaian kompatibilitas.

Transfer lokasi dan picking dapat memiliki entri minus serta plus dalam transaksi yang sama. File mempertahankan kedua sisi yang termasuk lingkup, tidak menghitungnya sebagai penerimaan/pengiriman eksternal dua kali. Tidak menambahkan saldo awal/akhir/running balance yang belum dapat dibuktikan. Penjumlahan delta bersifat net dalam lingkup yang tertulis, terpisah per satuan.

## 9. EXP-CNT: Stock opname

| Keluaran | Tahap dan isi | Pembatasan |
|---|---|---|
| PDF lembar hitung | Tugas counting: referensi tugas, SKU/nama, gudang/lokasi, lingkup kondisi yang dihitung, jadwal bila ada, serta ruang hitung/nama/tanggal manual yang kosong | Tanpa expected, selisih, saldo tersedia/dipesan, nilai stok, atau rekonstruksi mutasi; tidak mengisi hasil aktual otomatis |
| XLSX laporan review | Tugas review, adjusted, atau closed: expected saat freeze, Counted dari pengajuan terakhir, selisih Counted minus Expected, unit, penghitung, tahap/status, alasan, serta waktu/sumber persetujuan bila ada | Hanya reviewer sesuai kebijakan gudang. Review yang belum disetujui berlabel `Belum disetujui`; bukan adjustment terposting |
| PDF berita acara | Tugas adjusted atau closed: angka final yang disetujui, alasan, penghitung/penyetuju berbeda, referensi approval/adjustment, waktu, dan ruang tanda tangan cetak | `Disetujui, lokasi masih dibekukan` untuk adjusted; `Ditutup` untuk closed. Tidak diterbitkan sebelum approval berhasil |

EXP-CNT-01: Export tidak submit hasil hitung, approve adjustment, atau unfreeze. Lembar cetak tidak diimpor otomatis.

EXP-CNT-02: Pilihan seluruh hasil filter XLSX menggunakan gudang, SKU/lokasi, status review/adjusted/closed, dan periode pengajuan terakhir (SubmittedAt dalam zona gudang). Tugas yang belum memiliki waktu pengajuan tetap dapat dicari tanpa filter tanggal; tidak diberi tanggal tebakan. Laporan menyatakan periode tersebut sebagai periode pengajuan, bukan periode approval.

EXP-CNT-03: Recount mengembalikan tugas ke counting; laporan review/berita acara lama tidak dibuat seolah final untuk percobaan yang sedang dibuka. Bila model belum menyimpan seluruh percobaan, file hanya menyatakan pengajuan terakhir yang benar-benar tercatat dan tidak mengklaim riwayat lengkap. Riwayat per percobaan bukan bagian versi ini.

EXP-CNT-04: Lingkup tugas yang ada dapat hanya mencakup satu SKU/posisi kondisi good tanpa hold. Laporan tidak mengklaim menghitung seluruh kondisi di lokasi atau seluruh gudang. Selisih nol tetap ditulis nol; referensi posting/approval mengikuti bukti yang benar-benar tersimpan.

## 10. EXP-SHP: Packing dan pengiriman

EXP-SHP-01: PDF packing list tersedia untuk order released dengan alokasi barang positif di Staging. Isi wajib: nomor/versi order, SKU/nama, jumlah order, jumlah disiapkan dari alokasi Staging saat snapshot, unit, kumulatif sudah dikirim, serta sisa order. Picking yang belum tiba di Staging tidak dihitung sebagai siap packing.

EXP-SHP-02: Packing list sebelum posting berlabel `Rencana packing / Belum menjadi bukti pengiriman`. Pengunduhan tidak mencentang packingVerified, mengonfirmasi shipment, atau mengurangi stok. Bila order dibatalkan atau alokasi staging tidak lagi tersedia, pembuatan packing list ditolak dan detail harus diperbarui.

EXP-SHP-03: PDF bukti pengiriman hanya tersedia setelah kejadian ship berhasil tersimpan. Isi: ID transaksi shipment, referensi order, SKU/nama, unit, jumlah terkirim pada kejadian tersebut, pelaku, OccurredAt/PostedAt, dan sumber. Kumulatif serta sisa ditampilkan terpisah sebagai rekap pada waktu snapshot, bukan jumlah kejadian asal.

EXP-SHP-04: Order yang dikirim 8 lalu 2 menghasilkan dua bukti dengan aktual 8 dan 2. Cetak ulang bukti pertama tetap menulis 8. Picking, jumlah pesanan, RFID read, atau request unknown tidak boleh dijadikan bukti barang telah keluar.

## 11. EXP-RCV: Penerimaan

EXP-RCV-01: PDF bukti penerimaan tersedia setelah receive tersimpan. Isi: ID transaksi, PO/referensi sumber, gudang/lokasi receiving, SKU/nama, unit, aktual pada kejadian, OccurredAt/PostedAt, dan operator. Barang awaiting-qc/unassessed tetap diberi status tersebut; diterima tidak berarti lolos QC atau tersedia untuk picking.

EXP-RCV-02: PDF rekap penerimaan memperlihatkan jumlah PO, kumulatif diterima, sisa, status saat snapshot, dan daftar referensi kejadian terkait. Judulnya `Rekap penerimaan`, terpisah dari bukti satu kejadian. PO yang belum pernah diterima tidak memiliki bukti aktual; rekap boleh menunjukkan diterima nol dan status belum diterima.

EXP-RCV-03: PO 100 diterima 60 lalu 40 menghasilkan bukti aktual 60 dan 40. Cetak ulang 60 tidak berubah menjadi 100. Filter histori memilih kejadian transaksi di backend; jangan mengambil daftar dari audit yang dibatasi 200 baris pada snapshot UI.

## 12. EXP-TRF dan EXP-RET: Transfer dan retur

### 12.1 Transfer antar gudang

EXP-TRF-01: Bukti kirim memuat ID transfer, gudang asal/tujuan, SKU/nama, aktual dispatch, satuan, referensi transaksi, waktu, dan pelaku. Bukti terima memuat ID transfer dan satu kejadian receipt aktual di tujuan dengan referensi/waktu/penerimanya sendiri.

EXP-TRF-02: Rekap transfer menunjukkan jumlah dikirim, kumulatif diterima, dan sisa dalam perjalanan pada waktu snapshot, serta referensi kejadian. Kirim 50, terima 48 berarti sisa 2 dalam perjalanan; sisa tersebut tidak otomatis dinyatakan hilang/rusak. Jika kemudian diterima 2, bukti pertama tetap 48 dan bukti berikutnya 2.

EXP-TRF-03: Entri minus/plus pada sisi asal, transit, dan tujuan tidak dijumlah sebagai tiga kali pergerakan barang. Bukti terima tidak bisa dibuat hanya berdasarkan dispatch. Status QC di tujuan tetap dipisahkan dari penerimaan transfer.

### 12.2 Retur pelanggan dan supplier

EXP-RET-01: PDF retur pelanggan memuat jenis retur masuk, ID retur, referensi shipment asal, SKU/nama, aktual dikembalikan, satuan, alasan, gudang/lokasi penerimaan, kondisi/hold yang tercatat, waktu, pelaku, serta ID posting terkait. Retur masuk yang menunggu QC tidak dinyatakan sudah available.

EXP-RET-02: PDF retur supplier memuat jenis retur keluar, ID retur, sumber QC/opening/penerimaan yang memang tersimpan, SKU/nama, aktual keluar, satuan, alasan, lokasi sumber, kondisi/hold yang tercatat, waktu, pelaku, dan ID posting. Tidak mengarang referensi PO jika model sumber hanya menyimpan referensi QC atau opening.

EXP-RET-03: Bukti dibuat dari retur yang sudah tersimpan, bukan formulir belum submit. Return-to-stock setelah pembatalan order tidak diberi judul retur pelanggan/supplier; aktivitas tersebut tetap ditelusuri lewat kartu stok dan tugas asal. Tidak membuat refund, credit note, atau keputusan penerimaan ERP.

## 13. Alur pengguna, kegagalan, dan keterbacaan

1. Pengguna membuka fungsi dan memilih gudang, filter, atau detail sumber.
2. Pengguna memilih Export. Posisi stok menawarkan terpilih/semua hasil filter; kartu stok seluruh hasil filter; opname keluaran sesuai tahap; dokumen operasional memilih kejadian aktual atau rekap yang diberi label jelas.
3. Tinjauan menunjukkan lingkup, sumber, format, bahasa, dan estimasi jumlah data. Pengguna menekan Unduh; satu klik tidak pernah sekaligus mengonfirmasi transaksi fisik.
4. Backend memvalidasi izin, sumber, versi, filter, dan batas, lalu membentuk file dari snapshot konsisten. UI menampilkan Memproses dan Batal tanpa mengunci seluruh halaman.
5. File selesai diserahkan untuk download. UI menyatakan file siap/permintaan download dikirim; tidak mengklaim tersimpan di folder tertentu atau tercetak. Batal/gagal dapat dicoba ulang sebagai export baru tanpa retry transaksi bisnis.

Jika koneksi hilang saat konfirmasi bisnis sebelumnya, pengguna lebih dahulu memakai pemeriksaan hasil asli. Export tidak menyelesaikan unknown request, mengubah pending, atau membuat perintah bisnis baru. PDF bukti untuk kejadian tersebut hanya dapat tersedia bila backend telah menemukan hasil terposting yang sah. Export langsung saat offline ditolak dengan pesan sambungkan kembali; data cache browser tidak diberi label laporan terkini.

Semua kontrol mengikuti pola katalog dan spacing proyek. Tombol dapat dijangkau keyboard, fokus terlihat, status proses/error diumumkan, dan dialog mengembalikan fokus ke pemicu. Pada lebar 360px, tinjauan dan tombol reflow tanpa overflow halaman. Tabel PDF tetap dapat dibaca saat dicetak hitam putih; status tidak hanya dibedakan warna. Jangan menambah dashboard, kartu metrik, atau dekorasi untuk fitur export.

## 14. Urutan implementasi dan ketergantungan data

| Tahap | Cakupan | Syarat melanjutkan |
|---|---|---|
| A | Pembacaan export bersama, otorisasi/blind count, audit export terpisah, format metadata, proteksi text, EXP-STK, dan EXP-LED | Rekonsiliasi XLSX/CSV, seluruh halaman, izin, satuan, dan kompatibilitas CSV terbukti |
| B | EXP-CNT: lembar hitung, laporan review, berita acara | Kebijakan reviewer dan state tugas tidak bocor/berubah melalui export |
| C | EXP-SHP dan EXP-RCV: template PDF serta pembacaan tiap kejadian/rekap | Aktual parsial dan cetak ulang cocok dengan posting sumber |
| D | EXP-TRF dan EXP-RET, verifikasi lintas modul dan UAT | Transit, jenis retur, akses kedua gudang, serta seluruh kriteria relevan terpenuhi |

Ketergantungan yang wajib diselesaikan saat merancang implementasi:

- Query laporan tidak memakai jumlah kumulatif sebagai pengganti aktual per kejadian, pagination katalog, atau potongan audit UI sebagai sumber lengkap.
- Hubungan kejadian dengan dokumen, actor approval, serta versi sumber harus dapat ditelusuri secara deterministik lewat ledger/audit/dokumen. Jika field belum tercatat memadai, tambahkan penyimpanan fakta minimal untuk transaksi baru dalam transaksi bisnis yang sama. Jangan membuat posting kedua hanya untuk mencetak.
- Untuk data lama yang hubungan wajibnya tidak dapat dibuktikan, rekap yang sah boleh tersedia dengan keterangan batas data; bukti kejadian/berita acara yang memerlukan hubungan itu ditolak dengan alasan `Bukti sumber belum lengkap`. Tidak melakukan backfill tebakan atau mencetak placeholder sebagai bukti final.
- Normalisasi metadata dan audit export tidak boleh menaikkan jumlah konfirmasi operasional di monitoring. Perlu pengujian langsung terhadap perhitungan tersebut.
- Nilai expected opname berasal dari freeze tugas, bukan saldo terkini. Jumlah packing berasal dari alokasi staging terkini; jumlah bukti aktual berasal dari kejadian posting. Nama/status master terkini harus dikenali sebagai metadata saat export.

## 15. Kriteria penerimaan

Seluruh skenario di bawah berstatus **Belum dijalankan**. Angka adalah dataset uji yang harus disiapkan, bukan hasil pengujian. Pemeriksaan otomatis mendukung penerimaan; file nyata juga harus dibuka/diverifikasi dan UAT tetap memerlukan pengguna operasional.

| ID | Skenario dan hasil yang diwajibkan | Acuan |
|---|---|---|
| UAT-EXP-01 | Dataset 137 SKU/163 posisi cocok, halaman 10 SKU: seluruh hasil filter menghasilkan 163 posisi dalam XLSX/CSV dan metadata 137 SKU; tidak hanya halaman pertama | EXP-STK, EXP-02 |
| UAT-EXP-02 | Pilih 2 SKU dengan 7 posisi keseluruhan tetapi hanya 4 cocok filter: file terpilih berisi tepat 4 posisi. Expand/collapse parent tidak mengubah hasil | EXP-STK, EXP-04 |
| UAT-EXP-03 | Posisi good/pickable on-hand 100 reserved 20 menghasilkan available 80; posisi hold/frozen/non-pickable menghasilkan available 0. Unit berbeda tidak disatukan | EXP-06, EXP-STK |
| UAT-EXP-04 | Pencarian, lokasi, kondisi, status, sort, dan tie-break menghasilkan himpunan/urutan yang sama pada tabel dan export, setelah memperhitungkan pagination dan waktu snapshot | EXP-02, EXP-03, EXP-STK, EXP-LED |
| UAT-EXP-05 | Mutasi sebelum/sesudah tengah malam gudang masuk periode PostedAt yang tepat. OccurredAt berbeda tetap dipertahankan dan tidak mengubah filter | EXP-09, EXP-LED |
| UAT-EXP-06 | Ledger lebih dari satu halaman memuat semua EntryId/TransactionId penuh, tanda delta benar, faktor/satuan benar, serta kedua sisi mutasi yang termasuk lingkup. CSV lama tetap dapat dipakai | EXP-06, EXP-07, EXP-LED |
| UAT-EXP-07 | Operator dengan count belum closed tidak menerima saldo, delta yang membuka saldo, atau hidden metadata lewat export stok/ledger/PDF/API langsung; lembar hitung tetap tanpa expected/selisih | Bagian 5, EXP-CNT |
| UAT-EXP-08 | Opname expected 30, counted 28: review XLSX menulis selisih -2 dan Belum disetujui; BA ditolak sebelum approval. Sesudah approval oleh orang berbeda, BA menulis -2 serta referensi/pelaku yang sah | EXP-CNT |
| UAT-EXP-09 | Kebijakan admin-only menolak export review/BA oleh supervisor. Export tidak memberi hak approve sendiri atau melepaskan freeze. Adjusted dan closed memiliki label yang berbeda | Bagian 5, EXP-CNT |
| UAT-EXP-10 | Setelah recount status counting, file final untuk pengajuan sebelumnya tidak diterbitkan sebagai hasil terbaru. Counted 0 dibedakan dari belum dihitung; selisih 0 tidak dikosongkan | EXP-CNT-03, EXP-CNT-04 |
| UAT-EXP-11 | Packing 8 dari order 10 menulis rencana 8, bukan shipment. Shipment 8 lalu 2 menghasilkan bukti terpisah; cetak ulang pertama tetap 8. Export tidak mengubah packingVerified atau stok | EXP-SHP |
| UAT-EXP-12 | PO 100 diterima 60 lalu 40: dua bukti berisi 60 dan 40; rekap menunjukkan 100 diterima, sisa 0. Awaiting-QC tidak berubah menjadi available | EXP-RCV |
| UAT-EXP-13 | Transfer 50 dengan receipt 48 lalu 2: rekap awal transit 2, akhir transit 0; bukti receipt 48 tidak berubah. Akun satu sisi tidak mendapat data internal gudang lawan | EXP-TRF, bagian 5 |
| UAT-EXP-14 | Retur pelanggan dan supplier menulis jenis/arah, sumber yang benar, aktual, alasan dan hold. Return-to-stock tidak salah diberi judul retur supplier; tidak ada dokumen finansial | EXP-RET |
| UAT-EXP-15 | Akun tanpa grant, gudang/ID buatan, pencabutan grant sebelum file diserahkan, dan pergantian akun ditolak tanpa file/data tersembunyi. Uji endpoint langsung selain tombol UI | EXP-04, EXP-11 |
| UAT-EXP-16 | Dokumen berubah versi atau pilihan tidak lagi cocok setelah tinjauan menghasilkan konflik tanpa file parsial. Export semua hasil filter menggunakan snapshot baru yang konsisten dan mencantumkan waktunya | EXP-03 sampai EXP-05 |
| UAT-EXP-17 | SKU/barcode berawalan nol dan ID panjang tetap teks di XLSX, utuh di PDF, serta utuh dalam isi CSV setelah decoding escaping/proteksi. Uji impor CSV dengan kolom kode sebagai teks; pembukaan langsung dengan deteksi tipe bukan jaminan CSV. Koma, quote, newline, Unicode dan prefix formula/whitespace/control character ditangani aman tanpa formula pemaksa teks; delta negatif tetap angka | EXP-07, EXP-10, EXP-12 |
| UAT-EXP-18 | XLSX dibuka sebagai workbook valid, CSV memiliki header stabil tanpa judul bebas, PDF benar-benar PDF. Metadata, jumlah baris, source/versi dan bahasa sesuai permintaan | EXP-08, bagian 6.1 |
| UAT-EXP-19 | PDF lebih dari satu halaman tetap memuat semua baris, header berulang, nomor halaman dan ID penuh; tidak ada nilai terpotong. Unknown field tidak menjadi angka/tanggal/nama contoh | Bagian 6.1 |
| UAT-EXP-20 | Tidak ada hasil, offline, pembatalan, timeout, dan batas 50.000/500 baris menampilkan hasil yang benar. Uji tepat pada batas dan satu baris di atas; tidak ada pemotongan file diam-diam | EXP-13, bagian 6.2 |
| UAT-EXP-21 | Export/reprint/retry tidak mengubah saldo, alokasi, status/versi dokumen, hasil request bisnis, atau outbox. Audit export tercatat terpisah dan tidak menambah confirmedActions operasional | EXP-01, EXP-15, EXP-16 |
| UAT-EXP-22 | Dua bahasa, keyboard, fokus/status proses, serta lebar 360px dapat dipakai. Membuka file, preview cetak dan pemeriksaan di aplikasi spreadsheet/PDF target dilakukan; bukan hanya pemeriksaan byte/header | Bagian 13 |
| UAT-EXP-23 | Sumber historis wajib yang tidak lengkap menolak bukti final tanpa menebak aktor/jumlah. Rekap yang masih dapat dibuktikan menunjukkan keterbatasannya; transaksi baru menyimpan hubungan yang diperlukan | Bagian 14 |

## 16. Keputusan rancangan dan syarat rilis

Usulan default PRD: tujuh kelompok export pada bagian 3, backend sebagai sumber, satu gudang per permintaan, XLSX/CSV untuk analisis, PDF untuk dokumen, packing list berstatus rencana, PDF satu kejadian/dokumen per permintaan, serta file dibuat saat diminta tanpa arsip otomatis. Hal tersebut belum dinyatakan sebagai keputusan klien selain cakupan export yang diminta.

Pemilik proses perlu memeriksa kecukupan template dan kolom, penerima hak export, kebutuhan pihak/alamat pada bukti serah terima, serta aplikasi pembuka file yang dipakai. Nama/alamat pihak luar yang belum ada tidak menghalangi rancangan bukti internal WMS; bila klien memerlukan surat jalan atau format resmi dengan field wajib tambahan, kebutuhan dan sumber datanya harus ditambahkan sebelum template itu dinyatakan memenuhi proses klien.

Fitur baru boleh dinyatakan selesai setelah kebutuhan yang disepakati dipetakan ke implementasi, seluruh uji relevan lulus, file nyata ditinjau, dan tidak ada regresi pada proteksi akses, blind count, pending/idempotensi, approval, serta batas ERP/WMS. UAT klien, perangkat fisik, deployment produksi, kapasitas, dan legalitas dokumen eksternal tidak dibuktikan oleh penulisan PRD atau uji lokal.

Riwayat revisi: 0.1, 4 November 2026, draf awal berdasarkan permintaan penambahan export dan pemeriksaan sumber lokal. Pada tanggal yang sama pengguna meminta implementasi sesuai PRD tanpa perluasan scope; implementasi diteruskan melalui [rencana pengerjaan](../superpowers/plans/2026-11-04-operational-export.md).
