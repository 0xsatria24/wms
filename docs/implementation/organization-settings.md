# Pengaturan perusahaan dan gudang

Admin membuka Settings → Company & warehouses (Perusahaan & gudang), mengisi nama perusahaan, nama gudang baru, kode lokasi awal (baris/koma), dan alasan. Perusahaan, gudang, lokasi, grant admin dan audit disimpan dalam satu transaksi. Receiving/QC/Staging dibuat otomatis. Nama/identitas gudang operasional yang sudah ada tidak diganti.

Pengaturan ini memerlukan admin seluruh gudang perusahaan. Nama perusahaan tersimpan dalam aplikasi dan dipakai oleh session/header; konfigurasi instalasi menjadi fallback. ID perusahaan internal dan transaksi lama tetap sama. Kode aktivasi/wizard tetap terpisah, dan provisioning gudang teknis awal instalasi tetap mengikuti konfigurasi IT yang ada.

Pada login SSO admin ketika profil perusahaan belum disimpan, aplikasi membuka Settings. Setelah setup organisasi tersimpan, gudang baru menjadi fallback pilihan workspace jika pengguna belum mempunyai default warehouse sendiri. Lokasi tambahan tetap tersedia di tab Gudang & lokasi.

Verifikasi 3 November 2026: satu tes baru gagal dengan 404 sebelum implementasi; 5 tes organisasi/Settings kemudian lulus, termasuk larangan operator, penyimpanan nama, grant gudang, lokasi awal, dan penolakan replay versi lama. 55 tes frontend dan build TypeScript/Vite lulus. Browser desktop 1440×1000 dan mobile 390×844 diperiksa tanpa menyimpan data organisasi pada database preview; bukti ada di prototype/qa/organization-settings-20261103/. Tidak ada klaim pengujian produksi/UAT. Suite backend penuh belum dijalankan ulang untuk tambahan ini.
