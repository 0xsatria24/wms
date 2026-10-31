# Review revisi Stock position

29 Oktober 2026. Built-in Image Gen dipakai untuk merevisi arah Clear Operations yang dipilih pengguna. Prompt awal memakai konsep terpilih dan dua referensi ERP asli sebagai input gambar. Revisi lanjutan memakai gambar revisi tersebut sebagai input langsung. Prompt tersimpan di prompt.txt.

## Inspeksi raster yang dilakukan

- Gambar final ditinjau dalam hasil tool: English menjadi bahasa utama, pilihan English dan Bahasa Indonesia (santai) terlihat.
- Tabel memiliki Item, Location, Condition, Reserved for orders, Available, Unit. Tidak ada Fisik/Physical.
- SKU-A 24/76, SKU-B 8/0, SKU-C 8/0 sesuai fixture. Condition Good/Not good terlihat.
- Placeholder gambar berada di kolom Item; header produk memiliki Add image dan Optional image. Category/Base unit/Dimensions/Unit weight terlihat; nilai kosong bukan angka buatan.
- Panel tren tidak mengulang saldo tabel. YTD 1,100/+10%; MoM +20%; YoY +25%; periode pembanding dan scope All locations terlihat.
- Titik bulanan yang diberi angka sesuai fixture; Oktober partial memakai garis putus-putus, baseline nol terlihat.
- Teks utama, chart dan tombol tidak terlihat terpotong pada raster yang ditampilkan. Foto produk memang belum diisi, bukan aset yang gagal dimuat.

## Pemeriksaan terstruktur

Hasil hitung fixture dan kontras pasangan token ada di checks.json. Itu menguji nilai rancangan JSON, bukan mengekstrak warna atau font aktual dari raster generatif. Font, radius, spacing dan breakpoint pada tokens.json adalah target spesifikasi; belum ada bukti implementasi memakainya.

## Hal yang perlu dirapikan saat perluasan

- Menu Language harus menjadi pilihan eksklusif dengan radio/checkmark sesuai spesifikasi; glyph kotak kosong yang masih tampak pada opsi kedua di raster jangan ditiru sebagai multi-select.
- Tabel mempunyai tiga data simulasi sehingga ruang kosong besar; kepadatan perlu ditinjau lagi dengan daftar panjang tanpa mengurangi keterbacaan label Reserved for orders.
- Slot gambar target 40/64 px adalah ukuran rancangan, bukan pengukuran presisi screenshot.
- Preview upload, error, penggantian/penghapusan gambar, editor master, bahasa Indonesia penuh, responsif dan state analisis kosong/gagal belum dibuat sebagai layar terpisah. Kontraknya dicatat dalam spesifikasi; jangan menganggap interaksi tersebut sudah berjalan.
- Kalender, metric Shipped units, zona waktu cutoff serta batas file adalah asumsi desain untuk ditetapkan bersama kebutuhan operasional.

Belum dilakukan browser interaction test, backend verification, upload nyata, physical scanner test atau UAT. D01–D05 dan T01–T08 tidak ditutup oleh revisi visual ini.
