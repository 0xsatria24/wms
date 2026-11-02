# Batas enrollment dan payload pendukung

Perbaikan ini menangani pertumbuhan enrollment publik dan amplifikasi memori snapshot. Tidak ada migrasi database atau penghapusan data lama.

## Enrollment

- Endpoint publik menerima paling banyak 10 request per menit per proses API, tanpa antrean. Penolakan limiter menghasilkan HTTP 429 dan `Retry-After: 60`.
- Pemeriksaan kapasitas dan insert memakai lock transaksi pengguna yang sama dengan administrasi dan SSO. Endpoint publik memakai `pg_try_advisory_xact_lock`; jika lock sibuk, request gagal cepat dengan HTTP 429, bukan menunggu.
- Pembuatan identitas dari enrollment publik dan SSO pertama kali dibatasi pada 100 principal pending dan 10.000 principal total. Kuota dibaca dalam transaksi yang memegang lock tersebut, sehingga tetap berlaku lintas proses API. Login identitas yang sudah ada dan pengikatan undangan yang sudah ada tidak memakai slot baru.
- Request email yang sudah ada tetap mengembalikan respons penerimaan generik. Identitas revoked/rejected/deleted tidak dihapus untuk membuka kapasitas; status itu diperlukan untuk mencegah pendaftaran ulang yang melewati pencabutan akses.
- Limiter memori berlaku per proses; kuota database berlaku bersama. Pembatasan jaringan di reverse proxy tetap dapat ditambahkan sesuai deployment.

## Supporting record dan snapshot

- Payload supporting record dibatasi 16.384 byte, baik pada JSON input maupun representasi `jsonb::text` PostgreSQL. Batas yang sama dipakai saat membaca snapshot.
- Follow-up hanya menerima field kontraknya dan catatan 1–2.000 karakter. User, gudang, dan waktu pencatatan ditentukan server.
- Endpoint label history hanya menerima download barang aktif. Kode label, user, gudang, dan waktu diambil dari sumber server. Penggantian barcode tetap melalui perubahan master yang memiliki kontrol peran dan alasan.
- Setiap jenis history dibatasi 10.000 record per gudang; packages/unitMaster dibatasi 100 record per jenis per gudang. Penambahan melewati kapasitas ditolak, tanpa menghapus history secara otomatis.
- Direktori pengguna dan follow-up dibaca per 25 baris, dengan total/page metadata dan kontrol halaman pada UI. Label history membawa paling banyak 25 baris; katalog pendukung dibaca secara terpisah agar history tidak menggeser packages/unitMaster.
- Payload supporting record, audit, dan outbox yang melebihi batas disaring di database sebelum dimuat ke proses API. Snapshot menampilkan peringatan jika ada payload oversized atau katalog lama yang melewati batas daftar. Record asli tetap tersimpan; worker ERP tidak diubah.
- Penghapusan master gagal eksplisit bila ada history oversized yang belum ditinjau, agar pemeriksaan referensi tidak melewati data lama secara diam-diam.

## Penanganan kapasitas dan data lama

Jika muncul peringatan atau penolakan kapasitas, administrator perlu meninjau record tersimpan melalui prosedur operasional yang memiliki backup dan otorisasi. Jangan menghapus identitas penolakan/pencabutan atau memotong history secara otomatis. Batas ini merupakan default implementasi pilot; perubahan kapasitas perlu mempertahankan batas total byte respons dan pengujian regresi.

Pengujian HTTP memakai PostgreSQL terisolasi. Pemeriksaan browser menggunakan respons API uji; itu bukan bukti deployment, perangkat fisik, atau kapasitas produksi.

## Perubahan dan verifikasi, 2 November 2026

File implementasi: `Program.cs`, `Modules/Access/EnrollmentLimits.cs`, `SsoEnrollment.cs`, `Modules/Catalog/SupportingPayload.cs`, `EditService.cs`, `Modules/Reporting/SnapshotQuery.cs`, `WorkspaceQuery.cs`; UI pada `prototype/src/App.tsx`, `management.tsx`, `controls.tsx`. Tujuh tes regresi ditambahkan pada `backend/Wms.Tests/HttpApiTests.cs`.

