# Opsi instalasi Windows lokal

Status: disetujui pengguna pada 2 November 2026; implementasi dan batas verifikasi dicatat di docs/implementation/windows-local-verification.md. Pengguna memilih tetap memakai SSO perusahaan.

## Tujuan

Tambahkan jalur deployment Windows x64 pada PC klien tanpa Docker, WSL, IDE, Node, atau SDK .NET pada mesin pengguna. Jalur Docker/Linux yang ada tetap tersedia. Akses aplikasi lewat shortcut browser. Tidak membuat mode login lokal atau menggunakan akun demo untuk operasional.

## Pendekatan

1. Windows Service + browser (direkomendasikan): gunakan React dan .NET yang ada; dua service untuk API dan worker, PostgreSQL lokal sebagai service. Installer Inno Setup menghasilkan Setup.exe.
2. Pembungkus WebView2: menambahkan jendela desktop, tetapi tetap memerlukan service/database yang sama. Ditunda karena tidak diperlukan untuk opsi instalasi lokal.

## Bentuk paket yang diusulkan

- Skrip build Windows menerbitkan API dan worker self-contained win-x64 dan membangun React. Hasil frontend disalin ke wwwroot API. Paket hanya berisi hasil publish, tanpa .runtime, data development atau kredensial workspace.
- Dukungan Windows Service diaktifkan pada host Windows; host Linux/container tetap memakai lifecycle saat ini.
- API menyajikan aset frontend hanya ketika opsi hosting statis diaktifkan. Route API/auth/hub/health yang tidak ditemukan tetap memberikan respons semestinya, tidak berubah menjadi HTML SPA.
- Installer memasang executable di Program Files dan konfigurasi/data protection/log di ProgramData dengan pembatasan akses. API dan worker menggunakan akun service dengan hak terbatas, startup otomatis dan recovery restart.
- PostgreSQL 18 Windows menjadi prasyarat yang diperiksa installer; tidak mengunduh atau mengubah instalasi database lain secara diam-diam. Konfigurasi menunjuk database WMS khusus dan service PostgreSQL yang dipilih administrator. Dokumentasi menjelaskan persiapan database sebelum instalasi.
- Konfigurasi klien disediakan sebagai berkas terpisah saat instalasi: koneksi database, nama perusahaan, OIDC Authority/ClientId/secret, alamat HTTPS dan sertifikat. Secret tidak ditanam dalam Setup.exe atau source control.
- HTTPS langsung melalui Kestrel untuk alamat lokal, default https://localhost:5443. Sertifikat harus dipercaya PC dan callback tersebut didaftarkan pada provider SSO. Tidak menonaktifkan validasi TLS dan tidak mempercayai sertifikat otomatis.
- Untuk hosting HTTPS langsung, kebutuhan reverse proxy menjadi bersyarat; mode Docker tetap mewajibkan konfigurasi proxy terpercaya seperti saat ini. Cookie secure, CSRF dan otorisasi tetap dipertahankan.
- Migrasi/bootstrap admin dijalankan eksplisit saat persiapan instalasi, memakai issuer/subject SSO yang terverifikasi. Startup harian tidak melakukan seed demo atau perubahan skema otomatis.
- Shortcut membuka alamat HTTPS aplikasi. SSO tetap memerlukan akses ke identity provider perusahaan. Paket tidak diklaim sepenuhnya offline.
- Uninstall menghentikan/menghapus service aplikasi; database, backup dan data persisten dipertahankan. Upgrade tidak menjalankan migrasi destruktif atau menghapus data otomatis.

## Batas dan verifikasi

Tidak termasuk login password lokal, WebView2, sinkronisasi antarmesin, instalasi di PC klien nyata, atau klaim siap production. Setiap PC mandiri mempunyai database sendiri; berbagi data memerlukan host bersama.

Verifikasi mencakup build/publish win-x64, pengujian route SPA/API dan konfigurasi HTTPS, regresi deployment Linux yang relevan, validasi skrip/installer, serta smoke test paket lokal jika tooling tersedia. Instalasi service yang memerlukan administrator, sertifikat dan SSO klien dicatat sebagai belum teruji bila lingkungan tidak menyediakannya. Setup.exe hanya dinyatakan tersedia jika benar-benar berhasil dikompilasi.
