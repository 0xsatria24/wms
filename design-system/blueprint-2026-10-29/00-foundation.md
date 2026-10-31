# 00. Fondasi visual

Status: spesifikasi desain statis, 29 Oktober 2026. Bukan implementasi atau persetujuan rilis.

Design Read: ruang kerja Inventory + WMS untuk operator gudang, supervisor, auditor dan petugas integrasi, dengan bahasa visual dokumen operasional yang terang, padat namun terbaca. ENERGY 1 / RHYTHM 1 / MOTION 1.

## Menerjemahkan referensi

| Unsur referensi | Adaptasi untuk produk | Alasan |
|---|---|---|
| Navigasi ringan dan judul tugas | Navigasi modul tetap, konteks perusahaan/gudang terlihat | Operator perlu mengenali lingkup pekerjaan sebelum scan |
| Panel daftar di samping detail | Daftar tugas dan area kerja hanya pada alur yang membutuhkan pemilihan | Memilih dokumen tidak menghilangkan konteks tugas aktif |
| Tabel padat dengan grup dokumen | Tabel baris barang dengan rencana, aktual dan sisa berlabel | Pengguna membandingkan hasil fisik terhadap dokumen |
| Pilihan berwarna lembut | Fill netral untuk pilihan baris; teal terbatas untuk aksi utama dan fokus tugas | Mempertahankan Ledger dan tidak menyalin pilihan cyan referensi |
| Ringkasan kapasitas kendaraan besar | Diganti ringkasan aktual dan dampak transaksi | Kendaraan dan optimasi muatan bukan cakupan PRD |
| Logo dan ilustrasi | Nama teks sementara Inventory / WMS; tanpa logo atau avatar baru | Merek akhir belum diputuskan dan logo referensi tidak boleh disalin |

## Identitas dan motif

Identitas berasal dari urutan **referensi dokumen, konteks lokasi, kuantitas, hasil konfirmasi**. Kode dokumen memakai bobot sedang, nama barang tetap terbaca, angka tabular dan satuan berada berdekatan. Garis horizontal memisahkan baris, bukan grid dekoratif. Panel ringkasan dampak berulang sebelum konfirmasi, dengan asal/tujuan dan sisa yang relevan.

Tidak ada ilustrasi kendaraan, latar kontainer, gradient, glass, glow, KPI rekaan, feed aktivitas palsu atau grafik pengisi. Tidak ada ikon dekoratif. Ikon operasional bila kelak dipakai harus memiliki label dan makna, misalnya scan atau salin kode; kumpulan ikon belum menjadi keputusan implementasi.

## Token warna semantik

Nilai berikut diturunkan dari token Ledger yang telah ada. Ini spesifikasi, tidak mengubah file CSS lama.

| Peran | Light | Dark | Pemakaian |
|---|---|---|---|
| Canvas | #F6F5F1 | #1A1E24 | Latar ruang kerja |
| Surface | #FFFFFF | #22272F | Isi dokumen dan field |
| Surface alternatif | #F0F2F4 | #2D343E | Header tabel dan ringkasan |
| Teks utama | #29313C | #F0F3F8 | Judul, nilai dan isi |
| Teks sekunder | #525D6B | #BDC7D5 | Label pendamping, tetap terbaca |
| Batas kontrol | #7F8996 | #8D9AAD | Batas input yang harus dikenali |
| Pemisah struktural | #DCE1E7 | #45505F | Garis tabel noninteraktif, bukan batas field |
| Aksi utama / teks aksi | #116A70 / #FFFFFF | #8CD3D6 / #193238 | Satu aksi utama pada tugas aktif |
| Aksen lembut | #E6F2F3 | #253F44 | Konteks aksi, dipakai secukupnya |
| Pilihan baris | #E9E9E3 | #343C43 | Bersama checkbox/label terpilih, bukan warna saja |
| Fokus | #156D89 | #99D9EE | Ring fokus 3px, offset 3px |
| Perhatian / latar | #80500E / #FFF1D8 | #F3CE8E / #423421 | Pending atau hambatan yang bisa ditindaklanjuti |
| Error / latar | #A0303D / #FDEEF0 | #FFBCC4 / #452C32 | Penolakan pasti dan input salah |
| Berhasil / latar | #296442 / #EAF5ED | #B6DFC0 / #2A4032 | Hasil bisnis yang diketahui berhasil |

