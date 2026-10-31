# Pemeriksaan antislop: PDF arsitektur persediaan dan gudang

Status: PASS. Lingkup pemeriksaan adalah dokumen PDF statis 13 halaman, bukan aplikasi yang sudah dibangun.

Mode: during, session override. Skills: antislop core, antislop-ui, antislop-copywriting, PDF.

## Arah dan alasan desain

- Brief: dokumen rancangan sistem formal untuk klien, dengan bahasa teknis yang jelas, kontrol dokumen, diagram konsisten, dan kriteria penerimaan.
- Design Read: dokumen engineering dengan ENERGY 1, RHYTHM 2, MOTION 1; dokumen statis tidak memakai animasi.
- Format potret dipakai untuk penjelasan dan tabel data; lanskap dipakai untuk lima halaman diagram atau matriks yang membutuhkan lebar.
- Arial regular/bold di-embed agar hasil cetak dan label diagram konsisten; ukuran, ketebalan, serta penomoran membentuk hierarki laporan teknis.
- Warna arang dan putih mendukung pembacaan dan cetak; aksen hijau tua menandai pusat pengesahan stok dan ilustrasi ketersediaan.
- Persegi menyatakan layanan/proses, belah ketupat menyatakan keputusan, dan garis putus menyatakan pekerjaan asinkron; tidak ada kartu fitur dekoratif.
- Halaman 1 adalah kendali dokumen dan daftar isi; halaman 2 ringkasan; halaman 3 arsitektur; halaman 4-5 modul/data; halaman 6-8 alur/sequence; halaman 9-10 proses kontrol dan integrasi; halaman 11-12 UAT; halaman 13 implementasi, keputusan, dan referensi.
- Garis dan panah menunjukkan hubungan data, urutan pekerjaan, serta pemisahan kolom; tidak menjadi pola latar.
- Teks, diagram, dan contoh berasal dari rancangan yang dibahas dalam percakapan. Tidak ada logo, pelanggan, atau data operasional yang dibuat-buat.

## Hard gate

- R-02 PASS: ekstraksi seluruh PDF diperiksa; tidak ada em dash, en dash, atau replacement character.
- R-03 PASS: semua blok teks berada dalam margin; pemeriksaan geometris menemukan 0 blok teks bertumpuk; tiga belas halaman dirender dan dilihat. PDF adalah format cetak tetap, bukan UI responsif.
- R-17 PASS: angka jumlah barang berada dalam contoh ilustrasi atau skenario uji; tidak ada statistik kinerja atau adopsi.
- R-18 PASS: tidak ada testimonial, avatar, nama pelanggan, atau kutipan fiktif.
- R-23 PASS: pengguna meminta pembuatan ulang PDF dan flowchart; aset yang dibuat hanya diagram dari isi tersebut. Tidak ada identitas merek baru.
- R-24 PASS: 24 tautan internal dipastikan menuju 12 bagian atau sampul yang benar; tiga tautan referensi memiliki tujuan HTTPS nyata.
- R-25 PASS: seluruh pasangan warna teks yang dipakai diuji; rasio minimum 6,25:1, melampaui 4,5:1.
- R-26 PASS: dokumen tidak memuat kontrol palsu; terdapat 24 tautan internal, tiga tautan referensi, dan 13 bookmark yang diperiksa tujuannya.
- R-27 PASS: empty/loading/error UI tidak berlaku untuk PDF statis; kasus koneksi scanner terputus dijelaskan pada Bagian 8 dan UAT-12.
- R-28 PASS: tidak ada FAQ atau pertanyaan pengisi template.
- R-32 PASS dalam lingkup dokumen: tidak ada widget atau navigasi aplikasi khusus. Interaksi memakai anotasi tautan PDF standar; aksesibilitas penuh pembaca PDF tidak diklaim.
- R-33 PASS: dokumen dibuat dari source ReportLab; tidak ada patch CSS atau perubahan fitur aplikasi melalui string replacement.
- R-34 PASS: tidak ada theme toggle yang memerlukan mode kedua; halaman berwarna terang untuk dibaca dan dicetak.
- R-35 PASS: PDF berhasil dibangun, dibuka ulang dengan pypdf, dan seluruh halaman final dirender dengan Poppler serta diperiksa secara visual.
- R-36 PASS: seluruh halaman berlabel Usulan rancangan; tidak ada klaim sertifikasi, keamanan teruji, kapasitas, kecepatan, atau pelanggan.
- R-37 PASS: arah dokumen klien teknis ringan dan tiga dial dinyatakan sebelum pembuatan; keputusan desain dicatat di atas.
- R-38 PASS: fungsi sistem disajikan sebagai usulan; ilustrasi kuantitas dan skenario pengujian ditandai sebagai contoh/kriteria penerimaan; tidak ada data yang menyamar sebagai hasil produksi.

