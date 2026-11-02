# PRD: Wizard setup admin pertama

## Revisi aktif: tiga langkah, 3 November 2026

Integrasi installer Windows: pada database baru yang telah dimigrasikan, installer otomatis membuat kode, menyimpan kode mentah dalam berkas privat Administrators/SYSTEM dan hash/expiry pada konfigurasi API, sebelum memulai service. Halaman akhir hanya menunjukkan lokasi kode untuk IT. Upgrade tidak mengganti aktivasi terpasang; database terinisialisasi tidak dibuatkan kode baru. Database parsial/migrasi tertunda menolak provisioning. Persiapan HTTPS, SSO, database dan gudang oleh IT tetap diperlukan. Alur browser tetap tiga langkah.

Pengguna menghapus langkah Gudang dan meminta hanya aktivasi, admin/SSO, serta tinjauan. Revisi ini menggantikan kebutuhan form gudang/lokasi, tampilannya pada tinjauan, dan kriteria pengujian form pada rancangan awal di bawah. Aturan keamanan, transaksi, expiry, audit dan pemulihan hasil tidak diketahui tetap berlaku.

- Alur pengguna: Aktivasi → Admin/SSO → Tinjauan → Selesai. Langkah ditampilkan sebagai 1–3.
- SSO yang valid langsung membuka tinjauan. Tinjauan hanya memperlihatkan nama/email admin dan perusahaan dari backend. Tidak ada input, langkah atau ringkasan gudang/lokasi.
- Kembali dari tinjauan membuka tahap SSO agar pengguna dapat memverifikasi ulang akun sebelum menyelesaikan setup.
- IT menyiapkan satu gudang awal beserta lokasi aktual dalam konfigurasi privat `Setup:Warehouse` (`Id`, `Name`, `StorageLocations`). Tidak ada nama/kode gudang klien yang ditebak atau diisi otomatis sebagai data nyata.
- Konfigurasi gudang mengikuti validasi bootstrap yang sudah ada. Konfigurasi tidak lengkap atau tidak valid menghasilkan status unavailable dan tidak membuka setup.
- `/api/setup/session` menghasilkan stage `review` sesudah SSO. `/api/setup/complete` tidak menerima data gudang dari browser; data awal berasal hanya dari konfigurasi server. Payload lama yang mencoba mengganti gudang tidak mengubah hasil bootstrap.
- Bootstrap tetap satu transaksi untuk admin, grant pada satu gudang yang disiapkan IT, settings, lokasi operasional otomatis dan audit. Tidak mengubah model inventori atau menghapus kemampuan gudang dari aplikasi operasional.
- Kriteria penerimaan tambahan: tiga langkah terlihat pada desktop/mobile; tidak ada field gudang/lokasi; SSO langsung ke tinjauan; complete dengan body kosong berhasil; payload gudang palsu diabaikan; provisioning gudang kosong/invalid ditolak; proteksi bootstrap ganda, replay, CSRF dan unknown result tetap berlaku.

## Arsip rancangan awal

Bagian berikut menyimpan rancangan sebelum koreksi pengguna. Baca bersama revisi aktif di atas; kebutuhan gudang pada UI dan validasi isian browser tidak lagi berlaku.

Tanggal: 3 November 2026

Status: Disetujui pengguna; diimplementasikan lokal, verifikasi lingkungan klien masih diperlukan
Dasar: Alur kode aktivasi → SSO → data gudang/lokasi → konfirmasi yang dibahas bersama pengguna.

## Masalah dan tujuan

Admin pertama saat ini dibuat melalui CLI `--bootstrap`. Halaman Minta akses hanya membuat akun pending dan tidak menyelesaikan instalasi tanpa admin. Wizard memungkinkan penanggung jawab instalasi membuat admin pertama lewat browser setelah IT menyiapkan database, HTTPS, dan SSO.

