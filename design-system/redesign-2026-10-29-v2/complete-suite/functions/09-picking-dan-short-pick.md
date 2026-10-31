# S09 — Picking and shortages

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-03, FR-07, FR-14, FR-15; TRK-03, TRK-05, TRK-08, TRK-10, TRK-12, TRK-16. **Keputusan terbuka:** D02, D03, D05.

[Visual](../boards/02-inbound.png), panel 6 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/09-picking-dan-short-pick.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Picking and shortages**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Buka tugas beralokasi; scan asal, barang dan identitas wajib.
2. Isi aktual yang ditemukan. Bila kurang dari rencana, tampilkan short pick dan alasan di dekat angka.
3. Review aktual ke staging serta sisa order/reservasi. Jangan menghapus selisih fisik atau melepas sisa otomatis.
4. Konfirmasi aktual sah; lanjutkan S10 untuk jumlah yang benar-benar ada di staging.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Catat kekurangan | Membuka alasan, bukti dan tindak lanjut untuk sisa; nilai aktual tetap terlihat. |
| Konfirmasi aktual picking | Review asal/tujuan, aktual, identitas dan dampak komitmen. |
| Buka reservasi | Lihat ACTIVE/HELD dan penyebab pemenuhan tertahan. |

## Validasi dan dampak

Alokasi benar, kondisi dan freeze terbaru, scan lokasi/item/serial cocok, aktual tidak melebihi tugas sah. Sisa ditahan/dilepas/realokasi melalui tindakan D02.

Hanya aktual berpindah ke staging bersama komitmennya. Order 10 aktual 8 menyisakan 2 terbuka; fisik gudang belum keluar.

Picking ke staging mempertahankan fisik gudang dan komitmen.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada tugas picking yang diberikan pada scope ini. |
| Memuat | Memuat picking dan kekurangan pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Aktual picking belum terkirim. Periksa antrean pending sebelum melanjutkan dokumen lain. |
| Konflik / tertahan | Barang dikarantina atau lokasi freeze. Picking ditahan; buka alasan dan tugas terkait. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
