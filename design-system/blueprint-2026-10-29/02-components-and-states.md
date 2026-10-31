# Komponen dan keadaan lintas fungsi

Status: kontrak desain, bukan komponen aplikasi. Semua kontrol dalam papan adalah gambar statis. Hasil runtime dan dukungan perangkat belum diuji.

Contoh visual: [review sebelum konfirmasi](boards/00-confirmation-review.png) dan [keadaan kosong, memuat, pending, belum pasti dan ditolak](boards/00-states.png).

## Kontrak komponen

| Komponen | Isi dan alasan | State serta perilaku yang direncanakan |
|---|---|---|
| Header lingkup | Perusahaan, gudang dan dokumen aktif; hindari konfirmasi pada scope salah | Memuat, aktif, berpindah, akses ditolak. Pindah scope tidak membawa pending ke gudang/pengguna baru |
| Pemilih pekerjaan | Referensi, sisa, hambatan dan tugas yang dipilih | Pilihan diberi label/indikator selain fill. Tidak memuat angka atau tugas fiktif pada produk |
| Field scan | Label jenis scan, mode, nilai terakhir dan hasil resolusi | Idle, fokus, cocok, tidak dikenal, ambigu, salah konteks, pending. Manual tersedia; fokus tidak merebut jumlah/catatan |
| Field aktual dan satuan | Input aktual, satuan input, faktor dan unit dasar | Kosong, valid, invalid, read-only, sedang dikirim. Konversi selalu terbaca dan snapshot faktor milik transaksi |
| Baris verifikasi | Barang, nama, lokasi/kondisi, expected/aktual/sisa | Baris salah ditahan dengan alasan; tracking wajib tidak disembunyikan |
| Grup kuantitas stok | Fisik, komitmen dan bebas pada posisi sama | Known/loading/unavailable. Karantina tidak menghapus fisik atau komitmen HELD |
| Review dampak | Scope, dokumen, item, aktual, satuan, asal/tujuan, kondisi dan sisa | Review, mengirim, belum pasti, ditolak, berhasil. Nilai yang berubah meminta tinjauan baru |
| Tombol utama | Satu tindakan spesifik per langkah aktif | Default berlabel, hover dengan underline/batas lebih tegas, pressed dengan inset, fokus ring 3px, disabled dengan alasan. Minimal 44px, handheld 52px |
| Label status | Namespace status terlihat dan teks bermakna | Dokumen, kualitas, reservasi, capture, observasi, konfirmasi dan ERP tidak digabung ke satu label selesai |
| Pesan pengecualian | Objek, sebab, pemilik tindak lanjut dan satu aksi | Peringatan, blocking, terselesaikan. Penutupan pesan tidak menyelesaikan kasus |
| Tabel / record | Field penentu awal, angka rata kanan, kode/nama tetap bersama | Loading, data, first-use empty, filtered empty, error, forbidden. Narrow berubah menjadi record berlabel, tidak sekadar menghilangkan angka |
| Bukti dan audit | Lampiran, pelaku, alasan, waktu, sumber dan koreksi | Belum upload, mengirim, gagal, siap. Upload siap tidak berarti transaksi sudah commit; token/kredensial tidak ditampilkan |
| Timeline | Mutasi terposting dan referensinya, observasi diberi jenis berbeda | Waktu perangkat, observasi diterima server dan posted_at tidak disamakan; semua detail tunduk akses |
| Antrean pending | Maksud asli, pengguna/gudang, status hasil dan pemulihan | Unsent, sending, unknown, rejected, confirmed. Retry unknown memakai payload/kunci asli |
| Kemasan | Identitas parent, anggota, jumlah dan versi isi | Isi sah, belum diverifikasi, berubah. Parent-child tidak dihitung dua kali; split/merge eksplisit |
| Reader / sesi RFID | Scope, area, perangkat, durasi aktual, kategori objek unik | Belum mulai, membaca, berhenti, terputus, unresolved, ditinjau. Membaca/berhenti tidak memposting stok |

Nama dan dimensi token berada pada [fondasi](00-foundation.md). Komponen flat memakai batas struktural; menu/dialog saja boleh memiliki elevasi karena menutup lapisan lain. Tidak ada ikon wajib yang menambah aset merek.

## Matriks keadaan wajib

Semua fungsi memiliki tiga pesan spesifik pada berkasnya: empty, error dan konflik. Kontrak bersama berikut menambahkan state yang berlaku pada semua daftar/data dan setiap perintah stok. Papan state menunjukkan beberapa kasus, bukan klaim seluruh state sudah diimplementasikan.

