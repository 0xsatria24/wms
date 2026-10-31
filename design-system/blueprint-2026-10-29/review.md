# Pemeriksaan desain statis dan Delivery Gate

Tanggal: 29 Oktober 2026. Lingkup: paket blueprint ini, tanpa implementasi aplikasi.

**Hasil: PASS untuk artefak desain statis yang diperiksa.** Ini bukan penerimaan UI berjalan, aksesibilitas runtime, integrasi atau UAT. Semua UAT pada PRD tetap **Belum dijalankan**. D01-D05 dan T01-T08 tetap terbuka.

## Bukti dan cara mengulang

Generator `source/build_design.py` memakai konten `source/design_data.py` dan font Segoe UI Windows. Ia menghasilkan 21 spesifikasi fungsi, indeks/pemetaan, 33 papan SVG dengan render PNG, ditambah satu contact sheet PNG. Tidak membuat frontend, endpoint, koneksi perangkat atau logika stok.

Jalankan dari root proyek: `python design-system/blueprint-2026-10-29/source/build_design.py`. Pemeriksaan tersimpan di [checks.json](qa/checks.json): kehadiran semua FR/TRK/UAT, tautan lokal, XML SVG, batas artboard, ukuran field/tombol yang digambar dan kontras pasangan token. Pemeriksaan batas artboard bukan bukti bahwa semua teks sudah terbaca; render juga harus ditinjau visual.

Papan desktop ditinjau untuk hierarki, kepadatan, konteks, aktual/sisa dan aksi. Papan handheld diperiksa sebagai satu tugas per layar, field tujuan scan eksplisit dan footer terpisah. Papan receiving menengah memindahkan daftar menjadi pemilih. Papan stok gelap memeriksa contoh pasangan warna yang sama. Panel hitung penghitung tidak menampilkan snapshot 30 atau delta -2; angka tersebut hanya berada pada spesifikasi varian peninjau.

33 papan mencakup 21 desktop, tujuh handheld, satu tablet, satu contoh dark, satu fondasi, satu papan state dan satu review konfirmasi. Contact sheet merupakan indeks tambahan. Semua angka/kode operasional pada gambar berlabel Data simulasi. Nama pengguna/perusahaan memakai placeholder yang jujur.

Hasil pengukuran token: kontras teks minimum **5,4927:1**; batas kontrol/fokus minimum **3,1603:1**, dari 38 pasangan light/dark. Nilai bukan hasil audit aksesibilitas runtime. Tombol reservasi pada contoh kekurangan ditahan sampai kebijakan parsial mengizinkan atau kebutuhan terpenuhi. Angka tabular pada kolom kuantitas disejajarkan ke kanan.

## Hard Gate

PASS di bawah berarti sesuai lingkup artefak yang disebut. R-35 mengizinkan pemeriksaan sumber untuk mockup statis; tidak ada kontrol gambar yang diklaim telah diklik.

| Aturan | Hasil dan bukti |
|---|---|
| R-02, penulisan | PASS: pemeriksa dokumen menolak em dash dan karakter rusak pada teks baru; bahasa operasional dipakai |
| R-03, ukuran sempit | PASS desain: tujuh papan handheld terpisah serta satu papan menengah, aturan reflow 320px ke atas dan target minimum di fondasi; tidak mengklaim uji browser lintas lebar |
| R-17, angka | PASS: seluruh gambar fungsi berlabel Data simulasi; angka receiving 100/60/40, picking 10/8/2 dan transfer 50/48/2 mengikuti skenario dokumen |
| R-18, bukti sosial | PASS: tidak ada testimonial, identitas klien atau profil rekaan |
| R-23, aset | PASS: nama produk sebagai teks sementara, tanpa logo baru, avatar atau salinan logo referensi; struktur layar diturunkan dari dokumen yang diminta |
| R-24, navigasi | PASS desain: semua kelompok modul memiliki tujuan spesifikasi S01-S21; gambar navigasi tidak dipresentasikan sebagai tautan aplikasi. Tautan dokumen diperiksa |
| R-25, kontras | PASS token: 38 pasangan light/dark dihitung dengan luminance sRGB. Teks minimal 4,5:1 dan batas kontrol/fokus minimal 3:1; nilai aktual di checks.json. Garis struktural bukan batas input |
| R-26, kontrol | PASS desain: setiap spesifikasi mencantumkan kontrol dan hasil yang direncanakan; semua gambar dilabeli statis. Tidak ada aplikasi dengan kontrol kosong yang diserahkan |
| R-27, keadaan | PASS: semua 21 spesifikasi memuat kosong, memuat, filter kosong, error, konflik, akses dan kontrak pending/unknown; papan state memperlihatkan enam kasus |
| R-28, FAQ | PASS: tidak menambahkan FAQ pengisi |
| R-32, keyboard | PASS spesifikasi: fondasi/kontrak menetapkan Tab, Enter/Space, Escape, focus ring dan pengembalian fokus; pengoperasian nyata belum diuji |
| R-33, pengeditan | PASS: generator hanya membuat dokumen dan papan SVG/PNG; tidak menambal source/CSS aplikasi |
| R-34, tema | PASS spesifikasi: pasangan semantik light/dark diperiksa; contoh stok gelap dirender. Tidak ada toggle aplikasi atau klaim semua layar sudah diuji runtime |
| R-35, verifikasi | PASS artefak statis: generator dijalankan, SVG diparse, geometri/token/tautan diperiksa dan render ditinjau. Tidak mengklaim build aplikasi atau click-through |
| R-36, klaim | PASS: tidak menyatakan kepatuhan, akurasi RFID, SLA, hasil produksi atau metrik kinerja yang belum diukur |
| R-37, arah | PASS: arah Ledger yang sudah tercatat dan screenshot terbaru diterjemahkan sebelum pembuatan; Design Read dan tiga dial ada pada fondasi |
| R-38, isi jujur | PASS: requirement/fitur bersumber dari PRD; RFID bertanda pilot dan keputusan terbuka; contoh data dan scope memakai label simulasi/placeholder |
| R-39, affordance | PASS spesifikasi: native control, label, nama aksesibel, cursor, hover/pressed/disabled dan reduced motion tercantum. SVG memiliki title/desc dan tidak menyamar sebagai form interaktif |
| R-40, media/kinerja | PASS artefak: SVG memiliki width/height/viewBox dan PNG berdimensi; tidak ada script pihak ketiga atau klaim LCP/INP/CLS. Mekanisme aplikasi diperiksa saat implementasi diminta |

