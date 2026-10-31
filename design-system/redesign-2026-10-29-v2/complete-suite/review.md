# Review desain — 29 Oktober 2026

Status: seluruh 21 fungsi memiliki spesifikasi dan konsep layar; autentikasi, komponen, tablet dan handheld mendapat contoh tambahan. Paket adalah draf desain lengkap cakupan fungsi, belum spesifikasi visual final yang bebas temuan.

Inspeksi dilakukan terhadap lima papan hasil Image Gen. Bahasa utama English, keluarga warna dan panel mengikuti Clear Operations. Foto tetap opsional. Stock position memakai Reserved for orders/Available dan analisis tren. Registrasi tidak memberi hak admin otomatis. WMS dan ERP dipisahkan. Pilot RFID diberi label opsional. Semua data pada paket adalah simulasi, termasuk angka pada layar yang tidak menampilkan badge secara konsisten.

Perbaikan visual yang dilakukan: saldo pembanding dan tombol Approve dikeluarkan dari operator blind count; ringkasan pengiriman diubah menjadi Ready to ship; ledger dikoreksi menjadi dua mutasi +60/-20 dengan saldo40; bukti restore tidak diklaim sudah diuji. Board05 memperbaiki form registrasi dengan Confirm password dan login dengan Show password tidak tercentang. **Untuk autentikasi gunakan board05 sebagai rujukan terbaru**, bukan detail form board01.

## Temuan yang masih terbuka sebelum implementasi

- Papan merupakan overview beberapa layar. Ukuran output aktual tidak selalu sama dengan ukuran yang diminta; teks kecil harus ditinjau ulang pada desain layar individual sebelum handoff implementasi.
- Beberapa sidebar generatif masih menyorot Inventory untuk modul lain; active state harus mengikuti route sesuai judul layar.
- Board02 memadukan input aktif dan contoh hasil/error. Alert shortage120 tidak merujuk input30; perlakukan sebagai contoh state terpisah, bukan satu keadaan transaksi. Receiving draft tidak boleh disebut sudah terposting.
- Board03 masih menampilkan daftar shipment historis di bawah review transaksi baru. Scope order aktif harus dibuat eksplisit agar total historis tidak dianggap kuantitas yang akan dikirim ulang.
- Contoh tablet/handheld board05 memerlukan normalisasi fixture: input qty, daftar aktual dan total tidak boleh tampil sebagai satu transaksi yang ambigu. Kontrak Actual/Remaining dan sumber hasil server dalam spesifikasi mengikat.
- Beberapa teks/dimensi master yang diisi otomatis dalam gambar bukan data bisnis yang disetujui. Nilai yang tidak tersedia menggunakan Not set sesuai revisi S03.
- Menu bahasa harus single-select; ikon checkbox dalam sebagian raster tidak berarti kedua bahasa dapat aktif bersamaan.
- Warna dan ukuran raster belum diukur sebagai kepatuhan aksesibilitas. Token telah memiliki pemeriksaan tersendiri pada revisi S03; itu tidak membuktikan semua piksel papan lulus kontras.

Belum ada implementasi, browser interaction test, upload foto nyata, scanner/reader test, backend verification atau UAT. D01–D05 dan T01–T08 tetap terbuka. Spesifikasi exception merupakan kontrak desain; tidak semua exception sudah memiliki layar individual beresolusi penuh.
