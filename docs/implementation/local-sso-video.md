# SSO lokal untuk rekaman alur WMS

Disiapkan pada 3 November 2026 untuk komputer ini. Keycloak 26.8.1 dan portable Temurin Java 25 diunduh dari distribusi resmi dan checksum diverifikasi. Keycloak terikat ke loopback, HTTPS `https://localhost:8443`, realm `wms-local`, confidential client `inventory-wms-local`, authorization code/PKCE. HTTP dimatikan. Penyimpanan identitas H2 privat digunakan hanya untuk pengujian lokal, bukan deployment identitas production.

Konfigurasi dan kredensial berada di `.runtime/local-sso/`, diabaikan Git dan dibatasi ke akun Windows pemilik, Administrators dan SYSTEM:

- `client-config.json`: konfigurasi yang dipilih saat menjalankan installer sebagai Administrator. Koneksi menuju database aplikasi terpisah `wms_sso_local`, sudah dimigrasikan tanpa seed/admin/barang.
- `AKUN-LOKAL.txt`: username/email dan password akun SSO pengujian. Jangan tampilkan berkas ini dalam video.
- `localhost.pfx`/`localhost.cer`: sertifikat server khusus localhost, non-CA, berakhir 3 Desember 2026.
- `runtime.json`: pengaturan Java/Keycloak dan secret internal. Jangan commit atau bagikan.

Sertifikat publik dipercaya pada CurrentUser dan, dengan persetujuan eksplisit pengguna melalui UAC, LocalMachine Root. Thumbprint: `E329825B357FE28A72F01E09F67B30007CD39F94`. Untuk menghapus trust setelah pengujian, hapus hanya thumbprint tersebut dari kedua store, jangan menghapus sertifikat lain.

## Rekaman melalui installer

1. Pastikan cluster PostgreSQL lokal port 55432 berjalan. PostgreSQL Windows Service terpasang, tetapi database pengujian ini memakai cluster workspace yang perlu tetap berjalan selama sesi video.
2. Jalankan `scripts/start-local-sso.ps1` jika Keycloak belum berjalan. Jangan gunakan `-ImportRealm` untuk penggunaan harian atau menimpa realm yang sudah ada.
3. Jalankan installer terbaru sebagai Administrator; pilih `.runtime/local-sso/client-config.json`. Jangan gunakan `preview-config.json`, yang khusus untuk verifikasi sementara.
4. Installer membuat kode sendiri di `%ProgramData%\InventoryWms\secrets\setup-code.txt`. Buka sebagai Administrator dan salin tanpa memperlihatkannya dalam video.
5. Buka shortcut Inventory WMS, masukkan kode, lanjutkan SSO, login dengan akun dari `AKUN-LOKAL.txt`, lalu tinjau dan buat admin sendiri.
6. Login kembali dan isi barang/transaksi sendiri. Tidak ada seed inventori atau barang contoh pada database ini.

API preview sementara harus dihentikan sebelum installer dijalankan agar port 5443 tidak bentrok. Keycloak tetap harus berjalan setelah installer; installer WMS tidak memasang Keycloak sebagai Windows Service. Pengujian ini menggunakan konfigurasi production/OIDC aplikasi, tetapi bukan bukti deployment production atau kesiapan seluruh integrasi ERP/RFID.

## Referensi owning source

- Keycloak TLS: https://www.keycloak.org/server/enabletls
- Keycloak realm import: https://www.keycloak.org/server/importExport
- ASP.NET OIDC claim actions: https://source.dot.net/Microsoft.AspNetCore.Authentication.OpenIdConnect/OpenIdConnectOptions.cs.html

Saat verifikasi nyata ditemukan bahwa default UserInfo claim actions menghapus `iss` setelah token divalidasi. Callback aplikasi kini menyimpan issuer token tervalidasi dalam AuthenticationProperties dan memulihkannya untuk enrollment serta sesi setup. Tidak mengambil issuer dari input browser atau melonggarkan validasi token.
