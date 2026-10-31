# Design Brief Document

ID: INV-WMS-DES-001. Versi draf: 0.5. Tanggal: 28 Oktober 2026.

Dokumen ini menetapkan kebutuhan interaksi untuk [App Flow](03-app-flow.md). Pengguna sudah memberikan referensi visual ERP dan memilih nada Ledger yang tenang. Merek final dan dukungan perangkat masih terbuka. Prototipe lokal tersedia pada [design system](../../design-system/README.md); UI aplikasi produksi belum diimplementasikan.

Mengikuti [acuan proses rekayasa](engineering-basis.md), kebutuhan pengguna diperjelas dengan acuan ISO/IEC/IEEE 29148:2018; peninjauan desain dan uji tugas mendukung validasi sistem dalam proses ISO/IEC/IEEE 15288:2023. Keputusan tampilan harus dapat dihubungkan dengan kebutuhan dan pekerjaan pengguna.

## Arah yang sudah diberikan

Pengguna menginginkan bahasa Indonesia yang profesional, teknis tetapi mudah dipahami klien, serta penerapan antislop core dan UI dalam mode `during`. Untuk dokumen perencanaan ini, struktur mengikuti keputusan dan pekerjaan gudang yang harus dijelaskan. Tabel dipakai untuk membandingkan kontrak; diagram dipakai ketika percabangan atau urutan lebih mudah dibaca secara visual.

Rancangan interaksi berfokus pada mengenali barang dan lokasi, mencatat aktual, lalu melihat hasil konfirmasi server. Pengguna menegaskan bahwa screenshot hanya inspirasi. Keterbacaan tabel dan kepadatan informasi menjadi masukan; komposisi, warna dan data screenshot tidak disalin. [DESIGN.md](../../DESIGN.md) mencatat arah serta alasan desain. Logo dan merek perusahaan belum ditentukan.

Sebagai batas awal jika konsep visual dibuat sebelum arah merek tersedia, konsep harus berlabel **draft without direction** dengan ENERGY 1 / RHYTHM 1 / MOTION 1. Nilai ini adalah batas konservatif untuk draf, bukan persetujuan tampilan akhir. Antarmuka produksi memerlukan penetapan arah dan pemeriksaan visual tersendiri.

## Proposal design system saat ini

Draf Ledger direvisi dengan navigasi modul di kiri, judul halaman dan aksi penerimaan, serta kelompok filter di atas tabel. Putih hangat, graphite dan teal tua mengikuti pilihan Ledger pengguna. Kolom fisik/komitmen/bebas dan review transaksi mengikuti kebutuhan stok. Data dan tindakan tetap berupa simulasi berlabel. Komposisi baru belum dirender atau diverifikasi melalui browser.

Pemeriksaan katalog dicatat pada [laporan design system](../../design-system/review.md). Verifikasi browser lengkap belum selesai karena pembatasan lingkungan browser. Hasil yang tersedia menilai source, token dan render awal; hasil tersebut tidak membuktikan transaksi backend, keamanan, integrasi ERP atau dukungan scanner fisik.

## Pekerjaan layar dan keputusan pengguna

