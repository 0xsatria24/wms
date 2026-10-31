# S12 — Warehouse transfers

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-09, FR-05, FR-15; TRK-06, TRK-08, TRK-22. **Keputusan terbuka:** D01, D02, D03.

[Visual](../boards/03-outbound.png), panel 3 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/12-transfer-dan-perjalanan.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Warehouse transfers**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Transfer lokasi dalam gudang memakai scan asal/barang/tujuan dengan delta seimbang.
2. Untuk antar gudang, asal mengonfirmasi dispatch aktual; barang pindah ke perjalanan pada referensi yang benar.
3. Tujuan melihat dikirim, diterima sebelumnya dan sisa, lalu scan serta isi aktual penerimaan.
4. Konfirmasi aktual tujuan. Sisa tetap perjalanan sampai penerimaan lanjutan atau penyelesaian selisih terotorisasi.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Konfirmasi kirim transfer | Variasi peran asal: review aktual dan tujuan, lalu dispatch ke perjalanan. |
| Konfirmasi terima transfer | Variasi peran tujuan: validasi sisa dan posting aktual diterima. |
| Tinjau selisih | Buka bukti/penanggung jawab, penerimaan lanjutan atau keputusan yang diaudit. |

## Validasi dan dampak

Referensi perjalanan dan unit tepat, asal/tujuan dalam lingkup sah, tidak melebihi sisa. Transfer antar perusahaan tidak dimasukkan tanpa cakupan tambahan.

Kirim mengurangi asal dan menambah perjalanan; terima mengurangi perjalanan dan menambah tujuan. 50 dikirim dan 48 diterima menyisakan 2, bukan nol.

Sisa tidak otomatis hilang, diterima, atau selesai.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada transfer terbuka untuk gudang ini. |
| Memuat | Memuat transfer dan perjalanan pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Penerimaan transfer belum terkirim. Simpan pending pada dokumen dan scope asalnya. |
| Konflik / tertahan | Sisa transfer berubah karena penerimaan lain. Muat ulang lalu tinjau aktual sebagai maksud baru bila hasil lama pasti. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
