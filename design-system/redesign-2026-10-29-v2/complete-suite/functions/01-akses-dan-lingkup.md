# S01 — Access and administration

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-04; TRK-03, TRK-14. **Keputusan terbuka:** D01, D03, D05; T04.

[Visual](../boards/01-access-master.png), panel 4 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/01-akses-dan-lingkup.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Access and administration**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Masuk melalui metode identitas yang kelak disepakati D03; jangan menggambar form sandi khusus sebagai keputusan SSO.
2. Tampilkan hanya perusahaan/gudang yang diizinkan; pengguna meninjau peran dan memilih scope.
3. Jika ada draf atau pending, jelaskan pilihan menyelesaikan, menyimpan atau membatalkan draf sesuai kebijakan perangkat; jangan memindahkan pending.
4. Sesudah scope sah, buka pekerjaan sesuai peran. Preferensi tampilan dapat diubah tanpa mengubah scope.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Gunakan lingkup ini | Meminta validasi scope; melanjutkan hanya jika akses masih sah. |
| Tinjau draf | Membuka S17 dengan scope asal, bukan mengirim sebagai pengguna baru. |
| Kelola izin | Bagian admin: lihat peran, gudang, tindakan dan versi kebijakan; perubahan memerlukan otorisasi D03 serta audit. |
| Terang / Gelap | Pilihan eksklusif; seluruh komponen memakai peran warna yang sama. |

## Validasi dan dampak

Akses setiap baca, mutasi, lampiran dan ekspor diperiksa backend. Pembuat tidak menyetujui tindakannya sendiri bila kebijakan melarang. Perubahan izin berlaku pada aksi berikutnya.

Tidak mengubah stok. Identitas dan scope menjadi konteks tindakan berikutnya, bukan bukti izin dari klien.

Pending tetap terikat pengguna, gudang dan dokumen asal.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada gudang yang diizinkan. Hubungi pengelola akses. |
| Memuat | Memuat akses dan lingkup kerja pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Lingkup tidak dapat dimuat. Coba muat kembali sebelum memilih pekerjaan. |
| Konflik / tertahan | Sesi berakhir atau akses berubah. Masuk kembali; draf tetap mengikuti kebijakan perangkat. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
