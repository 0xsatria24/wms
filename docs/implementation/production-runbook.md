# Inventory/WMS production runbook

Kode disiapkan pada 2 November 2026. Pengguna mengonfirmasi lingkungan klien belum tersedia. Prosedur berikut perlu dijalankan dan hasilnya dicatat pada host tujuan sebelum go-live. Proyek menggunakan satu perusahaan internal dengan ID kompatibilitas `demo`, terpisah dari nama perusahaan yang ditampilkan. Implementasi ini belum menyediakan isolasi beberapa perusahaan.

## Konfigurasi dan pemasangan

Revisi wizard 3 November 2026: alur hanya aktivasi → SSO → tinjauan admin. Gudang/lokasi tidak diisi di browser. IT wajib mengisi `WMS_SETUP_WAREHOUSE_ID`, `WMS_SETUP_WAREHOUSE_NAME`, dan `WMS_SETUP_STORAGE_LOCATION` sebelum startup pertama; Compose memetakan satu lokasi awal ke `Setup:Warehouse:StorageLocations:0`. Untuk beberapa lokasi gunakan array konfigurasi server yang sesuai. Konfigurasi kosong/invalid tidak menawarkan setup. Nilai gudang pada body HTTP tidak digunakan.

Alternatif bootstrap CLI: migrasikan database kosong dengan `docker compose run --rm api --migrate-only`. Buat kode privat memakai `scripts/new-setup-code.ps1` pada mesin provisioning Windows (direktori baru, default berlaku 24 jam), lalu pindahkan hash dan expiry ke `WMS_SETUP_CODE_HASH` / `WMS_SETUP_EXPIRES_AT` dan set `WMS_SETUP_ENABLED=true` pada konfigurasi privat host. Kode mentah hanya diberikan kepada penanggung jawab, bukan dimasukkan ke URL atau repo. Jalankan api/worker/web, buka aplikasi dan selesaikan wizard aktivasi → SSO → tinjauan. Health container memakai `/health/setup-ready` agar web bisa dibuka saat perlu setup; `/health/ready` operasional tetap 503 sampai selesai. Worker pada database kosong tidak memiliki outbox untuk diproses. Setelah selesai gunakan login SSO normal. Untuk rotasi, buat kode baru dan restart API dengan hash/expiry baru. Jangan menjalankan bootstrap CLI jika memilih wizard.

1. Gunakan Linux, Docker Compose, domain HTTPS, sertifikat valid, dan storage backup terpisah dari host aplikasi. Isi konfigurasi dari `.env.example` ke `.env`. Simpan rahasia pada host dengan akses terbatas.
2. Tetapkan `WMS_PUBLIC_HOST`, `WMS_COMPANY_NAME`, `WMS_BIND_ADDRESS` sesuai jaringan tujuan, `TLS_CERT_DIRECTORY`, serta authority/client ID/secret SSO. Direktori TLS memuat `fullchain.pem` dan `privkey.pem`. Nginx melakukan terminasi TLS langsung. Sesuaikan subnet dan IP proxy jika berbenturan dengan jaringan host. API hanya memercayai IP Nginx tersebut.
3. `docker compose config --quiet` harus lulus. Jalankan `docker compose build` dan `docker compose up -d db`.
4. Untuk database baru, salin `deploy/bootstrap.example.json` ke lokasi konfigurasi privat. Isi issuer dan subject admin dari provider identitas yang sudah diverifikasi, email admin, gudang, dan kode lokasi penyimpanan. Bootstrap membuat Receiving/QC/Staging, transit, settings, dan satu admin. Bootstrap menolak database yang sudah diinisialisasi dan tidak membuat stok contoh.

```bash
docker compose run --rm -v /secure/bootstrap.json:/run/bootstrap.json:ro api --bootstrap /run/bootstrap.json
docker compose up -d api worker web
bash scripts/smoke-production.sh https://warehouse.example.com
```

Login pertama admin harus memakai issuer/subject yang sama. Pengguna undangan masuk melalui SSO dengan email terverifikasi. Penghubungan akun tidak memberi grant. Admin menetapkan gudang/peran sesudah verifikasi. Akun revoked/rejected/deleted tetap ditolak. Provider harus memasok klaim `email_verified=true` untuk enrollment.