## Purpose gate

- R-01 PASS: tidak ada gradient atau glow; aksen hijau tua menandai pengesahan persediaan dan ilustrasi ketersediaan.
- R-04 PASS: tidak ada icon library atau ikon generik; kata dan konektor menyampaikan makna diagram.
- R-06 PASS: alasan Arial embedded dan hierarki regular/bold tertulis; tidak ada judul monospace atau tracking ekstrem.
- R-07 PASS: latar putih tanpa grid, pola titik, atau tekstur blueprint.
- R-08 PASS: semua panah dipakai untuk arah data dan alur pekerjaan; tidak ada panah dekoratif pada tombol.
- R-09 PASS: tidak ada capsule badge atau eyebrow pill.
- R-10 PASS: tidak ada glassmorphism.
- R-12 PASS: tidak ada bayangan elemen.
- R-13 PASS: tidak ada glow.
- R-14 PASS: kotak menandai komponen atau tahap proses yang terhubung, bukan kartu fitur; matriks dipakai untuk modul, data, dan skenario yang memang perlu dibandingkan.
- R-19 PASS: tidak ada animasi pada dokumen statis, sesuai lingkup MOTION 1.
- R-22 PASS: hanya diagram arsitektur dan proses yang berhubungan langsung dengan materi; tidak ada ilustrasi pengisi.

## Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 2 / MOTION 1 ditetapkan sebelum authoring.
- Konsistensi dials PASS: judul tenang, komposisi berubah menurut isi, dokumen tetap statis.
- Focal point PASS: setiap halaman berpusat pada satu isi utama; halaman 11-12 berpusat pada hasil penerimaan dan bukti pengujiannya.
- Whitespace PASS: jarak membedakan judul, diagram, penjelasan, dan footer; tidak dipakai untuk mengisi halaman kosong.
- Aksen PASS: hijau tua terbatas pada pengesahan stok, ilustrasi ketersediaan, dan penomoran langkah kontrol.
- Motif PASS: penomoran bagian/gambar, jalur pergerakan stok, dan pemisahan saldo-reservasi-mutasi mengikat struktur tiga belas halaman.
- Design Read PASS: tipe dokumen, pembaca, bahasa visual, dan dials diumumkan sebelum pembuatan.

## Craftsmanship dan quality locks

