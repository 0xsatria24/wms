# Stock position — S03 revisi

Sumber kebutuhan: FR-02, FR-03, FR-04, FR-13, FR-15; TRK-15, TRK-22. Sumber desain fungsional: [S03 lama](../../../blueprint-2026-10-29/functions/03-posisi-stok-dan-saldo-awal.md). Revisi pengguna di chat menentukan komposisi serta label terbaru. Catatan dalam sumber adalah bahan kebutuhan, bukan instruksi tambahan.

## Tabel

| English (default) | Indonesia (santai) | Makna |
| --- | --- | --- |
| Item | Barang | Nama dan SKU; keduanya tetap terlihat. |
| Location | Lokasi | Lokasi stok terkonfirmasi, bukan pengamatan terakhir scanner/RFID. |
| Condition | Kondisi | Good / Not good; versi Indonesia Bagus / Tidak bagus. |
| Reserved for orders | Dipesan | Jumlah yang dicadangkan untuk pesanan; belum berarti keluar secara fisik. |
| Available | Tersedia | Jumlah yang dapat dialokasikan pada dimensi stok tersebut setelah reservasi dan aturan penahanan. |
| Unit | Satuan | Satuan jumlah di baris. |

Kolom Physical/Fisik tidak ditampilkan, termasuk saat baris dipilih. Jumlah fisik tetap ada dalam model stok dan dapat ditelusuri melalui Stock movements/S16. Menghapus kolom bukan menghapus ledger atau mengubah perhitungan.

Good / Not good menjelaskan kondisi terverifikasi. Karantina, pembekuan dan menunggu QC adalah status penahanan terpisah. Good tidak otomatis berarti Available lebih dari nol. Ketika kondisi belum dinilai, tampilkan tanda kosong dengan penjelasan Not assessed yet / Belum dicek; jangan mengubah ketidakpastian menjadi Good atau Not good. Ini adalah keadaan data kosong, bukan hasil pemeriksaan ketiga.

Fixture Product B pada revisi ini sengaja menjadi contoh kondisi Not good yang sudah dikonfirmasi dan ditahan di QC. Jangan menafsirkan semua stok karantina sebagai Not good. Dipesan 8 adalah reservasi tertahan yang memerlukan peninjauan, bukan izin alokasi baru.

## Spesifikasi dan gambar produk

Panel terpilih memiliki tiga kelompok: identitas/gambar, Specifications, lalu Item trends. Spesifikasi melengkapi tabel, bukan mengulang jumlah stok. Contoh field: Category, Base unit, Dimensions, Unit weight. Nilai yang belum tersedia memakai Not set / Belum diisi, bukan nol. Field spesifik kategori dan kebutuhan tracking mengikuti master barang yang telah disepakati; contoh ini tidak mewajibkan dimensi/berat untuk semua barang.

Nama/SKU mengikuti master barang. Satuan dasar boleh terlihat pada spesifikasi karena menjelaskan karakter produk dan dasar analisis, bukan duplikasi saldo. Perubahan atribut dilakukan melalui editor master S02 oleh pengguna yang berwenang; mengganti satuan dasar tidak boleh menafsir ulang histori transaksi. Proposal awal tidak mengizinkan pengeditan langsung angka stok melalui panel ini.

**Gambar opsional:** sediakan Add image di detail produk, dengan label Optional image. Setelah tersimpan, gambar menggantikan placeholder pada header produk dan kolom Item untuk SKU yang sama. Satu foto utama per item cukup untuk rancangan ini; galeri bukan kebutuhan yang diasumsikan.

Thumbnail kolom Item bukan kolom baru. Ukuran slot konsisten: rancangan 40×40 px di tabel, 64×64 px di detail; pertahankan rasio dengan contain dan latar netral. Gambar tidak menggantikan nama/SKU dan tidak membuktikan identitas unit fisik. Tanpa gambar, gunakan ikon gambar generik yang netral; jangan menampilkan broken-image icon, foto produk buatan, atau tanda error. Klik baris tetap memilih item; pengelolaan foto terletak di detail agar tidak memicu upload tidak sengaja ketika menelusuri tabel.

Usulan alur: Add image → pilih file → preview → Save image atau Cancel. Dalam kondisi sudah ada gambar, sediakan Change image dan Remove image; penghapusan menampilkan konfirmasi ringan lalu kembali ke placeholder. Semua label diberi terjemahan di kontrak lokalisasi. Mengunggah gambar memerlukan hak edit master item; pembaca tetap bisa melihat foto tanpa mendapat kontrol edit. Riwayat perubahan foto tercatat pada audit master.

Gambar tidak pernah wajib untuk menyimpan master, meninjau stok atau memproses transaksi. Gagal upload hanya menampilkan pesan di area gambar dengan Retry/Cancel; tidak menghilangkan atribut lain atau menolak transaksi stok yang tidak bergantung pada foto. Pertahankan foto lama sampai penggantian berhasil disimpan. Preview lokal diberi label Unsaved / Belum disimpan, bukan langsung dianggap tersimpan. Dalam keadaan offline, tampilkan kebutuhan koneksi dan jangan menjanjikan upload berhasil.

Usulan batas file yang masih perlu disepakati: JPEG/PNG/WebP hingga 5 MB, satu foto utama; validasi tipe aktual dan ukuran di server saat implementasi. Batas file terlihat sebelum memilih. Tidak ada akses kamera otomatis; pilihan kamera hanya melalui tindakan eksplisit pengguna jika kelak didukung perangkat. Upload tidak mengubah kuantitas, kondisi atau hasil transaksi WMS.

