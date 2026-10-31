# S20 — Labels packaging and devices

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-01, FR-04, FR-14, FR-16; TRK-01, TRK-02, TRK-08, TRK-09, TRK-14, TRK-18, TRK-21. **Keputusan terbuka:** D02, D03, D05; T01, T02, T04, T05.

[Visual](../boards/04-control.png), panel 5 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/20-label-kemasan-dan-perangkat.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Labels packaging and devices**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Pilih identifier/kemasan/perangkat; tampilkan scope dan riwayat aktif.
2. Penerbitan/cetak ulang/penggantian menampilkan kode manusia, objek, satuan, alasan serta label lama yang diganti.
3. Kemasan memiliki anggota dan versi isi; split/merge diaudit, isi belum sah tidak dipakai untuk posting.
4. Jika pilot dipilih, pairing EPC memverifikasi objek, encode/read-back bila menulis tag, hasil gagal dan penonaktifan label yang diganti. Perangkat/antena terikat area dan gudang.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Tinjau pemetaan label | Review unik, objek, satuan dan masa aktif sebelum simpan. |
| Cetak ulang / ganti | Simpan alasan dan jenis tindakan; penggantian menonaktifkan identifier lama yang diganti, cetak ulang mengikuti T02. |
| Ubah isi kemasan | Split/merge eksplisit dan versi baru; tidak menambah total barang. |
| Verifikasi pairing EPC | Hanya pilot terpilih: tampilkan baca balik dan tahan jika gagal. |
| Buka perangkat | Status, last contact, antrean dan konfigurasi aman; jangan tampilkan kredensial. |

## Validasi dan dampak

Kode aktif tidak ambigu, identitas label benar, akses perangkat/area terbatas. Kode internal tidak diklaim sebagai GTIN resmi; format simbol final mengikuti T02.

Penerbitan/penggantian label dan pairing tidak mengubah saldo. Barcode/EPC untuk objek sama memakai identitas yang sama.

Perangkat terdaftar tidak otomatis mendapat izin posting.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada pemetaan/perangkat dalam scope ini. Tambahkan hanya sesuai izin dan keputusan teknologi. |
| Memuat | Memuat label, kemasan dan perangkat pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Baca balik atau cetak label gagal. Tandai kegagalan dan tinjau sebelum mengaktifkan pemetaan. |
| Konflik / tertahan | Kode sudah aktif pada objek lain atau versi isi kemasan berubah. Hentikan simpan dan tinjau. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
