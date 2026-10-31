# S19 — Item tracking

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-02, FR-13, FR-04; TRK-08, TRK-09, TRK-15, TRK-22. **Keputusan terbuka:** D01, D02, D03; T01, T07.

[Visual](../boards/04-control.png), panel 4 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/19-tracker-dan-detail-unit.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Item tracking**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Ringkasan tracker mengutamakan mutasi masuk/keluar terposting, pending dan konflik dalam gudang, dengan waktu data; angka hanya dari sumber nyata.
2. Cari kode/SKU/batch/serial/dokumen dan resolusi identitas sesuai level tracking.
3. Detail menampilkan posisi/kondisi terkonfirmasi dan observasi terakhir sebagai dua bidang terpisah.
4. Telusuri timeline ke sesi scan, konfirmasi, movement, sumber, koreksi dan hasil ERP; buka pengecualian yang relevan.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Cari identitas | Pertahankan namespace dan nol depan; hasil ambigu meminta pemilihan/pemetaan sah. |
| Buka dokumen sumber | Periksa akses lalu buka transaksi yang membuktikan lokasi. |
| Buka pengecualian | Buka S17 atau S21, bukan mengubah saldo dari observasi. |
| Lihat isi kemasan | Tampilkan keanggotaan/versi yang disahkan tanpa menggandakan child. |

## Validasi dan dampak

Zona waktu gudang, waktu perangkat, diterima server dan posted_at berbeda konsep. RSSI tidak membuktikan arah/lokasi, deteksi hilang tidak membuktikan barang keluar.

Tracker membaca ledger yang sama. Tidak membuat saldo terpisah atau posisi RTLS kontinu.

Pada level SKU, sistem tidak mengklaim tahu unit fisik tertentu.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada identitas atau kejadian terkonfirmasi yang cocok dengan pencarian ini. |
| Memuat | Memuat tracker dan detail barang pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Riwayat objek belum dapat dimuat. Coba ulang dengan kode dan scope yang sama. |
| Konflik / tertahan | Identifier ambigu atau tidak diizinkan. Jangan menebak objek; minta pemetaan yang sah. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
