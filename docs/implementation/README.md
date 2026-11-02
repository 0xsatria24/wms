# Implementasi pilot Inventory + WMS

Tanggal mulai: 30 Oktober 2026. Stack dipilih pengguna saat meminta implementasi ulang dari mockup Clear Operations. Implementasi ini menyediakan fondasi full stack dan UI per fungsi dengan data simulasi. Ini bukan pernyataan selesai UAT, kesiapan produksi, atau validasi scanner/reader fisik.

## Struktur dan stack

| Bagian | Implementasi |
|---|---|
| API | `backend/Wms.Api`, ASP.NET Core 10; cookie BFF/OIDC, CSRF, akses gudang dan SignalR |
| Inti dan modul | `backend/Wms.Core`; Inventory Core menangani perubahan stok dalam satu transaksi; inbound, outbound, transfer/retur dan count memiliki handler terpisah |
| Penyimpanan | PostgreSQL 18; EF Core 10.0.14 dan Npgsql EF provider10.0.3; migrasi di `Wms.Core/Infrastructure/Migrations` |
| Worker | `backend/Wms.Worker`; outbox database, lease dan retry dengan ID event tetap |
| Web | `prototype`; React19, TypeScript, Vite; English/Indonesia dan tema terang/gelap |
| Capture | IndexedDB untuk pending; manifest/service worker untuk fondasi PWA |
| RFID | `backend/Wms.Gateway`; kontrak adapter reader, spool SQLite WAL, pengiriman observasi melalui OAuth client credentials |
| Uji | xUnit dengan PostgreSQL nyata; Testcontainers PostgreSQL menjadi default jika Docker tersedia; SQLite spool diuji terpisah |
| Target hosting | `compose.yaml`; frontend nginx, API, worker dan PostgreSQL pada Linux |

API dan worker berbagi model/intinya sebagai modular monolith. Tidak ada microservice stok paralel. Saldo numerik, entri, alokasi, dokumen, audit, hasil idempotensi dan outbox disimpan di PostgreSQL. Dokumen pilot satu baris/item menggunakan discriminator jenis. Model ini belum mencakup seluruh tabel logis lot, serial, multi-owner dan ERP dalam draf skema.

## Menjalankan lokal

Pada workspace pengembangan ini, SDK .NET10.0.403 disiapkan portabel di `.tools/dotnet`, PostgreSQL18.4 tersedia pada komputer, dan cluster milik proyek berada di `.runtime/pgdata` pada loopback55432. Cluster ini terpisah dari instalasi/service/database lain. Kredensial acak hanya berada di `.runtime/`, yang diabaikan Git.

```powershell
./scripts/start-local.ps1
```

Preview: `http://127.0.0.1:4173/`; API: `http://127.0.0.1:5080/`. Akun demo: `admin@demo.company`, `operator@demo.company`, `supervisor@demo.company`; password contoh `demo123`. Tidak digunakan untuk autentikasi produksi.

```powershell
./scripts/dotnet.ps1 build InventoryWms.sln
./scripts/test-local.ps1
cd prototype
npm run typecheck
npm run test:pending
npm run build
```

`test-local.ps1` memakai PostgreSQL18 lokal dengan database baru terisolasi per pengujian. Tanpa `WMS_TEST_ADMIN`, fixture xUnit menjalankan image PostgreSQL18 melalui Testcontainers dan memerlukan Docker. Hasil uji bukan UAT operasional. Lihat [status verifikasi](verification.md).

Pengujian kontrak API ada di `backend/Wms.Tests/HttpApiTests.cs`, menggunakan [WebApplicationFactory dan TestServer ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0). Tes menjalankan pipeline aplikasi, cookie login dan CSRF asli dengan database PostgreSQL terisolasi. Transport HTTP berada dalam proses tes; koneksi PostgreSQL memakai server nyata. Middleware loopback hanya berada dalam host tes agar login demo mengikuti syarat alamat lokal. Pemeriksaan ini tidak menguji browser, Kestrel, TLS, reverse proxy, SSO perusahaan atau jaringan produksi.

## Alur dan cakupan fungsi

