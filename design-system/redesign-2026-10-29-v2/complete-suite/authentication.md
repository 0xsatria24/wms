# Authentication and admin access

Tambahan eksplisit pengguna: Admin login, Registration, Forgot password. Pemetaan: S01, FR-04, UAT-13. Registrasi adalah permintaan akses, tidak memberi hak administrator otomatis. Model SSO/akun lokal masih mengikuti D04; desain akun lokal ini adalah usulan alur, bukan keputusan arsitektur.

## Admin login

Work email, Password, Show password, Sign in. Tautan Forgot password dan Request account; pilihan English / Bahasa Indonesia (santai). Enter mengirim form valid, error ditautkan ke field dan summary, password tidak dihapus ketika email invalid. Authentication failure memakai pesan umum “Email or password is incorrect”. Session expired membawa pengguna kembali login lalu melanjutkan draft yang diizinkan, tanpa auto-submit transaksi. Admin masuk melalui identitas yang sama; hanya role yang sah membuka halaman Users and access. Jika MFA diwajibkan kebijakan, lanjutkan challenge sebelum memilih scope; jangan mem-bypass lewat link admin.

## Registration

Full name, Work email, Company, Invitation code (optional sesuai kebijakan), Password, Confirm password; CTA Request access. Tampilkan aturan password yang benar-benar berlaku saat kebijakan ditetapkan, tanpa menjanjikan aturan panjang yang belum disepakati. Field role bukan pilihan bebas untuk meningkatkan hak. Verifikasi email melalui link lalu status Pending approval. Admin meninjau scope perusahaan/gudang dan role sebelum approve. Pemohon belum dapat membaca stok saat pending. State: required field, password mismatch, invalid/expired invitation, request received, email verification expired, pending approval, denied. Resend memiliki cooldown sesuai kebijakan. Email yang sudah ada tidak dibocorkan melalui pesan respons publik.

## Forgot password and reset

Work email → Send reset link → “If an account exists, a reset link will be sent.” Tautan Back to sign in. Reset page: New password, Confirm password, Save password. Token invalid/expired menampilkan Request a new link. Token satu kali dan masa berlaku mengikuti backend; password tidak dikirim lewat email. Setelah sukses tampilkan Sign in; tidak otomatis memberi sesi admin. Akun SSO diarahkan ke identity provider bila kebijakan mengharuskan; aplikasi tidak berpura-pura mengganti password perusahaan.

## Admin panel

Users and access: tabel Name, Email, Role, Company, Warehouses, Access status. Detail permintaan: identitas terverifikasi, requested scope, role yang akan diberikan, alasan keputusan, Approve / Reject. Edit/revoke memerlukan hak admin dan audit; pengguna tidak menyetujui peningkatan hak dirinya sendiri. Cabut akses memicu pemeriksaan server berikutnya; UI yang masih terbuka bukan izin permanen. State kosong, tidak diizinkan, data berubah, persetujuan berhasil, gagal simpan dan koneksi hilang wajib terpisah.

## Bahasa Indonesia santai

Sign in → Masuk; Request account → Daftar akun; Request access → Minta akses; Forgot password → Lupa password?; Send reset link → Kirim link reset; New password → Password baru; Confirm password → Ulangi password; Pending approval → Menunggu persetujuan; Back to sign in → Kembali ke login; Passwords do not match → Passwordnya belum sama. Pesan tetap jelas dan tidak menyalahkan pengguna.