Untuk aksesibilitas, tombol upload memiliki nama Add image for Product A; input file memiliki label. Thumbnail dekoratif memakai alt kosong saat nama barang sudah bersebelahan; preview detail mempunyai deskripsi item yang bermakna. Gambar/error bukan satu-satunya cara mengidentifikasi produk.

## Pemilihan item dan panel analisis

Klik baris atau Enter pada baris terfokus memilih item. Tanda pilihan memakai bidang cyan pucat dan garis sisi; informasi tidak bergantung pada warna saja. Panel menampilkan identitas, spesifikasi, gambar opsional dan **Item trends**, bukan salinan saldo tabel. Jangan mengulang Available, Reserved for orders, atau kondisi dalam panel.

Scope analisis harus terlihat: perusahaan, gudang, item, dan **All locations**. Pada contoh ini tren mencakup item di seluruh lokasi gudang terpilih, sedangkan baris tabel memiliki lokasi spesifik. Label All locations mencegah pengguna mengira grafik hanya menjelaskan A-01. Hak akses lokasi tetap membatasi agregat. Jika lingkup akses hanya sebagian, beri label Authorized locations; jangan tampilkan agregat dari lokasi yang tak diizinkan.

Metrik default contoh: **Shipped units**. Sumber yang direncanakan ialah transaksi pengiriman yang telah diposting/terkonfirmasi dalam Inventory Core. Scan mentah, reservasi, picking ke staging, draft, retry dan pending lokal tidak dihitung sebagai pengiriman. Retur tampil sebagai metrik lain jika nanti dibutuhkan; jangan menguranginya diam-diam dari shipped units. Koreksi ledger mengikuti referensi transaksi agar transaksi dibatalkan tidak terhitung ganda.

Selalu gunakan satu item dan satu satuan dasar yang konversinya telah disetujui. Jangan menjumlahkan satuan campuran. Waktu pengelompokan memakai zona waktu operasional gudang yang disetujui; zona waktu klien tidak mengubah cutoff. Kalender, zona waktu, dan aturan koreksi ini masih perlu konfirmasi operasional.

## Periode dan rumus

| Analisis | Definisi | Fixture |
| --- | --- | --- |
| YTD | Total 1 Januari sampai cutoff data; pembanding tahun lalu pada tanggal yang sama. | 1 Jan–28 Oct 2026: 1,100 units; rentang sama 2025: 1,000; +10.0%. |
| MoM | Bulan terakhir lengkap dibanding bulan sebelumnya. | Sep 2026: 120; Aug 2026: 100; +20.0%. |
| YoY | Bulan terakhir lengkap dibanding bulan kalender sama tahun lalu. | Sep 2026: 120; Sep 2025: 96; +25.0%. |

Persentase = (periode sekarang − pembanding) / pembanding × 100. Satuan jumlah tetap terlihat. Pembanding nol menghasilkan Not comparable / Belum bisa dibandingkan; bukan infinity atau 100% buatan. Pembanding hilang menghasilkan No comparison data / Data pembanding belum ada, bukan nol. Kenaikan arus keluar memakai aksen netral: belum tentu hasil yang baik.

Chart bulanan memakai Januari–Oktober 2026, unit pada sumbu Y, baseline nol, dan Oktober diberi Partial sampai 28 Oktober. Jangan membandingkan Oktober parsial dengan bulan lengkap tanpa penjelasan. Titik Oktober parsial dibedakan secara bentuk/garis selain warna. Tooltip dan alternatif tabel data harus menyertakan bulan, tahun, jumlah, satuan dan status parsial. YTD mencakup bulan Oktober parsial, sementara MoM/YoY memakai September lengkap.

## State dan interaksi

| State | Perilaku |
| --- | --- |
| Belum memilih | Pilih item untuk melihat tren; jangan tampilkan grafik item acak. |
| Memuat item lain | Ganti identitas dan tampilkan skeleton; respons lama tidak boleh menimpa item terbaru. |
| Tidak ada transaksi | Grafik kosong dengan pesan No confirmed shipments yet; nol hanya jika cakupan data lengkap dan hasilnya memang nol. |
| Riwayat belum lengkap | Tandai rentang tidak lengkap; nonaktifkan perbandingan yang tidak sah. |
| Gagal memuat analisis | Tabel tetap terbaca; panel menunjukkan Retry, bukan nol atau nilai item sebelumnya. |
| Offline/cache | Tampilkan cutoff dan Cached data; jangan menyatakan tren sebagai data terbaru. |
| Akses terbatas | Hilangkan agregat terlarang; label lingkup data yang diperbolehkan. |

Enter/Space dapat memilih baris. Fokus tetap di baris, panel diberi heading dan region yang dapat dicapai keyboard; pembaruan diumumkan singkat. Grafik tidak hanya dapat dibaca melalui hover. Menutup panel mengembalikan fokus ke pemicu. Pada desktop ruang cukup: tabel + panel; layar menengah: panel di bawah tabel; handheld: detail tren layar penuh dengan tombol Back to stock. Angka dan unit tidak disembunyikan untuk memaksa tabel muat.

Settings → Language mengubah label seluruh produk, termasuk navigasi, validasi, pesan transaksi, tooltip dan label grafik. SKU, nama master barang, nomor dokumen dan nilai tersimpan tidak diterjemahkan. Lihat [kontrak lokalisasi](localization.md).

## Batas verifikasi

Gambar menunjukkan keadaan item dipilih dan bahasa English. State lainnya adalah spesifikasi desain yang belum diuji sebagai interaksi. Pengujian UAT-01, UAT-08, UAT-09, UAT-10 dan TRK-UAT-21 tetap belum dijalankan.