Untuk upgrade, ambil backup, tetapkan maintenance window, hentikan web/worker/API, lalu jalankan migrasi eksplisit. Backup dan key Data Protection harus tetap tersedia saat container diganti.

```bash
docker compose stop web worker api
docker compose run --rm api --migrate-only
docker compose up -d api worker web
```

`WMS_MIGRATE_ON_STARTUP=false` merupakan default. Migrasi lokasi mempromosikan definisi legacy valid ke tabel operasional dan mempertahankan sumber SupportingRecords. Tinjau definisi legacy dengan kode kosong, lebih dari 100 karakter, mengandung `|`, atau gudang tidak valid. Definisi tersebut tidak dipromosikan. Jangan menghapus lokasi yang sudah mempunyai referensi stok untuk rollback aplikasi.

## Kontrak adapter ERP wms-v1

Kontrak ini merupakan antarmuka adapter aplikasi. Tim ERP perlu menyetujui mapping dan mengujinya terhadap sistem nyata.

- Ingress PO diaktifkan melalui `ERP_INGRESS_ENABLED`, authority dan audience JWT. Token memerlukan scope `wms.po.write`. Principal service harus terdaftar, aktif, dan mendapat grant supervisor/admin untuk gudang tujuan. Provision principal service memakai proses DBA yang disetujui. Jangan memakai cookie pengguna atau membagikan token service ke frontend.
- `POST /api/erp/workspaces/{warehouse}/purchase-orders` memerlukan header `Idempotency-Key` berupa UUID. Warehouse boleh memakai ID atau nama master.
- Body memuat `document`, `sku`, `qty`, `unit`, `sourceVersion`. `document` adalah ID baris PO eksternal yang unik dalam gudang, maksimal 100 karakter tanpa `|`. Qty berupa string desimal base unit. Satu baris mengacu pada satu SKU. Master barang disiapkan melalui Item master. Import membuat/memperbarui dokumen sumber dan tidak mengubah stok.
- SourceVersion harus meningkat. SKU dokumen tidak boleh diganti, dan kuantitas tidak boleh lebih rendah dari yang sudah diterima. Retry harus mempertahankan key dan payload asli. Respons sukses memberikan ID hasil tetap. Key dengan payload berbeda ditolak.
- Outbound memakai HTTPS POST `ERP_ENDPOINT`, protokol `wms-v1`, header event UUID sebagai Idempotency-Key, dan bearer token jika dikonfigurasi. ERP harus menjamin deduplikasi event dan menjaga urutan per aggregate. Respons berisi `businessStatus` dengan nilai `accepted`, `rejected`, atau status tertunda.
- ERP perlu menyimpan korelasi event UUID dan transaction ID dengan `requestIdempotencyKey`, `requestPrincipalId`, dan `requestPayloadHash` pada payload. Data ini diperlukan untuk menelusuri request browser yang tidak ada dalam backup sesudah restore. Sediakan ekspor/journal rekonsiliasi berdasarkan korelasi tersebut.
- `ERP_STATUS_ENDPOINT` harus memuat `{eventId}` dan menyediakan hasil bisnis untuk ID yang sama. HTTP sukses transport tidak mengesahkan ulang stok. Hasil bisnis rejected memerlukan penanganan operasional. Status pending/unknown direkonsiliasi. Transport 4xx selain 408/429 berhenti diulang otomatis. Retry manual mempertahankan event asli.
- Aktifkan `ERP_ENABLED=true` dan `ERP_DISPATCH_PAUSED=false` hanya sesudah kontrak, token, status lookup, dan rekonsiliasi diuji. Default delivery nonaktif/ditahan. Backlog melewati `ERP_BACKLOG_ALERT_MINUTES` ditulis sebagai error log untuk sistem monitoring host.

```json
{"document":"PO-2026-001-L1","sku":"ITEM-001","qty":"12","unit":"units","sourceVersion":1}
```

## Backup dan pemulihan

Mount storage backup off-host pada `/mnt/wms-backups`. Verifikasi sumber mount, kapasitas, enkripsi, akses, retensi, dan cadangan key Data Protection. Script menolak tujuan yang bukan mount point. Penjadwalan contoh per jam berada di `deploy/wms-backup.service` dan `.timer`. Sesuaikan path instalasi, jadwal, dan retensi dengan RPO klien sebelum memasang dan mengaktifkan unit systemd. Kegagalan job harus masuk monitoring host.

