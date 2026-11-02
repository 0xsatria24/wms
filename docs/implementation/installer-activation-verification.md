# Aktivasi otomatis installer Windows

3 November 2026. Scope: installer Windows membuat kode admin pertama dan memasang hash/expiry sebelum service dimulai. Wizard tetap Aktivasi → SSO → Tinjauan. Database, migrasi, HTTPS, SSO dan konfigurasi satu gudang tetap disiapkan IT.

## Perilaku

- API CLI `--installation-state` hanya membaca status; menolak demo, migrasi tertunda dan database parsial.
- Database kosong tanpa hash aktivasi: installer membuat kode acak 32 byte pada `%ProgramData%\InventoryWms\secrets\setup-code.txt`. Direktori dikunci ke Administrators/SYSTEM sebelum penulisan. API hanya mendapat hash/expiry, bukan akses ke direktori kode.
- Hash/expiry dipasang pada konfigurasi runtime otomatis sebelum API dimulai. Masa berlaku awal 24 jam. Kode tidak dicetak ke stdout atau log installer; halaman akhir menunjuk lokasi berkas.
- Retry instalasi yang terputus sebelum konfigurasi runtime tersimpan memakai kembali kode privat yang telah dibuat. Konfigurasi terpasang dipertahankan pada upgrade; database terinisialisasi tidak dibuatkan kode baru. Kode manual yang sebelumnya disiapkan IT tetap didukung.

## Bukti lokal

- `scripts/test-installer-activation.ps1`: lulus untuk generasi, kecocokan hash, expiry, panggilan hardening sebelum tulis, retry, upgrade, database terinisialisasi dan gudang kosong. ACL/service dimock; tes ini tidak membuktikan ACL host atau Windows Service nyata.
- SetupWizardTests + DeploymentTests: 16 tes lulus sebelum penambahan tes probe CLI; satu tes probe CLI tambahan lulus, memanggil proses API pada PostgreSQL terisolasi untuk status empty/initialized dan memastikan tidak membuat principal.
- PowerShell parser dan `git diff --check`: lulus.
- Inno Setup ISCC mengompilasi `setup.iss` dengan payload fixture non-runnable: lulus, termasuk Pascal halaman akhir dan bundling skrip. Ini bukan paket rilis aplikasi.

Belum melakukan instalasi service aktual pada mesin klien atau build ulang paket rilis lengkap. Verifikasi ACL Administrators/SYSTEM, login SSO klien dan installer end-to-end tetap perlu pada host instalasi.