Sukses berarti satu identitas SSO terverifikasi mendapat peran admin pada gudang yang dikonfigurasi, seluruh data awal tersimpan atomik, dan wizard tidak dapat digunakan lagi. Tidak ada stok, transaksi, atau akun contoh yang dibuat.

## Pengguna dan pembagian tanggung jawab

- IT menyiapkan PostgreSQL 18, migrasi skema, HTTPS, penyimpanan kunci Data Protection, dan konfigurasi OIDC perusahaan; IT menerbitkan kode aktivasi privat.
- Penanggung jawab instalasi memegang kode aktivasi, login SSO, dan mengisi gudang serta lokasi awal.
- Setelah setup, admin meninjau permintaan akses pengguna lain melalui alur yang sudah ada.

## Cakupan versi pertama

Wizard berisi aktivasi, autentikasi SSO, satu gudang awal dengan satu atau lebih lokasi penyimpanan, tinjauan, dan hasil. Nama perusahaan ditampilkan dari konfigurasi instalasi sebagai informasi baca saja. Mengubah konfigurasi perusahaan, koneksi database, sertifikat, dan provider SSO lewat browser berada di luar cakupan. Keputusan satu gudang awal membatasi panjang formulir; API bootstrap CLI tetap mendukung banyak gudang.

Di luar cakupan: akun/password lokal production, penggantian admin yang hilang, pemulihan database, stok awal, undangan massal, konfigurasi RFID, dan sinkronisasi antarmesin. Mode demo tetap memakai seed development dan tidak dianggap bukti setup production.

## Pendekatan

Bootstrap manual tetap tersedia bagi IT. Registrasi publik yang menjadikan pendaftar pertama sebagai admin tidak dipakai karena kepemilikan instalasi tidak terverifikasi. Wizard memakai kode aktivasi privat dan identitas OIDC, lalu memanggil layanan bootstrap yang sama. Pilihan ini mempertahankan aturan akses yang sudah ada dan mengurangi duplikasi pembuatan data.

## Prasyarat dan status instalasi

Skema database harus sudah dimigrasikan secara eksplisit. Startup harian tidak menjalankan migrasi atau seed. Status dihitung backend, bukan browser:

| Status | Kondisi | Tampilan/perilaku |
|---|---|---|
| Perlu setup | Tidak ada principal, gudang, atau company settings | Tawarkan setup jika konfigurasi aktivasi valid |
| Belum siap | Database/skema/SSO/aktivasi belum siap | Pesan hubungi IT, tanpa membuka akses operasional |
| Sudah selesai | Company settings dan data bootstrap ada | Login biasa; endpoint mutasi setup menolak |
| Perlu pemeriksaan IT | Hanya sebagian data inisialisasi ada | Jangan mencoba menimpa atau memperbaiki otomatis |

Menghapus admin tidak membuka kembali wizard. Keberadaan data inisialisasi tetap mengunci setup. Health operasional tetap menyatakan belum siap sampai bootstrap selesai; pemeriksaan kesiapan setup dipisahkan agar installer dapat menyelesaikan pemasangan sebelum admin dibuat.

## Alur dan kebutuhan fungsional

### SW-01: Masuk dan aktivasi

Aplikasi membaca status dari backend sebelum memilih setup atau login. Status memuat informasi minimum, tanpa email admin atau rincian database. Kegagalan membaca status menampilkan error dan Coba lagi, bukan menganggap database kosong.

IT menerbitkan kode acak menggunakan generator kriptografis, minimum 32 byte. Konfigurasi menyimpan hash kode dan waktu kedaluwarsa UTC, bukan kode mentah. Usulan implementasi: perintah provisioning menghasilkan kode sekali untuk diserahkan melalui saluran privat; masa berlaku default 24 jam. Kode tidak masuk URL, log, analytics, localStorage, atau ekspor. Form aktivasi menggunakan POST, perlindungan CSRF, HTTPS, dan pembatasan percobaan.

