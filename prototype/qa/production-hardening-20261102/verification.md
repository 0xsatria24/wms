# Verifikasi hardening production — 2 November 2026

Seluruh tujuh tahap pada `docs/implementation/production-hardening-plan.md` diterapkan pada checkout lokal dengan perubahan pengguna sebelumnya tetap dipertahankan. Kode belum di-commit/deploy. Pengguna mengonfirmasi hosting, SSO, ERP, scanner, dan printer belum tersedia; keluaran mencakup implementasi serta prosedur uji.

## Bukti otomatis

Verifikasi sebelum push GitHub: suite backend lengkap diulang dan PASS 56/56, tanpa kegagalan atau tes dilewati (4 menit 47 detik). Seluruh 27 tes frontend juga diulang dan PASS. Tabel berikut mempertahankan riwayat temuan pada pelaksanaan sebelumnya.

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` di prototype | PASS, mencakup TypeScript, Vite, dan kemasan Sites; bukan deployment |
| `node --experimental-transform-types --test tests/*.test.mjs` | PASS, 27 tes, 0 gagal/dilewati |
| `scripts/test-local.ps1 -Configuration Release` | 55 PASS dari 56; satu tes HTTP delete-master gagal karena payload tes kehilangan alasan wajib. Validasi dan payload asli dipulihkan; hasil pengulangan di bawah |
| Regresi `CatalogTests` setelah validasi alasan dipulihkan | PASS, 9 tes |
| Pengulangan `ItemCreationAndDeletionUseRealAuthCsrfVersionAndAudit` | PASS, 1 tes, 0 gagal/dilewati. Sebanyak 56 kasus backend mempunyai hasil lulus pada suite 55 + pengulangan 1; suite penuh tidak diulang lagi setelah koreksi payload tes |
| `RecoveryTests` pada suite backend | PASS, pg_dump/pg_restore PostgreSQL 18 terisolasi; saldo, ledger, identitas request/event, korelasi delivery dan recovery hold diperiksa |
| Sintaks empat script Bash | PASS melalui `bash -n` per file; script production belum dijalankan pada host klien |
| `git diff --check` | PASS; ada peringatan konversi LF/CRLF dari Git Windows |
| Publish API Release lokal dan `/health/ready` | PASS, preview menggunakan build terbaru, HTTP 200 |
| EF `migrations has-pending-model-changes` Release | PASS, model sesuai migrasi terakhir |

Backend menguji database `wms_test_*` terisolasi. Regresi mencakup bootstrap kosong, enrollment tanpa grant otomatis, lokasi penyimpanan baru, HTTPS callback dari proxy tepercaya, API anonim 401, klaim UserInfo, impor PO idempotent, delivery accepted/rejected/reconciliation, pembatasan query, blind count, agregasi shipment, heartbeat, serta penolakan mutasi selama recovery hold. Tidak ada kredensial atau endpoint ERP klien yang digunakan.

## Browser lokal

Preview Vite 4173 dan API 5080, development demo. Tindakan dibatasi pada navigasi, pencarian, dan draft. Dialog receipt dibatalkan; tidak mengonfirmasi mutasi stok.

- Stock position menampilkan posisi terkonfirmasi serta empty state shipment tanpa grafik fixture. Bukti: `stock-desktop.png`.
- Receiving tanpa hasil mempertahankan input dan Clear filters. Setelah filter dihapus, dokumen kembali tampil. Bukti: `receiving-empty-search.png`.
- Draft PO-SIM-100, SKU-A, qty 1 tetap terikat ke sumber semula setelah filter berubah. Review menampilkan sisa 17 dari sisa awal 18; dibatalkan. Bukti: `receiving-draft-review.png`.
- New order menemukan SKU-C melalui lookup; tidak membuat dokumen. Bukti: `order-item-lookup.png`. Kasus SKU di luar halaman awal diuji oleh query/model regresi, bukan dataset preview tiga barang ini.
- Ledger menerima SKU tidak dikenal, menampilkan No matching item dengan input yang masih dapat diubah. SKU-A memulihkan tabel beserta riwayat. Bukti: `ledger-empty-lookup.png`.
- Receiving viewport 390 × 844: lebar dokumen terukur 375 px, tabel di region lokal 311 px dengan scrollWidth 820 px. Tidak ada overflow horizontal halaman. Bukti: `receiving-handheld.png`. Override viewport sudah di-reset.
- Console error pada tab pemeriksaan: 0 entri saat diperiksa.

## Review dan batas bukti

Satu review independen melaporkan enam P1, kemudian diperbaiki dan diperiksa melalui regresi/API/browser. Tidak ada review independen kedua. Pemeriksaan tambahan memulihkan alasan wajib delete-master beserta payload tes HTTP. Tidak ada klaim seluruh perangkat, seluruh modul, atau kepatuhan aksesibilitas telah diuji.

Belum diuji: Docker Compose/Linux (Docker tidak tersedia pada host ini), sertifikat/domain tujuan, provider SSO nyata, ERP nyata dan mapping bisnisnya, beban/operator serentak, off-host backup serta RPO/RTO klien, scanner/printer/RFID fisik, dan UAT gudang. Workflow CI tersedia tetapi belum dijalankan di GitHub. RFID masih pilot simulasi dengan adapter hardware belum tersedia. Ikuti `docs/implementation/production-runbook.md` sebelum go-live; hasil lokal ini belum memberi persetujuan production.
