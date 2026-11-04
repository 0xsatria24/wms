# Diagnosis koneksi lokal dan recovery realtime

5 November 2026. Pemeriksaan memakai Superpowers systematic-debugging dan TDD.

## Temuan dan perbaikan

1. Screenshot menunjukkan localhost5173 ditolak saat preview ada di4185. Ini bukti listener/alamat yang berbeda, bukan bukti API crash. Log Vite yang diperiksa tidak menunjukkan crash. Vite sekarang memakai5173 dengan strictPort: konflik port gagal jelas, tidak bergeser diam-diam.
2. `npm run predev` direproduksi gagal karena worktree tidak memiliki `.runtime/development.env`. Sebelumnya startup selalu mencoba backend standar5080, sementara preview memakai5180. Predev dan Vite sekarang berbagi resolver `WMS_API_TARGET` atau `.runtime/dev-api-target.txt`. Backend khusus diperiksa sebelum frontend berjalan; tanpa target khusus, startup standar tetap dipakai. File konfigurasi lokal diabaikan Git dan tidak menyalin kredensial.
3. Subscribe realtime memakai automatic reconnect tetapi tidak menangani terminal close setelah upaya otomatis habis. Kegagalan JoinWorkspace setelah reconnect juga tidak tertangani. Lifecycle sekarang menjadwalkan satu retry, menghentikan koneksi lama sebelum restart, masuk kembali ke gudang, lalu refresh snapshot. Cleanup membatalkan timer dan mencegah join/refresh untuk scope yang sudah ditutup. Recovery tidak mengirim ulang command stok.

## Verifikasi

- Test baru diamati gagal sebelum helper tersedia, lalu lulus: terminal close, gagal rejoin, cleanup saat start masih berjalan, downtime berulang, dan konsistensi konfigurasi target.
- `npm run predev` pada konfigurasi worktree sekarang berhasil menghubungi API yang benar.
- Build produksi lulus dan seluruh86test frontend lulus (`.runtime/connection-build.log`, `.runtime/connection-tests.log`).
- Menjalankan dev kedua pada5173 menghasilkan error port sudah dipakai, tanpa pindah ke5174. Frontend dan proxy API aktif tetap merespons200.
- Listener frontend/API diperiksa melalui HTTP. Ini pemeriksaan lokal dan simulasi lifecycle koneksi; belum merupakan chaos test atau validasi deployment produksi.

## Produksi

Vite/npm dev adalah server pengembangan. Konfigurasi Docker yang ada memiliki `restart: unless-stopped` dan healthcheck; installer Windows mengatur restart service10/30/60detik. Healthcheck Docker mendeteksi unhealthy, tetapi restart policy sendiri tidak merestart proses yang masih hidup hanya karena unhealthy. Tidak ada perubahan deployment/service produksi pada pekerjaan ini. Tidak ditemukan bukti bahwa kejadian screenshot merupakan crash produksi atau kerusakan database.
