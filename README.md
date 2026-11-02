# Inventory Management System

Implementasi pilot Inventory + WMS menggunakan **ASP.NET Core 10 + EF Core/Npgsql 10 + PostgreSQL 18 + React/TypeScript/Vite**, dengan modular monolith. UI mengikuti Clear Operations yang dipilih pada 29 Oktober 2026.

- [Implementasi, cara menjalankan, cakupan dan batas verifikasi](docs/implementation/README.md)
- [Tahap pengerjaan saat ini](docs/implementation/progress.md)
- [Frontend dan sumber mockup aktif](prototype/README.md)
- [Solusi .NET](InventoryWms.sln)
- [Konfigurasi Docker Compose untuk server Linux](compose.yaml)
- [Opsi installer lokal Windows dengan SSO](docs/implementation/windows-local.md)

Data pengembangan merupakan simulasi. SSO perusahaan, ERP dan reader fisik memerlukan konfigurasi klien. UAT operasional belum dijalankan. HTML katalog lama telah dihapus; aplikasi baru berada di `prototype/` dan `backend/`.

- [Mulai dari enam dokumen persiapan pembangunan](docs/planning/README.md)
- [PRD tracker barang masuk dan keluar: barcode / RFID](docs/planning/prd-tracker-barcode-rfid.md)
- [Pelaksanaan P0 dan keputusan fondasi](docs/planning/p0/README.md)
- [Acuan rekayasa kebutuhan dan siklus hidup sistem](docs/planning/engineering-basis.md)
- [Proposal design system dan katalog komponen](design-system/README.md)
- [Rancangan UI terbaru: fondasi dan 21 fungsi, tanpa implementasi](design-system/blueprint-2026-10-29/README.md)
- [PDF arsitektur formal](docs/architecture/arsitektur-inventory-wms.pdf)
- [Handoff pembahasan awal](docs/architecture/HANDOFF.md)

Urutan pembahasan: Product Requirements, Technical Requirements, App Flow, Design Brief, Backend Schema, lalu Implementation Plan. Keputusan yang belum ditetapkan tetap ditandai terbuka. Matriks UAT merupakan kriteria penerimaan, bukan hasil pengujian aplikasi.