| Fungsi | UI dan perilaku pilot |
|---|---|
| S01 | Login demo, request access dan contoh recovery; scope perusahaan/gudang; tambah user pending, review peran/approval dan hapus user dengan pencabutan akses serta audit; OIDC perusahaan perlu konfigurasi |
| S02 | Master SKU, nama, barcode internal, faktor satuan, aktif/nonaktif, atribut opsional dan gambar; hapus barang yang belum digunakan dengan konfirmasi, alasan dan audit; definisi lokasi/satuan lokal perusahaan |
| S03 | Filter/sort/pilih posisi, Dipesan/Tersedia tanpa kolom Fisik; spesifikasi dan fixture tren terpisah; saldo awal melalui dokumen |
| S04 | Reservasi order released; validasi ulang jumlah/kelayakan di bawah lock; kekurangan tidak dialokasikan diam-diam |
| S05 | PO aktual, sisa, review, konfirmasi satu kali, tugas QC dan outbox; contoh60 dari100 menyisakan40 |
| S06 | Pembagian good/not good harus sesuai jumlah; not good tetap ditahan; hasil good membuat tugas putaway |
| S07 | Scan barang dan tujuan; perpindahan aktual berpasangan tanpa menambah fisik gudang |
| S08 | Draf, submit, approval oleh pihak berbeda, lalu release terpisah; tidak otomatis mengalokasikan stok |
| S09 | Scan asal/item, aktual dan alasan short pick; stok/komitmen ikut berpindah ke staging |
| S10 | Verifikasi packing, review, pengiriman aktual; fisik berkurang saat shipment, ERP memiliki hasil sendiri |
| S11 | Lepas alokasi yang belum dipicking; alokasi staging tetap ada sampai return-to-stock terkonfirmasi |
| S12 | Dispatch/receipt aktual dengan posisi transit per transfer;50 kirim/48 terima menyisakan2 |
| S13 | Retur pelanggan mengacu pengiriman dan masuk QC; contoh historis dibatasi5; retur supplier demo mengurangi stok QC yang tidak dipesan |
| S14 | Freeze tersimpan; operator tidak menerima expected balance dari API; submit bukan adjustment; reviewer berbeda dan unfreeze eksplisit |
| S15 | Daftar event/status transport/hasil ERP, payload dan retry event tetap; adapter ERP belum terhubung |
| S16 | Ledger, sumber, occurred/posted timestamps, filter dan CSV dengan pemeriksaan akses server saat ekspor |
| S17 | Pending belum terkirim dan unknown dibedakan; payload/versi/key/owner/gudang asli disimpan IndexedDB |
| S18 | Kasus diturunkan dari antrean; catatan tindak lanjut; backup/restore/RPO/RTO tetap belum dibuktikan |
| S19 | Posisi stok terkonfirmasi dan pengamatan scan dipisahkan; timeline ledger; level SKU tidak diklaim sebagai identitas unit |
| S20 | Preview/unduh Code128 internal; penggantian kode, versi isi kemasan, metadata perangkat demo; tidak mengubah saldo |
| S21 | Capture RFID simulasi, dedup objek, missing/unexpected/unknown, review pengecualian dan fallback barcode; tidak autopost stok |

Semua route mengikuti [app flow](../planning/03-app-flow.md) dan [suite desain](../../design-system/redesign-2026-10-29-v2/complete-suite/README.md). Contoh barang menggunakan satuan dasar unit. Barcode keyboard-wedge dapat mengisi field yang berfokus; perangkat fisik belum diuji. Tracking lot/serial/expiry, aturan presisi bisnis, approval final dan kebijakan parsial menunggu keputusan operasional. Toggle parsial adalah asumsi demo yang hanya boleh diubah admin pada Development.

**Delete item / Hapus barang:** tersedia bagi admin dan supervisor di bagian tindakan form Item master. Dialog menampilkan barang/SKU, meminta alasan, dan menjelaskan bahwa penghapusan tidak dapat dibatalkan. Backend memeriksa akses terkini dan versi master, mengunci item, serta memeriksa referensi di semua gudang. Posisi stok, termasuk saldo nol, dokumen, kemasan atau riwayat label menghalangi penghapusan; barang tersebut dapat dinonaktifkan untuk penggunaan baru. Barang yang belum digunakan dihapus bersama pencatatan audit yang menyimpan identitas, nama, barcode, versi, pelaku dan alasan. Tidak ada endpoint untuk menghapus saldo atau ledger.

**Admin, tambah dan hapus user:** tombol Add user / Tambah user berada di header Pengelolaan akses; Delete user / Hapus user berada pada tindakan setiap baris, termasuk permintaan pending. Penambahan meminta nama, email dan alasan, menyimpan user berstatus pending tanpa hak gudang, lalu membuka tab Menunggu persetujuan. Email dinormalisasi dan pengajuan bersamaan dengan email yang sama ditolak. Verifikasi dan approval tetap diperlukan. Fitur ini mengelola catatan akses aplikasi; tidak mengirim undangan, membuat password atau membuat identitas di provider SSO. Login demo tetap terbatas pada tiga akun contoh yang disebutkan di atas.

Penghapusan meminta konfirmasi dan alasan, mengubah status user menjadi deleted, mencabut seluruh grant, dan menyembunyikannya dari daftar. Identitas dan riwayat transaksi/audit dipertahankan. Akun sendiri tidak dapat dihapus; admin harus berwenang atas seluruh gudang target. Review akses yang lama tidak dapat mengaktifkan kembali user terhapus, dan email tersebut tidak dapat digunakan untuk membuat identitas pengganti melalui Add user. Pemulihan akun belum disediakan di panel. Label pilihan bahasa adalah **Bahasa Indonesia**, tanpa tambahan dalam tanda kurung.

