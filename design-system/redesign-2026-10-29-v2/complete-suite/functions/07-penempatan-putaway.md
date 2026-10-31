# S07 — Putaway

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-06, FR-14, FR-15; TRK-03, TRK-06, TRK-08, TRK-10, TRK-13. **Keputusan terbuka:** D02, D05; T04.

[Visual](../boards/02-inbound.png), panel 4 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/07-penempatan-putaway.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Putaway**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Buka tugas dengan sumber receiving dan kondisi hasil QC.
2. Scan barang serta lokasi tujuan; lokasi usulan tidak dianggap bukti penempatan fisik.
3. Isi aktual, periksa batch/serial, asal dan tujuan yang diizinkan.
4. Review dan konfirmasi; tampilkan nomor perpindahan dan posisi akhir server.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Scan tujuan | Menyelesaikan field lokasi eksplisit; scan SKU tidak diterima sebagai lokasi. |
| Ubah tujuan | Hanya lokasi yang diizinkan; revisi menuntut review baru. |
| Konfirmasi penempatan | Posting perpindahan aktual, bukan kuantitas rencana secara otomatis. |

## Validasi dan dampak

Lokasi tujuan dan barang cocok scope; freeze, kondisi dan sisa tugas diperiksa ulang. Tujuan tidak boleh disimpulkan dari pemilihan daftar saja.

Asal berkurang dan tujuan bertambah dengan aktual sama. Total fisik dalam gudang tetap; bebas mengikuti kelayakan tujuan/kondisi.

Penempatan tidak dihitung sebagai penerimaan eksternal kedua.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada tugas penempatan yang dilepas. Periksa hasil receiving/QC. |
| Memuat | Memuat penempatan barang pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Konfirmasi penempatan belum terkirim. Draf scan tetap pending. |
| Konflik / tertahan | Lokasi tujuan sedang dibekukan atau tidak diizinkan. Pilih tujuan sah setelah meninjau tugas. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