Kode valid memberikan otorisasi setup terbatas melalui cookie terlindungi, HttpOnly, Secure, SameSite dan kedaluwarsa maksimum 30 menit, dibatasi juga oleh masa berlaku kode. Kode salah/kedaluwarsa tidak memberikan sesi setup. IT dapat menerbitkan kode baru; sesi lama ikut tidak berlaku. Kode menjadi tidak berguna begitu bootstrap tersimpan.

### SW-02: Login SSO untuk calon admin

Login menggunakan konfigurasi OIDC yang ada, authorization code dan PKCE. Backend mengikat otorisasi aktivasi ke proses SSO dan memverifikasinya kembali saat callback. Identitas calon admin berasal dari issuer, subject, nama, email dan `email_verified` yang tervalidasi, bukan isian browser.

Login setup tidak menjalankan enrollment pending biasa. Login dan pengajuan akses biasa selama database belum diinisialisasi harus ditolak atau diarahkan ke setup agar tidak membuat principal yang menggagalkan bootstrap. Identitas tanpa email terverifikasi ditolak dengan instruksi hubungi IT. Batal login dapat dicoba ulang selama sesi aktivasi masih berlaku.

### SW-03: Data awal

Form menampilkan perusahaan serta identitas calon admin sebagai baca saja. Isian wajib: ID gudang, nama gudang, dan daftar kode lokasi penyimpanan. Draft dipertahankan saat pindah antar langkah dalam halaman. Jangan menyimpan kode aktivasi atau identitas SSO dalam draft persisten.

Validasi backend mengikuti bootstrap yang ada: ID gudang 1–64 karakter huruf ASCII/angka/underscore/hyphen, bukan `transit`; nama gudang tidak kosong; 1–1000 kode lokasi unik, panjang 1–100 karakter, tanpa `|`, dan bukan `Receiving`, `QC`, atau `Staging`. Trim sebelum pemeriksaan duplikasi dan tampilkan error di isian terkait. Usulan batas nama gudang 200 karakter, diterapkan konsisten pada CLI dan wizard. Tidak ada nilai contoh yang disamarkan sebagai data klien.

Receiving, QC, Staging dan gudang transit dibuat otomatis. Lokasi operasional tidak diperlakukan sebagai lokasi penyimpanan yang pickable. Pengaturan partial delivery awal tetap false sesuai default bootstrap.

### SW-04: Tinjauan dan penyelesaian

Halaman tinjauan menampilkan email/nama calon admin, perusahaan, gudang, daftar lokasi dan lokasi otomatis. Tersedia Kembali dan **Selesaikan setup dan buat admin**. Konfirmasi ini satu-satunya aksi yang membuat data permanen.

Backend memverifikasi ulang sesi aktivasi, masa berlaku, identitas SSO, status database dan input. Backend menggunakan advisory lock database yang sama dengan CLI `ProductionBootstrap.Run`. Pemeriksaan kosong, pembuatan principal aktif/verified, grant admin, company settings, gudang/lokasi, serta audit dilakukan dalam satu transaksi. Dua browser atau CLI dan wizard yang berjalan bersamaan hanya boleh menghasilkan satu bootstrap.

Kegagalan sebelum commit tidak meninggalkan data parsial. Sesudah commit, semua mutasi setup ditolak sekalipun cookie aktivasi masih ada. Hak admin dibaca dari grant database, bukan klaim kiriman browser.

### SW-05: Hasil, timeout dan pemulihan

Sukses menampilkan Setup selesai dan tombol Masuk ke aplikasi. Backend mengakhiri sesi setup; login normal menggunakan identitas admin yang sudah dibuat. Wizard tidak menjanjikan login otomatis jika sesi normal belum diterbitkan.

Saat submit, tombol dinonaktifkan dan status penyimpanan diumumkan. Jika koneksi putus atau respons tidak diketahui, frontend membaca status ulang sebelum menawarkan retry. Status selesai diarahkan ke login; status masih kosong boleh dicoba ulang; status tidak konsisten diarahkan ke IT. Pemeriksaan status tidak membuat akun atau mengulang mutasi.

## UX dan aksesibilitas

