# S10 — Packing and shipment

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-03, FR-07, FR-14, FR-15; TRK-05, TRK-08, TRK-11, TRK-12, TRK-19. **Keputusan terbuka:** D02, D03; T03.

[Visual](../boards/03-outbound.png), panel 1 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/10-packing-dan-pengiriman.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Packing and shipment**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Buka order/shipment dengan hasil picking aktual dan komitmen staging.
2. Scan/cocokkan item, serial serta kemasan; parent dan child tidak dihitung dua kali.
3. Tinjau actual picked, siap kirim, kondisi dan sisa; parsial hanya bila diizinkan D02.
4. Konfirmasi shipment; server memeriksa ulang. Hasil menampilkan ID, aktual terkirim, sisa order serta status ERP terpisah.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Tinjau isi paket | Buka anggota/versi isi, identitas expected dan hasil verifikasi. |
| Konfirmasi pengiriman | Review aktual keluar, sumber komitmen dan tujuan sebelum posting. |
| Periksa selisih | Tahan baris salah/kurang/tidak dikenal; tidak menambahkan barang asing diam-diam. |

## Validasi dan dampak

Kondisi, sisa, unit, alokasi dan isi packing masih sah. Karantina, freeze, serial order lain atau observasi belum selesai menahan baris terkait.

Fisik keluar sebesar aktual shipment sah; komitmen pemenuhan terkait selesai. Picking atau baca RFID saja tidak mengeluarkan fisik.

Siap kirim dan ERP menunggu bukan satu status selesai.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada hasil picking yang siap diverifikasi untuk pengiriman. |
| Memuat | Memuat packing dan pengiriman pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Hasil pengiriman belum pasti. Periksa hasil dengan kunci dan isi asli melalui S17. |
| Konflik / tertahan | Kondisi atau komitmen berubah. Pengiriman ditahan sampai masalah diselesaikan. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