Teal merupakan satu aksen tindakan. Amber, merah dan hijau hanya mengodekan makna operasional dengan teks. Teks utama/sekunder diuji terhadap permukaan yang benar-benar dipakai; batas field dan fokus diuji minimal 3:1. Pemisah struktural tidak dipakai sebagai satu-satunya batas kontrol. Hasil hitung tersimpan di `qa/checks.json`.

Light menjadi arah utama sesuai referensi dan pekerjaan administrasi siang hari. Dark ditentukan sebagai pasangan semantik untuk preferensi pengguna; papan stok gelap memberi contoh, bukan bukti semua layar berjalan dalam dua tema. Pengaturan tema adalah bagian pengaturan pengguna S01, bukan tombol dekoratif pada semua tugas.

## Tipografi dan ukuran

Font: Segoe UI, lalu Helvetica Neue, Arial, sans-serif. Alasannya: keterbacaan pada workstation Windows dan tidak membutuhkan unduhan font. Monospace hanya untuk identifier panjang jika diperlukan, bukan judul.

| Peran | Desktop pada root 16px | Handheld | Alasan |
|---|---|---|---|
| Judul halaman | 24px / 30px, semibold | 22px / 28px | Tugas dikenali tanpa mendominasi tabel |
| Judul bagian | 18px / 26px, semibold | 18px / 26px | Memisahkan langkah kerja |
| Isi / tabel | 14px / 20px | 16px / 24px | Scan workstation dan pembacaan sambil bergerak |
| Label field | 14px / 20px, semibold | 14px / 20px | Label tetap terlihat saat diisi |
| Keterangan | 12px / 18px | 14px / 20px | Hanya metadata nonkritis yang memakai ukuran kecil |
| Aktual utama | 28px / 36px, semibold | 32px / 40px | Fokus pada nilai yang akan dikonfirmasi |

Implementasi kelak menggunakan rem dan layout yang dapat tumbuh. Kuantitas rata kanan, tabular numerals; label dan satuan tidak disembunyikan dalam tooltip. Angka mengikuti locale yang disepakati, nilai desimal API tetap string sesuai TRD. Faktor konversi transaksi terlihat terpisah dari input. Presisi/pembulatan menunggu D02.

## Ruang, bentuk dan kedalaman

Skala jarak: 4, 8, 12, 16, 24, 32, 48. Jarak antarlangkah 24, isi panel 16-24, label ke input 8. Ruang mengelompokkan satu keputusan, bukan membuat panel tampak mewah.

Radius: 4px field/tombol, 6px panel, 8px dialog. Badge status berbentuk label kecil bersudut 4px, bukan pill. Permukaan normal datar. Shadow hanya diperbolehkan pada dialog/menu yang benar-benar berada di atas konten; tidak dipakai pada papan desktop. Baris tabel setidaknya 56px ketika memiliki kontrol. Tinggi kontrol 44px desktop dan 52px scanner; jarak antartarget 8px. Compact mode hanya mengurangi ruang noninteraktif dan tidak mengecilkan hit area.

## Tata letak menurut pekerjaan

| Pola | Fungsi | Titik fokus |
|---|---|---|
| Daftar dan detail kerja | Receiving, QC, putaway, picking, transfer | Dokumen/tugas aktif, aktual dan hambatan |
| Tabel lebar dan detail terpilih | Master, stok, reservasi, laporan | Field yang menentukan tindakan berikut |
| Form dan review dampak | Order, retur, pembatalan, akses | Perubahan yang diusulkan dan kewenangan |
| Blind count | Penghitung opname | Lokasi, barang dan aktual tanpa pembanding |
| Timeline dan bukti | Kartu stok, tracker, audit | Kejadian terposting dan sumbernya |
| Antrean pengecualian | Pending, ERP, operasi, RFID | Kasus yang perlu ditangani, bukan grafik umum |

Sidebar desktop 208px, header 80px, gutter konten 24px. Ukuran ini jangkar untuk papan, bukan ukuran perangkat yang dijanjikan. Kartu ringkasan metrik tidak wajib. Shell sama memudahkan orientasi; pola isi berubah mengikuti pekerjaan sehingga halaman tidak dipaksa menjadi empat kartu statistik dan satu grafik.