Gunakan bahasa Inggris default dan Bahasa Indonesia mengikuti pilihan aplikasi, label langkah yang jelas, heading semantik, fokus terlihat dan navigasi keyboard. Input dan tombol minimum 44px; daftar lokasi panjang memiliki area scroll yang berlabel. Tampilan dapat dipakai pada lebar 360px tanpa overflow halaman. Error ditampilkan dekat isian dan dalam ringkasan; perpindahan langkah memindahkan fokus ke judul. Bedakan loading, kosong, error, sesi habis dan sukses. Tidak ada tombol yang hanya dekorasi.

## Kontrol akses dan audit

Semua endpoint mutasi setup memakai antiforgery dan rate limit; izin setup bukan izin API operasional. Jangan melewati recovery hold. Tidak mencatat kode, cookie, token OIDC, atau secret provider. Audit bootstrap yang ada mencatat identitas admin dan gudang yang dibuat dalam transaksi yang sama. Tidak menambahkan grant lewat endpoint registrasi publik.

## Dampak deployment

CLI bootstrap tetap tersedia dan tetap menolak inisialisasi ulang. Tambahkan konfigurasi aktivasi opt-in pada deployment; instalasi lama tidak membutuhkan kode. Installer Windows perlu menerima kesiapan untuk setup pada database kosong yang sudah dimigrasikan, tanpa mengubah `/health/ready` operasional menjadi sukses palsu. Worker boleh berjalan tanpa memproses data operasional sampai setup selesai; pastikan perilaku ini diverifikasi. Docker memakai pemeriksaan yang membedakan kebutuhan setup dari kegagalan layanan, tanpa mengekspos endpoint mutasi tanpa pembatasan.

## Kriteria penerimaan dan bukti

| ID | Skenario | Hasil wajib |
|---|---|---|
| AC-01 | Database kosong, aktivasi valid | Wizard tersedia, API operasional tetap tidak berizin |
| AC-02 | Kode salah, habis masa berlaku, atau diganti | Tidak ada sesi/grant; percobaan berlebih dibatasi |
| AC-03 | Callback SSO tanpa sesi aktivasi atau email verified | Tidak dapat melanjutkan dan tidak ada principal baru |
| AC-04 | Aktivasi dan SSO valid | Identitas baca saja; tidak ada pending enrollment |
| AC-05 | Lokasi duplikat/reserved atau ID gudang salah | Ditolak backend; tidak ada data bootstrap tersimpan |
| AC-06 | Submit sah | Tepat satu admin, grant pada gudang awal, lokasi otomatis dan audit; stok kosong |
| AC-07 | Dua submit / CLI bersamaan | Satu transaksi berhasil; tidak ada admin/data ganda |
| AC-08 | Respons submit hilang | Baca status; tidak mengulang otomatis atau mengklaim gagal sebelum diketahui |
| AC-09 | Setup selesai / admin kemudian dihapus | Wizard tetap terkunci; kode dan cookie lama tidak berlaku |
| AC-10 | Database parsial atau belum dimigrasikan | Pesan IT; tidak menimpa data |
| AC-11 | Login/registrasi normal sebelum setup | Tidak membuat principal yang menghalangi bootstrap |
| AC-12 | Restart API | Status tetap berasal dari database; sesi aman dan waktu berlaku dihormati |
| AC-13 | Keyboard, 360px, Bahasa Indonesia/Inggris | Semua langkah dapat diselesaikan; error/fokus terbaca |
| AC-14 | Windows/Docker pada database kosong | Layanan setup dapat diakses tanpa mengklaim operasional siap |

Bukti yang dibutuhkan: tes backend pada PostgreSQL terisolasi, tes HTTP untuk CSRF/cookie/OIDC callback dan rate limit, build frontend, serta click-through browser pada desktop/mobile. SSO riil dan installer pada mesin klien tetap memerlukan pengujian dengan konfigurasi klien; pengujian lokal tidak disebut UAT atau bukti production.
