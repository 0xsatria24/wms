# S13 — Customer and supplier returns

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-10, FR-04, FR-06, FR-15; TRK-07, TRK-08, TRK-16. **Keputusan terbuka:** D02, D03, D04; T03.

[Visual](../boards/03-outbound.png), panel 4 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/13-retur-pelanggan-supplier.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Customer and supplier returns**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih pelanggan atau supplier dan tautkan shipment/receipt asal.
2. Scan item/unit, isi aktual, satuan, kondisi, alasan dan bukti.
3. Retur pelanggan masuk area pemeriksaan; QC menentukan kelayakan setelahnya.
4. Retur supplier mengurangi stok pada dispatch yang disahkan; simpan referensi ke sumber dan koreksi terkait.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Konfirmasi penerimaan retur | Untuk pelanggan: review aktual dan kondisi pemeriksaan sebelum posting masuk. |
| Konfirmasi pengiriman retur | Untuk supplier: review aktual keluar serta izin sebelum dispatch. |
| Tinjau sumber | Buka dokumen asal dan riwayat unit sesuai akses. |

## Validasi dan dampak

Jumlah tidak melebihi lingkup retur yang sah; lifecycle unit dan sumber cocok. Dedup unit tidak melarang kejadian retur baru yang sah setelah shipment sebelumnya.

Retur masuk menambah posisi pemeriksaan; retur supplier keluar saat dispatch sah. Riwayat shipment/receipt asal tidak diedit atau dihapus.

Retur supplier memakai konfirmasi pengiriman yang terpisah.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada retur pada lingkup ini. Pilih dokumen asal jika berwenang membuat retur. |
| Memuat | Memuat retur pelanggan dan supplier pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Retur gagal divalidasi. Periksa sumber, identitas dan aktual yang ditandai. |
| Konflik / tertahan | Unit sudah memiliki kejadian aktif atau jumlah retur sumber berubah. Tinjau lifecycle terbaru. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
