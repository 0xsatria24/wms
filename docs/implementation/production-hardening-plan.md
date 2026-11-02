# Pelaksanaan kesiapan production

Permintaan pengguna pada 2 November 2026 menyetujui seluruh tujuh temuan audit untuk dikerjakan berurutan. Implementasi mempertahankan stack, Inventory Core, kontrak idempotency, scope gudang, blind count, dan draft operasional yang ada.

1. Admin pertama dan enrollment SSO. Bootstrap melalui perintah administratif pada database kosong. Invitation hanya dihubungkan ke identitas issuer/subject dari login OIDC dengan email terverifikasi, tetap membutuhkan approval.
2. Master lokasi operasional dan konfirmasi simpan async. Lokasi baru harus langsung dapat dipakai Inventory Core, kegagalan menjaga draft.
3. Deployment HTTPS/OIDC. Proxy tepercaya, domain, key persisten, konfigurasi Compose yang dapat divalidasi.
4. ERP. Impor PO dengan autentikasi integrasi dan idempotency, konfigurasi status lookup, hasil rejected/unknown, monitoring backlog, serta penahanan replay sesudah restore.
5. API. Query katalog/riwayat dengan pagination di server, snapshot kerja terbatas pada data operasional yang diperlukan, dan verifikasi volume data.
6. Metrik. Grafik hanya memakai pengiriman confirmed dari API, tanpa angka fixture di production.
7. Operasional. Backup/restore, health/restart, CI/smoke test dan checklist UAT yang dapat dijalankan. Bukti layanan klien, perangkat fisik, dan deployment dicatat sesuai pengujian yang benar-benar dilakukan.

Verifikasi dilakukan per tahap dengan tes regresi untuk risiko spesifik, kemudian suite backend/frontend dan browser untuk perubahan UI. Tes backend memakai database terisolasi. Tidak ada deployment publik, perubahan akses nyata, atau pengiriman data ke layanan klien dalam pekerjaan lokal ini.

Keputusan pelaksanaan. Kerjakan di checkout aktif agar seluruh perubahan pengguna yang belum di-commit tetap menjadi dasar implementasi. Tidak membuat commit atau memindahkan pekerjaan pengguna. Eksekusi native berurutan untuk membatasi biaya konteks.

## Catatan pelaksanaan

- Baseline audit. Build frontend, 20 tes frontend, dan 39 tes backend lulus pada run audit sebelumnya. Verifikasi akan diulang sesuai perubahan.
- Tahap 1 selesai pada kode lokal. Dua regresi SSO diamati gagal sebelum perbaikan, kemudian tiga tes bootstrap/enrollment lulus pada PostgreSQL terisolasi.
- Tahap 2. Regresi lokasi baru gagal sebelum perbaikan, lalu putaway B-03 lulus. Empat tes grouping stok dan TypeScript lulus. Penyimpanan form menunggu hasil API. Definisi lokasi legacy dipromosikan melalui migrasi data tanpa menghapus sumbernya.
- Keputusan. Tes menggunakan konfigurasi Release karena DLL Debug dikunci proses preview yang sedang berjalan.
- Tahap 3. Regresi HTTP membuktikan callback salah sebelum perbaikan dan lulus menggunakan HTTPS sesudah forwarded headers aktif. TLS diterminasi langsung oleh Nginx. Compose memerlukan sertifikat dan domain klien, proxy internal mempunyai IP tepercaya eksplisit, key persisten dipisahkan dari database.
- Batas lingkungan. Docker CLI tidak tersedia di host audit. Smoke test Compose/Linux dan sertifikat klien perlu dijalankan pada host tujuan.
- Tahap 4. Dua tes kontrak impor dan worker lulus. Adapter wms-v1, JWT ingress, dan status lookup disiapkan dengan ERP nonaktif serta dispatch ditahan secara default sampai integrasi nyata diverifikasi.
- Pengguna mengonfirmasi domain, SSO, ERP, dan perangkat belum tersedia. Cakupan lanjutan adalah kode dan prosedur uji, dengan verifikasi integrasi klien tetap terbuka.
- Tahap 5. Pagination master SQL, query stok/antrean, dan blind count lulus pada tiga tes. Snapshot dibatasi menurut view, halaman, dan SKU/dokumen fokus. Ledger menggunakan pagination terpisah. Indeks query ditambahkan melalui migrasi EF. Pengujian ini memakai data sintetis, belum benchmark kapasitas klien.
- Tahap 6. Agregasi shipment confirmed lulus tes scope gudang/SKU dan periode. Grafik fixture diganti data API, tanpa mencampur unit. Nama perusahaan dan penanda demo dibedakan menurut sesi server.
- Keputusan. Pemeriksaan tahap 6 menemukan referensi fixture yang bisa mengesahkan retur pelanggan, serta target transfer/count yang tetap. Referensi fixture tidak lagi mengesahkan retur. Sumber retur harus berasal dari ledger, dan transfer/count memakai master aktual. Empat tes terkait lulus.
- Tahap 7. Heartbeat worker lulus, dump/restore PostgreSQL 18 terisolasi mempertahankan saldo, ledger, request keys dan event IDs. Script Linux, timer backup, CI, dan runbook tersedia. Sintaks empat script Bash lulus. Aktivasi pada host klien dan hasil UAT tetap menunggu lingkungan klien.
- Koreksi verifikasi production. API anonim sebelumnya redirect ke OIDC. Regresi gagal dengan 302, lalu default challenge diarahkan ke cookie agar API mengembalikan 401. Login SSO tetap melalui endpoint /auth/login eksplisit.
- Review independen selesai. Enam temuan P1 diperbaiki: hold restore memblokir penulisan, draft tidak berpindah ke dokumen lain, lookup SKU order diteruskan ke server, timeline tracking ikut dipaginasi, pencarian kosong tetap dapat dipulihkan, dan klaim email_verified dari UserInfo dipetakan eksplisit.
- Verifikasi browser membuktikan pencarian receiving/ledger dapat dipulihkan, draft mempertahankan PO/SKU/kuantitas, lookup order menampilkan SKU yang diminta, dan tabel receiving tetap mempunyai scroll lokal pada viewport 390 × 844. Review receipt dibatalkan; tidak ada transaksi stok dari pemeriksaan browser akhir.
- Pemeriksaan integritas informasi tambahan menghapus pengamatan scan rekaan, membatasi perangkat contoh ke mode demo, serta mengganti pemilihan isi kemasan dari SKU-A tetap ke SKU isi kemasan yang dipilih. Dialog pemetaan menunggu hasil server dan mempertahankan form ketika gagal.
- Suite akhir menemukan validasi alasan delete-master dan payload alasan pada tes HTTP yang terhapus. Keduanya dipulihkan; tes regresi diulang. Hasil rinci dan batas verifikasi disimpan pada `prototype/qa/production-hardening-20261102/verification.md`.
