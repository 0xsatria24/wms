# Clear Operations — Stock position revision 01

Status: opsi pertama dipilih pengguna; revisi desain statis 29 Oktober 2026. Belum implementasi.

Revisi ini menggantikan rancangan Posisi stok pada konsep pertama. Gambar konsep awal dan blueprint lama tetap menjadi arsip, bukan sumber label atau komposisi terbaru layar ini.

[Desain layar](stock-position-en.png) · [Spesifikasi](stock-position.md) · [Bahasa dan mikrocopy](localization.md) · [Token rancangan](tokens.json) · [Data simulasi](fixtures.json) · [Review](review.md) · [Prompt generasi](prompt.txt)

## Keputusan pengguna

1. Panel detail item menjadi analisis tren YTD, YoY, MoM, bukan pengulangan isi tabel.
2. Kolom Fisik dihapus dari tabel; Condition memakai Good / Not good. Komitmen menjadi Reserved for orders; versi Indonesia tepat **Dipesan**.
3. Bahasa default English; pilihan Bahasa Indonesia (santai) tersedia di Settings → Language.
4. Panel produk juga menampilkan spesifikasi. Foto produk opsional, dengan Add image di detail dan thumbnail/placeholder pada kolom Item.

Gambar `stock-position-en.png` adalah revisi terkini dengan spesifikasi dan foto opsional. `stock-position-en-pre-image-revision.png` menyimpan tahap sebelum tambahan tersebut.

## Batas desain saat ini

Metrik tren contoh adalah Shipped units: jumlah pengiriman terkonfirmasi. Pemilihan metrik ini merupakan asumsi desain, bukan keputusan pengguna mengenai KPI operasional. Semua angka merupakan Simulation data. YTD memakai kalender Januari–Desember sebagai asumsi.

Revisi visual ini belum merupakan desain rinci lengkap untuk seluruh 21 fungsi. Ketentuan bahasa dan token menjadi dasar perluasan arah yang dipilih. Dokumen kebutuhan dan arsitektur tidak ditulis ulang; D01–D05 dan T01–T08 tetap mengikuti status terbuka sumbernya.
