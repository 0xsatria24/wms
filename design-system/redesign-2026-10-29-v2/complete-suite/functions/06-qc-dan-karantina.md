# S06 — Quality inspection

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-03, FR-06, FR-07, FR-04; TRK-04, TRK-08, TRK-16. **Keputusan terbuka:** D02, D03.

[Visual](../boards/02-inbound.png), panel 3 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/06-qc-dan-karantina.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Quality inspection**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih inspeksi dari antrean dengan sumber, umur tunggu, kondisi, batch/serial dan jumlah.
2. Isi hasil per kondisi dan alasan/bukti yang diwajibkan; total tidak melampaui jumlah diperiksa.
3. Tinjau reservasi dan tugas terkait yang ditahan bila kondisi memburuk.
4. Konfirmasi keputusan QC sesuai kewenangan; buat/lanjutkan putaway hanya untuk hasil yang sah.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Simpan hasil inspeksi | Review distribusi kondisi, bukti dan efek pada order sebelum mengirim. |
| Buka order terkait | Buka daftar alokasi/tugas terdampak, bukan melepas komitmen otomatis. |
| Tambahkan bukti | Tampilkan status upload dan error terpisah; upload selesai bukan posting stok. |

## Validasi dan dampak

Jumlah hasil konsisten, bukti wajib siap dan di scope yang benar, izin QC sah. Karantina setelah reservasi menahan picking/shipment terkait.

Perubahan kondisi tercatat sebagai movement. Komitmen terdampak tetap HELD sampai penyelesaian terotorisasi, bukan menjadi stok bebas diam-diam.

Menjadi layak belum menjamin bebas jika lokasi atau freeze melarang.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada inspeksi yang menunggu pada scope ini. |
| Memuat | Memuat qc dan karantina pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Bukti inspeksi belum berhasil diunggah. Coba ulang lampiran sebelum keputusan yang memerlukannya. |
| Konflik / tertahan | Sebagian barang telah berubah kondisi atau versi inspeksi berubah. Muat ulang sebelum memutuskan. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
