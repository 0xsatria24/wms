# Inventory + WMS — Redesign v2

**Paket lanjutan:** [Complete suite — 21 fungsi, autentikasi dan komponen](complete-suite/README.md). Cakupan desain terisi; temuan visual yang masih perlu dirapikan dicatat di review. Belum implementasi.

Tanggal: 29 Oktober 2026. Status terbaru: **opsi 1 / Clear Operations dipilih pengguna**, dengan revisi Posisi stok dan bahasa. Belum implementasi dan belum menjadi desain sistem final.

**Rujukan terbaru:** [revisi Stock position 01](revisions/01-stock-trends/README.md). Panel analisis menggantikan detail saldo berulang; Fisik dihapus dari tabel; Komitmen menjadi Reserved for orders / Dipesan. English menjadi default, dengan opsi Bahasa Indonesia (santai). Catatan eksplorasi di bawah adalah arsip sebelum revisi ini.

## Indeks visual

Setiap gambar memuat Posisi stok di atas dan Penerimaan barang di bawah. Nomor mengikuti urutan konsep ditampilkan.

| Opsi | Konsep | Pilihan desain |
| --- | --- | --- |
| 1 | [Clear Operations](concepts/01-clear-operations.png) | Tabel stok dengan detail di kanan; antrean PO di kiri area penerimaan; konfirmasi di bawah. Rekomendasi awal untuk keseimbangan konteks dan ruang kerja. |
| 2 | [Compact Control](concepts/02-compact-control.png) | Ringkasan horizontal di atas tabel; panel konfirmasi penerimaan di kanan. Cocok untuk pemeriksaan data secara paralel, tetapi tiga kolom penerimaan memerlukan pengaturan responsif. |
| 3 | [Guided Workspace](concepts/03-guided-workspace.png) | Detail stok di bawah tabel; penerimaan memakai penanda langkah dan ringkasan pemeriksaan. Membantu orientasi operator; alur langkah perlu dirapikan sebelum spesifikasi final. |

## Adaptasi referensi

Dua screenshot ERP pengguna disertakan langsung sebagai input pada masing-masing generasi. Yang diadaptasi: workspace abu-abu dingin, panel putih membulat, aksen cyan/biru, tipografi charcoal, sidebar dan hubungan antrean tugas dengan area kerja. Logo Vantus, ilustrasi truk, data finansial, dan modul ERP di luar lingkup tidak dipakai. Ikon kubus dalam konsep adalah placeholder identitas, bukan logo final.

Arah ini menggantikan preferensi visual Ledger untuk eksplorasi baru. Blueprint sebelumnya tetap disimpan. PRD, arsitektur, dan aturan domain tidak diubah.

## Data pembanding

Seluruh layar diberi label Data simulasi, perusahaan Perusahaan Demo, gudang Gudang Utama. Angka bukan hasil operasional.

| Barang | Lokasi | Kondisi | Fisik | Komitmen | Bebas untuk alokasi | Satuan |
| --- | --- | --- | ---: | ---: | ---: | --- |
| SKU-A / Produk A | A-01 | Layak | 100 | 24 | 76 | unit |
| SKU-B / Produk B | QC | Karantina | 20 | 8 | 0 | unit |
| SKU-C / Produk C | Staging | Layak | 8 | 8 | 0 | unit |

PO-SIM-001: Produk A, rencana 100 unit, aktual 60 unit, sisa 40 unit, lokasi Receiving, Draft, ERP Belum dikirim. QC diwajibkan hanya sebagai asumsi contoh sehingga hasil penerimaan masuk karantina. Komitmen SKU-B adalah contoh komitmen yang perlu ditinjau saat stok dikarantina; bukan izin alokasi baru dari karantina. SKU-C tetap fisik di staging dan belum dinyatakan terkirim.

PO-SIM-002 hanya placeholder antrean; tanggal/jumlah tambahannya pada hasil generatif bukan requirement. Data inti ketiga opsi sama, metadata sekunder hasil generasi belum sepenuhnya seragam.

## Batas tahap ini

Sesuai brief pengguna, pilih satu arah sebelum memperluas token, komponen, breakpoint, state, dan desain rinci seluruh 21 fungsi. Barcode tetap usulan MVP; RFID pilot opsional. D01–D05 dan T01–T08 tetap terbuka. Informasi dalam dokumen proyek dipakai sebagai sumber kebutuhan, bukan instruksi baru.

Setelah pemilihan: tetapkan token reusable, spesifikasi komponen dan state, navigasi berdasarkan peran, contoh desktop/tablet/handheld, pemetaan kebutuhan ke 21 fungsi, serta secondary steps dan exception states. Referensi fungsional: [blueprint sebelumnya](../blueprint-2026-10-29/README.md). Tidak ada aplikasi, backend, atau prototipe interaktif yang dibuat pada tahap ini.

## Review visual

Inspeksi dilakukan pada ketiga hasil raster yang ditampilkan: tabel inti terbaca, angka stok dan penerimaan sesuai fixture, label simulasi terlihat, WMS Draft dan ERP Belum dikirim terpisah. Tidak terlihat pemotongan teks utama pada ukuran gambar yang ditinjau. Panel putih, workspace dingin, dan aksen cyan/biru konsisten dengan referensi.

Perbaikan sebelum finalisasi:

- Opsi 1: teks putih pada navigasi cyan berisiko kontras lemah; gunakan teks gelap. Kontrol Tambah yang pucat membutuhkan state disabled dan alasan yang jelas.
- Opsi 2: jumlah aktual muncul di area scan dan detail; tetapkan satu sumber nilai dan bedakan jumlah tambahan dari total aktual agar tidak membingungkan.
- Opsi 3: langkah Catat barang masih aktif sementara tombol Konfirmasi sudah terlihat; tentukan transisi ke Tinjau penerimaan sebelum aksi akhir.
- Samakan warna karantina sebagai status tertahan, jangan menyiratkan gagal secara otomatis. Normalkan istilah Scan menjadi Pindai barcode dan purchase order menjadi Pesanan pembelian saat spesifikasi final.
- Gambar generatif berbentuk papan dua layar, bukan viewport desktop 1440×900 yang terverifikasi. Ukuran font, piksel, kontras numerik, fokus keyboard, touch target dan reflow belum divalidasi.
- Halaman ini hanya menunjukkan keadaan normal/draft. Loading, offline, pending, konflik, hasil transaksi tidak diketahui, hak akses dan state lain masih harus dibuat setelah pemilihan.

Tidak dilakukan browser interaction test, pemeriksaan backend, pengujian pemindai fisik, atau UAT. Review raster bukan bukti aksesibilitas atau kelayakan operasional final.