```bash
bash scripts/backup-production.sh /mnt/wms-backups
```

Backup menghasilkan custom-format dump, checksum, dan waktu keberhasilan pada status operasional. Keberhasilan dump belum membuktikan sasaran RPO/RTO. Jalankan latihan restore pada lingkungan terisolasi, verifikasi saldo, ledger, idempotency keys, event IDs, serta hak akses. Catat timestamp backup dan waktu pemulihan yang benar-benar diukur.

Restore production mengganti database `wms` dan memerlukan persetujuan maintenance. Script memeriksa checksum/TOC, menghentikan aplikasi dan worker, menjalankan restore, memeriksa invariant saldo, lalu memasang hold recovery persisten sebelum aplikasi dinyalakan. Selama hold, API dapat dibaca, tetapi mutasi, impor ERP, dan pengiriman outbox ditolak/ditahan. Jika restore gagal, layanan tetap berhenti untuk pemeriksaan operator.

```bash
bash scripts/restore-production.sh /mnt/wms-backups/verified.dump --replace wms
```

Bandingkan event/request IDs dan hasil bisnis WMS dengan ERP, termasuk transaksi yang terjadi setelah timestamp backup dan seluruh key browser unknown yang tidak ditemukan di database hasil restore. Jangan membuat request atau event pengganti untuk hasil yang masih unknown. Pulihkan state WMS, ledger, idempotency result, dan identitas event asli dari bukti WMS yang dapat dipercaya, menggunakan korelasi journal ERP untuk memeriksa pengirimannya. Jika bukti tidak cukup, pertahankan hold dan lakukan rekonsiliasi fisik/operasional yang disahkan. Sesudah semua hasil yang tidak pasti diselesaikan dan rekonsiliasi disahkan, catat referensinya dan lepaskan hold. `ERP_DISPATCH_PAUSED` tetap menjadi hold delivery terpisah.

```bash
bash scripts/release-recovery-hold.sh --reconciled reconciliation-reference
```

Tes lokal `RecoveryTests` menjalankan pg_dump/pg_restore PostgreSQL 18 pada dua database `wms_test_*`, lalu memeriksa saldo, jumlah entri ledger, key request, event ID, dan hold. Ini merupakan bukti database uji, bukan latihan pemulihan host production.

## Verifikasi sebelum go-live

- Jalankan workflow CI build/typecheck, seluruh tes frontend/backend, dan restore database uji. Workflow disiapkan di `.github/workflows/verify.yml`. Hasil lokal tidak menyatakan workflow GitHub sudah dijalankan.
- Jalankan smoke test pada domain HTTPS. Uji login/logout SSO, approval/revocation, gudang berbeda, cookie setelah penggantian container, dan penolakan callback/proxy yang tidak tepercaya.
- UAT operator harus mencakup receiving, QC, putaway ke lokasi baru, order/reservation/picking/shipping, retur dari sumber nyata, transfer, blind count/reviewer berbeda, serta pembukaan lokasi setelah count selesai.
- Uji barcode dengan nol di depan, scanner fisik dan terminatornya, printer/hasil label, keyboard, viewport handheld, jaringan putus, respons hilang setelah commit, reload browser, dan retry dengan key asli. Uji RFID fisik jika termasuk rilis.
- RFID UI masih pilot simulasi; adapter perangkat belum tersedia. Pengamatan scan yang belum mempunyai sumber nyata ditampilkan kosong. Daftar perangkat contoh hanya tersedia pada mode demo. Konfirmasikan pairing dan metadata perangkat nyata sebelum menyertakan fungsi tersebut dalam rilis operasional.
- Siapkan target volume master/posisi/riwayat dan jumlah operator serentak. Ukur latency/error/lock/database pada dataset tersebut. Pagination dan tes sintetis belum membuktikan kapasitas atau SLA klien.
- Uji healthcheck API/worker, crash/restart, restore hold, backlog alert, backup off-host, dan pemulihan dengan key persisten. Healthcheck Docker menandai unhealthy. Restart policy memulihkan proses yang keluar. Hubungkan status unhealthy dan error log ke monitoring host.
- Tetapkan penanggung jawab operasi dan persetujuan hasil UAT. Jangan menandai produksi siap sebelum konfigurasi klien dan bukti-bukti ini lengkap.
