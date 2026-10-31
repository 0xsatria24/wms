# S08 — Orders and approvals

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-04, FR-07; TRK-03, TRK-14, TRK-16. **Keputusan terbuka:** D02, D03, D04.

[Visual](../boards/02-inbound.png), panel 5 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/08-order-dan-persetujuan.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Orders and approvals**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Peminta menyusun barang, jumlah/satuan, kebutuhan dan sumber yang diperlukan.
2. Peninjau melihat isi dan versi dokumen beserta alasan/bukti; aturan approval tidak diasumsikan final.
3. Setujui/lepas jika berwenang atau kembalikan dengan alasan; bila approval tidak diperlukan gunakan release sesuai kebijakan.
4. Order dilepas menuju S04. Peminta tetap melihat alokasi, picked, shipped dan sisa secara terpisah.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Simpan draf | Menyimpan permintaan, tidak mengalokasikan stok. |
| Setujui dan lepas order | Tindakan hanya untuk policy yang mengizinkan gabungan ini; bila terpisah tampilkan dua tahap approval lalu release. |
| Kembalikan untuk ditinjau | Alasan wajib; tidak menghapus bukti versi sebelumnya. |

## Validasi dan dampak

Peran pembuat/peninjau, versi kebijakan dan revisi isi diperiksa. Perubahan material setelah approval dapat memerlukan review baru sesuai D03.

Order siap dialokasikan setelah release, fisik dan komitmen belum berubah. S04 menangani reservasi.

Tombol approval mengikuti izin serta pemisahan pembuat dan penyetuju.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada permintaan yang memerlukan keputusan Anda. |
| Memuat | Memuat order dan persetujuan pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Keputusan belum terkirim. Periksa koneksi dan hasil sebelum mengirim ulang. |
| Konflik / tertahan | Isi order berubah setelah dibuka. Tinjau versi terbaru sebelum menyetujui. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
