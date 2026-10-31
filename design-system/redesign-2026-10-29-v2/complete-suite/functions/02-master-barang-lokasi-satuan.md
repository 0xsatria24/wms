# S02 — Item master

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-01, FR-04; TRK-01, TRK-08, TRK-09. **Keputusan terbuka:** D01, D02, D03; T01, T02.

[Visual](../boards/01-access-master.png), panel 5 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/02-master-barang-lokasi-satuan.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Item master**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

Gambar utama opsional. Add image / Change image / Remove image; placeholder tetap sah. Category, base unit, dimensions, unit weight memakai Not set jika kosong. Master tetap dapat disimpan tanpa foto.

## Alur dan exception fungsional



1. Pilih jenis master dan cari kode; bedakan perusahaan, owner, gudang dan lokasi.
2. Isi SKU/nama, unit dasar, faktor konversi positif, level tracking serta barcode/namespace sesuai jenis master.
3. Pilih batch, serial dan expiry wajib hanya berdasarkan kebijakan barang; kemasan memiliki anggota dan versi isi.
4. Tinjau perubahan dan simpan. Master nonaktif tetap terlihat pada histori tetapi tidak untuk dokumen baru.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Tambah master | Buka form jenis master terpilih dengan field wajib; belum mengubah data sebelum disimpan. |
| Simpan master | Validasi unik dan kewenangan; tampilkan error pada field yang bertentangan. |
| Lihat perubahan | Buka audit nilai sebelum/sesudah, pelaku dan waktu. |
| Nonaktifkan | Tampilkan referensi terdampak dan alasan; tidak menghapus transaksi lama. |
| Lihat isi kemasan | Buka anggota, jumlah dan versi; split/merge eksplisit dengan audit, tanpa stok paralel. |

## Validasi dan dampak

Kode aktif unik dalam namespace/scope. Nol depan dipertahankan. Serial/owner/lokasi cocok lingkup. Faktor konversi positif dan snapshot transaksi tidak diubah retroaktif.

Tidak mengedit saldo. Kemasan bukan sumber kuantitas tambahan ketika parent dan child dibaca bersama.

Perubahan faktor baru tidak mengubah konversi transaksi lama.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada master pada lingkup ini. Tambahkan master sesuai kewenangan. |
| Memuat | Memuat master barang dan lokasi pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Master gagal disimpan. Periksa field yang ditandai, lalu tinjau ulang. |
| Konflik / tertahan | Kode sudah dipetakan atau versi berubah. Muat master terbaru sebelum menyimpan maksud baru. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