- Empat tes awal gagal pada kode sebelum patch: kuota enrollment, limiter global, payload/metadata operator, dan pembacaan snapshot. Keempatnya kemudian lulus setelah patch.
- Build dan suite backend: `dotnet test backend/Wms.Tests/Wms.Tests.csproj --configuration Release --no-restore`, dengan logger console/TRX dan timeout diagnosis. Run final menghasilkan 61 lulus dan dua kegagalan infrastruktur: kedua variasi `CatalogTests.UnusedItemCanBeDeletedWithAuditSnapshot`. PostgreSQL mengeluarkan 57P03 setelah file PID cluster pengembangan berubah ke PID proses lain. Ini bukan satu run penuh yang bersih.
- Pengulangan pada cluster tugas tersendiri (`.runtime/security-tests-20261102-pg`, loopback 55539): `dotnet test ... --configuration Release --no-build --no-restore --filter ...` mencakup tujuh regresi keamanan dan kedua variasi katalog tersebut. Semua 9 lulus. Dengan pengulangan ini seluruh 63 kasus memiliki hasil lulus. TRX: `backend/Wms.Tests/TestResults/security-resource-fixes-final.trx` dan `security-resource-fixes-isolated.trx`.
- Regresi meliputi kuota atomik pada dua host API, HTTP 429/Retry-After limiter, penolakan oversized/field tidak dikenal, metadata server, label download sah, penolakan pemalsuan replace history, audit lama oversized, pagination pengguna/follow-up, packages yang tidak tergeser history, serta kesamaan batas JSON input dan representasi PostgreSQL.
- `npm run build`: lulus pada source final. Ada peringatan annotation PURE dari dependency SignalR; tidak ada kegagalan build.
- `node --experimental-transform-types --test tests/*.test.mjs`: 27 lulus. Node mengeluarkan peringatan transformasi tipe eksperimental.
- Browser dengan API fixture: halaman pengguna kedua, reset halaman saat beralih ke pending, dan peringatan data lama berhasil diperiksa. Ini tidak menggantikan pengujian browser terhadap backend produksi.
- `git diff --check`: lulus; Git mengingatkan normalisasi LF/CRLF.

Tidak ada commit, push, deployment, perubahan konfigurasi identitas perusahaan, atau penghapusan record produksi.

## Rate limit login

`POST /api/dev/login` dan `GET /auth/login` memakai kebijakan login yang sama: 5 request per IP per jendela tetap satu menit, dengan batas total 100 request login per menit per proses API. Request berhasil maupun gagal menghabiskan kuota. Mengganti akun, kapitalisasi route, atau trailing slash tidak membuka kuota baru. Tidak ada antrean request login.

IP diambil dari `Connection.RemoteIpAddress` sesudah pemrosesan trusted proxy, bukan dari header klien secara langsung. Nginx menimpa `X-Forwarded-For` pada `/auth/` seperti pada `/api/`. Pada mode demo, header forwarding klien tidak dipakai.

Jika batas tercapai, API mengembalikan HTTP 429, `Retry-After: 60`, `Cache-Control: no-store`, dan kode `login-rate-limit`. UI login demo menampilkan instruksi menunggu satu menit. Endpoint session/logout, API operasional, serta callback OIDC tidak memakai kuota login ini. Callback tetap diproses oleh middleware autentikasi.

Limiter berada dalam memori proses API dan tidak dibagi antar-instance atau dipertahankan setelah restart. Untuk SSO, pembatas ini mengatur permintaan redirect ke penyedia identitas; perlindungan percobaan password dan MFA tetap menjadi pengaturan identity provider. Tidak ada perubahan pada pengaturan identity provider perusahaan.

Implementasi login berada pada `backend/Wms.Api/Modules/Access/LoginRateLimits.cs` dan pendaftaran policy/endpoint pada `Program.cs`. Header proxy diubah pada `deploy/nginx.conf`. Pesan login ada pada `prototype/src/account.tsx` dan `ui.tsx`. Regresi ditambahkan pada `backend/Wms.Tests/LoginRateLimitTests.cs` serta `DeploymentTests.cs`.

Verifikasi login:

- Tiga tes baru gagal sebelum implementasi karena request berlebih masih menerima respons login normal, lalu lulus setelah patch.
- `dotnet test backend/Wms.Tests/Wms.Tests.csproj --configuration LoginSecurity --no-restore --logger ...`: seluruh 70 kasus lulus, tetapi run berstatus gagal karena timeout pembacaan saat `PostgresFixture.DisposeAsync` menghapus database sementara. Ini bukan run penuh yang bersih. TRX: `backend/Wms.Tests/TestResults/login-rate-limit.trx`.
- Pengulangan dengan `--no-build --no-restore --filter ...` dan `Command Timeout=120` pada koneksi database tes: 5 tes terarah lulus, exit 0, termasuk cleanup. TRX: `backend/Wms.Tests/TestResults/login-rate-limit-focused.trx`.
- Regresi meliputi batas per IP, batas agregat dengan pergantian IP, penerusan alamat oleh proxy tepercaya, penolakan pergantian akun/header palsu pada demo, variasi kapitalisasi/trailing slash, HTTP 429/Retry-After/no-store/kode respons, session di luar kuota, serta alur CSRF/OIDC normal.
- `npm run build`: lulus; `node --experimental-transform-types --test tests/*.test.mjs`: 27 lulus. Peringatan dependency SignalR, ukuran chunk Vite dan transformasi tipe Node tetap dicatat sebagai peringatan build/runtime alat.
- Browser lokal dengan mock HTTP 429: pesan menunggu satu menit tampil, tombol/form tetap dapat digunakan, dan tidak ada page error. Ini pengujian UI fixture, bukan SSO perusahaan atau nginx produksi.
- Review independen tidak menemukan bypass atau regresi konkret pada cakupan login. `git diff --check` lulus. Nginx tidak dijalankan; header proxy ditelaah pada konfigurasi dan perilaku trusted forwarding diuji melalui TestServer.

Perubahan login belum di-deploy atau diterapkan dengan restart layanan aplikasi yang sedang aktif.
