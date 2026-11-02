# Instalasi lokal Windows dengan SSO

Opsi tambahan untuk satu PC Windows x64. Frontend hasil build disajikan API .NET melalui HTTPS localhost; API dan worker memakai Windows Service. PostgreSQL 18 berjalan lokal sebagai service terpisah. Deployment Docker/Linux tetap memakai `compose.yaml` dan tidak diganti oleh opsi ini.

Pengguna membuka shortcut **Inventory WMS**, tanpa IDE, terminal, Node, SDK .NET, Docker atau WSL. Login tetap membutuhkan koneksi ke identity provider perusahaan. Opsi ini bukan aplikasi sepenuhnya offline. Instalasi pada PC berbeda menghasilkan database terpisah, bukan sinkronisasi data antarmesin.

## Build oleh pengembang

Prasyarat mesin build: Windows x64, Node/dependensi frontend, SDK .NET 10 sesuai `global.json`, akses NuGet, dan compiler Inno Setup 6. Paket compiler bisa ditunjuk eksplisit.

```powershell
./scripts/build-windows.ps1 -Version 1.0.0 -InnoCompiler 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
```

Hasil: direktori baru `outputs/windows-local/<versi-tanggal>/`, berisi `InventoryWms-Setup.exe` dan `payload`. API/worker diterbitkan self-contained untuk win-x64, frontend ke `payload/api/wwwroot`. `-PackageOnly` secara eksplisit menghasilkan payload tanpa installer. Direktori output yang sudah ada ditolak agar paket lama tidak tertimpa. Paket tidak menyertakan database development, `.runtime`, konfigurasi klien atau secret. Installer hasil lokal belum ditandatangani; penandatanganan rilis dilakukan terpisah.

## Persiapan administrator klien

1. Pasang PostgreSQL **18** sebagai Windows Service. Siapkan role dan database WMS khusus pada loopback, dengan password kuat. Jangan memakai role superuser PostgreSQL untuk runtime. Untuk migrasi, gunakan role dengan hak skema yang diperlukan; sesudah migrasi, runtime cukup memakai hak operasi WMS.
2. Siapkan sertifikat PFX dengan private key untuk **localhost**, termasuk SAN localhost, belum kedaluwarsa, dan rantai CA dipercaya **Local Computer**. API menggunakan `https://localhost:5443` secara default. Installer tidak menerbitkan sertifikat atau menambahkan trust secara otomatis. Konfigurasi binding LAN tidak didukung opsi lokal ini.
3. Daftarkan aplikasi confidential OIDC pada provider perusahaan. Callback: `https://localhost:5443/signin-oidc`; signed-out callback: `https://localhost:5443/signout-callback-oidc`. Jika port diganti, keduanya harus mengikuti port itu. Provider harus mendukung callback localhost HTTPS dan authorization code/PKCE untuk aplikasi ini. Gunakan client secret yang dikelola admin; akses internet/intranet ke provider tetap diperlukan.
4. Salin `deploy/windows/client-config.example.json` ke lokasi provisioning yang hanya bisa dibaca admin. Isi identitas perusahaan, koneksi database, nama service/direktori PostgreSQL, konfigurasi SSO dan path/password PFX. Jangan commit konfigurasi nyata. PFX dan berkas provisioning memuat secret; lindungi dengan ACL administrator.
5. Siapkan database, migrasi dan admin pertama secara eksplisit memakai payload hasil build. `bootstrap.example.json` diisi dengan issuer dan subject administrator yang sudah diverifikasi melalui identity provider, serta gudang/lokasi nyata. Tidak ada akun/password demo production.

Contoh PowerShell Administrator, dengan direktori payload dan provisioning yang disesuaikan:

```powershell
$payload = 'C:\WmsRelease\payload'
$clientConfig = 'C:\WmsProvisioning\client-config.json'
& "$payload\api\Wms.Api.exe" --environment Production --contentRoot "$payload\api" --deployment-config $clientConfig --bootstrap 'C:\WmsProvisioning\bootstrap.json'
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap failed; do not install yet.' }
```

Bootstrap hanya untuk database baru. Database yang sudah diinisialisasi akan ditolak agar identitas/akses yang ada tidak tertimpa. Untuk upgrade, backup dulu dan jalankan migrasi yang sudah ditinjau secara eksplisit dengan `--migrate-only`, bukan `--bootstrap`. Perintah migrasi memuat konfigurasi production yang sama; pastikan path DataProtection pada konfigurasi dapat dibuat administrator.

