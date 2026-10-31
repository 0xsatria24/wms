# S05 — Receiving

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-05, FR-06, FR-14, FR-15; TRK-03, TRK-04, TRK-08, TRK-10, TRK-11, TRK-12, TRK-13. **Keputusan terbuka:** D02, D03, D05; T01-T04.

[Visual](../boards/02-inbound.png), panel 2 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/05-penerimaan-aktual.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Receiving**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih PO atau transfer yang sah; baca sisa, gudang dan lokasi receiving.
2. Pilih mode input jumlah atau tambah per scan, scan barang lalu isi aktual/satuan. Batch/serial/expiry muncul ketika wajib.
3. Tinjau aktual, konversi, sisa, kondisi awal, ditolak dan kelebihan. Barcode ambigu tidak ditebak.
4. Review dan konfirmasi. Hasil sukses menampilkan nomor transaksi, aktual, posisi receiving dan sisa; status ERP terpisah. Jika QC wajib, arahkan ke S06.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Scan barang | Input berlabel dan fokus eksplisit; jenis input barang tidak boleh tertukar dengan lokasi/dokumen. |
| Ubah aktual | Ubah draf sebelum pengiriman; hitung ulang review dengan faktor yang terlihat. |
| Konfirmasi penerimaan | Buka review scope, sumber, item, aktual, unit dan efek; posting setelah konfirmasi akhir. |
| Periksa hasil | Pada timeout buka S17 dan gunakan kunci/payload asli. |

## Validasi dan dampak

Sisa/toleransi, akses, versi, barcode aktif, satuan dan tracking wajib diperiksa ulang server. Scan SKU sama yang disengaja dapat menambah draf sesuai mode; replay kejadian scan tidak menambah lagi.

Receiving bertambah sebesar aktual sah dan sisa sumber berkurang sebesar aktual. PO 100 diterima 60 menyisakan 40; konfirmasi ulang tidak menambah 60 lagi.

Scan membentuk draf. Stok berubah hanya setelah hasil server sah.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada dokumen terbuka untuk gudang ini. Periksa referensi kedatangan. |
| Memuat | Memuat penerimaan aktual pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Penerimaan belum terkirim. Draf aktual tersedia; periksa koneksi. |
| Konflik / tertahan | Aktual melampaui sisa atau tracking belum lengkap. Perbaiki baris atau minta peninjauan yang sah. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