- C-1 PASS: pilihan format, warna, huruf, komposisi, konektor, dan bentuk dijelaskan satu per satu.
- C-2 PASS: 27 anotasi tautan dan 13 bookmark mempunyai tujuan yang diperiksa; tidak ada kontrol palsu.
- C-3 PASS: struktur formal mencakup ringkasan, ruang lingkup, arsitektur, modul/data, proses, transaksi, integrasi, UAT, dan keputusan; tidak ada promosi pengisi.
- C-4 PASS dalam lingkup PDF: delapan halaman potret dan lima halaman lanskap A4 memiliki header/footer konsisten; ketahanan UI responsif tidak diklaim.
- C-5 PASS: ilustrasi diberi label, arsitektur disebut usulan, dan kemampuan implementasi tidak dinyatakan telah diuji.
- R-05 PASS: komposisi berubah dari diagram komponen ke matriks, flowchart bercabang, alur kontrol, dan sequence diagram; jumlah tahap mengikuti proses aktual yang dirancang.
- R-11 PASS: tidak ada pill atau rounded card berulang; persegi menyatakan batas komponen diagram.
- R-15 PASS: tidak ada CTA generik; dokumen langsung berisi materi arsitektur.
- R-16 PASS: tidak ada jargon promosi seperti seamless, revolutionary, next generation, atau AI powered.
- R-20 PASS: bentuk dokumen mengikuti stok, dokumen, dan alur gudang; tidak memakai shell landing page atau dashboard.
- R-21 PASS: halaman terang dipilih untuk presentasi dokumen dan cetak; theme switch tidak berlaku.
- R-29 PASS: satu aksen hijau tua ditambah netral arang, abu-abu, dan putih; tidak ada palet warna bebas.
- R-30 PASS: dokumen tidak menyalin tampilan produk populer atau template merek lain.
- R-31 PASS: keputusan utama beserta alasan satu baris dicatat pada bagian Arah dan alasan desain.

## UI dan copy supplement

- UI palette PASS: palet berasal dari arah dokumen cetak yang dituliskan, bukan gradient default.
- UI accent PASS: warna aksen menandai pengesahan dan ketersediaan stok; elemen umum memakai netral.
- UI composition PASS: susunan mengikuti isi laporan; dua matriks UAT berbagi kolom agar mudah dibandingkan.
- UI decoration PASS: tidak ada emoji, ikon AI, status dot, glass, glow, bento, fake terminal, atau stripe dekoratif.
- UI behavior PASS: daftar isi, tautan kembali, bookmark, dan referensi menggunakan tujuan PDF yang diverifikasi.
- UI data PASS: tidak ada angka dashboard, feed, delta, pelanggan, atau isi field fiktif.
- UI states PASS dalam lingkup PDF: dokumen statis tidak memiliki state aplikasi, breakpoint, atau form.
- Copy facts PASS: detail merupakan usulan desain dari percakapan; angka ilustrasi bukan data perusahaan; skenario belum dinyatakan sebagai hasil uji sistem yang dibangun.
- Copy voice PASS: judul menyebut isi secara langsung, istilah teknis dijelaskan lewat tugas atau kalimat pendek.
- Copy rhythm PASS: tidak ada penutup chatbot, aphorism, signposting promosi, atau kalimat singkat teatrikal.
- Copy emphasis PASS: bold terbatas pada label dan judul; paragraf tidak membold setiap istilah.
- Copy punctuation PASS: tidak ada em/en dash dan kutipan berlebih.
- Copy claims PASS: dokumen menyebut usulan rancangan; kesiapan produksi, akurasi, dan performa tidak diklaim.

## Bukti verifikasi

- PDF final: `../arsitektur-inventory-wms.pdf`, 13 halaman A4; delapan potret dan lima lanskap.
- Source aktif: `build_inventory_architecture_formal.py`; source versi detail sebelumnya dipakai sebagai data skenario melalui parsing literal, tanpa menjalankannya.
- Pemeriksaan terstruktur: `validation.json`; 27 anotasi tautan, 24 tujuan internal terverifikasi, 13 bookmark terverifikasi, 0 blok teks bertumpuk, dan UAT-01 sampai UAT-14.
- Kontras: teks utama 14,83:1; teks pendukung di putih 6,90:1; di latar netral 6,25:1; aksen di latar 8,42:1.
- Seluruh halaman dirender dengan Poppler pada 110 dpi dan diperiksa; perubahan terakhir diperiksa ulang pada halaman terkait.
- Pemeriksaan ini menilai artefak dokumen, bukan hasil pengujian implementasi WMS.
- Matriks penerimaan memuat 7 skenario operasional dan 7 skenario gangguan, masing-masing dengan hasil yang wajib dipenuhi serta cara membuktikannya.