| Layar usulan | Pekerjaan pengguna | Informasi yang mendapat prioritas | Aksi utama |
|---|---|---|---|
| Antrean receiving | Menentukan kedatangan yang akan diproses | Referensi, gudang, baris terbuka, sisa dan pengecualian | Buka penerimaan |
| Receiving aktual | Memastikan barang dan jumlah yang diterima | Hasil scan, satuan, konversi, aktual, sisa dan kondisi awal | Konfirmasi penerimaan |
| Antrean QC | Menemukan barang tertahan yang harus diperiksa | Barang, batch/serial, jumlah, alasan dan lama tertahan | Catat hasil inspeksi |
| Tugas operator | Menjalankan tugas yang ditetapkan | Lokasi asal/tujuan, barang, jumlah dan status yang menghalangi | Scan dan konfirmasi aktual |
| Packing / shipment | Memastikan isi yang akan dikirim | Order, paket, actual picked, komitmen dan kondisi terbaru | Konfirmasi pengiriman |
| Transfer | Memeriksa perpindahan yang belum selesai | Dikirim, diterima, sisa perjalanan dan selisih | Terima aktual / tinjau selisih |
| Opname | Menghitung fisik sesuai lingkup | Lokasi, barang, satuan dan isian aktual tanpa saldo pembanding | Kirim hasil hitung |
| Persetujuan selisih | Menilai alasan dan dampak koreksi | Snapshot, aktual, selisih, bukti dan pelaku | Setujui atau kembalikan |
| Kartu stok | Menelusuri penyebab saldo | Dimensi stok, mutasi, sumber, pelaku dan waktu | Buka transaksi sumber |
| Integrasi bermasalah | Menyelesaikan sinkronisasi yang tertahan | Objek, versi, error, percobaan dan kebutuhan rekonsiliasi | Retry atau catat rekonsiliasi |

Angka ringkasan hanya ditambahkan jika membantu keputusan pada layar itu dan sumber perhitungannya jelas. Grafik, tren, aktivitas pengguna dan angka operasional tidak diisi dengan data rekaan. Data demo harus berlabel **Data simulasi** di tempat yang terlihat.

## Hierarki informasi

Pada konfirmasi stok, pengguna harus dapat membaca perusahaan/gudang, dokumen, barang, lokasi, aktual dan satuan sebelum menekan aksi. Kondisi barang dan hambatan pemenuhan ditampilkan dekat jumlah yang terdampak.

Nomor dokumen dan kode barang dapat disalin. Nama barang tetap terlihat agar pengguna dapat membedakan barcode yang mirip. Jumlah ditata dengan pemisah yang konsisten; jumlah input dan hasil konversi diberi label terpisah. Aplikasi tidak menyembunyikan konversi di tooltip sebagai satu-satunya penjelasan.

Daftar operator mengutamakan tugas berikut dan hambatan nyata. Daftar supervisor mengutamakan keputusan yang tertahan. Susunan akhir ditetapkan setelah observasi atau uji tugas pada perangkat yang dipilih, bukan karena semua modul harus memakai susunan halaman yang sama.

## Bahasa dan label

| Hindari ambiguitas | Label atau pesan usulan | Alasan |
|---|---|---|
| Stok tanpa dimensi | Fisik / Komitmen / Bebas untuk alokasi | Angka menjawab pertanyaan berbeda |
| Selesai untuk semua tahap | Penerimaan tercatat; ERP menunggu | Hasil lokal dan integrasi terpisah |
| Disimpan pada scan offline | Scan pending; stok belum dikonfirmasi | Pengguna memahami batas bukti lokal |
| Gagal pada timeout yang tidak pasti | Hasil konfirmasi belum diketahui. Periksa hasil atau coba kembali | Server mungkin sudah commit |
| Error stok generik | Stok layak berubah. Muat ulang dan tinjau alokasi | Ada langkah lanjutan yang jelas |
| Ya / Tidak pada koreksi | Setujui penyesuaian / Kembalikan untuk ditinjau | Tindakan dan dampaknya terbaca |
| Tersedia tanpa konteks | Bebas untuk alokasi pada gudang dan kondisi terpilih | Pengguna mengetahui batas perhitungan |

Istilah picking, putaway dan short pick dijelaskan pada penggunaan pertama: pengambilan, penempatan, dan pengambilan kurang dari rencana. Kode error teknis dan `request_id` tersedia untuk dukungan tanpa menggantikan pesan operasional.

## Konfirmasi tindakan

Konfirmasi menunjukkan aktual, satuan, asal/tujuan dan sisa yang relevan. Tombol utama memakai tindakan spesifik, seperti **Konfirmasi penerimaan** atau **Kirim hasil hitung**. Koreksi dan penyesuaian menampilkan dampak serta alasan yang diwajibkan.