| State | Pesan dan konteks | Tindakan yang direncanakan | Efek stok |
|---|---|---|---|
| First use kosong | Belum ada objek pada scope/peran ini; sebut cara memperoleh dokumen atau penugasan | Tambahkan hanya bila izin ada, atau hubungi penanggung jawab proses | Tidak ada |
| Filter kosong | Tidak ada hasil untuk filter aktif; filter tetap terlihat | Hapus filter / ubah pencarian | Tidak ada |
| Memuat data | Memuat [nama objek] untuk [gudang] | Pertahankan struktur; tandai data sebelumnya belum segar | Tidak ada |
| Akses ditolak | Anda tidak memiliki akses untuk tindakan/scope ini | Kembali ke lingkup sah / hubungi pengelola akses | Tidak ada; jangan bocorkan isi objek lain |
| Koneksi hilang sebelum kirim | Scan pending; stok belum dikonfirmasi | Buka pending; kirim saat koneksi dan identitas sah | Tidak ada |
| Sedang mengirim | Mengonfirmasi [tindakan]; jangan ulangi | Tahan submit ganda; tetap sediakan informasi proses | Belum diketahui sampai hasil bisnis |
| Hasil belum pasti | Hasil konfirmasi belum diketahui | Periksa / retry payload dan kunci asli | Server mungkin sudah commit |
| Ditolak pasti | [Objek] ditolak karena [alasan bisnis] | Tinjau koreksi sebagai maksud baru setelah hasil pasti | Tidak ada dampak perintah yang ditolak |
| Konflik versi/stok | Data berubah sejak ditinjau | Muat ulang dan tinjau ulang; jangan ubah payload unknown | Perintah lama tidak boleh diposting ulang dengan isi baru |
| Berhasil bisnis | [Tindakan] tercatat; [nomor], [aktual], [sisa] | Buka transaksi / lanjut ke tugas berikut | Sesuai hasil server |
| ERP menunggu/gagal | WMS tercatat; ERP menunggu/gagal | Petugas berwenang membuka S15 | Posting WMS tetap sah |
| Scanner tidak cocok | Kode [nilai] bukan [jenis input] yang diminta | Scan ulang / pemetaan berwenang | Tidak ada |

Pending dan unknown memiliki warna perhatian yang sama, namun teks dan tindakannya berbeda. Penolakan pasti menggunakan warna error. Warna tidak menggantikan kata-kata.

## Status dan cakupan state

| Namespace | Contoh konsep | Catatan |
|---|---|---|
| Dokumen | Draf, ditinjau, dilepas, parsial, selesai, dibatalkan | Nama final mengikuti masing-masing lifecycle, bukan satu enum lintas modul |
| Kondisi barang | Layak, karantina, rusak, ditolak | Kondisi terpisah dari keberadaan fisik |
| Reservasi | ACTIVE, HELD, CLOSED | HELD masih menghitung komitmen; label pengguna menjelaskan hambatan |
| Capture | Terbuka, ditutup, dibatalkan | Penutupan sesi bukan posting bisnis |
| Observasi | Belum diresolusi, cocok, tidak dikenal, tidak cocok | Hasil resolusi tidak otomatis movement |
| Konfirmasi | Belum terkirim, diproses, belum pasti, ditolak, berhasil | Menentukan cara retry dan apakah edit maksud diperbolehkan |
| Integrasi | Menunggu, terkirim transport, diproses, ditolak, hasil bisnis diketahui | Kontrak ERP D04 menentukan transisi final |

## Urutan fokus dan kontrol

Shell menggunakan urutan menu, scope, pemilih tugas, field scan, aktual/satuan, koreksi, review dan konfirmasi. Pada implementasi, sediakan skip link ke area tugas, native button/link/input, visible labels, nama aksesibel, disabled yang tidak dapat dikirim dan cursor yang benar. Jangan memakai seluruh baris sebagai tombol tanpa struktur fokus yang jelas.

Scanner memerlukan penanda field tujuan. Input yang masuk saat fokus pada catatan tidak boleh diam-diam menjadi scan untuk tugas lain. Penggantian dokumen menuntut penutupan/pemindahan draf eksplisit sesuai TRK-03. Setelah hasil scan, fokus dapat kembali ke scan jika masih mode capture dan pengguna tidak sedang mengoreksi field lain.

Dialog review memiliki judul dan penjelasan dampak, memerangkap fokus saat terbuka, Escape saat aman, lalu mengembalikan fokus. Unknown tidak ditutup dengan label seolah berhasil. Tombol tutup hanya menutup tampilan, bukan membatalkan perintah yang mungkin sudah commit.

## Penerimaan pada tahap implementasi

Uji Tab/Shift+Tab, Enter/Space, Escape, pembaca layar, zoom 200%, forced colors, kedua tema, layar di antara breakpoint, safe area dan keyboard perangkat. Ukur ulang kontras state hover/pressed/fokus setelah CSS nyata tersedia. Uji API langsung untuk scope, blind count, idempotensi, transaksi atomik dan konkurensi; tidak cukup dengan menyembunyikan kontrol.
