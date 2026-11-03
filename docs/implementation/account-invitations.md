# Undangan akun dan pemulihan password

Admin mengisi nama, email, peran, gudang dan alasan di WMS. Backend menyiapkan akun Keycloak, lalu meminta Keycloak mengirim verifikasi email dan pembuatan password. WMS tidak menerima atau menyimpan password. Akun Keycloak yang sudah ada mempertahankan passwordnya.

Undangan berumur 24 jam. Pilihan admin disimpan sebagai persetujuan; grant baru aktif setelah login SSO dengan email terverifikasi serta issuer/subject yang sesuai. Pemberi undangan harus masih aktif dan masih menjadi admin semua gudang yang dipilih. Permintaan akses lama tetap mengikuti persetujuan manual.

## Konfigurasi sekali oleh IT

1. Gunakan realm Keycloak perusahaan untuk WMS, terpisah dari `master`. `Oidc:Authority` harus berupa issuer realm, misalnya `https://identity.example.com/realms/wms`.
2. Pada realm tersebut, siapkan SMTP yang benar, termasuk pengirim, autentikasi dan TLS. Aktifkan **Forgot password**. Verifikasi email harus membuktikan kepemilikan; jangan mengubah `emailVerified` menjadi true sebagai pengganti verifikasi.
3. Buat client backend terpisah, misalnya `wms-accounts`, dengan client authentication dan service accounts. Matikan standard flow/direct access grants untuk client provisioning ini. Berikan izin mencari/mengelola pengguna hanya dalam realm WMS: role `realm-management` yang diperlukan adalah `query-users`, `view-users`, dan `manage-users`, atau kebijakan fine-grained yang setara. Jangan gunakan akun/secret admin master atau memberikan izin mengelola client/realm. Izin efektif perlu diverifikasi pada versi Keycloak yang dipasang.
4. Pada client OIDC WMS biasa, pertahankan callback `/signin-oidc` dan izinkan juga **ReturnUrl yang persis sama**, misalnya `https://warehouse.example.com/`. Keycloak memvalidasi redirect email terhadap daftar redirect client ini. Hindari wildcard.
5. Konfigurasikan API:

```json
"IdentityProvisioning": {
  "ClientId": "wms-accounts",
  "ClientSecret": "<secret dari penyimpanan privat>",
  "ReturnUrl": "https://warehouse.example.com/"
}
```

Untuk Compose, gunakan `WMS_IDENTITY_CLIENT_ID`, `WMS_IDENTITY_CLIENT_SECRET`, dan `WMS_IDENTITY_RETURN_URL`. Untuk Windows, isi konfigurasi privat installer. Konfigurasi `--deployment-config` yang dimuat terakhir mengalahkan environment dengan key yang sama; edit sumber konfigurasi yang benar. Worker tidak memerlukan secret ini. Kosongnya konfigurasi menghasilkan pesan layanan akun belum dikonfigurasi, tanpa membuat undangan atau mengklaim email terkirim.

Konfigurasi SMTP tidak dikirim ke browser dan tidak disimpan dalam undangan/audit. Tidak ada perubahan otomatis pada realm atau akun Keycloak aktif oleh deployment aplikasi.

## Hasil dan pengulangan

- **sent**: Keycloak menerima permintaan pengiriman; bukan bukti email sudah masuk inbox.
- **failed**: provisioning belum selesai. Periksa layanan, lalu coba lagi dengan ID yang sama.
- **unknown**: hasil pengiriman belum pasti. Cek status secara read-only. **Kirim ulang** adalah keputusan eksplisit dan dapat menghasilkan email tambahan; pengiriman email bukan exactly-once.
- **expired**: kirim ulang untuk masa aktivasi baru. **accepted/cancelled** tidak dipulihkan melalui resend.
- **preparing**: cek status atau lanjutkan undangan dengan ID yang sama jika proses sebelumnya terhenti. Lock per undangan mencegah dua proses provisioning berjalan bersamaan.
- **blocked**: issuer/subject berbeda dari binding awal; IT perlu meninjau perubahan identitas. Resend tidak boleh memindahkan persetujuan ke akun lain hanya karena emailnya sama.

ID undangan dipakai kembali untuk pemeriksaan/retry. Pencarian identitas provider dilakukan sebelum create, termasuk setelah respons create hilang. Nama/email/peran/gudang/alasan terikat ke ID awal; retry tidak boleh mengubahnya. Undangan disimpan dalam `SupportingRecords` dengan kind khusus `account-invitation`; identitas WMS tetap berada dalam `Principals`. Tidak diperlukan migrasi skema. Setelah browser ditutup, buka **Undangan** pada baris user pending untuk melihat hasil atau mengirim ulang.

Binding issuer/subject dan marker `unknown` dikomit sebelum email diproses, sehingga proses terhenti tidak menyebabkan replay pengiriman secara otomatis. Aktivasi memakai verifikasi email pada tiket SSO terbaru, bukan hanya flag verifikasi historis. Pengiriman ulang meminta pembuatan password hanya jika required action tersebut masih belum selesai di Keycloak.

## Admin pertama dan recovery

- Installer menghasilkan kode aktivasi, bukan password WMS. IT menyiapkan identitas provider pertama dengan email terverifikasi dan alur password milik pengguna, misalnya required actions `VERIFY_EMAIL`/`UPDATE_PASSWORD` di Keycloak. Akun perusahaan yang sudah ada mengikuti kebijakan identitas perusahaan.
- Wizard tetap Aktivasi → Admin/SSO → Tinjau. Pilih identitas provider tersebut sebagai admin WMS. Tambahkan admin cadangan melalui undangan dengan peran admin pada gudang yang relevan.
- **Lupa password** di WMS meminta email reset dari Keycloak. Respons sama untuk email yang ada maupun tidak, termasuk kegagalan pengiriman; respons hanya mengonfirmasi penerimaan permintaan. Kegagalan provider dicatat tanpa alamat email/secret dalam pesan log aplikasi. Jika email tidak datang, IT memeriksa SMTP/provider.
- Hilangnya akses Keycloak master berbeda dari hilangnya password user WMS. Untuk darurat, IT memakai [prosedur resmi bootstrap-admin recovery](https://www.keycloak.org/server/bootstrap-admin-recovery): hentikan semua node Keycloak, gunakan konfigurasi database/runtime yang sama untuk membuat admin sementara, pulihkan akun yang tepat, lalu hapus admin sementara. Jangan membuat ulang database WMS atau membuka kembali wizard pada instalasi yang sudah terisi.
- Saat akun diduga disalahgunakan, cabut akses WMS melalui admin cadangan dan terminasi sesi provider sebelum memulihkan. Reset password provider sendiri belum membuktikan cookie sesi WMS yang sudah terbit langsung dicabut; pengujian lintas sesi/live provider masih diperlukan. Pengembangan mekanisme revokasi sesi baru bukan bagian perubahan ini.

## Verifikasi

Tes menggunakan database PostgreSQL uji acak serta provider HTTP simulasi. Tes tidak mengirim email nyata atau mengubah akun provider aktif. Persiapan produksi tetap membutuhkan konfigurasi SMTP/client dan uji aktivasi/recovery dengan email uji yang disetujui. Temuan kuota pendaftaran publik ditunda sesuai arahan pengguna; bukan bagian patch ini.
