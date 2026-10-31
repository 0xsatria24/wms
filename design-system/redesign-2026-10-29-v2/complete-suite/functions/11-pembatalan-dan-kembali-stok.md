# S11 — Cancellation and return to stock

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-08, FR-03, FR-04, FR-15; TRK-05, TRK-07, TRK-16. **Keputusan terbuka:** D02, D03.

[Visual](../boards/03-outbound.png), panel 2 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/11-pembatalan-dan-kembali-stok.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Cancellation and return to stock**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Tinjau bagian belum dipicking, dipicking dan terkirim per baris.
2. Masukkan alasan, dampak dan approval sesuai kebijakan; ajukan pembatalan.
3. Server melepas hanya bagian yang sah dilepas dan membentuk tugas kembali untuk barang dipicking.
4. Operator scan barang/lokasi kembali dan aktual; konfirmasi return-to-stock. Bagian terkirim menuju S13.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Ajukan pembatalan | Review pemisahan keadaan dan alasan, lalu validasi server. |
| Buka tugas kembali | Buka scan asal staging, identitas, tujuan sah dan aktual kembali. |
| Konfirmasi barang kembali | Sahkan perpindahan fisik balik dan selesaikan komitmen yang terkait aktual tersebut. |

## Validasi dan dampak

Status order/shipment terbaru, kewenangan dan jumlah aktual kembali. Dilarang menghapus shipment terposting atau membebaskan semua komitmen dari satu toggle header.

Bagian belum dipicking dilepas jika sah; bagian dipicking tetap terikat sampai kembali fisik. Riwayat pembatalan/pengembalian tetap dapat ditelusuri.

Menutup order di layar tidak membebaskan barang di staging.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada bagian order yang dapat dibatalkan melalui alur ini. |
| Memuat | Memuat pembatalan dan kembali stok pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Hasil pembatalan belum pasti. Periksa hasil sebelum membuat permintaan baru. |
| Konflik / tertahan | Sebagian barang sudah dikirim sejak review. Muat ulang dan pisahkan alur retur. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
