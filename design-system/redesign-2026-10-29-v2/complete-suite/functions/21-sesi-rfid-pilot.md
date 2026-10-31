# S21 — RFID pilot

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-05, FR-07, FR-11, FR-14, FR-15, FR-16; TRK-03, TRK-08, TRK-09, TRK-12, TRK-16, TRK-17, TRK-18, TRK-19, TRK-20, TRK-21. **Keputusan terbuka:** D02, D03, D05; T01, T05, T06, T07.

[Visual](../boards/04-control.png), panel 6 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/21-sesi-rfid-pilot.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **RFID pilot**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih satu dokumen, area, reader dan operator; mulai sesi dengan scope eksplisit.
2. Kelompokkan pembacaan berulang menjadi objek unik; tampilkan expected, matched, missing, unexpected dan unknown.
3. Akhiri baca, periksa fisik/arah ambigu/lintas area. Parent-child, unknown dan unit order lain tidak boleh dihitung ganda atau disahkan diam-diam.
4. Gunakan fallback barcode pada identitas yang sama bila perlu. Review hasil sah menuju S05/S10; opname tetap S14 dengan blind count. Pilot tidak mengaktifkan otomasi gate.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Mulai / akhiri baca | Mengubah status capture, bukan stok; berhenti baca tidak berarti posting. |
| Tinjau hasil sesi | Kelompokkan objek/pengecualian dan tahan baris belum selesai sebelum konfirmasi bisnis. |
| Gunakan barcode | Lanjut pada objek dan maksud yang sama dengan metode tercatat, tanpa hitung ganda. |
| Buka kasus | Tampilkan kode, resolusi, reader/area, bukti, pemilik tindak lanjut dan alasan. |

## Validasi dan dampak

Jumlah raw read bukan jumlah barang. RSSI bukan bukti tunggal arah. Missing tidak otomatis hilang; lintasan balik/asing/diam memerlukan pemeriksaan. Perangkat terputus menampilkan keterlambatan, bukan sukses.

Capture dan resolusi tidak mengubah stok. Inventory Core mengesahkan satu dampak setelah konfirmasi; level tracking dan ambang pilot menunggu keputusan.

Observasi tidak memposting receipt atau shipment otomatis.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Sesi belum membaca tag. Periksa konteks reader dan mulai baca bila pilot sudah diaktifkan. |
| Memuat | Memuat sesi rfid dan pengecualian pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Reader atau gateway terputus. Hasil belum lengkap; periksa perangkat atau lanjut dengan barcode pada identitas yang sama. |
| Konflik / tertahan | Arah ambigu, tag asing atau isi kemasan belum sah. Tahan baris terkait dan periksa fisik. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
