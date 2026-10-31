# S03 — Stock position

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-02, FR-03, FR-04, FR-13, FR-15; TRK-15, TRK-22. **Keputusan terbuka:** D01, D02, D03.

[Visual](../boards/01-access-master.png), panel 6 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/03-posisi-stok-dan-saldo-awal.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Stock position**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

Spesifikasi terbaru wajib: [tren, spesifikasi dan gambar opsional](../../revisions/01-stock-trends/stock-position.md). Tidak ada kolom Physical di tabel utama; panel detail berisi spesifikasi dan YTD/YoY/MoM.

## Alur dan exception fungsional



1. Pilih perusahaan/owner, gudang, lokasi, kondisi dan batch/serial bila berlaku.
2. Bandingkan fisik, komitmen dan bebas; tampilkan waktu pembaruan dan sumber transaksi utama untuk keputusan alokasi.
3. Buka baris untuk saldo, entri, reservasi dan dokumen sumber pada dimensi sama.
4. Saldo awal melalui dokumen impor/review terotorisasi dengan alasan dan posting Inventory Core; jangan menyediakan edit langsung pada sel saldo.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Buka kartu stok | Buka S16 untuk posisi terpilih dan sumber setiap mutasi. |
| Tinjau saldo awal | Tampilkan preview impor, validasi baris, total per satuan/dimensi dan kewenangan sebelum posting. |
| Rekonsiliasi | Bandingkan saldo dengan entri serta komitmen dengan alokasi; selisih membuka penanganan, bukan menimpa saldo. |

## Validasi dan dampak

Fisik sama dengan jumlah entri, komitmen sama dengan alokasi ACTIVE/HELD. Bebas hanya fisik minus komitmen pada posisi yang layak, tidak freeze dan diizinkan; selain itu nol.

Membaca posisi tidak mengubah stok. Saldo awal merupakan movement yang terotorisasi, atomik dan dapat ditelusuri.

Karantina dapat tetap memiliki fisik dan komitmen tertahan.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada posisi terposting. Tinjau master dan proses saldo awal yang terotorisasi. |
| Memuat | Memuat posisi stok dan saldo awal pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Posisi stok belum dapat dimuat. Muat ulang sebelum memakai angka untuk keputusan. |
| Konflik / tertahan | Rekonsiliasi menemukan selisih. Buka bukti entri dan alokasi; jangan koreksi saldo langsung. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
