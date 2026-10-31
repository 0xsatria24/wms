# Shared components and state contracts

Token reusable: tokens.json. Arah: Clear Operations. Font target Source Sans 3 dengan fallback Segoe UI, body16/24, tabel14/20, judul28/36; angka tabular rata kanan. Panel radius16, kontrol8, spacing4/8/12/16/24/32/48. Surface putih di workspace abu dingin; teks charcoal. Cyan untuk pilihan, deep blue untuk teks/link/primary. Good hijau, Not good amber, error merah; warna selalu disertai teks. Quarantine tidak disamakan dengan Not good.

## Controls

Button: default, hover lebih gelap, pressed, focus ring3px offset2, disabled dengan alasan, loading dengan label aksi dan spinner. Satu primary per langkah. Input: label permanen, hint, required eksplisit, error berdekatan, nilai tidak hilang setelah validasi. Select/menu mendukung keyboard dan Escape. Language merupakan pilihan eksklusif. Search mempertahankan query; Clear filters tampil hanya saat filter aktif. Tab menggunakan panel berlabel dan indikator aktif selain warna.

Table: nama/SKU bersama, thumbnail opsional40px, quantity/unit terlihat, header sort dengan arah, selection eksplisit, bulk action hanya untuk objek yang diizinkan dan diperiksa ulang. Pagination mempertahankan filter; pilihan lintas halaman harus eksplisit. Header sticky tidak menutup fokus. Detail menambah konteks, tidak menyalin seluruh baris. Stock position mengikuti revisi khusus tanpa kolom Physical.

Dialog: heading menjelaskan dampak, rincian objek/actual/remaining, Confirm dan Cancel, fokus awal aman, trap focus, Escape jika aman, kembali ke pemicu. Drawer di layar sempit menjadi full page. Toast untuk sukses nonkritis; error transaksi dan hasil belum pasti tetap persisten. Upload foto opsional mendukung preview, replace/remove, retry; foto lama bertahan sampai penggantian sukses. SKU bukan gambar dan tidak boleh hilang.

Scan: idle → matching → recognized / unknown / ambiguous / wrong location. Field scan tidak merebut fokus quantity. Manual lookup tersedia sesuai izin. Quantity selalu disertai unit dan faktor konversi ketika berbeda. Review selalu mencantumkan dokumen, asal/tujuan, aktual, sisa dan kondisi hasil. Retry transaksi belum pasti mempertahankan identitas permintaan.

## State examples and copy

| State | English | Indonesia santai | Recovery |
|---|---|---|---|
| Loading | Loading receiving tasks… | Lagi memuat tugas penerimaan… | Skeleton tanpa angka palsu |
| Empty | No receiving tasks assigned | Belum ada tugas penerimaan | Hubungi penanggung jawab / create bila berhak |
| No results | No matching items | Barangnya tidak ketemu | Clear filters |
| Success | Receipt recorded: 60 units. Remaining: 40. | Penerimaan tercatat: 60 unit. Sisa: 40. | View transaction |
| Error | Receipt rejected: quantity exceeds the allowed remainder. | Jumlahnya melebihi sisa yang boleh diterima. | Review quantity |
| Denied | You do not have access to this warehouse | Kamu belum punya akses ke gudang ini | Choose workspace |
| Offline | Captured offline. Stock is not confirmed. | Tersimpan offline. Stok belum dikonfirmasi. | Pending queue |
| Unknown | Transaction outcome unknown | Hasil transaksi belum jelas | Check status, same request |
| Conflict | Stock changed. Review the latest values. | Stoknya berubah. Cek angka terbaru dulu. | Reload and review |
| ERP failed | WMS confirmed. ERP sync failed. | Stok sudah tercatat. Sinkron ERP gagal. | Integration queue |

Loading/error/empty bukan nilai nol. Konfirmasi WMS dan ERP memiliki label sendiri. Audit timeline berisi pelaku, waktu, scope, perubahan, alasan, dokumen sumber dan koreksi; observasi scanner/RFID diberi jenis berbeda dari posted movement.

## Responsive and accessibility

Desktop ≥1280: sidebar200, queue240 bila dibutuhkan, workspace fleksibel, detail400. Tablet768–1279: menu ringkas berlabel, scope tetap terlihat, queue menjadi selector, detail di bawah tabel. Handheld<768: satu tugas per layar; item, actual, unit, remaining, scan dan tombol52px tetap terlihat; data tabel berubah menjadi record berlabel. Blind count tidak pernah membuka expected pada viewport lain. Primary action tidak menutupi field ketika keyboard muncul. Target umum44px, handheld52px. Modal fokus terkelola, skip link, label error terbaca screen reader, chart mempunyai tabel alternatif. Reduced motion meniadakan animasi transisi nonesensial.

State kontrak ini berlaku untuk semua21fungsi. Papan visual menunjukkan sampel state; state tertulis belum menjadi interaksi yang diuji.