Untuk menghentikan proses lokal milik proyek: `./scripts/stop-local.ps1`. Tambahkan `-StopDatabase` untuk menghentikan cluster pengembangan proyek. Skrip memeriksa PID dan command line sebelum menghentikan proses aplikasi. Skrip lokal ini khusus workspace Windows yang sudah memiliki SDK/dependensi dan cluster tersebut, bukan installer untuk komputer baru. Uji pending memakai Node24 dengan transformasi tipe eksperimental dan IndexedDB tiruan; ini bukan pengujian browser/PWA fisik.

## Transaksi dan recovery permintaan

Jumlah API berupa string desimal dan disimpan sebagai `numeric(18,6)` dalam pilot. Presisi final mengikuti D02. Klien tidak mengesahkan saldo. Inventory Core memakai transaksi eksplisit; klaim idempotensi didahulukan, lalu baris lokasi diurutkan sebelum lock, termasuk lokasi transit. Dokumen membawa expected version dan sisa/kondisi diperiksa setelah lock. Penguncian ini konservatif; belum menjadi bukti throughput produksi.

Hash mempertahankan isi bisnis dengan urutan properti JSON kanonis dan normalisasi string kuantitas. Key/isi sama mengembalikan hasil yang sama, key/isi berbeda ditolak. Akses terkini diperiksa sebelum hasil retry diberikan. Principal asal turut diperiksa, sehingga pergantian akun tidak memindahkan pending. Scan yang hanya membentuk draf tidak mengubah stok.

Ledger/audit/outbox commit bersama saldo dan dokumen. SignalR hanya mengirim invalidasi; klien mengambil snapshot yang diperiksa hak aksesnya lagi. Offline disimpan sebelum send. Unknown mempertahankan request asli dan konfirmasi baru pada dokumen tersebut ditahan sampai permintaan sebelumnya ditinjau.

## Integrasi yang masih perlu konfigurasi

**SSO:** isi `Oidc:Authority`, `Oidc:ClientId`, secret melalui environment/secret store, callback dan HTTPS/proxy terpercaya. Login memakai authorization code dan PKCE. Identitas SSO baru didaftarkan sebagai pending, tanpa hak admin otomatis. Bootstrap administrator harus menggunakan issuer/subject provider yang terverifikasi; tidak dilakukan dengan identitas klien yang ditebak. Forgot/reset produksi mengikuti identity provider; layar lokal merupakan preview tanpa pengiriman email/password.

**ERP:** worker tidak mengirim event sebelum endpoint HTTPS, dukungan idempotensi dan protokol adapter ditetapkan. `Erp:Protocol=wms-v1` adalah kontrak adapter awal, bukan kontrak ERP klien yang sudah disepakati. `2xx` transport dipisahkan dari hasil bisnis `accepted`. Atur `Erp:StatusEndpoint` sebagai URL HTTPS dengan placeholder `{eventId}` untuk menanyakan hasil bisnis event yang sudah diakui; worker hanya membuka urutan event berikutnya setelah status `accepted` terverifikasi. Payload/event ID tidak berubah saat retry. Restore memerlukan rekonsiliasi sebelum replay.

**RFID:** pilih reader dan SDK resmi, implementasikan `IRfidReader`, tetapkan gateway principal/grant dan reader/area/gudang. Aktifkan `Gateway:Enabled`, authority dan audience JWT hanya setelah konfigurasi identitas gateway siap. Endpoint observasi memakai bearer khusus, bukan sesi/cookie browser. Metadata reader terdaftar diperlukan. Adapter hardware belum tersedia; gateway tidak mengarang bacaan.

**Hosting:** Compose tersedia tetapi belum dijalankan karena Docker tidak tersedia di mesin pemeriksaan. PostgreSQL18 menyimpan volume pada `/var/lib/postgresql`. Isi `.env` dari `.env.example` sebelum menjalankan. Binding web awal adalah loopback; konfigurasi TLS, trusted proxy, akses jaringan, backup dan pemulihan harus mengikuti lingkungan perusahaan. Tidak ada deploy/publish yang dilakukan.

## Dasar teknis

Implementasi transaksi mengikuti [EF Core transactions](https://learn.microsoft.com/en-us/ef/core/saving/transactions) dan [row locking PostgreSQL18](https://www.postgresql.org/docs/18/explicit-locking.html). Provider mengikuti [Npgsql10](https://www.npgsql.org/efcore/release-notes/10.0.html). Konfigurasi identitas mengikuti [OIDC ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-oidc-web-authentication?view=aspnetcore-10.0). Infrastruktur uji memakai [Testcontainers PostgreSQL](https://dotnet.testcontainers.org/modules/postgres/).