Navigasi usulan diturunkan dari dokumen: Persediaan (S02-S04), Barang masuk (S05-S07), Barang keluar (S08-S11), Transfer dan retur (S12-S13), Opname (S14), Penelusuran (S16/S19), Antrean (S17), Integrasi (S15), Pengaturan/operasi (S01/S18/S20). S21 hanya tersedia dalam lingkup pilot RFID yang diaktifkan. Ini arsitektur informasi desain; tidak ada tautan aplikasi yang telah dibuat. Izin mengatur apa yang tampak dan backend tetap mengesahkan setiap akses.

## Rentang ukuran dan scanner

- **Lebar, usulan mulai 1200px:** sidebar dan dua panel tugas jika minimum ruang kerja 560px serta daftar 280px masih terpenuhi. Tabel perbandingan tetap dominan.
- **Menengah, usulan 760-1199px:** menu berlabel menggantikan sidebar; daftar tugas menjadi pemilih di atas, konteks dan actual dapat berdampingan; tabel hanya mempertahankan field penentu dan membuka detail berlabel. Papan tablet receiving memberi contoh.
- **Sempit, usulan 320-759px:** satu tugas per layar; konteks singkat, scan, item, aktual dan ringkasan disusun vertikal. Tabel berubah menjadi record berlabel. Menu berlabel tetap ditemukan. Footer konfirmasi tidak menutup field, daftar terakhir atau keyboard.

Breakpoint adalah hipotesis dari kebutuhan lebar konten; validasi perangkat pada D05/T04 dapat mengubahnya. Pada implementasi, uji seluruh rentang, zoom 200%, orientasi dan keyboard layar, bukan hanya ukuran papan. Footer membutuhkan ruang sesuai tinggi aktual dan safe area; ketika keyboard terbuka, kontrol aktif harus dapat digulir ke area yang terlihat. Header tinggi tidak dipertahankan jika memakan ruang tugas.

## Bahasa status dan efek

Dokumen, kondisi barang, reservasi, sesi scan, hasil observasi, hasil konfirmasi dan ERP mempunyai label terpisah. `Terakhir terdeteksi` tidak menjadi `Lokasi terkonfirmasi`. `Draf` tidak menjadi `Tercatat`. `ERP menunggu` tidak membatalkan hasil WMS yang sudah diketahui sah.

Karantina mempertahankan fisik dan komitmen tertahan; bebas alokasi nol. Picking memindahkan aktual dan komitmen ke staging, bukan mengeluarkan fisik dari gudang. Shipment yang sah mengeluarkan fisik. Transfer parsial mempertahankan sisa perjalanan. Opname tidak menampilkan snapshot kepada penghitung. Tidak ada perubahan saldo langsung dari hasil scan atau baca RFID.

## Interaksi, aksesibilitas dan gerak

Tab mengikuti konteks, pemilihan tugas, scan, aktual, review, konfirmasi. Fokus scan jelas dan tidak merebut input jumlah/catatan. Pindah konteks saat draf terbuka meminta keputusan eksplisit; pending tetap pada pengguna/gudang/dokumen asal. Scanner memiliki mode input jumlah atau tambah per kejadian yang terlihat. Keyboard HID dan input manual menggunakan validasi yang sama.

Konfirmasi membuka review yang menampilkan identitas barang, scope, satuan, aktual, kondisi, efek dan sisa. Dialog kelak memiliki nama, fokus terjaga, Escape saat aman dan fokus kembali ke pemicu. Tombol sedang mengirim mencegah duplikasi UI, namun backend tetap memerlukan idempotensi. Jika hasil tidak pasti, periksa/retry menggunakan payload dan kunci asli; jangan izinkan edit maksud itu sampai hasil terminal ditemukan.

Native controls, label terlihat, nama aksesibel, state hover/pressed/disabled, cursor yang benar dan fokus ring merupakan kontrak wajib implementasi. Pesan tidak mengandalkan warna, bunyi atau ikon. Tidak ada gerak berulang. Hanya hover/fokus/pressed, tanpa transisi perpindahan konten; reduced motion meniadakan efek nonesensial. Tidak ada klaim aksesibilitas atau kinerja runtime dari papan ini.

## Batas penerimaan desain

Gambar menyampaikan komposisi dan isi. Spesifikasi menyampaikan state, validasi dan efek yang tidak dapat ditunjukkan oleh satu gambar. Pemeriksaan artefak mencakup sumber requirement, kontras token, geometri, isi serta render. Perilaku, akses, idempotensi, perangkat, dua tema penuh dan UAT baru dibuktikan setelah implementasi yang diminta terpisah.