## Instalasi

Jalankan `InventoryWms-Setup.exe` sebagai Administrator dan pilih berkas konfigurasi klien. Aplikasi dipasang di Program Files. Installer melakukan validasi sebelum menyalin aplikasi: PostgreSQL 18/service aktif, PFX/private key/masa berlaku/trust Local Computer, HTTPS localhost, SSO terisi, demo dan migrasi otomatis nonaktif, serta kepemilikan/status service lama. Folder data yang sudah ada dengan owner/izin tidak terpercaya atau reparse point ditolak; administrator perlu memperbaikinya sebelum mencoba lagi. Bila validasi gagal, jalankan pemeriksaan terminal berikut dari payload untuk pesan terperinci:

```powershell
& "$payload\deployment\install-services.ps1" -InstallDir 'C:\Program Files\Inventory WMS' -ConfigPath $clientConfig -ValidateOnly
```

Instalasi terminal untuk payload yang telah disalin ke lokasi final juga tersedia:

```powershell
& 'C:\Program Files\Inventory WMS\deployment\install-services.ps1' -InstallDir 'C:\Program Files\Inventory WMS' -ConfigPath $clientConfig
```

Service: `InventoryWms.Api` dan `InventoryWms.Worker`, berjalan dengan virtual account masing-masing, startup delayed-auto, dependensi PostgreSQL dan kebijakan restart. API harus lulus `/health/ready` sebelum worker dinyalakan. Shortcut browser dibuat setelah startup berhasil. API tidak menjalankan migrasi atau seed saat startup harian.

Berkas aplikasi berada di Program Files. Konfigurasi aktif, salinan PFX, key cookie dan heartbeat berada di `%ProgramData%\InventoryWms`. ACL memberi akses administrator/SYSTEM dan service terkait; worker memakai konfigurasi tersendiri tanpa secret SSO/PFX. Key cookie harus dipertahankan saat upgrade. Log runtime memakai **Event Viewer > Windows Logs > Application**. Periksa sumber Wms.Api/Wms.Worker atau .NET Runtime; service account tidak memerlukan akses tulis ke folder executable.

## Upgrade, berhenti dan uninstall

Backup database dan key DataProtection dengan prosedur perusahaan, lalu uji restore pada lingkungan terpisah. Paket ini tidak menyediakan backup otomatis atau bukti pemulihan.

```powershell
Stop-Service InventoryWms.Worker
Stop-Service InventoryWms.Api
```

Installer menolak upgrade saat service masih berjalan atau nama service menunjuk executable milik instalasi lain. Simpan release sebelumnya dan konfigurasi sebagai bahan pemulihan. Migrasi skema dapat memerlukan pemulihan database; mengganti executable saja bukan rollback skema. Berkas konfigurasi provisioning yang dipilih pada upgrade menjadi konfigurasi aktif baru, sehingga gunakan salinan terbaru yang lengkap.

Uninstall melalui Settings > Apps, atau jalankan `deployment/uninstall-services.ps1 -InstallDir '<lokasi aplikasi>'` dari PowerShell Administrator. Uninstall menghapus service aplikasi dan executable; PostgreSQL, database dan ProgramData **dipertahankan**. Penghapusan data hanya dilakukan administrator secara terpisah setelah kebijakan retensi/backup dipenuhi.

## Verifikasi dan batas

Tes hosting mencakup navigasi SPA, route API/auth/health/hub yang tidak boleh berubah menjadi HTML, HTTPS langsung dan regresi proxy/SSO. `scripts/test-windows-deployment.ps1` memeriksa parsing konfigurasi dan penolakan pengaturan berbahaya; tidak memasang service. Build/publish dan kompilasi installer bukan bukti keberhasilan instalasi pada PC klien atau login ke SSO perusahaan. Uji service saat boot, TLS, SSO, upgrade, uninstall dan backup/restore pada mesin target tetap diperlukan sebelum operasional.

Referensi implementasi: [Windows Service .NET](https://learn.microsoft.com/aspnet/core/host-and-deploy/windows-service?view=aspnetcore-10.0), [compiler Inno Setup](https://jrsoftware.org/isdl.php). Paket installer ini tidak mengubah `compose.yaml`, Dockerfile atau konfigurasi Nginx Linux.
