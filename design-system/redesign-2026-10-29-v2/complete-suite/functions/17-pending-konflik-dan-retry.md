# S17 — Pending transactions

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-14, FR-15, FR-04; TRK-03, TRK-10, TRK-11, TRK-12, TRK-13, TRK-14, TRK-16. **Keputusan terbuka:** D03, D05; T04, T07.

[Visual](../boards/04-control.png), panel 2 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/17-pending-konflik-dan-retry.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Pending transactions**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Kelompokkan per pengguna, gudang dan dokumen asal; tampilkan waktu/umur dan pemilik tindak lanjut bila sah.
2. Belum terkirim dapat dikirim setelah koneksi/identitas pulih dan validasi server terbaru.
3. Hasil belum pasti mempertahankan payload/kunci; periksa atau retry tanpa edit jumlah/versi diam-diam.
4. Hasil terminal berhasil membuka nomor transaksi. Penolakan pasti dapat ditinjau sebagai maksud baru dengan alasan/versi baru; observasi asal tetap tercatat.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Periksa hasil konfirmasi | Ambil hasil atau ulang kunci/payload asli; jangan membuat kunci baru. |
| Kirim pending | Hanya yang belum terkirim, dengan identitas dan scope asal yang masih sah. |
| Tinjau koreksi | Hanya setelah penolakan pasti; tampilkan perubahan isi sebagai maksud baru. |
| Buka detail maksud | Lihat aktual, sumber, scope, waktu, alasan, pemilik tindak lanjut dan request_id aman. |

## Validasi dan dampak

Kunci sama/isi beda ditolak. Replay kejadian scan tidak menambah aktual. Sesi kedaluwarsa dan logout tidak mengirim pending milik lama dengan identitas baru. Batas persistensi mengikuti D05.

Hanya keberhasilan bisnis server mengesahkan stok. Error sebelum commit harus rollback seluruh dampak; UI tidak dapat menjamin hal itu sendiri.

Pending lokal tidak pernah ditampilkan sebagai perubahan stok sukses.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Tidak ada scan atau konfirmasi yang menunggu pada scope ini. |
| Memuat | Memuat pending, konflik dan hasil belum pasti pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Hasil belum dapat diperiksa. Pertahankan maksud asli dan coba periksa kembali. |
| Konflik / tertahan | Akses, kondisi atau stok berubah ketika tersambung. Tinjau penolakan; pending tidak otomatis menjadi sukses. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
