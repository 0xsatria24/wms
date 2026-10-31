# Fungsi yang dirancang satu per satu

Status: seluruhnya desain statis. Urutan mengikuti ketergantungan P1-P8; tracker memakai Inventory Core yang sama. RFID tetap opsi pilot.

| Urutan | Spesifikasi | Keputusan utama | Paket |
|---|---|---|---|
| S01 | [Akses dan lingkup kerja](functions/01-akses-dan-lingkup.md) | Memilih lingkup yang diizinkan dan melanjutkan pekerjaan dengan identitas yang benar. | P1 |
| S02 | [Master barang dan lokasi](functions/02-master-barang-lokasi-satuan.md) | Memastikan kode, satuan dan lokasi dapat dipakai tanpa ambiguitas pada dokumen baru. | P1 |
| S03 | [Posisi stok dan saldo awal](functions/03-posisi-stok-dan-saldo-awal.md) | Mengetahui fisik, komitmen dan bebas pada dimensi yang sama, lalu menelusuri sumbernya. | P2 |
| S04 | [Ketersediaan dan reservasi](functions/04-ketersediaan-dan-reservasi.md) | Mengalokasikan stok layak tanpa memakai stok yang sama dua kali. | P2 / P4 |
| S05 | [Penerimaan aktual](functions/05-penerimaan-aktual.md) | Mengonfirmasi barang dan aktual yang benar-benar diterima, sambil mempertahankan sisa dokumen. | P3 |
| S06 | [QC dan karantina](functions/06-qc-dan-karantina.md) | Menetapkan kondisi hasil inspeksi dan menahan pemenuhan yang terdampak. | P3 |
| S07 | [Penempatan barang](functions/07-penempatan-putaway.md) | Memastikan barang ditempatkan pada lokasi tujuan yang sah. | P3 |
| S08 | [Order dan persetujuan](functions/08-order-dan-persetujuan.md) | Memeriksa permintaan dan kewenangan sebelum melepas order untuk alokasi. | P4 |
| S09 | [Picking dan kekurangan](functions/09-picking-dan-short-pick.md) | Mengonfirmasi aktual yang ditemukan tanpa menyamakan kekurangan dengan barang terambil. | P4 |
| S10 | [Packing dan pengiriman](functions/10-packing-dan-pengiriman.md) | Memastikan isi yang benar-benar siap dikirim sesuai order dan komitmen sebelum fisik keluar. | P4 |
| S11 | [Pembatalan dan kembali stok](functions/11-pembatalan-dan-kembali-stok.md) | Menyelesaikan bagian order sesuai keadaan fisiknya tanpa melepas komitmen terlalu cepat. | P4 |
| S12 | [Transfer dan perjalanan](functions/12-transfer-dan-perjalanan.md) | Menerima aktual transfer tanpa menghitung barang dua kali atau menghapus sisa perjalanan. | P5 |
| S13 | [Retur pelanggan dan supplier](functions/13-retur-pelanggan-supplier.md) | Mencatat barang kembali atau dikembalikan dengan sumber dan kondisi yang dapat ditelusuri. | P5 |
| S14 | [Opname dan penyesuaian](functions/14-opname-dan-penyesuaian.md) | Merekam hasil hitung tanpa melihat saldo pembanding dan mengoreksi hanya melalui approval. | P6 |
| S15 | [Integrasi dan rekonsiliasi ERP](functions/15-integrasi-erp.md) | Menyelesaikan event tertahan tanpa mengirim dampak bisnis ganda. | P7 |
| S16 | [Kartu stok dan ketertelusuran](functions/16-kartu-stok-dan-laporan.md) | Menjelaskan penyebab saldo dan menelusuri koreksi ke sumbernya. | P7 |
| S17 | [Pending, konflik dan hasil belum pasti](functions/17-pending-konflik-dan-retry.md) | Memilih pemulihan yang benar berdasarkan apakah permintaan belum terkirim atau hasilnya belum diketahui. | P2-P4 |
| S18 | [Monitoring dan pemulihan](functions/18-monitoring-backup-pemulihan.md) | Menangani kasus operasional dan mengetahui bukti backup/restore yang tersedia. | P8 |
| S19 | [Tracker dan detail barang](functions/19-tracker-dan-detail-unit.md) | Membedakan posisi terkonfirmasi dari observasi terbaru dan membuka pekerjaan yang perlu ditindaklanjuti. | P3 / P4 / P7 |
| S20 | [Label, kemasan dan perangkat](functions/20-label-kemasan-dan-perangkat.md) | Menjaga identitas aktif, isi kemasan dan perangkat tetap berada pada lingkup yang sah. | P1 / pilot terpisah |
| S21 | [Sesi RFID dan pengecualian](functions/21-sesi-rfid-pilot.md) | Menyelesaikan observasi unik terhadap dokumen sebelum meminta konfirmasi bisnis. | Pilot RFID bila dipilih |
