# Backlog P1: fondasi proyek, identitas dan master

Tanggal: 28 Oktober 2026. Status: **Draf; belum diimplementasikan**.

Backlog ini merupakan keluaran persiapan [P0](README.md), mengikuti [PRD](../01-product-requirements.md), [TRD](../02-technical-requirements.md) dan [Backend Schema](../05-backend-schema.md). Kebutuhan, kondisi dan bukti dicatat sesuai [acuan proses rekayasa](../engineering-basis.md). Semua item di bawah berstatus **Belum dimulai**.

| ID | Pekerjaan | Kebutuhan | Prasyarat | Kriteria penerimaan yang direncanakan |
|---|---|---|---|---|
| B1-01 | Struktur proyek dan modul | FR-01, FR-04 | Stack/versi dipilih; batas modul ditinjau | Satu perintah yang terdokumentasi dapat menjalankan API dan pemeriksaan dasar pada lingkungan bersih; konfigurasi rahasia terpisah dari source |
| B1-02 | PostgreSQL uji dan migrasi awal | FR-01, FR-02 | Versi dan lingkungan dipilih | Migrasi database kosong berhasil; foreign key dan uniqueness yang dibutuhkan dapat diuji pada PostgreSQL nyata |
| B1-03 | Perusahaan, pemilik, gudang dan lokasi | FR-01, FR-04 | D01 dan lingkup D03 tersedia | Kode unik pada lingkup yang benar; lokasi lintas perusahaan ditolak; master nonaktif tidak dipakai pada dokumen baru |
| B1-04 | Barang dan satuan | FR-01 | D01/D02 tersedia | SKU duplikat ditolak pada lingkup yang sama; faktor konversi positif; jumlah dan presisi mengikuti keputusan satuan |
| B1-05 | Barcode serta kebijakan batch/serial | FR-01 | D02 tersedia | Pemetaan aktif tidak ambigu pada lingkup scan; tracking yang wajib tidak dapat dilewati; barang tak dikenal mendapat hasil yang jelas |
| B1-06 | Autentikasi dan principal | FR-04 | Keputusan identitas D03 tersedia | Identitas valid dapat masuk; sesi/token tidak sah ditolak; principal integrasi memiliki lingkup yang eksplisit |
| B1-07 | Izin perusahaan dan gudang | FR-04 | Matriks peran/tindakan D03 tersedia | Daftar, detail dan mutasi diuji lewat API langsung; ID objek gudang lain tidak memberikan akses; akses saat retry tetap diperiksa |
| B1-08 | Kebijakan approval fondasi | FR-04 | Tindakan dan aturan pembuat/penyetuju D03 tersedia | Kebijakan memiliki versi; pembuat tidak menyetujui tindakan sendiri jika aturan melarang; perubahan data yang memerlukan tinjauan ulang dapat dikenali |
| B1-09 | Audit perubahan master dan akses | FR-04 | Principal dan izin tersedia; retensi dibahas | Perubahan sah terhubung pelaku/objek/waktu; log tidak menyimpan token; penolakan tidak meninggalkan perubahan master parsial |
| B1-10 | Pemeriksaan integrasi dan panduan pengembangan | FR-01, FR-04 | B1-01 sampai B1-09 sesuai lingkup tersedia | Pengembang dapat menjalankan migrasi serta uji akses/master dari panduan; konfigurasi dan versi yang dipakai tercatat |

## Urutan pelaksanaan setelah P0

B1-01 dan B1-02 menyiapkan lingkungan. B1-03 sampai B1-05 menyiapkan master. B1-06 dan B1-07 menegakkan identitas/akses sebelum endpoint master dianggap siap. B1-08 dan B1-09 menyiapkan kebijakan serta audit sesuai keputusan yang tersedia. B1-10 mengumpulkan bukti dan panduan dari hasil nyata.

Keterkaitan tersebut tidak memberi izin merilis endpoint master tanpa pemeriksaan akses. Saat implementasi, perubahan master dan lingkup aksesnya dibangun serta diuji bersama.

## Bukti penutupan P1

Kumpulkan versi aplikasi/schema, lingkungan PostgreSQL, konfigurasi peran, hasil migrasi dan request/response pengujian. UAT-13 mulai dibuktikan pada endpoint yang sudah tersedia, lalu diperluas pada paket berikut. Pengujian master dan satuan memakai kriteria rinci di atas.

P1 belum membuktikan saldo, reservasi atau posting stok. Bukti persaingan reservasi, rollback dan respons hilang menjadi pekerjaan P2 pada [Implementation Plan](../06-implementation-plan.md). Tidak ada estimasi waktu atau hasil tes yang diisi sebelum tersedia dasar dan eksekusinya.
