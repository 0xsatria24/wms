# S15 — ERP reconciliation

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-12, FR-04, FR-15, FR-16; TRK-22. **Keputusan terbuka:** D04, D05; T08.

[Visual](../boards/03-outbound.png), panel 6 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/15-integrasi-erp.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **ERP reconciliation**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih event berdasarkan objek, versi, umur, status dan error aman.
2. Tinjau ID tetap, sumber, riwayat percobaan, ack transport dan hasil bisnis yang terpisah.
3. Retry memakai event sama; celah versi/konflik memerlukan rekonsiliasi, bukan menimpa state terbaru.
4. Setelah restore tahan outbound sampai bukti ERP dibandingkan dan otorisasi rekonsiliasi selesai.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Coba kirim event yang sama | Validasi izin/status dan kontrak dedup D04; tidak membuat event baru. |
| Catat rekonsiliasi | Simpan perbandingan objek/baris/jumlah/versi, bukti dan keputusan. |
| Buka transaksi WMS | Telusuri hasil lokal yang menjadi sumber event. |
| Lanjutkan replay | Hanya setelah prosedur dan kewenangan pascarestore terpenuhi. |

## Validasi dan dampak

Ack transport tidak sama dengan hasil bisnis. Jika ERP tidak mendukung dedup, adapter/periksa hasil bisnis harus disepakati sebelum retry aman diterima.

Tidak menulis ulang ledger WMS. UI memisahkan WMS confirmed, status pengiriman event dan hasil ERP.

ID event tetap; payload terposting tidak diedit saat retry.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada event yang memerlukan tindakan pada filter ini. |
| Memuat | Memuat integrasi dan rekonsiliasi erp pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Riwayat integrasi belum dapat dimuat. Muat ulang; jangan menyimpulkan ERP sudah berhasil. |
| Konflik / tertahan | Versi event memiliki celah atau hasil ERP tidak cocok. Tahan dan lakukan rekonsiliasi. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
