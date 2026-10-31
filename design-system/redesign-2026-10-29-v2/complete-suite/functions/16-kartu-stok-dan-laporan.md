# S16 — Stock movements

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-02, FR-04, FR-12, FR-13; TRK-15, TRK-22. **Keputusan terbuka:** D01, D03, D04.

[Visual](../boards/04-control.png), panel 1 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/16-kartu-stok-dan-laporan.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Stock movements**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Cari posisi/dokumen dan pilih dimensi serta periode yang sah.
2. Lihat saldo awal/akhir, entri, komitmen terkait dan waktu pembaruan; satuan berbeda tidak dijumlahkan sembarang.
3. Pilih mutasi untuk sumber, pelaku, occurred_at, posted_at, batch/serial, audit dan koreksi.
4. Ekspor filter/scope yang sama; server kembali memeriksa izin termasuk attachment.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Buka transaksi sumber | Dari mutasi menuju dokumen dan kembali ke entri terkait. |
| Ekspor lingkup ini | Mempertahankan filter, dimensi, waktu data dan pembatasan akses. |
| Buka koreksi | Telusuri pembalikan/adjustment dengan alasan dan referensi transaksi asal. |

## Validasi dan dampak

Waktu kejadian fisik dan posting tidak dicampur. Histori terposting tidak diedit untuk menyesuaikan saldo. Data laporan tertunda menampilkan timestamp.

Baca/ekspor tidak mengubah stok. Keputusan alokasi atau pengeluaran tetap memakai database utama.

Masuk, keluar dan perpindahan tidak dijumlahkan sebagai jenis yang sama.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada mutasi terposting pada periode dan dimensi ini. |
| Memuat | Memuat kartu stok dan ketertelusuran pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Kartu stok belum dapat dimuat. Coba ulang dengan filter yang tetap tersimpan. |
| Konflik / tertahan | Detail sumber tidak diizinkan atau sudah berubah aksesnya. Tampilkan alasan aman tanpa membocorkan gudang lain. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
