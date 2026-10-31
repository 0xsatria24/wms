# S04 — Reservations

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-03, FR-07, FR-15; TRK-05, TRK-08, TRK-12. **Keputusan terbuka:** D02, D03.

[Visual](../boards/02-inbound.png), panel 1 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/04-ketersediaan-dan-reservasi.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Reservations**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Buka order yang sudah dilepas dan approval sah.
2. Tampilkan kebutuhan, sudah dialokasikan, sisa, posisi layak dan pembatas lokasi/kondisi/expiry.
3. Tinjau kekurangan; jangan otomatis memilih parsial sebelum kebijakan D02 mendukungnya.
4. Konfirmasi; server memvalidasi ulang stok di bawah lock. Tampilkan alokasi tersimpan atau konflik tanpa mengasumsikan hasil preview tetap berlaku.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Konfirmasi reservasi | Pada contoh kekurangan, tombol ditahan sampai kebijakan parsial mengizinkan atau kebutuhan terpenuhi. Review jumlah dan posisi; kirim satu maksud dengan versi dan kunci tetap. |
| Muat stok terbaru | Perbarui preview, tidak diam-diam mengubah maksud yang hasilnya belum pasti. |
| Tinjau reservasi tertahan | Lihat penyebab karantina serta order/tugas terdampak; realokasi/pelepasan mengikuti D02 dan audit. |

## Validasi dan dampak

Backend utama mengunci dan memeriksa sisa serta kondisi terkini. Total komitmen tidak melebihi fisik. Staging, quarantine, freeze dan expiry yang melarang tidak menjadi alokasi baru.

Komitmen bertambah sebesar alokasi sah; fisik tetap. HELD tetap dihitung sebagai komitmen dan menahan picking/shipment.

Tetapkan kebijakan parsial sebelum konfirmasi; fisik tidak berkurang.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada order yang siap dialokasikan. Periksa release dan approval. |
| Memuat | Memuat ketersediaan dan reservasi pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Ketersediaan gagal dimuat. Muat ulang sebelum mengalokasikan. |
| Konflik / tertahan | Stok layak berubah. Muat ulang dan tinjau alokasi; pilihan parsial memerlukan kebijakan yang sah. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
