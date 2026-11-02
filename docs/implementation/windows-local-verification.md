# Verifikasi opsi Windows, 2 November 2026

## Artefak

- Installer: `outputs/windows-local/1.0.0-20261102-221100/InventoryWms-Setup.exe`.
- Payload: direktori `payload` di sebelah installer; self-contained `win-x64` API/worker dan frontend hasil build.
- SHA256 installer final: `4B2490B001D1A4627B6FF6EF2E682D0DCE8B4518D26ED239529E4AB07A79A6A0`.
- Compiler: Inno Setup 6.7.4 dari distribusi resmi; tanda tangan digital installer compiler diverifikasi sebelum digunakan. Installer aplikasi hasil build belum ditandatangani.
- Skrip deployment di payload dibandingkan dengan source menggunakan hash dan cocok. Folder hasil build diabaikan Git; konfigurasi nyata dan database development tidak dimasukkan.

## Pemeriksaan yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Tes hosting baru sebelum implementasi | Dua tes gagal sesuai fitur yang belum tersedia: route SPA 404 dan direct HTTPS masih mewajibkan proxy |
| `scripts/test-local.ps1 -Configuration Release -Filter 'FullyQualifiedName~WindowsHostingTests\|FullyQualifiedName~DeploymentTests'` | 8 lulus, 0 gagal; HTTPS langsung/SPA/reserved route dan regresi proxy/SSO |
| `scripts/test-local.ps1 -Configuration Release` | 73 lulus, 0 gagal, 0 dilewati; PostgreSQL lokal, database tes terisolasi; durasi 9 menit 43 detik |
| Build frontend melalui `scripts/build-windows.ps1` | TypeScript dan Vite berhasil; peringatan dependensi SignalR terkait PURE annotation dan bundle >500 kB tetap ada |
| Publish API/worker | Self-contained win-x64 berhasil |
| `scripts/test-windows-deployment.ps1` di Windows PowerShell dengan ExecutionPolicy Bypass | Konfigurasi valid diterima, 8 konfigurasi tidak aman ditolak, folder data tidak terpercaya ditolak, 4 skrip lolos parsing |
| `scripts/test-windows-package.ps1 -PayloadDir <payload>` | Executable hasil publish berjalan sebagai console: HTTPS/SPA, reserved routes 404, session mode OIDC, worker heartbeat berhasil |
| Kompilasi installer final | Berhasil, exit 0, setelah perbaikan review |
| `git diff --check` | Tidak ada kesalahan whitespace |

Smoke test executable memakai sertifikat fixture satu jam pada loopback, tanpa menambahkannya ke trust store. Curl mengabaikan trust hanya untuk koneksi fixture tersebut. Database fixture diarahkan ke port tidak aktif dan ERP dinonaktifkan. Pemeriksaan ini membuktikan startup executable, frontend, mode OIDC dan heartbeat, bukan database readiness, login SSO, atau kepercayaan sertifikat klien. Log fixture berada di `.runtime/windows-smoke-a36744db9ee84facaa6ef175664959b6`.

## Review dan perbaikan

Reviewer terpisah memeriksa runtime, paket, service/ACL, HTTPS, upgrade dan uninstall. Tiga temuan diperbaiki: folder data yang sudah ada dengan owner/ACL tidak terpercaya ditolak dan DACL diganti sebelum menulis secret; trust sertifikat diperiksa dalam konteks Local Computer; penghapusan service dilakukan setelah uninstall dikonfirmasi. Shortcut yang dibuat skrip juga didaftarkan untuk cleanup uninstall.

Tidak ada perubahan pada `compose.yaml` atau Dockerfile untuk opsi Windows. Perubahan Nginx dan modul bisnis yang sudah ada di workspace sebelum pekerjaan ini dipertahankan. Tes production proxy tetap lulus; container Linux tidak dijalankan pada pemeriksaan ini.

## Belum diverifikasi

Sesi tidak memiliki token Administrator. Instalasi service nyata, ACL final pada ProgramData/Program Files di mesin target, startup sesudah reboot, uninstall/upgrade nyata, sertifikat CA perusahaan, koneksi database operasional dan login ke provider SSO perusahaan belum diuji. Tidak ada service production yang dipasang dan tidak ada UAT/perangkat fisik atau backup/restore production yang diklaim. Administrator klien perlu mengikuti `windows-local.md` dan melakukan penerimaan pada mesin target.
