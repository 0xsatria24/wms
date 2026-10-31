# Persiapan pembangunan Inventory + WMS

Tanggal penyusunan: 28 Oktober 2026. Status: draf untuk ditinjau.

Paket ini meneruskan arsitektur INV-WMS-ARCH-001 revisi 1.0 menjadi enam dokumen persiapan pembangunan. Aplikasi belum dibuat. Isi paket merupakan kebutuhan dan usulan rancangan; status UAT seluruhnya belum dijalankan.

## Urutan pembahasan

| Urutan | Dokumen | Pertanyaan yang dijawab |
|---|---|---|
| 1 | [Product Requirements Document](01-product-requirements.md) | Siapa yang memakai sistem, pekerjaan apa yang dicakup, dan hasil apa yang harus terjamin? |
| 2 | [Technical Requirements Document](02-technical-requirements.md) | Bagaimana backend mengesahkan transaksi, menangani kegagalan, dan menjaga batas akses? |
| 3 | [App Flow Document](03-app-flow.md) | Layar dan langkah apa yang dilalui pengguna, termasuk saat muncul pengecualian? |
| 4 | [Design Brief Document](04-design-brief.md) | Informasi dan kontrol apa yang harus diprioritaskan agar operator dapat bekerja dengan benar? |
| 5 | [Backend Schema Document](05-backend-schema.md) | Entitas, relasi, batasan data, dan transaksi apa yang diperlukan? |
| 6 | [Implementation Plan Document](06-implementation-plan.md) | Pekerjaan dibangun dalam urutan apa, dan bukti apa yang diperlukan sebelum melanjutkan? |

Format enam dokumen mengikuti gambar yang dibagikan pengguna pada chat **Ingatkan Vibe Coding Codex**: Product Requirement, Technical Requirements, App Flow, Design Brief, Backend Schema, dan Implementation Plan. Gambar menjadi acuan susunan dokumen.

## PRD tambahan tracker

Dokumen tambahan: [PRD Tracker Barang Masuk dan Keluar (Barcode / RFID)](prd-tracker-barcode-rfid.md). PRD ini merinci identitas barang, alur scan, konfirmasi, pengecualian, pilihan teknologi dan kriteria penerimaan. Barcode menjadi usulan MVP; RFID memerlukan pilot fisik. Seluruhnya masih berupa kebutuhan, bukan fitur yang sudah diimplementasikan. Dokumen ini melengkapi enam dokumen utama dan memakai Inventory Core yang sama.

## Acuan rekayasa

**Software Requirements Engineering.** Mengacu pada [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html), untuk memperjelas kebutuhan, fitur, batasan dan kriteria penerimaan sebelum coding, lalu mengelola perubahan kebutuhan selama pengembangan.

**Software Architecture & System Engineering.** Mengacu pada [ISO/IEC/IEEE 15288:2023](https://www.iso.org/standard/81702.html), untuk merencanakan arsitektur, integrasi, implementasi, pengujian dan siklus hidup sistem hingga operasi, pemeliharaan serta penghentian layanan.

Penerapan pada proyek dirinci dalam [acuan proses rekayasa](engineering-basis.md). Enam dokumen adalah susunan kerja proyek; kesesuaian formal terhadap standar belum dinilai.

## Posisi pekerjaan saat ini

- Arsitektur awal tersedia dalam [PDF arsitektur](../architecture/arsitektur-inventory-wms.pdf) dan [HANDOFF](../architecture/HANDOFF.md).
- Keenam dokumen di atas merupakan draf turunan yang dapat ditinjau bersama klien dan tim implementasi.
- [Design system](../../design-system/README.md) memakai arah Ledger. Screenshot pengguna hanya inspirasi, bukan template. Komposisi draf telah direvisi; render baru dan verifikasi browser masih terbuka.
- [P0 sudah berjalan](p0/README.md): peninjauan fondasi dan backlog disiapkan; keputusan operasional masih memerlukan data klien.
- Usulan teknis baru diberi penjelasan sebagai usulan. D01 sampai D05 tetap terbuka dalam [register keputusan PRD](01-product-requirements.md#register-keputusan).
- Pembangunan aplikasi dimulai setelah ruang lingkup dan keputusan yang memengaruhi tahap pertama ditetapkan. Tidak ada jadwal, biaya, kapasitas, atau target layanan yang telah dijanjikan.

## Cara menjaga konsistensi

PRD menjadi acuan cakupan dan ID kebutuhan FR-01 sampai FR-16. TRD menjabarkan kontrol teknis. App Flow dan Design Brief menjabarkan perilaku pengguna. Backend Schema menjabarkan model data. Implementation Plan menghubungkan pekerjaan dengan kebutuhan dan UAT-01 sampai UAT-14.

Jika kebutuhan berubah, perbarui kebutuhan asal dan dokumen turunannya. Catat keputusan D01 sampai D05 di PRD beserta tanggal, penanggung jawab, dan alasan ketika keputusan benar-benar dibuat. Persetujuan atas paket dokumen tidak otomatis menjadi persetujuan deployment atau penerimaan aplikasi.

Pemeriksaan paket tersedia pada [laporan pemeriksaan dokumen](review.md). Pemeriksaan dokumen tidak membuktikan aplikasi sudah bekerja.
