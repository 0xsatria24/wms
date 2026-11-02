# Database development di luar OneDrive

Kode proyek tetap berada di direktori proyek. Cluster PostgreSQL development dapat ditempatkan di direktori lokal terpisah agar file database aktif tidak ikut sinkronisasi OneDrive.

Pada mesin ini lokasi data adalah `%LOCALAPPDATA%\InventoryWms\postgres18\pgdata`. Berkas lokal yang diabaikan Git, `.runtime/postgres-data-path.txt`, menyimpan path absolut tersebut. `scripts/local-environment.ps1` membaca path ini untuk startup, shutdown, dan pengujian lokal. Tanpa berkas tersebut, lokasi bawaan tetap `.runtime/pgdata`.

Port PostgreSQL tetap `55432`; konfigurasi koneksi dan data aplikasi tidak diubah. File log tetap berada di `.runtime` proyek.

Jalankan aplikasi dengan `npm run dev`. Sebelum mematikan mesin atau memindahkan data, hentikan aplikasi dan database dengan:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/stop-local.ps1 -StopDatabase
```

Tunggu sampai PostgreSQL melaporkan shutdown selesai. Menutup terminal frontend saja tidak menghentikan database yang berjalan di background.

`scripts/relocate-local-postgres.ps1` merupakan utilitas pemindahan satu kali untuk cluster bawaan pada drive C:. Utilitas menunggu shutdown bersih, menolak tujuan yang sudah ada, memindahkan direktori pada drive yang sama, memeriksa jumlah dan ukuran file, menyimpan path lokal, kemudian menjalankan aplikasi kembali. Jangan menjalankan startup paralel selama pemindahan. Lokasi baru tetap perlu dicadangkan; berada di luar OneDrive tidak menyediakan backup otomatis.
