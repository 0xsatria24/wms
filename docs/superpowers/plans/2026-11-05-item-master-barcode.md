# Item Master Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daftar barang melalui scan barcode atau kode internal otomatis tanpa wajib mengetik barcode.

**Architecture:** Tambahkan pilihan otomatis/scan pada form yang ada. Server menghasilkan kode internal saat membuat item; gunakan mekanisme label dan audit yang sudah ada.

**Tech Stack:** React/TypeScript, ASP.NET Core, EF Core/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-05-item-master-barcode.md`

## Global Constraints

- Kode internal memakai namespace `IW-`, bukan GTIN resmi.
- Scan kamera di luar lingkup tahap ini; dukung scanner keyboard USB/Bluetooth dengan akhiran Enter.
- Pertahankan barcode lama, nol awal, keunikan, audit penggantian, hak akses, dan draf. Pembuatan master tidak menambah stok.

## Review Focus

- Enter scanner tidak menyimpan seluruh form.
- Barcode berawalan nol tidak diubah menjadi angka.
- Barcode duplikat atau bentrok SKU ditolak.
- Retry create tidak mengganti kode yang sudah tersimpan.
- Edit biasa tidak mengaktifkan ulang generator atau kehilangan draf.

### Task 1: Kontrak barcode otomatis pada server

**Files:** `backend/Wms.Api/Modules/Catalog/EditService.cs`, `backend/Wms.Tests/CatalogTests.cs`.

**Interface:** payload master menambahkan `generateBarcode: boolean`; create otomatis menerima barcode kosong. Edit tetap memakai barcode tersimpan dan version. Pastikan retry identik aman; request berbeda untuk SKU yang sudah ada tetap konflik.

- [ ] Tambahkan tes gagal: auto-create, scan eksplisit dengan nol awal, duplikat/bentrok SKU, retry, dan edit mempertahankan kode.
- [ ] Jalankan `scripts/test-local.ps1 -Filter CatalogTests`; pastikan gagal karena perilaku belum tersedia.
- [ ] Implementasikan generator server memakai `IW-` + `ReferenceId.New()`, pemeriksaan konflik dan penanganan retry dalam transaksi yang sama. Barcode hasil harus tersedia melalui hasil simpan atau pembacaan ulang item.
- [ ] Ulangi tes hingga lulus; periksa izin dan audit penggantian.

### Task 2: Form scan dan otomatis

**Files:** `prototype/src/management.tsx`, `prototype/src/api.ts` bila tipe payload memerlukan perubahan, `prototype/tests/item-barcode.test.mjs` (baru, hanya jika logika payload dipisahkan), `output/playwright/verify-item-barcode.mjs` (uji browser).

**Interface:** mode create `auto | scan`; kirim `generateBarcode` sesuai kontrak Task 1. Mode scan memakai input teks terfokus, Enter menyelesaikan pembacaan tanpa submit form. Input manual tersedia sebagai cadangan eksplisit.

- [ ] Buat dan jalankan uji browser yang gagal: create tanpa input kode, scanner mengirim `000123` + Enter, draf tetap ada saat ganti mode, serta edit barcode lama.
- [ ] Implementasikan pilihan otomatis/scan, petunjuk EN/ID, fokus scanner, dan validasi sesuai mode. Jangan bergantung pada deteksi kecepatan ketikan.
- [ ] Setelah simpan, tampilkan barcode tersimpan dan akses unduh label yang ada. Pertahankan alasan wajib ketika mengganti barcode.
- [ ] Verifikasi create, scan, fallback manual, edit, dan label pada desktop/ponsel. Pastikan tidak ada mutasi stok.

### Task 3: Verifikasi akhir

- [ ] Jalankan `node --experimental-transform-types --test tests/*.test.mjs` dari `prototype`, lalu `npm run build`.
- [ ] Jalankan tes backend terkait melalui `scripts/test-local.ps1 -Filter CatalogTests` dan uji browser Task 2.
- [ ] Review diff untuk draf, duplikasi/retry, izin dan audit; laporkan hasil serta batas perangkat scanner yang benar-benar diuji.

**Eksekusi yang disarankan:** native dalam chat ini agar hemat konteks. Dokumen ini hanya rencana; implementasi belum dimulai.
