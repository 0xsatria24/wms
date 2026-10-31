# S14 — Blind stock count

Status: rancangan statis Clear Operations, English default; Indonesia santai tersedia.

Sumber kebutuhan: FR-11, FR-04, FR-15; TRK-08, TRK-17, TRK-19. **Keputusan terbuka:** D02, D03, D05.

[Visual](../boards/03-outbound.png), panel 5 dalam urutan kiri-ke-kanan, atas-ke-bawah. [Kontrak sumber](../../../blueprint-2026-10-29/functions/14-opname-dan-penyesuaian.md).

## Komposisi terbaru

White sidebar, cool gray workspace, rounded white panels, cyan selection with dark text, deep blue actions. Company/warehouse context stays visible. Judul layar: **Blind stock count**. Daftar pekerjaan berada di kiri jika pengguna perlu berpindah dokumen; form/tabel aktual di tengah; review dampak di bawah. Gunakan layout ledger penuh untuk S16, antrean kasus untuk S15/S17/S18 dan timeline untuk S19.

English labels: Item, Location, Condition, Reserved for orders, Available, Actual, Remaining, Review, Confirm. Indonesia: Barang, Lokasi, Kondisi, Dipesan, Tersedia, Aktual, Sisa, Tinjau, Konfirmasi. Good/Not good adalah kondisi; Quarantine adalah penahanan terpisah.

## Alur dan exception fungsional



1. Supervisor menetapkan scope, menangani tugas terkait, lalu mengesahkan freeze dan snapshot.
2. Penghitung menerima objek/lokasi tanpa saldo pembanding, termasuk dari respons API; isi aktual dan satuan.
3. Hitung ulang menjadi percobaan baru. Peninjau berwenang melihat snapshot, hasil, delta dan bukti pada varian layar terpisah.
4. Approval adjustment memposting satu kali setelah validasi. Supervisor membuka lokasi melalui tindakan tercatat; pembatalan juga beralasan.

## Kontrol dan hasil yang direncanakan

| Kontrol | Perilaku dan hasil |
|---|---|
| Kirim hasil hitung | Mengirim bukti hitung, belum mengubah stok. |
| Setujui penyesuaian | Hanya varian peninjau: review snapshot, aktual, delta, alasan, bukti dan komitmen terdampak. |
| Minta hitung ulang | Buat percobaan baru dan pertahankan hasil terdahulu. |
| Buka lokasi | Hanya setelah penyelesaian sah dan izin; audit pelepasan freeze. |

## Validasi dan dampak

Freeze tersimpan dan diperiksa pergerakan lain; approval/pemisahan peran mengikuti D03. Adjustment tidak membuat fisik di bawah komitmen tanpa penyelesaian terkait.

Submit hitung tidak mengubah saldo. Contoh khusus peninjau: snapshot 30, aktual 28, delta -2; hanya adjustment sah memposting -2. Angka ini tidak ada pada papan penghitung.

Menutup browser tidak membuka freeze lokasi.

## Keadaan selain berhasil

| Keadaan | Pesan dan pemulihan |
|---|---|
| Kosong | Belum ada lingkup hitung yang ditugaskan. Minta penugasan supervisor. |
| Memuat | Memuat opname dan penyesuaian pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |
| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |
| Error | Hasil hitung belum terkirim. Draf bukan adjustment; freeze tetap berlaku. |
| Konflik / tertahan | Scope atau freeze berubah. Peninjau harus memvalidasi ulang sebelum penyesuaian. |
| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |
| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |



## Aturan lintas layar

Lihat [components](../components.md). Semua state loading, empty, no results, denied, offline, conflict, unknown dan success mengikuti kontrak tersebut. Angka dalam visual merupakan Simulation data; tiap layar contoh adalah skenario mandiri kecuali hubungan sumber dinyatakan. State yang hanya tertulis bukan interaksi teruji.