Selama pengiriman, aplikasi mencegah klik konfirmasi berulang dan menunjukkan proses yang sedang berlangsung. Perlindungan backend tetap wajib. Setelah timeout, aplikasi menampilkan tindakan periksa/retry dengan kunci asli. Menekan ulang tidak membuat transaksi baru secara tersembunyi.

Pembatalan setelah picking menjelaskan kebutuhan pengembalian dan jumlah yang masih terikat. Pengguna tidak melihat stok menjadi bebas hanya karena menutup order di layar.

## Scanner dan perangkat

Jenis scanner, browser, sistem operasi, ukuran layar, kebijakan perangkat bersama dan cara login perlu ditetapkan melalui D05. Tim harus menguji akhiran input scanner, fokus, scan berulang, barcode tidak dikenal, mode input manual dan kehilangan koneksi pada perangkat yang benar-benar dipakai.

Setiap scan menampilkan barang/lokasi yang dikenali dan hasil validasinya. Bunyi atau getaran dapat menjadi umpan balik tambahan jika didukung perangkat; pesan visual tetap harus tersedia. Scan berulang tidak otomatis dianggap unit tambahan sebelum aturan identitas barang dan jumlahnya jelas.

Antrean lokal menunjukkan jumlah item, dokumen/gudang asal dan hasil tiap kiriman. Logout atau perpindahan pengguna tidak boleh mengirim pekerjaan pengguna lama dengan identitas baru secara diam-diam. Kebijakan menyimpan, memulihkan atau menghapus draf perangkat mengikuti D03/D05.

## Aksesibilitas dan perubahan ukuran layar

Persyaratan berikut harus dibuktikan saat UI diimplementasikan:

- Urutan fokus mengikuti langkah pekerjaan; keyboard dapat membuka dan mengonfirmasi tindakan, sementara fokus terlihat.
- Field memiliki label dan error yang terhubung; warna, bunyi atau ikon tidak menjadi satu-satunya penanda status.
- Fokus kembali ke field scan yang tepat setelah hasil dibaca, tanpa menutup akses keyboard ke tindakan koreksi.
- Tabel besar tetap menyediakan cara membaca barang, jumlah dan aksi pada layar scanner yang sempit. Informasi kritis tidak hilang saat kolom disederhanakan.
- Area sentuh, ukuran teks, kontras, pembesaran dan mode pencahayaan diuji pada perangkat sasaran. Nilai kontras aktual dicatat setelah warna dipilih.
- Efek gerak mengikuti kebutuhan umpan balik dan pengaturan pengguna; tidak ada animasi berulang yang mengganggu scan atau hitung.

Persyaratan ini bukan hasil audit aksesibilitas. Belum ada klaim kepatuhan UI yang dapat diberikan.

## Keadaan kosong dan gagal

Setiap layar perlu membedakan belum ada data, filter tanpa hasil, memuat, akses ditolak, kegagalan jaringan, konflik bisnis dan hasil yang belum pasti. Pesan menyebut objek yang bermasalah dan satu tindakan lanjutan yang masuk akal. Rincian contoh ada di [App Flow](03-app-flow.md).

Blind count harus menghilangkan saldo pembanding dari respons yang ditujukan kepada penghitung, bukan hanya menyembunyikan elemen tampilan. Approval melihat bukti dan selisih sesuai peran. UI tidak menampilkan tombol yang memberi kesan kewenangan yang tidak dimiliki pengguna.

## Keluaran desain sebelum pembangunan UI

Setelah arah visual dan perangkat ditetapkan, siapkan rancangan receiving, picking/short pick, pembatalan, opname, serta pending/hasil belum pasti. Gunakan data simulasi berlabel. Tinjau bersama operator dan supervisor, lalu catat keputusan dan koreksi pada flow.

Penerimaan desain memerlukan demonstrasi tugas lengkap pada perangkat sasaran, pemeriksaan setiap kontrol, serta pengujian keyboard, ukuran layar dan keadaan gagal. Dokumen ini menyiapkan kriterianya; belum menyatakan pemeriksaan tersebut lulus.
