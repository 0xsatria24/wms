# Undangan akun WMS

Pengguna menyetujui opsi 1 dan implementasi berurutan pada 3 November 2026.

- Admin mengisi nama, email, peran, dan gudang sekali di WMS. Backend menyiapkan identitas Keycloak dan mengirim tindakan verifikasi email/pembuatan password; password tidak melewati WMS.
- Undangan menyimpan persetujuan admin. Aktivasi akses menunggu login SSO terverifikasi, identitas provider yang sesuai, undangan belum kedaluwarsa, dan kewenangan pemberi undangan masih berlaku.
- Simpan hasil provisioning, kegagalan, dan hasil tidak pasti. Pengulangan memakai ID undangan yang sama; pengiriman ulang merupakan tindakan eksplisit. Akun provider yang sudah ada mempertahankan passwordnya.
- Lupa password mengirim tindakan recovery melalui provider dengan respons publik seragam. SMTP dan client provisioning dikonfigurasi di server, bukan browser. Tanpa konfigurasi, tampilkan status belum tersedia.
- Recovery darurat dilakukan IT melalui prosedur resmi Keycloak; setup awal tidak dibuka kembali. Siapkan admin WMS cadangan melalui undangan.
- Pertahankan tampilan Clear Operations, bahasa EN/ID, scope gudang, dan identitas audit. Tidak ada perubahan fungsi inventory.
- Temuan security kuota pendaftaran ditunda atas permintaan pengguna. Tidak menjalankan audit security lagi atau mengirim email sungguhan untuk pengujian.
- Pengguna mengonfirmasi SMTP disiapkan belakangan. Penyelesaian tahap ini mencakup kode, konfigurasi contoh, dan verifikasi simulasi; aktivasi pengiriman email nyata menunggu konfigurasi tersebut.

Alternatif registrasi mandiri tidak dipilih: pengguna memilih undangan terkontrol dari WMS. Implementasi dikerjakan langsung secara berurutan pada workspace yang diminta; tidak memindahkan pekerjaan atau menyentuh file pengguna yang tidak terkait.
