# Acuan proses rekayasa Inventory + WMS

Tanggal: 28 Oktober 2026. Status: acuan kerja proyek atas permintaan pengguna.

## Software Requirements Engineering

Proyek mengacu pada [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html) dalam pengelolaan kebutuhan sistem dan perangkat lunak. Standar ini membahas proses serta informasi kebutuhan sepanjang siklus hidup. Edisi rujukan dicocokkan dengan katalog resmi ISO pada tanggal di atas.

Penerapan pada proyek:

| Pekerjaan | Catatan proyek yang harus tersedia |
|---|---|
| Mengumpulkan kebutuhan | Sumber kebutuhan, pengguna yang terdampak, pekerjaan dan masalah yang ingin diselesaikan |
| Memperjelas kebutuhan | ID, perilaku yang diminta, kondisi, batasan dan istilah yang dapat dipahami bersama |
| Meninjau kualitas kebutuhan | Periksa kejelasan, konflik, kelengkapan, kelayakan dan cara membuktikan hasil |
| Menetapkan kriteria penerimaan | Kondisi awal, langkah, hasil yang diwajibkan dan bukti; nilai yang belum diketahui tetap terbuka |
| Menjaga ketertelusuran | Hubungkan kebutuhan ke flow, rancangan teknis, schema, backlog dan pengujian |
| Mengelola perubahan | Catat alasan, dampak, keputusan dan versi acuan kerja yang sudah disetujui |

PRD menjadi pusat ID FR-01 sampai FR-16 dan register D01-D05. Matriks UAT-01 sampai UAT-14 menyiapkan sebagian bukti penerimaan; kontrol master, satuan, akses dan kebutuhan rinci tetap memerlukan kriteria tambahan pada backlog. Keberadaan ID saja belum membuktikan semua kebutuhan lengkap atau sudah diterima.

## Software Architecture & System Engineering

Proyek mengacu pada [ISO/IEC/IEEE 15288:2023](https://www.iso.org/standard/81702.html) untuk proses siklus hidup sistem. Cakupannya meliputi pengembangan, pemakaian, dukungan dan penghentian sistem. Edisi rujukan dicocokkan dengan katalog resmi ISO pada tanggal di atas.

Penerapan pada proyek:

| Area | Penerapan pada Inventory + WMS |
|---|---|
| Konteks dan batas sistem | Menetapkan pengguna, gudang, kepemilikan stok serta kewenangan WMS dan ERP |
| Arsitektur dan desain | Menjelaskan modul, data, transaksi, akses dan alasan keputusan teknis |
| Integrasi | Menetapkan kontrak ERP/SSO/perangkat, urutan versi, penanganan gangguan dan rekonsiliasi |
| Implementasi | Membagi pekerjaan P1-P8 menurut ketergantungan, konfigurasi dan bukti penerimaan |
| Verifikasi | Memeriksa hasil terhadap spesifikasi melalui pengujian domain, database, API dan integrasi |
| Validasi | Menilai apakah pengguna dapat menyelesaikan pekerjaan gudang dalam kondisi operasional yang ditetapkan |
| Transisi dan operasi | Menyiapkan saldo awal, cutover, pelatihan, monitoring, backup dan pemulihan |
| Pemeliharaan dan penghentian | Menetapkan perubahan versi, retensi, ekspor/arsip, serah terima data dan penutupan akses saat layanan dihentikan |

## Pemetaan ke enam dokumen

| Dokumen | Peran dalam proses proyek |
|---|---|
| [PRD](01-product-requirements.md) | Kebutuhan, batasan, kriteria penerimaan dan keputusan terbuka |
| [Technical Requirements](02-technical-requirements.md) | Kontrol teknis, antarmuka, sifat transaksi dan bukti verifikasi |
| [App Flow](03-app-flow.md) | Skenario pengguna, kondisi awal, percabangan, kegagalan dan hasil |
| [Design Brief](04-design-brief.md) | Kebutuhan interaksi, informasi penentu serta uji tugas pada perangkat sasaran |
| [Backend Schema](05-backend-schema.md) | Entitas, hubungan, invarian, kontrol data dan dampak perubahan |
| [Implementation Plan](06-implementation-plan.md) | Ketergantungan, implementasi, pengujian, transisi dan kesiapan operasi |

P0 menyiapkan kebutuhan dan keputusan untuk fondasi. Proses peninjauan dan perubahan tetap berjalan pada tahap berikut; keputusan dapat diperbaiki melalui catatan dampak dan versi yang dapat ditelusuri.

## Status penerapan

Pemetaan di atas adalah penerapan yang dipilih untuk proyek berdasarkan tujuan pengguna dan uraian publik standar. Paket ini belum memiliki asesmen terhadap seluruh klausul. Susunan enam dokumen tidak dinyatakan sebagai format wajib ISO. Pemeriksaan struktur dokumen dan UAT aplikasi juga dicatat terpisah.
