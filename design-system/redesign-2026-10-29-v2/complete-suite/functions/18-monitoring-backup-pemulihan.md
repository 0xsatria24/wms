# S18 — Operations and recovery

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-16, FR-12, FR-04; TRK-13, TRK-16, TRK-21, TRK-22. **Keputusan terbuka:** D01, D04, D05; T07.

[Visual](../boards/04-control.png), panel 3 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/18-monitoring-backup-pemulihan.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Operations and recovery**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Tampilkan antrean nyata: integrasi gagal, umur pending, konflik, selisih, tugas/freeze terbuka dan status perangkat bila digunakan.
2. Pilih kasus dan lihat alasan, waktu data, pemilik tindak lanjut serta runbook yang disepakati.
3. Lihat hasil backup database dan bukti; standby tidak ditampilkan sebagai pengganti backup.
4. Rekam latihan restore terisolasi, konsistensi saldo/bukti dan RPO/RTO terukur. ERP tetap ditahan sampai rekonsiliasi.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Buka kasus terpilih | Menuju objek sumber S14/S15/S17/S20 sesuai jenis, bukan retry massal tanpa konteks. |
| Buka bukti pemulihan | Lihat log, titik pulih, measured RPO/RTO dan perbandingan target bila sudah disepakati. |
| Catat tindak lanjut | Catat penanggung jawab, alasan dan penyelesaian sesuai izin, tanpa mengarang feed. |

## Validasi dan dampak

Ambang alert/pemilik mengikuti D05/T07. Nilai kosong berarti belum diukur. Restore aktual mengikuti prosedur operasi terotorisasi dan tidak diluncurkan oleh kontrol mockup.

Monitoring tidak mengubah stok. Pemulihan memerlukan rekonsiliasi database, bukti dan ERP sebelum replay.

Buka prosedur dan bukti sebelum melanjutkan pemulihan.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada kasus aktif dari sumber yang tersedia; tampilkan waktu pemeriksaan terakhir. |
| Memuat | Memuat monitoring dan pemulihan pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Sumber monitoring tidak dapat dihubungi. Status layanan belum diketahui, bukan sehat. |
| Konflik / tertahan | Bukti restore belum lengkap atau ERP belum direkonsiliasi. Replay tetap ditahan. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
