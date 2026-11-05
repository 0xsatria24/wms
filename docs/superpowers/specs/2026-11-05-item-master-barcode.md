# Barcode Item Master

Keputusan pengguna: barang dapat didaftarkan tanpa mengetik barcode. Barcode yang sudah ada dimasukkan lewat scan; barang tanpa barcode mendapat kode internal otomatis saat disimpan. Manual menjadi opsi cadangan.

- Default barang baru: Buat otomatis. Alternatif: Scan barcode yang sudah ada.
- Tahap pertama mendukung scanner USB/Bluetooth yang mengirim karakter seperti keyboard dan akhiran Enter. Scan kamera di luar lingkup tahap ini.
- Scan hanya mengisi identitas barang; tidak menyimpan form atau mengubah stok.
- Kode internal memakai namespace `IW-`, bukan GTIN resmi; label menggunakan unduh/cetak yang sudah tersedia.
- Barcode lama tetap sama ketika mengedit barang. Penggantian harus disengaja dan tetap memerlukan alasan/audit.
- Pertahankan nol awal, keunikan barcode, pemeriksaan bentrok SKU/barcode, hak akses, dan draf.
- Usulan teknis: server menghasilkan kode saat create; pengulangan request untuk SKU yang sama tidak menghasilkan kode pengganti atau menimpa data berbeda.