## Purpose-Gate

| Aturan | Hasil dan alasan tertulis |
|---|---|
| R-01, warna | PASS: teal menandai satu aksi utama; warna status menyatakan makna bisnis. Tidak ada gradient |
| R-04, ikon | PASS: label teks diprioritaskan; tidak ada ikon generik, emoji dekoratif atau impor pustaka default |
| R-06, tipografi | PASS: Segoe UI untuk workstation Windows; angka tabular dan satuan mendukung perbandingan stok |
| R-07, pola latar | PASS: tidak ada grid dekoratif. Garis tabel memisahkan entri yang dibandingkan |
| R-08, panah | PASS: tidak ada panah dekoratif pada tombol |
| R-09, badge | PASS: status bersumber dari fungsi, tanpa pill/eyebrow berulang di atas judul |
| R-10, glass | PASS: tidak digunakan |
| R-12, shadow | PASS: permukaan normal datar; spesifikasi hanya mengizinkan elevasi pada dialog/menu di atas konten |
| R-13, glow | PASS: tidak digunakan; focus ring merupakan penanda aksesibilitas |
| R-14, kartu | PASS: panel memisahkan pemilih tugas dari area aktual; tidak ada kartu fitur berulang atau empat KPI generik |
| R-19, motion | PASS desain: MOTION 1, hover/focus/pressed saja; papan statis tidak memiliki animasi |
| R-22, ilustrasi | PASS: ilustrasi truk dan kontainer referensi tidak disalin atau diganti ilustrasi dekoratif |

## Liveliness

- PASS, dial: ENERGY 1 / RHYTHM 1 / MOTION 1 tercatat dan konsisten dengan ruang kerja yang tenang.
- PASS, fokus: satu keputusan dan ringkasan aktual/hasil per fungsi, misalnya aktual 60 unit pada receiving dan blind count pada opname.
- PASS, ruang: jarak membedakan scope, tugas, input, review dan tindakan; tidak ada hero pemasaran.
- PASS, aksen: teal pada aksi tugas, fill netral untuk pilihan dan warna status hanya saat bermakna.
- PASS, motif: referensi dokumen, lokasi, kuantitas dan hasil konfirmasi berulang lintas fungsi.
- PASS, Design Read: dinyatakan pada fondasi sebelum generasi papan.

## Craftsmanship dan Quality Locks

- PASS C-1/R-31: keputusan warna, tipe, panel, jarak, bentuk dan ikon memiliki alasan satu baris pada fondasi.
- PASS C-2: semua kontrol yang dirancang memiliki kontrak hasil; gambar statis diberi label, bukan diklaim berfungsi.
- PASS C-3/R-05: form, tabel lebar, scan, timeline, blind count dan antrean mengikuti pekerjaan; tanpa chart, bento atau bagian pemasaran pengisi.
- PASS C-4: state, tiga rentang ukuran dan keyboard ditentukan dalam spesifikasi; keterbatasan bukti runtime dinyatakan.
- PASS C-5: data uji, sumber kebutuhan, hasil pemeriksaan statis dan UAT yang belum berjalan dibedakan.
- PASS R-11: radius 4/6/8, bukan semua elemen pill.
- PASS R-15/R-16: tindakan spesifik seperti Konfirmasi penerimaan dan Kirim hasil hitung; tanpa CTA promosi generik.
- PASS R-20: fisik/komitmen/bebas, perjalanan, scope dan sumber transaksi membentuk identitas Inventory/WMS.
- PASS R-21: terang mengikuti brief; gelap menjadi pasangan semantik preferensi pengguna, tanpa mengklaim toggle aplikasi sudah dibuat.
- PASS R-29: neutral dan satu aksen teal; warna tambahan memiliki peran perhatian/error/hasil, bukan merek tambahan.
- PASS R-30: tidak menyalin logo, nama merek, truk, kapasitas muatan atau seluruh menu ERP dari referensi.

## Verifikasi setelah implementasi diminta

Click-through seluruh kontrol per spesifikasi, keyboard, screen reader, zoom, semua state, kedua tema dan perangkat scanner masih perlu dilakukan pada aplikasi nyata. Backend harus membuktikan akses/scope, blind count, transaksi atomik, idempotensi, reservasi bersamaan dan saldo. ERP, penyimpanan pending, RFID fisik serta restore memerlukan lingkungan representatif dan keputusan yang masih terbuka. Penerimaan desain oleh pengguna belum diasumsikan dari hasil pemeriksaan ini.
